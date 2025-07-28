import { roomsManager } from "./room-management";
import { usersManager } from "./user-management";
import { CustomWebSocket, WebSocketMessage } from "../../types/entities";
import { HeartbeatManager } from "./heartbeat-management";
import { logger } from "./logger";

const connections = new Map<string, CustomWebSocket>();

const heartbeatManager = new HeartbeatManager(
  {
    interval: 30000,
    timeout: 10000,
    maxMissed: 3,
    enableLogging: process.env.NODE_ENV === 'development'
  },
  (userId: string) => {
    removeConnectionAndUser(userId);
  },
  (userId: string) => {
    usersManager.updateUserActivity(userId);
  }
);

export function addConnection(userId: string, ws: CustomWebSocket) {
  connections.set(userId, ws);
  usersManager.setUserConnection(userId, ws);
  heartbeatManager.startHeartbeat(userId, ws);
}

export function removeConnection(userId: string) {
  if (!connections.has(userId)) return;
  
  connections.delete(userId);
  usersManager.removeUserConnection(userId);
  heartbeatManager.stopHeartbeat(userId);
}

export function removeConnectionAndUser(userId: string) {
  if (!connections.has(userId)) return;
  
  connections.delete(userId);
  usersManager.removeUserConnection(userId);
  heartbeatManager.stopHeartbeat(userId);
  
  const user = usersManager.getUser(userId);
  if (user && user.roomId) {
    usersManager.removeUserFromRoom(userId);
  }
  usersManager.deleteUser(userId);
}

export function getConnection(userId: string): CustomWebSocket | undefined {
  return connections.get(userId);
}

function isConnectionValid(ws: CustomWebSocket | undefined): boolean {
  return !!ws && (ws.readyState === WebSocket.OPEN);
}

export function broadcastToRoom(roomId: string, message: WebSocketMessage, exclude: string[] = []) {
  const room = roomsManager.get(roomId);
  if (!room) return;

  const messageString = JSON.stringify({
    ...message,
    timestamp: Date.now()
  });

  const excludeSet = new Set(exclude);

  room.members.forEach(member => {
    if (excludeSet.has(member.id)) return;

    const ws = getConnection(member.id);
    if (isConnectionValid(ws)) {
      try {
        ws!.send(messageString);
      } catch (error) {
        logger.error(`Error sending message to user ${member.id}:`, error);
        removeConnection(member.id);
      }
    }
  });
}

export function broadcastToUser(userId: string, message: WebSocketMessage) {
  const ws = getConnection(userId);
  if (!isConnectionValid(ws)) {
    removeConnection(userId);
    return;
  }

  try {
    ws!.send(JSON.stringify({
      ...message,
      timestamp: Date.now()
    }));
  } catch (error) {
    logger.error(`Error sending message to user ${userId}:`, error);
    removeConnection(userId);
  }
}

export function broadcastToAll(message: WebSocketMessage) {
  const messageString = JSON.stringify({
    ...message,
    timestamp: Date.now()
  });

  connections.forEach((ws, userId) => {
    if (isConnectionValid(ws)) {
      try {
        ws.send(messageString);
      } catch (error) {
        logger.error(`Error broadcasting to user ${userId}:`, error);
        removeConnection(userId);
      }
    }
  });
}

export function batchBroadcastToUsers(userIds: string[], message: WebSocketMessage) {
  const messageString = JSON.stringify({
    ...message,
    timestamp: Date.now()
  });

  const failedUserIds: string[] = [];

  userIds.forEach(userId => {
    const ws = getConnection(userId);
    if (isConnectionValid(ws)) {
      try {
        ws!.send(messageString);
      } catch (error) {
        logger.error(`Error sending message to user ${userId}:`, error);
        failedUserIds.push(userId);
      }
    } else {
      failedUserIds.push(userId);
    }
  });

  failedUserIds.forEach(userId => removeConnection(userId));
}

export function handleHeartbeatResponse(userId: string) {
  heartbeatManager.handleHeartbeatResponse(userId);
}

export function getConnectionStats(): {
  totalConnections: number;
  activeConnections: number;
  deadConnections: number;
  heartbeatStats: ReturnType<typeof heartbeatManager.getStats>;
} {
  let activeConnections = 0;
  
  for (const ws of connections.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      activeConnections++;
    }
  }

  const totalConnections = connections.size;
  const deadConnections = totalConnections - activeConnections;

  return {
    totalConnections,
    activeConnections,
    deadConnections,
    heartbeatStats: heartbeatManager.getStats()
  };
}

export function cleanupDeadConnections() {
  const deadUserIds: string[] = [];

  for (const [userId, ws] of connections) {
    if (ws.readyState !== WebSocket.OPEN) {
      deadUserIds.push(userId);
    }
  }

  deadUserIds.forEach(userId => {
    removeConnectionAndUser(userId);
  });

  return deadUserIds.length;
}

export { heartbeatManager };