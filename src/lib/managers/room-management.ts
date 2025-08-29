import { nanoid } from "nanoid";
import { Room, User, GameState, RoomSettings } from "../../types/entities";
import { getDifficultySettings } from "../game-logic/main";

class RoomManager {
  public rooms = new Map<string, Room>();
  private scheduledDeletions = new Map<string, NodeJS.Timeout>();

  create(
    roomId: string,
    host: User,
    settings: RoomSettings,
  ): Room {
    const difficultySettings = getDifficultySettings(settings?.difficulty);

    const gameState: GameState = {
      isActive: false,
      phase: "waiting",
      currentQuestion: null,
      answers: [],
      answerHistory: [],
      currentQuestionIndex: 0,
      totalQuestions: difficultySettings.count,
      difficulty: settings?.difficulty,
      gameStartTime: null,
      gameEndTime: null,
      usedCountries: new Set(),
      questionTimer: null,
      resultTimer: null,
      leaderboard: [],
    };

    const room: Room = {
      id: roomId,
      name: "",
      host: host.id,
      inviteCode: nanoid(6).toUpperCase(),
      gameState,
      members: [host],
      created: new Date().toISOString(),
      settings: {
        ...{
          questionCount: difficultySettings.count,
          //allowSpectators: true,
          showLeaderboard: false,
        },
        ...settings,
      },
    };

    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): Room | null {
    return this.get(roomId) || null;
  }

  private get(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }
  
  getRoomByInviteCode(inviteCode: string): Room | undefined {
    return Array.from(this.rooms.values()).find(
      (room) => room.inviteCode === inviteCode
    );
  }

  has(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  set(roomId: string, room: Room): void {
    this.rooms.set(roomId, room);
  }

  delete(roomId: string): boolean {
    this.cancelScheduledDeletion(roomId);
    return this.rooms.delete(roomId);
  }

  scheduleDeletion(roomId: string, delayMs: number = 30 * 60 * 1000): void {
    this.cancelScheduledDeletion(roomId);

    const timeoutId = setTimeout(() => {
      this.rooms.delete(roomId);
      this.scheduledDeletions.delete(roomId);
    }, delayMs);

    this.scheduledDeletions.set(roomId, timeoutId);
  }

  cancelScheduledDeletion(roomId: string): void {
    const timeoutId = this.scheduledDeletions.get(roomId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.scheduledDeletions.delete(roomId);
    }
  }

  isScheduledForDeletion(roomId: string): boolean {
    return this.scheduledDeletions.has(roomId);
  }

  getScheduledDeletionCount(): number {
    return this.scheduledDeletions.size;
  }

  update(roomId: string, updates: Partial<Room>): Room | null {
    const room = this.get(roomId);
    if (!room) return null;

    const updatedRoom = { ...room, ...updates };
    this.set(roomId, { ...room, ...updates });
    return updatedRoom;
  }

  addUserToRoom(roomId: string, user: User): Room | null {
    const room = this.get(roomId);
    if (!room) return null;

    if (room.members.length >= room.settings.maxRoomSize) {
      return null;
    }

    const existingUser = room.members.find((member) => member.id === user.id);
    if (existingUser) {
      return room;
    }

    const updatedMembers = [...room.members, user];
    return this.update(roomId, { members: updatedMembers });
  }

  removeUserFromRoom(roomId: string, userId: string): Room | null {
    const room = this.get(roomId);
    if (!room) return null;

    const updatedMembers = room.members.filter(
      (member) => member.id !== userId
    );

    return this.update(roomId, { members: updatedMembers });
  }

  setNewHost(roomId: string, newHostId: string): Room | null {
    const room = this.get(roomId);
    if (!room) return null;

    const newHost = room.members.find((member) => member.id === newHostId);
    if (!newHost) return null;

    return this.update(roomId, { host: newHostId });
  }

  updateGameState(
    roomId: string,
    gameStateUpdates: Partial<GameState>
  ): Room | null {
    const room = this.get(roomId);
    if (!room) return null;

    const updatedGameState = { ...room.gameState, ...gameStateUpdates };
    return this.update(roomId, { gameState: updatedGameState });
  }

  updateRoomSettings(
    roomId: string,
    settingsUpdates: Partial<Room["settings"]>
  ): Room | null {
    const room = this.get(roomId);
    if (!room) return null;

    const updatedSettings = { ...room.settings, ...settingsUpdates };
    return this.update(roomId, { settings: updatedSettings });
  }

  getActiveRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(
      (room) => room.members.length > 0
    );
  }

  getEmptyRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(
      (room) => room.members.length === 0
    );
  }

  getRoomsOlderThan(minutes: number): Room[] {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    return Array.from(this.rooms.values()).filter((room) => {
      const roomCreated = new Date(room.created);
      return roomCreated < cutoffTime && room.members.length === 0;
    });
  }
}

export const roomsManager = new RoomManager();

// TODO: Room should not last for over an hour