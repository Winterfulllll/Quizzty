import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
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
import { UsersService } from './users.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получить профиль текущего пользователя' })
  getProfile(@Req() req: Request & { user: { id: string } }) {
    return this.usersService.findById(req.user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Обновить профиль' })
  updateProfile(@Req() req: Request & { user: { id: string } }, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @Post('profile/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiOperation({ summary: 'Загрузить аватар' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { avatar: { type: 'string', format: 'binary' } },
    },
  })
  async uploadAvatar(
    @Req() req: Request & { user: { id: string } },
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new FileTypeValidator({
            fileType: /^image\/(jpeg|png|webp|gif)$/,
            fallbackToMimetype: true,
          }),
          new MaxFileSizeValidator({ maxSize: 512 * 1024 }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Файл не загружен');
    }

    const base64 = file.buffer.toString('base64');
    const avatar = `data:${file.mimetype};base64,${base64}`;

    return this.usersService.updateProfile(req.user.id, { avatar });
  }

  @Delete('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Удалить аккаунт' })
  async deleteAccount(
    @Req() req: Request & { user: { id: string } },
  ): Promise<{ message: string }> {
    await this.usersService.deleteAccount(req.user.id);

    return { message: 'Аккаунт удалён' };
  }
}
