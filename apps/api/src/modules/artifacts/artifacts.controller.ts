import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AppAuthGuard } from '../auth/guards/app-auth.guard';
import { ArtifactsService } from './artifacts.service';
import { UploadArtifactDto } from './dto/upload-artifact.dto';

@Controller('artifacts')
@UseGuards(AppAuthGuard)
export class ArtifactsController {
  constructor(private readonly artifactsService: ArtifactsService) {}

  @Post('upload')
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadArtifactDto,
  ) {
    return this.artifactsService.uploadArtifact(user, dto);
  }
}
