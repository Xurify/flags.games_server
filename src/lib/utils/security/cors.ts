import { SECURITY_CONFIG } from './config';
import { isOriginAllowed } from './network';
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
