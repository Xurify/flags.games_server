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
import { validateUsername } from "../utils/validation";
import {
  WebSocketMessage,
  WebSocketData,
  CustomWebSocket,
  Room,
} from "../../types/multiplayer";
import { nanoid } from "nanoid";

export function handleWebSocketOpen(ws: ServerWebSocket<WebSocketData>) {
  console.log("WebSocket connection opened");

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
    const data: WebSocketMessage = JSON.parse(message.toString());

    switch (data.type) {
      case "JOIN_ROOM":
        handleJoinRoom(ws, data.data);
        break;

      case "CREATE_ROOM":
        handleCreateRoom(ws, data.data);
        break;

      case "LEAVE_ROOM":
        handleLeaveRoom(ws);
        break;

      case "START_GAME":
        handleStartGame(ws);
        break;

      case "SUBMIT_ANSWER":
        handleSubmitAnswer(ws, data.data);
        break;

      case "TOGGLE_READY":
        handleToggleReady(ws);
        break;

      case "UPDATE_SETTINGS":
        handleUpdateSettings(ws, data.data);
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

      case "KICK_USER":
        handleKickUser(ws, data.data);
        break;

      case "HEARTBEAT_RESPONSE":
        handleHeartbeatResponseMessage(ws);
        break;

      default:
        console.warn("Unknown message type:", data.type);
    }
  } catch (error) {
    console.error("Error handling WebSocket message:", error);
    ws.send(
      JSON.stringify({
        type: "ERROR",
        data: { message: "Invalid message format" },
      })
    );
  }
}

export function handleWebSocketClose(ws: ServerWebSocket<WebSocketData>) {
  console.log("WebSocket connection closed");

  if (ws.data?.userId && ws.data?.roomId) {
    handleLeaveRoom(ws);
  } else if (ws.data?.userId) {
    removeConnection(ws.data.userId);
  }
}

function handleJoinRoom(ws: ServerWebSocket<WebSocketData>, data: any) {
  if (!data || !data.username || !data.userId) {
    ws.send(
      JSON.stringify({
        type: "JOIN_ROOM_ERROR",
        data: { message: "Missing required fields" },
      })
    );
    return;
  }

  const { roomId, inviteCode, username, userId } = data;

  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    ws.send(
      JSON.stringify({
        type: "JOIN_ROOM_ERROR",
        data: { message: usernameValidation.error },
      })
    );
    return;
  }

  let room = roomId
    ? roomsManager.get(roomId)
    : roomsManager.getRoomByInviteCode(inviteCode);

  if (!room) {
    ws.send(
      JSON.stringify({
        type: "JOIN_ROOM_ERROR",
        data: { message: "Room not found" },
      })
    );
    return;
  }

  if (room.members.length >= room.maxRoomSize) {
    ws.send(
      JSON.stringify({
        type: "JOIN_ROOM_ERROR",
        data: { message: "Room is full" },
      })
    );
    return;
  }
  // Check if game is active and settings don't allow spectators
  // if (room.gameState.isActive && !room.settings.allowSpectators) {
  //   ws.send(
  //     JSON.stringify({
  //       type: "JOIN_ROOM_ERROR",
  //       data: { message: "Game is in progress and spectators are not allowed" },
  //     })
  //   );
  //   return;
  // }

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
    ws.send(
      JSON.stringify({
        type: "JOIN_ROOM_ERROR",
        data: { message: "Failed to join room" },
      })
    );
    return;
  }

  ws.send(
    JSON.stringify({
      type: "JOIN_ROOM_SUCCESS",
      data: {
        room: updatedRoom,
        user: user,
      },
    })
  );

  broadcastToRoom(
    room.id,
    {
      type: "USER_JOINED",
      data: {
        user: user,
        room: updatedRoom,
      },
    },
    [user.id]
  );
}

function handleCreateRoom(ws: ServerWebSocket<WebSocketData>, data: any) {
  if (!data || !data.username || !data.userId || !data.roomName) {
    ws.send(
      JSON.stringify({
        type: "CREATE_ROOM_ERROR",
        data: { message: "Missing required fields" },
      })
    );
    return;
  }

  const { roomName, username, userId, settings } = data;

  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    ws.send(
      JSON.stringify({
        type: "CREATE_ROOM_ERROR",
        data: { message: usernameValidation.error },
      })
    );
    return;
  }

  const roomId = nanoid();
  const user = usersManager.createUser({
    id: userId,
    username,
    roomId,
    socketId: nanoid(),
    isAdmin: true,
  });

  const room = roomsManager.create(roomId, roomName, user, settings);

  ws.data.userId = user.id;
  ws.data.roomId = room.id;
  ws.data.isAdmin = true;

  addConnection(user.id, ws);

  ws.send(
    JSON.stringify({
      type: "CREATE_ROOM_SUCCESS",
      data: {
        room: room,
        user: user,
      },
    })
  );
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
      room: updatedRoom,
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
    ws.send(
      JSON.stringify({
        type: "START_GAME_ERROR",
        data: { message: "Only the host can start the game" },
      })
    );
    return;
  }

  if (room.members.length < 2) {
    ws.send(
      JSON.stringify({
        type: "START_GAME_ERROR",
        data: { message: "Need at least 2 players to start" },
      })
    );
    return;
  }

  const success = gameManager.startGame(roomId);

  if (!success) {
    ws.send(
      JSON.stringify({
        type: "START_GAME_ERROR",
        data: { message: "Failed to start game" },
      })
    );
  }
}

function handleSubmitAnswer(ws: ServerWebSocket<WebSocketData>, data: any) {
  const { userId, roomId } = ws.data;
  
  if (!userId || !roomId || !data?.answer) return;

  const { answer } = data;

  gameManager.submitAnswer(roomId, userId, answer);
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

function handleUpdateSettings(ws: ServerWebSocket<WebSocketData>, data: any) {
  const { userId, roomId } = ws.data;
  
  if (!userId || !roomId || !data?.settings) return;

  const { settings } = data;

  const room = roomsManager.get(roomId);
  if (!room || room.host !== userId) return;

  const updatedRoom = roomsManager.update(roomId, {
    settings: { ...room.settings, ...settings },
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

function handleKickUser(ws: ServerWebSocket<WebSocketData>, data: any) {
  const { userId, roomId } = ws.data;
  
  if (!userId || !roomId || !data?.targetUserId) return;

  const { targetUserId } = data;

  const room = roomsManager.get(roomId);
  if (!room || room.host !== userId) return;

  const targetUser = usersManager.get(targetUserId);
  if (targetUser) {
    broadcastToUser(targetUserId, {
      type: "KICKED",
      data: { reason: "Kicked by host" },
    });

    usersManager.removeUserFromRoom(targetUserId);
    removeConnection(targetUserId);
  }
}

function handleHeartbeatResponseMessage(ws: ServerWebSocket<WebSocketData>) {
  const { userId } = ws.data;

  if (userId) {
    handleHeartbeatResponse(userId);
  }
}