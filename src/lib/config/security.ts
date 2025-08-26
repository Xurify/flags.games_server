import { isDevelopment } from "../utils/env";

export const SECURITY_CONFIG = {
  ALLOWED_ORIGINS: ["http://localhost:3000", "http://localhost:3001", "https://flags.games", "https://www.flags.games"],

  RATE_LIMITS: {
    // Conservative limits - most legitimate users need only 1-2 connections
    MAX_CONNECTIONS_PER_IP: isDevelopment ? 5 : 2, 
    MAX_CONNECTIONS_PER_IP_STRICT: 1, // For production strict mode
    MESSAGE_SIZE_LIMIT: 10000, // 10KB
    REQUESTS_PER_MINUTE: 60, // Add API rate limiting
    WEBSOCKET_MESSAGES_PER_MINUTE: 30, // Lower for game integrity
    CONNECTION_CLEANUP_TIMEOUT: 30000, // 30 seconds to clean stale connections
  },

  CORS: {
    ALLOW_CREDENTIALS: true,
    ALLOWED_METHODS: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    ALLOWED_HEADERS: ["Content-Type", "Authorization", "X-Requested-With", "X-Admin-Token"],
  },
};

export const isOriginAllowed = (origin: string | null): boolean => {
  if (!origin) return isDevelopment;
  return SECURITY_CONFIG.ALLOWED_ORIGINS.includes(origin);
};

export const getClientIP = (request: Request): string => {
  return request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
};
