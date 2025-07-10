import { z } from 'zod';
import {
  DIFFICULTY_LEVELS,
  VALIDATION_LIMITS,
  REGEX_PATTERNS,
  INAPPROPRIATE_WORDS
} from '../constants';
import { InputSanitizer } from './security/input-sanitizer';

export const UsernameSchema = z
  .string()
  .min(VALIDATION_LIMITS.USERNAME.MIN)
  .max(VALIDATION_LIMITS.USERNAME.MAX)
  .regex(REGEX_PATTERNS.USERNAME)
  .refine(val => val.trim().length > 0)
  .refine(val => !INAPPROPRIATE_WORDS.some(word => val.toLowerCase().includes(word)))
  .transform(InputSanitizer.sanitizeUsername);

export const RoomNameSchema = z
  .string()
  .min(VALIDATION_LIMITS.ROOM_NAME.MIN)
  .max(VALIDATION_LIMITS.ROOM_NAME.MAX)
  .regex(REGEX_PATTERNS.ROOM_NAME)
  .refine(val => val.trim().length > 0)
  .transform(InputSanitizer.sanitizeRoomName);

export const DifficultySchema = z.enum(DIFFICULTY_LEVELS);
export const UserIdSchema = z.string().min(VALIDATION_LIMITS.USER_ID.MIN).max(VALIDATION_LIMITS.USER_ID.MAX);
export const InviteCodeSchema = z.string().length(VALIDATION_LIMITS.INVITE_CODE_LENGTH).regex(REGEX_PATTERNS.INVITE_CODE);
export const PasscodeSchema = z.string().min(VALIDATION_LIMITS.PASSCODE.MIN).max(VALIDATION_LIMITS.PASSCODE.MAX);
export const AnswerSchema = z.string().min(VALIDATION_LIMITS.ANSWER.MIN).max(VALIDATION_LIMITS.ANSWER.MAX).transform(InputSanitizer.sanitizeString);

export const QuestionCountSchema = z.number().min(VALIDATION_LIMITS.QUESTION_COUNT.MIN).max(VALIDATION_LIMITS.QUESTION_COUNT.MAX);
export const TimePerQuestionSchema = z.number().min(VALIDATION_LIMITS.TIME_PER_QUESTION.MIN).max(VALIDATION_LIMITS.TIME_PER_QUESTION.MAX);

export const RoomSettingsSchema = z.object({
  difficulty: DifficultySchema.optional(),
  questionCount: QuestionCountSchema.optional(),
  timePerQuestion: TimePerQuestionSchema.optional(),
  allowSpectators: z.boolean().optional(),
  showLeaderboard: z.boolean().optional(),
}).strict();

const createValidator = <T>(schema: z.ZodSchema<T>) =>
  (data: unknown): { valid: boolean; error?: string } => {
    const result = schema.safeParse(data);
    return result.success
      ? { valid: true }
      : { valid: false, error: result.error.errors[0]?.message || 'Validation failed' };
  };

export const validateUsername = createValidator(UsernameSchema);
export const validateRoomName = createValidator(RoomNameSchema);
export const validateDifficulty = createValidator(DifficultySchema);
export const validateRoomSettings = createValidator(RoomSettingsSchema);
export const validateInviteCode = createValidator(InviteCodeSchema);
export const validatePasscode = createValidator(PasscodeSchema);
export const validateUserId = createValidator(UserIdSchema);

export const safeValidate = <T>(schema: z.ZodSchema<T>, data: unknown) => {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true as const, data: result.data };
  } else {
    // Group errors by field and show only the first error per field
    const errorMap = new Map<string, string>();
    for (const e of result.error.errors) {
      const path = e.path.join('.');
      if (!errorMap.has(path)) {
        errorMap.set(path, e.message);
      }
    }
    const errorMessages = Array.from(errorMap.entries())
      .map(([path, message]) => `${path}: ${message}`)
      .join('; ');
    return { success: false as const, error: errorMessages || 'Validation failed' };
  }
};

export const sanitizeString = InputSanitizer.sanitizeString;