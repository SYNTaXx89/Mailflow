import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createEmailsRouter } from '../emails'
import { DatabaseManager } from '../../database/DatabaseManager'
import { AuthMiddleware } from '../../auth/AuthMiddleware'
import { EmailCacheService } from '../../cache/EmailCacheService'
import { EmailService } from '../../services'

// Mock getAccountWithCredentials utility
vi.mock('../../utils/accountHelpers', () => ({
  getAccountWithCredentials: vi.fn(),
}));

import { getAccountWithCredentials } from '../../utils/accountHelpers';
const mockGetAccountWithCredentials = vi.mocked(getAccountWithCredentials);

describe('Emails Routes Integration Tests', () => {
  let app: express.Application
  let mockDatabaseManager: DatabaseManager
  let mockEmailCacheService: EmailCacheService
  let mockAuthMiddleware: AuthMiddleware
  let mockEmailService: any

  const testUser = {
    userId: 'user-123',
    email: 'test@example.com',
    role: 'user' as const
  }

  const testAccount = {
    id: 'account-456',
    user_id: 'user-123',
    name: 'Test Account',
    email: 'test@example.com',
    encrypted_credentials: 'encrypted-creds',
    config: '{"imap":{"host":"imap.example.com","port":993}}',
    created_at: '2023-12-01T10:00:00Z'
  }

  const testEmails = [
    {
      id: 'email-1',
      accountId: 'account-456',
      uid: 101,
      subject: 'Test Email 1',
      from: { name: 'John Doe', email: 'john@example.com' },
      to: { name: 'Test User', email: 'test@example.com' },
      date: '2023-12-01T10:00:00.000Z',
      isRead: false,
      hasAttachments: false,
      preview: 'This is a test email preview'
    },
    {
      id: 'email-2',
      accountId: 'account-456',
      uid: 102,
      subject: 'Test Email 2',
      from: { name: 'Jane Smith', email: 'jane@example.com' },
      to: { name: 'Test User', email: 'test@example.com' },
      date: '2023-12-01T11:00:00.000Z',
      isRead: true,
      hasAttachments: true,
      preview: 'Another test email'
    }
  ]

  const testEmailContent = {
    id: 'email-1',
    textContent: 'This is the full text content',
    htmlContent: '<p>This is the full HTML content</p>',
    attachmentList: []
  }

  beforeEach(() => {
    // Mock EmailService
    mockEmailService = {
      getEmails: vi.fn(),
      getEmailContent: vi.fn(),
      markAsRead: vi.fn(),
      deleteEmail: vi.fn(),
      searchEmails: vi.fn(),
      getAttachment: vi.fn()
    }

    // Mock EmailService static methods
    vi.spyOn(EmailService, 'createFromAccount').mockReturnValue(mockEmailService)
    vi.spyOn(EmailService, 'getRefreshStatus').mockReturnValue({
      isRefreshing: false,
      lastRefresh: new Date().toISOString(),
      nextRefresh: null
    })

    // Mock getAccountWithCredentials to return valid account by default
    mockGetAccountWithCredentials.mockResolvedValue({
      id: 'account-456',
      email: 'test@example.com',
      username: 'test@example.com',
      password: 'decryptedpassword'
    })

    // Create mock services with proper setup
    mockDatabaseManager = {
      getAccountById: vi.fn().mockResolvedValue(testAccount),
      decrypt: vi.fn().mockReturnValue(JSON.stringify({
        username: 'test@example.com',
        password: 'testpass'
      })),
    } as unknown as DatabaseManager

    mockEmailCacheService = {
      getCacheStats: vi.fn().mockResolvedValue({
        count: 50,
        oldestDate: '2023-11-01T00:00:00.000Z',
        newestDate: '2023-12-01T12:00:00.000Z',
        totalSize: 2048,
        readCount: 25,
        unreadCount: 25
      }),
    } as unknown as EmailCacheService

    mockAuthMiddleware = {
      authenticate: vi.fn((req, res, next) => {
        req.user = testUser
        next()
      }),
      requireAccountOwnership: vi.fn(() => (req, res, next) => {
        // Mock account ownership verification
        if (req.params.accountId === 'account-456') {
          next()
        } else {
          res.status(403).json({ error: 'Access denied' })
        }
      }),
    } as unknown as AuthMiddleware

    // Setup express app with emails routes
    app = express()
    app.use(express.json())
    app.use('/emails', createEmailsRouter(mockDatabaseManager, mockEmailCacheService, mockAuthMiddleware))

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /emails/:accountId', () => {
    it('should get emails with default parameters', async () => {
      // Arrange
      mockEmailService.getEmails.mockResolvedValue({
        emails: testEmails,
        source: 'cache',
        metadata: { total: 2, cached: 2, fresh: 0 }
      })

      // Act
      const response = await request(app)
        .get('/emails/account-456')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        emails: testEmails,
        source: 'cache',
        metadata: { total: 2, cached: 2, fresh: 0 }
      })

      expect(mockEmailService.getEmails).toHaveBeenCalledWith({
        forceRefresh: false,
        limit: 30
      })
    })

    it('should handle forceRefresh and custom limit', async () => {
      // Arrange
      mockEmailService.getEmails.mockResolvedValue({
        emails: testEmails.slice(0, 1),
        source: 'imap',
        metadata: { total: 1, cached: 0, fresh: 1 }
      })

      // Act
      const response = await request(app)
        .get('/emails/account-456?forceRefresh=true&limit=10')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        emails: testEmails.slice(0, 1),
        source: 'imap'
      })

      expect(mockEmailService.getEmails).toHaveBeenCalledWith({
        forceRefresh: true,
        limit: 10
      })
    })

    it('should return 403 for non-existent account (middleware blocks access)', async () => {
      // Arrange - The requireAccountOwnership middleware will check ownership first
      // and return 403 if the account doesn't belong to the user

      // Act
      const response = await request(app)
        .get('/emails/nonexistent-account')
        .set('Authorization', 'Bearer valid-token')

      // Assert - Since ownership middleware runs first, it returns 403
      expect(response.status).toBe(403)
      expect(response.body).toMatchObject({
        error: 'Access denied'
      })
    })

    it('should require account ownership', async () => {
      // Act
      const response = await request(app)
        .get('/emails/other-account')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(403)
      expect(response.body).toMatchObject({
        error: 'Access denied'
      })
    })

    it('should handle EmailService errors', async () => {
      // Arrange
      mockEmailService.getEmails.mockRejectedValue(new Error('IMAP connection failed'))

      // Act
      const response = await request(app)
        .get('/emails/account-456')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        success: false,
        error: 'IMAP connection failed'
      })
    })
  })

  describe('GET /emails/:accountId/:emailId/content', () => {
    it('should get email content successfully', async () => {
      // Arrange
      mockEmailService.getEmailContent.mockResolvedValue({
        content: testEmailContent,
        source: 'cache',
        fetchTime: 150
      })

      // Act
      const response = await request(app)
        .get('/emails/account-456/email-1/content')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        content: testEmailContent,
        source: 'cache',
        fetchTime: 150
      })

      expect(mockEmailService.getEmailContent).toHaveBeenCalledWith('email-1')
    })

    it('should handle content from IMAP when not cached', async () => {
      // Arrange
      mockEmailService.getEmailContent.mockResolvedValue({
        content: testEmailContent,
        source: 'imap',
        fetchTime: 850
      })

      // Act
      const response = await request(app)
        .get('/emails/account-456/email-1/content')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        content: testEmailContent,
        source: 'imap',
        fetchTime: 850
      })
    })

    it('should return 403 for non-existent account (middleware blocks access)', async () => {
      // Arrange - The requireAccountOwnership middleware will check ownership first
      // and return 403 if the account doesn't belong to the user

      // Act
      const response = await request(app)
        .get('/emails/nonexistent/email-1/content')
        .set('Authorization', 'Bearer valid-token')

      // Assert - Since ownership middleware runs first, it returns 403
      expect(response.status).toBe(403)
      expect(response.body).toMatchObject({
        error: 'Access denied'
      })
    })

    it('should handle content retrieval errors', async () => {
      // Arrange
      mockEmailService.getEmailContent.mockRejectedValue(new Error('Email not found'))

      // Act
      const response = await request(app)
        .get('/emails/account-456/nonexistent-email/content')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        success: false,
        error: 'Email not found'
      })
    })
  })

  describe('POST /emails/:accountId/:emailId/read', () => {
    it('should mark email as read successfully', async () => {
      // Arrange
      mockEmailService.markAsRead.mockResolvedValue(undefined)

      // Act
      const response = await request(app)
        .post('/emails/account-456/email-1/read')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        message: 'Email marked as read',
        emailId: 'email-1'
      })

      expect(mockEmailService.markAsRead).toHaveBeenCalledWith('email-1')
    })

    it('should require account ownership', async () => {
      // Act
      const response = await request(app)
        .post('/emails/other-account/email-1/read')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(403)
      expect(response.body).toMatchObject({
        error: 'Access denied'
      })
    })

    it('should handle mark as read errors', async () => {
      // Arrange
      mockEmailService.markAsRead.mockRejectedValue(new Error('IMAP operation failed'))

      // Act
      const response = await request(app)
        .post('/emails/account-456/email-1/read')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        success: false,
        error: 'IMAP operation failed'
      })
    })
  })

  describe('DELETE /emails/:accountId/:emailId', () => {
    it('should delete email successfully', async () => {
      // Arrange
      mockEmailService.deleteEmail.mockResolvedValue(undefined)

      // Act
      const response = await request(app)
        .delete('/emails/account-456/email-1')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        message: 'Email deleted',
        emailId: 'email-1'
      })

      expect(mockEmailService.deleteEmail).toHaveBeenCalledWith('email-1')
    })

    it('should require account ownership', async () => {
      // Act
      const response = await request(app)
        .delete('/emails/other-account/email-1')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(403)
      expect(response.body).toMatchObject({
        error: 'Access denied'
      })
    })

    it('should handle deletion errors', async () => {
      // Arrange
      mockEmailService.deleteEmail.mockRejectedValue(new Error('Email deletion failed'))

      // Act
      const response = await request(app)
        .delete('/emails/account-456/email-1')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        success: false,
        error: 'Email deletion failed'
      })
    })
  })

  describe('GET /emails/:accountId/search', () => {
    it('should search emails successfully', async () => {
      // Arrange
      const searchResults = {
        results: [testEmails[0]],
        sources: ['cache'],
        totalFound: 1,
        searchTime: 250
      }
      mockEmailService.searchEmails.mockResolvedValue(searchResults)

      // Act
      const response = await request(app)
        .get('/emails/account-456/search?q=test')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        results: [testEmails[0]],
        sources: ['cache'],
        totalFound: 1,
        searchTime: 250,
        query: 'test'
      })

      expect(mockEmailService.searchEmails).toHaveBeenCalledWith('test')
    })

    it('should return 400 for missing search query', async () => {
      // Act
      const response = await request(app)
        .get('/emails/account-456/search')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        success: false,
        error: 'Search query is required'
      })
    })

    it('should return 400 for empty search query', async () => {
      // Act
      const response = await request(app)
        .get('/emails/account-456/search?q=')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        success: false,
        error: 'Search query is required'
      })
    })

    it('should handle search errors', async () => {
      // Arrange
      mockEmailService.searchEmails.mockRejectedValue(new Error('Search failed'))

      // Act
      const response = await request(app)
        .get('/emails/account-456/search?q=test')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        success: false,
        error: 'Search failed'
      })
    })
  })

  describe('GET /emails/:accountId/:emailId/attachments/:attachmentId', () => {
    it.skip('should download attachment successfully', async () => {
      // Arrange
      const mockAttachment = {
        filename: 'document.pdf',
        contentType: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('fake pdf content')
      }
      mockEmailService.getAttachment.mockResolvedValue(mockAttachment)

      // Act & Assert
      // Note: Testing binary responses with supertest can be complex,
      // so we focus on testing that the service is called correctly
      // and headers are set properly by checking the mock was called
      await request(app)
        .get('/emails/account-456/email-1/attachments/attachment-1')
        .set('Authorization', 'Bearer valid-token')
        .expect(200)
        .expect('Content-Type', 'application/pdf')
        .expect('Content-Disposition', 'attachment; filename="document.pdf"')
        .expect('Content-Length', '1024')
        .expect('Cache-Control', 'private, no-cache, no-store, must-revalidate')
        .expect('X-Content-Type-Options', 'nosniff')
        .expect('Content-Security-Policy', "default-src 'none'")

      expect(mockEmailService.getAttachment).toHaveBeenCalledWith('email-1', 'attachment-1')
    })

    it('should require account ownership', async () => {
      // Act
      const response = await request(app)
        .get('/emails/other-account/email-1/attachments/attachment-1')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(403)
      expect(response.body).toMatchObject({
        error: 'Access denied'
      })
    })

    it('should handle attachment retrieval errors', async () => {
      // Arrange
      mockEmailService.getAttachment.mockRejectedValue(new Error('Attachment not found'))

      // Act
      const response = await request(app)
        .get('/emails/account-456/email-1/attachments/nonexistent')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        success: false,
        error: 'Attachment not found'
      })
    })
  })

  describe('GET /emails/:accountId/status', () => {
    it('should get account email status successfully', async () => {
      // Arrange
      const refreshStatus = {
        isRefreshing: true,
        lastRefresh: '2023-12-01T10:00:00Z',
        nextRefresh: '2023-12-01T10:15:00Z'
      }
      const cacheStats = {
        count: 50,
        oldestDate: '2023-11-01T00:00:00.000Z',
        newestDate: '2023-12-01T12:00:00.000Z',
        totalSize: 2048,
        readCount: 25,
        unreadCount: 25
      }

      EmailService.getRefreshStatus = vi.fn().mockReturnValue(refreshStatus)
      mockEmailCacheService.getCacheStats = vi.fn().mockResolvedValue(cacheStats)

      // Act
      const response = await request(app)
        .get('/emails/account-456/status')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        accountId: 'account-456',
        refreshStatus: refreshStatus,
        cacheStats: cacheStats
      })
      expect(response.body).toHaveProperty('timestamp')

      expect(EmailService.getRefreshStatus).toHaveBeenCalledWith('account-456')
      expect(mockEmailCacheService.getCacheStats).toHaveBeenCalledWith('account-456')
    })

    it('should require account ownership', async () => {
      // Act
      const response = await request(app)
        .get('/emails/other-account/status')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(403)
      expect(response.body).toMatchObject({
        error: 'Access denied'
      })
    })

    it('should handle status retrieval errors', async () => {
      // Arrange
      mockEmailCacheService.getCacheStats = vi.fn().mockRejectedValue(new Error('Cache stats failed'))

      // Act
      const response = await request(app)
        .get('/emails/account-456/status')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        success: false,
        error: 'Cache stats failed'
      })
    })
  })

  describe('Authentication and Authorization', () => {
    it('should require authentication for all routes', async () => {
      // Create app with failing auth middleware
      const failingAuthMiddleware = {
        authenticate: vi.fn((req, res, next) => {
          res.status(401).json({ error: 'Unauthorized' })
        }),
        requireAccountOwnership: vi.fn(() => (req, res, next) => next()),
      } as unknown as AuthMiddleware

      const testApp = express()
      testApp.use(express.json())
      testApp.use('/emails', createEmailsRouter(mockDatabaseManager, mockEmailCacheService, failingAuthMiddleware))

      const routes = [
        { method: 'get', path: '/emails/account-456' },
        { method: 'get', path: '/emails/account-456/email-1/content' },
        { method: 'post', path: '/emails/account-456/email-1/read' },
        { method: 'delete', path: '/emails/account-456/email-1' },
        { method: 'get', path: '/emails/account-456/search?q=test' },
        { method: 'get', path: '/emails/account-456/email-1/attachments/att-1' },
        { method: 'get', path: '/emails/account-456/status' }
      ]

      for (const route of routes) {
        const response = await request(testApp)[route.method](route.path)
        expect(response.status).toBe(401)
        expect(response.body).toMatchObject({ error: 'Unauthorized' })
      }
    })

    it('should enforce account ownership for all routes', async () => {
      // All routes should be blocked for accounts the user doesn't own
      const routes = [
        { method: 'get', path: '/emails/other-account' },
        { method: 'get', path: '/emails/other-account/email-1/content' },
        { method: 'post', path: '/emails/other-account/email-1/read' },
        { method: 'delete', path: '/emails/other-account/email-1' },
        { method: 'get', path: '/emails/other-account/search?q=test' },
        { method: 'get', path: '/emails/other-account/email-1/attachments/att-1' },
        { method: 'get', path: '/emails/other-account/status' }
      ]

      for (const route of routes) {
        const response = await request(app)[route.method](route.path)
          .set('Authorization', 'Bearer valid-token')
        expect(response.status).toBe(403)
        expect(response.body).toMatchObject({ error: 'Access denied' })
      }
    })
  })
})