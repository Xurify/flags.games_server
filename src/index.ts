import { serve } from "bun";
import { roomsManager } from "./lib/utils/room-management";
import { usersManager } from "./lib/utils/user-management";
import { gameManager } from "./lib/utils/game-management";
import { handleWebSocketMessage, handleWebSocketOpen, handleWebSocketClose } from "./lib/handlers/websockets";
import { corsHeaders } from "./lib/utils/cors";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

const server = serve({
  port: PORT,
  routes: {
    "/api/healthz": {
      async GET(req) {
        return new Response(
          JSON.stringify({
            status: "ok",
            timestamp: new Date().toISOString(),
            // Note: server.pendingWebSockets is not available in routes handlers, so omit or replace if needed
          }),
          { headers: { ...corsHeaders, "content-type": "application/json" } }
        );
      },
    },
    "/api/rooms": {
      async GET(req) {
        return new Response(
          JSON.stringify({
            rooms: Object.fromEntries(roomsManager.rooms.entries()),
            count: roomsManager.rooms.size,
          }),
          { headers: { ...corsHeaders, "content-type": "application/json" } }
        );
      },
    },
    "/api/users": {
      async GET(req) {
        return new Response(
          JSON.stringify({
            users: Object.fromEntries(usersManager.users.entries()),
            count: usersManager.users.size,
          }),
          { headers: { ...corsHeaders, "content-type": "application/json" } }
        );
      },
    },
    "/api/stats": {
      async GET(req) {
        return new Response(
          JSON.stringify({
            rooms: roomsManager.rooms.size,
            users: usersManager.users.size,
            activeGames: gameManager.getActiveGames().length,
            timestamp: new Date().toISOString(),
          }),
          { headers: { ...corsHeaders, "content-type": "application/json" } }
        );
      },
    },
    "/api/room/:id": async req => {
      const { id } = req.params;
      const room = roomsManager.get(id);
      return new Response(
        JSON.stringify({ room }),
        { headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    },
  },
  websocket: {
    open: handleWebSocketOpen,
    message: handleWebSocketMessage,
    close: handleWebSocketClose,
    perMessageDeflate: true,
  },
  development: true,
});

console.log(`🚩 flags.games WebSocket server running on ${server.url}`);