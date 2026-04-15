import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../jwt/jwt.guard';
import { ProfileService } from './profile.service';

@Controller('profile')
@UseGuards(JwtGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile(@Req() req: any) {
    return this.profileService.getProfile(req.user.userId);
  }

  @Patch()
  updateProfile(
    @Req() req: any,
    @Body() body: { username?: string; displayColor?: string },
  ) {
    return this.profileService.updateProfile(req.user.userId, body);
  }
}
