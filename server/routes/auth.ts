/**
 * Authentication Routes
 * 
 * Handles user authentication, token management, and session operations
 * for the self-hosted Mailflow instance.
 */

import express from 'express';
import crypto from 'crypto';
import { DatabaseManager } from '../database/DatabaseManager';
import { PasswordManager } from '../auth/PasswordManager';
import { TokenManager } from '../auth/TokenManager';
import { AuthMiddleware } from '../auth/AuthMiddleware';

export const createAuthRouter = (databaseManager: DatabaseManager, tokenManager: TokenManager, authMiddleware: AuthMiddleware) => {
  const router = express.Router();

/**
 * POST /auth/login
 * Authenticate user and return tokens
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const user = await databaseManager.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Verify password
    const isValidPassword = await PasswordManager.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Check if password needs rehashing (security upgrade)
    const newHash = await PasswordManager.rehashIfNeeded(password, user.password_hash);
    if (newHash) {
      // Update user with new hash
      await databaseManager.updateUser(user.id, { password_hash: newHash });
      console.log('✅ Password rehashed for security upgrade:', user.email);
    }

    // Generate token pair
    const tokens = tokenManager.generateTokenPair(user.id, user.email, user.role);

    // Return success response
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      ...tokens
    });

    console.log('✅ User logged in:', user.email);
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'An error occurred during login'
    });
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Missing refresh token',
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const payload = tokenManager.verifyRefreshToken(refreshToken);

    // Verify user still exists
    const user = await databaseManager.getUserById(payload.userId);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        message: 'User not found'
      });
    }

    // Generate new token pair
    const tokens = tokenManager.generateTokenPair(user.id, user.email, user.role);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      ...tokens
    });

    console.log('✅ Token refreshed for user:', user.email);
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    
    let message = 'Token refresh failed';
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        message = 'Refresh token expired';
      } else if (error.message.includes('Invalid')) {
        message = 'Invalid refresh token';
      }
    }

    res.status(401).json({
      error: 'Token refresh failed',
      message
    });
  }
});

/**
 * POST /auth/logout
 * Invalidate user session (placeholder for future token blacklisting)
 */
router.post('/logout', authMiddleware.authenticate, async (req, res) => {
  try {
    // For now, just log the logout
    // In the future, we could implement token blacklisting
    
    console.log('✅ User logged out:', req.user?.email);
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: 'An error occurred during logout'
    });
  }
});

/**
 * GET /auth/me
 * Get current user information
 */
router.get('/me', authMiddleware.authenticate, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
        message: 'User not found in request'
      });
    }

    // Get fresh user data from database
    const user = await databaseManager.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User no longer exists'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('❌ Get user info error:', error);
    res.status(500).json({
      error: 'Failed to get user info',
      message: 'An error occurred while fetching user information'
    });
  }
});

/**
 * POST /auth/change-password
 * Change user password
 */
router.post('/change-password', authMiddleware.authenticate, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
        message: 'User not found in request'
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Missing passwords',
        message: 'Current password and new password are required'
      });
    }

    // Validate new password strength
    const passwordValidation = PasswordManager.validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: 'Weak password',
        message: 'Password does not meet security requirements',
        details: passwordValidation.errors
      });
    }

    // Get user from database
    const user = await databaseManager.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User no longer exists'
      });
    }

    // Verify current password
    const isValidCurrentPassword = await PasswordManager.compare(currentPassword, user.password_hash);
    if (!isValidCurrentPassword) {
      return res.status(401).json({
        error: 'Invalid current password',
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const newPasswordHash = await PasswordManager.hash(newPassword);

    // Update password in database
    await databaseManager.updateUser(user.id, { password_hash: newPasswordHash });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

    console.log('✅ Password changed for user:', user.email);
  } catch (error) {
    console.error('❌ Change password error:', error);
    res.status(500).json({
      error: 'Password change failed',
      message: 'An error occurred while changing password'
    });
  }
});

  return router;
};

// Temporary backward compatibility
export default createAuthRouter;