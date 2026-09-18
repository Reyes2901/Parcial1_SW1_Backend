import { UnauthorizedError } from '../../shared/errors';

export interface OAuthUserInfo {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface IOAuthProvider {
  exchangeCodeForUserInfo(code: string): Promise<OAuthUserInfo>;
  getAuthUrl(redirectUri: string): string;
}

/**
 * Concrete Google OAuth 2.0 implementation.
 * Credentials from env vars only — never in code (§10, §13).
 */
export class GoogleOAuthProvider implements IOAuthProvider {
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  }

  getAuthUrl(redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForUserInfo(code: string): Promise<OAuthUserInfo> {
    // Exchange code for tokens
    const tokenResponse = await fetch(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'authorization_code',
          redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
        }).toString(),
      }
    );

    if (!tokenResponse.ok) {
      throw new UnauthorizedError(`Failed to exchange code for tokens: ${tokenResponse.statusText}`);
    }

    const tokens = (await tokenResponse.json()) as { access_token: string };

    // Get user info
    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    if (!userInfoResponse.ok) {
      throw new UnauthorizedError(`Failed to get user info: ${userInfoResponse.statusText}`);
    }

    const userInfo = (await userInfoResponse.json()) as {
      id: string;
      email: string;
      name: string;
      picture?: string;
    };

    return {
      googleId: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      avatarUrl: userInfo.picture,
    };
  }
}
