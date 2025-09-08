export const CORRECT_POINT_COST = 10;
export const MAX_HEARTS = 3;

export type Difficulty = "easy" | "medium" | "hard" | "expert";

export const DIFFICULTY_LEVELS = ["easy", "medium", "hard", "expert"] as const;

export const GAME_MODES = ["classic", "speed", "elimination"] as const;

export const DEFAULT_DIFFICULTY: Difficulty = "easy";
export const MEDIUM_DIFFICULTY: Difficulty = "medium";
export const HARD_DIFFICULTY: Difficulty = "hard";
export const EXPERT_DIFFICULTY: Difficulty = "expert";

export const REGEX_PATTERNS = {
  USERNAME: /^[\p{L}\p{N}\s\-_\.]+$/u,
  ROOM_NAME: /^[a-zA-Z0-9\s\-_\.!]+$/u,
  INVITE_CODE: /^[a-zA-Z0-9\-_]+$/,
} as const;

export const INAPPROPRIATE_WORDS = [
  'admin', 'moderator', 'bot', 'system', 'null', 'undefined'
] as const; 

export const MAX_ROOM_LIFETIME_MS = 4 * 60 * 60 * 1000;

export const TIME_PER_QUESTION_ALLOWED = [10, 15, 20, 30] as const;