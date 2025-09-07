import { generateQuestion, getDifficultySettings } from "../game-logic/main";
import { roomsManager } from "./room-management";
import { usersManager } from "./user-management";
import {
  GameQuestion,
  GameStateLeaderboard,
  Room,
  GameAnswer,
  GameState,
  QuestionResultsData,
} from "../../types/entities";
import { WS_MESSAGE_TYPES } from "../constants/ws-message-types";
import { CORRECT_POINT_COST } from "../constants/game-constants";

class GameManager {
  private questionTimers = new Map<string, Timer>();
  private resultTimers = new Map<string, Timer>();

  private resetGameState(roomId: string): void {
    const room = roomsManager.getRoom(roomId);
    if (!room) return;

    this.clearTimers(roomId);

    const gameState: GameState = {
      isActive: true,
      phase: "starting",
      currentQuestion: null,
      answers: [],
      answerHistory: [],
      currentQuestionIndex: 0,
      totalQuestions: getDifficultySettings(room.settings.difficulty).count,
      difficulty: room.settings.difficulty,
      gameStartTime: Date.now(),
      gameEndTime: null,
      usedCountries: new Set(),
      questionTimer: null,
      resultTimer: null,
      leaderboard: [],
    };

    roomsManager.updateGameState(roomId, gameState);

    roomsManager.update(roomId, {
      members: room.members.map((member) => ({
        ...member,
        hasAnswered: false,
        score: 0
      })),
    });
  }

  async startGame(roomId: string, userId: string): Promise<boolean> {
    const room = roomsManager.getRoom(roomId);
    if (!room) return false;

    if (room.host !== userId) return false;
    if (room.gameState.isActive) return false;
    if (room.members.length < 2) return false;

    this.resetGameState(roomId);

    this.broadcastToRoom(roomId, {
      type: WS_MESSAGE_TYPES.GAME_STARTING,
      data: { countdown: 5 },
    });

    setTimeout(() => {
      this.nextQuestion(roomId);
    }, 5000);

    return true;
  }

  async nextQuestion(roomId: string): Promise<void> {
    const room = roomsManager.getRoom(roomId);
    if (!room || !room.gameState.isActive) return;

    const { gameState } = room;

    if (gameState.currentQuestionIndex >= gameState.totalQuestions) {
      this.endGame(roomId);
      return;
    }

    this.clearTimers(roomId);

    const questionData = generateQuestion(
      gameState.difficulty,
      gameState.usedCountries
    );

    if (!questionData) {
      this.endGame(roomId);
      return;
    }

    gameState.usedCountries.add(questionData.currentCountry.code);

    const question: GameQuestion = {
      index: gameState.currentQuestionIndex + 1,
      country: questionData.currentCountry,
      options: questionData.options,
      correctAnswer: questionData.currentCountry.code,
      startTime: Date.now(),
      endTime: Date.now() + room.settings.timePerQuestion * 1000,
    };

    roomsManager.updateGameState(roomId, {
      phase: "question",
      currentQuestion: question,
      answers: [],
      currentQuestionIndex: gameState.currentQuestionIndex + 1,
    });

    this.broadcastToRoom(roomId, {
      type: WS_MESSAGE_TYPES.NEW_QUESTION,
      data: {
        question: question,
        totalQuestions: gameState.totalQuestions,
      },
    });

    const timer = setTimeout(() => {
      this.endQuestion(roomId);
    }, room.settings.timePerQuestion * 1000);

    this.questionTimers.set(roomId, timer);
  }

  async submitAnswer(
    roomId: string,
    userId: string,
    answer: string
  ): Promise<void> {
    const room = roomsManager.getRoom(roomId);
    const user = usersManager.getUser(userId);

    if (!room || !user || !room.gameState.currentQuestion) return;
    if (room.gameState.phase !== "question") return;

    const existingAnswer = room.gameState.answers.find(
      (answer) => answer.userId === userId
    );
    if (existingAnswer) return;

    const currentTime = Date.now();
    const question = room.gameState.currentQuestion;
    const timeToAnswer = currentTime - question.startTime;
    const isCorrect = answer === question.correctAnswer;

    let pointsAwarded = 0;
    if (isCorrect) {
      pointsAwarded = CORRECT_POINT_COST;
    }

    const gameAnswer: GameAnswer = {
      userId,
      username: user.username,
      answer,
      timeToAnswer,
      isCorrect,
      pointsAwarded,
      timestamp: currentTime,
    };

    const updatedAnswers = [...room.gameState.answers, gameAnswer];
    const updatedHistory = [...room.gameState.answerHistory, gameAnswer];
    const updatedLeaderboard = this.computeLeaderboardFromHistory(room, updatedHistory);
    roomsManager.updateGameState(roomId, {
      answers: updatedAnswers,
      answerHistory: updatedHistory,
      leaderboard: updatedLeaderboard,
    });

    const userScore = updatedHistory
      .filter((a) => a.userId === userId)
      .reduce((sum, a) => sum + a.pointsAwarded, 0);

    this.broadcastToRoom(roomId, {
      type: WS_MESSAGE_TYPES.ANSWER_SUBMITTED,
      data: {
        userId,
        username: user.username,
        hasAnswered: true,
        totalAnswers: updatedAnswers.length,
        totalPlayers: room.members.length,
        pointsAwarded,
        score: userScore,
      },
    });

    if (updatedAnswers.length === room.members.length) {
      this.endQuestion(roomId);
    }
  }

  private endQuestion(roomId: string): void {
    const room = roomsManager.getRoom(roomId);
    if (!room || !room.gameState.currentQuestion) return;

    this.clearTimers(roomId);

    const cachedLeaderboard = this.computeLeaderboardFromHistory(room);
    roomsManager.updateGameState(roomId, {
      phase: "results",
      leaderboard: cachedLeaderboard,
    });

    const resultsData = this.generateResultsData(room, cachedLeaderboard);

    this.broadcastToRoom(roomId, {
      type: WS_MESSAGE_TYPES.QUESTION_RESULTS,
      data: resultsData,
    });

    const timer = setTimeout(() => {
      this.nextQuestion(roomId);
    }, 3000);

    this.resultTimers.set(roomId, timer);
  }

  private endGame(roomId: string): void {
    const room = roomsManager.getRoom(roomId);
    if (!room) return;

    this.clearTimers(roomId);

    const finalLeaderboard = this.generateFinalLeaderboard(room);

    const endTime = Date.now();
    const updatedRoom = roomsManager.updateGameState(roomId, {
      phase: "finished",
      isActive: false,
      gameEndTime: endTime,
      leaderboard: finalLeaderboard,
    });

    const roomAfterUpdate = roomsManager.getRoom(roomId) || updatedRoom || room;
    roomsManager.update(roomId, {
      members: roomAfterUpdate.members.map((member) => {
        const entry = finalLeaderboard.find((e) => e.userId === member.id);
        return entry ? { ...member, score: entry.score, hasAnswered: false } : { ...member, hasAnswered: false };
      }),
    });

    this.broadcastToRoom(roomId, {
      type: WS_MESSAGE_TYPES.GAME_ENDED,
      data: {
        leaderboard: finalLeaderboard,
        gameStats: this.generateGameStats(updatedRoom || room),
      },
    });
  }

  private generateResultsData(
    room: Room,
    leaderboard: GameStateLeaderboard[]
  ): QuestionResultsData {
    const question = room.gameState.currentQuestion!;
    const answers = room.gameState.answers;

    return {
      correctAnswer: question.correctAnswer,
      correctCountry: question.country,
      playerAnswers: answers,
      leaderboard,
    };
  }

  private generateFinalLeaderboard(room: Room) {
    return room.gameState.leaderboard;
  }

  private computeLeaderboardFromHistory(
    room: Room,
    answerHistory: GameAnswer[] = room.gameState.answerHistory
  ): GameStateLeaderboard[] {
    const stats = new Map<string, { score: number; correct: number; timeSum: number; count: number }>();

    for (const answer of answerHistory) {
      const userStat = stats.get(answer.userId) || { score: 0, correct: 0, timeSum: 0, count: 0 };
      userStat.score += answer.pointsAwarded;
      if (answer.isCorrect) userStat.correct += 1;
      userStat.timeSum += answer.timeToAnswer;
      userStat.count += 1;
      stats.set(answer.userId, userStat);
    }

    const leaderboard: GameStateLeaderboard[] = room.members.map((member) => {
      const name = member.username;
      const userStat = stats.get(member.id);
      if (!userStat) {
        return { userId: member.id, username: name, score: 0, correctAnswers: 0, averageTime: 0 };
      }
      return {
        userId: member.id,
        username: name,
        score: userStat.score,
        correctAnswers: userStat.correct,
        averageTime: userStat.count ? userStat.timeSum / userStat.count : 0,
      };
    });

    return leaderboard.sort((a, b) => b.score - a.score);
  }

  private generateGameStats(room: Room) {
    const { gameState } = room;
    const totalAnswers = gameState.answerHistory.length;
    const correctAnswers = gameState.answerHistory.filter((answer) => answer.isCorrect).length;

    return {
      totalQuestions: gameState.totalQuestions,
      totalAnswers,
      correctAnswers,
      accuracy: totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0,
      averageTime:
        totalAnswers > 0
          ? gameState.answerHistory.reduce((accumulatedTimeMs, answer) => accumulatedTimeMs + answer.timeToAnswer, 0) /
          totalAnswers
          : 0,
      difficulty: gameState.difficulty,
      duration: gameState.gameEndTime! - gameState.gameStartTime!,
    };
  }



  private clearTimers(roomId: string): void {
    const questionTimer = this.questionTimers.get(roomId);
    const resultTimer = this.resultTimers.get(roomId);

    if (questionTimer) {
      clearTimeout(questionTimer);
      this.questionTimers.delete(roomId);
    }

    if (resultTimer) {
      clearTimeout(resultTimer);
      this.resultTimers.delete(roomId);
    }
  }

  getActiveGames(): string[] {
    return Array.from(roomsManager.rooms.values())
      .filter((room) => room.gameState.isActive)
      .map((room) => room.id);
  }

  async restartGame(roomId: string, userId: string): Promise<boolean> {
    const room = roomsManager.getRoom(roomId);
    if (!room) return false;

    if (room.host !== userId) return false;
    if (room.members.length < 2) return false;

    if (room.gameState.isActive && room.gameState.phase !== "finished") return false;

    this.resetGameState(roomId);

    this.broadcastToRoom(roomId, {
      type: WS_MESSAGE_TYPES.GAME_RESTARTED,
      data: { countdown: 5 },
    });

    setTimeout(() => {
      this.nextQuestion(roomId);
    }, 5000);

    return true;
  }

  stopGame(roomId: string): boolean {
    const room = roomsManager.getRoom(roomId);
    if (!room) return false;

    this.clearTimers(roomId);

    roomsManager.updateGameState(roomId, {
      isActive: false,
      phase: "waiting",
      currentQuestion: null,
      gameEndTime: Date.now(),
    });

    this.broadcastToRoom(roomId, {
      type: WS_MESSAGE_TYPES.GAME_STOPPED,
      data: { timestamp: Date.now() },
    });

    return true;
  }

  private async broadcastToRoom(roomId: string, message: any): Promise<void> {
    const { webSocketManager } = await import("./websocket-management.js");
    webSocketManager.broadcastToRoom(roomId, message);
  }
}

export const gameManager = new GameManager();
