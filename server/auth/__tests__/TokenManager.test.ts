import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { TokenManager, TokenPayload, RefreshTokenPayload } from '../TokenManager'
import { ConfigManager } from '../../config/ConfigManager'

// Mock dependencies
vi.mock('jsonwebtoken')
vi.mock('crypto')
vi.mock('../../config/ConfigManager')

describe('TokenManager', () => {
  const mockSecret = 'test-jwt-secret-key'
  const mockUserId = 'user123'
  const mockEmail = 'test@example.com'
  const mockRole = 'user' as const
  const mockTokenId = 'token-uuid-123'
  
  let mockConfigManager: ConfigManager
  let tokenManager: TokenManager

  beforeEach(() => {
    // Create mock ConfigManager instance
    mockConfigManager = {
      getDeep: vi.fn().mockImplementation((path: string) => {
        if (path === 'security.jwtSecret') return mockSecret
        if (path === 'security.sessionTimeout') return 3600
        return null
      })
    } as unknown as ConfigManager
    
    // Create TokenManager instance with mock dependency
    tokenManager = new TokenManager(mockConfigManager)

    vi.mocked(crypto.randomUUID).mockReturnValue(mockTokenId)
    vi.mocked(jwt.sign).mockReturnValue('mock.jwt.token')
    vi.mocked(jwt.verify).mockReturnValue({
      userId: mockUserId,
      email: mockEmail,
      role: mockRole,
    })
    vi.mocked(jwt.decode).mockReturnValue({
      userId: mockUserId,
      email: mockEmail,
      role: mockRole,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })

    // Clear all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('generateAccessToken', () => {
    it('should generate access token with correct payload', () => {
      // Arrange
      const payload = {
        userId: mockUserId,
        email: mockEmail,
        role: mockRole,
      }

      // Act
      const result = tokenManager.generateAccessToken(payload)

      // Assert
      expect(jwt.sign).toHaveBeenCalledWith(
        payload,
        mockSecret,
        {
          expiresIn: '1h',
          issuer: 'mailflow',
          audience: 'mailflow-users'
        }
      )
      expect(result).toBe('mock.jwt.token')
    })

    it('should throw error when JWT secret is not configured', () => {
      // Arrange
      vi.mocked(mockConfigManager.getDeep).mockReturnValue(null)

      const payload = {
        userId: mockUserId,
        email: mockEmail,
        role: mockRole,
      }

      // Act & Assert
      expect(() => tokenManager.generateAccessToken(payload)).toThrow('Token generation failed')
    })

    it('should handle JWT signing errors', () => {
      // Arrange
      vi.mocked(jwt.sign).mockImplementation(() => {
        throw new Error('JWT signing failed')
      })

      const payload = {
        userId: mockUserId,
        email: mockEmail,
        role: mockRole,
      }

      // Act & Assert
      expect(() => tokenManager.generateAccessToken(payload)).toThrow('Token generation failed')
    })
  })

  describe('generateRefreshToken', () => {
    it('should generate refresh token with correct payload', () => {
      // Arrange
      const payload = {
        userId: mockUserId,
        email: mockEmail,
        tokenId: mockTokenId,
      }

      // Act
      const result = tokenManager.generateRefreshToken(payload)

      // Assert
      expect(jwt.sign).toHaveBeenCalledWith(
        payload,
        mockSecret,
        {
          expiresIn: '7d',
          issuer: 'mailflow',
          audience: 'mailflow-refresh'
        }
      )
      expect(result).toBe('mock.jwt.token')
    })

    it('should throw error when JWT secret is not configured', () => {
      // Arrange
      vi.mocked(mockConfigManager.getDeep).mockReturnValue(null)

      const payload = {
        userId: mockUserId,
        email: mockEmail,
        tokenId: mockTokenId,
      }

      // Act & Assert
      expect(() => tokenManager.generateRefreshToken(payload)).toThrow('Refresh token generation failed')
    })

    it('should handle JWT signing errors', () => {
      // Arrange
      vi.mocked(jwt.sign).mockImplementation(() => {
        throw new Error('JWT signing failed')
      })

      const payload = {
        userId: mockUserId,
        email: mockEmail,
        tokenId: mockTokenId,
      }

      // Act & Assert
      expect(() => tokenManager.generateRefreshToken(payload)).toThrow('Refresh token generation failed')
    })
  })

  describe('verifyAccessToken', () => {
    it('should verify and decode valid access token', () => {
      // Arrange
      const token = 'valid.jwt.token'
      const expectedPayload: TokenPayload = {
        userId: mockUserId,
        email: mockEmail,
        role: mockRole,
      }

      vi.mocked(jwt.verify).mockReturnValue(expectedPayload)

      // Act
      const result = tokenManager.verifyAccessToken(token)

      // Assert
      expect(jwt.verify).toHaveBeenCalledWith(
        token,
        mockSecret,
        {
          issuer: 'mailflow',
          audience: 'mailflow-users'
        }
      )
      expect(result).toEqual(expectedPayload)
    })

    it('should handle expired token error', () => {
      // Arrange
      const token = 'expired.jwt.token'
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date())
      })

      // Act & Assert
      expect(() => tokenManager.verifyAccessToken(token)).toThrow('Token expired')
    })

    it('should handle invalid token error', () => {
      // Arrange
      const token = 'invalid.jwt.token'
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token')
      })

      // Act & Assert
      expect(() => tokenManager.verifyAccessToken(token)).toThrow('Invalid token')
    })

    it('should handle generic verification errors', () => {
      // Arrange
      const token = 'problematic.jwt.token'
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      // Act & Assert
      expect(() => tokenManager.verifyAccessToken(token)).toThrow('Token verification failed')
    })

    it('should throw error when JWT secret is not configured', () => {
      // Arrange
      vi.mocked(mockConfigManager.getDeep).mockReturnValue(null)

      const token = 'valid.jwt.token'

      // Act & Assert
      expect(() => tokenManager.verifyAccessToken(token)).toThrow('Token verification failed')
    })
  })

  describe('verifyRefreshToken', () => {
    it('should verify and decode valid refresh token', () => {
      // Arrange
      const token = 'valid.refresh.token'
      const expectedPayload: RefreshTokenPayload = {
        userId: mockUserId,
        email: mockEmail,
        tokenId: mockTokenId,
      }

      vi.mocked(jwt.verify).mockReturnValue(expectedPayload)

      // Act
      const result = tokenManager.verifyRefreshToken(token)

      // Assert
      expect(jwt.verify).toHaveBeenCalledWith(
        token,
        mockSecret,
        {
          issuer: 'mailflow',
          audience: 'mailflow-refresh'
        }
      )
      expect(result).toEqual(expectedPayload)
    })

    it('should handle expired refresh token error', () => {
      // Arrange
      const token = 'expired.refresh.token'
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date())
      })

      // Act & Assert
      expect(() => tokenManager.verifyRefreshToken(token)).toThrow('Refresh token expired')
    })

    it('should handle invalid refresh token error', () => {
      // Arrange
      const token = 'invalid.refresh.token'
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token')
      })

      // Act & Assert
      expect(() => tokenManager.verifyRefreshToken(token)).toThrow('Invalid refresh token')
    })

    it('should handle generic refresh token verification errors', () => {
      // Arrange
      const token = 'problematic.refresh.token'
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      // Act & Assert
      expect(() => tokenManager.verifyRefreshToken(token)).toThrow('Refresh token verification failed')
    })
  })

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      // Arrange
      const token = 'valid.jwt.token'
      const authHeader = `Bearer ${token}`

      // Act
      const result = tokenManager.extractTokenFromHeader(authHeader)

      // Assert
      expect(result).toBe(token)
    })

    it('should return null for undefined header', () => {
      // Act
      const result = tokenManager.extractTokenFromHeader(undefined)

      // Assert
      expect(result).toBeNull()
    })

    it('should return null for malformed header - missing Bearer', () => {
      // Arrange
      const authHeader = 'valid.jwt.token'

      // Act
      const result = tokenManager.extractTokenFromHeader(authHeader)

      // Assert
      expect(result).toBeNull()
    })

    it('should return null for malformed header - wrong scheme', () => {
      // Arrange
      const authHeader = 'Basic dXNlcjpwYXNz'

      // Act
      const result = tokenManager.extractTokenFromHeader(authHeader)

      // Assert
      expect(result).toBeNull()
    })

    it('should return null for malformed header - too many parts', () => {
      // Arrange
      const authHeader = 'Bearer token extra'

      // Act
      const result = tokenManager.extractTokenFromHeader(authHeader)

      // Assert
      expect(result).toBeNull()
    })

    it('should return null for empty header', () => {
      // Arrange
      const authHeader = ''

      // Act
      const result = tokenManager.extractTokenFromHeader(authHeader)

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      // Arrange
      vi.mocked(jwt.sign)
        .mockReturnValueOnce('mock.access.token')
        .mockReturnValueOnce('mock.refresh.token')

      // Act
      const result = tokenManager.generateTokenPair(mockUserId, mockEmail, mockRole)

      // Assert
      expect(result).toEqual({
        accessToken: 'mock.access.token',
        refreshToken: 'mock.refresh.token',
        expiresIn: 3600,
      })

      // Verify both tokens were generated
      expect(jwt.sign).toHaveBeenCalledTimes(2)
      
      // Verify access token call
      expect(jwt.sign).toHaveBeenNthCalledWith(1,
        { userId: mockUserId, email: mockEmail, role: mockRole },
        mockSecret,
        {
          expiresIn: '1h',
          issuer: 'mailflow',
          audience: 'mailflow-users'
        }
      )

      // Verify refresh token call
      expect(jwt.sign).toHaveBeenNthCalledWith(2,
        { userId: mockUserId, email: mockEmail, tokenId: mockTokenId },
        mockSecret,
        {
          expiresIn: '7d',
          issuer: 'mailflow',
          audience: 'mailflow-refresh'
        }
      )

      // Verify UUID generation for tokenId
      expect(crypto.randomUUID).toHaveBeenCalled()
    })

    it('should use default session timeout when not configured', () => {
      // Arrange
      vi.mocked(mockConfigManager.getDeep).mockImplementation((path: string) => {
        if (path === 'security.jwtSecret') return mockSecret
        if (path === 'security.sessionTimeout') return null
        return null
      })

      // Act
      const result = tokenManager.generateTokenPair(mockUserId, mockEmail, mockRole)

      // Assert
      expect(result.expiresIn).toBe(3600) // Default value
    })
  })

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      // Arrange
      const token = 'valid.jwt.token'
      const expectedPayload = {
        userId: mockUserId,
        email: mockEmail,
        role: mockRole,
      }

      vi.mocked(jwt.decode).mockReturnValue(expectedPayload)

      // Act
      const result = tokenManager.decodeToken(token)

      // Assert
      expect(jwt.decode).toHaveBeenCalledWith(token)
      expect(result).toEqual(expectedPayload)
    })

    it('should return null for decode errors', () => {
      // Arrange
      const token = 'invalid.jwt.token'
      vi.mocked(jwt.decode).mockImplementation(() => {
        throw new Error('Decode failed')
      })

      // Act
      const result = tokenManager.decodeToken(token)

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('isTokenExpired', () => {
    it('should return false for valid unexpired token', () => {
      // Arrange
      const token = 'valid.jwt.token'
      const futureExp = Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      
      vi.mocked(jwt.decode).mockReturnValue({
        userId: mockUserId,
        email: mockEmail,
        exp: futureExp,
      })

      // Act
      const result = tokenManager.isTokenExpired(token)

      // Assert
      expect(result).toBe(false)
    })

    it('should return true for expired token', () => {
      // Arrange
      const token = 'expired.jwt.token'
      const pastExp = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      
      vi.mocked(jwt.decode).mockReturnValue({
        userId: mockUserId,
        email: mockEmail,
        exp: pastExp,
      })

      // Act
      const result = tokenManager.isTokenExpired(token)

      // Assert
      expect(result).toBe(true)
    })

    it('should return true for token without expiration', () => {
      // Arrange
      const token = 'token.without.exp'
      
      vi.mocked(jwt.decode).mockReturnValue({
        userId: mockUserId,
        email: mockEmail,
        // No exp field
      })

      // Act
      const result = tokenManager.isTokenExpired(token)

      // Assert
      expect(result).toBe(true)
    })

    it('should return true for invalid token', () => {
      // Arrange
      const token = 'invalid.jwt.token'
      vi.mocked(jwt.decode).mockReturnValue(null)

      // Act
      const result = tokenManager.isTokenExpired(token)

      // Assert
      expect(result).toBe(true)
    })

    it('should return true for decode errors', () => {
      // Arrange
      const token = 'problematic.jwt.token'
      vi.mocked(jwt.decode).mockImplementation(() => {
        throw new Error('Decode failed')
      })

      // Act
      const result = tokenManager.isTokenExpired(token)

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('getTokenExpiration', () => {
    it('should return expiration date for valid token', () => {
      // Arrange
      const token = 'valid.jwt.token'
      const exp = Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      const expectedDate = new Date(exp * 1000)
      
      vi.mocked(jwt.decode).mockReturnValue({
        userId: mockUserId,
        email: mockEmail,
        exp: exp,
      })

      // Act
      const result = tokenManager.getTokenExpiration(token)

      // Assert
      expect(result).toEqual(expectedDate)
    })

    it('should return null for token without expiration', () => {
      // Arrange
      const token = 'token.without.exp'
      
      vi.mocked(jwt.decode).mockReturnValue({
        userId: mockUserId,
        email: mockEmail,
        // No exp field
      })

      // Act
      const result = tokenManager.getTokenExpiration(token)

      // Assert
      expect(result).toBeNull()
    })

    it('should return null for invalid token', () => {
      // Arrange
      const token = 'invalid.jwt.token'
      vi.mocked(jwt.decode).mockReturnValue(null)

      // Act
      const result = tokenManager.getTokenExpiration(token)

      // Assert
      expect(result).toBeNull()
    })

    it('should return null for decode errors', () => {
      // Arrange
      const token = 'problematic.jwt.token'
      vi.mocked(jwt.decode).mockImplementation(() => {
        throw new Error('Decode failed')
      })

      // Act
      const result = tokenManager.getTokenExpiration(token)

      // Assert
      expect(result).toBeNull()
    })
  })
})