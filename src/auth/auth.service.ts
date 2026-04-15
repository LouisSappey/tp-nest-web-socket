import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { QueryFailedError } from 'typeorm';

@Injectable()
export class AuthService {
  private readonly revokedTokens = new Map<string, number>();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(username: string, email: string, password: string) {
    const existingUsername = await this.usersService.findByUsername(username);
    if (existingUsername) {
      throw new BadRequestException('Username already in use');
    }

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      return await this.usersService.create({
        username,
        email,
        password: hashedPassword,
      });
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new BadRequestException('Username or email already in use');
      }
      throw error;
    }
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwtService.sign({ id: user.id, email: user.email });
    return { token };
  }

  async logout(token: string) {
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    try {
      this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    this.cleanupRevokedTokens();
    const decoded = this.jwtService.decode(token) as { exp?: number } | null;
    const expiresAtMs = decoded?.exp ? decoded.exp * 1000 : Date.now() + 3600000;
    this.revokedTokens.set(token, expiresAtMs);

    return { message: 'Logged out successfully' };
  }

  isTokenRevoked(token: string): boolean {
    this.cleanupRevokedTokens();
    return this.revokedTokens.has(token);
  }

  private cleanupRevokedTokens() {
    const now = Date.now();
    for (const [token, expiresAtMs] of this.revokedTokens.entries()) {
      if (expiresAtMs <= now) {
        this.revokedTokens.delete(token);
      }
    }
  }
}
