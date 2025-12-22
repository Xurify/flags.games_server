import { ServerWebSocket } from "bun";
import { nanoid } from "nanoid";

import { WebSocketData, CustomWebSocket } from "../../types/entities";
import { WebSocketMessageSchema, type WebSocketMessage } from "../schemas";
import {
  type CreateRoomData,
  type JoinRoomData,
  type UpdateSettingsData,
  type KickUserData,
  Room,
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
  UserKickedData,
  HostChangedData,
  KickedData,
  SettingsUpdatedData,
  ErrorData,
  RoomTtlWarningData,
  RoomExpiredData,
} from "../schemas/websockets";
import { safeValidate } from "../utils/validation";
import { DEFAULT_DIFFICULTY } from "../constants/game-constants";
import { WS_MESSAGE_TYPES } from "../constants/ws-message-types";
import { WebSocketSecurity } from "../utils/security/websocket";
import { ErrorHandler, AppError, ErrorCode } from "../utils/error-handler";
import { logger } from "../utils/logger";
import { HeartbeatManager } from "./heartbeat-management";
import { roomsManager } from "./room-management";
import { usersManager } from "./user-management";
import { gameManager } from "./game-management";
import { env, isDevelopment } from "../utils/env";
import { getDifficultySettings } from "../game-logic/main";
import { rateLimiter } from "../utils/security/rate-limiter";

const MAX_WEBSOCKET_MESSAGE_BYTES = 128 * 1024; // 128KB
const MAX_BUFFERED_BYTES = 1 * 1024 * 1024; // 1MB backpressure threshold

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
  [WS_MESSAGE_TYPES.USER_KICKED]: UserKickedData;
  [WS_MESSAGE_TYPES.HOST_CHANGED]: HostChangedData;
  [WS_MESSAGE_TYPES.KICKED]: KickedData;
  [WS_MESSAGE_TYPES.SETTINGS_UPDATED]: SettingsUpdatedData;
  [WS_MESSAGE_TYPES.ERROR]: ErrorData;
  [WS_MESSAGE_TYPES.HEARTBEAT]: {};
  [WS_MESSAGE_TYPES.ROOM_TTL_WARNING]: RoomTtlWarningData;
  [WS_MESSAGE_TYPES.ROOM_EXPIRED]: RoomExpiredData;
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
        enableLogging: isDevelopment,
      },
      (userId: string): void => this.removeConnectionAndUser(userId),
      (userId: string): void => usersManager.updateLastActiveTime(userId)
    );
  }

  addConnection(userId: string, ws: CustomWebSocket): void {
    const existingConnection = this.connections.get(userId);
    if (existingConnection && existingConnection !== ws) {
      try {
        existingConnection.data = { ...(existingConnection.data || {}), closedByNewSession: true };
      } catch {}
      try { existingConnection.close(4000, "New session opened"); } catch {}
      this.heartbeatManager.stopHeartbeat(userId);
    }
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
      roomsManager.removeUserFromRoom(user.roomId, userId);
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
      this.safeSendToUser(member.id, ws, messageString);
    });
  }

  broadcastToUser(userId: string, message: WebSocketMessage): void {
    const ws = this.getConnection(userId);
    this.safeSendToUser(userId, ws, JSON.stringify({
      ...message,
      timestamp: Date.now()
    }));
  }

  broadcastToAll(message: WebSocketMessage): void {
    const messageString = JSON.stringify({
      ...message,
      timestamp: Date.now()
    });

    this.connections.forEach((ws, userId) => {
      this.safeSendToUser(userId, ws, messageString);
    });
  }

  private safeSendToUser(userId: string, ws: CustomWebSocket | undefined, messageString: string): void {
    if (!this.isConnectionValid(ws)) {
      this.handleUserDisconnect(userId);
      return;
    }

    const buffered = ws!.getBufferedAmount();
    if (buffered > MAX_BUFFERED_BYTES) {
      logger.warn(`Closing backpressured connection for user ${userId} (buffered=${buffered})`);
      try { ws!.close(1013, "Backpressure"); } catch { }
      this.handleUserDisconnect(userId);
      return;
    }

    try {
      ws!.send(messageString);
    } catch (error) {
      logger.error(`Error sending message to user ${userId}:`, error);
      this.handleUserDisconnect(userId);
    }
  }

  handleOpen(ws: ServerWebSocket<WebSocketData>): void {
    logger.info(`WebSocket connection opened - User: ${ws.data?.userId}`);

    ws.data = {
      userId: ws.data?.userId ?? null,
      roomId: ws.data?.roomId ?? null,
      isAdmin: ws.data?.isAdmin ?? false,
      authenticated: ws.data?.authenticated ?? true,
      ipAddress: ws.data?.ipAddress,
    };

    const userId = ws.data.userId;
    if (!userId) {
      try { ws.close(4001, "Unauthorized"); } catch {}
      return;
    }

    const existingUser = usersManager.getUser(userId);
    if (!existingUser) {
      usersManager.createUser({
        id: userId,
        username: "",
        roomId: "",
        socketId: nanoid(),
        isAdmin: false,
      });
    }

    this.addConnection(userId, ws);

    const user = usersManager.getUser(userId);

    let room: Room | null = null;
    if (user && user.roomId !== "") {
      room = roomsManager.getRoom(user.roomId) || null;
      ws.data.roomId = user.roomId;
    } else if (ws.data?.roomId) {
      room = roomsManager.getRoom(ws.data.roomId) || null;
    }

    if (!room) {
      const allRooms = Array.from(roomsManager.rooms.values());
      const userAsHost = allRooms.find(room => room.host === userId);
      if (userAsHost) {
        if (user && (!user.roomId || user.roomId === "")) {
          usersManager.updateUser(userId, { roomId: userAsHost.id });
          room = userAsHost;
          ws.data.roomId = userAsHost.id;
        }
        const userInMembers = userAsHost.members.find(member => member.id === userId);
        if (!userInMembers && user) {
          roomsManager.addUserToRoom(userAsHost.id, user);
          room = roomsManager.getRoom(userAsHost.id) || userAsHost;
        }
      }
    }

    ws.send(JSON.stringify({
      type: WS_MESSAGE_TYPES.AUTH_SUCCESS,
      data: { userId: userId, isAdmin: ws.data.isAdmin, user, room },
    }));
  }

  async handleMessage(ws: ServerWebSocket<WebSocketData>, message: string | Buffer): Promise<void> {
    try {
      const payloadBytes = typeof message === 'string'
        ? Buffer.byteLength(message)
        : (message as Buffer).length;

      if (payloadBytes > MAX_WEBSOCKET_MESSAGE_BYTES) {
        const error = new AppError({
          code: ErrorCode.WEBSOCKET_MESSAGE_ERROR,
          message: "Message too large",
          statusCode: 413,
          details: { size: payloadBytes, limit: MAX_WEBSOCKET_MESSAGE_BYTES }
        });
        ErrorHandler.handleWebSocketError(ws, error, "message_too_large");
        try { ws.close(1009, "Message too large"); } catch { }
        return;
      }

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
    if (!ws.data?.userId) return;
    if (ws.data.closedByNewSession) {
      const current = this.getConnection(ws.data.userId);
      if (current === ws) {
        this.removeConnection(ws.data.userId);
      }
      return;
    }
    this.handleUserDisconnect(ws.data.userId);
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
        {
          const result = rateLimiter.consume('SUBMIT_ANSWER', { userId });
          if (!result.allowed) {
            const error = ErrorHandler.createRateLimitError(result.retryAfter, {
              action: 'SUBMIT_ANSWER',
              remaining: result.remaining,
              resetTime: result.resetTime,
              ...(result.limit !== undefined ? { limit: result.limit } : {}),
              ...(result.windowMs !== undefined ? { windowMs: result.windowMs } : {}),
            });
            ErrorHandler.handleWebSocketError(ws, error, 'rate_limit_submit_answer');
            return;
          }
        }
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
        {
          const result = rateLimiter.consume('START_GAME', { userId });
          if (!result.allowed) {
            const error = ErrorHandler.createRateLimitError(result.retryAfter, {
              action: 'START_GAME',
              remaining: result.remaining,
              resetTime: result.resetTime,
              ...(result.limit !== undefined ? { limit: result.limit } : {}),
              ...(result.windowMs !== undefined ? { windowMs: result.windowMs } : {}),
            });
            ErrorHandler.handleWebSocketError(ws, error, 'rate_limit_start_game');
            return;
          }
        }
        const startResult = await gameManager.startGame(roomId, userId);
        if (!startResult.success) {
          const error = ErrorHandler.createPermissionError(startResult.error || "Cannot start game");
          ErrorHandler.handleWebSocketError(ws, error, "start_game");
        }
        break;
      case WS_MESSAGE_TYPES.STOP_GAME:
        if (!userId || !roomId) return;

        const stopRoom = roomsManager.getRoom(roomId);
        if (!stopRoom || stopRoom.host !== userId) return;

        gameManager.stopGame(roomId);
        break;
      case WS_MESSAGE_TYPES.RESTART_GAME:
        if (!userId || !roomId) return;

        const restartResult = await gameManager.restartGame(roomId, userId);
        if (!restartResult.success) {
          const error = ErrorHandler.createPermissionError(restartResult.error || "Cannot restart game");
          ErrorHandler.handleWebSocketError(ws, error, "restart_game");
        }
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

    {
      const result = rateLimiter.consume('JOIN_ROOM', { userId });
      if (!result.allowed) {
        const error = ErrorHandler.createRateLimitError(result.retryAfter, {
          action: 'JOIN_ROOM',
          remaining: result.remaining,
          resetTime: result.resetTime,
          ...(result.limit !== undefined ? { limit: result.limit } : {}),
          ...(result.windowMs !== undefined ? { windowMs: result.windowMs } : {}),
        });
        ErrorHandler.handleWebSocketError(ws, error, 'rate_limit_join_room');
        return;
      }
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

    if (room.kickedUsers.includes(userId)) {
      const error = ErrorHandler.createRoomError("You have been kicked from this room", ErrorCode.KICKED_FROM_ROOM);
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

    {
      const result = rateLimiter.consume('CREATE_ROOM', { userId });
      if (!result.allowed) {
        const error = ErrorHandler.createRateLimitError(result.retryAfter, {
          action: 'CREATE_ROOM',
          remaining: result.remaining,
          resetTime: result.resetTime,
          ...(result.limit !== undefined ? { limit: result.limit } : {}),
          ...(result.windowMs !== undefined ? { windowMs: result.windowMs } : {}),
        });
        ErrorHandler.handleWebSocketError(ws, error, 'rate_limit_create_room');
        return;
      }
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

    const difficulty = settings?.difficulty || DEFAULT_DIFFICULTY;

    const room = roomsManager.create(roomId, updatedUser, {
      difficulty: difficulty,
      maxRoomSize: settings.maxRoomSize,
      timePerQuestion: settings.timePerQuestion,
      questionCount: getDifficultySettings(difficulty).count,
      gameMode: settings?.gameMode || 'classic',
      // allowSpectators: settings?.allowSpectators ?? true,
    });

    ws.data.roomId = roomId;

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

    ws.data.roomId = null;
    ws.data.isAdmin = false;
    usersManager.updateUser(userId, { roomId: "", isAdmin: false });
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
      const updatedRoom = roomsManager.kickUserFromRoom(roomId, data.userId);

      if (updatedRoom) {
        const wasHost = room.host === data.userId;
        if (wasHost && updatedRoom.members.length > 0) {
          const newHost = updatedRoom.members[0];
          roomsManager.setNewHost(roomId, newHost.id);
          usersManager.updateUser(newHost.id, { isAdmin: true });
          this.broadcastToRoom(roomId, {
            type: WS_MESSAGE_TYPES.HOST_CHANGED,
            data: { newHost },
          });
        }

        this.broadcastToRoom(roomId, {
          type: WS_MESSAGE_TYPES.USER_KICKED,
          data: { userId: data.userId, room: updatedRoom },
        }, [data.userId]);
      }

      this.broadcastToUser(data.userId, {
        type: WS_MESSAGE_TYPES.KICKED,
        data: { reason: "Kicked by host" },
      });

      usersManager.updateUser(data.userId, { roomId: "", isAdmin: false });
      const targetWs = this.getConnection(data.userId);
      if (targetWs) {
        targetWs.data.roomId = null;
        targetWs.data.isAdmin = false;
      }
    }
  }
}

export const webSocketManager = new WebSocketManager();