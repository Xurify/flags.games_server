import { ServerWebSocket } from "bun";
import { Country } from "../lib/game-logic/data/countries";
import { Difficulty, WS_MESSAGE_TYPES } from "../lib/constants";
import { TimePerQuestion } from "../lib/utils/validation";

export interface User {
  id: string;
  socketId: string;
  username: string;
  roomId: string;
  created: string;
  isAdmin: boolean;
  lastActiveTime: string;
}

export interface RoomMember extends User {
  hasAnswered: boolean;
  score: number;
}

export interface GameQuestion {
  questionNumber: number;
  country: Country;
  options: Country[];
  correctAnswer: string;
  startTime: number;
  endTime: number;
}

export interface GameAnswer {
  userId: string;
  username: string;
  answer: string;
  timeToAnswer: number;
  isCorrect: boolean;
  pointsAwarded: number;
  timestamp: number;
}

export interface GameStateLeaderboard {
  userId: string;
  username: string;
  score: number;
  correctAnswers: number;
  averageTime: number;
}

export interface GameState {
  isActive: boolean;
  phase: "waiting" | "starting" | "question" | "results" | "finished";
  currentQuestion: GameQuestion | null;
  answers: GameAnswer[];
  answerHistory: GameAnswer[];
  currentQuestionIndex: number;
  totalQuestions: number;
  difficulty: Difficulty;
  gameStartTime: number | null;
  gameEndTime: number | null;
  usedCountries: Set<string>;
  questionTimer: Timer | null;
  resultTimer: Timer | null;
  leaderboard: GameStateLeaderboard[];
}

export interface RoomSettings {
  maxRoomSize: number;
  difficulty: Difficulty;
  timePerQuestion: TimePerQuestion;
  //allowSpectators: boolean;
  showLeaderboard?: boolean;
  gameMode?: GameMode;
};

export type GameMode = "classic" | "speed" | "elimination";

export interface Room {
  id: string;
  name: string;
  host: string;
  inviteCode: string;
  gameState: GameState;
  members: RoomMember[];
  created: string;
  settings: RoomSettings;
}

export interface WebSocketMessage<T = any> {
  type: string;
  data: T;
  timestamp?: number;
}

export interface CustomWebSocket extends ServerWebSocket<WebSocketData> {}

export interface WebSocketData {
  userId: string | null;
  roomId: string | null;
  isAdmin: boolean;
  authenticated: boolean;
  ipAddress?: string;
}

export interface CreateRoomData {
  username: string;
  userId: string;
  roomName: string;
  settings?: Partial<RoomSettings>;
}

export interface JoinRoomData {
  inviteCode: string;
  username: string;
  userId: string;
}

export interface SubmitAnswerData {
  answer: string;
  questionId?: string;
}

export interface UpdateSettingsData {
  settings: Partial<RoomSettings>;
}

export interface KickUserData {
  userId: string;
}

// Server-to-client message data types
export interface AuthSuccessData {
  userId: string;
  isAdmin: boolean;
  user: User;
  room: Room;
}

export interface RoomSuccessData {
  room: Room;
  user: User;
}

export interface UserJoinedData {
  user: User;
  room: Room;
}

export interface UserLeftData {
  userId: string;
  room: Room | null;
}

export interface HostChangedData {
  newHost: User;
}

export interface KickedData {
  reason: string;
}

export interface GameStartingData {
  countdown: number;
}

export interface NewQuestionData {
  question: GameQuestion;
  totalQuestions: number;
}

export interface AnswerSubmittedData {
  userId: string;
  username: string;
  hasAnswered: boolean;
  totalAnswers: number;
  totalPlayers: number;
  pointsAwarded: number;
  score: number;
}

export interface QuestionResultsData {
  playerAnswers: GameAnswer[];
  leaderboard: GameStateLeaderboard[];
}

export interface GameEndedData {
  leaderboard: GameStateLeaderboard[];
}

export interface SettingsUpdatedData {
  settings: RoomSettings;
}



export interface ErrorData {
  message: string;
  code?: string;
  details?: any;
}

export type ServerToClientMessage =
  | { type: typeof WS_MESSAGE_TYPES.AUTH_SUCCESS; data: AuthSuccessData }
  | { type: typeof WS_MESSAGE_TYPES.CREATE_ROOM_SUCCESS; data: RoomSuccessData }
  | { type: typeof WS_MESSAGE_TYPES.JOIN_ROOM_SUCCESS; data: RoomSuccessData }
  | { type: typeof WS_MESSAGE_TYPES.USER_JOINED; data: UserJoinedData }
  | { type: typeof WS_MESSAGE_TYPES.USER_LEFT; data: UserLeftData }
  | { type: typeof WS_MESSAGE_TYPES.HOST_CHANGED; data: HostChangedData }
  | { type: typeof WS_MESSAGE_TYPES.KICKED; data: KickedData }
  | { type: typeof WS_MESSAGE_TYPES.GAME_STARTING; data: GameStartingData }
  | { type: typeof WS_MESSAGE_TYPES.NEW_QUESTION; data: NewQuestionData }
  | { type: typeof WS_MESSAGE_TYPES.ANSWER_SUBMITTED; data: AnswerSubmittedData }
  | { type: typeof WS_MESSAGE_TYPES.QUESTION_RESULTS; data: QuestionResultsData }
  | { type: typeof WS_MESSAGE_TYPES.GAME_ENDED; data: GameEndedData }
  | { type: typeof WS_MESSAGE_TYPES.GAME_STOPPED; data: {} }
  | { type: typeof WS_MESSAGE_TYPES.SETTINGS_UPDATED; data: SettingsUpdatedData }

  | { type: typeof WS_MESSAGE_TYPES.ERROR; data: ErrorData }
  | { type: typeof WS_MESSAGE_TYPES.HEARTBEAT; data: {} };
