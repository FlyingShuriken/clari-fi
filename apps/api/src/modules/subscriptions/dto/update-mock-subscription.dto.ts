import { Type } from 'class-transformer';
import { IsEnum, IsInt, Max, Min } from 'class-validator';
import { SubscriptionPlan } from '@prisma/client';

export class UpdateMockSubscriptionDto {
  @IsEnum(SubscriptionPlan)
  plan!: SubscriptionPlan;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  addonCount!: number;
}
