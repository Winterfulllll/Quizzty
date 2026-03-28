import { Module } from '@nestjs/common';
import { QuizGateway } from './quiz.gateway.js';

@Module({
  providers: [QuizGateway],
})
export class QuizModule {}
