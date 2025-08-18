import { logger } from './logger';
import { getCorsHeaders } from './security/cors';
import { WS_MESSAGE_TYPES } from '../constants/ws-message-types';

export enum ErrorCode {
  // Client errors (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_INPUT = 'INVALID_INPUT',

  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',

  // WebSocket specific errors
  WEBSOCKET_MESSAGE_ERROR = 'WEBSOCKET_MESSAGE_ERROR',

  // Game specific errors
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  ROOM_FULL = 'ROOM_FULL',
  GAME_NOT_ACTIVE = 'GAME_NOT_ACTIVE',
  INVALID_GAME_STATE = 'INVALID_GAME_STATE',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  USER_ALREADY_IN_ROOM = 'USER_ALREADY_IN_ROOM',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  USERNAME_TAKEN = 'USERNAME_TAKEN'
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: Record<string, any>;
  cause?: Error;
  timestamp?: number;
  requestId?: string;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;
  public readonly timestamp: number;
  public readonly requestId?: string;

  constructor(errorDetails: ErrorDetails) {
    super(errorDetails.message);
    this.name = 'AppError';
    this.code = errorDetails.code;
    this.statusCode = errorDetails.statusCode;
    this.details = errorDetails.details;
    this.timestamp = errorDetails.timestamp || Date.now();
    this.requestId = errorDetails.requestId;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        details: this.details,
        timestamp: this.timestamp,
        requestId: this.requestId
      }
    };
  }
}

export class ErrorHandler {
  private static errorCounts = new Map<ErrorCode, number>();

  static createErrorResponse(
    error: AppError | Error | unknown,
    origin: string | null = null,
    requestId?: string
  ): Response {
    let appError: AppError;

    if (error instanceof AppError) {
      appError = error;
    } else if (error instanceof Error) {
      appError = new AppError({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
        statusCode: 500,
        cause: error,
        requestId
      });
    } else {
      appError = new AppError({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Unknown error occurred',
        statusCode: 500,
        requestId
      });
    }

    this.logError(appError);
    this.updateErrorMetrics(appError);

    const responseBody = {
      error: {
        code: appError.code,
        message: appError.message,
        timestamp: appError.timestamp,
        ...(appError.requestId && { requestId: appError.requestId }),
        ...(appError.details && { details: appError.details })
      }
    };

    return new Response(JSON.stringify(responseBody), {
      status: appError.statusCode,
      headers: {
        ...getCorsHeaders(origin),
        'Content-Type': 'application/json'
      }
    });
  }

  static handleWebSocketError(
    ws: any,
    error: AppError | Error | unknown,
    context?: string
  ): void {
    let appError: AppError;

    if (error instanceof AppError) {
      appError = error;
    } else if (error instanceof Error) {
      appError = new AppError({
        code: ErrorCode.WEBSOCKET_MESSAGE_ERROR,
        message: 'WebSocket error occurred',
        statusCode: 500,
        cause: error,
        details: { context }
      });
    } else {
      appError = new AppError({
        code: ErrorCode.WEBSOCKET_MESSAGE_ERROR,
        message: 'Unknown WebSocket error',
        statusCode: 500,
        details: { context }
      });
    }


    this.logError(appError);
    this.updateErrorMetrics(appError);

    try {
      ws.send(JSON.stringify({
        type: WS_MESSAGE_TYPES.ERROR,
        data: {
          code: appError.code,
          message: appError.message,
          timestamp: appError.timestamp
        }
      }));
    } catch (sendError) {
      logger.error('Failed to send error message to WebSocket client:', sendError);
    }
  }

  private static logError(error: AppError): void {
    const logData = {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
      requestId: error.requestId,
      stack: error.stack
    };

    if (error.statusCode >= 500) {
      logger.error('Server error:', logData);
    } else if (error.statusCode >= 400) {
      logger.warn('Client error:', logData);
    } else {
      logger.info('Error handled:', logData);
    }
  }

  private static updateErrorMetrics(error: AppError): void {
    const currentCount = this.errorCounts.get(error.code) || 0;
    this.errorCounts.set(error.code, currentCount + 1);
  }

  static getErrorStats(): {
    totalErrors: number;
    errorsByCode: Record<ErrorCode, number>;
    topErrors: { code: ErrorCode; count: number }[];
  } {
    const errorsByCode = Object.values(ErrorCode).reduce((acc, code) => {
      acc[code as ErrorCode] = this.errorCounts.get(code as ErrorCode) ?? 0;
      return acc;
    }, {} as Record<ErrorCode, number>);

    return {
      totalErrors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
      errorsByCode,
      topErrors: Array.from(this.errorCounts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([code, count]) => ({ code, count }))
    };
  }

  static createValidationError(message: string, details?: Record<string, any>): AppError {
    return new AppError({
      code: ErrorCode.VALIDATION_ERROR,
      message,
      statusCode: 400,
      details
    });
  }

  static createNotFoundError(resource: string): AppError {
    return new AppError({
      code: ErrorCode.NOT_FOUND,
      message: `${resource} not found`,
      statusCode: 404
    });
  }

  static createRoomError(message: string, code: ErrorCode = ErrorCode.ROOM_NOT_FOUND): AppError {
    return new AppError({
      code,
      message,
      statusCode: 400
    });
  }

  static createPermissionError(message: string = 'Permission denied'): AppError {
    return new AppError({
      code: ErrorCode.PERMISSION_DENIED,
      message,
      statusCode: 403
    });
  }

  static createRateLimitError(retryAfter?: number): AppError {
    return new AppError({
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: 'Rate limit exceeded',
      statusCode: 429,
      details: retryAfter ? { retryAfter } : undefined
    });
  }

  static asyncHandler(
    handler: (req: Request) => Promise<Response>
  ) {
    return async (req: Request): Promise<Response> => {
      try {
        return await handler(req);
      } catch (error) {
        const origin = req.headers.get('origin');
        return this.createErrorResponse(error, origin);
      }
    };
  }

  static setupGlobalErrorHandlers(): void {
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);

      const appError = new AppError({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Uncaught exception',
        statusCode: 500,
        cause: error
      });

      this.updateErrorMetrics(appError);

      process.exit(1);
    });

    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);

      const appError = new AppError({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Unhandled promise rejection',
        statusCode: 500,
        details: { reason: String(reason) }
      });

      this.updateErrorMetrics(appError);
    });
  }
}

ErrorHandler.setupGlobalErrorHandlers();
