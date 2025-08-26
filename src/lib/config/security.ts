import { isDevelopment } from "../utils/env";

export const SECURITY_CONFIG = {
  ALLOWED_ORIGINS: ["http://localhost:3000", "http://localhost:3001", "https://flags.games", "https://www.flags.games"],

  RATE_LIMITS: {
    MAX_CONNECTIONS_PER_IP: 1,
    MESSAGE_SIZE_LIMIT: 10_000, // 10KB
    WS: {
      HANDSHAKES_PER_MINUTE: 30,
      AUTH_PER_MINUTE: 10,
      JOIN_PER_MINUTE: 20,
      CREATE_ROOM_PER_MINUTE: 10,
      MESSAGES_PER_MINUTE: 120,
    },
  },

  CORS: {
    ALLOW_CREDENTIALS: true,
    ALLOWED_METHODS: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    ALLOWED_HEADERS: ["Content-Type", "Authorization", "X-Requested-With"],
  },
};

export const isOriginAllowed = (origin: string | null): boolean => {
  if (!origin) { return isDevelopment; }
  return SECURITY_CONFIG.ALLOWED_ORIGINS.includes(origin);
};

export const getClientIP = (request: Request): string => {
  return request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
};
