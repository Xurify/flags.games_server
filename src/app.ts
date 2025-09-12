import { BunRequest, serve } from "bun";
import { roomsManager } from "./lib/managers/room-management";
import { usersManager } from "./lib/managers/user-management";
import { gameManager } from "./lib/managers/game-management";
import { cleanupService } from "./lib/utils/cleanup";
import { webSocketManager } from "./lib/managers/websocket-management";
import { getCorsHeaders, handlePreflightRequest } from "./lib/utils/security/cors";
import { RequestValidator } from "./lib/utils/security/request-validator";
import { ErrorHandler, AppError, ErrorCode } from "./lib/utils/error-handler";
import { logger } from "./lib/utils/logger";
import { ServerWebSocket } from "bun";
import { env, isDevelopment } from "./lib/utils/env";
import { WebSocketData } from "./types/entities";
import { WebSocketSecurity } from "./lib/utils/security/websocket";
import { getClientIPAddress } from "./lib/utils/security/network";
import { parseCookies } from "./lib/utils/security/cookies";

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

const requireAuth = (handler: (req: Request) => Promise<Response>) => {
  return async (req: Request) => {
    const origin = req.headers.get('origin');

    const apiKey = req.headers.get('x-api-key');
    if (!apiKey || apiKey !== env.ADMIN_API_KEY) {
      return createJsonResponse({ error: "Unauthorized" }, 401, origin);
    }

    return handler(req);
  };
};

const requestValidationMiddleware = RequestValidator.createMiddleware();

const withMiddleware = <T extends Request = Request>(handler: (req: T) => Promise<Response>) => {
  return ErrorHandler.asyncHandler(async (req: Request) => {
    const validationResult = await requestValidationMiddleware(req);
    if (validationResult.response) {
      return validationResult.response;
    }

    return handler(req as T);
  });
};

const withAdminAuth = <T extends Request = Request>(handler: (req: Request) => Promise<Response>) => {
  return withMiddleware<T>(
    requireAuth(handler)
  );
};

const server = serve({
  port: env.PORT,
  routes: {
    "/api/status": new Response("OK", { status: 200 }),
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
    "/api/admin/rooms": {
      async OPTIONS(req) {
        return handlePreflightRequest(req);
      },
      GET: withAdminAuth(async (req) => {
        const origin = req.headers.get('origin');
        try {
          return createJsonResponse({
            rooms: Object.fromEntries(roomsManager.rooms.entries()),
            count: roomsManager.rooms.size,
          }, 200, origin);
        } catch (error) {
          return handleApiError(error, "/api/admin/rooms", origin);
        }
      }),
    },
    "/api/admin/users": {
      async OPTIONS(req) {
        return handlePreflightRequest(req);
      },
      GET: withAdminAuth(async (req) => {
        const origin = req.headers.get('origin');
        try {
          return createJsonResponse({
            users: Object.fromEntries(usersManager.users.entries()),
            count: usersManager.users.size,
          }, 200, origin);
        } catch (error) {
          return handleApiError(error, "/api/admin/users", origin);
        }
      }),
    },
    "/api/rooms/:inviteCode": {
      async OPTIONS(req) {
        return handlePreflightRequest(req);
      },
      GET: withMiddleware(async (req: BunRequest & { params: { inviteCode: string } }) => {
        const origin = req.headers.get('origin');
        const inviteCode = req.params.inviteCode;
        const room = roomsManager.getRoomByInviteCode(inviteCode);
        if (!room) {
          return createJsonResponse({ error: "Room not found" }, 404, origin);
        }
        const roomInfo = {
          id: room.id,
          name: room.name,
          memberCount: room.members.length,
          maxRoomSize: room.settings.maxRoomSize,
          isActive: room.gameState.isActive,
          gameMode: room.settings.gameMode,
        };
        return createJsonResponse({ data: roomInfo }, 200, origin);
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

          return createJsonResponse({
            rooms: activeRooms,
            users: activeUsers,
            activeGames,
            timestamp: new Date().toISOString(),
          }, 200, origin);
        } catch (error) {
          return handleApiError(error, "/api/stats", origin);
        }
      }),
    },
    "/ws": {
      async GET(req, server) {
        const serverIp = server.requestIP(req);
        const ipAddress = serverIp?.address || getClientIPAddress(req) || undefined;

        const check = WebSocketSecurity.validateConnection(req, ipAddress);
        if (!check.allowed) {
          return new Response(check.reason || "Forbidden", { status: 403 });
        }

        const cookies = parseCookies(req.headers.get('cookie'));
        const session = cookies['session_token'];
        let userId: string | null = null;
        if (session) {
          userId = session;
        }

        if (!userId) {
          return new Response("Unauthorized", { status: 401 });
        }

        const upgraded = server.upgrade(req, {
          data: {
            userId,
            roomId: null,
            isAdmin: false,
            authenticated: true,
            ipAddress,
          } satisfies WebSocketData
        });
        if (!upgraded) {
          return new Response("WebSocket upgrade failed", { status: 400 });
        }
        WebSocketSecurity.trackConnection(undefined as any, req);
        return undefined;
      },
    },
  },
  websocket: {
    open: (ws: ServerWebSocket<WebSocketData>) => {
      webSocketManager.handleOpen(ws);
    },
    message: (ws: ServerWebSocket<WebSocketData>, message: string | Buffer) => {
      webSocketManager.handleMessage(ws, message);
    },
    close: (ws: ServerWebSocket<WebSocketData>) => {
      webSocketManager.handleClose(ws);
      if (ws.data?.ipAddress) {
        try { (WebSocketSecurity as any).untrackByIp?.(ws.data.ipAddress); } catch { }
      }
    },
    perMessageDeflate: false,
  },
  development: isDevelopment,
});

cleanupService.start();

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  cleanupService.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  cleanupService.stop();
  process.exit(0);
});

logger.info(`🚩 flags.games WebSocket server running on ${server.url}`);