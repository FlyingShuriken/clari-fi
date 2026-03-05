import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class SplitLineAssignmentDto {
  @IsString()
  expenseLineItemId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  participantIds!: string[];
}

export class UpdateSplitAllocationsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitLineAssignmentDto)
  lineAssignments!: SplitLineAssignmentDto[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sharedCharge?: number;
}

export type SplitLineAssignment = SplitLineAssignmentDto;
