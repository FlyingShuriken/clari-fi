import { IsString, MaxLength, MinLength } from 'class-validator';

export class JoinFamilyDto {
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  code!: string;
}
