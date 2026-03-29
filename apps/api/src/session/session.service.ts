import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';

  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly sessionInclude = {
    quiz: {
      select: { title: true, description: true, createdById: true },
    },
    participants: {
      include: { user: { select: { id: true, username: true, avatar: true } } },
    },
  } as const;

  async createSession(
    quizId: string,
    userId: string,
    options?: { isPublic?: boolean; maxParticipants?: number | null },
  ) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: true },
    });

    if (!quiz) {
      throw new NotFoundException('Квиз не найден');
    }

    if (quiz.createdById !== userId) {
      throw new ForbiddenException('Только автор может запустить квиз');
    }

    if (quiz.questions.length === 0) {
      throw new BadRequestException('Нельзя запустить квиз без вопросов');
    }

    const active = await this.prisma.quizSession.findFirst({
      where: { quizId, status: { in: ['LOBBY', 'IN_PROGRESS'] } },
      include: this.sessionInclude,
    });

    if (active) {
      return active;
    }

    const sessionCount = await this.prisma.quizSession.count({
      where: { quizId, status: { in: ['LOBBY', 'IN_PROGRESS'] } },
    });

    if (sessionCount >= 10) {
      throw new BadRequestException('Достигнут лимит сессий для этого квиза (максимум 10)');
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.quizSession.findFirst({
            where: { quizId, status: { in: ['LOBBY', 'IN_PROGRESS'] } },
            include: this.sessionInclude,
          });

          if (existing) {
            return existing;
          }

          let roomCode = generateRoomCode();
          let attempts = 0;

          while (attempts < 10) {
            const taken = await tx.quizSession.findUnique({
              where: { roomCode },
            });

            if (!taken) {
              break;
            }

            roomCode = generateRoomCode();
            attempts++;
          }

          return tx.quizSession.create({
            data: {
              quizId,
              roomCode,
              isPublic: options?.isPublic ?? false,
              maxParticipants: options?.maxParticipants ?? null,
            },
            include: this.sessionInclude,
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch {
      const fallback = await this.prisma.quizSession.findFirst({
        where: { quizId, status: { in: ['LOBBY', 'IN_PROGRESS'] } },
        include: this.sessionInclude,
      });

      if (fallback) {
        return fallback;
      }

      throw new BadRequestException('Не удалось создать сессию, попробуйте ещё раз');
    }
  }

  async findByCode(roomCode: string) {
    const session = await this.prisma.quizSession.findUnique({
      where: { roomCode: roomCode.toUpperCase() },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            description: true,
            createdById: true,
            createdBy: {
              select: { id: true, username: true, avatar: true },
            },
            questions: {
              orderBy: { order: 'asc' },
              select: { id: true },
            },
          },
        },
        participants: {
          include: { user: { select: { id: true, username: true, avatar: true } } },
          orderBy: { score: 'desc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Сессия не найдена');
    }

    return session;
  }

  async findById(sessionId: string) {
    const session = await this.prisma.quizSession.findUnique({
      where: { id: sessionId },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            description: true,
            createdById: true,
            questions: {
              orderBy: { order: 'asc' },
              include: {
                options: { orderBy: { order: 'asc' } },
              },
            },
          },
        },
        participants: {
          include: { user: { select: { id: true, username: true, avatar: true } } },
          orderBy: { score: 'desc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Сессия не найдена');
    }

    return session;
  }

  async joinSession(roomCode: string, userId: string) {
    const session = await this.findByCode(roomCode);

    if (session.quiz.createdById === userId) {
      return session;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role !== 'PARTICIPANT') {
      throw new BadRequestException('Только участники могут присоединяться к квизам');
    }

    const existing = session.participants.find((p) => p.userId === userId);

    if (existing) {
      return session;
    }

    if (session.status !== 'LOBBY') {
      throw new BadRequestException('Квиз уже начался');
    }

    if (
      session.maxParticipants !== null &&
      session.participants.length >= session.maxParticipants
    ) {
      throw new BadRequestException('Комната заполнена');
    }

    try {
      await this.prisma.quizSessionParticipant.create({
        data: { sessionId: session.id, userId },
      });
    } catch {
      return this.findByCode(roomCode);
    }

    return this.findByCode(roomCode);
  }

  async startSession(sessionId: string, userId: string) {
    const session = await this.findById(sessionId);

    if (session.quiz.createdById !== userId) {
      throw new ForbiddenException('Только организатор может управлять квизом');
    }

    if (session.status !== 'LOBBY') {
      throw new BadRequestException('Квиз уже запущен');
    }

    return this.prisma.quizSession.update({
      where: { id: sessionId },
      data: {
        status: 'IN_PROGRESS',
        currentQuestionIndex: 0,
        startedAt: new Date(),
      },
    });
  }

  async nextQuestion(sessionId: string, userId: string) {
    const session = await this.findById(sessionId);

    if (session.quiz.createdById !== userId) {
      throw new ForbiddenException('Только организатор может управлять квизом');
    }

    return this.advanceQuestion(sessionId);
  }

  async advanceQuestion(sessionId: string) {
    const session = await this.findById(sessionId);

    if (session.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Квиз не в процессе');
    }

    const nextIndex = session.currentQuestionIndex + 1;
    const totalQuestions = session.quiz.questions.length;

    if (nextIndex >= totalQuestions) {
      return this.prisma.quizSession.update({
        where: { id: sessionId },
        data: {
          status: 'FINISHED',
          finishedAt: new Date(),
        },
      });
    }

    return this.prisma.quizSession.update({
      where: { id: sessionId },
      data: { currentQuestionIndex: nextIndex },
    });
  }

  async submitAnswer(sessionId: string, userId: string, questionId: string, optionIds: string[]) {
    const session = await this.findById(sessionId);

    if (session.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Квиз не в процессе');
    }

    const participant = session.participants.find((p) => p.userId === userId);

    if (!participant) {
      throw new BadRequestException('Вы не участник этого квиза');
    }

    const question = session.quiz.questions.find((q) => q.id === questionId);

    if (!question) {
      throw new BadRequestException('Вопрос не найден');
    }

    const currentQuestion = session.quiz.questions[session.currentQuestionIndex];

    if (!currentQuestion || currentQuestion.id !== questionId) {
      throw new BadRequestException('Это не текущий вопрос');
    }

    const correctOptionIds = question.options.filter((o) => o.isCorrect).map((o) => o.id);

    const isCorrect =
      optionIds.length === correctOptionIds.length &&
      optionIds.every((id) => correctOptionIds.includes(id));

    const points = isCorrect ? question.points : 0;

    try {
      await this.prisma.participantAnswer.create({
        data: {
          participantId: participant.id,
          questionId,
          isCorrect,
          points,
          selectedOptions: {
            connect: optionIds.map((id) => ({ id })),
          },
        },
      });
    } catch {
      const existing = await this.prisma.participantAnswer.findUnique({
        where: {
          participantId_questionId: {
            participantId: participant.id,
            questionId,
          },
        },
      });

      return {
        isCorrect: existing?.isCorrect ?? false,
        points: existing?.points ?? 0,
      };
    }

    if (points > 0) {
      await this.prisma.quizSessionParticipant.update({
        where: { id: participant.id },
        data: { score: { increment: points } },
      });
    }

    return { isCorrect, points };
  }

  async getLeaderboard(sessionId: string) {
    return this.prisma.quizSessionParticipant.findMany({
      where: { sessionId },
      orderBy: { score: 'desc' },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
    });
  }

  async deleteSession(sessionId: string, userId: string) {
    const session = await this.findById(sessionId);

    if (session.quiz.createdById !== userId) {
      throw new ForbiddenException('Только организатор может удалить сессию');
    }

    await this.prisma.quizSession.delete({
      where: { id: sessionId },
    });
  }

  async getActiveParticipantSession(userId: string) {
    const participant = await this.prisma.quizSessionParticipant.findFirst({
      where: {
        userId,
        session: { status: { in: ['LOBBY', 'IN_PROGRESS'] } },
      },
      include: {
        session: {
          select: {
            id: true,
            roomCode: true,
            status: true,
            quiz: { select: { title: true } },
          },
        },
      },
      orderBy: { session: { createdAt: 'desc' } },
    });

    return participant?.session ?? null;
  }

  async cancelSession(sessionId: string) {
    return this.prisma.quizSession.update({
      where: { id: sessionId },
      data: { status: 'FINISHED', finishedAt: new Date() },
    });
  }

  async regenerateRoomCode(sessionId: string, userId: string): Promise<{ roomCode: string }> {
    const session = await this.findById(sessionId);

    if (session.quiz.createdById !== userId) {
      throw new ForbiddenException('Только организатор может сменить код');
    }

    if (session.status !== 'LOBBY') {
      throw new BadRequestException('Код можно сменить только в лобби');
    }

    let roomCode = generateRoomCode();

    while (await this.prisma.quizSession.findUnique({ where: { roomCode } })) {
      roomCode = generateRoomCode();
    }

    return this.prisma.quizSession.update({
      where: { id: sessionId },
      data: { roomCode },
      include: this.sessionInclude,
    });
  }

  async updateSessionSettings(
    sessionId: string,
    userId: string,
    data: { isPublic?: boolean; maxParticipants?: number | null },
  ) {
    const session = await this.findById(sessionId);

    if (session.quiz.createdById !== userId) {
      throw new ForbiddenException('Только организатор может менять настройки');
    }

    if (session.status !== 'LOBBY') {
      throw new BadRequestException('Настройки можно менять только в лобби');
    }

    return this.prisma.quizSession.update({
      where: { id: sessionId },
      data: {
        isPublic: data.isPublic,
        maxParticipants: data.maxParticipants,
      },
      include: this.sessionInclude,
    });
  }

  async getPublicSessions() {
    return this.prisma.quizSession.findMany({
      where: { isPublic: true, status: 'LOBBY' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        roomCode: true,
        maxParticipants: true,
        createdAt: true,
        quiz: {
          select: {
            title: true,
            description: true,
            createdBy: { select: { id: true, username: true, avatar: true } },
            _count: { select: { questions: true } },
          },
        },
        _count: { select: { participants: true } },
      },
    });
  }

  async removeParticipant(sessionId: string, userId: string) {
    const participant = await this.prisma.quizSessionParticipant.findFirst({
      where: { sessionId, userId },
    });

    if (participant) {
      await this.prisma.quizSessionParticipant.delete({
        where: { id: participant.id },
      });
    }
  }

  async getParticipants(sessionId: string) {
    return this.prisma.quizSessionParticipant.findMany({
      where: { sessionId },
      orderBy: { score: 'desc' },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
    });
  }

  async getHostedHistory(userId: string) {
    return this.prisma.quizSession.findMany({
      where: {
        status: 'FINISHED',
        quiz: { createdById: userId },
      },
      orderBy: { finishedAt: 'desc' },
      select: {
        id: true,
        roomCode: true,
        startedAt: true,
        finishedAt: true,
        quiz: { select: { id: true, title: true } },
        _count: { select: { participants: true } },
      },
    });
  }

  async clearHostedHistory(userId: string) {
    await this.prisma.quizSession.deleteMany({
      where: {
        status: 'FINISHED',
        quiz: { createdById: userId },
      },
    });
  }

  async clearParticipatedHistory(userId: string) {
    await this.prisma.quizSessionParticipant.deleteMany({
      where: {
        userId,
        session: { status: 'FINISHED' },
      },
    });
  }

  async getParticipatedHistory(userId: string) {
    const entries = await this.prisma.quizSessionParticipant.findMany({
      where: {
        userId,
        session: { status: 'FINISHED' },
      },
      orderBy: { session: { finishedAt: 'desc' } },
      select: {
        score: true,
        session: {
          select: {
            id: true,
            roomCode: true,
            startedAt: true,
            finishedAt: true,
            quiz: { select: { id: true, title: true } },
            _count: { select: { participants: true } },
            participants: {
              orderBy: { score: 'desc' },
              select: { userId: true, score: true },
            },
          },
        },
      },
    });

    return entries.map((e) => {
      const myScore = e.score;
      const uniqueScores = [...new Set(e.session.participants.map((p) => p.score))].sort(
        (a, b) => b - a,
      );
      const rank = uniqueScores.indexOf(myScore) + 1;

      return {
        sessionId: e.session.id,
        roomCode: e.session.roomCode,
        startedAt: e.session.startedAt,
        finishedAt: e.session.finishedAt,
        quiz: e.session.quiz,
        participantCount: e.session._count.participants,
        score: e.score,
        rank,
      };
    });
  }

  async getQuestionForParticipant(sessionId: string) {
    const session = await this.findById(sessionId);

    if (session.status !== 'IN_PROGRESS') {
      return null;
    }

    const question = session.quiz.questions[session.currentQuestionIndex];

    if (!question) {
      return null;
    }

    return {
      id: question.id,
      text: question.text,
      imageUrl: question.imageUrl,
      type: question.type,
      timeLimitSeconds: question.timeLimitSeconds,
      points: question.points,
      options: question.options.map((o) => ({
        id: o.id,
        text: o.text,
        order: o.order,
      })),
      index: session.currentQuestionIndex,
      total: session.quiz.questions.length,
    };
  }
}
