import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import type { JwtPayload } from './strategies/jwt.strategy.js';
import type { RegisterDto } from './dto/register.dto.js';

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto);
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id);

    return { user, accessToken, refreshToken };
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const { password: _, ...userWithoutPassword } = user;
    const accessToken = this.generateAccessToken(userWithoutPassword);
    const refreshToken = await this.createRefreshToken(user.id);

    return { user: userWithoutPassword, accessToken, refreshToken };
  }

  async refresh(oldToken: string) {
    const tokenHash = this.hashToken(oldToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            role: true,
            avatar: true,
            status: true,
            bio: true,
          },
        },
      },
    });

    if (!stored || stored.expiresAt < new Date()) {
      if (stored) {
        await this.prisma.refreshToken.deleteMany({ where: { userId: stored.userId } });
      }

      throw new UnauthorizedException('Refresh token невалиден или истёк');
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const accessToken = this.generateAccessToken(stored.user);
    const refreshToken = await this.createRefreshToken(stored.userId);

    return { user: stored.user, accessToken, refreshToken };
  }

  async logout(token: string) {
    const tokenHash = this.hashToken(token);

    await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  private generateAccessToken(user: { id: string; email: string; role: string }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);

    const expiresAt = new Date();

    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await this.prisma.refreshToken.create({
      data: { tokenHash, userId, expiresAt },
    });

    return token;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
