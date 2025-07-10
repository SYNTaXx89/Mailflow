import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock dependencies BEFORE importing DatabaseManager
vi.mock('sqlite3', () => {
  const mockDatabase = {
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn(),
    close: vi.fn(),
    serialize: vi.fn(),
  }
  
  const Database = vi.fn().mockImplementation(() => mockDatabase)
  
  return {
    default: { Database },
    Database
  }
})

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}))

vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn().mockReturnValue(Buffer.from('test-key')),
    createCipheriv: vi.fn(),
    createDecipheriv: vi.fn(),
    randomUUID: vi.fn().mockReturnValue('test-uuid'),
  },
}))

vi.mock('../../config/ConfigManager', () => ({
  configManager: {
    getDeep: vi.fn(),
    getConfigDir: vi.fn().mockReturnValue('/test/config'),
  },
}))

// Import after mocking  
import { DatabaseManager, User, Account, Email, AppSettings } from '../DatabaseManager'
import sqlite3 from 'sqlite3'
import fs from 'fs'
import crypto from 'crypto'

describe('DatabaseManager', () => {
  let databaseManager: DatabaseManager
  let mockDatabase: any

  beforeEach(async () => {
    // Setup mocks
    mockDatabase = {
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(),
      close: vi.fn(),
      serialize: vi.fn(),
    }

    vi.mocked(sqlite3.Database).mockImplementation(() => mockDatabase)
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined)
    vi.mocked(crypto.randomBytes).mockReturnValue(Buffer.from('test-key'))

    // Get fresh instance - we need to reset singleton for testing
    ;(DatabaseManager as any).instance = undefined
    databaseManager = DatabaseManager.getInstance()
    
    // Clear all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Singleton Pattern', () => {
    it('should return same instance when called multiple times', () => {
      // Act
      const instance1 = DatabaseManager.getInstance()
      const instance2 = DatabaseManager.getInstance()

      // Assert
      expect(instance1).toBe(instance2)
    })
  })

  describe('User Operations', () => {
    describe('createUser', () => {
      it('should create user with correct parameters', async () => {
        // Arrange
        const userId = 'user123'
        const email = 'test@example.com'
        const passwordHash = 'hashedPassword'
        const role = 'user'

        mockDatabase.run.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null)
        })

        // Act
        await databaseManager.createUser(userId, email, passwordHash, role)

        // Assert
        expect(mockDatabase.run).toHaveBeenCalledWith(
          'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
          [userId, email, passwordHash, role],
          expect.any(Function)
        )
      })

      it('should default to user role when not specified', async () => {
        // Arrange
        const userId = 'user123'
        const email = 'test@example.com'
        const passwordHash = 'hashedPassword'

        mockDatabase.run.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null)
        })

        // Act
        await databaseManager.createUser(userId, email, passwordHash)

        // Assert
        expect(mockDatabase.run).toHaveBeenCalledWith(
          'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
          [userId, email, passwordHash, 'user'],
          expect.any(Function)
        )
      })

      it('should handle database errors', async () => {
        // Arrange
        const userId = 'user123'
        const email = 'test@example.com'
        const passwordHash = 'hashedPassword'

        mockDatabase.run.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(new Error('Database error'))
        })

        // Act & Assert
        await expect(databaseManager.createUser(userId, email, passwordHash)).rejects.toThrow('Database error')
      })
    })

    describe('getUserByEmail', () => {
      it('should return user when found', async () => {
        // Arrange
        const email = 'test@example.com'
        const expectedUser: User = {
          id: 'user123',
          email: email,
          password_hash: 'hashedPassword',
          role: 'user',
          created_at: '2023-01-01T00:00:00.000Z',
        }

        mockDatabase.get.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null, expectedUser)
        })

        // Act
        const result = await databaseManager.getUserByEmail(email)

        // Assert
        expect(mockDatabase.get).toHaveBeenCalledWith(
          'SELECT * FROM users WHERE email = ?',
          [email],
          expect.any(Function)
        )
        expect(result).toEqual(expectedUser)
      })

      it('should return undefined when user not found', async () => {
        // Arrange
        const email = 'nonexistent@example.com'

        mockDatabase.get.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null, undefined)
        })

        // Act
        const result = await databaseManager.getUserByEmail(email)

        // Assert
        expect(result).toBeUndefined()
      })

      it('should handle database errors', async () => {
        // Arrange
        const email = 'test@example.com'

        mockDatabase.get.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(new Error('Database error'))
        })

        // Act & Assert
        await expect(databaseManager.getUserByEmail(email)).rejects.toThrow('Database error')
      })
    })

    describe('getUserById', () => {
      it('should return user when found', async () => {
        // Arrange
        const userId = 'user123'
        const expectedUser: User = {
          id: userId,
          email: 'test@example.com',
          password_hash: 'hashedPassword',
          role: 'user',
          created_at: '2023-01-01T00:00:00.000Z',
        }

        mockDatabase.get.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null, expectedUser)
        })

        // Act
        const result = await databaseManager.getUserById(userId)

        // Assert
        expect(mockDatabase.get).toHaveBeenCalledWith(
          'SELECT * FROM users WHERE id = ?',
          [userId],
          expect.any(Function)
        )
        expect(result).toEqual(expectedUser)
      })
    })

    describe('getAllUsers', () => {
      it('should return all users', async () => {
        // Arrange
        const expectedUsers: User[] = [
          {
            id: 'user1',
            email: 'user1@example.com',
            password_hash: 'hash1',
            role: 'user',
            created_at: '2023-01-01T00:00:00.000Z',
          },
          {
            id: 'user2',
            email: 'user2@example.com',
            password_hash: 'hash2',
            role: 'admin',
            created_at: '2023-01-02T00:00:00.000Z',
          },
        ]

        mockDatabase.all.mockImplementation((sql: string, callback: Function) => {
          callback(null, expectedUsers)
        })

        // Act
        const result = await databaseManager.getAllUsers()

        // Assert
        expect(mockDatabase.all).toHaveBeenCalledWith(
          'SELECT * FROM users ORDER BY created_at DESC',
          expect.any(Function)
        )
        expect(result).toEqual(expectedUsers)
      })

      it('should return empty array when no users', async () => {
        // Arrange
        mockDatabase.all.mockImplementation((sql: string, callback: Function) => {
          callback(null, [])
        })

        // Act
        const result = await databaseManager.getAllUsers()

        // Assert
        expect(result).toEqual([])
      })
    })

    describe('updateUser', () => {
      it('should update user with provided fields', async () => {
        // Arrange
        const userId = 'user123'
        const updates = {
          email: 'newemail@example.com',
          role: 'admin' as const,
        }

        mockDatabase.run.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null)
        })

        // Act
        await databaseManager.updateUser(userId, updates)

        // Assert
        expect(mockDatabase.run).toHaveBeenCalledWith(
          'UPDATE users SET email = ?, role = ? WHERE id = ?',
          ['newemail@example.com', 'admin', userId],
          expect.any(Function)
        )
      })

      it('should handle database errors', async () => {
        // Arrange
        const userId = 'user123'
        const updates = { email: 'newemail@example.com' }

        mockDatabase.run.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(new Error('Database error'))
        })

        // Act & Assert
        await expect(databaseManager.updateUser(userId, updates)).rejects.toThrow('Database error')
      })
    })

    describe('deleteUser', () => {
      it('should delete user by id', async () => {
        // Arrange
        const userId = 'user123'

        mockDatabase.run.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null)
        })

        // Act
        await databaseManager.deleteUser(userId)

        // Assert
        expect(mockDatabase.run).toHaveBeenCalledWith(
          'DELETE FROM users WHERE id = ?',
          [userId],
          expect.any(Function)
        )
      })
    })
  })

  describe('Account Operations', () => {
    describe('createAccount', () => {
      it('should create account successfully', async () => {
        // Arrange
        const account: Omit<Account, 'created_at'> = {
          id: 'account123',
          user_id: 'user123',
          name: 'Test Account',
          email: 'test@example.com',
          encrypted_credentials: 'encrypted_creds',
          config: '{"host": "imap.example.com"}',
        }

        mockDatabase.run.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null)
        })

        // Act
        const result = await databaseManager.createAccount(account)

        // Assert
        expect(mockDatabase.run).toHaveBeenCalledWith(
          'INSERT INTO accounts (id, user_id, name, email, encrypted_credentials, config) VALUES (?, ?, ?, ?, ?, ?)',
          [account.id, account.user_id, account.name, account.email, account.encrypted_credentials, account.config],
          expect.any(Function)
        )
        expect(result).toBe(true)
      })

      it('should return false on database error', async () => {
        // Arrange
        const account: Omit<Account, 'created_at'> = {
          id: 'account123',
          user_id: 'user123',
          name: 'Test Account',
          email: 'test@example.com',
          encrypted_credentials: 'encrypted_creds',
          config: '{"host": "imap.example.com"}',
        }

        mockDatabase.run.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(new Error('Database error'))
        })

        // Act
        const result = await databaseManager.createAccount(account)

        // Assert
        expect(result).toBe(false)
      })
    })

    describe('getAccountsByUserId', () => {
      it('should return accounts for user', async () => {
        // Arrange
        const userId = 'user123'
        const expectedAccounts: Account[] = [
          {
            id: 'account1',
            user_id: userId,
            name: 'Account 1',
            email: 'account1@example.com',
            encrypted_credentials: 'creds1',
            config: '{}',
            created_at: '2023-01-01T00:00:00.000Z',
          },
        ]

        mockDatabase.all.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null, expectedAccounts)
        })

        // Act
        const result = await databaseManager.getAccountsByUserId(userId)

        // Assert
        expect(mockDatabase.all).toHaveBeenCalledWith(
          'SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at DESC',
          [userId],
          expect.any(Function)
        )
        expect(result).toEqual(expectedAccounts)
      })
    })

    describe('getAccountById', () => {
      it('should return account when found', async () => {
        // Arrange
        const accountId = 'account123'
        const expectedAccount: Account = {
          id: accountId,
          user_id: 'user123',
          name: 'Test Account',
          email: 'test@example.com',
          encrypted_credentials: 'creds',
          config: '{}',
          created_at: '2023-01-01T00:00:00.000Z',
        }

        mockDatabase.get.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null, expectedAccount)
        })

        // Act
        const result = await databaseManager.getAccountById(accountId)

        // Assert
        expect(mockDatabase.get).toHaveBeenCalledWith(
          'SELECT * FROM accounts WHERE id = ?',
          [accountId],
          expect.any(Function)
        )
        expect(result).toEqual(expectedAccount)
      })

      it('should return undefined when account not found', async () => {
        // Arrange
        const accountId = 'nonexistent123'

        mockDatabase.get.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null, undefined)
        })

        // Act
        const result = await databaseManager.getAccountById(accountId)

        // Assert
        expect(result).toBeUndefined()
      })
    })

    describe('updateAccount', () => {
      it('should update account successfully', async () => {
        // Arrange
        const accountId = 'account123'
        const updates = {
          name: 'Updated Account',
          email: 'updated@example.com',
        }

        mockDatabase.run.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null)
        })

        // Act
        const result = await databaseManager.updateAccount(accountId, updates)

        // Assert
        expect(mockDatabase.run).toHaveBeenCalledWith(
          'UPDATE accounts SET name = ?, email = ? WHERE id = ?',
          ['Updated Account', 'updated@example.com', accountId],
          expect.any(Function)
        )
        expect(result).toBe(true)
      })

      it('should return false on database error', async () => {
        // Arrange
        const accountId = 'account123'
        const updates = { name: 'Updated Account' }

        mockDatabase.run.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(new Error('Database error'))
        })

        // Act
        const result = await databaseManager.updateAccount(accountId, updates)

        // Assert
        expect(result).toBe(false)
      })
    })

    describe('deleteAccount', () => {
      it('should delete account successfully', async () => {
        // Arrange
        const accountId = 'account123'

        mockDatabase.run.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null)
        })

        // Act
        const result = await databaseManager.deleteAccount(accountId)

        // Assert
        expect(mockDatabase.run).toHaveBeenCalledWith(
          'DELETE FROM accounts WHERE id = ?',
          [accountId],
          expect.any(Function)
        )
        expect(result).toBe(true)
      })

      it('should return false on database error', async () => {
        // Arrange
        const accountId = 'account123'

        mockDatabase.run.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(new Error('Database error'))
        })

        // Act
        const result = await databaseManager.deleteAccount(accountId)

        // Assert
        expect(result).toBe(false)
      })
    })
  })

  describe('Email Operations', () => {
    describe('createEmail', () => {
      it('should create email successfully', async () => {
        // Arrange
        const email: Omit<Email, 'created_at'> = {
          id: 'email123',
          account_id: 'account123',
          subject: 'Test Subject',
          sender: 'sender@example.com',
          recipient: 'recipient@example.com',
          preview: 'Preview text',
          full_body: 'Full email body',
          date: '2023-01-01T00:00:00.000Z',
          is_read: false,
          uid: 'uid123',
          message_id: 'msg123',
        }

        mockDatabase.run.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null)
        })

        // Act
        await databaseManager.createEmail(email)

        // Assert
        expect(mockDatabase.run).toHaveBeenCalledWith(
          'INSERT INTO emails (id, account_id, subject, sender, recipient, preview, full_body, date, is_read, uid, message_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [email.id, email.account_id, email.subject, email.sender, email.recipient, email.preview, email.full_body, email.date, email.is_read, email.uid, email.message_id],
          expect.any(Function)
        )
      })

      it('should handle database errors', async () => {
        // Arrange
        const email: Omit<Email, 'created_at'> = {
          id: 'email123',
          account_id: 'account123',
          subject: 'Test Subject',
          sender: 'sender@example.com',
          recipient: 'recipient@example.com',
          preview: 'Preview text',
          date: '2023-01-01T00:00:00.000Z',
          is_read: false,
        }

        mockDatabase.run.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(new Error('Database error'))
        })

        // Act & Assert
        await expect(databaseManager.createEmail(email)).rejects.toThrow('Database error')
      })
    })

    describe('getEmailsByAccountId', () => {
      it('should return emails for account with default limit', async () => {
        // Arrange
        const accountId = 'account123'
        const expectedEmails: Email[] = [
          {
            id: 'email1',
            account_id: accountId,
            subject: 'Subject 1',
            sender: 'sender1@example.com',
            recipient: 'recipient@example.com',
            preview: 'Preview 1',
            date: '2023-01-01T00:00:00.000Z',
            is_read: false,
          },
        ]

        mockDatabase.all.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null, expectedEmails)
        })

        // Act
        const result = await databaseManager.getEmailsByAccountId(accountId)

        // Assert
        expect(mockDatabase.all).toHaveBeenCalledWith(
          'SELECT * FROM emails WHERE account_id = ? ORDER BY date DESC LIMIT ?',
          [accountId, 50],
          expect.any(Function)
        )
        expect(result).toEqual(expectedEmails)
      })

      it('should return emails with custom limit', async () => {
        // Arrange
        const accountId = 'account123'
        const customLimit = 10
        const expectedEmails: Email[] = []

        mockDatabase.all.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null, expectedEmails)
        })

        // Act
        const result = await databaseManager.getEmailsByAccountId(accountId, customLimit)

        // Assert
        expect(mockDatabase.all).toHaveBeenCalledWith(
          'SELECT * FROM emails WHERE account_id = ? ORDER BY date DESC LIMIT ?',
          [accountId, customLimit],
          expect.any(Function)
        )
        expect(result).toEqual(expectedEmails)
      })
    })

    describe('getEmailById', () => {
      it('should return email when found', async () => {
        // Arrange
        const emailId = 'email123'
        const expectedEmail: Email = {
          id: emailId,
          account_id: 'account123',
          subject: 'Test Subject',
          sender: 'sender@example.com',
          recipient: 'recipient@example.com',
          preview: 'Preview text',
          date: '2023-01-01T00:00:00.000Z',
          is_read: false,
        }

        mockDatabase.get.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null, expectedEmail)
        })

        // Act
        const result = await databaseManager.getEmailById(emailId)

        // Assert
        expect(mockDatabase.get).toHaveBeenCalledWith(
          'SELECT * FROM emails WHERE id = ?',
          [emailId],
          expect.any(Function)
        )
        expect(result).toEqual(expectedEmail)
      })

      it('should return undefined when email not found', async () => {
        // Arrange
        const emailId = 'nonexistent123'

        mockDatabase.get.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null, undefined)
        })

        // Act
        const result = await databaseManager.getEmailById(emailId)

        // Assert
        expect(result).toBeUndefined()
      })
    })

    describe('updateEmail', () => {
      it('should update email successfully', async () => {
        // Arrange
        const emailId = 'email123'
        const updates = {
          is_read: true,
          full_body: 'Updated body',
        }

        mockDatabase.run.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null)
        })

        // Act
        await databaseManager.updateEmail(emailId, updates)

        // Assert
        expect(mockDatabase.run).toHaveBeenCalledWith(
          'UPDATE emails SET is_read = ?, full_body = ? WHERE id = ?',
          [true, 'Updated body', emailId],
          expect.any(Function)
        )
      })

      it('should handle database errors', async () => {
        // Arrange
        const emailId = 'email123'
        const updates = { is_read: true }

        mockDatabase.run.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(new Error('Database error'))
        })

        // Act & Assert
        await expect(databaseManager.updateEmail(emailId, updates)).rejects.toThrow('Database error')
      })
    })
  })

  describe('Settings Operations', () => {
    describe('setSetting', () => {
      it('should create or update setting successfully', async () => {
        // Arrange
        const userId = 'user123'
        const key = 'theme'
        const value = 'dark'

        mockDatabase.run.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null)
        })

        // Act
        await databaseManager.setSetting(userId, key, value)

        // Assert
        expect(mockDatabase.run).toHaveBeenCalledWith(
          'INSERT OR REPLACE INTO settings (user_id, key, value) VALUES (?, ?, ?)',
          [userId, key, value],
          expect.any(Function)
        )
      })

      it('should handle database errors', async () => {
        // Arrange
        const userId = 'user123'
        const key = 'theme'
        const value = 'dark'

        mockDatabase.run.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(new Error('Database error'))
        })

        // Act & Assert
        await expect(databaseManager.setSetting(userId, key, value)).rejects.toThrow('Database error')
      })
    })

    describe('getSetting', () => {
      it('should return setting value when found', async () => {
        // Arrange
        const userId = 'user123'
        const key = 'theme'
        const expectedSetting = {
          id: 'setting123',
          user_id: userId,
          key: key,
          value: 'dark',
        }

        mockDatabase.get.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null, expectedSetting)
        })

        // Act
        const result = await databaseManager.getSetting(userId, key)

        // Assert
        expect(mockDatabase.get).toHaveBeenCalledWith(
          'SELECT * FROM settings WHERE user_id = ? AND key = ?',
          [userId, key],
          expect.any(Function)
        )
        expect(result).toEqual(expectedSetting)
      })

      it('should return undefined when setting not found', async () => {
        // Arrange
        const userId = 'user123'
        const key = 'nonexistent'

        mockDatabase.get.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null, undefined)
        })

        // Act
        const result = await databaseManager.getSetting(userId, key)

        // Assert
        expect(result).toBeUndefined()
      })
    })

    describe('getUserSettings', () => {
      it('should return all settings for user', async () => {
        // Arrange
        const userId = 'user123'
        const expectedSettings: AppSettings[] = [
          {
            id: 'setting1',
            user_id: userId,
            key: 'theme',
            value: 'dark',
          },
          {
            id: 'setting2',
            user_id: userId,
            key: 'language',
            value: 'en',
          },
        ]

        mockDatabase.all.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null, expectedSettings)
        })

        // Act
        const result = await databaseManager.getUserSettings(userId)

        // Assert
        expect(mockDatabase.all).toHaveBeenCalledWith(
          'SELECT * FROM settings WHERE user_id = ? ORDER BY key',
          [userId],
          expect.any(Function)
        )
        expect(result).toEqual(expectedSettings)
      })
    })
  })

  describe('Database Security', () => {
    describe('SQL Injection Prevention', () => {
      it('should use parameterized queries for user operations', async () => {
        // Arrange
        const maliciousEmail = "'; DROP TABLE users; --"
        
        mockDatabase.get.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null, undefined)
        })

        // Act
        await databaseManager.getUserByEmail(maliciousEmail)

        // Assert
        expect(mockDatabase.get).toHaveBeenCalledWith(
          'SELECT * FROM users WHERE email = ?',
          [maliciousEmail],
          expect.any(Function)
        )
      })

      it('should use parameterized queries for account operations', async () => {
        // Arrange
        const maliciousAccountId = "'; DROP TABLE accounts; --"
        
        mockDatabase.get.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null, undefined)
        })

        // Act
        await databaseManager.getAccountById(maliciousAccountId)

        // Assert
        expect(mockDatabase.get).toHaveBeenCalledWith(
          'SELECT * FROM accounts WHERE id = ?',
          [maliciousAccountId],
          expect.any(Function)
        )
      })
    })

    describe('Data Validation', () => {
      it('should handle empty string inputs', async () => {
        // Arrange
        mockDatabase.get.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null, undefined)
        })

        // Act & Assert
        await expect(databaseManager.getUserByEmail('')).resolves.toBeUndefined()
        await expect(databaseManager.getUserById('')).resolves.toBeUndefined()
        await expect(databaseManager.getAccountById('')).resolves.toBeUndefined()
      })

      it('should handle null/undefined inputs gracefully', async () => {
        // Arrange
        mockDatabase.get.mockImplementation((sql: string, params: any[], callback: Function) => {
          callback(null, undefined)
        })

        // Act & Assert
        await expect(databaseManager.getUserByEmail(null as any)).resolves.toBeUndefined()
        await expect(databaseManager.getUserById(undefined as any)).resolves.toBeUndefined()
        await expect(databaseManager.getAccountById(null as any)).resolves.toBeUndefined()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      // Arrange
      mockDatabase.get.mockImplementation((sql: string, params: any[], callback: Function) => {
        callback(new Error('SQLITE_BUSY: database is locked'))
      })

      // Act & Assert
      await expect(databaseManager.getUserByEmail('test@example.com')).rejects.toThrow('SQLITE_BUSY: database is locked')
    })

    it('should handle constraint violations', async () => {
      // Arrange
      mockDatabase.run.mockImplementation((sql: string, params: any[], callback: Function) => {
        callback(new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed'))
      })

      // Act & Assert
      await expect(databaseManager.createUser('user123', 'test@example.com', 'hash')).rejects.toThrow('SQLITE_CONSTRAINT: UNIQUE constraint failed')
    })
  })
})