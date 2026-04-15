import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../jwt/jwt.guard';

@Controller('profile')
@UseGuards(JwtGuard)
export class ProfileController {
  @Get()
  getProfile(@Req() req: any) {
    return req.user;
  }
}
