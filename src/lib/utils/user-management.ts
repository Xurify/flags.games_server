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
      score: 0,
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

  updateUserScore(userId: string, points: number): User | null {
    const user = this.getUser(userId);
    if (!user) return null;

    const updatedUser = { ...user, score: user.score + points };
    this.setUser(userId, updatedUser);
    return updatedUser;
  }

  resetUserScore(userId: string): User | null {
    const user = this.getUser(userId);
    if (!user) return null;

    const updatedUser = { ...user, score: 0 };
    this.setUser(userId, updatedUser);
    return updatedUser;
  }

  resetAllUsersInRoom(roomId: string): void {
    const users = this.getUsersByRoom(roomId);
    users.forEach((user) => {
      this.updateUser(user.id, {
        score: 0,
        currentAnswer: undefined,
        answerTime: undefined,
      });
    });
  }

  getUsersByRoom(roomId: string): User[] {
    return Array.from(this.users.values()).filter(
      (user) => user.roomId === roomId
    );
  }

  removeUserFromRoom(userId: string): void {
    const user = this.getUser(userId);
    if (user) {
      roomsManager.removeUserFromRoom(user.roomId, userId);
      this.updateUser(userId, { roomId: "" });
    }
  }

  getInactiveUsers(minutes: number): User[] {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    return Array.from(this.users.values()).filter((user) => {
      const lastActive = new Date(user.lastActiveTime);
      return lastActive < cutoffTime;
    });
  }

  updateUserActivity(userId: string): void {
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

  banUser(userId: string, reason?: string): boolean {
    const user = this.getUser(userId);
    if (!user) return false;

    // TODO: Store banned users
    this.removeUserFromRoom(userId);
    return true;
  }
}

export const requestIsNotFromHost = (
  userId: string,
  roomId: string,
  rooms: Map<string, any>
): boolean => {
  if (!roomId || !userId) return true;

  const room = rooms.get(roomId);
  if (!room) return true;

  return room.host !== userId;
};

export const isUserAdmin = (userId: string): boolean => {
  const user = usersManager.getUser(userId);
  return user?.isAdmin === true;
};

export const usersManager = new UserManager();
