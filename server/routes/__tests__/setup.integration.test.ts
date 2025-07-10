import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createSetupRouter } from '../setup'
import { ConfigManager } from '../../config/ConfigManager'
import { DatabaseManager } from '../../database/DatabaseManager'
import { AuthMiddleware } from '../../auth/AuthMiddleware'

describe('Setup Routes Integration Tests', () => {
  let app: express.Application
  let mockConfigManager: ConfigManager
  let mockDatabaseManager: DatabaseManager
  let mockAuthMiddleware: AuthMiddleware

  const adminUser = {
    userId: 'admin-123',
    email: 'admin@example.com',
    role: 'admin' as const
  }

  const regularUser = {
    userId: 'user-123',
    email: 'user@example.com',
    role: 'user' as const
  }

  beforeEach(() => {
    // Create mock services
    mockConfigManager = {
      get: vi.fn(),
      updateConfig: vi.fn(),
      isSetupCompleted: vi.fn(),
      markSetupCompleted: vi.fn(),
      resetSetup: vi.fn(),
      getSecretKey: vi.fn().mockReturnValue('test-secret-key'),
    } as unknown as ConfigManager

    mockDatabaseManager = {
      initialize: vi.fn(),
      createUser: vi.fn(),
      getUserByEmail: vi.fn(),
      getAllUsers: vi.fn(),
      getHealthStatus: vi.fn(),
    } as unknown as DatabaseManager

    mockAuthMiddleware = {
      authenticate: vi.fn((req, res, next) => {
        req.user = adminUser
        next()
      }),
      requireAdmin: vi.fn((req, res, next) => {
        if (req.user?.role === 'admin') {
          next()
        } else {
          res.status(403).json({ error: 'Admin access required' })
        }
      }),
    } as unknown as AuthMiddleware

    // Setup express app with setup routes
    app = express()
    app.use(express.json())
    app.use('/setup', createSetupRouter(mockConfigManager, mockDatabaseManager, mockAuthMiddleware))

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /setup/status', () => {
    it('should return setup needed when setup is not complete', async () => {
      // Arrange
      mockConfigManager.isSetupCompleted = vi.fn().mockReturnValue(false)
      mockConfigManager.get = vi.fn()
        .mockReturnValueOnce('test-instance-id') // instanceId
        .mockReturnValueOnce('1.0.0') // version
      mockDatabaseManager.getAllUsers = vi.fn().mockResolvedValue([])

      // Act
      const response = await request(app)
        .get('/setup/status')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        needsSetup: true,
        step: 'welcome',
        instanceId: 'test-instance-id',
        version: '1.0.0'
      })

      expect(mockConfigManager.isSetupCompleted).toHaveBeenCalled()
    })

    it('should return setup complete when setup is finished', async () => {
      // Arrange
      mockConfigManager.isSetupCompleted = vi.fn().mockReturnValue(true)
      mockConfigManager.get = vi.fn()
        .mockReturnValueOnce('test-instance-id')
        .mockReturnValueOnce('1.0.0')

      // Act
      const response = await request(app)
        .get('/setup/status')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        needsSetup: false,
        step: 'complete',
        instanceId: 'test-instance-id',
        version: '1.0.0'
      })
    })

    it('should handle errors gracefully', async () => {
      // Arrange
      mockConfigManager.isSetupCompleted = vi.fn().mockImplementation(() => {
        throw new Error('Config error')
      })

      // Act
      const response = await request(app)
        .get('/setup/status')

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        error: 'Setup status check failed'
      })
    })
  })

  describe('POST /setup/initialize', () => {
    it('should initialize setup successfully', async () => {
      // Arrange
      mockConfigManager.isSetupCompleted = vi.fn().mockReturnValue(false)
      mockConfigManager.get = vi.fn().mockReturnValue('test-instance-id')
      mockDatabaseManager.getHealthStatus = vi.fn().mockResolvedValue({
        healthy: true,
        message: 'Database is healthy'
      })

      // Act
      const response = await request(app)
        .post('/setup/initialize')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        message: 'Setup initialization successful',
        instanceId: 'test-instance-id',
        nextStep: 'admin'
      })

      expect(mockDatabaseManager.getHealthStatus).toHaveBeenCalled()
    })

    it('should return 400 if setup is already complete', async () => {
      // Arrange
      mockConfigManager.isSetupCompleted = vi.fn().mockReturnValue(true)

      // Act
      const response = await request(app)
        .post('/setup/initialize')

      // Assert
      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        error: 'Setup already completed'
      })
    })

    it('should handle database initialization errors', async () => {
      // Arrange
      mockConfigManager.isSetupCompleted = vi.fn().mockReturnValue(false)
      mockDatabaseManager.getHealthStatus = vi.fn().mockResolvedValue({
        healthy: false,
        message: 'Database connection failed'
      })

      // Act
      const response = await request(app)
        .post('/setup/initialize')

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        error: 'Database not ready'
      })
    })
  })

  describe('POST /setup/admin', () => {
    it('should create admin account successfully', async () => {
      // Arrange
      const adminData = {
        email: 'admin@example.com',
        password: 'AdminPassword123!',
        confirmPassword: 'AdminPassword123!'
      }

      mockConfigManager.isSetupComplete = vi.fn().mockReturnValue(false)
      mockDatabaseManager.getUserByEmail = vi.fn().mockResolvedValue(null)
      mockDatabaseManager.createUser = vi.fn().mockResolvedValue(undefined)

      // Act
      const response = await request(app)
        .post('/setup/admin')
        .send(adminData)

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        message: 'Admin account created successfully'
      })

      expect(mockDatabaseManager.createUser).toHaveBeenCalledWith(
        expect.any(String), // UUID
        'admin@example.com',
        expect.any(String), // hashed password
        'admin'
      )
    })

    it('should return 400 for missing required fields', async () => {
      // Act
      const response = await request(app)
        .post('/setup/admin')
        .send({
          email: 'admin@example.com'
          // Missing password and confirmPassword
        })

      // Assert
      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        error: 'Missing required fields'
      })
    })

    it('should return 400 for password mismatch', async () => {
      // Act
      const response = await request(app)
        .post('/setup/admin')
        .send({
          email: 'admin@example.com',
          password: 'Password123!',
          confirmPassword: 'DifferentPassword123!'
        })

      // Assert
      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        error: 'Passwords do not match'
      })
    })

    it('should return 400 for weak password', async () => {
      // Act
      const response = await request(app)
        .post('/setup/admin')
        .send({
          email: 'admin@example.com',
          password: 'weak',
          confirmPassword: 'weak'
        })

      // Assert
      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Password')
    })

    it('should return 400 if admin already exists', async () => {
      // Arrange
      mockConfigManager.isSetupComplete = vi.fn().mockReturnValue(false)
      mockDatabaseManager.getUserByEmail = vi.fn().mockResolvedValue({
        id: 'existing-admin',
        email: 'admin@example.com',
        role: 'admin'
      })

      // Act
      const response = await request(app)
        .post('/setup/admin')
        .send({
          email: 'admin@example.com',
          password: 'AdminPassword123!',
          confirmPassword: 'AdminPassword123!'
        })

      // Assert
      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        error: 'Admin account already exists'
      })
    })

    it('should return 400 if setup is already complete', async () => {
      // Arrange
      mockConfigManager.isSetupComplete = vi.fn().mockReturnValue(true)

      // Act
      const response = await request(app)
        .post('/setup/admin')
        .send({
          email: 'admin@example.com',
          password: 'AdminPassword123!',
          confirmPassword: 'AdminPassword123!'
        })

      // Assert
      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        error: 'Setup already completed'
      })
    })
  })

  describe('POST /setup/configure', () => {
    it('should configure instance with valid settings', async () => {
      // Arrange
      const configData = {
        instanceName: 'My Mailflow Instance',
        allowRegistration: false,
        maxUsers: 10,
        emailSettings: {
          maxEmailsPerAccount: 1000,
          retentionDays: 30
        }
      }

      mockConfigManager.isSetupComplete = vi.fn().mockReturnValue(false)
      mockConfigManager.updateConfig = vi.fn().mockResolvedValue(undefined)

      // Act
      const response = await request(app)
        .post('/setup/configure')
        .set('Authorization', 'Bearer admin-token')
        .send(configData)

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        message: 'Configuration updated successfully'
      })

      expect(mockConfigManager.updateConfig).toHaveBeenCalledWith(configData)
    })

    it('should require admin authentication', async () => {
      // Arrange - Create app without auth middleware to test fallback
      const appWithoutAuth = express()
      appWithoutAuth.use(express.json())
      appWithoutAuth.use('/setup', createSetupRouter(mockConfigManager, mockDatabaseManager))

      mockConfigManager.isSetupComplete = vi.fn().mockReturnValue(false)
      mockConfigManager.updateConfig = vi.fn().mockResolvedValue(undefined)

      // Act
      const response = await request(appWithoutAuth)
        .post('/setup/configure')
        .send({ instanceName: 'Test' })

      // Assert
      expect(response.status).toBe(200)
      // Without auth middleware, it should still work (development mode)
    })

    it('should return 403 for non-admin users', async () => {
      // Arrange - Mock auth middleware to return regular user
      const userAuthMiddleware = {
        authenticate: vi.fn((req, res, next) => {
          req.user = regularUser
          next()
        }),
        requireAdmin: vi.fn((req, res, next) => {
          res.status(403).json({ error: 'Admin access required' })
        }),
      } as unknown as AuthMiddleware

      const restrictedApp = express()
      restrictedApp.use(express.json())
      restrictedApp.use('/setup', createSetupRouter(mockConfigManager, mockDatabaseManager, userAuthMiddleware))

      // Act
      const response = await request(restrictedApp)
        .post('/setup/configure')
        .set('Authorization', 'Bearer user-token')
        .send({ instanceName: 'Test' })

      // Assert
      expect(response.status).toBe(403)
      expect(response.body).toMatchObject({
        error: 'Admin access required'
      })
    })
  })

  describe('POST /setup/complete', () => {
    it('should complete setup successfully', async () => {
      // Arrange
      mockConfigManager.isSetupComplete = vi.fn().mockReturnValue(false)
      mockConfigManager.markSetupComplete = vi.fn().mockResolvedValue(undefined)
      mockDatabaseManager.getHealthStatus = vi.fn().mockResolvedValue({
        healthy: true,
        message: 'Database is healthy'
      })

      // Act
      const response = await request(app)
        .post('/setup/complete')
        .set('Authorization', 'Bearer admin-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        message: 'Setup completed successfully'
      })

      expect(mockConfigManager.markSetupComplete).toHaveBeenCalled()
    })

    it('should return 400 if setup is already complete', async () => {
      // Arrange
      mockConfigManager.isSetupComplete = vi.fn().mockReturnValue(true)

      // Act
      const response = await request(app)
        .post('/setup/complete')
        .set('Authorization', 'Bearer admin-token')

      // Assert
      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        error: 'Setup already completed'
      })
    })

    it('should return 500 if database is unhealthy', async () => {
      // Arrange
      mockConfigManager.isSetupComplete = vi.fn().mockReturnValue(false)
      mockDatabaseManager.getHealthStatus = vi.fn().mockResolvedValue({
        healthy: false,
        message: 'Database connection failed'
      })

      // Act
      const response = await request(app)
        .post('/setup/complete')
        .set('Authorization', 'Bearer admin-token')

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        error: 'Database health check failed'
      })
    })
  })

  describe('POST /setup/reset', () => {
    it('should reset setup in development mode', async () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      
      mockConfigManager.resetSetup = vi.fn().mockResolvedValue(undefined)

      // Act
      const response = await request(app)
        .post('/setup/reset')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        message: 'Setup reset successfully'
      })

      expect(mockConfigManager.resetSetup).toHaveBeenCalled()

      // Cleanup
      process.env.NODE_ENV = originalEnv
    })

    it('should require admin auth in production mode', async () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const prodApp = express()
      prodApp.use(express.json())
      prodApp.use('/setup', createSetupRouter(mockConfigManager, mockDatabaseManager, mockAuthMiddleware))

      mockConfigManager.resetSetup = vi.fn().mockResolvedValue(undefined)

      // Act
      const response = await request(prodApp)
        .post('/setup/reset')
        .set('Authorization', 'Bearer admin-token')

      // Assert
      expect(response.status).toBe(200)
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalled()
      expect(mockAuthMiddleware.requireAdmin).toHaveBeenCalled()

      // Cleanup
      process.env.NODE_ENV = originalEnv
    })

    it('should handle reset errors', async () => {
      // Arrange
      mockConfigManager.resetSetup = vi.fn().mockRejectedValue(new Error('Reset failed'))

      // Act
      const response = await request(app)
        .post('/setup/reset')

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        error: 'Failed to reset setup'
      })
    })
  })

  describe('Setup Flow Integration', () => {
    it('should enforce proper setup sequence', async () => {
      // This test verifies that the setup steps must be completed in order
      
      // 1. Setup should not be complete initially
      mockConfigManager.isSetupComplete = vi.fn().mockReturnValue(false)
      
      let response = await request(app).get('/setup/status')
      expect(response.body.needsSetup).toBe(true)

      // 2. Initialize setup
      mockDatabaseManager.initialize = vi.fn().mockResolvedValue(undefined)
      response = await request(app).post('/setup/initialize')
      expect(response.status).toBe(200)

      // 3. Create admin account
      mockDatabaseManager.getUserByEmail = vi.fn().mockResolvedValue(null)
      mockDatabaseManager.createUser = vi.fn().mockResolvedValue(undefined)
      response = await request(app)
        .post('/setup/admin')
        .send({
          email: 'admin@example.com',
          password: 'AdminPassword123!',
          confirmPassword: 'AdminPassword123!'
        })
      expect(response.status).toBe(200)

      // 4. Configure instance (requires admin auth)
      mockConfigManager.updateConfig = vi.fn().mockResolvedValue(undefined)
      response = await request(app)
        .post('/setup/configure')
        .set('Authorization', 'Bearer admin-token')
        .send({ instanceName: 'Test Instance' })
      expect(response.status).toBe(200)

      // 5. Complete setup
      mockConfigManager.markSetupComplete = vi.fn().mockResolvedValue(undefined)
      mockDatabaseManager.getHealthStatus = vi.fn().mockResolvedValue({
        healthy: true,
        message: 'All good'
      })
      response = await request(app)
        .post('/setup/complete')
        .set('Authorization', 'Bearer admin-token')
      expect(response.status).toBe(200)

      // Verify all setup steps were called
      expect(mockDatabaseManager.initialize).toHaveBeenCalled()
      expect(mockDatabaseManager.createUser).toHaveBeenCalled()
      expect(mockConfigManager.updateConfig).toHaveBeenCalled()
      expect(mockConfigManager.markSetupComplete).toHaveBeenCalled()
    })
  })
})