import { ServerWebSocket } from "bun";
import { nanoid } from "nanoid";

import { WebSocketData, CustomWebSocket } from "../../types/entities";
import { WebSocketMessageSchema, type WebSocketMessage } from "../schemas";
import { 
  AuthDataSchema,
  type CreateRoomData,
  type JoinRoomData,
  type UpdateSettingsData,
  type KickUserData,
} from "../schemas/websockets";
import { 
  GameStartingData,
  NewQuestionData,
  AnswerSubmittedData,
  QuestionResultsData,
  GameEndedData,
  GameStoppedData,
  AuthSuccessData,
  RoomSuccessData,
  UserJoinedData,
  UserLeftData,
  HostChangedData,
  KickedData,
  SettingsUpdatedData,
  ErrorData,
} from "../schemas/websockets";
import { safeValidate } from "../utils/validation";
import { DEFAULT_DIFFICULTY } from "../constants/game-constants";
import { WS_MESSAGE_TYPES } from "../constants/ws-message-types";
import { WebSocketSecurity } from "../utils/security/network";
import { ErrorHandler, AppError, ErrorCode } from "../utils/error-handler";
import { logger } from "../utils/logger";
import { HeartbeatManager } from "./heartbeat-management";
import { roomsManager } from "./room-management";
import { usersManager } from "./user-management";
import { gameManager } from "./game-management";

export interface MessageDataTypes {
  [WS_MESSAGE_TYPES.GAME_STARTING]: GameStartingData;
  [WS_MESSAGE_TYPES.NEW_QUESTION]: NewQuestionData;
  [WS_MESSAGE_TYPES.ANSWER_SUBMITTED]: AnswerSubmittedData;
  [WS_MESSAGE_TYPES.QUESTION_RESULTS]: QuestionResultsData;
  [WS_MESSAGE_TYPES.GAME_ENDED]: GameEndedData;
  [WS_MESSAGE_TYPES.GAME_STOPPED]: GameStoppedData;
  [WS_MESSAGE_TYPES.AUTH_SUCCESS]: AuthSuccessData;
  [WS_MESSAGE_TYPES.CREATE_ROOM_SUCCESS]: RoomSuccessData;
  [WS_MESSAGE_TYPES.JOIN_ROOM_SUCCESS]: RoomSuccessData;
  [WS_MESSAGE_TYPES.USER_JOINED]: UserJoinedData;
  [WS_MESSAGE_TYPES.USER_LEFT]: UserLeftData;
  [WS_MESSAGE_TYPES.HOST_CHANGED]: HostChangedData;
  [WS_MESSAGE_TYPES.KICKED]: KickedData;
  [WS_MESSAGE_TYPES.SETTINGS_UPDATED]: SettingsUpdatedData;
  [WS_MESSAGE_TYPES.ERROR]: ErrorData;
  [WS_MESSAGE_TYPES.HEARTBEAT]: {};
}

interface WebSocketConfig {
  heartbeat?: {
    interval?: number;
    timeout?: number;
    maxMissed?: number;
    enableLogging?: boolean;
  };
}

class WebSocketManager {
  public connections = new Map<string, CustomWebSocket>();
  private heartbeatManager: HeartbeatManager;

  constructor(config: WebSocketConfig = {}) {
    this.heartbeatManager = new HeartbeatManager(
      config.heartbeat || {
        interval: 30000,
        timeout: 10000,
        maxMissed: 3,
        enableLogging: process.env.NODE_ENV === 'development'
      },
      (userId: string): void => this.removeConnectionAndUser(userId),
      (userId: string): void => usersManager.updateLastActiveTime(userId)
    );
  }

  addConnection(userId: string, ws: CustomWebSocket): void {
    this.connections.set(userId, ws);
    usersManager.setUserConnection(userId, ws);
    this.heartbeatManager.startHeartbeat(userId, ws);
  }

  removeConnection(userId: string): void {
    if (!this.connections.has(userId)) return;

    this.connections.delete(userId);
    usersManager.removeUserConnection(userId);
    this.heartbeatManager.stopHeartbeat(userId);
  }

  getConnection(userId: string): CustomWebSocket | undefined {
    return this.connections.get(userId);
  }

  hasConnection(userId: string): boolean {
    return this.connections.has(userId);
  }

  private removeConnectionAndUser(userId: string): void {
    if (!this.connections.has(userId)) return;

    this.removeConnection(userId);

    const user = usersManager.getUser(userId);
    if (user && user.roomId) {
      usersManager.removeUserFromRoom(userId);
    }
    usersManager.deleteUser(userId);
  }

  private isConnectionValid(ws: CustomWebSocket | undefined): boolean {
    return !!ws && (ws.readyState === WebSocket.OPEN);
  }

  broadcastToRoom<T extends keyof MessageDataTypes>(
    roomId: string,
    message: { type: T; data: MessageDataTypes[T] },
    exclude: string[] = []
  ): void {
    const room = roomsManager.getRoom(roomId);
    if (!room) return;

    const messageString = JSON.stringify({
      ...message,
      timestamp: Date.now()
    });

    const excludeSet = new Set(exclude);

    room.members.forEach(member => {
      if (excludeSet.has(member.id)) return;

      const ws = this.getConnection(member.id);
      if (this.isConnectionValid(ws)) {
        try {
          ws!.send(messageString);
        } catch (error) {
          logger.error(`Error sending message to user ${member.id}:`, error);
          this.removeConnection(member.id);
        }
      }
    });
  }

  broadcastToUser(userId: string, message: WebSocketMessage): void {
    const ws = this.getConnection(userId);
    if (!this.isConnectionValid(ws)) {
      this.removeConnection(userId);
      return;
    }

    try {
      ws!.send(JSON.stringify({
        ...message,
        timestamp: Date.now()
      }));
    } catch (error) {
      logger.error(`Error sending message to user ${userId}:`, error);
      this.removeConnection(userId);
    }
  }

  broadcastToAll(message: WebSocketMessage): void {
    const messageString = JSON.stringify({
      ...message,
      timestamp: Date.now()
    });

    this.connections.forEach((ws, userId) => {
      if (this.isConnectionValid(ws)) {
        try {
          ws.send(messageString);
        } catch (error) {
          logger.error(`Error broadcasting to user ${userId}:`, error);
          this.removeConnection(userId);
        }
      }
    });
  }

  handleOpen(ws: ServerWebSocket<WebSocketData>): void {
    logger.info("WebSocket connection opened");

    ws.data = {
      userId: null,
      roomId: null,
      isAdmin: false,
      authenticated: false,
    };
  }

  async handleMessage(ws: ServerWebSocket<WebSocketData>, message: string | Buffer): Promise<void> {
    try {
      const messageString = message.toString();

      if (messageString.trim().length === 0) {
        const error = new AppError({
          code: ErrorCode.WEBSOCKET_MESSAGE_ERROR,
          message: "Empty message",
          statusCode: 400
        });
        ErrorHandler.handleWebSocketError(ws, error, "empty_message");
        return;
      }

      let parsedMessage: unknown;
      try {
        parsedMessage = JSON.parse(messageString);
      } catch (jsonError) {
        const error = new AppError({
          code: ErrorCode.WEBSOCKET_MESSAGE_ERROR,
          message: "Invalid JSON format in message",
          statusCode: 400,
          details: { reason: (jsonError instanceof Error ? jsonError.message : String(jsonError)) }
        });
        ErrorHandler.handleWebSocketError(ws, error, "json_parse_error");
        return;
      }

      if (!ws.data.authenticated) {
        await this.handleAuthentication(ws, parsedMessage);
        return;
      }

      const securityCheck = WebSocketSecurity.validateMessage(parsedMessage);
      if (!securityCheck.valid) {
        const error = new AppError({
          code: ErrorCode.WEBSOCKET_MESSAGE_ERROR,
          message: securityCheck.reason || "Message validation failed",
          statusCode: 400,
        });
        ErrorHandler.handleWebSocketError(ws, error, "security_validation");
        return;
      }

      const validation = safeValidate(WebSocketMessageSchema, parsedMessage);

      if (!validation.success) {
        const error = new AppError({
          code: ErrorCode.VALIDATION_ERROR,
          message: validation.error || "Invalid message format",
          statusCode: 400,
        });
        ErrorHandler.handleWebSocketError(ws, error, "schema_validation");
        return;
      }

      await this.routeMessage(ws, validation.data);
    } catch (error) {
      const appError = new AppError({
        code: ErrorCode.WEBSOCKET_MESSAGE_ERROR,
        message: "Error processing WebSocket message",
        statusCode: 500,
        cause: error instanceof Error ? error : new Error(String(error))
      });
      ErrorHandler.handleWebSocketError(ws, appError, "message_processing");
    }
  }

  handleClose(ws: ServerWebSocket<WebSocketData>): void {
    if (ws.data?.userId) {
      this.handleUserDisconnect(ws.data.userId);
      this.removeConnection(ws.data.userId);
    }
  }

  private async handleAuthentication(ws: ServerWebSocket<WebSocketData>, parsedMessage: unknown): Promise<void> {
    if (!parsedMessage || typeof parsedMessage !== 'object' || (parsedMessage as any).type !== WS_MESSAGE_TYPES.AUTH) {
      const error = new AppError({
        code: ErrorCode.WEBSOCKET_MESSAGE_ERROR,
        message: "Authentication required before any other action.",
        statusCode: 401,
      });
      ErrorHandler.handleWebSocketError(ws, error, "auth_required");
      ws.close(4001, "Authentication required");
      return;
    }

    const validation = safeValidate(AuthDataSchema, (parsedMessage as any).data);
    if (!validation.success) {
      const error = new AppError({
        code: ErrorCode.VALIDATION_ERROR,
        message: validation.error || "Invalid auth message format",
        statusCode: 400,
      });
      ErrorHandler.handleWebSocketError(ws, error, "auth_schema_validation");
      ws.close(4002, "Invalid auth message");
      return;
    }

    const { token } = validation.data as { token: string; adminToken?: string };
    if (!token || typeof token !== 'string') {
      const error = new AppError({
        code: ErrorCode.WEBSOCKET_MESSAGE_ERROR,
        message: "Invalid or missing token.",
        statusCode: 401,
      });
      ErrorHandler.handleWebSocketError(ws, error, "auth_token_invalid");
      ws.close(4003, "Invalid token");
      return;
    }

    ws.data.userId = token;
    ws.data.authenticated = true;

    if (usersManager.getUser(ws.data.userId)) {
      usersManager.deleteUser(ws.data.userId);
    }

    usersManager.createUser({
      id: ws.data.userId,
      username: "",
      roomId: "",
      socketId: nanoid(),
      isAdmin: ws.data.isAdmin,
    });

    this.addConnection(ws.data.userId, ws);

    const user = usersManager.getUser(ws.data.userId);

    let room = null;
    if (user && user.roomId && user.roomId !== "") {
      room = roomsManager.getRoom(user.roomId);
      ws.data.roomId = user.roomId;
    } else {
      room = ws.data?.roomId ? roomsManager.getRoom(ws.data.roomId) : null;
    }

    const allRooms = Array.from(roomsManager.rooms.values());
    const userAsHost = allRooms.find(room => room.host === ws.data.userId);
    if (userAsHost) {
      if (user && (!user.roomId || user.roomId === "")) {
        usersManager.updateUser(ws.data.userId, { roomId: userAsHost.id });
        room = userAsHost;
        ws.data.roomId = userAsHost.id;
      }

      const userInMembers = userAsHost.members.find(member => member.id === ws.data.userId);
      if (!userInMembers && user) {
        roomsManager.addUserToRoom(userAsHost.id, user);
        room = roomsManager.getRoom(userAsHost.id);
      }
    }

    ws.send(JSON.stringify({
      type: WS_MESSAGE_TYPES.AUTH_SUCCESS,
      data: { userId: ws.data.userId, isAdmin: ws.data.isAdmin, user, room },
    }));
  }

  private async routeMessage(ws: ServerWebSocket<WebSocketData>, message: WebSocketMessage): Promise<void> {
    const { userId, roomId } = ws.data;

    switch (message.type) {
      case WS_MESSAGE_TYPES.JOIN_ROOM:
        this.handleJoinRoom(ws, message.data);
        break;
      case WS_MESSAGE_TYPES.CREATE_ROOM:
        this.handleCreateRoom(ws, message.data);
        break;
      case WS_MESSAGE_TYPES.SUBMIT_ANSWER:
        if (!userId || !roomId) return;
        gameManager.submitAnswer(roomId, userId, message.data.answer);
        break;
      case WS_MESSAGE_TYPES.UPDATE_ROOM_SETTINGS:
        this.handleUpdateRoomSettings(ws, message.data);
        break;
      case WS_MESSAGE_TYPES.KICK_USER:
            this.handleKickUser(ws, message.data);
        break;
      case WS_MESSAGE_TYPES.LEAVE_ROOM:
        this.handleLeaveRoom(ws);
        break;
      case WS_MESSAGE_TYPES.START_GAME:
        if (!userId || !roomId) return;

        const success = await gameManager.startGame(roomId, userId);
        if (!success) {
          const error = ErrorHandler.createPermissionError("Cannot start game - check permissions and player count");
          ErrorHandler.handleWebSocketError(ws, error, "start_game");
        }
        break;
      case WS_MESSAGE_TYPES.STOP_GAME:
        if (!userId || !roomId) return;

        const stopRoom = roomsManager.getRoom(roomId);
        if (!stopRoom || stopRoom.host !== userId) return;

        gameManager.stopGame(roomId);
        break;
      case WS_MESSAGE_TYPES.HEARTBEAT_RESPONSE:
        if (userId) {
          this.heartbeatManager.handleHeartbeatResponse(userId);
        }
        break;
    }
  }

  private handleUserDisconnect(userId: string): void {
    const user = usersManager.getUser(userId);

    if (user && user.roomId && user.roomId !== "") {
      logger.info("User leaving room on disconnect", { userId, roomId: user.roomId });

      const updatedRoom = roomsManager.removeUserFromRoom(user.roomId, userId);

      if (user.roomId && updatedRoom) {
        const room = roomsManager.getRoom(user.roomId);
        if (room && room.host === userId && updatedRoom.members.length > 0) {
          const newHost = updatedRoom.members[0];
          roomsManager.setNewHost(user.roomId, newHost.id);
          usersManager.updateUser(newHost.id, { isAdmin: true });

          this.broadcastToRoom(user.roomId, {
            type: WS_MESSAGE_TYPES.HOST_CHANGED,
            data: { newHost: newHost },
          });
        }

        this.broadcastToRoom(user.roomId, {
          type: WS_MESSAGE_TYPES.USER_LEFT,
          data: {
            userId: userId,
            room: updatedRoom,
          },
        });

        if (updatedRoom.members.length === 0) {
          gameManager.stopGame(user.roomId);
          roomsManager.delete(user.roomId);
        }
      }
    }

    this.removeConnectionAndUser(userId);
  }

  getConnectionStats(): {
    totalConnections: number;
    activeConnections: number;
    deadConnections: number;
    heartbeatStats: any;
  } {
    const totalConnections = this.connections.size;
    let activeConnections = 0;
    let deadConnections = 0;

    this.connections.forEach((ws) => {
      if (this.isConnectionValid(ws)) {
        activeConnections++;
      } else {
        deadConnections++;
      }
    });

    return {
      totalConnections,
      activeConnections,
      deadConnections,
      heartbeatStats: this.heartbeatManager.getStats(),
    };
  }

  cleanupDeadConnections(): void {
    const deadConnections: string[] = [];

    this.connections.forEach((ws, userId) => {
      if (!this.isConnectionValid(ws)) {
        deadConnections.push(userId);
      }
    });

    deadConnections.forEach(userId => {
      this.removeConnectionAndUser(userId);
    });

    if (deadConnections.length > 0) {
      logger.info(`Cleaned up ${deadConnections.length} dead connections`);
    }
  }

  getLength(): number {
    return this.connections.size;
  }

  getAllConnections(): Map<string, CustomWebSocket> {
    return this.connections;
  }

  private handleJoinRoom(ws: ServerWebSocket<WebSocketData>, data: JoinRoomData): void {
    const { inviteCode, username } = data;
    const userId = ws.data.userId;

    if (!userId) {
      const error = ErrorHandler.createRoomError("User not authenticated", ErrorCode.AUTHENTICATION_ERROR);
      ErrorHandler.handleWebSocketError(ws, error, "join_room");
      return;
    }

    if (ws.data.roomId) {
      const error = ErrorHandler.createRoomError("User already in a room", ErrorCode.USER_ALREADY_IN_ROOM);
      ErrorHandler.handleWebSocketError(ws, error, "join_room");
      return;
    }

    const room = roomsManager.getRoomByInviteCode(inviteCode);

    if (!room) {
      const error = ErrorHandler.createRoomError("Invalid invite code", ErrorCode.ROOM_NOT_FOUND);
      ErrorHandler.handleWebSocketError(ws, error, "join_room");
      return;
    }

    if (room.members.some(member => member.username === username)) {
      const error = ErrorHandler.createRoomError("Username already taken", ErrorCode.USERNAME_TAKEN);
      ErrorHandler.handleWebSocketError(ws, error, "join_room");
      return;
    }

    if (room.members.length >= room.settings.maxRoomSize) {
      const error = ErrorHandler.createRoomError("Room is full", ErrorCode.ROOM_FULL);
      ErrorHandler.handleWebSocketError(ws, error, "join_room");
      return;
    }

    const updatedUser = usersManager.updateUser(userId, {
      username,
      roomId: room.id,
    });

    if (!updatedUser) {
      const error = ErrorHandler.createRoomError("User not found", ErrorCode.USER_NOT_FOUND);
      ErrorHandler.handleWebSocketError(ws, error, "join_room");
      return;
    }

    ws.data.roomId = room.id;

    if (roomsManager.isScheduledForDeletion(room.id)) {
      roomsManager.cancelScheduledDeletion(room.id);
    }

    const updatedRoom = roomsManager.addUserToRoom(room.id, updatedUser);

    if (!updatedRoom) {
      const error = ErrorHandler.createRoomError("Failed to join room", ErrorCode.INTERNAL_ERROR);
      ErrorHandler.handleWebSocketError(ws, error, "join_room");
      return;
    }

    ws.send(JSON.stringify({
      type: WS_MESSAGE_TYPES.JOIN_ROOM_SUCCESS,
      data: { room: updatedRoom, user: updatedUser },
    }));

    this.broadcastToRoom(room.id, {
      type: WS_MESSAGE_TYPES.USER_JOINED,
      data: { user: updatedUser, room: updatedRoom },
    }, [userId]);
  }

  private handleCreateRoom(ws: ServerWebSocket<WebSocketData>, data: CreateRoomData): void {
    const { username, settings } = data;
    const userId = ws.data.userId;

    if (!userId) {
      const error = ErrorHandler.createRoomError("User not authenticated", ErrorCode.AUTHENTICATION_ERROR);
      ErrorHandler.handleWebSocketError(ws, error, "create_room");
      return;
    }

    if (ws.data.roomId) {
      const error = ErrorHandler.createRoomError("User already in a room", ErrorCode.USER_ALREADY_IN_ROOM);
      ErrorHandler.handleWebSocketError(ws, error, "create_room");
      return;
    }

    const roomId = nanoid();

    const updatedUser = usersManager.updateUser(userId, {
      username,
      roomId,
      isAdmin: true,
    });

    if (!updatedUser) {
      const error = ErrorHandler.createRoomError("User not found", ErrorCode.USER_NOT_FOUND);
      ErrorHandler.handleWebSocketError(ws, error, "create_room");
      return;
    }

    const room = roomsManager.create(roomId, updatedUser, {
      difficulty: settings?.difficulty || DEFAULT_DIFFICULTY,
      maxRoomSize: settings?.maxRoomSize || 5,
      timePerQuestion: settings?.timePerQuestion || 30,
    });

    ws.data.roomId = roomId;
    ws.data.isAdmin = true;

    ws.send(JSON.stringify({
      type: WS_MESSAGE_TYPES.CREATE_ROOM_SUCCESS,
      data: { room, user: updatedUser },
    }));
  }

  private handleLeaveRoom(ws: ServerWebSocket<WebSocketData>): void {
    const { userId, roomId } = ws.data;

    if (!userId || !roomId) return;

    const room = roomsManager.getRoom(roomId);
    if (!room) return;

    const updatedRoom = roomsManager.removeUserFromRoom(roomId, userId);

    if (room.host === userId && updatedRoom && updatedRoom.members.length > 0) {
      const newHost = updatedRoom.members[0];
      roomsManager.setNewHost(roomId, newHost.id);
      usersManager.updateUser(newHost.id, { isAdmin: true });

      this.broadcastToRoom(roomId, {
        type: WS_MESSAGE_TYPES.HOST_CHANGED,
        data: { newHost: newHost },
      });
    }

    this.broadcastToRoom(roomId, {
      type: WS_MESSAGE_TYPES.USER_LEFT,
      data: {
        userId: userId,
        room: updatedRoom ? updatedRoom : null,
      },
    });

    if (updatedRoom && updatedRoom.members.length === 0) {
      gameManager.stopGame(roomId);
      roomsManager.delete(roomId);
    }

    ws.data.userId = null;
    ws.data.roomId = null;
    ws.data.isAdmin = false;

    this.removeConnection(userId);
    usersManager.deleteUser(userId);
  }

  private handleUpdateRoomSettings(ws: ServerWebSocket<WebSocketData>, data: UpdateSettingsData): void {
    const { userId, roomId } = ws.data;
    if (!userId || !roomId) return;

    const room = roomsManager.getRoom(roomId);
    if (!room || room.host !== userId) return;

    const updatedRoom = roomsManager.update(roomId, {
      settings: { ...room.settings, ...data.settings } as any,
    });

    this.broadcastToRoom(roomId, {
      type: WS_MESSAGE_TYPES.SETTINGS_UPDATED,
      data: { settings: updatedRoom?.settings || room.settings },
    });
  }

  private handleKickUser(ws: ServerWebSocket<WebSocketData>, data: KickUserData): void {
    const { userId, roomId } = ws.data;
    if (!userId || !roomId) return;

    const room = roomsManager.getRoom(roomId);
    if (!room || room.host !== userId) return;

    const targetUser = usersManager.getUser(data.userId);
    if (targetUser) {
      this.broadcastToUser(data.userId, {
        type: WS_MESSAGE_TYPES.KICKED,
        data: { reason: "Kicked by host" },
      });

      this.removeConnection(data.userId);
      usersManager.deleteUser(data.userId);
    }
  }
}

export const webSocketManager = new WebSocketManager();