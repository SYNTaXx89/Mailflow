import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Create mock database instance
const mockDatabase = {
  run: vi.fn(),
  get: vi.fn(),
  all: vi.fn(),
  close: vi.fn(),
}

// Mock sqlite3 module
vi.mock('sqlite3', () => ({
  default: {
    Database: vi.fn().mockImplementation(() => mockDatabase),
  },
}))

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue('test-key'),
    writeFileSync: vi.fn(),
  },
}))

// Mock crypto module
vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn().mockReturnValue(Buffer.from('test-key')),
    randomUUID: vi.fn().mockReturnValue('test-uuid'),
  },
}))

// Mock ConfigManager class
const mockConfigManagerInstance = {
  getConfigDir: vi.fn().mockReturnValue('/test/config'),
  getDeep: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  initialize: vi.fn(),
  isSetupCompleted: vi.fn().mockReturnValue(false),
  save: vi.fn(),
  load: vi.fn(),
}

vi.mock('../../config/ConfigManager', () => ({
  ConfigManager: vi.fn().mockImplementation(() => mockConfigManagerInstance),
}))

// Import after mocking
import { DatabaseManager, User, Account, Email, AppSettings } from '../DatabaseManager'
import { ConfigManager } from '../../config/ConfigManager'

describe('DatabaseManager - Core Operations', () => {
  let databaseManager: DatabaseManager
  let mockConfigManager: any

  beforeEach(() => {
    // Create mock ConfigManager instance manually
    mockConfigManager = {
      getConfigDir: vi.fn().mockReturnValue('/test/config'),
      getDeep: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      initialize: vi.fn(),
      isSetupCompleted: vi.fn().mockReturnValue(false),
      save: vi.fn(),
      load: vi.fn(),
    }
    
    // Create DatabaseManager with mocked ConfigManager
    databaseManager = new DatabaseManager(mockConfigManager)
    
    // Mock the database property to simulate initialization
    ;(databaseManager as any).db = mockDatabase
    ;(databaseManager as any).encryptionKey = 'test-key'
    
    // Clear database mock calls after instance creation
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Constructor', () => {
    it('should create DatabaseManager instance with ConfigManager', () => {
      const configManager = {
        getConfigDir: vi.fn().mockReturnValue('/test/config'),
        getDeep: vi.fn(),
        get: vi.fn(),
        set: vi.fn(),
        initialize: vi.fn(),
      }
      const instance = new DatabaseManager(configManager)
      expect(instance).toBeInstanceOf(DatabaseManager)
    })
    
    it('should create different instances when called multiple times', () => {
      const configManager = {
        getConfigDir: vi.fn().mockReturnValue('/test/config'),
        getDeep: vi.fn(),
        get: vi.fn(),
        set: vi.fn(),
        initialize: vi.fn(),
      }
      const instance1 = new DatabaseManager(configManager)
      const instance2 = new DatabaseManager(configManager)
      expect(instance1).not.toBe(instance2)
    })
  })

  describe('User Operations', () => {
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

    it('should get user by email', async () => {
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
  })

  describe('Account Operations', () => {
    it('should create account successfully', async () => {
      // Arrange
      const account = {
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

    it('should get account by ID', async () => {
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
  })

  describe('Email Operations', () => {
    it('should create email successfully', async () => {
      // Arrange
      const email = {
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

    it('should get emails by account ID', async () => {
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
  })

  describe('Settings Operations', () => {
    it('should set setting successfully', async () => {
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
        'INSERT OR REPLACE INTO settings (id, user_id, key, value) VALUES (?, ?, ?, ?)',
        [undefined, userId, key, value],
        expect.any(Function)
      )
    })

    it('should get setting by key', async () => {
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
        'SELECT value FROM settings WHERE user_id = ? AND key = ?',
        [userId, key],
        expect.any(Function)
      )
      expect(result).toEqual(expectedSetting.value)
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors on user creation', async () => {
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

    it('should handle database errors on account creation', async () => {
      // Arrange
      const account = {
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
})