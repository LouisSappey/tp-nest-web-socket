import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from './users.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(data: Partial<User>): Promise<User> {
    return this.userRepository.save(data);
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const user = await this.userRepository.findOne({ where: { email } });
    return user ?? undefined;
  }

  async findByUsername(username: string): Promise<User | undefined> {
    const user = await this.userRepository.findOne({ where: { username } });
    return user ?? undefined;
  }

  async findById(id: number): Promise<User | undefined> {
    const user = await this.userRepository.findOne({ where: { id } });
    return user ?? undefined;
  }

  async findByIds(ids: number[]): Promise<User[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.userRepository.find({ where: { id: In(ids) } });
  }

  async updateProfile(
    id: number,
    data: { username?: string; displayColor?: string },
  ): Promise<User | undefined> {
    const user = await this.findById(id);
    if (!user) {
      return undefined;
    }

    if (typeof data.username === 'string') {
      user.username = data.username;
    }

    if (typeof data.displayColor === 'string') {
      user.displayColor = data.displayColor;
    }

    return this.userRepository.save(user);
  }
}