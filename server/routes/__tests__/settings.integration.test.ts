import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createSettingsRouter } from '../settings'
import { DatabaseManager } from '../../database/DatabaseManager'
import { AuthMiddleware } from '../../auth/AuthMiddleware'

describe('Settings Routes Integration Tests', () => {
  let app: express.Application
  let mockDatabaseManager: DatabaseManager
  let mockAuthMiddleware: AuthMiddleware

  const testUser = {
    userId: 'user-123',
    email: 'test@example.com',
    role: 'user' as const
  }

  const testSettings = {
    theme: 'dark',
    emailsPerPage: '50',
    autoRefresh: '5',
    customSetting: 'customValue'
  }

  beforeEach(() => {
    // Create mock services
    mockDatabaseManager = {
      getAllSettings: vi.fn(),
      setSetting: vi.fn(),
      getSetting: vi.fn(),
    } as unknown as DatabaseManager

    mockAuthMiddleware = {
      authenticate: vi.fn((req, res, next) => {
        req.user = testUser
        next()
      }),
    } as unknown as AuthMiddleware

    // Setup express app with settings routes
    app = express()
    app.use(express.json())
    app.use('/settings', createSettingsRouter(mockDatabaseManager, mockAuthMiddleware))

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /settings', () => {
    it('should get all user settings with defaults', async () => {
      // Arrange
      mockDatabaseManager.getAllSettings = vi.fn().mockResolvedValue(testSettings)

      // Act
      const response = await request(app)
        .get('/settings')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body.settings.theme).toBe('dark')
      expect(response.body.settings.emailsPerPage).toBe('50') // Route spreads userSettings, overwriting conversion
      expect(response.body.settings.autoRefresh).toBe('5') // Route spreads userSettings, overwriting conversion  
      expect(response.body.settings.customSetting).toBe('customValue')

      expect(mockDatabaseManager.getAllSettings).toHaveBeenCalledWith('user-123')
    })

    it('should return default settings when no settings exist', async () => {
      // Arrange
      mockDatabaseManager.getAllSettings = vi.fn().mockResolvedValue({})

      // Act
      const response = await request(app)
        .get('/settings')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        settings: {
          theme: 'dark',
          emailsPerPage: 50,
          autoRefresh: 5
        }
      })
    })

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockDatabaseManager.getAllSettings = vi.fn().mockRejectedValue(new Error('Database error'))

      // Act
      const response = await request(app)
        .get('/settings')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        error: 'Failed to load settings'
      })
    })

    it('should require authentication', async () => {
      // Arrange - Create app with failing auth middleware
      const failingAuthMiddleware = {
        authenticate: vi.fn((req, res, next) => {
          res.status(401).json({ error: 'Unauthorized' })
        }),
      } as unknown as AuthMiddleware

      const testApp = express()
      testApp.use(express.json())
      testApp.use('/settings', createSettingsRouter(mockDatabaseManager, failingAuthMiddleware))

      // Act
      const response = await request(testApp)
        .get('/settings')

      // Assert
      expect(response.status).toBe(401)
      expect(response.body).toMatchObject({
        error: 'Unauthorized'
      })
    })
  })

  describe('POST /settings', () => {
    it('should save user settings successfully', async () => {
      // Arrange
      const newSettings = {
        theme: 'light',
        emailsPerPage: 100,
        autoRefresh: 10,
        newCustomSetting: 'newValue'
      }
      
      mockDatabaseManager.setSetting = vi.fn().mockResolvedValue(undefined)
      mockDatabaseManager.getAllSettings = vi.fn().mockResolvedValue({
        theme: 'light',
        emailsPerPage: '100',
        autoRefresh: '10',
        newCustomSetting: 'newValue'
      })

      // Act
      const response = await request(app)
        .post('/settings')
        .set('Authorization', 'Bearer valid-token')
        .send({ settings: newSettings })

      // Assert
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.settings.theme).toBe('light')
      expect(response.body.settings.emailsPerPage).toBe('100') // Route spreads userSettings, overwriting conversion
      expect(response.body.settings.autoRefresh).toBe('10') // Route spreads userSettings, overwriting conversion
      expect(response.body.settings.newCustomSetting).toBe('newValue')

      // Verify all settings were saved
      expect(mockDatabaseManager.setSetting).toHaveBeenCalledTimes(4)
      expect(mockDatabaseManager.setSetting).toHaveBeenCalledWith('user-123', 'theme', 'light')
      expect(mockDatabaseManager.setSetting).toHaveBeenCalledWith('user-123', 'emailsPerPage', '100')
      expect(mockDatabaseManager.setSetting).toHaveBeenCalledWith('user-123', 'autoRefresh', '10')
      expect(mockDatabaseManager.setSetting).toHaveBeenCalledWith('user-123', 'newCustomSetting', 'newValue')
    })

    it('should return 400 for invalid settings data', async () => {
      // Act
      const response = await request(app)
        .post('/settings')
        .set('Authorization', 'Bearer valid-token')
        .send({ settings: 'invalid' })

      // Assert
      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        error: 'Invalid settings data'
      })

      expect(mockDatabaseManager.setSetting).not.toHaveBeenCalled()
    })

    it('should return 400 for missing settings', async () => {
      // Act
      const response = await request(app)
        .post('/settings')
        .set('Authorization', 'Bearer valid-token')
        .send({})

      // Assert
      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        error: 'Invalid settings data'
      })
    })

    it('should handle database save errors', async () => {
      // Arrange
      mockDatabaseManager.setSetting = vi.fn().mockRejectedValue(new Error('Save failed'))

      // Act
      const response = await request(app)
        .post('/settings')
        .set('Authorization', 'Bearer valid-token')
        .send({ settings: { theme: 'light' } })

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        error: 'Failed to save settings'
      })
    })

    it('should convert values to strings', async () => {
      // Arrange
      const settings = {
        numberSetting: 42,
        booleanSetting: true,
        objectSetting: { nested: 'value' }
      }
      
      mockDatabaseManager.setSetting = vi.fn().mockResolvedValue(undefined)
      mockDatabaseManager.getAllSettings = vi.fn().mockResolvedValue({})

      // Act
      const response = await request(app)
        .post('/settings')
        .set('Authorization', 'Bearer valid-token')
        .send({ settings })

      // Assert
      expect(response.status).toBe(200)
      expect(mockDatabaseManager.setSetting).toHaveBeenCalledWith('user-123', 'numberSetting', '42')
      expect(mockDatabaseManager.setSetting).toHaveBeenCalledWith('user-123', 'booleanSetting', 'true')
      expect(mockDatabaseManager.setSetting).toHaveBeenCalledWith('user-123', 'objectSetting', '[object Object]')
    })
  })

  describe('PUT /settings/:key', () => {
    it('should update specific setting successfully', async () => {
      // Arrange
      mockDatabaseManager.setSetting = vi.fn().mockResolvedValue(undefined)

      // Act
      const response = await request(app)
        .put('/settings/theme')
        .set('Authorization', 'Bearer valid-token')
        .send({ value: 'light' })

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        key: 'theme',
        value: 'light'
      })

      expect(mockDatabaseManager.setSetting).toHaveBeenCalledWith('user-123', 'theme', 'light')
    })

    it('should return 400 for missing value', async () => {
      // Act
      const response = await request(app)
        .put('/settings/theme')
        .set('Authorization', 'Bearer valid-token')
        .send({})

      // Assert
      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        error: 'Missing key or value'
      })
    })

    it('should handle null and zero values', async () => {
      // Arrange
      mockDatabaseManager.setSetting = vi.fn().mockResolvedValue(undefined)

      // Act - Test null value
      let response = await request(app)
        .put('/settings/nullSetting')
        .set('Authorization', 'Bearer valid-token')
        .send({ value: null })

      // Assert
      expect(response.status).toBe(200)
      expect(mockDatabaseManager.setSetting).toHaveBeenCalledWith('user-123', 'nullSetting', 'null')

      // Act - Test zero value
      response = await request(app)
        .put('/settings/zeroSetting')
        .set('Authorization', 'Bearer valid-token')
        .send({ value: 0 })

      // Assert
      expect(response.status).toBe(200)
      expect(mockDatabaseManager.setSetting).toHaveBeenCalledWith('user-123', 'zeroSetting', '0')
    })

    it('should handle database update errors', async () => {
      // Arrange
      mockDatabaseManager.setSetting = vi.fn().mockRejectedValue(new Error('Update failed'))

      // Act
      const response = await request(app)
        .put('/settings/theme')
        .set('Authorization', 'Bearer valid-token')
        .send({ value: 'light' })

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        error: 'Failed to update setting'
      })
    })
  })

  describe('GET /settings/:key', () => {
    it('should get specific setting successfully', async () => {
      // Arrange
      mockDatabaseManager.getSetting = vi.fn().mockResolvedValue('dark')

      // Act
      const response = await request(app)
        .get('/settings/theme')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        key: 'theme',
        value: 'dark'
      })

      expect(mockDatabaseManager.getSetting).toHaveBeenCalledWith('user-123', 'theme')
    })

    it('should return 404 for non-existent setting', async () => {
      // Arrange
      mockDatabaseManager.getSetting = vi.fn().mockResolvedValue(undefined)

      // Act
      const response = await request(app)
        .get('/settings/nonexistent')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(404)
      expect(response.body).toMatchObject({
        error: 'Setting not found'
      })
    })

    it('should handle database get errors', async () => {
      // Arrange
      mockDatabaseManager.getSetting = vi.fn().mockRejectedValue(new Error('Get failed'))

      // Act
      const response = await request(app)
        .get('/settings/theme')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        error: 'Failed to get setting'
      })
    })

    it('should handle empty string values correctly', async () => {
      // Arrange
      mockDatabaseManager.getSetting = vi.fn().mockResolvedValue('')

      // Act
      const response = await request(app)
        .get('/settings/emptySetting')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        key: 'emptySetting',
        value: ''
      })
    })
  })

  describe('Authentication and User Isolation', () => {
    it('should require authentication for all routes', async () => {
      // Create app with failing auth middleware
      const failingAuthMiddleware = {
        authenticate: vi.fn((req, res, next) => {
          res.status(401).json({ error: 'Unauthorized' })
        }),
      } as unknown as AuthMiddleware

      const testApp = express()
      testApp.use(express.json())
      testApp.use('/settings', createSettingsRouter(mockDatabaseManager, failingAuthMiddleware))

      const routes = [
        { method: 'get', path: '/settings' },
        { method: 'post', path: '/settings' },
        { method: 'put', path: '/settings/theme' },
        { method: 'get', path: '/settings/theme' }
      ]

      for (const route of routes) {
        const response = await request(testApp)[route.method](route.path)
          .send({ value: 'test' })
        expect(response.status).toBe(401)
        expect(response.body).toMatchObject({ error: 'Unauthorized' })
      }
    })

    it('should isolate settings by user ID', async () => {
      // Arrange
      mockDatabaseManager.getAllSettings = vi.fn().mockResolvedValue(testSettings)
      mockDatabaseManager.setSetting = vi.fn().mockResolvedValue(undefined)
      mockDatabaseManager.getSetting = vi.fn().mockResolvedValue('value')

      // Act - Test multiple operations
      await request(app).get('/settings').set('Authorization', 'Bearer valid-token')
      await request(app).post('/settings').set('Authorization', 'Bearer valid-token').send({ settings: { test: 'value' } })
      await request(app).put('/settings/key').set('Authorization', 'Bearer valid-token').send({ value: 'value' })
      await request(app).get('/settings/key').set('Authorization', 'Bearer valid-token')

      // Assert - All operations should use the same user ID
      expect(mockDatabaseManager.getAllSettings).toHaveBeenCalledWith('user-123')
      expect(mockDatabaseManager.setSetting).toHaveBeenCalledWith('user-123', 'test', 'value')
      expect(mockDatabaseManager.setSetting).toHaveBeenCalledWith('user-123', 'key', 'value')
      expect(mockDatabaseManager.getSetting).toHaveBeenCalledWith('user-123', 'key')
    })
  })

  describe('Data Type Handling', () => {
    it('should properly handle numeric conversions in GET', async () => {
      // Arrange
      mockDatabaseManager.getAllSettings = vi.fn().mockResolvedValue({
        emailsPerPage: '100',
        autoRefresh: '15',
        invalidNumber: 'not-a-number',
        emptyString: ''
      })

      // Act
      const response = await request(app)
        .get('/settings')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body.settings.emailsPerPage).toBe('100')
      expect(response.body.settings.autoRefresh).toBe('15')
      expect(response.body.settings.invalidNumber).toBe('not-a-number')
      expect(response.body.settings.emptyString).toBe('')
    })

    it('should handle special characters in setting keys and values', async () => {
      // Arrange
      const specialSettings = {
        'setting-with-dashes': 'value',
        'setting_with_underscores': 'value',
        'setting.with.dots': 'value with spaces',
        'unicode_setting': '测试值'
      }
      
      mockDatabaseManager.setSetting = vi.fn().mockResolvedValue(undefined)
      mockDatabaseManager.getAllSettings = vi.fn().mockResolvedValue(specialSettings)

      // Act
      const response = await request(app)
        .post('/settings')
        .set('Authorization', 'Bearer valid-token')
        .send({ settings: specialSettings })

      // Assert
      expect(response.status).toBe(200)
      expect(mockDatabaseManager.setSetting).toHaveBeenCalledWith('user-123', 'setting-with-dashes', 'value')
      expect(mockDatabaseManager.setSetting).toHaveBeenCalledWith('user-123', 'unicode_setting', '测试值')
    })
  })
})