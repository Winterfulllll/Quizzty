import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { SessionService } from './session.service.js';

type AuthRequest = Request & { user: { id: string } };

@ApiTags('Sessions')
@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post('create/:quizId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Создать игровую сессию' })
  createSession(@Req() req: AuthRequest, @Param('quizId') quizId: string) {
    return this.sessionService.createSession(quizId, req.user.id);
  }

  @Get('public')
  @ApiOperation({ summary: 'Список публичных комнат' })
  getPublicSessions() {
    return this.sessionService.getPublicSessions();
  }

  @Get('code/:code')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получить сессию по коду комнаты' })
  findByCode(@Param('code') code: string) {
    return this.sessionService.findByCode(code);
  }

  @Get(':id/leaderboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Таблица лидеров' })
  getLeaderboard(@Param('id') id: string) {
    return this.sessionService.getLeaderboard(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Удалить сессию' })
  async deleteSession(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.sessionService.deleteSession(id, req.user.id);

    return { message: 'Сессия удалена' };
  }

  @Get('active/participant')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Активная сессия участника' })
  getActiveParticipantSession(@Req() req: AuthRequest) {
    return this.sessionService.getActiveParticipantSession(req.user.id);
  }

  @Post('leave/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Покинуть сессию' })
  async leaveSession(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.sessionService.removeParticipant(id, req.user.id);

    return { message: 'Вы покинули сессию' };
  }

  @Get('history/hosted')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'История проведённых квизов' })
  getHostedHistory(@Req() req: AuthRequest) {
    return this.sessionService.getHostedHistory(req.user.id);
  }

  @Get('history/participated')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'История участия в квизах' })
  getParticipatedHistory(@Req() req: AuthRequest) {
    return this.sessionService.getParticipatedHistory(req.user.id);
  }

  @Delete('history/hosted')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Очистить историю проведённых квизов' })
  async clearHostedHistory(@Req() req: AuthRequest) {
    await this.sessionService.clearHostedHistory(req.user.id);

    return { message: 'История очищена' };
  }

  @Delete('history/participated')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Очистить историю участия в квизах' })
  async clearParticipatedHistory(@Req() req: AuthRequest) {
    await this.sessionService.clearParticipatedHistory(req.user.id);

    return { message: 'История очищена' };
  }
}
