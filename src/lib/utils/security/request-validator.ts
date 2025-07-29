import { z } from 'zod';
import { InputSanitizer } from './input-sanitizer';
import { isOriginAllowed, SECURITY_CONFIG } from '../../config/security';
import { logger } from '../logger';

interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedData?: any;
}

interface RequestValidationOptions {
  requireOrigin?: boolean;
  maxBodySize?: number;
  allowedMethods?: string[];
  requireContentType?: string[];
}

export class RequestValidator {
  private static readonly DEFAULT_OPTIONS: RequestValidationOptions = {
    requireOrigin: true,
    maxBodySize: 1024 * 1024, // 1MB
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    requireContentType: ['application/json']
  };

  static async validateRequest(
    request: Request,
    options: RequestValidationOptions = {}
  ): Promise<ValidationResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    if (opts.allowedMethods && !opts.allowedMethods.includes(request.method)) {
      return {
        valid: false,
        error: `Method ${request.method} not allowed`
      };
    }

    if (opts.requireOrigin && request.method !== 'GET') {
      const origin = request.headers.get('origin');
      if (!isOriginAllowed(origin)) {
        logger.warn(`Request rejected: invalid origin ${origin}`);
        return {
          valid: false,
          error: 'Invalid or missing origin'
        };
      }
    }

    if (request.method !== 'GET' && request.method !== 'DELETE') {
      const contentType = request.headers.get('content-type');
      if (opts.requireContentType && contentType) {
        const isValidContentType = opts.requireContentType.some(type =>
          contentType.includes(type)
        );
        if (!isValidContentType) {
          return {
            valid: false,
            error: `Invalid content type: ${contentType}`
          };
        }
      }
    }

    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > opts.maxBodySize!) {
      return {
        valid: false,
        error: `Request body too large. Max size: ${opts.maxBodySize} bytes`
      };
    }

    return { valid: true };
  }

  static async validateJsonBody<T>(
    request: Request,
    schema: z.ZodSchema<T>
  ): Promise<ValidationResult> {
    try {
      if (request.method === 'GET' || request.method === 'DELETE') {
        return { valid: true, sanitizedData: null };
      }

      const contentType = request.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return {
          valid: false,
          error: 'Content-Type must be application/json'
        };
      }

      let body: any;
      try {
        const text = await request.text();
        if (!text.trim()) {
          return { valid: true, sanitizedData: null };
        }
        body = JSON.parse(text);
      } catch (error) {
        return {
          valid: false,
          error: 'Invalid JSON format'
        };
      }

      const bodyString = JSON.stringify(body);
      if (InputSanitizer.containsSQLInjection(bodyString)) {
        logger.warn('Request rejected: potential SQL injection detected');
        return {
          valid: false,
          error: 'Invalid request content'
        };
      }

      if (InputSanitizer.containsXSS(bodyString)) {
        logger.warn('Request rejected: potential XSS detected');
        return {
          valid: false,
          error: 'Invalid request content'
        };
      }

      const result = schema.safeParse(body);
      if (!result.success) {
        const errorMessage = result.error.issues[0]?.message || 'Validation failed';
        return {
          valid: false,
          error: `Validation error: ${errorMessage}`
        };
      }

      return {
        valid: true,
        sanitizedData: result.data
      };

    } catch (error) {
      logger.error('Error validating request body:', error);
      return {
        valid: false,
        error: 'Request validation failed'
      };
    }
  }

  /**
   * Validate query parameters
   * @param request - The incoming request
   * @param schema - Zod schema for query parameters
   * @returns Validation result
   */
  static validateQueryParams<T>(
    request: Request,
    schema: z.ZodSchema<T>
  ): ValidationResult {
    try {
      const url = new URL(request.url);
      const params: Record<string, string> = {};
      
      for (const [key, value] of url.searchParams.entries()) {
        const sanitizedKey = InputSanitizer.sanitizeString(key);
        const sanitizedValue = InputSanitizer.sanitizeString(value);
        
        if (sanitizedKey && sanitizedValue) {
          params[sanitizedKey] = sanitizedValue;
        }
      }

      const result = schema.safeParse(params);
      if (!result.success) {
        const errorMessage = result.error.issues[0]?.message || 'Query validation failed';
        return {
          valid: false,
          error: errorMessage
        };
      }

      return {
        valid: true,
        sanitizedData: result.data
      };

    } catch (error) {
      return {
        valid: false,
        error: 'Invalid query parameters'
      };
    }
  }

  /**
   * Create validation middleware for specific endpoint
   * @param bodySchema - Schema for request body validation
   * @param querySchema - Schema for query parameter validation
   * @param options - Validation options
   * @returns Middleware function
   */
  static createMiddleware<TBody = any, TQuery = any>(
    bodySchema?: z.ZodSchema<TBody>,
    querySchema?: z.ZodSchema<TQuery>,
    options: RequestValidationOptions = {}
  ) {
    return async (request: Request): Promise<{
      response?: Response;
      validatedData?: {
        body?: TBody;
        query?: TQuery;
      };
    }> => {
      const basicValidation = await this.validateRequest(request, options);
      if (!basicValidation.valid) {
        return {
          response: new Response(
            JSON.stringify({ error: basicValidation.error }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        };
      }

      const validatedData: any = {};

      if (bodySchema) {
        const bodyValidation = await this.validateJsonBody(request, bodySchema);
        if (!bodyValidation.valid) {
          return {
            response: new Response(
              JSON.stringify({ error: bodyValidation.error }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              }
            )
          };
        }
        validatedData.body = bodyValidation.sanitizedData;
      }

      if (querySchema) {
        const queryValidation = this.validateQueryParams(request, querySchema);
        if (!queryValidation.valid) {
          return {
            response: new Response(
              JSON.stringify({ error: queryValidation.error }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              }
            )
          };
        }
        validatedData.query = queryValidation.sanitizedData;
      }

      return { validatedData };
    };
  }

  /**
   * Validate common headers
   * @param request - The incoming request
   * @returns Validation result
   */
  static validateHeaders(request: Request): ValidationResult {
    const userAgent = request.headers.get('user-agent');
    
    if (!userAgent) {
      return {
        valid: false,
        error: 'User-Agent header required'
      };
    }

    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i
    ];

    const isSuspicious = suspiciousPatterns.some(pattern => 
      pattern.test(userAgent)
    );

    if (isSuspicious) {
      logger.warn(`Suspicious user agent detected: ${userAgent}`);
      return {
        valid: false,
        error: 'Access denied'
      };
    }

    return { valid: true };
  }
}
