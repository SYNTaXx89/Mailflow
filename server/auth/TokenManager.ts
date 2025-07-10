/**
 * Token Manager - JWT token generation and validation
 * 
 * Handles JWT token creation, validation, and refresh for secure
 * session management in the self-hosted Mailflow instance.
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ConfigManager } from '../config/ConfigManager';

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'admin' | 'user';
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: string;
  email: string;
  tokenId: string;
  iat?: number;
  exp?: number;
}

export class TokenManager {
  private readonly ACCESS_TOKEN_EXPIRY = '1h';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';

  constructor(private configManager: ConfigManager) {}

  /**
   * Get JWT secret from configuration
   */
  private getJwtSecret(): string {
    const secret = this.configManager.getDeep('security.jwtSecret');
    if (!secret) {
      throw new Error('JWT secret not configured');
    }
    return secret;
  }

  /**
   * Generate access token (short-lived)
   */
  generateAccessToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
    try {
      const token = jwt.sign(
        payload,
        this.getJwtSecret(),
        {
          expiresIn: this.ACCESS_TOKEN_EXPIRY,
          issuer: 'mailflow',
          audience: 'mailflow-users'
        }
      );
      return token;
    } catch (error) {
      console.error('❌ Failed to generate access token:', error);
      throw new Error('Token generation failed');
    }
  }

  /**
   * Generate refresh token (long-lived)
   */
  generateRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>): string {
    try {
      const token = jwt.sign(
        payload,
        this.getJwtSecret(),
        {
          expiresIn: this.REFRESH_TOKEN_EXPIRY,
          issuer: 'mailflow',
          audience: 'mailflow-refresh'
        }
      );
      return token;
    } catch (error) {
      console.error('❌ Failed to generate refresh token:', error);
      throw new Error('Refresh token generation failed');
    }
  }

  /**
   * Verify and decode access token
   */
  verifyAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(
        token,
        this.getJwtSecret(),
        {
          issuer: 'mailflow',
          audience: 'mailflow-users'
        }
      ) as TokenPayload;
      
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      } else {
        console.error('❌ Token verification failed:', error);
        throw new Error('Token verification failed');
      }
    }
  }

  /**
   * Verify and decode refresh token
   */
  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(
        token,
        this.getJwtSecret(),
        {
          issuer: 'mailflow',
          audience: 'mailflow-refresh'
        }
      ) as RefreshTokenPayload;
      
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      } else {
        console.error('❌ Refresh token verification failed:', error);
        throw new Error('Refresh token verification failed');
      }
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Generate token pair (access + refresh)
   */
  generateTokenPair(userId: string, email: string, role: 'admin' | 'user'): {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  } {
    const tokenId = crypto.randomUUID();
    
    const accessToken = this.generateAccessToken({
      userId,
      email,
      role
    });

    const refreshToken = this.generateRefreshToken({
      userId,
      email,
      tokenId
    });

    // Get session timeout from config
    const expiresIn = this.configManager.getDeep('security.sessionTimeout') || 3600;

    return {
      accessToken,
      refreshToken,
      expiresIn
    };
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): any {
    try {
      return jwt.decode(token);
    } catch (error) {
      console.error('❌ Failed to decode token:', error);
      return null;
    }
  }

  /**
   * Check if token is expired without verification
   */
  isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) {
        return true;
      }
      
      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp < currentTime;
    } catch (error) {
      return true;
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) {
        return null;
      }
      
      return new Date(decoded.exp * 1000);
    } catch (error) {
      return null;
    }
  }
}