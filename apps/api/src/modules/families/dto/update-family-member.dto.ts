import { FamilyRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateFamilyMemberDto {
  @IsEnum(FamilyRole)
  role!: FamilyRole;
}
