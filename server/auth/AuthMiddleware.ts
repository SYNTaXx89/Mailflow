/**
 * Authentication Middleware - Request authentication and authorization
 * 
 * Express middleware for validating JWT tokens and protecting routes
 * in the self-hosted MailFlow instance.
 */

import { Request, Response, NextFunction } from 'express';
import { TokenManager, TokenPayload } from './TokenManager';

// Extend Express Request type to include user data
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export class AuthMiddleware {
  /**
   * Middleware to authenticate requests using JWT tokens
   */
  static authenticate = (req: Request, res: Response, next: NextFunction): void => {
    try {
      console.log(`🔐 AuthMiddleware: Checking authentication for ${req.method} ${req.path}`);
      
      const authHeader = req.headers.authorization;
      console.log(`🔑 Auth header:`, authHeader ? `${authHeader.substring(0, 30)}...` : 'MISSING');
      
      const token = TokenManager.extractTokenFromHeader(authHeader);
      console.log(`🎫 Extracted token:`, token ? `${token.substring(0, 20)}...` : 'NONE');

      if (!token) {
        console.log(`❌ No token provided for ${req.path}`);
        res.status(401).json({
          error: 'Authentication required',
          message: 'No access token provided'
        });
        return;
      }

      console.log(`✅ Verifying token...`);
      const payload = TokenManager.verifyAccessToken(token);
      console.log(`👤 Token valid for user:`, payload.email, `(${payload.role})`);
      
      req.user = payload;
      
      next();
    } catch (error) {
      console.log(`❌ Token verification failed:`, error instanceof Error ? error.message : error);
      
      let message = 'Invalid token';
      let status = 401;

      if (error instanceof Error) {
        if (error.message === 'Token expired') {
          message = 'Token expired';
          status = 401;
        } else if (error.message === 'Invalid token') {
          message = 'Invalid token format';
          status = 401;
        }
      }

      res.status(status).json({
        error: 'Authentication failed',
        message
      });
    }
  };

  /**
   * Middleware to require admin role
   */
  static requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
      return;
    }

    if (req.user.role !== 'admin') {
      res.status(403).json({
        error: 'Admin access required',
        message: 'Insufficient permissions'
      });
      return;
    }

    next();
  };

  /**
   * Middleware to require user to be accessing their own resources
   */
  static requireSelfOrAdmin = (userIdParam: string = 'userId') => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'User not authenticated'
        });
        return;
      }

      const targetUserId = req.params[userIdParam];
      const isAdmin = req.user.role === 'admin';
      const isSelf = req.user.userId === targetUserId;

      if (!isAdmin && !isSelf) {
        res.status(403).json({
          error: 'Access denied',
          message: 'Can only access your own resources'
        });
        return;
      }

      next();
    };
  };

  /**
   * Optional authentication middleware (doesn't fail if no token)
   */
  static optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;
      const token = TokenManager.extractTokenFromHeader(authHeader);

      if (token) {
        const payload = TokenManager.verifyAccessToken(token);
        req.user = payload;
      }
      
      next();
    } catch (error) {
      // For optional auth, we don't fail on invalid tokens
      next();
    }
  };

  /**
   * Rate limiting based on user (authenticated users get higher limits)
   */
  static createRateLimitKey = (req: Request): string => {
    if (req.user) {
      return `user:${req.user.userId}`;
    }
    
    // Fallback to IP for unauthenticated requests
    return `ip:${req.ip}`;
  };

  /**
   * Middleware to check if setup is completed (for setup routes)
   */
  static requireSetupCompleted = (req: Request, res: Response, next: NextFunction): void => {
    // This will be implemented when we have setup detection
    // For now, assume setup is always required to be completed for protected routes
    next();
  };

  /**
   * Middleware to allow access only during setup phase
   */
  static requireSetupMode = (req: Request, res: Response, next: NextFunction): void => {
    // This will be implemented in Phase 2 when we add setup detection
    next();
  };

  /**
   * Create error response for authentication failures
   */
  private static createAuthError(message: string, statusCode: number = 401) {
    return {
      error: 'Authentication failed',
      message,
      statusCode,
      timestamp: new Date().toISOString()
    };
  }
}