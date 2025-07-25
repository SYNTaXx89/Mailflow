import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Request, Response, NextFunction } from 'express'
import { AuthMiddleware } from '../AuthMiddleware'
import { TokenManager } from '../TokenManager'
import { DatabaseManager } from '../../database/DatabaseManager'

// Create mock instances
const mockTokenManager = {
  extractTokenFromHeader: vi.fn(),
  verifyAccessToken: vi.fn(),
} as unknown as TokenManager

const mockDatabaseManager = {
  getAccountById: vi.fn(),
} as unknown as DatabaseManager

describe('AuthMiddleware', () => {
  let authMiddleware: AuthMiddleware
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let mockNext: NextFunction
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Create new AuthMiddleware instance with mocked dependencies
    authMiddleware = new AuthMiddleware(mockTokenManager, mockDatabaseManager)
    
    mockJson = vi.fn()
    mockStatus = vi.fn().mockReturnValue({ json: mockJson })
    
    mockRequest = {
      headers: {},
      params: {},
      user: undefined,
    }
    
    mockResponse = {
      status: mockStatus,
      json: mockJson,
    }
    
    mockNext = vi.fn()
    
    // Clear all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('authenticate', () => {
    it('should authenticate valid JWT token', () => {
      // Arrange
      const mockToken = 'valid.jwt.token'
      const mockPayload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user',
      }

      mockRequest.headers!.authorization = `Bearer ${mockToken}`
      vi.mocked(mockTokenManager.extractTokenFromHeader).mockReturnValue(mockToken)
      vi.mocked(mockTokenManager.verifyAccessToken).mockReturnValue(mockPayload)

      // Act
      authMiddleware.authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(mockTokenManager.extractTokenFromHeader).toHaveBeenCalledWith(`Bearer ${mockToken}`)
      expect(mockTokenManager.verifyAccessToken).toHaveBeenCalledWith(mockToken)
      expect(mockRequest.user).toEqual(mockPayload)
      expect(mockNext).toHaveBeenCalled()
      expect(mockStatus).not.toHaveBeenCalled()
    })

    it('should reject request with missing authorization header', () => {
      // Arrange
      mockRequest.headers!.authorization = undefined
      vi.mocked(mockTokenManager.extractTokenFromHeader).mockReturnValue(null)

      // Act
      authMiddleware.authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Authentication required',
        message: 'No access token provided'
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should reject request with malformed authorization header', () => {
      // Arrange
      mockRequest.headers!.authorization = 'InvalidFormat'
      vi.mocked(mockTokenManager.extractTokenFromHeader).mockReturnValue(null)

      // Act
      authMiddleware.authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Authentication required',
        message: 'No access token provided'
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should reject expired token', () => {
      // Arrange
      const mockToken = 'expired.jwt.token'
      mockRequest.headers!.authorization = `Bearer ${mockToken}`
      vi.mocked(mockTokenManager.extractTokenFromHeader).mockReturnValue(mockToken)
      vi.mocked(mockTokenManager.verifyAccessToken).mockImplementation(() => {
        throw new Error('Token expired')
      })

      // Act
      authMiddleware.authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Authentication failed',
        message: 'Token expired'
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should reject invalid token', () => {
      // Arrange
      const mockToken = 'invalid.jwt.token'
      mockRequest.headers!.authorization = `Bearer ${mockToken}`
      vi.mocked(mockTokenManager.extractTokenFromHeader).mockReturnValue(mockToken)
      vi.mocked(mockTokenManager.verifyAccessToken).mockImplementation(() => {
        throw new Error('Invalid token')
      })

      // Act
      authMiddleware.authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Authentication failed',
        message: 'Invalid token format'
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should handle generic token verification errors', () => {
      // Arrange
      const mockToken = 'problematic.jwt.token'
      mockRequest.headers!.authorization = `Bearer ${mockToken}`
      vi.mocked(mockTokenManager.extractTokenFromHeader).mockReturnValue(mockToken)
      vi.mocked(mockTokenManager.verifyAccessToken).mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      // Act
      authMiddleware.authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Authentication failed',
        message: 'Invalid token'
      })
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('requireAdmin', () => {
    it('should allow admin users', () => {
      // Arrange
      mockRequest.user = {
        userId: 'admin123',
        email: 'admin@example.com',
        role: 'admin',
      }

      // Act
      authMiddleware.requireAdmin(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(mockNext).toHaveBeenCalled()
      expect(mockStatus).not.toHaveBeenCalled()
    })

    it('should reject non-admin users', () => {
      // Arrange
      mockRequest.user = {
        userId: 'user123',
        email: 'user@example.com',
        role: 'user',
      }

      // Act
      authMiddleware.requireAdmin(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(403)
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Admin access required',
        message: 'Insufficient permissions'
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should reject unauthenticated users', () => {
      // Arrange
      mockRequest.user = undefined

      // Act
      authMiddleware.requireAdmin(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Authentication required',
        message: 'User not authenticated'
      })
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('requireAccountOwnership', () => {
    beforeEach(() => {
      // Reset the shared mock before each test
      vi.mocked(mockDatabaseManager.getAccountById).mockClear()
    })

    it('should allow account owner to access their account', async () => {
      // Arrange
      const accountId = 'account123'
      const userId = 'user123'
      
      mockRequest.user = {
        userId,
        email: 'user@example.com',
        role: 'user',
      }
      mockRequest.params = { accountId }

      const mockAccount = {
        id: accountId,
        user_id: userId,
        name: 'Test Account',
        email: 'test@example.com',
      }

      vi.mocked(mockDatabaseManager.getAccountById).mockResolvedValue(mockAccount)

      const middleware = authMiddleware.requireAccountOwnership()

      // Act
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(mockDatabaseManager.getAccountById).toHaveBeenCalledWith(accountId)
      expect(mockNext).toHaveBeenCalled()
      expect(mockRequest.account).toEqual(mockAccount)
      expect(mockStatus).not.toHaveBeenCalled()
    })

    it('should allow admin to access any account', async () => {
      // Arrange
      const accountId = 'account123'
      const adminId = 'admin123'
      const ownerId = 'user123'
      
      mockRequest.user = {
        userId: adminId,
        email: 'admin@example.com',
        role: 'admin',
      }
      mockRequest.params = { accountId }

      const mockAccount = {
        id: accountId,
        user_id: ownerId, // Different from admin ID
        name: 'Test Account',
        email: 'test@example.com',
      }

      vi.mocked(mockDatabaseManager.getAccountById).mockResolvedValue(mockAccount)

      const middleware = authMiddleware.requireAccountOwnership()

      // Act
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(mockDatabaseManager.getAccountById).toHaveBeenCalledWith(accountId)
      expect(mockNext).toHaveBeenCalled()
      expect(mockRequest.account).toEqual(mockAccount)
      expect(mockStatus).not.toHaveBeenCalled()
    })

    it('should reject user accessing another users account', async () => {
      // Arrange
      const accountId = 'account123'
      const userId = 'user123'
      const ownerId = 'other456'
      
      mockRequest.user = {
        userId,
        email: 'user@example.com',
        role: 'user',
      }
      mockRequest.params = { accountId }

      const mockAccount = {
        id: accountId,
        user_id: ownerId, // Different owner
        name: 'Other Account',
        email: 'other@example.com',
      }

      vi.mocked(mockDatabaseManager.getAccountById).mockResolvedValue(mockAccount)

      const middleware = authMiddleware.requireAccountOwnership()

      // Act
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(mockDatabaseManager.getAccountById).toHaveBeenCalledWith(accountId)
      expect(mockStatus).toHaveBeenCalledWith(403)
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to access this account'
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should reject request for non-existent account', async () => {
      // Arrange
      const accountId = 'nonexistent123'
      
      mockRequest.user = {
        userId: 'user123',
        email: 'user@example.com',
        role: 'user',
      }
      mockRequest.params = { accountId }

      vi.mocked(mockDatabaseManager.getAccountById).mockResolvedValue(undefined)

      const middleware = authMiddleware.requireAccountOwnership()

      // Act
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(mockDatabaseManager.getAccountById).toHaveBeenCalledWith(accountId)
      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Account not found'
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should reject unauthenticated users', async () => {
      // Arrange
      mockRequest.user = undefined
      mockRequest.params = { accountId: 'account123' }

      const middleware = authMiddleware.requireAccountOwnership()

      // Act
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Authentication required',
        message: 'User not authenticated'
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should reject request with missing accountId parameter', async () => {
      // Arrange
      mockRequest.user = {
        userId: 'user123',
        email: 'user@example.com',
        role: 'user',
      }
      mockRequest.params = {} // Missing accountId

      const middleware = authMiddleware.requireAccountOwnership()

      // Act
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Bad request',
        message: 'Missing accountId parameter'
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      // Arrange
      const accountId = 'account123'
      
      mockRequest.user = {
        userId: 'user123',
        email: 'user@example.com',
        role: 'user',
      }
      mockRequest.params = { accountId }

      vi.mocked(mockDatabaseManager.getAccountById).mockRejectedValue(
        new Error('Database connection failed')
      )

      const middleware = authMiddleware.requireAccountOwnership()

      // Act
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Authorization check failed',
        message: 'Unable to verify account ownership'
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should use custom parameter name when provided', async () => {
      // Arrange
      const customParam = 'customAccountId'
      const accountId = 'account123'
      
      mockRequest.user = {
        userId: 'user123',
        email: 'user@example.com',
        role: 'user',
      }
      mockRequest.params = { [customParam]: accountId }

      const mockAccount = {
        id: accountId,
        user_id: 'user123',
        name: 'Test Account',
        email: 'test@example.com',
      }

      vi.mocked(mockDatabaseManager.getAccountById).mockResolvedValue(mockAccount)

      const middleware = authMiddleware.requireAccountOwnership(customParam)

      // Act
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(mockDatabaseManager.getAccountById).toHaveBeenCalledWith(accountId)
      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('requireSelfOrAdmin', () => {
    it('should allow user to access their own resources', () => {
      // Arrange
      const userId = 'user123'
      mockRequest.user = {
        userId,
        email: 'user@example.com',
        role: 'user',
      }
      mockRequest.params = { userId }

      const middleware = authMiddleware.requireSelfOrAdmin()

      // Act
      middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(mockNext).toHaveBeenCalled()
      expect(mockStatus).not.toHaveBeenCalled()
    })

    it('should allow admin to access any user resources', () => {
      // Arrange
      mockRequest.user = {
        userId: 'admin123',
        email: 'admin@example.com',
        role: 'admin',
      }
      mockRequest.params = { userId: 'other456' }

      const middleware = authMiddleware.requireSelfOrAdmin()

      // Act
      middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(mockNext).toHaveBeenCalled()
      expect(mockStatus).not.toHaveBeenCalled()
    })

    it('should reject user accessing other user resources', () => {
      // Arrange
      mockRequest.user = {
        userId: 'user123',
        email: 'user@example.com',
        role: 'user',
      }
      mockRequest.params = { userId: 'other456' }

      const middleware = authMiddleware.requireSelfOrAdmin()

      // Act
      middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      )

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(403)
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Access denied',
        message: 'Can only access your own resources'
      })
      expect(mockNext).not.toHaveBeenCalled()
    })
  })
})