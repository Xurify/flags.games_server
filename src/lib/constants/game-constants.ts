export const CORRECT_POINT_COST = 1;
export const MAX_HEARTS = 3;

export type Difficulty = "easy" | "medium" | "hard" | "expert";

export const DIFFICULTY_LEVELS = ["easy", "medium", "hard", "expert"] as const;

export const GAME_MODES = ["classic", "speed", "elimination"] as const;

export const DEFAULT_DIFFICULTY: Difficulty = "easy";
export const MEDIUM_DIFFICULTY: Difficulty = "medium";
export const HARD_DIFFICULTY: Difficulty = "hard";
export const EXPERT_DIFFICULTY: Difficulty = "expert";

export const REGEX_PATTERNS = {
  USERNAME: /^[a-zA-Z0-9\s\-_\.]+$/,
  ROOM_NAME: /^[a-zA-Z0-9\s\-_\.!]+$/,
  INVITE_CODE: /^[a-zA-Z0-9\-_]+$/,
} as const;

export const INAPPROPRIATE_WORDS = [
  'admin', 'moderator', 'bot', 'system', 'null', 'undefined'
] as const; 