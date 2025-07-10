import { roomsManager } from "../utils/room-management";
import { usersManager } from "../utils/user-management";
import { gameManager } from "../utils/game-management";
import { broadcastToRoom } from "../utils/websockets";
import { CustomWebSocket } from "../../types/multiplayer";
import { validateUsername } from "../utils/validation";
import { ErrorHandler } from "../utils/error-handler";
import { logger } from "../utils/logger";

export function handleGameSpecificEvents(ws: CustomWebSocket, type: string, data: any) {
  const { userId, roomId } = ws.data;
  
  if (!userId || !roomId) return;

  switch (type) {      
    case 'SKIP_QUESTION':
      handleSkipQuestion(ws);
      break;

    case 'REACTION':
      handleReaction(ws, data);
      break;
      
    case 'UPDATE_PROFILE':
      handleUpdateProfile(ws, data);
      break;
      
    default:
      logger.warn('Unknown game event type:', type);
  }
}

function handleSkipQuestion(ws: CustomWebSocket) {
  const { userId, roomId } = ws.data;
  const room = roomsManager.get(roomId!);
  
  if (!room || room.host !== userId) return;

  if (!room.gameState.isActive) return;

  broadcastToRoom(roomId!, {
    type: 'QUESTION_SKIPPED',
    data: { skippedBy: userId }
  });

  gameManager.nextQuestion(roomId!);
}

function handleReaction(ws: CustomWebSocket, data: any) {
  const { userId, roomId } = ws.data;
  const { reaction, targetUserId } = data;
  const user = usersManager.get(userId!);
  
  if (!user) return;

  const validReactions = ['👍', '👎', '😄', '😢', '🤔', '🎉', '🔥', '❤️'];
  if (!validReactions.includes(reaction)) return;

  broadcastToRoom(roomId!, {
    type: 'USER_REACTION',
    data: {
      fromUserId: userId,
      fromUsername: user.username,
      targetUserId,
      reaction,
      timestamp: Date.now()
    }
  });
}

function handleUpdateProfile(ws: CustomWebSocket, data: any) {
  const { userId } = ws.data;
  const { color, username } = data;
  const user = usersManager.get(userId!);
  
  if (!user) return;

  let updates: any = {};
  
  if (color) {
    updates.color = color;
  }
  
  if (username) {
    const validation = validateUsername(username);
    if (!validation.valid) {
      const error = ErrorHandler.createValidationError(validation.error || "Invalid username");
      ErrorHandler.handleWebSocketError(ws, error, "profile_update");
      return;
    }
    updates.username = username;
  }

  const updatedUser = usersManager.updateUser(userId!, updates);
  
  if (updatedUser) {
    ws.send(JSON.stringify({
      type: 'PROFILE_UPDATED',
      data: { user: updatedUser }
    }));
    
    if (username) {
      broadcastToRoom(user.roomId, {
        type: 'USER_PROFILE_UPDATED',
        data: { 
          userId: userId,
          username: updatedUser.username,
          color: updatedUser.color
        }
      }, [userId!]);
    }
  }
}
