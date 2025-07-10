import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Request, Response } from 'express'
import { SetupController } from '../SetupController'
import { ConfigManager } from '../../config/ConfigManager'
import { DatabaseManager } from '../../database/DatabaseManager'
import { TokenManager } from '../../auth/TokenManager'
import { PasswordManager } from '../../auth/PasswordManager'

// Mock PasswordManager
vi.mock('../../auth/PasswordManager', () => ({
  PasswordManager: {
    hash: vi.fn(),
    validatePasswordStrength: vi.fn(),
  },
}))

describe('SetupController - Security Tests', () => {
  let setupController: SetupController
  let mockConfigManager: ConfigManager
  let mockDatabaseManager: DatabaseManager
  let mockTokenManager: TokenManager
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Create mock dependencies
    mockConfigManager = {
      isSetupCompleted: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      setDeep: vi.fn(),
      completeSetup: vi.fn(),
      initialize: vi.fn(),
    } as unknown as ConfigManager

    mockDatabaseManager = {
      initialize: vi.fn(),
      createUser: vi.fn(),
      getUserByEmail: vi.fn(),
      getAllUsers: vi.fn(),
      getHealthStatus: vi.fn(),
    } as unknown as DatabaseManager

    mockTokenManager = {
      generateTokenPair: vi.fn(),
    } as unknown as TokenManager

    // Create SetupController instance
    setupController = new SetupController(
      mockConfigManager,
      mockDatabaseManager,
      mockTokenManager
    )

    // Mock response object
    mockJson = vi.fn()
    mockStatus = vi.fn().mockReturnValue({ json: mockJson })
    
    mockRequest = {
      body: {},
      params: {},
      user: undefined,
    }
    
    mockResponse = {
      status: mockStatus,
      json: mockJson,
    }

    // Clear all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Setup Status Security', () => {
    it('should prevent setup operations when already completed', async () => {
      // Arrange
      mockConfigManager.isSetupCompleted = vi.fn().mockReturnValue(true)

      // Test initializeSetup
      await setupController.initializeSetup(mockRequest as Request, mockResponse as Response)
      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Setup already completed'
      }))

      vi.clearAllMocks()

      // Test createAdmin
      await setupController.createAdmin(mockRequest as Request, mockResponse as Response)
      expect(mockStatus).toHaveBeenCalledWith(403)
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Setup already completed'
      }))
    })

    it('should provide proper setup status when not completed', async () => {
      // Arrange
      mockConfigManager.isSetupCompleted = vi.fn().mockReturnValue(false)
      mockConfigManager.get = vi.fn()
        .mockReturnValueOnce('test-instance')
        .mockReturnValueOnce('1.0.0')
      mockDatabaseManager.getAllUsers = vi.fn().mockResolvedValue([])

      // Act
      await setupController.getSetupStatus(mockRequest as Request, mockResponse as Response)

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        needsSetup: true,
        step: 'welcome',
        message: 'Setup required'
      }))
    })
  })

  describe('Admin Creation Security', () => {
    beforeEach(() => {
      mockConfigManager.isSetupCompleted = vi.fn().mockReturnValue(false)
      vi.mocked(PasswordManager.hash).mockResolvedValue('hashed-password')
      vi.mocked(PasswordManager.validatePasswordStrength).mockReturnValue({
        isValid: true,
        errors: []
      })
    })

    it('should prevent duplicate admin creation', async () => {
      // Arrange
      mockDatabaseManager.getAllUsers = vi.fn().mockResolvedValue([
        { id: '1', email: 'existing@example.com', role: 'admin' }
      ])

      mockRequest.body = {
        email: 'admin@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      }

      // Act
      await setupController.createAdmin(mockRequest as Request, mockResponse as Response)

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(403)
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Admin already exists'
      }))
    })

    it('should validate required fields', async () => {
      // Arrange
      mockDatabaseManager.getAllUsers = vi.fn().mockResolvedValue([])
      mockRequest.body = {
        email: 'admin@example.com'
        // Missing password and confirmPassword
      }

      // Act
      await setupController.createAdmin(mockRequest as Request, mockResponse as Response)

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Missing required fields'
      }))
    })

    it('should validate password confirmation', async () => {
      // Arrange
      mockDatabaseManager.getAllUsers = vi.fn().mockResolvedValue([])
      mockRequest.body = {
        email: 'admin@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'DifferentPass123!'
      }

      // Act
      await setupController.createAdmin(mockRequest as Request, mockResponse as Response)

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Password mismatch'
      }))
    })

    it('should validate email format', async () => {
      // Arrange
      mockDatabaseManager.getAllUsers = vi.fn().mockResolvedValue([])
      mockRequest.body = {
        email: 'invalid-email',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      }

      // Act
      await setupController.createAdmin(mockRequest as Request, mockResponse as Response)

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid email'
      }))
    })

    it('should validate password strength', async () => {
      // Arrange
      mockDatabaseManager.getAllUsers = vi.fn().mockResolvedValue([])
      vi.mocked(PasswordManager.validatePasswordStrength).mockReturnValue({
        isValid: false,
        errors: ['Password too weak']
      })
      
      mockRequest.body = {
        email: 'admin@example.com',
        password: 'weak',
        confirmPassword: 'weak'
      }

      // Act
      await setupController.createAdmin(mockRequest as Request, mockResponse as Response)

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Weak password'
      }))
    })

    it('should prevent duplicate email addresses', async () => {
      // Arrange
      mockDatabaseManager.getAllUsers = vi.fn().mockResolvedValue([])
      mockDatabaseManager.getUserByEmail = vi.fn().mockResolvedValue({
        id: '1',
        email: 'admin@example.com',
        role: 'user'
      })
      
      mockRequest.body = {
        email: 'admin@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      }

      // Act
      await setupController.createAdmin(mockRequest as Request, mockResponse as Response)

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Email already exists'
      }))
    })

    it('should create admin successfully with valid data', async () => {
      // Arrange
      mockDatabaseManager.getAllUsers = vi.fn().mockResolvedValue([])
      mockDatabaseManager.getUserByEmail = vi.fn().mockResolvedValue(null)
      mockDatabaseManager.createUser = vi.fn().mockResolvedValue(undefined)
      mockTokenManager.generateTokenPair = vi.fn().mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      })
      
      mockRequest.body = {
        email: 'admin@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      }

      // Act
      await setupController.createAdmin(mockRequest as Request, mockResponse as Response)

      // Assert
      expect(PasswordManager.hash).toHaveBeenCalledWith('SecurePass123!')
      expect(mockDatabaseManager.createUser).toHaveBeenCalledWith(
        expect.any(String),
        'admin@example.com',
        'hashed-password',
        'admin'
      )
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: expect.objectContaining({
          email: 'admin@example.com',
          role: 'admin'
        })
      }))
    })
  })

  describe('Database Health Check', () => {
    it('should handle database health check in initialization', async () => {
      // Arrange
      mockConfigManager.isSetupCompleted = vi.fn().mockReturnValue(false)
      mockDatabaseManager.getHealthStatus = vi.fn().mockResolvedValue({
        healthy: false,
        message: 'Database connection failed'
      })

      // Act
      await setupController.initializeSetup(mockRequest as Request, mockResponse as Response)

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Database not ready'
      }))
    })

    it('should proceed with healthy database', async () => {
      // Arrange
      mockConfigManager.isSetupCompleted = vi.fn().mockReturnValue(false)
      mockConfigManager.get = vi.fn().mockReturnValue('test-instance')
      mockDatabaseManager.getHealthStatus = vi.fn().mockResolvedValue({
        healthy: true,
        message: 'Database is healthy'
      })

      // Act
      await setupController.initializeSetup(mockRequest as Request, mockResponse as Response)

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        nextStep: 'admin'
      }))
    })
  })

  describe('Error Handling', () => {
    it('should handle errors in status check gracefully', async () => {
      // Arrange
      mockConfigManager.isSetupCompleted = vi.fn().mockImplementation(() => {
        throw new Error('Config error')
      })

      // Act
      await setupController.getSetupStatus(mockRequest as Request, mockResponse as Response)

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Setup status check failed'
      }))
    })
  })
})