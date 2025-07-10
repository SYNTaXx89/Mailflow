import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { ConfigManager } from '../ConfigManager'

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}))

// Mock crypto module for deterministic tests
vi.mock('crypto', () => ({
  default: {
    randomUUID: vi.fn(() => 'test-uuid-123'),
    randomBytes: vi.fn(() => Buffer.from('test-secret-key')),
  },
}))

describe('ConfigManager', () => {
  let configManager: ConfigManager
  let mockConfig: any

  beforeEach(() => {
    // Setup default mock config
    mockConfig = {
      version: '1.0.0',
      instanceId: 'test-instance-id',
      instanceName: 'Test Instance',
      setup: {
        completed: false,
        completedAt: null
      },
      database: {
        path: '/test/path/database.db',
        encryptionEnabled: true,
        backupEnabled: false,
        backupInterval: '24h'
      },
      security: {
        jwtSecret: 'test-jwt-secret-that-is-at-least-32-characters-long',
        sessionTimeout: 3600,
        rateLimitEnabled: true
      },
      features: {
        multiUser: false,
        invitations: false,
        backups: false
      }
    }

    // Clear all mocks
    vi.clearAllMocks()

    // Create new ConfigManager instance
    configManager = new ConfigManager()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Constructor and Initialization', () => {
    it('should create ConfigManager with correct paths', () => {
      expect(configManager.getConfigDir()).toContain('.mailflow')
      expect(configManager.getConfigPath()).toContain('config.json')
    })

    it('should use environment variable for data directory', () => {
      // Arrange
      const originalEnv = process.env.MAILFLOW_DATA_DIR
      process.env.MAILFLOW_DATA_DIR = '/custom/data/dir'

      // Act
      const customConfigManager = new ConfigManager()

      // Assert
      expect(customConfigManager.getConfigDir()).toBe('/custom/data/dir')

      // Restore
      process.env.MAILFLOW_DATA_DIR = originalEnv
    })

    it('should initialize with existing config file', async () => {
      // Arrange
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (path.toString().includes('.mailflow')) return true
        if (path.toString().includes('config.json')) return true
        return false
      })
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig))

      // Act
      await configManager.initialize()

      // Assert
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('config.json'),
        'utf8'
      )
      expect(configManager.get('instanceId')).toBe('test-instance-id')
    })

    it('should create default config when file does not exist', async () => {
      // Arrange
      vi.mocked(fs.existsSync).mockReturnValue(false)

      // Act
      await configManager.initialize()

      // Assert
      expect(fs.mkdirSync).toHaveBeenCalledTimes(3)
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      )
      expect(fs.writeFileSync).toHaveBeenCalled()
    })

    it('should handle initialization errors', async () => {
      // Arrange
      vi.mocked(fs.existsSync).mockImplementation(() => {
        throw new Error('File system error')
      })

      // Act & Assert
      await expect(configManager.initialize()).rejects.toThrow('File system error')
    })
  })

  describe('Configuration Loading and Validation', () => {
    it('should validate loaded configuration', async () => {
      // Arrange
      const invalidConfig = { ...mockConfig }
      delete invalidConfig.security.jwtSecret

      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(invalidConfig))

      // Act & Assert
      await expect(configManager.initialize()).rejects.toThrow()
    })

    it('should handle malformed JSON configuration', async () => {
      // Arrange
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json')

      // Act & Assert
      await expect(configManager.initialize()).rejects.toThrow()
    })

    it('should create valid default configuration', async () => {
      // Arrange
      vi.mocked(fs.existsSync).mockReturnValue(false)
      let savedConfig: any

      vi.mocked(fs.writeFileSync).mockImplementation((path, data) => {
        savedConfig = JSON.parse(data.toString())
      })

      // Act
      await configManager.initialize()

      // Assert
      expect(savedConfig).toMatchObject({
        version: expect.any(String),
        instanceId: expect.any(String),
        instanceName: expect.any(String),
        setup: {
          completed: false
        },
        security: {
          jwtSecret: expect.any(String),
          sessionTimeout: expect.any(Number),
          rateLimitEnabled: expect.any(Boolean)
        },
        features: {
          multiUser: expect.any(Boolean),
          invitations: expect.any(Boolean),
          backups: expect.any(Boolean)
        }
      })
    })
  })

  describe('Configuration Get/Set Operations', () => {
    beforeEach(async () => {
      // Initialize with mock config
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig))
      await configManager.initialize()
    })

    it('should get top-level configuration values', () => {
      expect(configManager.get('instanceId')).toBe('test-instance-id')
      expect(configManager.get('instanceName')).toBe('Test Instance')
      expect(configManager.get('version')).toBe('1.0.0')
    })

    it('should get deep configuration values', () => {
      expect(configManager.getDeep('security.jwtSecret')).toBe('test-jwt-secret-that-is-at-least-32-characters-long')
      expect(configManager.getDeep('features.multiUser')).toBe(false)
      expect(configManager.getDeep('setup.completed')).toBe(false)
    })

    it('should handle undefined paths in getDeep', () => {
      expect(configManager.getDeep('nonexistent.path')).toBeUndefined()
      expect(configManager.getDeep('security.nonexistent')).toBeUndefined()
    })

    it('should set top-level configuration values', async () => {
      // Act
      await configManager.set('instanceName', 'Updated Instance')

      // Assert
      expect(configManager.get('instanceName')).toBe('Updated Instance')
      expect(fs.writeFileSync).toHaveBeenCalled()
    })

    it('should set deep configuration values', async () => {
      // Act
      await configManager.setDeep('features.multiUser', true)

      // Assert
      expect(configManager.getDeep('features.multiUser')).toBe(true)
      expect(fs.writeFileSync).toHaveBeenCalled()
    })

    it('should handle complex nested paths in setDeep', async () => {
      // Act
      await configManager.setDeep('smtp.auth.user', 'test@example.com')

      // Assert
      expect(configManager.getDeep('smtp.auth.user')).toBe('test@example.com')
    })
  })

  describe('Setup Management', () => {
    beforeEach(async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig))
      await configManager.initialize()
    })

    it('should report setup as not completed initially', () => {
      expect(configManager.isSetupCompleted()).toBe(false)
    })

    it('should complete setup with admin details', async () => {
      // Act
      await configManager.completeSetup('admin@example.com', 'hashed-password')

      // Assert
      expect(configManager.isSetupCompleted()).toBe(true)
      expect(configManager.getDeep('admin.email')).toBe('admin@example.com')
      expect(configManager.getDeep('admin.passwordHash')).toBe('hashed-password')
      expect(configManager.getDeep('setup.completedAt')).toBeDefined()
    })

    it('should save configuration after setup completion', async () => {
      // Act
      await configManager.completeSetup('admin@example.com', 'hashed-password')

      // Assert
      expect(fs.writeFileSync).toHaveBeenCalled()
    })
  })

  describe('Security Validation', () => {
    it('should require JWT secret in configuration', async () => {
      // Arrange
      const configWithoutJWTSecret = { ...mockConfig }
      delete configWithoutJWTSecret.security.jwtSecret

      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(configWithoutJWTSecret))

      // Act & Assert
      await expect(configManager.initialize()).rejects.toThrow()
    })

    it('should require instance ID in configuration', async () => {
      // Arrange
      const configWithoutInstanceId = { ...mockConfig }
      delete configWithoutInstanceId.instanceId

      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(configWithoutInstanceId))

      // Act & Assert
      await expect(configManager.initialize()).rejects.toThrow()
    })

    it('should validate security settings structure', async () => {
      // Arrange
      const configWithInvalidSecurity = { ...mockConfig }
      configWithInvalidSecurity.security = {}

      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(configWithInvalidSecurity))

      // Act & Assert
      await expect(configManager.initialize()).rejects.toThrow()
    })

    it('should generate secure defaults', async () => {
      // Arrange
      vi.mocked(fs.existsSync).mockReturnValue(false)
      let savedConfig: any

      vi.mocked(fs.writeFileSync).mockImplementation((path, data) => {
        savedConfig = JSON.parse(data.toString())
      })

      // Act
      await configManager.initialize()

      // Assert
      expect(savedConfig.security.jwtSecret).toBeDefined()
      expect(savedConfig.security.jwtSecret.length).toBeGreaterThan(0)
      expect(savedConfig.instanceId).toBeDefined()
      expect(savedConfig.security.sessionTimeout).toBe(3600) // 1 hour default
    })
  })

  describe('Environment Variable Handling', () => {
    it('should use MAILFLOW_DATA_DIR environment variable', () => {
      // Arrange
      const originalEnv = process.env.MAILFLOW_DATA_DIR
      process.env.MAILFLOW_DATA_DIR = '/custom/mailflow/data'

      // Act
      const envConfigManager = new ConfigManager()

      // Assert
      expect(envConfigManager.getConfigDir()).toBe('/custom/mailflow/data')

      // Restore
      process.env.MAILFLOW_DATA_DIR = originalEnv
    })

    it('should fall back to default directory when env var not set', () => {
      // Arrange
      const originalEnv = process.env.MAILFLOW_DATA_DIR
      delete process.env.MAILFLOW_DATA_DIR

      // Act
      const defaultConfigManager = new ConfigManager()

      // Assert
      expect(defaultConfigManager.getConfigDir()).toContain('.mailflow')

      // Restore
      process.env.MAILFLOW_DATA_DIR = originalEnv
    })
  })

  describe('Configuration Persistence', () => {
    beforeEach(async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig))
      await configManager.initialize()
    })

    it('should persist configuration changes to file', async () => {
      // Act
      await configManager.set('instanceName', 'New Instance Name')

      // Assert
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('config.json'),
        expect.stringContaining('New Instance Name'),
        'utf8'
      )
    })

    it('should handle file write errors', async () => {
      // Arrange
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Write permission denied')
      })

      // Act & Assert
      await expect(configManager.set('instanceName', 'Test')).rejects.toThrow('Write permission denied')
    })

    it('should return full configuration object', () => {
      // Act
      const fullConfig = configManager.getFullConfig()

      // Assert
      expect(fullConfig).toEqual(mockConfig)
    })
  })

  describe('Error Handling', () => {
    it('should handle directory creation errors', async () => {
      // Arrange
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => {
        throw new Error('Permission denied')
      })

      // Act & Assert
      await expect(configManager.initialize()).rejects.toThrow('Permission denied')
    })

    it('should handle config file read errors', async () => {
      // Arrange
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File read error')
      })

      // Act & Assert
      await expect(configManager.initialize()).rejects.toThrow('File read error')
    })

    it('should handle invalid JSON gracefully', async () => {
      // Arrange
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue('{ invalid json }')

      // Act & Assert
      await expect(configManager.initialize()).rejects.toThrow()
    })
  })
})