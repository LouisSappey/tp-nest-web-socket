import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class ProfileService {
  constructor(private readonly usersService: UsersService) {}

  async getProfile(userId: number) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      userId: user.id,
      username: user.username,
      email: user.email,
      displayColor: user.displayColor,
    };
  }

  async updateProfile(
    userId: number,
    data: { username?: string; displayColor?: string },
  ) {
    const username = data.username?.trim();
    const displayColor = data.displayColor?.trim();

    if (!username && !displayColor) {
      throw new BadRequestException('username or displayColor is required');
    }

    if (displayColor && !/^#([0-9a-fA-F]{6})$/.test(displayColor)) {
      throw new BadRequestException('displayColor must be a valid hex color');
    }

    const currentUser = await this.usersService.findById(userId);
    if (!currentUser) {
      throw new NotFoundException('User not found');
    }

    if (username && username !== currentUser.username) {
      const existingUser = await this.usersService.findByUsername(username);
      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException('Username already in use');
      }
    }

    const updatedUser = await this.usersService.updateProfile(userId, {
      username: username ?? undefined,
      displayColor: displayColor ?? undefined,
    });

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return {
      userId: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      displayColor: updatedUser.displayColor,
    };
  }
}
