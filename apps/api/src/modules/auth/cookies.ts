import { CookieOptions, Response } from 'express';
import { AppConfig } from '../../common/config/app.config';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
const ACCESS_MAX_AGE = 15 * 60 * 1000; // 15m
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30d

/**
 * The single source of cookie attributes (02-SEC). Secure + a real domain in
 * production; lax + host-only in dev. No call site re-derives these.
 */
export class CookieHelper {
  constructor(private readonly config: AppConfig) {}

  private base(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.isProd,
      path: '/',
      ...(this.config.cookieDomain ? { domain: this.config.cookieDomain } : {}),
    };
  }

  setAccess(res: Response, token: string): void {
    res.cookie(ACCESS_COOKIE, token, { ...this.base(), maxAge: ACCESS_MAX_AGE });
  }

  setRefresh(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, { ...this.base(), maxAge: REFRESH_MAX_AGE });
  }

  clear(res: Response): void {
    const { httpOnly: _h, maxAge: _m, ...clearOpts } = { ...this.base() };
    res.clearCookie(ACCESS_COOKIE, clearOpts);
    res.clearCookie(REFRESH_COOKIE, clearOpts);
  }
}
