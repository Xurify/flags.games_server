import { ServerWebSocket } from "bun";
import { Room } from "../lib/schemas/websockets";

export {
  Room,
  User,
  GameAnswer,
  GameState,
  GameQuestion,
  GameStateLeaderboard,
  WebSocketMessage as ServerToClientMessage,
  CreateRoomData,
  JoinRoomData,
  SubmitAnswerData,
  UpdateSettingsData,
  KickUserData,
  AuthSuccessData,
  RoomSuccessData,
  UserJoinedData,
  UserLeftData,
  HostChangedData,
  KickedData,
  GameStartingData,
  NewQuestionData,
  AnswerSubmittedData,
  QuestionResultsData,
  GameEndedData,
  SettingsUpdatedData,
  ErrorData,
} from "../lib/schemas/websockets";

export type RoomSettings = Room["settings"];

export type GameMode = "classic" | "speed" | "elimination";

export interface CustomWebSocket extends ServerWebSocket<WebSocketData> {}

export interface WebSocketData {
  userId: string | null;
  roomId: string | null;
  isAdmin: boolean;
  authenticated: boolean;
  ipAddress?: string;
  closedByNewSession?: boolean;
}

