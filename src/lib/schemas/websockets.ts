import { z } from 'zod';
import {
  UsernameSchema,
  UserIdSchema,
  RoomNameSchema,
  AnswerSchema,
  InviteCodeSchema,
  RoomSettingsSchema,
  DifficultySchema,
} from '../utils/validation';

const BaseMessageSchema = z.object({
  type: z.string(),
  data: z.record(z.unknown()),
  timestamp: z.number().optional(),
});

// Client-to-server message data schemas
export const CreateRoomDataSchema = z.object({
  username: UsernameSchema,
  //roomName: RoomNameSchema, // TODO: Might implement randomized room name in the future
  settings: RoomSettingsSchema.partial().optional(),
});

export const JoinRoomDataSchema = z.object({
  inviteCode: InviteCodeSchema,
  username: UsernameSchema,
});

export const SubmitAnswerDataSchema = z.object({
  answer: AnswerSchema,
  questionId: z.string().optional(),
});

export const UpdateSettingsDataSchema = z.object({
  settings: RoomSettingsSchema.partial(),
});

export const KickUserDataSchema = z.object({
  userId: UserIdSchema,
});

export const AuthDataSchema = z.object({
  token: z.string().min(1),
  adminToken: z.string().optional(),
});

export const UserSchema = z.object({
  id: UserIdSchema,
  socketId: z.string(),
  username: UsernameSchema,
  roomId: z.string(),
  created: z.string(),
  isAdmin: z.boolean(),
  score: z.number(),
  currentAnswer: z.string().optional(),
  answerTime: z.number().optional(),
  lastActiveTime: z.string(),
});

export const GameQuestionSchema = z.object({
  questionNumber: z.number(),
  country: z.object({
    name: z.string(),
    flag: z.string(),
    code: z.string(),
  }),
  options: z.array(z.object({
    name: z.string(),
    flag: z.string(),
    code: z.string(),
  })),
  correctAnswer: z.string(),
  startTime: z.number(),
  endTime: z.number(),
});

export const GameAnswerSchema = z.object({
  userId: UserIdSchema,
  username: UsernameSchema,
  answer: AnswerSchema,
  timeToAnswer: z.number(),
  isCorrect: z.boolean(),
  pointsAwarded: z.number(),
  timestamp: z.number(),
});

export const GameStateLeaderboardSchema = z.object({
  userId: UserIdSchema,
  username: UsernameSchema,
  score: z.number(),
  correctAnswers: z.number(),
  averageTime: z.number(),
});

export const GameStateSchema = z.object({
  isActive: z.boolean(),
  phase: z.enum(["waiting", "starting", "question", "results", "finished", "paused"]),
  currentQuestion: GameQuestionSchema.nullable(),
  answers: z.array(GameAnswerSchema),
  currentQuestionIndex: z.number(),
  totalQuestions: z.number(),
  difficulty: DifficultySchema,
  gameStartTime: z.number().nullable(),
  gameEndTime: z.number().nullable(),
  usedCountries: z.set(z.string()),
  questionTimer: z.any().nullable(), // Timer object
  resultTimer: z.any().nullable(), // Timer object
  leaderboard: z.array(GameStateLeaderboardSchema),
});

export const RoomSchema = z.object({
  id: z.string(),
  name: RoomNameSchema,
  host: UserIdSchema,
  inviteCode: InviteCodeSchema,
  gameState: GameStateSchema,
  members: z.array(UserSchema),
  created: z.string(),
  settings: RoomSettingsSchema,
});

export const AuthSuccessDataSchema = z.object({
  userId: UserIdSchema,
  isAdmin: z.boolean(),
  user: UserSchema,
  room: RoomSchema,
});

export const RoomSuccessDataSchema = z.object({
  room: RoomSchema,
  user: UserSchema,
});

export const UserJoinedDataSchema = z.object({
  user: UserSchema,
  room: RoomSchema,
});

export const UserLeftDataSchema = z.object({
  userId: UserIdSchema,
  room: RoomSchema.nullable(),
});

export const HostChangedDataSchema = z.object({
  newHost: UserSchema,
});

export const KickedDataSchema = z.object({
  reason: z.string(),
});

export const GameStartingDataSchema = z.object({
  countdown: z.number(),
});

export const NewQuestionDataSchema = z.object({
  question: GameQuestionSchema,
  totalQuestions: z.number(),
});

export const AnswerSubmittedDataSchema = z.object({
  userId: UserIdSchema,
  username: UsernameSchema,
  hasAnswered: z.boolean(),
  totalAnswers: z.number(),
  totalPlayers: z.number(),
});

export const QuestionResultsDataSchema = z.object({
  correctAnswer: z.string(),
  correctCountry: z.object({
    name: z.string(),
    flag: z.string(),
    code: z.string(),
  }),
  playerAnswers: z.array(z.object({
    userId: UserIdSchema,
    username: UsernameSchema,
    answer: AnswerSchema,
    isCorrect: z.boolean(),
    timeToAnswer: z.number(),
    pointsAwarded: z.number(),
  })),
  leaderboard: z.array(z.object({
    userId: UserIdSchema,
    username: UsernameSchema,
    score: z.number(),
  })),
});

export const GameEndedDataSchema = z.object({
  leaderboard: z.array(GameStateLeaderboardSchema),
  gameStats: z.object({
    totalQuestions: z.number(),
    totalAnswers: z.number(),
    correctAnswers: z.number(),
    accuracy: z.number(),
    averageTime: z.number(),
    difficulty: DifficultySchema,
    duration: z.number(),
  }),
});

export const GamePausedDataSchema = z.object({
  timestamp: z.number(),
});

export const GameResumedDataSchema = z.object({
  timestamp: z.number(),
});

export const GameStoppedDataSchema = z.object({
  timestamp: z.number(),
});



export const SettingsUpdatedDataSchema = z.object({
  settings: RoomSettingsSchema,
});



export const ErrorDataSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  details: z.any().optional(),
});

// WebSocket Message Schema with all possible types
export const WebSocketMessageSchema = z.discriminatedUnion('type', [
  // Client-to-server messages
  BaseMessageSchema.extend({
    type: z.literal('AUTH'),
    data: AuthDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('CREATE_ROOM'),
    data: CreateRoomDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('JOIN_ROOM'),
    data: JoinRoomDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('SUBMIT_ANSWER'),
    data: SubmitAnswerDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('UPDATE_SETTINGS'),
    data: UpdateSettingsDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('KICK_USER'),
    data: KickUserDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.enum([
      'LEAVE_ROOM',
      'START_GAME',
      'PAUSE_GAME',
      'RESUME_GAME',
      'STOP_GAME',
      'HEARTBEAT_RESPONSE'
    ]),
    data: z.record(z.unknown()).optional(),
  }),
  
  // Server-to-client messages
  BaseMessageSchema.extend({
    type: z.literal('AUTH_SUCCESS'),
    data: AuthSuccessDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('CREATE_ROOM_SUCCESS'),
    data: RoomSuccessDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('JOIN_ROOM_SUCCESS'),
    data: RoomSuccessDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('USER_JOINED'),
    data: UserJoinedDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('USER_LEFT'),
    data: UserLeftDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('HOST_CHANGED'),
    data: HostChangedDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('KICKED'),
    data: KickedDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('GAME_STARTING'),
    data: GameStartingDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('NEW_QUESTION'),
    data: NewQuestionDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('ANSWER_SUBMITTED'),
    data: AnswerSubmittedDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('QUESTION_RESULTS'),
    data: QuestionResultsDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('GAME_ENDED'),
    data: GameEndedDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('SETTINGS_UPDATED'),
    data: SettingsUpdatedDataSchema,
  }),

  BaseMessageSchema.extend({
    type: z.literal('ERROR'),
    data: ErrorDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('GAME_PAUSED'),
    data: GamePausedDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('GAME_RESUMED'),
    data: GameResumedDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('GAME_STOPPED'),
    data: GameStoppedDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('HEARTBEAT'),
    data: z.record(z.unknown()).optional(),
  }),
]);

export type CreateRoomData = z.infer<typeof CreateRoomDataSchema>;
export type JoinRoomData = z.infer<typeof JoinRoomDataSchema>;
export type SubmitAnswerData = z.infer<typeof SubmitAnswerDataSchema>;
export type UpdateSettingsData = z.infer<typeof UpdateSettingsDataSchema>;
export type KickUserData = z.infer<typeof KickUserDataSchema>;
export type AuthData = z.infer<typeof AuthDataSchema>;
export type User = z.infer<typeof UserSchema>;
export type GameQuestion = z.infer<typeof GameQuestionSchema>;
export type GameAnswer = z.infer<typeof GameAnswerSchema>;
export type GameStateLeaderboard = z.infer<typeof GameStateLeaderboardSchema>;
export type GameState = z.infer<typeof GameStateSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type AuthSuccessData = z.infer<typeof AuthSuccessDataSchema>;
export type RoomSuccessData = z.infer<typeof RoomSuccessDataSchema>;
export type UserJoinedData = z.infer<typeof UserJoinedDataSchema>;
export type UserLeftData = z.infer<typeof UserLeftDataSchema>;
export type HostChangedData = z.infer<typeof HostChangedDataSchema>;
export type KickedData = z.infer<typeof KickedDataSchema>;
export type GameStartingData = z.infer<typeof GameStartingDataSchema>;
export type NewQuestionData = z.infer<typeof NewQuestionDataSchema>;
export type AnswerSubmittedData = z.infer<typeof AnswerSubmittedDataSchema>;
export type QuestionResultsData = z.infer<typeof QuestionResultsDataSchema>;
export type GameEndedData = z.infer<typeof GameEndedDataSchema>;
export type SettingsUpdatedData = z.infer<typeof SettingsUpdatedDataSchema>;
export type GamePausedData = z.infer<typeof GamePausedDataSchema>;
export type GameResumedData = z.infer<typeof GameResumedDataSchema>;
export type GameStoppedData = z.infer<typeof GameStoppedDataSchema>;

export type ErrorData = z.infer<typeof ErrorDataSchema>;
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;
