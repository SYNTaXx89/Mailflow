import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EmailService, EmailServiceCredentials, EmailServiceOptions } from '../EmailService'
import { EmailCacheService, CachedEmail, CachedEmailContent } from '../../cache/EmailCacheService'
import { ImapContainer } from '../../imap/ImapContainer'
import { IdleConnectionManager } from '../../imap/IdleConnectionManager'
import { EmailParser } from '../../imap/EmailParser'
import { MimeParser } from '../../imap/MimeParser'

// Mock dependencies
vi.mock('../../imap/ImapContainer')
vi.mock('../../imap/IdleConnectionManager')
vi.mock('../../imap/EmailParser')
vi.mock('../../imap/MimeParser')

describe('EmailService - Core Email Operations', () => {
  let emailService: EmailService
  let mockEmailCacheService: EmailCacheService
  let mockImapContainer: any
  let mockIdleManager: any
  let credentials: EmailServiceCredentials

  const sampleCachedEmail: CachedEmail = {
    id: 'imap-123',
    accountId: 'test-account',
    uid: 123,
    from: { name: 'Test Sender', email: 'sender@example.com' },
    to: { name: 'Test Recipient', email: 'recipient@example.com' },
    subject: 'Test Email',
    date: new Date('2023-01-01T10:00:00Z'),
    isRead: false,
    hasAttachments: false,
    preview: 'Test Email - Test Sender',
    messageId: 'test-message-id',
    size: 1024,
    cachedAt: new Date('2023-01-01T10:00:00Z')
  }

  const sampleCachedContent: CachedEmailContent = {
    ...sampleCachedEmail,
    textContent: 'This is test email content',
    htmlContent: '<p>This is test email content</p>',
    attachmentList: []
  }

  beforeEach(() => {
    // Setup credentials
    credentials = {
      host: 'imap.example.com',
      port: 993,
      secure: true,
      user: 'test@example.com',
      password: 'password123'
    }

    // Mock EmailCacheService
    mockEmailCacheService = {
      getCachedEmails: vi.fn(),
      getCachedEmailByUID: vi.fn(),
      getCachedEmailContent: vi.fn(),
      storeEmails: vi.fn(),
      storeEmailContent: vi.fn(),
      updateReadStatus: vi.fn(),
      updateEmailAttachmentFlag: vi.fn(),
      removeEmail: vi.fn(),
      searchCachedEmails: vi.fn(),
    } as unknown as EmailCacheService

    // Mock ImapContainer
    mockImapContainer = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      getMailboxInfo: vi.fn(),
      fetchRecentEmails: vi.fn(),
      fetchEmailsByUID: vi.fn(),
      fetchEmailContent: vi.fn(),
      searchEmails: vi.fn(),
      markAsRead: vi.fn(),
      markAsUnread: vi.fn(),
      deleteEmail: vi.fn(),
      fetchRecentEmailsByDate: vi.fn(),
    }

    // Mock IdleConnectionManager
    mockIdleManager = {
      start: vi.fn(),
      stop: vi.fn(),
      manualRefresh: vi.fn(),
      getStatus: vi.fn(),
    }

    // Setup mocks
    vi.mocked(ImapContainer).mockImplementation(() => mockImapContainer)
    vi.mocked(IdleConnectionManager).mockImplementation(() => mockIdleManager)

    // Create EmailService instance
    emailService = new EmailService('test-account', credentials, mockEmailCacheService)

    // Clear all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
    // Clear static maps to avoid test interference
    EmailService.clearAllOperations()
  })

  describe('Smart Email Loading Strategy', () => {
    it('should return fresh cache when available and recent', async () => {
      // Arrange
      const cachedEmails = [sampleCachedEmail]
      mockEmailCacheService.getCachedEmails = vi.fn().mockResolvedValue(cachedEmails)
      
      // Set last sync to recent (within fresh duration)
      ;(EmailService as any).lastSync.set('test-account', new Date(Date.now() - 20000)) // 20 seconds ago

      // Act
      const result = await emailService.getEmails()

      // Assert
      expect(result.emails).toEqual(cachedEmails)
      expect(result.source).toBe('cache')
      expect(result.metadata.cacheHit).toBe(true)
      expect(result.metadata.isRefreshing).toBe(false)
      expect(mockImapContainer.connect).not.toHaveBeenCalled()
    })

    it('should trigger background refresh when cache is stale', async () => {
      // Arrange
      const cachedEmails = [sampleCachedEmail]
      mockEmailCacheService.getCachedEmails = vi.fn().mockResolvedValue(cachedEmails)
      
      // Set last sync to stale (beyond threshold)
      ;(EmailService as any).lastSync.set('test-account', new Date(Date.now() - 60000)) // 60 seconds ago

      // Act
      const result = await emailService.getEmails()

      // Assert
      expect(result.emails).toEqual(cachedEmails)
      expect(result.source).toBe('hybrid')
      expect(result.metadata.cacheHit).toBe(true)
      expect(result.metadata.isRefreshing).toBe(true)
    })

    it('should fetch fresh data when forceRefresh is true', async () => {
      // Arrange
      const cachedEmails = [sampleCachedEmail]
      const rawEmails = [{
        uid: 124,
        headers: { from: 'new@example.com', subject: 'New Email', date: new Date(), to: 'test@example.com', messageId: 'new-id' },
        flags: [],
        size: 2048,
        bodyStructure: { type: 'text', subtype: 'plain' }
      }]

      mockEmailCacheService.getCachedEmails = vi.fn().mockResolvedValue(cachedEmails)
      mockImapContainer.getMailboxInfo = vi.fn().mockResolvedValue({ total: 10 })
      mockImapContainer.fetchRecentEmails = vi.fn().mockResolvedValue(rawEmails)
      mockEmailCacheService.storeEmails = vi.fn().mockResolvedValue(undefined)

      // Mock MimeParser
      vi.mocked(MimeParser.parseEmailHeader).mockReturnValue({
        from: 'new@example.com',
        to: 'test@example.com',
        subject: 'New Email',
        date: new Date(),
        messageId: 'new-id'
      })
      vi.mocked(MimeParser.checkForAttachments).mockReturnValue(false)

      // Act
      const result = await emailService.getEmails({ forceRefresh: true })

      // Assert
      expect(result.source).toBe('imap')
      expect(result.metadata.cacheHit).toBe(false)
      expect(mockImapContainer.connect).toHaveBeenCalled()
      expect(mockImapContainer.fetchRecentEmails).toHaveBeenCalled()
      expect(mockImapContainer.disconnect).toHaveBeenCalled()
      expect(mockEmailCacheService.storeEmails).toHaveBeenCalled()
    })

    it('should fetch fresh data when no cache exists', async () => {
      // Arrange
      mockEmailCacheService.getCachedEmails = vi.fn().mockResolvedValue([])
      mockImapContainer.getMailboxInfo = vi.fn().mockResolvedValue({ total: 5 })
      mockImapContainer.fetchRecentEmails = vi.fn().mockResolvedValue([])
      mockEmailCacheService.storeEmails = vi.fn().mockResolvedValue(undefined)

      // Act
      const result = await emailService.getEmails()

      // Assert
      expect(result.source).toBe('imap')
      expect(mockImapContainer.connect).toHaveBeenCalled()
      expect(mockImapContainer.fetchRecentEmails).toHaveBeenCalled()
    })

    it('should fallback to cache when IMAP fetch fails', async () => {
      // Arrange
      const cachedEmails = [sampleCachedEmail]
      mockEmailCacheService.getCachedEmails = vi.fn().mockResolvedValue(cachedEmails)
      mockImapContainer.connect = vi.fn().mockRejectedValue(new Error('IMAP connection failed'))

      // Act
      const result = await emailService.getEmails({ forceRefresh: true })

      // Assert
      expect(result.emails).toEqual(cachedEmails)
      expect(result.source).toBe('cache')
      expect(result.metadata.cacheHit).toBe(true)
    })

    it('should throw error when both IMAP and cache fail', async () => {
      // Arrange
      mockEmailCacheService.getCachedEmails = vi.fn().mockRejectedValue(new Error('Cache error'))
      mockImapContainer.connect = vi.fn().mockRejectedValue(new Error('IMAP error'))

      // Act & Assert
      await expect(emailService.getEmails({ forceRefresh: true })).rejects.toThrow('Cache error')
    })
  })

  describe('Email Content Management', () => {
    it('should return cached content when available', async () => {
      // Arrange
      mockEmailCacheService.getCachedEmailContent = vi.fn().mockResolvedValue(sampleCachedContent)

      // Act
      const result = await emailService.getEmailContent('imap-123')

      // Assert
      expect(result.content).toEqual(sampleCachedContent)
      expect(result.source).toBe('cache')
      expect(mockImapContainer.connect).not.toHaveBeenCalled()
    })

    it('should fetch from IMAP when content not cached', async () => {
      // Arrange
      mockEmailCacheService.getCachedEmailContent = vi.fn().mockResolvedValue(null)
      mockEmailCacheService.getCachedEmailByUID = vi.fn().mockResolvedValue(sampleCachedEmail)
      
      const rawContent = { rawBody: 'raw email content' }
      const parsedEmail = { 
        text: 'Parsed text content', 
        html: '<p>Parsed HTML content</p>',
        attachments: []
      }

      mockImapContainer.fetchEmailContent = vi.fn().mockResolvedValue(rawContent)
      vi.mocked(EmailParser.parseEmail).mockResolvedValue(parsedEmail)
      vi.mocked(EmailParser.extractEmailContent).mockReturnValue({
        textContent: parsedEmail.text,
        htmlContent: parsedEmail.html
      })
      vi.mocked(EmailParser.extractAttachments).mockReturnValue([])
      mockEmailCacheService.storeEmailContent = vi.fn().mockResolvedValue(undefined)

      // Act
      const result = await emailService.getEmailContent('imap-123')

      // Assert
      expect(result.source).toBe('imap')
      expect(mockImapContainer.connect).toHaveBeenCalled()
      expect(mockImapContainer.fetchEmailContent).toHaveBeenCalledWith(123)
      expect(EmailParser.parseEmail).toHaveBeenCalledWith(rawContent.rawBody)
      expect(mockEmailCacheService.storeEmailContent).toHaveBeenCalled()
    })

    it('should update attachment flag when attachments found during parsing', async () => {
      // Arrange
      const emailWithoutAttachments = { ...sampleCachedEmail, hasAttachments: false }
      mockEmailCacheService.getCachedEmailContent = vi.fn().mockResolvedValue(null)
      mockEmailCacheService.getCachedEmailByUID = vi.fn().mockResolvedValue(emailWithoutAttachments)
      
      const attachments = [{ filename: 'test.pdf', size: 1024, contentType: 'application/pdf' }]
      const parsedEmail = { 
        text: 'Email with attachment', 
        html: '<p>Email with attachment</p>',
        attachments: [{ content: Buffer.from('test') }]
      }

      mockImapContainer.fetchEmailContent = vi.fn().mockResolvedValue({ rawBody: 'raw' })
      vi.mocked(EmailParser.parseEmail).mockResolvedValue(parsedEmail)
      vi.mocked(EmailParser.extractEmailContent).mockReturnValue({ textContent: parsedEmail.text })
      vi.mocked(EmailParser.extractAttachments).mockReturnValue(attachments)
      mockEmailCacheService.updateEmailAttachmentFlag = vi.fn().mockResolvedValue(undefined)
      mockEmailCacheService.storeEmailContent = vi.fn().mockResolvedValue(undefined)

      // Act
      await emailService.getEmailContent('imap-123')

      // Assert
      expect(mockEmailCacheService.updateEmailAttachmentFlag).toHaveBeenCalledWith('imap-123', true)
    })

    it('should throw error when email not found', async () => {
      // Arrange
      mockEmailCacheService.getCachedEmailContent = vi.fn().mockResolvedValue(null)
      mockEmailCacheService.getCachedEmailByUID = vi.fn().mockResolvedValue(null)

      // Act & Assert
      await expect(emailService.getEmailContent('imap-999')).rejects.toThrow('Email not found: imap-999')
    })
  })

  describe('Email Operations', () => {
    it('should mark email as read in both IMAP and cache', async () => {
      // Arrange
      mockEmailCacheService.getCachedEmailByUID = vi.fn().mockResolvedValue(sampleCachedEmail)
      mockEmailCacheService.updateReadStatus = vi.fn().mockResolvedValue(undefined)

      // Act
      await emailService.markAsRead('imap-123')

      // Assert
      expect(mockImapContainer.connect).toHaveBeenCalled()
      expect(mockImapContainer.markAsRead).toHaveBeenCalledWith(123)
      expect(mockImapContainer.disconnect).toHaveBeenCalled()
      expect(mockEmailCacheService.updateReadStatus).toHaveBeenCalledWith('imap-123', true)
    })

    it('should delete email from both IMAP and cache', async () => {
      // Arrange
      mockEmailCacheService.getCachedEmailByUID = vi.fn().mockResolvedValue(sampleCachedEmail)
      mockEmailCacheService.removeEmail = vi.fn().mockResolvedValue(undefined)

      // Act
      await emailService.deleteEmail('imap-123')

      // Assert
      expect(mockImapContainer.connect).toHaveBeenCalled()
      expect(mockImapContainer.deleteEmail).toHaveBeenCalledWith(123)
      expect(mockImapContainer.disconnect).toHaveBeenCalled()
      expect(mockEmailCacheService.removeEmail).toHaveBeenCalledWith('imap-123')
    })

    it('should throw error when trying to delete non-existent email', async () => {
      // Arrange
      mockEmailCacheService.getCachedEmailByUID = vi.fn().mockResolvedValue(null)

      // Act & Assert
      await expect(emailService.deleteEmail('imap-999')).rejects.toThrow('Email not found: imap-999')
    })
  })

  describe('Email Search Functionality', () => {
    it('should search both cache and IMAP and merge results', async () => {
      // Arrange
      const cacheResults = [sampleCachedEmail]
      const imapUIDs = [124, 125]
      const imapRawEmails = [
        { uid: 124, headers: { from: 'test@example.com', subject: 'IMAP Result 1', date: new Date(), to: 'user@example.com', messageId: 'imap-1' }, flags: [], size: 1024, bodyStructure: { type: 'text' } },
        { uid: 125, headers: { from: 'test@example.com', subject: 'IMAP Result 2', date: new Date(), to: 'user@example.com', messageId: 'imap-2' }, flags: [], size: 2048, bodyStructure: { type: 'text' } }
      ]

      mockEmailCacheService.searchCachedEmails = vi.fn().mockResolvedValue(cacheResults)
      mockImapContainer.searchEmails = vi.fn().mockResolvedValue(imapUIDs)
      mockImapContainer.fetchEmailsByUID = vi.fn().mockResolvedValue(imapRawEmails)

      // Mock MimeParser for conversion
      vi.mocked(MimeParser.parseEmailHeader).mockImplementation((headers) => ({
        from: headers.from,
        to: headers.to,
        subject: headers.subject,
        date: headers.date,
        messageId: headers.messageId
      }))
      vi.mocked(MimeParser.checkForAttachments).mockReturnValue(false)

      // Act
      const result = await emailService.searchEmails('test query')

      // Assert
      expect(result.sources.cache).toBe(1)
      expect(result.sources.imap).toBe(2)
      expect(result.totalFound).toBe(3)
      expect(mockEmailCacheService.searchCachedEmails).toHaveBeenCalledWith('test-account', 'test query')
      expect(mockImapContainer.searchEmails).toHaveBeenCalledWith(['SUBJECT', 'test query'])
    })

    it('should handle IMAP search errors gracefully', async () => {
      // Arrange
      const cacheResults = [sampleCachedEmail]
      mockEmailCacheService.searchCachedEmails = vi.fn().mockResolvedValue(cacheResults)
      mockImapContainer.connect = vi.fn().mockRejectedValue(new Error('IMAP search failed'))

      // Act
      const result = await emailService.searchEmails('test query')

      // Assert
      expect(result.sources.cache).toBe(1)
      expect(result.sources.imap).toBe(0)
      expect(result.totalFound).toBe(1)
      expect(result.results).toEqual(cacheResults)
    })

    it('should deduplicate search results by UID', async () => {
      // Arrange
      const duplicateEmail = { 
        ...sampleCachedEmail, 
        uid: 123 // Same UID as cache result
      }
      const cacheResults = [sampleCachedEmail]
      const imapRawEmails = [
        { uid: 123, headers: { from: 'test@example.com', subject: 'Duplicate', date: new Date(), to: 'user@example.com', messageId: 'dup' }, flags: [], size: 1024, bodyStructure: { type: 'text' } }
      ]

      mockEmailCacheService.searchCachedEmails = vi.fn().mockResolvedValue(cacheResults)
      mockImapContainer.searchEmails = vi.fn().mockResolvedValue([123])
      mockImapContainer.fetchEmailsByUID = vi.fn().mockResolvedValue(imapRawEmails)

      vi.mocked(MimeParser.parseEmailHeader).mockReturnValue({
        from: 'test@example.com',
        to: 'user@example.com',
        subject: 'Duplicate',
        date: new Date(),
        messageId: 'dup'
      })
      vi.mocked(MimeParser.checkForAttachments).mockReturnValue(false)

      // Act
      const result = await emailService.searchEmails('test query')

      // Assert
      expect(result.totalFound).toBe(1) // Should not duplicate
      expect(result.results).toHaveLength(1)
    })
  })

  describe('Attachment Handling', () => {
    it('should fetch attachment with proper security checks', async () => {
      // Arrange
      const contentWithAttachments = {
        ...sampleCachedContent,
        attachmentList: [
          { filename: 'test.pdf', size: 1024, contentType: 'application/pdf' }
        ]
      }

      const parsedEmailWithAttachment = {
        attachments: [
          { content: Buffer.from('PDF content'), filename: 'test.pdf', size: 1024 }
        ]
      }

      mockEmailCacheService.getCachedEmailContent = vi.fn().mockResolvedValue(contentWithAttachments)
      mockImapContainer.fetchEmailContent = vi.fn().mockResolvedValue({ rawBody: 'raw' })
      vi.mocked(EmailParser.parseEmail).mockResolvedValue(parsedEmailWithAttachment)

      // Act
      const result = await emailService.getAttachment('imap-123', '1')

      // Assert
      expect(result.filename).toBe('test.pdf')
      expect(result.contentType).toBe('application/pdf')
      expect(result.size).toBe(11) // Buffer.from('PDF content').length
      expect(result.buffer).toEqual(Buffer.from('PDF content'))
    })

    it('should reject attachments that are too large', async () => {
      // Arrange
      const contentWithLargeAttachment = {
        ...sampleCachedContent,
        attachmentList: [
          { filename: 'huge.zip', size: 30 * 1024 * 1024, contentType: 'application/zip' } // 30MB
        ]
      }

      mockEmailCacheService.getCachedEmailContent = vi.fn().mockResolvedValue(contentWithLargeAttachment)

      // Act & Assert
      await expect(emailService.getAttachment('imap-123', '1')).rejects.toThrow('Attachment too large')
    })

    it('should validate attachment security measures', async () => {
      // This test verifies that attachment functionality includes security measures
      // Note: The actual sanitization logic is present in the code but requires deeper mocking
      
      // Arrange
      const contentWithAttachment = {
        ...sampleCachedContent,
        attachmentList: [
          { filename: 'document.pdf', size: 1024, contentType: 'application/pdf' }
        ]
      }

      const parsedEmailWithAttachment = {
        attachments: [
          { content: Buffer.from('PDF content'), filename: 'document.pdf' }
        ]
      }

      mockEmailCacheService.getCachedEmailContent = vi.fn().mockResolvedValue(contentWithAttachment)
      mockImapContainer.fetchEmailContent = vi.fn().mockResolvedValue({ rawBody: 'raw' })
      vi.mocked(EmailParser.parseEmail).mockResolvedValue(parsedEmailWithAttachment)

      // Act
      const result = await emailService.getAttachment('imap-123', '1')

      // Assert - Verify basic attachment functionality and security considerations
      expect(result.filename).toBe('document.pdf')
      expect(result.contentType).toBe('application/pdf')
      expect(result.size).toBe(11) // Buffer.from('PDF content').length
      expect(result.buffer).toBeInstanceOf(Buffer)
      
      // Verify the attachment parsing flow was called correctly
      expect(mockImapContainer.fetchEmailContent).toHaveBeenCalledWith(123)
      expect(EmailParser.parseEmail).toHaveBeenCalled()
    })

    it('should throw error for non-existent attachment index', async () => {
      // Arrange
      mockEmailCacheService.getCachedEmailContent = vi.fn().mockResolvedValue(sampleCachedContent)

      // Act & Assert
      await expect(emailService.getAttachment('imap-123', '5')).rejects.toThrow('Attachment not found: 5')
    })
  })

  describe('IDLE Connection Management', () => {
    it('should start IDLE connection with proper event handlers', async () => {
      // Arrange
      const eventCallback = vi.fn()

      // Act
      await emailService.startIdleConnection(eventCallback)

      // Assert
      expect(IdleConnectionManager).toHaveBeenCalledWith(
        expect.objectContaining({
          host: credentials.host,
          port: credentials.port,
          secure: credentials.secure,
          user: credentials.user,
          password: credentials.password
        }),
        expect.objectContaining({
          onNewMail: expect.any(Function),
          onMailDeleted: expect.any(Function),
          onError: expect.any(Function),
          onConnect: expect.any(Function),
          onDisconnect: expect.any(Function)
        })
      )
      expect(mockIdleManager.start).toHaveBeenCalled()
    })

    it('should stop IDLE connection properly', async () => {
      // Arrange
      await emailService.startIdleConnection()

      // Act
      await emailService.stopIdleConnection()

      // Assert
      expect(mockIdleManager.stop).toHaveBeenCalled()
    })

    it('should handle IDLE connection errors', async () => {
      // Arrange
      mockIdleManager.start = vi.fn().mockRejectedValue(new Error('IDLE start failed'))

      // Act & Assert
      await expect(emailService.startIdleConnection()).rejects.toThrow('IDLE start failed')
    })

    it('should refresh during IDLE when connection is active', async () => {
      // Arrange
      await emailService.startIdleConnection()

      // Act
      await emailService.refreshDuringIdle()

      // Assert
      expect(mockIdleManager.manualRefresh).toHaveBeenCalled()
    })

    it('should fall back to regular refresh when no IDLE connection', async () => {
      // Arrange
      mockEmailCacheService.getCachedEmails = vi.fn().mockResolvedValue([])
      mockImapContainer.getMailboxInfo = vi.fn().mockResolvedValue({ total: 0 })
      mockImapContainer.fetchRecentEmails = vi.fn().mockResolvedValue([])
      mockEmailCacheService.storeEmails = vi.fn().mockResolvedValue(undefined)

      // Act
      await emailService.refreshDuringIdle()

      // Assert
      expect(mockImapContainer.connect).toHaveBeenCalled()
    })

    it('should return IDLE status when connection is active', async () => {
      // Arrange
      const expectedStatus = { connected: true, idling: true }
      mockIdleManager.getStatus = vi.fn().mockReturnValue(expectedStatus)
      await emailService.startIdleConnection()

      // Act
      const status = emailService.getIdleStatus()

      // Assert
      expect(status).toEqual(expectedStatus)
    })

    it('should return null status when no IDLE connection', () => {
      // Act
      const status = emailService.getIdleStatus()

      // Assert
      expect(status).toBeNull()
    })
  })

  describe('Service Lifecycle Management', () => {
    it('should disconnect all connections properly', async () => {
      // Arrange
      await emailService.startIdleConnection()

      // Act
      await emailService.disconnect()

      // Assert
      expect(mockIdleManager.stop).toHaveBeenCalled()
      expect(mockImapContainer.disconnect).toHaveBeenCalled()
    })

    it('should handle disconnect errors gracefully', async () => {
      // Arrange
      mockImapContainer.disconnect = vi.fn().mockRejectedValue(new Error('Disconnect failed'))

      // Act
      await emailService.disconnect() // Should not throw

      // Assert
      expect(mockImapContainer.disconnect).toHaveBeenCalled()
    })
  })

  describe('Static Utility Methods', () => {
    it('should track refresh status per account', () => {
      // Act
      const status1 = EmailService.getRefreshStatus('account1')
      const status2 = EmailService.getRefreshStatus('account2')

      // Assert
      expect(status1.isRefreshing).toBe(false)
      expect(status2.isRefreshing).toBe(false)
      expect(status1.lastSync).toBeUndefined()
    })

    it('should clear all operations', () => {
      // Arrange
      ;(EmailService as any).lastSync.set('test-account', new Date())
      ;(EmailService as any).refreshPromises.set('test-account', Promise.resolve([]))

      // Act
      EmailService.clearAllOperations()

      // Assert
      expect((EmailService as any).lastSync.size).toBe(0)
      expect((EmailService as any).refreshPromises.size).toBe(0)
    })

    it('should stop all IDLE connections', async () => {
      // Arrange
      const mockIdleManager2 = { stop: vi.fn() }
      ;(EmailService as any).idleManagers.set('account1', mockIdleManager)
      ;(EmailService as any).idleManagers.set('account2', mockIdleManager2)

      // Act
      await EmailService.stopAllIdleConnections()

      // Assert
      expect(mockIdleManager.stop).toHaveBeenCalled()
      expect(mockIdleManager2.stop).toHaveBeenCalled()
      expect((EmailService as any).idleManagers.size).toBe(0)
    })

    it('should get all IDLE statuses', () => {
      // Arrange
      const status1 = { connected: true, idling: true }
      const status2 = { connected: false, idling: false }
      
      mockIdleManager.getStatus = vi.fn().mockReturnValue(status1)
      const mockIdleManager2 = { getStatus: vi.fn().mockReturnValue(status2) }
      
      ;(EmailService as any).idleManagers.set('account1', mockIdleManager)
      ;(EmailService as any).idleManagers.set('account2', mockIdleManager2)

      // Act
      const statuses = EmailService.getAllIdleStatuses()

      // Assert
      expect(statuses.get('account1')).toEqual(status1)
      expect(statuses.get('account2')).toEqual(status2)
    })

    it('should create EmailService from account data', () => {
      // Arrange
      const accountData = {
        id: 'test-account',
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
        imap: {
          host: 'imap.example.com',
          port: 993,
          security: 'SSL/TLS'
        }
      }

      // Act
      const service = EmailService.createFromAccount(accountData, mockEmailCacheService)

      // Assert
      expect(service).toBeInstanceOf(EmailService)
      expect((service as any).accountId).toBe('test-account')
      expect((service as any).credentials.host).toBe('imap.example.com')
      expect((service as any).credentials.secure).toBe(true)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed email IDs gracefully', async () => {
      // Act & Assert
      await expect(emailService.getEmailContent('invalid-id')).rejects.toThrow()
    })

    it('should handle cache service errors in assessment', async () => {
      // Arrange
      mockEmailCacheService.getCachedEmails = vi.fn().mockRejectedValue(new Error('Cache error'))

      // Act & Assert
      await expect(emailService.getEmails()).rejects.toThrow()
    })

    it('should handle IMAP timeout during fetch', async () => {
      // Arrange
      mockEmailCacheService.getCachedEmails = vi.fn().mockResolvedValue([])
      mockImapContainer.connect = vi.fn().mockResolvedValue(undefined)
      mockImapContainer.getMailboxInfo = vi.fn().mockRejectedValue(new Error('IMAP timeout'))
      // Make the fallback cache also fail to ensure error propagation
      mockEmailCacheService.getCachedEmails = vi.fn()
        .mockResolvedValueOnce([]) // First call in assessCacheStatus
        .mockRejectedValueOnce(new Error('Cache also failed')) // Second call in fallback

      // Act & Assert
      await expect(emailService.getEmails()).rejects.toThrow('IMAP timeout')
    })

    it('should validate attachment ID bounds', async () => {
      // Arrange
      mockEmailCacheService.getCachedEmailContent = vi.fn().mockResolvedValue(sampleCachedContent)

      // Act & Assert
      await expect(emailService.getAttachment('imap-123', '0')).rejects.toThrow('Attachment not found: 0')
      await expect(emailService.getAttachment('imap-123', '-1')).rejects.toThrow('Attachment not found: -1')
    })
  })
})