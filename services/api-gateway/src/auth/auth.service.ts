import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import i18n from '../config/i18n';
import { User } from '../entities/user.entity';
import { AuthSession } from '../entities/auth-session.entity';

@Injectable()
export class AuthService {
  private static readonly SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(AuthSession)
    private authSessionRepository: Repository<AuthSession>,
  ) {}

  async validateUser(email: string, password: string, lang: string = 'en'): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { email, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException(i18n.t('auth:invalidCredentials', { lng: lang }));
    }

    // OAuth users should use OAuth flow, not email/password
    if (user.authProvider !== 'email') {
      throw new UnauthorizedException(
        `This account uses ${user.authProvider} login. Please sign in with ${user.authProvider}.`
      );
    }

    // Email users must have a password hash
    if (!user.passwordHash) {
      throw new UnauthorizedException(i18n.t('auth:invalidCredentials', { lng: lang }));
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException(i18n.t('auth:invalidCredentials', { lng: lang }));
    }

    // Update last login
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });

    const { passwordHash, ...result } = user;
    return result;
  }

  private hashSessionToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async createSession(userId: string): Promise<string> {
    const sessionToken = randomBytes(32).toString('base64url');
    const sessionTokenHash = this.hashSessionToken(sessionToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + AuthService.SESSION_TTL_MS);

    const session = this.authSessionRepository.create({
      userId,
      sessionTokenHash,
      expiresAt,
      lastActiveAt: now,
      revokedAt: null,
    });
    await this.authSessionRepository.save(session);

    return sessionToken;
  }

  async validateSessionToken(rawToken: string): Promise<User | null> {
    if (!rawToken || rawToken.trim().length === 0) {
      return null;
    }

    const sessionTokenHash = this.hashSessionToken(rawToken);
    const session = await this.authSessionRepository.findOne({
      where: {
        sessionTokenHash,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      relations: {
        user: true,
      },
    });

    if (!session || !session.user?.isActive) {
      return null;
    }

    await this.authSessionRepository.update(session.id, { lastActiveAt: new Date() });
    return session.user;
  }

  async revokeSession(rawToken: string): Promise<void> {
    if (!rawToken || rawToken.trim().length === 0) {
      return;
    }

    const sessionTokenHash = this.hashSessionToken(rawToken);
    await this.authSessionRepository.update(
      {
        sessionTokenHash,
        revokedAt: IsNull(),
      },
      {
        revokedAt: new Date(),
      },
    );
  }

  async login(email: string, password: string, lang: string = 'en') {
    const user = await this.validateUser(email, password, lang);
    const sessionToken = await this.createSession(user.id);

    return {
      sessionToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        plan_type: user.planType,
      },
    };
  }

  async register(email: string, password: string) {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new UnauthorizedException('User already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create new user with email auth provider
    const user = this.userRepository.create({
      email,
      passwordHash,
      authProvider: 'email',
      oauthId: null,
      role: 'user' as any,
      planType: 'free',
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);

    return {
      id: savedUser.id,
      email: savedUser.email,
      role: savedUser.role,
      plan_type: savedUser.planType,
    };
  }

  async getUserById(id: string) {
    const user = await this.userRepository.findOne({
      where: { id, isActive: true },
      select: ['id', 'email', 'role', 'planType'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      plan_type: user.planType,
    };
  }
}
