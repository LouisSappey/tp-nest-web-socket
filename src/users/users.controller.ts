import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../jwt/jwt.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  listUsers() {
    return this.usersService.listUsersForInvite();
  }
}
