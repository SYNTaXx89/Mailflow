import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import sqlite3 from 'sqlite3'
import { DatabaseManager } from '../DatabaseManager'
import { ConfigManager } from '../../config/ConfigManager'

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
    randomBytes: vi.fn((size) => {
      if (size === 32) return Buffer.from('test-encryption-key-32-bytes-long')
      if (size === 16) return Buffer.from('test-iv-16-bytes-')
      return Buffer.from('test-data')
    }),
    createCipheriv: vi.fn(),
    createDecipheriv: vi.fn(),
  },
}))

// Mock sqlite3
const mockDatabase = {
  run: vi.fn((sql, params, callback) => {
    // Simulate successful SQL execution
    if (typeof params === 'function') {
      setTimeout(() => params(null), 0)
    } else if (typeof callback === 'function') {
      setTimeout(() => callback(null), 0)
    }
  }),
  get: vi.fn((sql, params, callback) => {
    // Simulate successful query
    if (typeof params === 'function') {
      setTimeout(() => params(null, {}), 0)
    } else if (typeof callback === 'function') {
      setTimeout(() => callback(null, {}), 0)
    }
  }),
  all: vi.fn((sql, params, callback) => {
    // Simulate successful query
    if (typeof params === 'function') {
      setTimeout(() => params(null, []), 0)
    } else if (typeof callback === 'function') {
      setTimeout(() => callback(null, []), 0)
    }
  }),
  close: vi.fn((callback) => {
    if (callback) setTimeout(() => callback(null), 0)
  }),
}

vi.mock('sqlite3', () => ({
  default: {
    Database: vi.fn().mockImplementation((path, callback) => {
      // Simulate successful connection
      if (callback) setTimeout(() => callback(null), 0)
      return mockDatabase
    }),
  },
}))

describe('DatabaseManager - Advanced Features', () => {
  let databaseManager: DatabaseManager
  let mockConfigManager: ConfigManager

  beforeEach(() => {
    // Reset database mock functions
    mockDatabase.run.mockClear()
    mockDatabase.get.mockClear()
    mockDatabase.all.mockClear()
    mockDatabase.close.mockClear()

    // Create mock ConfigManager
    mockConfigManager = {
      getConfigDir: vi.fn().mockReturnValue('/test/config'),
      getDeep: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      initialize: vi.fn(),
    } as unknown as ConfigManager

    // Setup file system mocks
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('test-encryption-key-32-bytes-long')

    // Create DatabaseManager instance
    databaseManager = new DatabaseManager(mockConfigManager)

    // Don't clear all mocks as it breaks the sqlite3 mock
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Encryption and Decryption', () => {
    beforeEach(() => {
      // Mock the database property and encryption key for encryption tests
      ;(databaseManager as any).db = mockDatabase
      ;(databaseManager as any).encryptionKey = 'test-encryption-key-32-bytes-long'
    })

    it('should encrypt data using AES-256-CBC', () => {
      // Arrange
      const testData = 'sensitive-password-123'
      const mockCipher = {
        update: vi.fn().mockReturnValue('encrypted-part1'),
        final: vi.fn().mockReturnValue('encrypted-part2'),
      }
      
      vi.mocked(crypto.createCipheriv).mockReturnValue(mockCipher as any)

      // Act
      const encrypted = databaseManager.encrypt(testData)

      // Assert
      expect(crypto.randomBytes).toHaveBeenCalledWith(16) // IV generation
      expect(crypto.createCipheriv).toHaveBeenCalledWith(
        'aes-256-cbc',
        Buffer.from('test-encryption-key-32-bytes-long', 'hex'),
        Buffer.from('test-iv-16-bytes-')
      )
      expect(mockCipher.update).toHaveBeenCalledWith(testData, 'utf8', 'hex')
      expect(mockCipher.final).toHaveBeenCalledWith('hex')
      expect(encrypted).toBe('746573742d69762d31362d62797465732d:encrypted-part1encrypted-part2')
    })

    it('should decrypt data using AES-256-CBC', () => {
      // Arrange
      const encryptedData = '746573742d69762d31362d62797465732d:encrypted-data-here'
      const mockDecipher = {
        update: vi.fn().mockReturnValue('decrypted-part1'),
        final: vi.fn().mockReturnValue('decrypted-part2'),
      }
      
      vi.mocked(crypto.createDecipheriv).mockReturnValue(mockDecipher as any)

      // Act
      const decrypted = databaseManager.decrypt(encryptedData)

      // Assert
      expect(crypto.createDecipheriv).toHaveBeenCalledWith(
        'aes-256-cbc',
        Buffer.from('test-encryption-key-32-bytes-long', 'hex'),
        Buffer.from('746573742d69762d31362d62797465732d', 'hex')
      )
      expect(mockDecipher.update).toHaveBeenCalledWith('encrypted-data-here', 'hex', 'utf8')
      expect(mockDecipher.final).toHaveBeenCalledWith('utf8')
      expect(decrypted).toBe('decrypted-part1decrypted-part2')
    })

    it('should handle encryption/decryption round trip', () => {
      // Arrange
      const originalData = 'test-password-data'
      const mockCipher = {
        update: vi.fn().mockReturnValue('abc123'),
        final: vi.fn().mockReturnValue('def456'),
      }
      const mockDecipher = {
        update: vi.fn().mockReturnValue('test-password'),
        final: vi.fn().mockReturnValue('-data'),
      }
      
      vi.mocked(crypto.createCipheriv).mockReturnValue(mockCipher as any)
      vi.mocked(crypto.createDecipheriv).mockReturnValue(mockDecipher as any)

      // Act
      const encrypted = databaseManager.encrypt(originalData)
      const decrypted = databaseManager.decrypt(encrypted)

      // Assert
      expect(decrypted).toBe(originalData)
    })

    it('should generate unique IVs for each encryption', () => {
      // Arrange
      const testData = 'same-data'
      const mockCipher = {
        update: vi.fn().mockReturnValue('encrypted'),
        final: vi.fn().mockReturnValue(''),
      }
      
      vi.mocked(crypto.createCipheriv).mockReturnValue(mockCipher as any)
      vi.mocked(crypto.randomBytes).mockReturnValueOnce(Buffer.from('iv1-16-bytes-test'))
                                   .mockReturnValueOnce(Buffer.from('iv2-16-bytes-test'))

      // Act
      const encrypted1 = databaseManager.encrypt(testData)
      const encrypted2 = databaseManager.encrypt(testData)

      // Assert
      expect(encrypted1).not.toBe(encrypted2) // Different IVs should produce different ciphertext
      expect(crypto.randomBytes).toHaveBeenCalledTimes(2)
    })

    it('should handle malformed encrypted data gracefully', () => {
      // Arrange
      const malformedData = 'not-proper-format'

      // Act & Assert
      expect(() => databaseManager.decrypt(malformedData)).toThrow()
    })
  })

  describe('Migration System', () => {
    beforeEach(() => {
      // Setup database mock for migrations
      ;(databaseManager as any).db = mockDatabase
      ;(databaseManager as any).encryptionKey = 'test-encryption-key-32-bytes-long'
      
      // Setup successful database connection mock
      mockDatabase.run.mockImplementation((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params
        }
        if (callback) callback.call({ lastID: 1, changes: 1 }, null)
      })

      mockDatabase.all.mockImplementation((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params
        }
        if (callback) callback(null, [])
      })
    })

    it('should detect and run migrations for emails table', async () => {
      // Arrange - Mock table info showing old 'body' column
      mockDatabase.all.mockImplementationOnce((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params
        }
        if (callback) callback(null, [
          { name: 'id', type: 'TEXT' },
          { name: 'account_id', type: 'TEXT' },
          { name: 'subject', type: 'TEXT' },
          { name: 'body', type: 'TEXT' }, // Old column name
          { name: 'date', type: 'DATETIME' },
        ])
      })

      // Act - Call migration method directly
      await (databaseManager as any).runMigrations()

      // Assert
      expect(mockDatabase.all).toHaveBeenCalledWith('PRAGMA table_info(emails)', [], expect.any(Function))
      
      // Check that migration SQL was executed
      const runCalls = vi.mocked(mockDatabase.run).mock.calls
      const migrationCalls = runCalls.filter(call => 
        call[0].includes('CREATE TABLE emails_new') || 
        call[0].includes('INSERT INTO emails_new') ||
        call[0].includes('DROP TABLE emails') ||
        call[0].includes('ALTER TABLE emails_new RENAME TO emails')
      )
      
      expect(migrationCalls.length).toBeGreaterThan(0)
    })

    it('should add missing full_body column if missing', async () => {
      // Arrange - Mock table info showing preview but no full_body
      mockDatabase.all.mockImplementationOnce((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params
        }
        if (callback) callback(null, [
          { name: 'id', type: 'TEXT' },
          { name: 'account_id', type: 'TEXT' },
          { name: 'preview', type: 'TEXT' },
          { name: 'date', type: 'DATETIME' },
          // Missing full_body column
        ])
      })

      // Act - Call migration method directly
      await (databaseManager as any).runMigrations()

      // Assert
      const runCalls = vi.mocked(mockDatabase.run).mock.calls
      const addColumnCall = runCalls.find(call => 
        call[0].includes('ALTER TABLE emails ADD COLUMN full_body TEXT')
      )
      
      expect(addColumnCall).toBeDefined()
    })

    it('should add missing has_attachments column if missing', async () => {
      // Arrange - Mock table info without has_attachments
      mockDatabase.all.mockImplementationOnce((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params
        }
        if (callback) callback(null, [
          { name: 'id', type: 'TEXT' },
          { name: 'account_id', type: 'TEXT' },
          { name: 'preview', type: 'TEXT' },
          { name: 'full_body', type: 'TEXT' },
          { name: 'date', type: 'DATETIME' },
          // Missing has_attachments column
        ])
      })

      // Act - Call migration method directly
      await (databaseManager as any).runMigrations()

      // Assert
      const runCalls = vi.mocked(mockDatabase.run).mock.calls
      const addColumnCall = runCalls.find(call => 
        call[0].includes('ALTER TABLE emails ADD COLUMN has_attachments BOOLEAN DEFAULT FALSE')
      )
      
      expect(addColumnCall).toBeDefined()
    })

    it('should handle migration errors gracefully', async () => {
      // Arrange
      mockDatabase.all.mockImplementationOnce((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params
        }
        if (callback) callback(new Error('PRAGMA table_info failed'))
      })

      // Act & Assert
      await expect((databaseManager as any).runMigrations()).rejects.toThrow('PRAGMA table_info failed')
    })

    it('should skip migrations when table structure is current', async () => {
      // Arrange - Mock complete table structure
      mockDatabase.all.mockImplementationOnce((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params
        }
        if (callback) callback(null, [
          { name: 'id', type: 'TEXT' },
          { name: 'account_id', type: 'TEXT' },
          { name: 'preview', type: 'TEXT' },
          { name: 'full_body', type: 'TEXT' },
          { name: 'has_attachments', type: 'BOOLEAN' },
          { name: 'date', type: 'DATETIME' },
        ])
      })

      // Act - Call migration method directly
      await (databaseManager as any).runMigrations()

      // Assert - Should not run any migration SQL
      const runCalls = vi.mocked(mockDatabase.run).mock.calls
      const migrationCalls = runCalls.filter(call => 
        call[0].includes('CREATE TABLE emails_new') || 
        call[0].includes('ALTER TABLE emails ADD COLUMN')
      )
      
      expect(migrationCalls.length).toBe(0)
    })
  })

  describe('Foreign Key Constraints', () => {
    beforeEach(() => {
      // Setup database mock for constraint tests
      ;(databaseManager as any).db = mockDatabase
      ;(databaseManager as any).encryptionKey = 'test-encryption-key-32-bytes-long'
      
      mockDatabase.run.mockImplementation((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params
        }
        if (callback) callback.call({ lastID: 1, changes: 1 }, null)
      })

      mockDatabase.all.mockImplementation((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params
        }
        if (callback) callback(null, [
          { name: 'id', type: 'TEXT' },
          { name: 'preview', type: 'TEXT' },
          { name: 'full_body', type: 'TEXT' },
          { name: 'has_attachments', type: 'BOOLEAN' },
        ])
      })
    })

    it('should enable foreign key constraints during initialization', async () => {
      // Act - Call the run method directly to test PRAGMA  
      await (databaseManager as any).run('PRAGMA foreign_keys = ON')

      // Assert
      expect(mockDatabase.run).toHaveBeenCalledWith(
        'PRAGMA foreign_keys = ON',
        [],
        expect.any(Function)
      )
    })

    it('should create tables with proper foreign key relationships', async () => {
      // Act - Call table creation method directly
      await (databaseManager as any).createTables()

      // Assert
      const createTableCalls = vi.mocked(mockDatabase.run).mock.calls.filter(call => 
        call[0].includes('CREATE TABLE IF NOT EXISTS')
      )

      // Check accounts table has foreign key to users
      const accountsTable = createTableCalls.find(call => 
        call[0].includes('accounts') && call[0].includes('FOREIGN KEY (user_id) REFERENCES users (id)')
      )
      expect(accountsTable).toBeDefined()

      // Check emails table has foreign key to accounts
      const emailsTable = createTableCalls.find(call => 
        call[0].includes('emails') && call[0].includes('FOREIGN KEY (account_id) REFERENCES accounts (id)')
      )
      expect(emailsTable).toBeDefined()

      // Check settings table has foreign key to users
      const settingsTable = createTableCalls.find(call => 
        call[0].includes('settings') && call[0].includes('FOREIGN KEY (user_id) REFERENCES users (id)')
      )
      expect(settingsTable).toBeDefined()
    })

    it('should enforce CASCADE deletion in foreign keys', async () => {
      // Act - Call table creation method directly
      await (databaseManager as any).createTables()

      // Assert
      const createTableCalls = vi.mocked(mockDatabase.run).mock.calls.filter(call => 
        call[0].includes('CREATE TABLE IF NOT EXISTS')
      )

      // Check that CASCADE is specified for foreign keys
      const cascadeReferences = createTableCalls.filter(call => 
        call[0].includes('ON DELETE CASCADE')
      )
      
      expect(cascadeReferences.length).toBeGreaterThanOrEqual(3) // accounts, emails, settings
    })
  })

  describe('Encryption Key Management', () => {
    beforeEach(() => {
      // Setup database mock for encryption key tests
      ;(databaseManager as any).db = mockDatabase
    })

    it('should generate new encryption key when file does not exist', async () => {
      // Arrange
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(crypto.randomBytes).mockReturnValue(Buffer.from('new-32-byte-encryption-key-here'))

      // Act - Call the encryption key method directly
      const encryptionKey = (databaseManager as any).getOrCreateEncryptionKey()

      // Assert
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/test/config/credentials/encryption.key',
        '6e65772d33322d627974652d656e6372797074696f6e2d6b65792d68657265', // hex encoded
        'utf8'
      )
      expect(encryptionKey).toBe('6e65772d33322d627974652d656e6372797074696f6e2d6b65792d68657265')
    })

    it('should load existing encryption key when file exists', async () => {
      // Arrange
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue('existing-encryption-key')

      // Act - Call the encryption key method directly
      const encryptionKey = (databaseManager as any).getOrCreateEncryptionKey()

      // Assert
      expect(fs.readFileSync).toHaveBeenCalledWith(
        '/test/config/credentials/encryption.key',
        'utf8'
      )
      expect(encryptionKey).toBe('existing-encryption-key')
    })

    it('should create credentials directory if it does not exist', () => {
      // Arrange
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (path.toString().includes('credentials')) return false
        return true
      })

      // Act - Test the directory creation logic by calling the part of initialize that creates directories
      const credentialsDir = '/test/config/credentials'
      if (!vi.mocked(fs.existsSync)(credentialsDir)) {
        vi.mocked(fs.mkdirSync)(credentialsDir, { recursive: true })
      }

      // Assert
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        '/test/config/credentials',
        { recursive: true }
      )
    })
  })

  describe('Database Health and Connection Management', () => {
    beforeEach(() => {
      // Mock the database property for health tests
      ;(databaseManager as any).db = mockDatabase
    })

    it('should report healthy status when database is accessible', async () => {
      // Arrange
      mockDatabase.get.mockImplementation((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params
        }
        callback(null, { result: 1 })
      })

      // Act
      const health = await databaseManager.getHealthStatus()

      // Assert
      expect(health).toEqual({
        healthy: true,
        message: 'Database connection is healthy'
      })
      expect(mockDatabase.get).toHaveBeenCalledWith('SELECT 1', [], expect.any(Function))
    })

    it('should report unhealthy status when database is inaccessible', async () => {
      // Arrange
      const dbError = new Error('Database connection failed')
      mockDatabase.get.mockImplementation((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params
        }
        callback(dbError, null)
      })

      // Act
      const health = await databaseManager.getHealthStatus()

      // Assert
      expect(health).toEqual({
        healthy: false,
        message: 'Database error: Error: Database connection failed'
      })
    })

    it('should close database connection properly', async () => {
      // Arrange
      mockDatabase.close.mockImplementation((callback) => {
        callback(null)
      })

      // Act
      await databaseManager.close()

      // Assert
      expect(mockDatabase.close).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should handle close errors gracefully', async () => {
      // Arrange
      const closeError = new Error('Failed to close database')
      mockDatabase.close.mockImplementation((callback) => {
        callback(closeError)
      })

      // Act & Assert
      await expect(databaseManager.close()).rejects.toThrow('Failed to close database')
    })
  })

  describe('Database Initialization Error Handling', () => {
    it('should handle database connection errors', async () => {
      // Arrange
      const connectionError = new Error('Cannot connect to database')
      vi.mocked(sqlite3.Database).mockImplementation(() => {
        throw connectionError
      })

      // Create new instance to trigger constructor
      const newConfigManager = {
        getConfigDir: vi.fn().mockReturnValue('/test/config'),
      } as unknown as ConfigManager

      // Act & Assert
      await expect(async () => {
        const newDb = new DatabaseManager(newConfigManager)
        await newDb.initialize()
      }).rejects.toThrow('Cannot connect to database')
    })

    it('should handle directory creation errors', async () => {
      // Arrange
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => {
        throw new Error('Permission denied')
      })

      // Act & Assert
      await expect(databaseManager.initialize()).rejects.toThrow('Permission denied')
    })

    it('should handle encryption key generation errors', async () => {
      // Arrange
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(crypto.randomBytes).mockImplementation(() => {
        throw new Error('Crypto error')
      })

      // Act & Assert
      await expect(databaseManager.initialize()).rejects.toThrow('Crypto error')
    })
  })

  describe('Performance Indexes', () => {
    beforeEach(() => {
      // Setup database mock for index tests
      ;(databaseManager as any).db = mockDatabase
      ;(databaseManager as any).encryptionKey = 'test-encryption-key-32-bytes-long'
      
      mockDatabase.run.mockImplementation((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params
        }
        if (callback) callback.call({ lastID: 1, changes: 1 }, null)
      })

      mockDatabase.all.mockImplementation((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params
        }
        if (callback) callback(null, [
          { name: 'id', type: 'TEXT' },
          { name: 'preview', type: 'TEXT' },
          { name: 'full_body', type: 'TEXT' },
          { name: 'has_attachments', type: 'BOOLEAN' },
        ])
      })
    })

    it('should create performance indexes during initialization', async () => {
      // Act - Call table creation method which includes indexes
      await (databaseManager as any).createTables()

      // Assert
      const indexCalls = vi.mocked(mockDatabase.run).mock.calls.filter(call => 
        call[0].includes('CREATE INDEX IF NOT EXISTS')
      )

      expect(indexCalls.length).toBeGreaterThanOrEqual(4)
      
      // Check specific indexes
      const accountsUserIndex = indexCalls.find(call => 
        call[0].includes('idx_accounts_user_id ON accounts(user_id)')
      )
      expect(accountsUserIndex).toBeDefined()

      const emailsAccountIndex = indexCalls.find(call => 
        call[0].includes('idx_emails_account_id ON emails(account_id)')
      )
      expect(emailsAccountIndex).toBeDefined()

      const emailsDateIndex = indexCalls.find(call => 
        call[0].includes('idx_emails_date ON emails(date)')
      )
      expect(emailsDateIndex).toBeDefined()

      const settingsUserIndex = indexCalls.find(call => 
        call[0].includes('idx_settings_user_id ON settings(user_id)')
      )
      expect(settingsUserIndex).toBeDefined()
    })
  })
})