import { serve } from "bun";
import { roomsManager } from "./lib/utils/room-management";
import { usersManager } from "./lib/utils/user-management";
import { gameManager } from "./lib/utils/game-management";
import { handleWebSocketMessage, handleWebSocketOpen, handleWebSocketClose } from "./lib/handlers/websockets";
import { corsHeaders } from "./lib/utils/cors";
import { logger } from "./lib/utils/logger";
import { ServerWebSocket } from "bun";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

const server = serve({
  port: PORT,
  routes: {
    "/api/healthz": {
      async GET(req) {
        try {
          return new Response(
            JSON.stringify({
              status: "ok",
              timestamp: new Date().toISOString(),
            }),
            { headers: { ...corsHeaders, "content-type": "application/json" } }
          );
        } catch (error) {
          logger.error("Error in /api/healthz", error);
          return new Response("Internal Server Error", { status: 500 });
        }
      },
    },
    "/api/rooms": {
      async GET(req) {
        try {
          return new Response(
            JSON.stringify({
              rooms: Object.fromEntries(roomsManager.rooms.entries()),
              count: roomsManager.rooms.size,
            }),
            { headers: { ...corsHeaders, "content-type": "application/json" } }
          );
        } catch (error) {
          logger.error("Error in /api/rooms", error);
          return new Response("Internal Server Error", { status: 500 });
        }
      },
    },
    "/api/users": {
      async GET(req) {
        try {
          return new Response(
            JSON.stringify({
              users: Object.fromEntries(usersManager.users.entries()),
              count: usersManager.users.size,
            }),
            { headers: { ...corsHeaders, "content-type": "application/json" } }
          );
        } catch (error) {
          logger.error("Error in /api/users", error);
          return new Response("Internal Server Error", { status: 500 });
        }
      },
    },
    "/api/stats": {
      async GET(req) {
        try {
          return new Response(
            JSON.stringify({
              rooms: roomsManager.rooms.size,
              users: usersManager.users.size,
              activeGames: gameManager.getActiveGames().length,
              timestamp: new Date().toISOString(),
            }),
            { headers: { ...corsHeaders, "content-type": "application/json" } }
          );
        } catch (error) {
          logger.error("Error in /api/stats", error);
          return new Response("Internal Server Error", { status: 500 });
        }
      },
    },
    "/api/room/:id": async req => {
      const { id } = req.params;
      try {
        const room = roomsManager.get(id);
        if (room) {
          return new Response(
            JSON.stringify({ room }),
            { headers: { ...corsHeaders, "content-type": "application/json" } }
          );
        }
        return new Response("Room not found", { status: 404 });
      } catch (error) {
        logger.error(`Error in /api/room/${id}`, error);
        return new Response("Internal Server Error", { status: 500 });
      }
    },
  },
  websocket: {
    open: (ws: ServerWebSocket<any>) => {
      handleWebSocketOpen(ws);
    },
    message: (ws: ServerWebSocket<any>, message: string | Buffer) => {
      handleWebSocketMessage(ws, message);
    },
    close: (ws: ServerWebSocket<any>) => {
      handleWebSocketClose(ws);
    },
    perMessageDeflate: true,
  },
  development: true,
});

logger.info(`🚩 flags.games WebSocket server running on ${server.url}`); 