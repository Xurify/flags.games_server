import { roomsManager } from './room-management';
import { usersManager } from './user-management';
import { gameManager } from './game-management';

const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const INACTIVE_USER_TIMEOUT = 15 * 60; // 15 minutes
const EMPTY_ROOM_TIMEOUT = 30 * 60; // 30 minutes

class CleanupService {
  private intervalId: Timer | null = null;

  start(): void {
    if (this.intervalId) return;

    console.log('Starting cleanup service...');
    this.intervalId = setInterval(() => {
      this.performCleanup();
    }, CLEANUP_INTERVAL);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Cleanup service stopped');
    }
  }

  private performCleanup(): void {
    const startTime = Date.now();

    try {
      const inactiveUsers = usersManager.getInactiveUsers(INACTIVE_USER_TIMEOUT);
      let removedUsers = 0;

      for (const user of inactiveUsers) {
        console.log(`Removing inactive user: ${user.username} (${user.id})`);
        usersManager.removeUserFromRoom(user.id);
        removedUsers++;
      }

      const emptyRooms = roomsManager.getRoomsOlderThan(EMPTY_ROOM_TIMEOUT);
      let removedRooms = 0;

      for (const room of emptyRooms) {
        console.log(`Removing empty room: ${room.name} (${room.id})`);

        if (room.gameState.isActive) {
          gameManager.stopGame(room.id);
        }

        roomsManager.delete(room.id);
        removedRooms++;
      }

      this.cleanupOrphanedConnections();

      // TODO: Clean up logs
      const duration = Date.now() - startTime;
      console.log(`Cleanup completed in ${duration}ms:`);
      console.log(`  - Removed ${removedUsers} inactive users`);
      console.log(`  - Removed ${removedRooms} empty rooms`);
      console.log(`  - Active rooms: ${roomsManager.getActiveRooms().length}`);
      console.log(`  - Active users: ${usersManager.getLength()}`);

    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  private cleanupOrphanedConnections(): void {
    const allUsers = Array.from(usersManager.users.values());

    for (const user of allUsers) {
      const room = roomsManager.get(user.roomId);
      if (!room) {
        console.log(`Removing orphaned user: ${user.username} (${user.id})`);
        usersManager.delete(user.id);
        continue;
      }

      const isInRoom = room.members.find(member => member.id === user.id);
      if (!isInRoom) {
        console.log(`Removing user not in room member list: ${user.username} (${user.id})`);
        usersManager.delete(user.id);
      }
    }
  }

  cleanupInactiveUsers(): number {
    const inactiveUsers = usersManager.getInactiveUsers(INACTIVE_USER_TIMEOUT);

    for (const user of inactiveUsers) {
      usersManager.removeUserFromRoom(user.id);
    }

    return inactiveUsers.length;
  }

  cleanupEmptyRooms(): number {
    const emptyRooms = roomsManager.getEmptyRooms();

    for (const room of emptyRooms) {
      if (room.gameState.isActive) {
        gameManager.stopGame(room.id);
      }
      roomsManager.delete(room.id);
    }

    return emptyRooms.length;
  }

  getCleanupStats(): {
    totalUsers: number;
    totalRooms: number;
    activeRooms: number;
    emptyRooms: number;
    inactiveUsers: number;
    nextCleanup: number;
  } {
    return {
      totalUsers: usersManager.getLength(),
      totalRooms: roomsManager.rooms.size,
      activeRooms: roomsManager.getActiveRooms().length,
      emptyRooms: roomsManager.getEmptyRooms().length,
      inactiveUsers: usersManager.getInactiveUsers(INACTIVE_USER_TIMEOUT).length,
      nextCleanup: this.intervalId ? CLEANUP_INTERVAL : 0,
    };
  }
}

export const cleanupService = new CleanupService();

export const startCleanupInterval = (): void => {
  cleanupService.start();
};

export const stopCleanupInterval = (): void => {
  cleanupService.stop();
};