import { IsEmail, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'quizmaster' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'Только латиница, цифры, _ и -' })
  username?: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Люблю квизы!' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  status?: string;

  @ApiPropertyOptional({ example: 'Организатор квизов с 2024 года' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
}
