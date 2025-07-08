import { CustomWebSocket, User } from "../../types/multiplayer";
import { roomsManager } from "./room-management";

const generateUserColor = (): string => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2',
    '#AED6F1', '#A9DFBF', '#F9E79F', '#F8BBD9', '#D5A6BD',
    '#85C1E9', '#F7DC6F', '#BB8FCE', '#98D8C8', '#FFEAA7'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};
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
      color: generateUserColor(),
      isAdmin: params.isAdmin || false,
      score: 0,
      isReady: false,
      lastActiveTime: new Date().toISOString(),
    };

    this.users.set(user.id, user);
    return user;
  }

  get(userId: string): User | undefined {
    return this.users.get(userId);
  }

  has(userId: string): boolean {
    return this.users.has(userId);
  }

  set(userId: string, user: User): void {
    this.users.set(userId, user);
  }

  delete(userId: string): boolean {
    this.userConnections.delete(userId);
    return this.users.delete(userId);
  }

  setUsers(users: Map<string, User>): void {
    this.users = users;
  }

  getLength(): number {
    return this.users.size;
  }

  updateUser(userId: string, updates: Partial<User>): User | null {
    const user = this.get(userId);
    if (!user) return null;

    const updatedUser = { ...user, ...updates };
    this.set(userId, updatedUser);
    return updatedUser;
  }

  updateUserScore(userId: string, points: number): User | null {
    const user = this.get(userId);
    if (!user) return null;

    const updatedUser = { ...user, score: user.score + points };
    this.set(userId, updatedUser);
    return updatedUser;
  }

  setUserReady(userId: string, isReady: boolean): User | null {
    const user = this.get(userId);
    if (!user) return null;

    const updatedUser = { ...user, isReady };
    this.set(userId, updatedUser);
    return updatedUser;
  }

  resetUserScore(userId: string): User | null {
    const user = this.get(userId);
    if (!user) return null;

    const updatedUser = { ...user, score: 0 };
    this.set(userId, updatedUser);
    return updatedUser;
  }

  resetAllUsersInRoom(roomId: string): void {
    const users = this.getUsersByRoom(roomId);
    users.forEach((user) => {
      this.updateUser(user.id, {
        score: 0,
        isReady: false,
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
    const user = this.get(userId);
    if (user) {
      roomsManager.removeUserFromRoom(user.roomId, userId);
      this.delete(userId);
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

  getUserLeaderboard(roomId: string): Array<{
    userId: string;
    username: string;
    score: number;
    color: string;
  }> {
    const users = this.getUsersByRoom(roomId);
    return users
      .map((user) => ({
        userId: user.id,
        username: user.username,
        score: user.score,
        color: user.color,
      }))
      .sort((a, b) => b.score - a.score);
  }

  getReadyUsers(roomId: string): User[] {
    return this.getUsersByRoom(roomId).filter((user) => user.isReady);
  }

  areAllUsersReady(roomId: string): boolean {
    const users = this.getUsersByRoom(roomId);
    return users.length > 0 && users.every((user) => user.isReady);
  }

  getUserStats(userId: string): any {
    const user = this.get(userId);
    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      score: user.score,
      isReady: user.isReady,
      color: user.color,
      created: user.created,
      lastActive: user.lastActiveTime,
    };
  }

  banUser(userId: string, reason?: string): boolean {
    const user = this.get(userId);
    if (!user) return false;

    // TODO: Store banned users
    // For now, we'll just remove them
    this.removeUserFromRoom(userId);
    return true;
  }

  changeUserColor(userId: string, color?: string): User | null {
    const user = this.get(userId);
    if (!user) return null;

    const newColor = color || generateUserColor();
    return this.updateUser(userId, { color: newColor });
  }

  getUsersWithAnswers(roomId: string): User[] {
    return this.getUsersByRoom(roomId).filter(
      (user) => user.currentAnswer !== undefined
    );
  }

  clearUserAnswers(roomId: string): void {
    const users = this.getUsersByRoom(roomId);
    users.forEach((user) => {
      this.updateUser(user.id, {
        currentAnswer: undefined,
        answerTime: undefined,
      });
    });
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
  const user = usersManager.get(userId);
  return user?.isAdmin === true;
};

export const usersManager = new UserManager();
