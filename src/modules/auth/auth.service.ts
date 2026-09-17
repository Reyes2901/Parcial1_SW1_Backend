// modules/auth/auth.service.ts
// Auth business logic — delegates to provider, never contains route logic (§10)

import bcrypt from 'bcryptjs';
import { prisma } from '../../shared/prisma';
import { signToken } from '../../shared/auth-middleware';
import { ValidationError, UnauthorizedError, ConflictError } from '../../shared/errors';
import type { IOAuthProvider, OAuthUserInfo } from './google-oauth.provider';

export class AuthService {
  constructor(private oauthProvider: IOAuthProvider) {}

  async getAuthUrl(redirectUri: string): Promise<string> {
    return this.oauthProvider.getAuthUrl(redirectUri);
  }

  async register(email: string, password?: string, name?: string) {
    if (!email) throw new ValidationError('Email is required');
    if (!password || password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters');
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictError('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const displayName = name || email.split('@')[0];

    const user = await prisma.user.create({
      data: {
        email,
        name: displayName,
        password: hashedPassword,
      },
    });

    const token = signToken({ userId: user.id, email: user.email });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async login(email: string, password?: string) {
    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = signToken({ userId: user.id, email: user.email });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async loginWithGoogle(code: string): Promise<{ token: string; user: { id: string; email: string; name: string; avatarUrl: string | null } }> {
    const userInfo: OAuthUserInfo = await this.oauthProvider.exchangeCodeForUserInfo(code);

    // Upsert user
    const user = await prisma.user.upsert({
      where: { googleId: userInfo.googleId },
      update: {
        email: userInfo.email,
        name: userInfo.name,
        avatarUrl: userInfo.avatarUrl ?? null,
      },
      create: {
        googleId: userInfo.googleId,
        email: userInfo.email,
        name: userInfo.name,
        avatarUrl: userInfo.avatarUrl ?? null,
      },
    });

    const token = signToken({ userId: user.id, email: user.email });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    };
  }
}
