import { roomsManager } from '../managers/room-management';
import { usersManager } from '../managers/user-management';
import { gameManager } from '../managers/game-management';
import { logger } from './logger';
import { MAX_ROOM_LIFETIME_MS } from '../constants/game-constants';
import { webSocketManager } from '../managers/websocket-management';
import { WS_MESSAGE_TYPES } from '../constants/ws-message-types';

interface CleanupConfig {
  interval: number; // milliseconds
  inactiveUserTimeout: number; // seconds
  emptyRoomTimeout: number; // minutes
}

interface CleanupStats {
  totalUsers: number;
  totalRooms: number;
  activeRooms: number;
  emptyRooms: number;
  inactiveUsers: number;
  scheduledDeletions: number;
  nextCleanup: number;
}

interface CleanupResult {
  removedUsers: number;
  removedRooms: number;
  duration: number;
}

const DEFAULT_CONFIG: CleanupConfig = {
  interval: 30 * 60 * 1000, // 30 minutes
  inactiveUserTimeout: 5, // 5 minutes
  emptyRoomTimeout: 10, // 10 minutes
};

class CleanupService {
  private timerId: NodeJS.Timer | null = null;
  private config: CleanupConfig;
  private isRunning = false;

  constructor(config: Partial<CleanupConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    if (this.isRunning) {
      console.warn('Cleanup service is already running');
      return;
    }

    logger.info('Starting cleanup service with interval:', this.config.interval, 'ms');
    this.isRunning = true;
    this.timerId = setInterval(() => {
      this.performCleanup().catch(error => {
        console.error('Cleanup failed:', error);
      });
    }, this.config.interval);
  }

  stop(): void {
    if (!this.isRunning) return;

    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    this.isRunning = false;
    logger.info('Cleanup service stopped');
  }

  public async performCleanup(): Promise<CleanupResult> {
    const startTime = Date.now();
    logger.debug('Starting cleanup cycle at:', new Date().toISOString());

    try {
      const [removedUsers, removedEmptyRooms, removedExpiredRooms] = await Promise.all([
        this.cleanupInactiveUsers(),
        this.cleanupEmptyRooms(),
        this.cleanupExpiredRooms(),
      ]);

      const duration = Date.now() - startTime;
      const removedRooms = removedEmptyRooms + removedExpiredRooms;
      
      this.logCleanupResults({ removedUsers, removedRooms, duration });

      return { removedUsers, removedRooms, duration };
    } catch (error) {
      console.error('Error during cleanup:', error);
      throw error;
    }
  }

  private logCleanupResults(result: CleanupResult): void {
    const { removedUsers, removedRooms, duration } = result;
    
    logger.debug(`Cleanup completed in ${duration}ms:`, {
      removedUsers,
      removedRooms,
      activeRooms: roomsManager.getActiveRooms().length,
      activeUsers: usersManager.getLength(),
    });
  }

  cleanupInactiveUsers(): number {
    const inactiveUsers = usersManager.getInactiveUsers(
      this.config.inactiveUserTimeout
    );

    if (inactiveUsers.length === 0) return 0;

    logger.info(`Removing ${inactiveUsers.length} inactive users`);
    
    for (const user of inactiveUsers) {
      if (user.roomId) {
        roomsManager.removeUserFromRoom(user.roomId, user.id);
      }
      usersManager.deleteUser(user.id);
    }

    return inactiveUsers.length;
  }

  cleanupEmptyRooms(): number {
    const emptyRooms = roomsManager.getRoomsOlderThan(
      this.config.emptyRoomTimeout
    );

    if (emptyRooms.length === 0) return 0;

    logger.info(`Removing ${emptyRooms.length} empty rooms`);

    for (const room of emptyRooms) {
      try {
        if (room.gameState?.isActive) {
          gameManager.stopGame(room.id);
        }
        roomsManager.delete(room.id);
      } catch (error) {
        console.error(`Failed to cleanup room ${room.id}:`, error);
      }
    }

    return emptyRooms.length;
  }

  cleanupExpiredRooms(): number {
    const now = Date.now();
    const ttlWarningWindowMs = 5 * 60 * 1000; // 5 minutes before expiration

    const expiredRooms = roomsManager.getRoomsExceedingLifetime(MAX_ROOM_LIFETIME_MS);
    const warningCutoff = new Date(now - (MAX_ROOM_LIFETIME_MS - ttlWarningWindowMs));

    const roomsNeedingWarning = Array.from(roomsManager.rooms.values()).filter((room) => {
      const createdAt = new Date(room.createdAt).getTime();
      const expiresAt = createdAt + MAX_ROOM_LIFETIME_MS;
      const remainingMs = expiresAt - now;
      return remainingMs > 0 && remainingMs <= ttlWarningWindowMs;
    });

    for (const room of roomsNeedingWarning) {
      const createdAt = new Date(room.createdAt).getTime();
      const expiresAt = createdAt + MAX_ROOM_LIFETIME_MS;
      const remainingMs = Math.max(0, expiresAt - now);
      webSocketManager.broadcastToRoom(room.id, {
        type: WS_MESSAGE_TYPES.ROOM_TTL_WARNING,
        data: { roomId: room.id, expiresAt, remainingMs },
      });
    }

    if (expiredRooms.length === 0) return 0;

    logger.info(`Removing ${expiredRooms.length} expired rooms (exceeded TTL)`);

    for (const room of expiredRooms) {
      try {
        if (room.gameState?.isActive) {
          gameManager.stopGame(room.id);
        }
        webSocketManager.broadcastToRoom(room.id, {
          type: WS_MESSAGE_TYPES.ROOM_EXPIRED,
          data: { roomId: room.id, expiredAt: now },
        });
        roomsManager.delete(room.id);
      } catch (error) {
        console.error(`Failed to cleanup expired room ${room.id}:`, error);
      }
    }

    return expiredRooms.length;
  }

  get isActive(): boolean {
    return this.isRunning;
  }
}

export const cleanupService = new CleanupService();
