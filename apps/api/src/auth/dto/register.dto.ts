import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../generated/prisma/client.js';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Некорректный email' })
  email: string;

  @ApiProperty({ example: 'quizmaster', minLength: 3, maxLength: 30 })
  @IsString()
  @MinLength(3, {
    message: 'Имя пользователя должно содержать минимум 3 символа',
  })
  @MaxLength(30, { message: 'Имя пользователя не может превышать 30 символов' })
  username: string;

  @ApiProperty({ example: 'secret123', minLength: 6 })
  @IsString()
  @MinLength(6, { message: 'Пароль должен содержать минимум 6 символов' })
  password: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.PARTICIPANT })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Роль должна быть PARTICIPANT или ORGANIZER' })
  role?: UserRole;
}
