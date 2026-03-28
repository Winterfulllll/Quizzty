import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class UpdateOptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'Париж' })
  @IsString()
  @MaxLength(500)
  text!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  isCorrect!: boolean;
}

export class UpdateQuestionDto {
  @ApiPropertyOptional({ example: 'Какая столица Франции?' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @ApiPropertyOptional({ enum: ['SINGLE_CHOICE', 'MULTIPLE_CHOICE'] })
  @IsOptional()
  @IsEnum(['SINGLE_CHOICE', 'MULTIPLE_CHOICE'] as const)
  type?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(300)
  timeLimitSeconds?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  points?: number;

  @ApiPropertyOptional({ type: [UpdateOptionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2, { message: 'Минимум 2 варианта ответа' })
  @ValidateNested({ each: true })
  @Type(() => UpdateOptionDto)
  options?: UpdateOptionDto[];
}
