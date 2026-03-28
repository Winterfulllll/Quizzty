import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateQuizDto } from './dto/create-quiz.dto.js';
import type { UpdateQuizDto } from './dto/update-quiz.dto.js';
import type { CreateQuestionDto } from './dto/create-question.dto.js';
import type { UpdateQuestionDto } from './dto/update-question.dto.js';

const QUIZ_INCLUDE = {
  questions: {
    orderBy: { order: 'asc' as const },
    include: {
      options: { orderBy: { order: 'asc' as const } },
    },
  },
} as const;

@Injectable()
export class QuizService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateQuizDto) {
    return this.prisma.quiz.create({
      data: {
        title: dto.title,
        description: dto.description,
        createdById: userId,
      },
      include: QUIZ_INCLUDE,
    });
  }

  async findAllByUser(userId: string) {
    return this.prisma.quiz.findMany({
      where: { createdById: userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { questions: true, sessions: true } },
      },
    });
  }

  async findById(id: string, userId?: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: QUIZ_INCLUDE,
    });

    if (!quiz) {
      throw new NotFoundException('Квиз не найден');
    }

    if (userId && quiz.createdById !== userId) {
      throw new ForbiddenException('Нет доступа к этому квизу');
    }

    return quiz;
  }

  async update(id: string, userId: string, dto: UpdateQuizDto) {
    await this.findById(id, userId);

    return this.prisma.quiz.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      include: QUIZ_INCLUDE,
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findById(id, userId);
    await this.prisma.quiz.delete({ where: { id } });
  }

  async addQuestion(quizId: string, userId: string, dto: CreateQuestionDto) {
    await this.findById(quizId, userId);

    const maxOrder = await this.prisma.quizQuestion.aggregate({
      where: { quizId },
      _max: { order: true },
    });

    const order = (maxOrder._max.order ?? -1) + 1;

    return this.prisma.quizQuestion.create({
      data: {
        quizId,
        text: dto.text,
        imageUrl: dto.imageUrl,
        type: dto.type as 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE',
        timeLimitSeconds: dto.timeLimitSeconds,
        points: dto.points,
        order,
        options: {
          create: dto.options.map((opt, i) => ({
            text: opt.text,
            isCorrect: opt.isCorrect,
            order: i,
          })),
        },
      },
      include: { options: { orderBy: { order: 'asc' } } },
    });
  }

  async updateQuestion(quizId: string, questionId: string, userId: string, dto: UpdateQuestionDto) {
    await this.findById(quizId, userId);

    const question = await this.prisma.quizQuestion.findFirst({
      where: { id: questionId, quizId },
    });

    if (!question) {
      throw new NotFoundException('Вопрос не найден');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.options) {
        await tx.quizQuestionOption.deleteMany({ where: { questionId } });
        await tx.quizQuestionOption.createMany({
          data: dto.options.map((opt, i) => ({
            questionId,
            text: opt.text,
            isCorrect: opt.isCorrect,
            order: i,
          })),
        });
      }

      return tx.quizQuestion.update({
        where: { id: questionId },
        data: {
          ...(dto.text !== undefined && { text: dto.text }),
          ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
          ...(dto.type !== undefined && { type: dto.type as 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' }),
          ...(dto.timeLimitSeconds !== undefined && { timeLimitSeconds: dto.timeLimitSeconds }),
          ...(dto.points !== undefined && { points: dto.points }),
        },
        include: { options: { orderBy: { order: 'asc' } } },
      });
    });
  }

  async removeQuestion(quizId: string, questionId: string, userId: string): Promise<void> {
    await this.findById(quizId, userId);

    const question = await this.prisma.quizQuestion.findFirst({
      where: { id: questionId, quizId },
    });

    if (!question) {
      throw new NotFoundException('Вопрос не найден');
    }

    await this.prisma.quizQuestion.delete({ where: { id: questionId } });
  }

  async reorderQuestions(quizId: string, userId: string, questionIds: string[]): Promise<void> {
    await this.findById(quizId, userId);

    await this.prisma.$transaction(
      questionIds.map((id, index) =>
        this.prisma.quizQuestion.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );
  }
}
