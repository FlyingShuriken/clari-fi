import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyClerkDto {
  @IsString()
  @IsNotEmpty()
  clerkSessionToken!: string;
}
