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
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  FileTypeValidator,
  MaxFileSizeValidator,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
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
  constructor(
    private readonly quizService: QuizService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

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

  @Post(':id/questions/:questionId/image')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Загрузить изображение к вопросу' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { image: { type: 'string', format: 'binary' } },
    },
  })
  async uploadQuestionImage(
    @Req() req: AuthRequest,
    @Param('id') quizId: string,
    @Param('questionId') questionId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new FileTypeValidator({
            fileType: /^image\/(jpeg|png|webp|gif)$/,
            fallbackToMimetype: true,
          }),
          new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Файл не загружен');
    }

    const { url } = await this.cloudinaryService.upload(file, 'quizzty/questions');

    return this.quizService.updateQuestion(quizId, questionId, req.user.id, {
      imageUrl: url,
    });
  }

  @Delete(':id/questions/:questionId/image')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Удалить изображение вопроса' })
  async removeQuestionImage(
    @Req() req: AuthRequest,
    @Param('id') quizId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.quizService.updateQuestion(quizId, questionId, req.user.id, {
      imageUrl: null,
    });
  }
}
