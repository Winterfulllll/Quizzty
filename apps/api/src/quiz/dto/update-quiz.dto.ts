import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateQuizDto {
  @ApiPropertyOptional({ example: 'География мира — обновлённый' })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Название не может быть пустым' })
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: 'Квиз по странам и столицам' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
