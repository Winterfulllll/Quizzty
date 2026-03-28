import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { QuizService } from './quiz.service.js';
import { CreateQuizDto } from './dto/create-quiz.dto.js';
import { UpdateQuizDto } from './dto/update-quiz.dto.js';
import { CreateQuestionDto } from './dto/create-question.dto.js';
import { UpdateQuestionDto } from './dto/update-question.dto.js';

type AuthRequest = Request & { user: { id: string } };

@ApiTags('Quizzes')
@Controller('quizzes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Post()
  @ApiOperation({ summary: 'Создать квиз' })
  create(@Req() req: AuthRequest, @Body() dto: CreateQuizDto) {
    return this.quizService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Мои квизы' })
  findAll(@Req() req: AuthRequest) {
    return this.quizService.findAllByUser(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить квиз по ID' })
  findOne(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.quizService.findById(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить квиз' })
  update(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: UpdateQuizDto) {
    return this.quizService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Удалить квиз' })
  async remove(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.quizService.remove(id, req.user.id);

    return { message: 'Квиз удалён' };
  }

  @Post(':id/questions')
  @ApiOperation({ summary: 'Добавить вопрос' })
  addQuestion(
    @Req() req: AuthRequest,
    @Param('id') quizId: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.quizService.addQuestion(quizId, req.user.id, dto);
  }

  @Patch(':id/questions/:questionId')
  @ApiOperation({ summary: 'Обновить вопрос' })
  updateQuestion(
    @Req() req: AuthRequest,
    @Param('id') quizId: string,
    @Param('questionId') questionId: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.quizService.updateQuestion(quizId, questionId, req.user.id, dto);
  }

  @Delete(':id/questions/:questionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Удалить вопрос' })
  async removeQuestion(
    @Req() req: AuthRequest,
    @Param('id') quizId: string,
    @Param('questionId') questionId: string,
  ) {
    await this.quizService.removeQuestion(quizId, questionId, req.user.id);

    return { message: 'Вопрос удалён' };
  }

  @Post(':id/questions/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Переупорядочить вопросы' })
  reorderQuestions(
    @Req() req: AuthRequest,
    @Param('id') quizId: string,
    @Body() body: { questionIds: string[] },
  ) {
    return this.quizService.reorderQuestions(quizId, req.user.id, body.questionIds);
  }
}
