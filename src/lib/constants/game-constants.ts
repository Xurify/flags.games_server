export const CORRECT_POINT_COST = 1;
export const MAX_HEARTS = 3;

export type Difficulty = "easy" | "medium" | "hard" | "expert";

export const DIFFICULTY_LEVELS = ["easy", "medium", "hard", "expert"] as const;

export const GAME_MODES = ["classic", "speed", "elimination"] as const;

export const DEFAULT_DIFFICULTY: Difficulty = "easy";
export const MEDIUM_DIFFICULTY: Difficulty = "medium";
export const HARD_DIFFICULTY: Difficulty = "hard";
export const EXPERT_DIFFICULTY: Difficulty = "expert";

export const VALIDATION_LIMITS = {
  USERNAME: { MIN: 2, MAX: 30 },
  ROOM_NAME: { MIN: 3, MAX: 50 },
  USER_ID: { MIN: 1, MAX: 50 },
  ANSWER: { MIN: 1, MAX: 100 },
  INVITE_CODE_LENGTH: 6,
  QUESTION_COUNT: { MIN: 15, MAX: 197 },
  TIME_PER_QUESTION: { MIN: 10, MAX: 60 },
  ROOM_SIZE: { MIN: 2, MAX: 5 }
} as const;

export const REGEX_PATTERNS = {
  USERNAME: /^[a-zA-Z0-9\s\-_\.]+$/,
  ROOM_NAME: /^[a-zA-Z0-9\s\-_\.!]+$/,
  INVITE_CODE: /^[A-Z0-9]{6}$/,
} as const;

export const INAPPROPRIATE_WORDS = [
  'admin', 'moderator', 'bot', 'system', 'null', 'undefined'
] as const; 