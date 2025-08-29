export const SECURITY_CONFIG = {
  ALLOWED_ORIGINS: ["http://localhost:3000", "http://localhost:3001", "https://flags.games", "https://www.flags.games"],

  RATE_LIMITS: {
    MAX_CONNECTIONS_PER_IP: 1,
    MESSAGE_SIZE_LIMIT: 10000, // 10KB
  },

  CORS: {
    ALLOW_CREDENTIALS: false,
    ALLOWED_METHODS: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    ALLOWED_HEADERS: ["Content-Type", "Authorization", "X-Requested-With"],
  },
};

