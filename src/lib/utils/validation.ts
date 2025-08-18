import { z } from 'zod';
import {
  DIFFICULTY_LEVELS,
  REGEX_PATTERNS,
  INAPPROPRIATE_WORDS,
  GAME_MODES
} from '../constants';
import { InputSanitizer } from './security/input-sanitizer';

const VALIDATION_LIMITS = {
  USERNAME: { MIN: 2, MAX: 30 },
  ROOM_NAME: { MIN: 3, MAX: 50 },
  USER_ID: { MIN: 32, MAX: 32 },
  ANSWER: { MIN: 1, MAX: 100 },
  INVITE_CODE_LENGTH: 6,
  QUESTION_COUNT: { MIN: 15, MAX: 197 },
  ROOM_SIZE: { MIN: 2, MAX: 5 }
} as const;

export const UsernameSchema = z
  .string()
  .min(VALIDATION_LIMITS.USERNAME.MIN)
  .max(VALIDATION_LIMITS.USERNAME.MAX)
  .regex(REGEX_PATTERNS.USERNAME)
  .refine(value => value.trim().length > 0)
  .refine(value => !INAPPROPRIATE_WORDS.some(word => value.toLowerCase().includes(word)))
  .transform(InputSanitizer.sanitizeUsername);

export const RoomNameSchema = z
  .string()
  .min(VALIDATION_LIMITS.ROOM_NAME.MIN)
  .max(VALIDATION_LIMITS.ROOM_NAME.MAX)
  .regex(REGEX_PATTERNS.ROOM_NAME)
  .refine(value => value.trim().length > 0)
  .transform(InputSanitizer.sanitizeRoomName);

export const DifficultySchema = z.enum(DIFFICULTY_LEVELS);
export const GameModeSchema = z.enum(GAME_MODES);
export const UserIdSchema = z.uuidv4().min(VALIDATION_LIMITS.USER_ID.MIN).max(VALIDATION_LIMITS.USER_ID.MAX);
export const InviteCodeSchema = z.string().length(VALIDATION_LIMITS.INVITE_CODE_LENGTH);
export const AnswerSchema = z.string().min(VALIDATION_LIMITS.ANSWER.MIN).max(VALIDATION_LIMITS.ANSWER.MAX).transform(InputSanitizer.sanitizeString);

export const QuestionCountSchema = z.number().min(VALIDATION_LIMITS.QUESTION_COUNT.MIN).max(VALIDATION_LIMITS.QUESTION_COUNT.MAX);

export const TIME_PER_QUESTION_ALLOWED = [10, 15, 20, 30] as const;
export type TimePerQuestion = typeof TIME_PER_QUESTION_ALLOWED[number];
export const TimePerQuestionSchema = z.union([
  z.literal(10),
  z.literal(15),
  z.literal(20),
  z.literal(30),
]);

export const RoomSettingsSchema = z.object({
  difficulty: DifficultySchema.optional(),
  questionCount: QuestionCountSchema.optional(),
  timePerQuestion: TimePerQuestionSchema.optional(),
  allowSpectators: z.boolean().optional(),
  showLeaderboard: z.boolean().optional(),
  gameMode: GameModeSchema.optional(),
  maxRoomSize: z.number().min(2).max(5).optional(),
}).strict();

const createValidator = <T>(schema: z.ZodSchema<T>) =>
  (data: unknown): { valid: boolean; error?: string } => {
    const result = schema.safeParse(data);
    return result.success
      ? { valid: true }
      : { valid: false, error: result.error.issues[0]?.message || 'Validation failed' };
  };

export const validateUsername = createValidator(UsernameSchema);
export const validateRoomName = createValidator(RoomNameSchema);
export const validateDifficulty = createValidator(DifficultySchema);
export const validateRoomSettings = createValidator(RoomSettingsSchema);
export const validateInviteCode = createValidator(InviteCodeSchema);
export const validateUserId = createValidator(UserIdSchema);

export const safeValidate = <T>(schema: z.ZodSchema<T>, data: unknown) => {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true as const, data: result.data };
  } else {
    const errorMap = new Map<string, string>();
    for (const issue of result.error.issues) {
      const path = issue.path.join('.');
      if (!errorMap.has(path)) {
        errorMap.set(path, issue.message);
      }
    }
    const errorMessages = Array.from(errorMap.entries())
      .map(([path, message]) => `${path}: ${message}`)
      .join('; ');
    return { success: false as const, error: errorMessages || 'Validation failed' };
  }
};

export const sanitizeString = InputSanitizer.sanitizeString;