import { SplitStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListSplitsDto {
  @IsString()
  familyId!: string;

  @IsOptional()
  @IsEnum(SplitStatus)
  status?: SplitStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
