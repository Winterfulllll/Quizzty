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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOptionDto {
  @ApiProperty({ example: 'Париж' })
  @IsString()
  @MaxLength(500)
  text!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  isCorrect!: boolean;
}

export class CreateQuestionDto {
  @ApiProperty({ example: 'Какая столица Франции?' })
  @IsString()
  @MaxLength(1000)
  text!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ enum: ['SINGLE_CHOICE', 'MULTIPLE_CHOICE'], default: 'SINGLE_CHOICE' })
  @IsEnum(['SINGLE_CHOICE', 'MULTIPLE_CHOICE'] as const)
  type!: string;

  @ApiProperty({ example: 30, default: 30 })
  @IsInt()
  @Min(5)
  @Max(300)
  timeLimitSeconds: number = 30;

  @ApiProperty({ example: 100, default: 100 })
  @IsInt()
  @Min(1)
  @Max(10000)
  points: number = 100;

  @ApiProperty({ type: [CreateOptionDto] })
  @IsArray()
  @ArrayMinSize(2, { message: 'Минимум 2 варианта ответа' })
  @ValidateNested({ each: true })
  @Type(() => CreateOptionDto)
  options!: CreateOptionDto[];
}
