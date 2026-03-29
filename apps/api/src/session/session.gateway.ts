import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { SessionService } from './session.service.js';

interface SocketData {
  userId: string;
  username: string;
  sessionId: string;
  roomCode: string;
}

interface SessionTimer {
  timeout: ReturnType<typeof setTimeout>;
  endsAt: number;
  phase: 'question' | 'results';
}

@WebSocketGateway({
  namespace: '/session',
  cors: {
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class SessionGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(SessionGateway.name);

  @WebSocketServer()
  server!: Server;

  private static readonly PUBLIC_ROOMS_CHANNEL = 'public-rooms';
  private static readonly RESULTS_DISPLAY_MS = 5000;

  private readonly sessionTimers = new Map<string, SessionTimer>();

  constructor(private readonly sessionService: SessionService) {}

  private clearSessionTimer(sessionId: string) {
    const existing = this.sessionTimers.get(sessionId);

    if (existing) {
      clearTimeout(existing.timeout);
      this.sessionTimers.delete(sessionId);
    }
  }

  private startQuestionTimer(sessionId: string, roomCode: string, seconds: number) {
    this.clearSessionTimer(sessionId);

    const timeout = setTimeout(() => {
      void this.onQuestionTimeUp(sessionId, roomCode);
    }, seconds * 1000);

    this.sessionTimers.set(sessionId, {
      timeout,
      endsAt: Date.now() + seconds * 1000,
      phase: 'question',
    });
  }

  private startResultsTimer(sessionId: string, roomCode: string) {
    this.clearSessionTimer(sessionId);

    const ms = SessionGateway.RESULTS_DISPLAY_MS;

    const timeout = setTimeout(() => {
      void this.onResultsTimeUp(sessionId, roomCode);
    }, ms);

    this.sessionTimers.set(sessionId, {
      timeout,
      endsAt: Date.now() + ms,
      phase: 'results',
    });
  }

  private async onQuestionTimeUp(sessionId: string, roomCode: string) {
    try {
      const session = await this.sessionService.findById(sessionId);

      if (session.status !== 'IN_PROGRESS') {
        return;
      }

      const question = session.quiz.questions[session.currentQuestionIndex];

      if (question) {
        this.server.to(roomCode).emit('question-results', {
          questionId: question.id,
          correctOptionIds: question.options.filter((o) => o.isCorrect).map((o) => o.id),
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      const leaderboard = await this.sessionService.getLeaderboard(sessionId);

      this.server.to(roomCode).emit('leaderboard-update', {
        leaderboard: leaderboard.map((p) => ({
          userId: p.user.id,
          username: p.user.username,
          avatar: p.user.avatar,
          score: p.score,
        })),
      });

      this.startResultsTimer(sessionId, roomCode);
    } catch (err) {
      this.logger.error('onQuestionTimeUp error', err);
    }
  }

  private async onResultsTimeUp(sessionId: string, roomCode: string) {
    try {
      const updated = await this.sessionService.advanceQuestion(sessionId);

      if (updated.status === 'FINISHED') {
        this.clearSessionTimer(sessionId);

        const leaderboard = await this.sessionService.getLeaderboard(sessionId);

        this.server.to(roomCode).emit('quiz-finished', {
          leaderboard: leaderboard.map((p) => ({
            userId: p.user.id,
            username: p.user.username,
            avatar: p.user.avatar,
            score: p.score,
          })),
        });

        return;
      }

      const question = await this.sessionService.getQuestionForParticipant(sessionId);

      if (question) {
        this.server.to(roomCode).emit('new-question', { question });
        this.startQuestionTimer(sessionId, roomCode, question.timeLimitSeconds);
      }
    } catch (err) {
      this.logger.error('onResultsTimeUp error', err);
    }
  }

  getRemainingSeconds(sessionId: string): number {
    const timer = this.sessionTimers.get(sessionId);

    if (!timer) {
      return 0;
    }

    return Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
  }

  getTimerPhase(sessionId: string): 'question' | 'results' | null {
    return this.sessionTimers.get(sessionId)?.phase ?? null;
  }

  private async broadcastPublicRooms() {
    try {
      const rooms = await this.sessionService.getPublicSessions();

      this.server.to(SessionGateway.PUBLIC_ROOMS_CHANNEL).emit('public-rooms-updated', { rooms });
    } catch {
      // ignore
    }
  }

  @SubscribeMessage('watch-public-rooms')
  async handleWatchPublicRooms(@ConnectedSocket() client: Socket) {
    await client.join(SessionGateway.PUBLIC_ROOMS_CHANNEL);

    const rooms = await this.sessionService.getPublicSessions();

    client.emit('public-rooms-updated', { rooms });
  }

  @SubscribeMessage('unwatch-public-rooms')
  async handleUnwatchPublicRooms(@ConnectedSocket() client: Socket) {
    await client.leave(SessionGateway.PUBLIC_ROOMS_CHANNEL);
  }

  async handleDisconnect(client: Socket) {
    const data = client.data as Partial<SocketData>;

    if (!data.roomCode || !data.sessionId || !data.userId) {
      return;
    }

    this.logger.debug(`Client disconnected: ${client.id} (user ${data.userId})`);

    try {
      const session = await this.sessionService.findById(data.sessionId);
      const isHost = session.quiz.createdById === data.userId;

      if (isHost) {
        return;
      }

      if (session.status === 'LOBBY') {
        await this.sessionService.removeParticipant(data.sessionId, data.userId);
      }

      const participants = await this.sessionService.getParticipants(data.sessionId);

      this.server.to(data.roomCode).emit('participant-joined', {
        participants: participants.map((p) => ({
          userId: p.user.id,
          username: p.user.username,
          avatar: p.user.avatar,
          score: p.score,
        })),
      });

      void this.broadcastPublicRooms();
    } catch (err) {
      this.logger.error('handleDisconnect error', err);
    }
  }

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomCode: string; userId: string; username: string },
  ) {
    try {
      const session = await this.sessionService.joinSession(body.roomCode, body.userId);

      const socketData: SocketData = {
        userId: body.userId,
        username: body.username,
        sessionId: session.id,
        roomCode: session.roomCode,
      };

      client.data = socketData;

      await client.join(session.roomCode);

      client.emit('join-success', {
        session: {
          id: session.id,
          roomCode: session.roomCode,
          status: session.status,
          quizTitle: session.quiz.title,
          quizDescription: session.quiz.description,
          totalQuestions: session.quiz.questions.length,
          isPublic: session.isPublic,
          maxParticipants: session.maxParticipants,
          host: session.quiz.createdBy,
        },
        participants: session.participants.map((p) => ({
          userId: p.user.id,
          username: p.user.username,
          avatar: p.user.avatar,
          score: p.score,
        })),
      });

      this.server.to(session.roomCode).emit('participant-joined', {
        participants: session.participants.map((p) => ({
          userId: p.user.id,
          username: p.user.username,
          avatar: p.user.avatar,
          score: p.score,
        })),
      });

      void this.broadcastPublicRooms();
    } catch (err) {
      client.emit('join-error', { error: err instanceof Error ? err.message : 'Ошибка' });
    }
  }

  @SubscribeMessage('host-join')
  async handleHostJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomCode: string; userId: string },
  ) {
    try {
      const session = await this.sessionService.findByCode(body.roomCode);

      if (session.quiz.createdById !== body.userId) {
        client.emit('host-join-error', { error: 'Вы не организатор этого квиза' });

        return;
      }

      const socketData: SocketData = {
        userId: body.userId,
        username: 'host',
        sessionId: session.id,
        roomCode: session.roomCode,
      };

      client.data = socketData;

      await client.join(session.roomCode);

      const participants = session.participants.map((p) => ({
        userId: p.user.id,
        username: p.user.username,
        avatar: p.user.avatar,
        score: p.score,
      }));

      let question = null;
      let leaderboard: typeof participants = [];
      const timerPhase = this.getTimerPhase(session.id);
      const remainingSeconds = this.getRemainingSeconds(session.id);

      if (session.status === 'IN_PROGRESS') {
        question = await this.sessionService.getQuestionForParticipant(session.id);

        const lb = await this.sessionService.getLeaderboard(session.id);

        leaderboard = lb.map((p) => ({
          userId: p.user.id,
          username: p.user.username,
          avatar: p.user.avatar,
          score: p.score,
        }));
      }

      if (session.status === 'FINISHED') {
        const lb = await this.sessionService.getLeaderboard(session.id);

        leaderboard = lb.map((p) => ({
          userId: p.user.id,
          username: p.user.username,
          avatar: p.user.avatar,
          score: p.score,
        }));
      }

      client.emit('host-join-success', {
        session: {
          id: session.id,
          roomCode: session.roomCode,
          status: session.status,
          currentQuestionIndex: session.currentQuestionIndex,
          isPublic: session.isPublic,
          maxParticipants: session.maxParticipants,
        },
        participants,
        question,
        leaderboard,
        timerPhase,
        remainingSeconds,
      });
    } catch (err) {
      client.emit('host-join-error', { error: err instanceof Error ? err.message : 'Ошибка' });
    }
  }

  @SubscribeMessage('start-quiz')
  async handleStartQuiz(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId: string; userId: string },
  ) {
    try {
      await this.sessionService.startSession(body.sessionId, body.userId);

      const question = await this.sessionService.getQuestionForParticipant(body.sessionId);
      const data = client.data as SocketData;

      this.server.to(data.roomCode).emit('quiz-started', { question });

      if (question) {
        this.startQuestionTimer(body.sessionId, data.roomCode, question.timeLimitSeconds);
      }

      void this.broadcastPublicRooms();
    } catch (err) {
      client.emit('error', { error: err instanceof Error ? err.message : 'Ошибка' });
    }
  }

  @SubscribeMessage('next-question')
  async handleNextQuestion(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId: string; userId: string },
  ) {
    try {
      const data = client.data as SocketData;

      this.clearSessionTimer(body.sessionId);
      await this.onResultsTimeUp(body.sessionId, data.roomCode);
    } catch (err) {
      client.emit('error', { error: err instanceof Error ? err.message : 'Ошибка' });
    }
  }

  @SubscribeMessage('submit-answer')
  async handleSubmitAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: { sessionId: string; userId: string; questionId: string; optionIds: string[] },
  ) {
    try {
      const result = await this.sessionService.submitAnswer(
        body.sessionId,
        body.userId,
        body.questionId,
        body.optionIds,
      );

      client.emit('answer-result', result);

      const data = client.data as SocketData;

      this.server.to(data.roomCode).emit('answer-submitted', {
        userId: body.userId,
      });
    } catch (err) {
      client.emit('answer-result', {
        isCorrect: false,
        points: 0,
        error: err instanceof Error ? err.message : 'Ошибка',
      });
    }
  }

  @SubscribeMessage('update-session-settings')
  async handleUpdateSettings(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      sessionId: string;
      userId: string;
      isPublic?: boolean;
      maxParticipants?: number | null;
    },
  ) {
    try {
      await this.sessionService.updateSessionSettings(body.sessionId, body.userId, {
        isPublic: body.isPublic,
        maxParticipants: body.maxParticipants,
      });

      const data = client.data as SocketData;

      this.server.to(data.roomCode).emit('session-settings-updated', {
        isPublic: body.isPublic,
        maxParticipants: body.maxParticipants,
      });

      void this.broadcastPublicRooms();
    } catch (err) {
      client.emit('error', { error: err instanceof Error ? err.message : 'Ошибка' });
    }
  }

  @SubscribeMessage('regenerate-code')
  async handleRegenerateCode(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId: string; userId: string },
  ) {
    try {
      const oldData = client.data as SocketData;
      const oldRoom = oldData.roomCode;

      const { roomCode: newCode } = await this.sessionService.regenerateRoomCode(
        body.sessionId,
        body.userId,
      );

      const sockets = await this.server.in(oldRoom).fetchSockets();

      for (const s of sockets) {
        void s.leave(oldRoom);
        void s.join(newCode);

        const sd = s.data as SocketData;

        sd.roomCode = newCode;
      }

      this.server.to(newCode).emit('room-code-changed', {
        roomCode: newCode,
      });

      void this.broadcastPublicRooms();
    } catch (err) {
      client.emit('error', { error: err instanceof Error ? err.message : 'Ошибка' });
    }
  }

  @SubscribeMessage('kick-participant')
  async handleKickParticipant(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId: string; userId: string; targetUserId: string },
  ) {
    try {
      const session = await this.sessionService.findById(body.sessionId);

      if (session.quiz.createdById !== body.userId) {
        return;
      }

      await this.sessionService.removeParticipant(body.sessionId, body.targetUserId);

      const data = client.data as SocketData;

      const sockets = await this.server.in(data.roomCode).fetchSockets();

      for (const s of sockets) {
        const sd = s.data as Partial<SocketData>;

        if (sd.userId === body.targetUserId) {
          void s.leave(data.roomCode);
        }
      }

      const targetSocket = sockets.find(
        (s) => (s.data as Partial<SocketData>).userId === body.targetUserId,
      );

      if (targetSocket) {
        targetSocket.emit('kicked', { reason: 'Организатор исключил вас из квиза' });
      }

      const participants = await this.sessionService.getParticipants(body.sessionId);

      this.server.to(data.roomCode).emit('participant-joined', {
        participants: participants.map((p) => ({
          userId: p.user.id,
          username: p.user.username,
          avatar: p.user.avatar,
          score: p.score,
        })),
      });

      void this.broadcastPublicRooms();
    } catch (err) {
      this.logger.error('kick-participant error', err);
    }
  }

  @SubscribeMessage('cancel-session')
  async handleCancelSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId: string; userId: string },
  ) {
    try {
      const session = await this.sessionService.findById(body.sessionId);

      if (session.quiz.createdById !== body.userId) {
        return;
      }

      await this.sessionService.deleteSession(body.sessionId, body.userId);

      this.clearSessionTimer(body.sessionId);

      const data = client.data as SocketData;

      this.server.to(data.roomCode).emit('session-cancelled', {
        reason: 'Организатор завершил сессию',
      });

      void this.broadcastPublicRooms();
    } catch (err) {
      this.logger.error('cancel-session error', err);
    }
  }

  @SubscribeMessage('add-time')
  handleAddTime(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId: string; userId: string; seconds: number },
  ) {
    const data = client.data as SocketData;
    const clamped = body.seconds > 0 ? Math.min(body.seconds, 60) : Math.max(body.seconds, -60);

    const timer = this.sessionTimers.get(body.sessionId);

    if (timer && timer.phase === 'question') {
      const remaining = Math.max(0, timer.endsAt - Date.now());
      const newMs = Math.max(0, remaining + clamped * 1000);

      clearTimeout(timer.timeout);

      timer.endsAt = Date.now() + newMs;
      timer.timeout = setTimeout(() => {
        void this.onQuestionTimeUp(body.sessionId, data.roomCode);
      }, newMs);
    }

    this.server.to(data.roomCode).emit('time-added', { seconds: clamped });
  }

  @SubscribeMessage('show-results')
  async handleShowResults(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId: string; userId: string },
  ) {
    try {
      const session = await this.sessionService.findById(body.sessionId);

      if (session.quiz.createdById !== body.userId) {
        return;
      }

      const data = client.data as SocketData;

      this.clearSessionTimer(body.sessionId);
      await this.onQuestionTimeUp(body.sessionId, data.roomCode);
    } catch (err) {
      this.logger.error('show-results error', err);
    }
  }
}
