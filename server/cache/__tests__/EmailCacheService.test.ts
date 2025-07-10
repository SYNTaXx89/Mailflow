import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EmailCacheService, CachedEmail, CachedEmailContent, CacheStats } from '../EmailCacheService'
import { DatabaseManager } from '../../database/DatabaseManager'

describe('EmailCacheService - Email Cache Management', () => {
  let emailCacheService: EmailCacheService
  let mockDatabaseManager: DatabaseManager

  const sampleDbEmail = {
    id: 'email-123',
    account_id: 'account-456',
    subject: 'Test Email Subject',
    sender: 'John Doe <john@example.com>',
    recipient: 'Jane Smith <jane@example.com>',
    preview: 'This is a test email preview',
    full_body: null,
    date: '2023-12-01T10:00:00Z',
    is_read: false,
    has_attachments: false,
    uid: '123',
    message_id: 'msg-123',
    created_at: '2023-12-01T10:00:00Z'
  }

  const sampleCachedEmail: CachedEmail = {
    id: 'email-123',
    accountId: 'account-456',
    uid: 123,
    from: { name: 'John Doe', email: 'john@example.com' },
    to: { name: 'Jane Smith', email: 'jane@example.com' },
    subject: 'Test Email Subject',
    date: new Date('2023-12-01T10:00:00Z'),
    isRead: false,
    hasAttachments: false,
    preview: 'This is a test email preview',
    messageId: 'msg-123',
    size: 0,
    cachedAt: new Date('2023-12-01T10:00:00Z')
  }

  const sampleEmailContent: CachedEmailContent = {
    ...sampleCachedEmail,
    textContent: 'This is the full text content of the email',
    htmlContent: '<p>This is the full HTML content of the email</p>',
    attachmentList: [
      { filename: 'document.pdf', size: 1024, contentType: 'application/pdf' }
    ]
  }

  beforeEach(() => {
    // Create mock DatabaseManager
    mockDatabaseManager = {
      getEmailsByAccountId: vi.fn(),
      getEmailById: vi.fn(),
      createEmailSafe: vi.fn(),
      updateEmail: vi.fn(),
      deleteEmail: vi.fn(),
      clearEmailsByAccountId: vi.fn(),
    } as unknown as DatabaseManager

    // Create EmailCacheService instance
    emailCacheService = new EmailCacheService(mockDatabaseManager)

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Cache Retrieval Operations', () => {
    it('should get cached emails for an account', async () => {
      // Arrange
      const dbEmails = [sampleDbEmail]
      mockDatabaseManager.getEmailsByAccountId = vi.fn().mockResolvedValue(dbEmails)

      // Act
      const result = await emailCacheService.getCachedEmails('account-456')

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'email-123',
        accountId: 'account-456',
        uid: 123,
        subject: 'Test Email Subject',
        isRead: false
      })
      expect(mockDatabaseManager.getEmailsByAccountId).toHaveBeenCalledWith('account-456', 1000)
    })

    it('should get cached emails with limit', async () => {
      // Arrange
      const dbEmails = [sampleDbEmail]
      mockDatabaseManager.getEmailsByAccountId = vi.fn().mockResolvedValue(dbEmails)

      // Act
      const result = await emailCacheService.getCachedEmails('account-456', 50)

      // Assert
      expect(mockDatabaseManager.getEmailsByAccountId).toHaveBeenCalledWith('account-456', 50)
      expect(result).toHaveLength(1)
    })

    it('should sort emails by date newest first', async () => {
      // Arrange
      const dbEmails = [
        { ...sampleDbEmail, id: 'email-1', date: '2023-12-01T10:00:00Z' },
        { ...sampleDbEmail, id: 'email-2', date: '2023-12-02T10:00:00Z' },
        { ...sampleDbEmail, id: 'email-3', date: '2023-11-30T10:00:00Z' }
      ]
      mockDatabaseManager.getEmailsByAccountId = vi.fn().mockResolvedValue(dbEmails)

      // Act
      const result = await emailCacheService.getCachedEmails('account-456')

      // Assert
      expect(result).toHaveLength(3)
      expect(result[0].id).toBe('email-2') // Newest first
      expect(result[1].id).toBe('email-1') 
      expect(result[2].id).toBe('email-3') // Oldest last
    })

    it('should return empty array on database error', async () => {
      // Arrange
      mockDatabaseManager.getEmailsByAccountId = vi.fn().mockRejectedValue(new Error('DB error'))

      // Act
      const result = await emailCacheService.getCachedEmails('account-456')

      // Assert
      expect(result).toEqual([])
    })

    it('should get cached email content when full body exists', async () => {
      // Arrange
      const contentData = {
        textContent: 'Full text content',
        htmlContent: '<p>Full HTML content</p>',
        attachmentList: []
      }
      const dbEmailWithContent = {
        ...sampleDbEmail,
        full_body: JSON.stringify(contentData)
      }
      mockDatabaseManager.getEmailById = vi.fn().mockResolvedValue(dbEmailWithContent)

      // Act
      const result = await emailCacheService.getCachedEmailContent('email-123')

      // Assert
      expect(result).not.toBeNull()
      expect(result!.textContent).toBe('Full text content')
      expect(result!.htmlContent).toBe('<p>Full HTML content</p>')
      expect(result!.attachmentList).toEqual([])
    })

    it('should return null when no full content is cached', async () => {
      // Arrange
      const dbEmailWithoutContent = { ...sampleDbEmail, full_body: null }
      mockDatabaseManager.getEmailById = vi.fn().mockResolvedValue(dbEmailWithoutContent)

      // Act
      const result = await emailCacheService.getCachedEmailContent('email-123')

      // Assert
      expect(result).toBeNull()
    })

    it('should handle legacy plain text content format', async () => {
      // Arrange
      const dbEmailWithLegacyContent = {
        ...sampleDbEmail,
        full_body: 'Legacy plain text content'
      }
      mockDatabaseManager.getEmailById = vi.fn().mockResolvedValue(dbEmailWithLegacyContent)

      // Act
      const result = await emailCacheService.getCachedEmailContent('email-123')

      // Assert
      expect(result).not.toBeNull()
      expect(result!.textContent).toBe('Legacy plain text content')
      expect(result!.htmlContent).toBeUndefined()
      expect(result!.attachmentList).toEqual([])
    })

    it('should return null when email does not exist', async () => {
      // Arrange
      mockDatabaseManager.getEmailById = vi.fn().mockResolvedValue(null)

      // Act
      const result = await emailCacheService.getCachedEmailContent('nonexistent-email')

      // Assert
      expect(result).toBeNull()
    })

    it('should get cached email by UID', async () => {
      // Arrange
      const dbEmails = [sampleDbEmail]
      mockDatabaseManager.getEmailsByAccountId = vi.fn().mockResolvedValue(dbEmails)

      // Act
      const result = await emailCacheService.getCachedEmailByUID('account-456', 123)

      // Assert
      expect(result).not.toBeNull()
      expect(result!.uid).toBe(123)
      expect(result!.id).toBe('email-123')
    })

    it('should return null when email with UID not found', async () => {
      // Arrange
      mockDatabaseManager.getEmailsByAccountId = vi.fn().mockResolvedValue([])

      // Act
      const result = await emailCacheService.getCachedEmailByUID('account-456', 999)

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('Cache Storage Operations', () => {
    it('should store emails using merge strategy', async () => {
      // Arrange
      const newEmails = [sampleCachedEmail]
      mockDatabaseManager.getEmailsByAccountId = vi.fn().mockResolvedValue([]) // No existing emails
      mockDatabaseManager.createEmailSafe = vi.fn().mockResolvedValue(undefined)

      // Act
      await emailCacheService.storeEmails('account-456', newEmails)

      // Assert
      expect(mockDatabaseManager.createEmailSafe).toHaveBeenCalledWith(expect.objectContaining({
        id: 'email-123',
        account_id: 'account-456',
        subject: 'Test Email Subject'
      }))
    })

    it('should merge emails without duplicating existing ones', async () => {
      // Arrange
      const existingEmails = [sampleDbEmail] // UID 123 already exists
      const newEmails = [
        sampleCachedEmail, // Duplicate UID 123
        { ...sampleCachedEmail, id: 'email-456', uid: 456 } // New UID 456
      ]
      
      mockDatabaseManager.getEmailsByAccountId = vi.fn().mockResolvedValue(existingEmails)
      mockDatabaseManager.createEmailSafe = vi.fn().mockResolvedValue(undefined)

      // Act
      await emailCacheService.mergeEmails('account-456', newEmails)

      // Assert
      // Should only create the genuinely new email (UID 456)
      expect(mockDatabaseManager.createEmailSafe).toHaveBeenCalledTimes(1)
      expect(mockDatabaseManager.createEmailSafe).toHaveBeenCalledWith(expect.objectContaining({
        id: 'email-456',
        uid: '456'
      }))
    })

    it('should handle merge when all emails already exist', async () => {
      // Arrange
      const existingEmails = [sampleDbEmail]
      const newEmails = [sampleCachedEmail] // Same UID as existing
      
      mockDatabaseManager.getEmailsByAccountId = vi.fn().mockResolvedValue(existingEmails)
      mockDatabaseManager.createEmailSafe = vi.fn().mockResolvedValue(undefined)

      // Act
      await emailCacheService.mergeEmails('account-456', newEmails)

      // Assert
      // Should not create any new emails
      expect(mockDatabaseManager.createEmailSafe).not.toHaveBeenCalled()
    })

    it('should replace all emails destructively', async () => {
      // Arrange
      const newEmails = [sampleCachedEmail]
      mockDatabaseManager.clearEmailsByAccountId = vi.fn().mockResolvedValue(undefined)
      mockDatabaseManager.createEmailSafe = vi.fn().mockResolvedValue(undefined)

      // Act
      await emailCacheService.replaceAllEmails('account-456', newEmails)

      // Assert
      expect(mockDatabaseManager.clearEmailsByAccountId).toHaveBeenCalledWith('account-456')
      expect(mockDatabaseManager.createEmailSafe).toHaveBeenCalledWith(expect.objectContaining({
        id: 'email-123',
        account_id: 'account-456'
      }))
    })

    it('should store email content as JSON', async () => {
      // Arrange
      mockDatabaseManager.updateEmail = vi.fn().mockResolvedValue(undefined)

      // Act
      await emailCacheService.storeEmailContent('email-123', sampleEmailContent)

      // Assert
      expect(mockDatabaseManager.updateEmail).toHaveBeenCalledWith('email-123', {
        full_body: expect.stringContaining('"textContent":"This is the full text content of the email"')
      })
      
      // Verify the stored content is valid JSON
      const updateCall = vi.mocked(mockDatabaseManager.updateEmail).mock.calls[0]
      const storedContent = JSON.parse(updateCall[1].full_body)
      expect(storedContent.textContent).toBe('This is the full text content of the email')
      expect(storedContent.htmlContent).toBe('<p>This is the full HTML content of the email</p>')
      expect(storedContent.attachmentList).toHaveLength(1)
    })

    it('should convert cached email to database format correctly', async () => {
      // Arrange
      const email = sampleCachedEmail
      mockDatabaseManager.createEmailSafe = vi.fn().mockResolvedValue(undefined)

      // Act
      await (emailCacheService as any).storeSingleEmail(email)

      // Assert
      expect(mockDatabaseManager.createEmailSafe).toHaveBeenCalledWith({
        id: 'email-123',
        account_id: 'account-456',
        subject: 'Test Email Subject',
        sender: 'John Doe <john@example.com>',
        recipient: 'Jane Smith <jane@example.com>',
        preview: 'This is a test email preview',
        date: '2023-12-01T10:00:00.000Z',
        is_read: false,
        has_attachments: false,
        uid: '123',
        message_id: 'msg-123'
      })
    })
  })

  describe('Cache Update Operations', () => {
    it('should update read status', async () => {
      // Arrange
      mockDatabaseManager.updateEmail = vi.fn().mockResolvedValue(undefined)

      // Act
      await emailCacheService.updateReadStatus('email-123', true)

      // Assert
      expect(mockDatabaseManager.updateEmail).toHaveBeenCalledWith('email-123', { is_read: true })
    })

    it('should update attachment flag', async () => {
      // Arrange
      mockDatabaseManager.updateEmail = vi.fn().mockResolvedValue(undefined)

      // Act
      await emailCacheService.updateEmailAttachmentFlag('email-123', true)

      // Assert
      expect(mockDatabaseManager.updateEmail).toHaveBeenCalledWith('email-123', { has_attachments: true })
    })

    it('should remove email from cache', async () => {
      // Arrange
      mockDatabaseManager.deleteEmail = vi.fn().mockResolvedValue(undefined)

      // Act
      await emailCacheService.removeEmail('email-123')

      // Assert
      expect(mockDatabaseManager.deleteEmail).toHaveBeenCalledWith('email-123')
    })

    it('should clear account cache', async () => {
      // Arrange
      mockDatabaseManager.clearEmailsByAccountId = vi.fn().mockResolvedValue(undefined)

      // Act
      await emailCacheService.clearAccountCache('account-456')

      // Assert
      expect(mockDatabaseManager.clearEmailsByAccountId).toHaveBeenCalledWith('account-456')
    })

    it('should handle update errors gracefully', async () => {
      // Arrange
      mockDatabaseManager.updateEmail = vi.fn().mockRejectedValue(new Error('Update failed'))

      // Act & Assert
      await expect(emailCacheService.updateReadStatus('email-123', true)).rejects.toThrow('Update failed')
    })
  })

  describe('Cache Search Operations', () => {
    it('should search cached emails by query', async () => {
      // Arrange
      const emails = [
        { ...sampleCachedEmail, subject: 'Important Meeting' },
        { ...sampleCachedEmail, id: 'email-456', subject: 'Vacation Plans', from: { name: 'Alice Important', email: 'alice@example.com' } },
        { ...sampleCachedEmail, id: 'email-789', subject: 'Random Update' }
      ]
      mockDatabaseManager.getEmailsByAccountId = vi.fn().mockResolvedValue(
        emails.map(e => ({ ...sampleDbEmail, id: e.id, subject: e.subject, sender: `${e.from.name} <${e.from.email}>` }))
      )

      // Act
      const result = await emailCacheService.searchCachedEmails('account-456', 'important')

      // Assert
      expect(result).toHaveLength(2) // Should match "Important Meeting" and "Alice Important"
      expect(result[0].subject).toBe('Important Meeting')
      expect(result[1].from.name).toBe('Alice Important')
    })

    it('should search cached emails by sender', async () => {
      // Arrange
      const emails = [
        { ...sampleCachedEmail, from: { name: 'John Doe', email: 'john@example.com' } },
        { ...sampleCachedEmail, id: 'email-456', from: { name: 'Jane Smith', email: 'jane@company.com' } },
        { ...sampleCachedEmail, id: 'email-789', from: { name: 'Bob Johnson', email: 'bob@example.com' } }
      ]
      mockDatabaseManager.getEmailsByAccountId = vi.fn().mockResolvedValue(
        emails.map(e => ({ ...sampleDbEmail, id: e.id, sender: `${e.from.name} <${e.from.email}>` }))
      )

      // Act
      const result = await emailCacheService.searchCachedEmailsBySender('account-456', 'example.com')

      // Assert
      expect(result).toHaveLength(2) // Should match john@example.com and bob@example.com
      expect(result.map(e => e.from.email)).toEqual(['john@example.com', 'bob@example.com'])
    })

    it('should search cached emails by date range', async () => {
      // Arrange
      const emails = [
        { ...sampleCachedEmail, date: new Date('2023-12-01T10:00:00Z') },
        { ...sampleCachedEmail, id: 'email-456', date: new Date('2023-12-15T10:00:00Z') },
        { ...sampleCachedEmail, id: 'email-789', date: new Date('2023-12-31T10:00:00Z') }
      ]
      mockDatabaseManager.getEmailsByAccountId = vi.fn().mockResolvedValue(
        emails.map(e => ({ ...sampleDbEmail, id: e.id, date: e.date.toISOString() }))
      )

      // Act
      const result = await emailCacheService.searchCachedEmailsByDateRange(
        'account-456',
        new Date('2023-12-10T00:00:00Z'),
        new Date('2023-12-20T23:59:59Z')
      )

      // Assert
      expect(result).toHaveLength(1) // Should only match the middle date
      expect(result[0].id).toBe('email-456')
    })

    it('should return empty array when search fails', async () => {
      // Arrange
      mockDatabaseManager.getEmailsByAccountId = vi.fn().mockRejectedValue(new Error('Search failed'))

      // Act
      const result = await emailCacheService.searchCachedEmails('account-456', 'query')

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('Cache Maintenance Operations', () => {
    it('should get cache statistics for an account', async () => {
      // Arrange
      const emails = [
        { ...sampleDbEmail, is_read: true, date: '2023-12-01T10:00:00Z' },
        { ...sampleDbEmail, id: 'email-456', is_read: false, date: '2023-12-02T10:00:00Z' },
        { ...sampleDbEmail, id: 'email-789', is_read: false, date: '2023-11-30T10:00:00Z' }
      ]
      mockDatabaseManager.getEmailsByAccountId = vi.fn().mockResolvedValue(emails)

      // Act
      const stats = await emailCacheService.getCacheStats('account-456')

      // Assert
      expect(stats).toMatchObject({
        count: 3,
        readCount: 1,
        unreadCount: 2,
        totalSize: 0 // Size calculation would need to be implemented
      })
      expect(stats.newestDate).toEqual(new Date('2023-12-02T10:00:00Z'))
      expect(stats.oldestDate).toEqual(new Date('2023-11-30T10:00:00Z'))
    })

    it('should return empty stats when no emails exist', async () => {
      // Arrange
      mockDatabaseManager.getEmailsByAccountId = vi.fn().mockResolvedValue([])

      // Act
      const stats = await emailCacheService.getCacheStats('account-456')

      // Assert
      expect(stats).toMatchObject({
        count: 0,
        readCount: 0,
        unreadCount: 0,
        totalSize: 0
      })
    })

    it('should handle stats calculation errors gracefully', async () => {
      // Arrange - getCachedEmails handles its own errors and returns empty array
      mockDatabaseManager.getEmailsByAccountId = vi.fn().mockRejectedValue(new Error('Stats error'))

      // Act
      const stats = await emailCacheService.getCacheStats('account-456')

      // Assert - Should return default empty stats instead of throwing
      expect(stats).toMatchObject({
        count: 0,
        readCount: 0,
        unreadCount: 0,
        totalSize: 0
      })
    })

    it('should perform cleanup of old emails', async () => {
      // Act
      const result = await emailCacheService.cleanOldEmails()

      // Assert
      expect(result).toMatchObject({
        deletedCount: 0,
        errors: 0
      })
    })

    it('should get cache health status', async () => {
      // Act
      const health = await emailCacheService.getCacheHealthStatus()

      // Assert
      expect(health).toMatchObject({
        healthy: true,
        totalEmails: 0,
        accountsWithCache: []
      })
    })
  })

  describe('Email Address Parsing', () => {
    it('should parse email address with name and brackets', () => {
      // Arrange
      const emailService = emailCacheService as any
      
      // Act
      const result = emailService.parseEmailAddress('John Doe <john@example.com>')

      // Assert
      expect(result).toEqual({
        name: 'John Doe',
        email: 'john@example.com'
      })
    })

    it('should parse plain email address', () => {
      // Arrange
      const emailService = emailCacheService as any
      
      // Act
      const result = emailService.parseEmailAddress('john@example.com')

      // Assert
      expect(result).toEqual({
        name: 'john@example.com',
        email: 'john@example.com'
      })
    })

    it('should handle empty email address', () => {
      // Arrange
      const emailService = emailCacheService as any
      
      // Act
      const result = emailService.parseEmailAddress('')

      // Assert
      expect(result).toEqual({
        name: 'Unknown',
        email: ''
      })
    })

    it('should handle malformed email address', () => {
      // Arrange
      const emailService = emailCacheService as any
      
      // Act
      const result = emailService.parseEmailAddress('John Doe without brackets')

      // Assert
      expect(result).toEqual({
        name: 'John Doe without brackets',
        email: 'John Doe without brackets'
      })
    })
  })

  describe('Data Conversion and Validation', () => {
    it('should convert database email to cached email format', () => {
      // Arrange
      const emailService = emailCacheService as any
      const dbEmail = {
        ...sampleDbEmail,
        sender: 'John Doe <john@example.com>',
        recipient: 'Jane Smith <jane@example.com>'
      }

      // Act
      const result = emailService.convertDbEmailToCachedEmail(dbEmail)

      // Assert
      expect(result).toMatchObject({
        id: 'email-123',
        accountId: 'account-456',
        uid: 123,
        from: { name: 'John Doe', email: 'john@example.com' },
        to: { name: 'Jane Smith', email: 'jane@example.com' },
        subject: 'Test Email Subject',
        isRead: false,
        hasAttachments: false
      })
    })

    it('should validate email data correctly', () => {
      // Arrange
      const emailService = emailCacheService as any

      // Act & Assert
      expect(emailService.validateEmailData(sampleCachedEmail)).toBe(true)
      
      expect(emailService.validateEmailData({
        ...sampleCachedEmail,
        id: '' // Invalid
      })).toBe(false)
      
      expect(emailService.validateEmailData({
        ...sampleCachedEmail,
        from: { name: 'Test', email: '' } // Invalid
      })).toBe(false)
    })

    it('should generate cache key correctly', () => {
      // Arrange
      const emailService = emailCacheService as any

      // Act
      const result = emailService.generateCacheKey('account-456', 123)

      // Assert
      expect(result).toBe('account-456:123')
    })

    it('should handle missing or null fields in database email', () => {
      // Arrange
      const emailService = emailCacheService as any
      const incompleteDbEmail = {
        id: 'email-123',
        account_id: 'account-456',
        subject: null,
        sender: null,
        recipient: null,
        uid: null,
        date: '2023-12-01T10:00:00Z'
      }

      // Act
      const result = emailService.convertDbEmailToCachedEmail(incompleteDbEmail)

      // Assert
      expect(result.subject).toBe('No Subject')
      expect(result.uid).toBe(0)
      expect(result.from).toEqual({ name: 'Unknown', email: '' })
      expect(result.to).toEqual({ name: 'Unknown', email: '' })
    })
  })
})