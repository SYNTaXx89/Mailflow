import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies BEFORE importing DatabaseManager
vi.mock('sqlite3', () => ({
  Database: vi.fn().mockImplementation(() => ({
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn(),
    close: vi.fn(),
    serialize: vi.fn(),
  })),
}))

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
import { DatabaseManager } from '../DatabaseManager'

describe('DatabaseManager - Basic Tests', () => {
  let databaseManager: DatabaseManager

  beforeEach(() => {
    // Reset singleton for testing
    ;(DatabaseManager as any).instance = undefined
    databaseManager = DatabaseManager.getInstance()
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

  describe('Constructor', () => {
    it('should create instance without errors', () => {
      // Act
      const instance = DatabaseManager.getInstance()

      // Assert
      expect(instance).toBeDefined()
      expect(instance).toBeInstanceOf(DatabaseManager)
    })
  })
})