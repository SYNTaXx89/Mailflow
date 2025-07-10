import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import bcrypt from 'bcrypt'
import { PasswordManager } from '../PasswordManager'

// Mock bcrypt
vi.mock('bcrypt')

describe('PasswordManager', () => {
  const mockPassword = 'TestPassword123!'
  const mockHash = '$2b$12$mockHashedPassword'

  beforeEach(() => {
    // Setup default mocks
    vi.mocked(bcrypt.hash).mockResolvedValue(mockHash)
    vi.mocked(bcrypt.compare).mockResolvedValue(true)
    vi.mocked(bcrypt.getRounds).mockReturnValue(12)
    
    // Clear all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('hash', () => {
    it('should hash password with correct salt rounds', async () => {
      // Act
      const result = await PasswordManager.hash(mockPassword)

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith(mockPassword, 12)
      expect(result).toBe(mockHash)
    })

    it('should handle hashing errors', async () => {
      // Arrange
      vi.mocked(bcrypt.hash).mockRejectedValue(new Error('Hashing failed'))

      // Act & Assert
      await expect(PasswordManager.hash(mockPassword)).rejects.toThrow('Password hashing failed')
    })
  })

  describe('compare', () => {
    it('should compare password with hash successfully', async () => {
      // Arrange
      vi.mocked(bcrypt.compare).mockResolvedValue(true)

      // Act
      const result = await PasswordManager.compare(mockPassword, mockHash)

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith(mockPassword, mockHash)
      expect(result).toBe(true)
    })

    it('should return false for incorrect password', async () => {
      // Arrange
      vi.mocked(bcrypt.compare).mockResolvedValue(false)

      // Act
      const result = await PasswordManager.compare('wrongpassword', mockHash)

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', mockHash)
      expect(result).toBe(false)
    })

    it('should handle comparison errors', async () => {
      // Arrange
      vi.mocked(bcrypt.compare).mockRejectedValue(new Error('Comparison failed'))

      // Act & Assert
      await expect(PasswordManager.compare(mockPassword, mockHash)).rejects.toThrow('Password comparison failed')
    })
  })

  describe('validatePasswordStrength', () => {
    it('should accept valid strong password', () => {
      // Arrange
      const strongPassword = 'StrongPass123!'

      // Act
      const result = PasswordManager.validatePasswordStrength(strongPassword)

      // Assert
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject password shorter than 8 characters', () => {
      // Arrange
      const shortPassword = 'Short1!'

      // Act
      const result = PasswordManager.validatePasswordStrength(shortPassword)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must be at least 8 characters long')
    })

    it('should reject password longer than 128 characters', () => {
      // Arrange
      const longPassword = 'A'.repeat(129) + '1!'

      // Act
      const result = PasswordManager.validatePasswordStrength(longPassword)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must be less than 128 characters long')
    })

    it('should reject password without uppercase letter', () => {
      // Arrange
      const password = 'nouppercase123!'

      // Act
      const result = PasswordManager.validatePasswordStrength(password)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one uppercase letter')
    })

    it('should reject password without lowercase letter', () => {
      // Arrange
      const password = 'NOLOWERCASE123!'

      // Act
      const result = PasswordManager.validatePasswordStrength(password)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one lowercase letter')
    })

    it('should reject password without number', () => {
      // Arrange
      const password = 'NoNumbers!'

      // Act
      const result = PasswordManager.validatePasswordStrength(password)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one number')
    })

    it('should reject password without special character', () => {
      // Arrange
      const password = 'NoSpecialChars123'

      // Act
      const result = PasswordManager.validatePasswordStrength(password)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one special character')
    })

    it('should return multiple errors for weak password', () => {
      // Arrange
      const weakPassword = 'weak'

      // Act
      const result = PasswordManager.validatePasswordStrength(weakPassword)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(4) // Missing: length, uppercase, number, special
      expect(result.errors).toContain('Password must be at least 8 characters long')
      expect(result.errors).toContain('Password must contain at least one uppercase letter')
      expect(result.errors).toContain('Password must contain at least one number')
      expect(result.errors).toContain('Password must contain at least one special character')
    })

    it('should accept all valid special characters', () => {
      // Arrange
      const specialChars = '!@#$%^&*(),.?":{}|<>'
      
      // Act & Assert
      for (const char of specialChars) {
        const password = `ValidPass123${char}`
        const result = PasswordManager.validatePasswordStrength(password)
        expect(result.isValid).toBe(true)
      }
    })
  })

  describe('generateSecurePassword', () => {
    it('should generate password with default length 16', () => {
      // Act
      const password = PasswordManager.generateSecurePassword()

      // Assert
      expect(password).toHaveLength(16)
    })

    it('should generate password with custom length', () => {
      // Arrange
      const customLength = 24

      // Act
      const password = PasswordManager.generateSecurePassword(customLength)

      // Assert
      expect(password).toHaveLength(customLength)
    })

    it('should generate password with all required character types', () => {
      // Act
      const password = PasswordManager.generateSecurePassword(16)

      // Assert
      expect(password).toMatch(/[a-z]/) // lowercase
      expect(password).toMatch(/[A-Z]/) // uppercase
      expect(password).toMatch(/\d/) // number
      expect(password).toMatch(/[!@#$%^&*(),.?":{}|<>]/) // special character
    })

    it('should generate different passwords on multiple calls', () => {
      // Act
      const password1 = PasswordManager.generateSecurePassword()
      const password2 = PasswordManager.generateSecurePassword()

      // Assert
      expect(password1).not.toBe(password2)
    })

    it('should generate valid passwords according to strength validation', () => {
      // Act
      const password = PasswordManager.generateSecurePassword()
      const validation = PasswordManager.validatePasswordStrength(password)

      // Assert
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should handle minimum length requirements', () => {
      // Act
      const password = PasswordManager.generateSecurePassword(8)

      // Assert
      expect(password).toHaveLength(8)
      expect(password).toMatch(/[a-z]/)
      expect(password).toMatch(/[A-Z]/)
      expect(password).toMatch(/\d/)
      expect(password).toMatch(/[!@#$%^&*(),.?":{}|<>]/)
    })
  })

  describe('needsRehash', () => {
    it('should return false for hash with current salt rounds', () => {
      // Arrange
      vi.mocked(bcrypt.getRounds).mockReturnValue(12)

      // Act
      const result = PasswordManager.needsRehash(mockHash)

      // Assert
      expect(bcrypt.getRounds).toHaveBeenCalledWith(mockHash)
      expect(result).toBe(false)
    })

    it('should return true for hash with lower salt rounds', () => {
      // Arrange
      vi.mocked(bcrypt.getRounds).mockReturnValue(10)

      // Act
      const result = PasswordManager.needsRehash(mockHash)

      // Assert
      expect(bcrypt.getRounds).toHaveBeenCalledWith(mockHash)
      expect(result).toBe(true)
    })

    it('should return true when getRounds throws error', () => {
      // Arrange
      vi.mocked(bcrypt.getRounds).mockImplementation(() => {
        throw new Error('Invalid hash')
      })

      // Act
      const result = PasswordManager.needsRehash('invalid-hash')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false for hash with higher salt rounds', () => {
      // Arrange
      vi.mocked(bcrypt.getRounds).mockReturnValue(15)

      // Act
      const result = PasswordManager.needsRehash(mockHash)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('rehashIfNeeded', () => {
    it('should rehash password when hash needs updating', async () => {
      // Arrange
      const oldHash = '$2b$10$oldHashWithLowerRounds'
      const newHash = '$2b$12$newHashWithHigherRounds'
      
      vi.mocked(bcrypt.getRounds).mockReturnValue(10) // Old rounds
      vi.mocked(bcrypt.compare).mockResolvedValue(true) // Password matches
      vi.mocked(bcrypt.hash).mockResolvedValue(newHash)

      // Act
      const result = await PasswordManager.rehashIfNeeded(mockPassword, oldHash)

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith(mockPassword, oldHash)
      expect(bcrypt.hash).toHaveBeenCalledWith(mockPassword, 12)
      expect(result).toBe(newHash)
    })

    it('should return null when hash does not need updating', async () => {
      // Arrange
      vi.mocked(bcrypt.getRounds).mockReturnValue(12) // Current rounds

      // Act
      const result = await PasswordManager.rehashIfNeeded(mockPassword, mockHash)

      // Assert
      expect(bcrypt.compare).not.toHaveBeenCalled()
      expect(bcrypt.hash).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })

    it('should return null when password does not match old hash', async () => {
      // Arrange
      const oldHash = '$2b$10$oldHashWithLowerRounds'
      
      vi.mocked(bcrypt.getRounds).mockReturnValue(10) // Old rounds
      vi.mocked(bcrypt.compare).mockResolvedValue(false) // Password doesn't match

      // Act
      const result = await PasswordManager.rehashIfNeeded('wrongpassword', oldHash)

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', oldHash)
      expect(bcrypt.hash).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })

    it('should handle comparison errors during rehash', async () => {
      // Arrange
      const oldHash = '$2b$10$oldHashWithLowerRounds'
      
      vi.mocked(bcrypt.getRounds).mockReturnValue(10) // Old rounds
      vi.mocked(bcrypt.compare).mockRejectedValue(new Error('Comparison failed'))

      // Act & Assert
      await expect(PasswordManager.rehashIfNeeded(mockPassword, oldHash)).rejects.toThrow('Password comparison failed')
    })

    it('should handle hashing errors during rehash', async () => {
      // Arrange
      const oldHash = '$2b$10$oldHashWithLowerRounds'
      
      vi.mocked(bcrypt.getRounds).mockReturnValue(10) // Old rounds
      vi.mocked(bcrypt.compare).mockResolvedValue(true) // Password matches
      vi.mocked(bcrypt.hash).mockRejectedValue(new Error('Hashing failed'))

      // Act & Assert
      await expect(PasswordManager.rehashIfNeeded(mockPassword, oldHash)).rejects.toThrow('Password hashing failed')
    })
  })

  describe('timing attack prevention', () => {
    it('should use constant-time comparison via bcrypt', async () => {
      // This test ensures we're using bcrypt.compare which is resistant to timing attacks
      // We test both true and false cases to ensure consistent behavior
      
      // Arrange
      const password = 'testpassword'
      const hash = '$2b$12$somehash'
      
      vi.mocked(bcrypt.compare)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)

      // Act
      const result1 = await PasswordManager.compare(password, hash)
      const result2 = await PasswordManager.compare(password, hash)

      // Assert
      expect(result1).toBe(true)
      expect(result2).toBe(false)
      expect(bcrypt.compare).toHaveBeenCalledTimes(2)
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hash)
    })
  })

  describe('salt generation uniqueness', () => {
    it('should generate different hashes for same password', async () => {
      // Arrange
      const password = 'samepassword'
      const hash1 = '$2b$12$firsthash'
      const hash2 = '$2b$12$secondhash'
      
      vi.mocked(bcrypt.hash)
        .mockResolvedValueOnce(hash1)
        .mockResolvedValueOnce(hash2)

      // Act
      const result1 = await PasswordManager.hash(password)
      const result2 = await PasswordManager.hash(password)

      // Assert
      expect(result1).toBe(hash1)
      expect(result2).toBe(hash2)
      expect(result1).not.toBe(result2)
      expect(bcrypt.hash).toHaveBeenCalledTimes(2)
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 12)
    })
  })

  describe('error handling for invalid inputs', () => {
    it('should handle empty password in hash', async () => {
      // Act & Assert
      await expect(PasswordManager.hash('')).resolves.toBe(mockHash)
      expect(bcrypt.hash).toHaveBeenCalledWith('', 12)
    })

    it('should handle empty password in compare', async () => {
      // Act & Assert
      await expect(PasswordManager.compare('', mockHash)).resolves.toBe(true)
      expect(bcrypt.compare).toHaveBeenCalledWith('', mockHash)
    })

    it('should handle empty password in validation', () => {
      // Act
      const result = PasswordManager.validatePasswordStrength('')

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must be at least 8 characters long')
    })

    it('should handle null/undefined inputs gracefully', () => {
      // Act & Assert
      expect(() => PasswordManager.validatePasswordStrength(null as any)).toThrow()
      expect(() => PasswordManager.validatePasswordStrength(undefined as any)).toThrow()
    })
  })
})