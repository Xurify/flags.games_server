import { roomsManager } from './room-management';
import { usersManager } from './user-management';
import { gameManager } from './game-management';
import { logger } from './logger';

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
  interval: 5 * 60 * 1000, // 5 minutes
  inactiveUserTimeout: 5 * 60, // 5 minutes
  emptyRoomTimeout: 5, // 5 minutes
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
      const [removedUsers, removedRooms] = await Promise.all([
        this.cleanupInactiveUsers(),
        this.cleanupEmptyRooms(),
      ]);

      const duration = Date.now() - startTime;
      this.logCleanupResults({ removedUsers, removedRooms, duration });

      return { removedUsers, removedRooms, duration };
    } catch (error) {
      console.error('Error during cleanup:', error);
      throw error;
    }
  }

  private logCleanupResults(result: CleanupResult): void {
    const { removedUsers, removedRooms, duration } = result;
    
    logger.info(`Cleanup completed in ${duration}ms:`, {
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
        usersManager.removeUserFromRoom(user.id);
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

  get isActive(): boolean {
    return this.isRunning;
  }
}

export const cleanupService = new CleanupService();
