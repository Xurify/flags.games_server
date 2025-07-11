import { serve } from "bun";
import { roomsManager } from "./lib/utils/room-management";
import { usersManager } from "./lib/utils/user-management";
import { gameManager } from "./lib/utils/game-management";
import { handleWebSocketMessage, handleWebSocketOpen, handleWebSocketClose } from "./lib/handlers/websockets";
import { getCorsHeaders, handlePreflightRequest } from "./lib/utils/security/cors";
//import { RateLimiter } from "./lib/utils/security/rate-limiter";
import { RequestValidator } from "./lib/utils/security/request-validator";
import { ErrorHandler, AppError, ErrorCode } from "./lib/utils/error-handler";
import { logger } from "./lib/utils/logger";
import { ServerWebSocket } from "bun";
import { metricsCollector } from "./lib/utils/metrics";
import { env, isDevelopment } from "./lib/utils/env";
import { WebSocketData } from "./types/multiplayer";

const createJsonResponse = (data: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(origin), "content-type": "application/json" }
  });

const handleApiError = (error: unknown, endpoint: string, origin: string | null = null) => {
  logger.error(`Error in ${endpoint}`, error);

  let appError: AppError;
  if (error instanceof AppError) {
    appError = error;
  } else {
    appError = new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message: "Internal Server Error",
      statusCode: 500,
      details: { endpoint }
    });
  }

  return ErrorHandler.createErrorResponse(appError, origin);
};

//const rateLimitMiddleware = RateLimiter.createMiddleware('api');
const requestValidationMiddleware = RequestValidator.createMiddleware();

const withMiddleware = (handler: (req: Request) => Promise<Response>) => {
  return ErrorHandler.asyncHandler(async (req: Request) => {
    //const rateLimitResponse = rateLimitMiddleware(req);
    // if (rateLimitResponse) {
    //   return rateLimitResponse;
    // }

    const validationResult = await requestValidationMiddleware(req);
    if (validationResult.response) {
      return validationResult.response;
    }

    return handler(req);
  });
};

const server = serve({
  port: env.PORT,
  routes: {
    "/api/healthz": {
      async OPTIONS(req) {
        return handlePreflightRequest(req);
      },
      GET: withMiddleware(async (req) => {
        const origin = req.headers.get('origin');
        try {
          return createJsonResponse({
            status: "ok",
            timestamp: new Date().toISOString(),
          }, 200, origin);
        } catch (error) {
          return handleApiError(error, "/api/healthz", origin);
        }
      }),
    },
    "/api/rooms": {
      async OPTIONS(req) {
        return handlePreflightRequest(req);
      },
      GET: withMiddleware(async (req) => {
        const origin = req.headers.get('origin');
        try {
          metricsCollector.set("activeRooms", roomsManager.rooms.size);
          return createJsonResponse({
            rooms: Object.fromEntries(roomsManager.rooms.entries()),
            count: roomsManager.rooms.size,
          }, 200, origin);
        } catch (error) {
          return handleApiError(error, "/api/rooms", origin);
        }
      }),
    },
    "/api/users": {
      async OPTIONS(req) {
        return handlePreflightRequest(req);
      },
      GET: withMiddleware(async (req) => {
        const origin = req.headers.get('origin');
        try {
          metricsCollector.set("activeUsers", usersManager.users.size);
          return createJsonResponse({
            users: Object.fromEntries(usersManager.users.entries()),
            count: usersManager.users.size,
          }, 200, origin);
        } catch (error) {
          return handleApiError(error, "/api/users", origin);
        }
      }),
    },
    "/api/stats": {
      async OPTIONS(req) {
        return handlePreflightRequest(req);
      },
      GET: withMiddleware(async (req) => {
        const origin = req.headers.get('origin');
        try {
          const activeRooms = roomsManager.rooms.size;
          const activeUsers = usersManager.users.size;
          const activeGames = gameManager.getActiveGames().length;

          metricsCollector.set("activeRooms", activeRooms);
          metricsCollector.set("activeUsers", activeUsers);
          metricsCollector.set("activeGames", activeGames);

          return createJsonResponse({
            rooms: activeRooms,
            users: activeUsers,
            activeGames,
            timestamp: new Date().toISOString(),
            metrics: metricsCollector.getMetrics(),
          }, 200, origin);
        } catch (error) {
          return handleApiError(error, "/api/stats", origin);
        }
      }),
    },
    "/ws": {
      async GET(req, server) {
        const upgraded = server.upgrade(req);
        if (!upgraded) {
          return new Response("WebSocket upgrade failed", { status: 400 });
        }
        return undefined;
      },
    },
  },
  websocket: {
    open: (ws: ServerWebSocket<any>) => {
      metricsCollector.increment("activeConnections");
      handleWebSocketOpen(ws);
    },
    message: (ws: ServerWebSocket<WebSocketData>, message: string | Buffer) => {
      metricsCollector.increment("totalMessages");
      handleWebSocketMessage(ws, message);
    },
    close: (ws: ServerWebSocket<WebSocketData>) => {
      metricsCollector.increment("activeConnections", -1);
      handleWebSocketClose(ws);
    },
    perMessageDeflate: true,
  },
  development: isDevelopment,
});

logger.info(`🚩 flags.games WebSocket server running on ${server.url}`); 