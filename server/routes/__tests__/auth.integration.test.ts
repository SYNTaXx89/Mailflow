import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createAuthRouter } from '../auth'
import { DatabaseManager } from '../../database/DatabaseManager'
import { TokenManager } from '../../auth/TokenManager'
import { AuthMiddleware } from '../../auth/AuthMiddleware'
import { PasswordManager } from '../../auth/PasswordManager'

describe('Authentication Routes Integration Tests', () => {
  let app: express.Application
  let mockDatabaseManager: DatabaseManager
  let mockTokenManager: TokenManager
  let mockAuthMiddleware: AuthMiddleware

  const testUser = {
    id: 'user-123',
    email: 'test@example.com',
    password_hash: '$2b$12$hashedpassword',
    role: 'user' as const,
    created_at: '2023-12-01T10:00:00Z'
  }

  const testTokens = {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
    expiresIn: 3600
  }

  beforeEach(() => {
    // Create mock services
    mockDatabaseManager = {
      getUserByEmail: vi.fn(),
      getUserById: vi.fn(),
      updateUser: vi.fn(),
    } as unknown as DatabaseManager

    mockTokenManager = {
      generateTokenPair: vi.fn(),
      verifyRefreshToken: vi.fn(),
    } as unknown as TokenManager

    mockAuthMiddleware = {
      authenticate: vi.fn((req, res, next) => {
        // Mock authentication success by default
        req.user = { userId: 'user-123', email: 'test@example.com', role: 'user' }
        next()
      }),
    } as unknown as AuthMiddleware

    // Setup express app with auth routes
    app = express()
    app.use(express.json())
    app.use('/auth', createAuthRouter(mockDatabaseManager, mockTokenManager, mockAuthMiddleware))

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('POST /auth/login', () => {
    it('should successfully login with valid credentials', async () => {
      // Arrange
      mockDatabaseManager.getUserByEmail = vi.fn().mockResolvedValue(testUser)
      vi.spyOn(PasswordManager, 'compare').mockResolvedValue(true)
      vi.spyOn(PasswordManager, 'rehashIfNeeded').mockResolvedValue(null)
      mockTokenManager.generateTokenPair = vi.fn().mockReturnValue(testTokens)

      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'validpassword'
        })

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        message: 'Login successful',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'user'
        },
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123'
      })

      expect(mockDatabaseManager.getUserByEmail).toHaveBeenCalledWith('test@example.com')
      expect(PasswordManager.compare).toHaveBeenCalledWith('validpassword', '$2b$12$hashedpassword')
      expect(mockTokenManager.generateTokenPair).toHaveBeenCalledWith('user-123', 'test@example.com', 'user')
    })

    it('should return 400 for missing credentials', async () => {
      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com'
          // Missing password
        })

      // Assert
      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        error: 'Missing credentials',
        message: 'Email and password are required'
      })
    })

    it('should return 401 for non-existent user', async () => {
      // Arrange
      mockDatabaseManager.getUserByEmail = vi.fn().mockResolvedValue(null)

      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password'
        })

      // Assert
      expect(response.status).toBe(401)
      expect(response.body).toMatchObject({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      })
    })

    it('should return 401 for invalid password', async () => {
      // Arrange
      mockDatabaseManager.getUserByEmail = vi.fn().mockResolvedValue(testUser)
      vi.spyOn(PasswordManager, 'compare').mockResolvedValue(false)

      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })

      // Assert
      expect(response.status).toBe(401)
      expect(response.body).toMatchObject({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      })
    })

    it('should rehash password if needed', async () => {
      // Arrange
      const newHash = '$2b$14$newhashwithbettersecurity'
      mockDatabaseManager.getUserByEmail = vi.fn().mockResolvedValue(testUser)
      mockDatabaseManager.updateUser = vi.fn().mockResolvedValue(undefined)
      vi.spyOn(PasswordManager, 'compare').mockResolvedValue(true)
      vi.spyOn(PasswordManager, 'rehashIfNeeded').mockResolvedValue(newHash)
      mockTokenManager.generateTokenPair = vi.fn().mockReturnValue(testTokens)

      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'validpassword'
        })

      // Assert
      expect(response.status).toBe(200)
      expect(mockDatabaseManager.updateUser).toHaveBeenCalledWith('user-123', { password_hash: newHash })
    })

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockDatabaseManager.getUserByEmail = vi.fn().mockRejectedValue(new Error('Database error'))

      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password'
        })

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        error: 'Login failed',
        message: 'An error occurred during login'
      })
    })
  })

  describe('POST /auth/refresh', () => {
    it('should successfully refresh token with valid refresh token', async () => {
      // Arrange
      const refreshPayload = { userId: 'user-123', email: 'test@example.com', role: 'user' }
      mockTokenManager.verifyRefreshToken = vi.fn().mockReturnValue(refreshPayload)
      mockDatabaseManager.getUserById = vi.fn().mockResolvedValue(testUser)
      mockTokenManager.generateTokenPair = vi.fn().mockReturnValue(testTokens)

      // Act
      const response = await request(app)
        .post('/auth/refresh')
        .send({
          refreshToken: 'valid-refresh-token'
        })

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        message: 'Token refreshed successfully',
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123'
      })

      expect(mockTokenManager.verifyRefreshToken).toHaveBeenCalledWith('valid-refresh-token')
      expect(mockDatabaseManager.getUserById).toHaveBeenCalledWith('user-123')
    })

    it('should return 400 for missing refresh token', async () => {
      // Act
      const response = await request(app)
        .post('/auth/refresh')
        .send({})

      // Assert
      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        error: 'Missing refresh token',
        message: 'Refresh token is required'
      })
    })

    it('should return 401 for invalid refresh token', async () => {
      // Arrange
      mockTokenManager.verifyRefreshToken = vi.fn().mockImplementation(() => {
        throw new Error('Invalid token')
      })

      // Act
      const response = await request(app)
        .post('/auth/refresh')
        .send({
          refreshToken: 'invalid-token'
        })

      // Assert
      expect(response.status).toBe(401)
      expect(response.body).toMatchObject({
        error: 'Token refresh failed',
        message: 'Invalid refresh token'
      })
    })

    it('should return 401 for expired refresh token', async () => {
      // Arrange
      mockTokenManager.verifyRefreshToken = vi.fn().mockImplementation(() => {
        throw new Error('Token expired')
      })

      // Act
      const response = await request(app)
        .post('/auth/refresh')
        .send({
          refreshToken: 'expired-token'
        })

      // Assert
      expect(response.status).toBe(401)
      expect(response.body).toMatchObject({
        error: 'Token refresh failed',
        message: 'Refresh token expired'
      })
    })

    it('should return 401 when user no longer exists', async () => {
      // Arrange
      const refreshPayload = { userId: 'user-123', email: 'test@example.com', role: 'user' }
      mockTokenManager.verifyRefreshToken = vi.fn().mockReturnValue(refreshPayload)
      mockDatabaseManager.getUserById = vi.fn().mockResolvedValue(null)

      // Act
      const response = await request(app)
        .post('/auth/refresh')
        .send({
          refreshToken: 'valid-token-for-deleted-user'
        })

      // Assert
      expect(response.status).toBe(401)
      expect(response.body).toMatchObject({
        error: 'Invalid refresh token',
        message: 'User not found'
      })
    })
  })

  describe('POST /auth/logout', () => {
    it('should successfully logout authenticated user', async () => {
      // Act
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        message: 'Logged out successfully'
      })

      expect(mockAuthMiddleware.authenticate).toHaveBeenCalled()
    })

    it('should require authentication', async () => {
      // Arrange - Create new app with failing auth middleware
      const failingAuthMiddleware = {
        authenticate: vi.fn((req, res, next) => {
          res.status(401).json({ error: 'Unauthorized' })
        }),
      } as unknown as AuthMiddleware

      const testApp = express()
      testApp.use(express.json())
      testApp.use('/auth', createAuthRouter(mockDatabaseManager, mockTokenManager, failingAuthMiddleware))

      // Act
      const response = await request(testApp)
        .post('/auth/logout')

      // Assert
      expect(response.status).toBe(401)
      expect(response.body).toMatchObject({
        error: 'Unauthorized'
      })
    })
  })

  describe('GET /auth/me', () => {
    it('should return current user information', async () => {
      // Arrange
      mockDatabaseManager.getUserById = vi.fn().mockResolvedValue(testUser)

      // Act
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'user',
          created_at: '2023-12-01T10:00:00Z'
        }
      })

      expect(mockDatabaseManager.getUserById).toHaveBeenCalledWith('user-123')
    })

    it('should require authentication', async () => {
      // Arrange - Create new app with failing auth middleware
      const failingAuthMiddleware = {
        authenticate: vi.fn((req, res, next) => {
          res.status(401).json({ error: 'Unauthorized' })
        }),
      } as unknown as AuthMiddleware

      const testApp = express()
      testApp.use(express.json())
      testApp.use('/auth', createAuthRouter(mockDatabaseManager, mockTokenManager, failingAuthMiddleware))

      // Act
      const response = await request(testApp)
        .get('/auth/me')

      // Assert
      expect(response.status).toBe(401)
      expect(response.body).toMatchObject({
        error: 'Unauthorized'
      })
    })

    it('should return 404 when user no longer exists', async () => {
      // Arrange
      mockDatabaseManager.getUserById = vi.fn().mockResolvedValue(null)

      // Act
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(404)
      expect(response.body).toMatchObject({
        error: 'User not found',
        message: 'User no longer exists'
      })
    })

    it('should handle missing user in request', async () => {
      // Arrange - Create new app with auth middleware that sets null user
      const nullUserAuthMiddleware = {
        authenticate: vi.fn((req, res, next) => {
          req.user = null
          next()
        }),
      } as unknown as AuthMiddleware

      const testApp = express()
      testApp.use(express.json())
      testApp.use('/auth', createAuthRouter(mockDatabaseManager, mockTokenManager, nullUserAuthMiddleware))

      // Act
      const response = await request(testApp)
        .get('/auth/me')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(401)
      expect(response.body).toMatchObject({
        error: 'Not authenticated',
        message: 'User not found in request'
      })
    })
  })

  describe('POST /auth/change-password', () => {
    it('should successfully change password with valid input', async () => {
      // Arrange
      mockDatabaseManager.getUserById = vi.fn().mockResolvedValue(testUser)
      mockDatabaseManager.updateUser = vi.fn().mockResolvedValue(undefined)
      vi.spyOn(PasswordManager, 'validatePasswordStrength').mockReturnValue({
        isValid: true,
        errors: []
      })
      vi.spyOn(PasswordManager, 'compare').mockResolvedValue(true)
      vi.spyOn(PasswordManager, 'hash').mockResolvedValue('$2b$12$newhashedpassword')

      // Act
      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer valid-token')
        .send({
          currentPassword: 'oldpassword',
          newPassword: 'NewStrongPassword123!'
        })

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        message: 'Password changed successfully'
      })

      expect(PasswordManager.compare).toHaveBeenCalledWith('oldpassword', '$2b$12$hashedpassword')
      expect(PasswordManager.hash).toHaveBeenCalledWith('NewStrongPassword123!')
      expect(mockDatabaseManager.updateUser).toHaveBeenCalledWith('user-123', { 
        password_hash: '$2b$12$newhashedpassword' 
      })
    })

    it('should return 400 for missing passwords', async () => {
      // Act
      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer valid-token')
        .send({
          currentPassword: 'oldpassword'
          // Missing newPassword
        })

      // Assert
      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        error: 'Missing passwords',
        message: 'Current password and new password are required'
      })
    })

    it('should return 400 for weak new password', async () => {
      // Arrange
      vi.spyOn(PasswordManager, 'validatePasswordStrength').mockReturnValue({
        isValid: false,
        errors: ['Password too short', 'Missing special characters']
      })

      // Act
      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer valid-token')
        .send({
          currentPassword: 'oldpassword',
          newPassword: 'weak'
        })

      // Assert
      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        error: 'Weak password',
        message: 'Password does not meet security requirements',
        details: ['Password too short', 'Missing special characters']
      })
    })

    it('should return 401 for incorrect current password', async () => {
      // Arrange
      mockDatabaseManager.getUserById = vi.fn().mockResolvedValue(testUser)
      vi.spyOn(PasswordManager, 'validatePasswordStrength').mockReturnValue({
        isValid: true,
        errors: []
      })
      vi.spyOn(PasswordManager, 'compare').mockResolvedValue(false)

      // Act
      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer valid-token')
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'NewStrongPassword123!'
        })

      // Assert
      expect(response.status).toBe(401)
      expect(response.body).toMatchObject({
        error: 'Invalid current password',
        message: 'Current password is incorrect'
      })
    })

    it('should return 404 when user no longer exists', async () => {
      // Arrange
      mockDatabaseManager.getUserById = vi.fn().mockResolvedValue(null)
      vi.spyOn(PasswordManager, 'validatePasswordStrength').mockReturnValue({
        isValid: true,
        errors: []
      })

      // Act
      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer valid-token')
        .send({
          currentPassword: 'oldpassword',
          newPassword: 'NewStrongPassword123!'
        })

      // Assert
      expect(response.status).toBe(404)
      expect(response.body).toMatchObject({
        error: 'User not found',
        message: 'User no longer exists'
      })
    })

    it('should require authentication', async () => {
      // Arrange - Create new app with failing auth middleware
      const failingAuthMiddleware = {
        authenticate: vi.fn((req, res, next) => {
          res.status(401).json({ error: 'Unauthorized' })
        }),
      } as unknown as AuthMiddleware

      const testApp = express()
      testApp.use(express.json())
      testApp.use('/auth', createAuthRouter(mockDatabaseManager, mockTokenManager, failingAuthMiddleware))

      // Act
      const response = await request(testApp)
        .post('/auth/change-password')
        .send({
          currentPassword: 'oldpassword',
          newPassword: 'NewStrongPassword123!'
        })

      // Assert
      expect(response.status).toBe(401)
      expect(response.body).toMatchObject({
        error: 'Unauthorized'
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors in /auth/me', async () => {
      // Arrange
      mockDatabaseManager.getUserById = vi.fn().mockRejectedValue(new Error('Database connection failed'))

      // Act
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        error: 'Failed to get user info',
        message: 'An error occurred while fetching user information'
      })
    })

    it('should handle database errors in password change', async () => {
      // Arrange
      mockDatabaseManager.getUserById = vi.fn().mockRejectedValue(new Error('Database error'))
      vi.spyOn(PasswordManager, 'validatePasswordStrength').mockReturnValue({
        isValid: true,
        errors: []
      })

      // Act
      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer valid-token')
        .send({
          currentPassword: 'oldpassword',
          newPassword: 'NewStrongPassword123!'
        })

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        error: 'Password change failed',
        message: 'An error occurred while changing password'
      })
    })
  })
})