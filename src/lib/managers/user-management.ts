import { CustomWebSocket, User } from "../../types/entities";
import { roomsManager } from "./room-management";

interface CreateUserParams {
  id: string;
  username: string;
  roomId: string;
  socketId: string;
  isAdmin?: boolean;
}

class UserManager {
  public users = new Map<string, User>();
  private userConnections = new Map<string, CustomWebSocket>();

  createUser(params: CreateUserParams): User {
    const user: User = {
      id: params.id,
      socketId: params.socketId,
      username: params.username,
      roomId: params.roomId,
      created: new Date().toISOString(),
      isAdmin: params.isAdmin || false,
      lastActiveTime: new Date().toISOString(),
    };

    this.users.set(user.id, user);
    return user;
  }

  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  hasUser(userId: string): boolean {
    return this.users.has(userId);
  }

  setUser(userId: string, user: User): void {
    this.users.set(userId, user);
  }

  deleteUser(userId: string): boolean {
    this.userConnections.delete(userId);
    return this.users.delete(userId);
  }

  getUsers(): Map<string, User> {
    return this.users;
  }

  setUsers(users: Map<string, User>): void {
    this.users = users;
  }

  getLength(): number {
    return this.users.size;
  }

  updateUser(userId: string, updates: Partial<User>): User | null {
    const user = this.getUser(userId);
    if (!user) return null;

    const updatedUser = { ...user, ...updates };
    this.setUser(userId, updatedUser);
    return updatedUser;
  }

  getInactiveUsers(minutes: number): User[] {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    return Array.from(this.users.values()).filter((user) => {
      const lastActive = new Date(user.lastActiveTime);
      return lastActive < cutoffTime;
    });
  }

  updateLastActiveTime(userId: string): void {
    this.updateUser(userId, { lastActiveTime: new Date().toISOString() });
  }

  setUserConnection(userId: string, ws: CustomWebSocket): void {
    this.userConnections.set(userId, ws);
  }

  getUserConnection(userId: string): CustomWebSocket | undefined {
    return this.userConnections.get(userId);
  }

  removeUserConnection(userId: string): void {
    this.userConnections.delete(userId);
  }

  kickUser(userId: string): void {
    const user = this.getUser(userId);
    if (user) {
      roomsManager.kickUserFromRoom(user.roomId, userId);
      this.updateUser(userId, { roomId: "" });
    }
  }

  banUser(userId: string, reason?: string): boolean {
    const user = this.getUser(userId);
    if (!user) return false;

    // TODO: Store banned users
    this.kickUser(userId);
    return true;
  }

  isUserAdmin(userId: string): boolean {
    const user = this.getUser(userId);
    return user?.isAdmin === true;
  }

  isUserHost(userId: string, roomId: string): boolean {
    const user = this.getUser(userId);
    const room = roomsManager.getRoom(roomId);
    if (!room || !user) return false;
    return user?.roomId === roomId && user?.id === room?.host;
  }
}

export const usersManager = new UserManager();
