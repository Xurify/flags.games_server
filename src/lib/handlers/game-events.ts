import { roomsManager } from "../utils/room-management";
import { usersManager } from "../utils/user-management";
import { gameManager } from "../utils/game-management";
import { broadcastToRoom } from "../utils/websockets";
import { CustomWebSocket } from "../../types/multiplayer";
import { logger } from "../utils/logger";
import { WS_MESSAGE_TYPES } from "../constants/ws-message-types";

export function handleGameSpecificEvents(ws: CustomWebSocket, type: string, data: any) {
  const { userId, roomId } = ws.data;
  
  if (!userId || !roomId) return;

  switch (type) {      
    case WS_MESSAGE_TYPES.REACTION:
      handleReaction(ws, data);
      break;
      
    default:
      logger.warn('Unknown game event type:', type);
  }
}

function handleReaction(ws: CustomWebSocket, data: any) {
  const { userId, roomId } = ws.data;
  const { reaction, targetUserId } = data;
  const user = usersManager.getUser(userId!);
  
  if (!user) return;

  const validReactions = ['👍', '👎', '😄', '😢', '🤔', '🎉', '🔥', '❤️'];
  if (!validReactions.includes(reaction)) return;

  broadcastToRoom(roomId!, {
    type: WS_MESSAGE_TYPES.USER_REACTION,
    data: {
      fromUserId: userId,
      fromUsername: user.username,
      targetUserId,
      reaction,
      timestamp: Date.now()
    }
  });
}
