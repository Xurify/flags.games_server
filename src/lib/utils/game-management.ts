import { generateQuestion, getDifficultySettings } from "../game-logic/main";
import { roomsManager } from "./room-management";
import { usersManager } from "./user-management";
import {
  Room,
  GameState,
  GameQuestion,
  GameAnswer,
} from "../../types/entities";
import { WS_MESSAGE_TYPES } from "../constants/ws-message-types";
import { broadcastToRoom } from "../handlers/websockets";
import { QuestionResultsData } from "../schemas/websockets";

class GameManager {
  private questionTimers = new Map<string, Timer>();
  private resultTimers = new Map<string, Timer>();

  async startGame(roomId: string, userId: string): Promise<boolean> {
    const room = roomsManager.get(roomId);
    if (!room) return false;
    
    if (room.host !== userId) return false;
    if (room.gameState.isActive) return false;
    if (room.members.length < 2) return false;

    const gameState: GameState = {
      isActive: true,
      isPaused: false,
      phase: "starting",
      currentQuestion: null,
      answers: [],
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

    room.members.forEach((member) => {
      usersManager.updateUser(member.id, {
        score: 0,

        currentAnswer: undefined,
        answerTime: undefined,
      });
    });

    roomsManager.updateGameState(roomId, gameState);

    broadcastToRoom(roomId, {
      type: WS_MESSAGE_TYPES.GAME_STARTING,
      data: { countdown: 5 },
    });

    setTimeout(() => {
      this.nextQuestion(roomId);
    }, 5000);

    return true;
  }

  async nextQuestion(roomId: string): Promise<void> {
    const room = roomsManager.get(roomId);
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
      questionNumber: gameState.currentQuestionIndex + 1,
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

    broadcastToRoom(roomId, {
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
    const room = roomsManager.get(roomId);
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
      const basePoints = this.getBasePoints(room.settings.difficulty);
      const speedBonus = this.calculateSpeedBonus(
        timeToAnswer,
        room.settings.timePerQuestion
      );
      pointsAwarded = basePoints + speedBonus;
    }

    usersManager.updateUser(userId, {
      score: user.score + pointsAwarded,
      currentAnswer: answer,
      answerTime: timeToAnswer,
    });

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
    roomsManager.updateGameState(roomId, { answers: updatedAnswers });

    broadcastToRoom(roomId, {
      type: WS_MESSAGE_TYPES.ANSWER_SUBMITTED,
      data: {
        userId,
        username: user.username,
        hasAnswered: true,
        totalAnswers: updatedAnswers.length,
        totalPlayers: room.members.length,
      },
    });

    if (updatedAnswers.length === room.members.length) {
      this.endQuestion(roomId);
    }
  }

  private endQuestion(roomId: string): void {
    const room = roomsManager.get(roomId);
    if (!room || !room.gameState.currentQuestion) return;

    this.clearTimers(roomId);

    roomsManager.updateGameState(roomId, { phase: "results" });

    const resultsData = this.generateResultsData(room);

    broadcastToRoom(roomId, {
      type: WS_MESSAGE_TYPES.QUESTION_RESULTS,
      data: resultsData,
    });

    const timer = setTimeout(() => {
      this.nextQuestion(roomId);
    }, 8000);

    this.resultTimers.set(roomId, timer);
  }

  private endGame(roomId: string): void {
    const room = roomsManager.get(roomId);
    if (!room) return;

    this.clearTimers(roomId);

    const finalLeaderboard = this.generateFinalLeaderboard(room);

    roomsManager.updateGameState(roomId, {
      phase: "finished",
      isActive: false,
      gameEndTime: Date.now(),
      leaderboard: finalLeaderboard,
    });

    broadcastToRoom(roomId, {
      type: WS_MESSAGE_TYPES.GAME_ENDED,
      data: {
        leaderboard: finalLeaderboard,
        gameStats: this.generateGameStats(room),
      },
    });
  }

  private generateResultsData(room: Room): QuestionResultsData {
    const question = room.gameState.currentQuestion!;
    const answers = room.gameState.answers;

    return {
      correctAnswer: question.correctAnswer,
      correctCountry: question.country,
      playerAnswers: answers.map((answer) => ({
        userId: answer.userId,
        username: answer.username,
        answer: answer.answer,
        isCorrect: answer.isCorrect,
        timeToAnswer: answer.timeToAnswer,
        pointsAwarded: answer.pointsAwarded,
      })),
      leaderboard: room.members
        .map((member) => {
          const user = usersManager.getUser(member.id);
          return user
            ? {
              userId: user.id,
              username: user.username,
              score: user.score,
            }
            : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => b.score - a.score),
    };
  }

  private generateFinalLeaderboard(room: Room) {
    return room.members
      .map((member) => {
        const user = usersManager.getUser(member.id);
        if (!user) return null;

        const userAnswers = room.gameState.answers.filter(
          (a) => a.userId === user.id
        );
        const correctAnswers = userAnswers.filter((a) => a.isCorrect).length;
        const averageTime =
          userAnswers.length > 0
            ? userAnswers.reduce((sum, a) => sum + a.timeToAnswer, 0) /
            userAnswers.length
            : 0;

        return {
          userId: user.id,
          username: user.username,
          score: user.score,
          correctAnswers,
          averageTime,
        };
      })
      .filter((member) => !!member)
      .sort((a, b) => b!.score - a!.score);
  }

  private generateGameStats(room: Room) {
    const { gameState } = room;
    const totalAnswers = gameState.answers.length;
    const correctAnswers = gameState.answers.filter((a) => a.isCorrect).length;

    return {
      totalQuestions: gameState.totalQuestions,
      totalAnswers,
      correctAnswers,
      accuracy: totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0,
      averageTime:
        totalAnswers > 0
          ? gameState.answers.reduce((sum, a) => sum + a.timeToAnswer, 0) /
          totalAnswers
          : 0,
      difficulty: gameState.difficulty,
      duration: gameState.gameEndTime! - gameState.gameStartTime!,
    };
  }

  private getBasePoints(difficulty: string): number {
    switch (difficulty) {
      case "expert":
        return 1000;
      case "hard":
        return 750;
      case "medium":
        return 500;
      case "easy":
        return 250;
      default:
        return 250;
    }
  }

  private calculateSpeedBonus(timeToAnswer: number, timePerQuestion: number): number {
    const timeInSeconds = timeToAnswer / 1000;
    const speedRatio = 1 - timeInSeconds / timePerQuestion;
    return Math.max(0, Math.floor(speedRatio * 500));
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

  pauseGame(roomId: string): boolean {
    const room = roomsManager.get(roomId);
    if (!room || !room.gameState.isActive) return false;

    this.clearTimers(roomId);
    roomsManager.updateGameState(roomId, { isPaused: true });

    broadcastToRoom(roomId, {
      type: WS_MESSAGE_TYPES.GAME_PAUSED,
      data: { timestamp: Date.now() },
    });

    return true;
  }

  resumeGame(roomId: string): boolean {
    const room = roomsManager.get(roomId);
    if (!room || !room.gameState.isActive || !room.gameState.isPaused)
      return false;

    roomsManager.updateGameState(roomId, { isPaused: false });

    broadcastToRoom(roomId, {
      type: WS_MESSAGE_TYPES.GAME_RESUMED,
      data: { timestamp: Date.now() },
    });

    if (room.gameState.phase === "question" && room.gameState.currentQuestion) {
      const elapsed = Date.now() - room.gameState.currentQuestion.startTime;
      const remaining = room.settings.timePerQuestion * 1000 - elapsed;

      if (remaining > 0) {
        const timer = setTimeout(() => {
          this.endQuestion(roomId);
        }, remaining);
        this.questionTimers.set(roomId, timer);
      } else {
        this.endQuestion(roomId);
      }
    }

    return true;
  }

  getActiveGames(): string[] {
    return Array.from(roomsManager.rooms.values())
      .filter((room) => room.gameState.isActive)
      .map((room) => room.id);
  }

  stopGame(roomId: string): boolean {
    const room = roomsManager.get(roomId);
    if (!room) return false;

    this.clearTimers(roomId);

    roomsManager.updateGameState(roomId, {
      isActive: false,
      isPaused: false,
      phase: "waiting",
      currentQuestion: null,
      gameEndTime: Date.now(),
    });

    broadcastToRoom(roomId, {
      type: WS_MESSAGE_TYPES.GAME_STOPPED,
      data: { timestamp: Date.now() },
    });

    return true;
  }
}

export const gameManager = new GameManager();
