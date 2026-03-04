import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterPushDeviceDto {
  @IsString()
  @MinLength(10)
  @MaxLength(255)
  expoPushToken!: string;

  @IsOptional()
  @IsString()
  @IsIn(['ios', 'android', 'web'])
  platform?: 'ios' | 'android' | 'web';

  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;
}
