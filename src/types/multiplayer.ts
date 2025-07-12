import { ServerWebSocket } from "bun";
import { Country } from "../lib/game-logic/data/countries";
import { Difficulty } from "../lib/constants";
import { WS_MESSAGE_TYPES } from "../lib/constants/ws-message-types";

export interface User {
  id: string;
  socketId: string;
  username: string;
  roomId: string;
  created: string;
  isAdmin: boolean;
  score: number;
  currentAnswer?: string;
  answerTime?: number;
  lastActiveTime: string;
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

export interface GameState {
  isActive: boolean;
  isPaused: boolean;
  phase: 'waiting' | 'starting' | 'question' | 'results' | 'finished';
  currentQuestion: GameQuestion | null;
  answers: GameAnswer[];
  currentQuestionIndex: number;
  totalQuestions: number;
  difficulty: Difficulty;
  gameStartTime: number | null;
  gameEndTime: number | null;
  usedCountries: Set<string>;
  questionTimer: Timer | null;
  resultTimer: Timer | null;
  leaderboard: Array<{
    userId: string;
    username: string;
    score: number;
    correctAnswers: number;
    averageTime: number;
  }>;
}

export interface Room {
  id: string;
  name: string;
  host: string;
  inviteCode: string;
  passcode: string | null;
  gameState: GameState;
  members: User[];
  created: string;
  settings: RoomSettings;
}

export interface RoomSettings {
  private?: boolean;
  maxRoomSize: number;
  difficulty: Difficulty;
  //questionCount: number;
  timePerQuestion: number;
  //allowSpectators: boolean;
  showLeaderboard?: boolean;
  gameMode?: GameMode;
};

export type GameMode = "classic" | "speed" | "elimination";

interface WebSocketMessageData {
  [key: string]: unknown;
}

export interface WebSocketMessage<T = WebSocketMessageData> {
  type: string;
  data: T;
  timestamp?: number;
}

export interface CustomWebSocket extends ServerWebSocket<WebSocketData> { }

export interface WebSocketData {
  userId: string | null;
  roomId: string | null;
  isAdmin: boolean;
  authenticated: boolean;
  ipAddress?: string;
}

type GameMessageType =
  | { type: typeof WS_MESSAGE_TYPES.SUBMIT_ANSWER; data: { answer: string; questionId: string } }
  | { type: typeof WS_MESSAGE_TYPES.START_GAME; data: {} }
  | { type: typeof WS_MESSAGE_TYPES.JOIN_ROOM; data: { roomId: string; username: string } };