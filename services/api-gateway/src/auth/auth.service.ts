import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, ILike, IsNull, MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import i18n from '../config/i18n';
import { User } from '../entities/user.entity';
import { AuthSession } from '../entities/auth-session.entity';
import { OauthAccount } from '../entities/oauth-account.entity';
import { CreditBalance } from '../entities/credit-balance.entity';
import { VerificationToken } from '../entities/verification-token.entity';
import { EMAIL_PROVIDER, EmailProvider } from '../email/email-provider.interface';
import { MONTHLY_CREDIT_ALLOCATIONS } from '../credit-ledger/types';

export interface GoogleProfileInput {
  googleId: string;
  email: string | null;
  emailVerified: boolean;
}

export interface AppleProfileInput {
  appleId: string;
  email: string | null;
  emailVerified: boolean;
  isPrivateEmail: boolean;
  name?: {
    firstName?: string;
    lastName?: string;
  } | null;
}

@Injectable()
export class AuthService {
  private static readonly SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  private static readonly EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(OauthAccount)
    private oauthAccountRepository: Repository<OauthAccount>,
    @InjectRepository(AuthSession)
    private authSessionRepository: Repository<AuthSession>,
    @InjectRepository(VerificationToken)
    private readonly verificationTokenRepository: Repository<VerificationToken>,
    private readonly dataSource: DataSource,
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: EmailProvider,
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

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private hashSessionToken(rawToken: string): string {
    return this.hashToken(rawToken);
  }

  async generateAndStoreVerificationToken(
    userId: string,
    type: string,
    ttlMs: number,
    locale: string,
    manager?: EntityManager,
  ): Promise<string> {
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + ttlMs);
    const safeLocale = locale?.trim() ? locale.trim() : 'en';

    const tokenPayload = {
      userId,
      tokenHash,
      type,
      expiresAt,
      locale: safeLocale,
      usedAt: null,
    };
    if (manager) {
      const verificationToken = manager.create(VerificationToken, tokenPayload);
      await manager.save(VerificationToken, verificationToken);
    } else {
      const verificationToken = this.verificationTokenRepository.create(tokenPayload);
      await this.verificationTokenRepository.save(verificationToken);
    }

    return rawToken;
  }

  async sendVerificationEmail(email: string, rawToken: string, locale: string): Promise<void> {
    const baseUrl = process.env.APP_BASE_URL;
    if (!baseUrl) {
      throw new Error('APP_BASE_URL is required for email verification');
    }

    const safeLocale = locale?.trim() ? locale.trim() : 'en';
    const verifyUrl = `${baseUrl}/api/auth/email/verify?token=${rawToken}&locale=${safeLocale}`;

    await this.emailProvider.sendEmail({
      to: email,
      subject: 'Verify your email address — AI Sandbox',
      html: `<p>Please verify your email address by clicking the link below.</p><p><a href="${verifyUrl}">Verify Email</a></p><p>This link expires in 24 hours.</p>`,
      text: `Please verify your email address: ${verifyUrl}\n\nThis link expires in 24 hours.`,
    });
  }

  private async sendPasswordResetEmail(
    email: string,
    rawToken: string,
    locale: string,
  ): Promise<void> {
    const baseUrl = process.env.APP_BASE_URL;
    if (!baseUrl) {
      throw new Error('APP_BASE_URL is required for password reset');
    }

    const safeLocale = locale?.trim() ? locale.trim() : 'en';
    const resetUrl = `${baseUrl}/${safeLocale}/reset-password?token=${rawToken}`;

    await this.emailProvider.sendEmail({
      to: email,
      subject: 'Reset your password — AI Sandbox',
      html: `<p>You requested a password reset for your AI Sandbox account.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>`,
      text: `You requested a password reset for your AI Sandbox account.\n\nReset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, you can ignore this email.`,
    });
  }

  async validateAndConsumeToken(
    rawToken: string,
    type: string,
  ): Promise<{ userId: string; locale: string }> {
    if (!rawToken || rawToken.trim().length === 0) {
      throw new UnauthorizedException('Invalid verification token');
    }

    const tokenHash = this.hashToken(rawToken.trim());
    const verificationToken = await this.verificationTokenRepository.findOne({
      where: {
        tokenHash,
        type,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      relations: {
        user: true,
      },
    });

    if (!verificationToken || !verificationToken.user?.isActive) {
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    verificationToken.usedAt = new Date();
    await this.verificationTokenRepository.save(verificationToken);

    return {
      userId: verificationToken.userId,
      locale: verificationToken.locale ?? 'en',
    };
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.userRepository.update(userId, { emailVerified: true });
  }

  async resendEmailVerification(email: string, locale: string): Promise<void> {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) {
      return;
    }

    const user = await this.userRepository.findOne({
      where: { email: ILike(normalizedEmail) },
    });

    if (!user || user.emailVerified || !user.isActive) {
      return;
    }

    await this.verificationTokenRepository.update(
      {
        userId: user.id,
        type: 'email_verify',
        usedAt: IsNull(),
      },
      {
        usedAt: new Date(),
      },
    );

    const rawToken = await this.generateAndStoreVerificationToken(
      user.id,
      'email_verify',
      AuthService.EMAIL_VERIFICATION_TTL_MS,
      locale,
    );
    await this.sendVerificationEmail(user.email, rawToken, locale);
  }

  async requestPasswordReset(email: string, locale: string): Promise<void> {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) {
      return;
    }

    const user = await this.userRepository.findOne({
      where: { email: ILike(normalizedEmail) },
    });
    if (!user || !user.isActive) {
      return;
    }

    await this.verificationTokenRepository.update(
      {
        userId: user.id,
        type: 'password_reset',
        usedAt: IsNull(),
      },
      {
        usedAt: new Date(),
      },
    );

    const rawToken = await this.generateAndStoreVerificationToken(
      user.id,
      'password_reset',
      60 * 60 * 1000,
      locale,
    );
    await this.sendPasswordResetEmail(user.email, rawToken, locale);
  }

  async confirmPasswordReset(rawToken: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters.');
    }

    const { userId } = await this.validateAndConsumeToken(rawToken, 'password_reset');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.userRepository.update(userId, { passwordHash });
    await this.revokeAllUserSessions(userId);
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.authSessionRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
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

  private async touchLastLogin(user: User): Promise<User> {
    const lastLoginAt = new Date();
    await this.userRepository.update(user.id, { lastLoginAt });
    user.lastLoginAt = lastLoginAt;
    return user;
  }

  private async createGoogleOauthLink(
    userId: string,
    googleId: string,
    providerEmail: string | null,
    manager?: EntityManager,
  ): Promise<void> {
    if (manager) {
      const oauthAccount = manager.create(OauthAccount, {
        userId,
        provider: 'google',
        providerAccountId: googleId,
        providerEmail,
      });
      await manager.save(OauthAccount, oauthAccount);
    } else {
      const oauthAccount = this.oauthAccountRepository.create({
        userId,
        provider: 'google',
        providerAccountId: googleId,
        providerEmail,
      });
      await this.oauthAccountRepository.save(oauthAccount);
    }
  }

  private async createAppleOauthLink(
    userId: string,
    appleId: string,
    providerEmail: string | null,
    manager?: EntityManager,
  ): Promise<void> {
    if (manager) {
      const oauthAccount = manager.create(OauthAccount, {
        userId,
        provider: 'apple',
        providerAccountId: appleId,
        providerEmail,
      });
      await manager.save(OauthAccount, oauthAccount);
    } else {
      const oauthAccount = this.oauthAccountRepository.create({
        userId,
        provider: 'apple',
        providerAccountId: appleId,
        providerEmail,
      });
      await this.oauthAccountRepository.save(oauthAccount);
    }
  }

  private async createFreePlanBalanceRow(manager: EntityManager, userId: string): Promise<void> {
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const freePlanAllocation = MONTHLY_CREDIT_ALLOCATIONS.free;

    const creditBalance = manager.create(CreditBalance, {
      ownerId: userId,
      ownerType: 'user',
      planId: 'free',
      balance: freePlanAllocation,
      monthlyAllocation: freePlanAllocation,
      rolloverBalance: 0,
      status: 'active',
      periodStart,
      periodEnd,
      resetAt: null,
    });

    await manager.save(CreditBalance, creditBalance);
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    const pgCode = (error as Error & { code?: string }).code;
    if (pgCode === '23505') {
      return true;
    }
    const message = error.message.toLowerCase();
    return message.includes('duplicate key') || message.includes('unique constraint');
  }

  private async findActiveOauthRaceWinner(
    provider: 'google' | 'apple',
    providerAccountId: string,
  ): Promise<User | null> {
    const linkedAccount = await this.oauthAccountRepository.findOne({
      where: {
        provider,
        providerAccountId,
      },
      relations: {
        user: true,
      },
    });

    if (!linkedAccount?.user?.isActive) {
      return null;
    }

    return linkedAccount.user;
  }

  private isApplePrivateRelayEmail(email: string | null): boolean {
    return Boolean(email && email.endsWith('@privaterelay.appleid.com'));
  }

  async findOrCreateGoogleUser(profile: GoogleProfileInput): Promise<User> {
    const existingOauthAccount = await this.oauthAccountRepository.findOne({
      where: {
        provider: 'google',
        providerAccountId: profile.googleId,
      },
      relations: {
        user: true,
      },
    });

    if (existingOauthAccount?.user?.isActive) {
      return this.touchLastLogin(existingOauthAccount.user);
    }
    if (existingOauthAccount?.user && !existingOauthAccount.user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    const normalizedEmail = profile.email?.trim().toLowerCase() ?? null;
    if (!normalizedEmail) {
      throw new UnauthorizedException('Google account did not provide an email address');
    }

    const existingUser = await this.userRepository.findOne({
      where: { email: ILike(normalizedEmail) },
    });

    if (existingUser) {
      if (!profile.emailVerified) {
        throw new UnauthorizedException('Google account email must be verified before linking');
      }

      await this.createGoogleOauthLink(existingUser.id, profile.googleId, normalizedEmail);
      return this.touchLastLogin(existingUser);
    }

    try {
      return await this.dataSource.transaction(async (manager: EntityManager) => {
        const newUser = manager.create(User, {
          email: normalizedEmail,
          passwordHash: null,
          authProvider: 'google',
          oauthId: profile.googleId,
          emailVerified: true,
          role: 'user' as any,
          planType: 'free',
          isActive: true,
          lastLoginAt: new Date(),
        });
        const savedUser = await manager.save(User, newUser);

        await this.createFreePlanBalanceRow(manager, savedUser.id);
        await this.createGoogleOauthLink(savedUser.id, profile.googleId, normalizedEmail, manager);
        return savedUser;
      });
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        const raceWinner = await this.findActiveOauthRaceWinner('google', profile.googleId);
        if (raceWinner) {
          return this.touchLastLogin(raceWinner);
        }
      }
      throw error;
    }
  }

  async findOrCreateAppleUser(profile: AppleProfileInput): Promise<User> {
    const appleId = profile.appleId?.trim();
    if (!appleId) {
      throw new UnauthorizedException('Apple account did not provide an account identifier');
    }

    const existingOauthAccount = await this.oauthAccountRepository.findOne({
      where: {
        provider: 'apple',
        providerAccountId: appleId,
      },
      relations: {
        user: true,
      },
    });

    if (existingOauthAccount?.user?.isActive) {
      return this.touchLastLogin(existingOauthAccount.user);
    }
    if (existingOauthAccount?.user && !existingOauthAccount.user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    const normalizedEmail = profile.email?.trim().toLowerCase() ?? null;
    if (!normalizedEmail) {
      throw new UnauthorizedException('Apple account did not provide an email address');
    }

    const isPrivateRelayEmail =
      profile.isPrivateEmail || this.isApplePrivateRelayEmail(normalizedEmail);

    const createNewAppleUser = async (): Promise<User> =>
      this.dataSource.transaction(async (manager: EntityManager) => {
        const newUser = manager.create(User, {
          email: normalizedEmail,
          passwordHash: null,
          authProvider: 'apple',
          oauthId: appleId,
          emailVerified: true,
          role: 'user' as any,
          planType: 'free',
          isActive: true,
          lastLoginAt: new Date(),
        });
        const savedUser = await manager.save(User, newUser);

        await this.createFreePlanBalanceRow(manager, savedUser.id);
        await this.createAppleOauthLink(savedUser.id, appleId, normalizedEmail, manager);
        return savedUser;
      });

    if (isPrivateRelayEmail) {
      try {
        return await createNewAppleUser();
      } catch (error) {
        if (this.isUniqueConstraintViolation(error)) {
          const raceWinner = await this.findActiveOauthRaceWinner('apple', appleId);
          if (raceWinner) {
            return this.touchLastLogin(raceWinner);
          }
        }
        throw error;
      }
    }

    const existingUser = await this.userRepository.findOne({
      where: { email: ILike(normalizedEmail) },
    });

    if (existingUser) {
      if (!existingUser.isActive) {
        throw new UnauthorizedException('User account is inactive');
      }

      await this.createAppleOauthLink(existingUser.id, appleId, normalizedEmail);
      return this.touchLastLogin(existingUser);
    }

    try {
      return await createNewAppleUser();
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        const raceWinner = await this.findActiveOauthRaceWinner('apple', appleId);
        if (raceWinner) {
          return this.touchLastLogin(raceWinner);
        }
      }
      throw error;
    }
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

  async register(email: string, password: string, locale = 'en') {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new UnauthorizedException('User already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    let savedUser: User;
    let rawToken: string;

    try {
      const transactionResult = await this.dataSource.transaction(
        async (manager: EntityManager): Promise<{ savedUser: User; rawToken: string }> => {
          const user = manager.create(User, {
            email,
            passwordHash,
            authProvider: 'email',
            oauthId: null,
            role: 'user' as any,
            planType: 'free',
            isActive: true,
          });

          const persistedUser = await manager.save(User, user);
          await this.createFreePlanBalanceRow(manager, persistedUser.id);
          const token = await this.generateAndStoreVerificationToken(
            persistedUser.id,
            'email_verify',
            AuthService.EMAIL_VERIFICATION_TTL_MS,
            locale,
            manager,
          );
          return { savedUser: persistedUser, rawToken: token };
        },
      );
      savedUser = transactionResult.savedUser;
      rawToken = transactionResult.rawToken;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        const concurrentUser = await this.userRepository.findOne({
          where: { email },
        });
        if (concurrentUser) {
          throw new UnauthorizedException('User already exists');
        }
      }
      throw error;
    }

    await this.sendVerificationEmail(savedUser.email, rawToken, locale);

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
      select: ['id', 'email', 'role', 'planType', 'emailVerified'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      plan_type: user.planType,
      emailVerified: user.emailVerified,
    };
  }
}
