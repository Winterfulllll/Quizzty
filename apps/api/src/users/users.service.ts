import { Injectable, ConflictException } from '@nestjs/common';
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
      if (data.username) conditions.push({ username: data.username });
      if (data.email) conditions.push({ email: data.email });

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

  async deleteAccount(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
