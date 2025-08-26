import { SECURITY_CONFIG, isOriginAllowed } from '../../config/security';
import { logger } from '../logger';

export const getCorsHeaders = (origin: string | null): Record<string, string> => {
  let allowedOrigin = "https://flags.games";

  if (origin && isOriginAllowed(origin)) {
    allowedOrigin = origin;
  } else if (!origin && SECURITY_CONFIG.ALLOWED_ORIGINS.length > 0) {
    allowedOrigin = SECURITY_CONFIG.ALLOWED_ORIGINS[0];
  }

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": SECURITY_CONFIG.CORS.ALLOWED_METHODS.join(", "),
    "Access-Control-Allow-Headers": SECURITY_CONFIG.CORS.ALLOWED_HEADERS.join(", "),
    "Access-Control-Allow-Credentials": SECURITY_CONFIG.CORS.ALLOW_CREDENTIALS.toString(),
    "Vary": "Origin",
    // Security headers
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: ws:;",
  };
};

export const handlePreflightRequest = (request: Request): Response => {
  const origin = request.headers.get("origin");

  if (!isOriginAllowed(origin)) {
    logger.warn(`CORS preflight rejected for origin: ${origin}`);
    return new Response(null, {
      status: 403,
      statusText: "Forbidden - Origin not allowed"
    });
  }

  const headers = getCorsHeaders(origin);
  headers["Access-Control-Max-Age"] = "86400";

  return new Response(null, {
    status: 204,
    headers,
  });
};
