import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET ?? '',
      passReqToCallback: true,
    });
  }

  async validate(req: { headers: { authorization?: string } }, payload: any) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token || this.authService.isTokenRevoked(token)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return {
      userId: payload.id,
      email: payload.email,
    };
  }
}
