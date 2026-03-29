import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserRole } from '../../generated/prisma/client.js';
import * as bcrypt from 'bcrypt';

const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  username: true,
  role: true,
  avatar: true,
  status: true,
  bio: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { email: string; username: string; password: string; role?: UserRole }) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { username: data.username }],
      },
    });

    if (existing) {
      throw new ConflictException(
        existing.email === data.email ? 'Email уже используется' : 'Имя пользователя занято',
      );
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    return this.prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        password: hashedPassword,
        role: data.role ?? UserRole.PARTICIPANT,
      },
      select: USER_PUBLIC_SELECT,
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: USER_PUBLIC_SELECT,
    });
  }

  async updateProfile(
    id: string,
    data: {
      username?: string;
      email?: string;
      status?: string | null;
      bio?: string | null;
      avatar?: string | null;
    },
  ) {
    if (data.username || data.email) {
      const conditions = [];

      if (data.username) {
        conditions.push({ username: data.username });
      }

      if (data.email) {
        conditions.push({ email: data.email });
      }

      const existing = await this.prisma.user.findFirst({
        where: {
          OR: conditions,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException(
          existing.email === data.email ? 'Email уже используется' : 'Имя пользователя занято',
        );
      }
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: USER_PUBLIC_SELECT,
    });
  }

  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new BadRequestException('Пользователь не найден');
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);

    if (!isValid) {
      throw new BadRequestException('Неверный текущий пароль');
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashed },
    });
  }

  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        avatar: true,
        status: true,
        bio: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    const hostedSessions = await this.prisma.quizSession.findMany({
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

    const participantEntries = await this.prisma.quizSessionParticipant.findMany({
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

    const participatedSessions = participantEntries.map((e) => {
      const uniqueScores = [...new Set(e.session.participants.map((p) => p.score))].sort(
        (a, b) => b - a,
      );
      const rank = uniqueScores.indexOf(e.score) + 1;

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

    return {
      ...user,
      hostedSessions,
      participatedSessions,
    };
  }

  async changeRole(id: string, role: UserRole) {
    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: USER_PUBLIC_SELECT,
    });
  }

  async deleteAccount(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
