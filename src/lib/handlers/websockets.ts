import { ServerWebSocket } from "bun";
import { roomsManager } from "../utils/room-management";
import { usersManager } from "../utils/user-management";
import { gameManager } from "../utils/game-management";
import {
  broadcastToRoom,
  broadcastToUser,
  addConnection,
  removeConnection,
  handleHeartbeatResponse,
} from "../utils/websockets";
import { WebSocketData, Room } from "../../types/multiplayer";
import {
  safeValidate,
  WebSocketMessageSchema,
  type CreateRoomData,
  type JoinRoomData,
  type SubmitAnswerData,
  type UpdateSettingsData,
  type KickUserData,
} from "../schemas";
import { nanoid } from "nanoid";
import { DEFAULT_DIFFICULTY } from "../constants";
import { WebSocketSecurity } from "../utils/security/network";
import { ErrorHandler, AppError, ErrorCode } from "../utils/error-handler";
import { logger } from "../utils/logger";

export function handleWebSocketOpen(ws: ServerWebSocket<WebSocketData>) {
  logger.info("WebSocket connection opened");

  if (!ws.data) {
    ws.data = {
      userId: null,
      roomId: null,
      isAdmin: false,
    };
  }

  ws.send(
    JSON.stringify({
      type: "CONNECTION_ESTABLISHED",
      data: {
        timestamp: Date.now(),
      },
    })
  );
}

export function handleWebSocketMessage(
  ws: ServerWebSocket<WebSocketData>,
  message: string | Buffer
) {
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

    const securityCheck = WebSocketSecurity.validateMessage(message);
    if (!securityCheck.valid) {
      const error = new AppError({
        code: ErrorCode.WEBSOCKET_MESSAGE_ERROR,
        message: "Message validation failed",
        statusCode: 400,
        details: { reason: securityCheck.reason }
      });
      ErrorHandler.handleWebSocketError(ws, error, "security_validation");
      return;
    }

    const validation = safeValidate(WebSocketMessageSchema, message);

    if (!validation.success) {
      const error = new AppError({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid message format",
        statusCode: 400,
        details: { validationError: validation.error }
      });
      ErrorHandler.handleWebSocketError(ws, error, "schema_validation");
      return;
    }

    const data = validation.data;

    switch (data.type) {
      case "JOIN_ROOM":
        handleJoinRoom(ws, data.data);
        break;
      case "CREATE_ROOM":
        handleCreateRoom(ws, data.data);
        break;
      case "SUBMIT_ANSWER":
        handleSubmitAnswer(ws, data.data);
        break;
      case "UPDATE_SETTINGS":
        handleUpdateSettings(ws, data.data);
        break;
      case "KICK_USER":
        handleKickUser(ws, data.data);
        break;
      case "LEAVE_ROOM":
        handleLeaveRoom(ws);
        break;
      case "START_GAME":
        handleStartGame(ws);
        break;
      case "TOGGLE_READY":
        handleToggleReady(ws);
        break;
      case "PAUSE_GAME":
        handlePauseGame(ws);
        break;
      case "RESUME_GAME":
        handleResumeGame(ws);
        break;
      case "STOP_GAME":
        handleStopGame(ws);
        break;
      case "HEARTBEAT_RESPONSE":
        handleHeartbeatResponseMessage(ws);
        break;
    }
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

export function handleWebSocketClose(ws: ServerWebSocket<WebSocketData>) {
  logger.info("WebSocket connection closed");

  if (ws.data?.userId && ws.data?.roomId) {
    handleLeaveRoom(ws);
  } else if (ws.data?.userId) {
    removeConnection(ws.data.userId);
  }
}

function handleJoinRoom(ws: ServerWebSocket<WebSocketData>, data: JoinRoomData) {
  const { inviteCode, username, userId } = data;

  if (ws.data.userId && ws.data.roomId) {
    const error = ErrorHandler.createRoomError("User already in a room", ErrorCode.USER_ALREADY_IN_ROOM);
    ErrorHandler.handleWebSocketError(ws, error, "join_room");
    return;
  }

  // Missing: Check if userId is already in use
  if (usersManager.get(data.userId)) {
    const error = ErrorHandler.createRoomError("User ID already in use", ErrorCode.USER_ALREADY_EXISTS);
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


  if (room.members.length >= room.maxRoomSize) {
    const error = ErrorHandler.createRoomError("Room is full", ErrorCode.ROOM_FULL);
    ErrorHandler.handleWebSocketError(ws, error, "join_room");
    return;
  }

  const user = usersManager.createUser({
    id: userId,
    username,
    roomId: room.id,
    socketId: nanoid(),
    isAdmin: false,
  });

  ws.data.userId = user.id;
  ws.data.roomId = room.id;

  addConnection(user.id, ws);

  const updatedRoom = roomsManager.addUserToRoom(room.id, user);

  if (!updatedRoom) {
    const error = ErrorHandler.createRoomError("Failed to join room", ErrorCode.INTERNAL_ERROR);
    ErrorHandler.handleWebSocketError(ws, error, "join_room");
    return;
  }

  ws.send(JSON.stringify({
    type: "JOIN_ROOM_SUCCESS",
    data: { room: updatedRoom, user },
  }));

  broadcastToRoom(room.id, {
    type: "USER_JOINED",
    data: { user, room: updatedRoom },
  }, [user.id]);
}

function handleCreateRoom(ws: ServerWebSocket<WebSocketData>, data: CreateRoomData) {
  const { roomName, username, userId, settings } = data;

  const roomId = nanoid();
  const user = usersManager.createUser({
    id: userId,
    username,
    roomId,
    socketId: nanoid(),
    isAdmin: true,
  });

  const room = roomsManager.create(roomId, roomName, user, {
    difficulty: (settings?.difficulty || DEFAULT_DIFFICULTY)
  });

  ws.data.userId = user.id;
  ws.data.roomId = room.id;
  ws.data.isAdmin = true;

  addConnection(user.id, ws);

  ws.send(JSON.stringify({
    type: "CREATE_ROOM_SUCCESS",
    data: { room, user },
  }));
}

function handleLeaveRoom(ws: ServerWebSocket<WebSocketData>) {
  const { userId, roomId } = ws.data;

  if (!userId || !roomId) return;

  const room = roomsManager.get(roomId);
  if (!room) return;

  const updatedRoom = roomsManager.removeUserFromRoom(roomId, userId);
  usersManager.removeUserFromRoom(userId);

  if (room.host === userId && updatedRoom && updatedRoom.members.length > 0) {
    const newHost = updatedRoom.members[0];
    roomsManager.setNewHost(roomId, newHost.id);
    usersManager.updateUser(newHost.id, { isAdmin: true });

    broadcastToRoom(roomId, {
      type: "HOST_CHANGED",
      data: { newHost: newHost },
    });
  }

  broadcastToRoom(roomId, {
    type: "USER_LEFT",
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

  removeConnection(userId);
}

function handleStartGame(ws: ServerWebSocket<WebSocketData>) {
  const { userId, roomId } = ws.data;

  if (!userId || !roomId) return;

  const room = roomsManager.get(roomId);
  if (!room || room.host !== userId) {
    const error = ErrorHandler.createPermissionError("Only the host can start the game");
    ErrorHandler.handleWebSocketError(ws, error, "start_game");
    return;
  }

  if (room.members.length < 2) {
    const error = new AppError({
      code: ErrorCode.INVALID_GAME_STATE,
      message: "Need at least 2 players to start",
      statusCode: 400
    });
    ErrorHandler.handleWebSocketError(ws, error, "start_game");
    return;
  }

  const success = gameManager.startGame(roomId);

  if (!success) {
    const error = new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message: "Failed to start game",
      statusCode: 500
    });
    ErrorHandler.handleWebSocketError(ws, error, "start_game");
  }
}

function handleSubmitAnswer(ws: ServerWebSocket<WebSocketData>, data: SubmitAnswerData) {
  const { userId, roomId } = ws.data;
  if (!userId || !roomId) return;

  gameManager.submitAnswer(roomId, userId, data.answer);
}

function handleToggleReady(ws: ServerWebSocket<WebSocketData>) {
  const { userId, roomId } = ws.data;

  if (!userId || !roomId) return;

  const user = usersManager.get(userId);
  if (!user) return;

  const updatedUser = usersManager.setUserReady(userId, !user.isReady);

  if (updatedUser) {
    broadcastToRoom(roomId, {
      type: "USER_READY_CHANGED",
      data: {
        userId: userId,
        isReady: updatedUser.isReady,
      },
    });
  }
}

function handleUpdateSettings(ws: ServerWebSocket<WebSocketData>, data: UpdateSettingsData) {
  const { userId, roomId } = ws.data;
  if (!userId || !roomId) return;

  const room = roomsManager.get(roomId);
  if (!room || room.host !== userId) return;

  const updatedRoom = roomsManager.update(roomId, {
    settings: { ...room.settings, ...data.settings } as Room['settings'],
  }) as Room;

  broadcastToRoom(roomId, {
    type: "SETTINGS_UPDATED",
    data: { settings: updatedRoom?.settings },
  });
}

function handlePauseGame(ws: ServerWebSocket<WebSocketData>) {
  const { userId, roomId } = ws.data;

  if (!userId || !roomId) return;

  const room = roomsManager.get(roomId);
  if (!room || room.host !== userId) return;

  gameManager.pauseGame(roomId);
}

function handleResumeGame(ws: ServerWebSocket<WebSocketData>) {
  const { userId, roomId } = ws.data;

  if (!userId || !roomId) return;

  const room = roomsManager.get(roomId);
  if (!room || room.host !== userId) return;

  gameManager.resumeGame(roomId);
}

function handleStopGame(ws: ServerWebSocket<WebSocketData>) {
  const { userId, roomId } = ws.data;

  if (!userId || !roomId) return;

  const room = roomsManager.get(roomId);
  if (!room || room.host !== userId) return;

  gameManager.stopGame(roomId);
}

function handleKickUser(ws: ServerWebSocket<WebSocketData>, data: KickUserData) {
  const { userId, roomId } = ws.data;
  if (!userId || !roomId) return;

  const room = roomsManager.get(roomId);
  if (!room || room.host !== userId) return;

  const targetUser = usersManager.get(data.userId);
  if (targetUser) {
    broadcastToUser(data.userId, {
      type: "KICKED",
      data: { reason: "Kicked by host" },
    });

    usersManager.removeUserFromRoom(data.userId);
    removeConnection(data.userId);
  }
}

function handleHeartbeatResponseMessage(ws: ServerWebSocket<WebSocketData>) {
  const { userId } = ws.data;

  if (userId) {
    handleHeartbeatResponse(userId);
  }
}