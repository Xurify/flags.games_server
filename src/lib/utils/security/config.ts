interface SecurityConfig {
  ALLOWED_ORIGINS: {
    development: string[];
    production: string[];
    staging: string[];
  };
  RATE_LIMITS: RateLimits;
  CORS: CorsConfig;
}

interface RateLimits {
  MAX_CONNECTIONS_PER_IP: number;
  MESSAGE_SIZE_LIMIT: number;
  GLOBAL_MESSAGES_PER_CONNECTION: RateLimitRule;
  ACTIONS: Record<string, ActionLimitConfig>;
}

interface RateLimitRule {
  limit: number;
  resetIntervalMs: number;
}

interface ActionLimitConfig {
  perUser?: RateLimitRule;
  perIP?: RateLimitRule;
}

interface CorsConfig {
  ALLOW_CREDENTIALS: boolean;
  ALLOWED_METHODS: string[];
  ALLOWED_HEADERS: string[];
}

export const SECURITY_CONFIG: SecurityConfig = {
  ALLOWED_ORIGINS: {
    development: ["http://localhost:3000", "http://localhost:3001"],
    production: ["https://flags.games"],
    staging: ["https://staging.flags.games"],
  },

  RATE_LIMITS: {
    MAX_CONNECTIONS_PER_IP: 5,
    MESSAGE_SIZE_LIMIT: 10000, // 10KB
    GLOBAL_MESSAGES_PER_CONNECTION: {
      limit: 50,
      resetIntervalMs: 10_000,
    },
    ACTIONS: {
      CREATE_ROOM: {
        perUser: { limit: 5, resetIntervalMs: 60_000 },
      },
      JOIN_ROOM: {
        perUser: { limit: 20, resetIntervalMs: 60_000 },
      },
      START_GAME: {
        perUser: { limit: 10, resetIntervalMs: 60_000 },
      },
      SUBMIT_ANSWER: {
        perUser: { limit: 50, resetIntervalMs: 10_000 },
      },
    },
  },

  CORS: {
    ALLOW_CREDENTIALS: false,
    ALLOWED_METHODS: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    ALLOWED_HEADERS: ["Content-Type", "Authorization", "X-Requested-With"],
  },
};

