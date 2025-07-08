import { nanoid } from "nanoid";
import { Room, User, GameState } from "../../types/multiplayer";
import { Difficulty } from "../constants";
import { getDifficultySettings } from "../game-logic/main";

class RoomManager {
  public rooms = new Map<string, Room>();

  create(
    roomId: string,
    roomName: string,
    host: User,
    settings: {
      difficulty: Difficulty;
    }
  ): Room {
    const difficultySettings = getDifficultySettings(settings?.difficulty);

    const defaultSettings = {
      difficulty: settings.difficulty as Difficulty,
      questionCount: difficultySettings.count,
      timePerQuestion: 30,
      //allowSpectators: true,
      showLeaderboard: true,
    };

    const gameState: GameState = {
      isActive: false,
      isPaused: false,
      phase: "waiting",
      currentQuestion: null,
      answers: [],
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
      name: roomName,
      host: host.id,
      inviteCode: nanoid(6).toUpperCase(),
      passcode: null,
      gameState,
      members: [host],
      previouslyConnectedMembers: [],
      maxRoomSize: 5,
      created: new Date().toISOString(),
      private: false,
      settings: { ...defaultSettings, ...settings },
    };

    this.rooms.set(roomId, room);
    return room;
  }

  get(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  has(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  set(roomId: string, room: Room): void {
    this.rooms.set(roomId, room);
  }

  delete(roomId: string): boolean {
    return this.rooms.delete(roomId);
  }

  update(roomId: string, updates: Partial<Room>): Room | null {
    const room = this.get(roomId);
    if (!room) return null; 

    const updatedRoom = { ...room, ...updates };
    this.set(roomId, { ...room, ...updates });
    return updatedRoom;
  }

  getRoomByInviteCode(inviteCode: string): Room | undefined {
    return Array.from(this.rooms.values()).find(
      (room) => room.inviteCode === inviteCode
    );
  }

  getRoomById(id: string): Room | undefined {
    return Array.from(this.rooms.values()).find(
      (room) => room.id === id
    );
  }

  getPreviouslyConnectedUser(
    userId: string,
    roomId: string
  ): { userId: string; username: string } | undefined {
    const room = this.get(roomId);
    if (!room) return undefined;

    return room.previouslyConnectedMembers.find(
      (member) => member.userId === userId
    );
  }

  addUserToRoom(roomId: string, user: User): Room | null {
    const room = this.get(roomId);
    if (!room) return null;

    if (room.members.length >= room.maxRoomSize) {
      return null;
    }

    const existingUser = room.members.find((member) => member.id === user.id);
    if (existingUser) {
      return room;
    }

    const updatedMembers = [...room.members, user];
    const updatedRoom = this.update(roomId, { members: updatedMembers });

    const wasConnectedBefore = room.previouslyConnectedMembers.find(
      (member) => member.userId === user.id
    );

    if (!wasConnectedBefore) {
      const updatedPreviouslyConnected = [
        ...room.previouslyConnectedMembers,
        { userId: user.id, username: user.username },
      ];
      return this.update(roomId, {
        previouslyConnectedMembers: updatedPreviouslyConnected,
      });
    }

    return updatedRoom;
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

  setRoomPasscode(roomId: string, passcode: string | null): Room | null {
    const room = this.get(roomId);
    if (!room) return null;

    return this.update(roomId, {
      passcode,
      private: passcode !== null,
    });
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

  getPublicRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(
      (room) =>
        !room.private &&
        room.members.length < room.maxRoomSize &&
        !room.gameState.isActive
    );
  }

  searchRooms(query: string): Room[] {
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.rooms.values()).filter(
      (room) =>
        room.name.toLowerCase().includes(lowercaseQuery) ||
        room.inviteCode.toLowerCase().includes(lowercaseQuery)
    );
  }
}

export const roomsManager = new RoomManager();
