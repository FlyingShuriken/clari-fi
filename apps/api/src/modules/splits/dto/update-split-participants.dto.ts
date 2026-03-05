import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class SplitParticipantInputDto {
  @IsOptional()
  @IsString()
  familyMemberId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPayer?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paidAmount?: number;
}

export class UpdateSplitParticipantsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitParticipantInputDto)
  participants!: SplitParticipantInputDto[];
}

export type SplitParticipantInput = SplitParticipantInputDto;
