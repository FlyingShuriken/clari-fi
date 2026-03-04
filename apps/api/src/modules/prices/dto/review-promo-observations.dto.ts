import { PromoReviewStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsString,
  ValidateNested,
} from 'class-validator';

class PromoObservationReviewItemDto {
  @IsString()
  id!: string;
}

export class ReviewPromoObservationsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PromoObservationReviewItemDto)
  observations!: PromoObservationReviewItemDto[];

  @IsEnum(PromoReviewStatus)
  reviewStatus!: PromoReviewStatus;
}
