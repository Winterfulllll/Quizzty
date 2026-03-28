import { Module } from '@nestjs/common';
import { QuizController } from './quiz.controller.js';
import { QuizService } from './quiz.service.js';
import { QuizGateway } from './quiz.gateway.js';

@Module({
  controllers: [QuizController],
  providers: [QuizService, QuizGateway],
  exports: [QuizService],
})
export class QuizModule {}
