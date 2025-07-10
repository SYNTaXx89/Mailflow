import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createAccountsRouter } from '../accounts'
import { DatabaseManager } from '../../database/DatabaseManager'
import { AuthMiddleware } from '../../auth/AuthMiddleware'

describe('Accounts Routes Integration Tests', () => {
  let app: express.Application
  let mockDatabaseManager: DatabaseManager
  let mockAuthMiddleware: AuthMiddleware

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
    config: '{"color":"#123456","imap":{"host":"imap.example.com","port":993,"security":"SSL/TLS"},"smtp":{"host":"smtp.example.com","port":587,"security":"STARTTLS"}}',
    created_at: '2023-12-01T10:00:00Z'
  }

  const decryptedCredentials = {
    username: 'test@example.com',
    password: 'testpassword'
  }

  beforeEach(() => {
    // Create mock services
    mockDatabaseManager = {
      getUserAccounts: vi.fn(),
      getAccountById: vi.fn(),
      createAccount: vi.fn(),
      updateAccount: vi.fn(),
      deleteAccount: vi.fn(),
      encrypt: vi.fn(),
      decrypt: vi.fn(),
    } as unknown as DatabaseManager

    mockAuthMiddleware = {
      authenticate: vi.fn((req, res, next) => {
        req.user = testUser
        next()
      }),
    } as unknown as AuthMiddleware

    // Setup express app with accounts routes
    app = express()
    app.use(express.json())
    app.use('/accounts', createAccountsRouter(mockDatabaseManager, mockAuthMiddleware))

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /accounts', () => {
    it('should return all accounts for authenticated user', async () => {
      // Arrange
      mockDatabaseManager.getUserAccounts = vi.fn().mockResolvedValue([testAccount])
      mockDatabaseManager.decrypt = vi.fn().mockReturnValue(JSON.stringify(decryptedCredentials))

      // Act
      const response = await request(app)
        .get('/accounts')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('accounts')
      expect(response.body.accounts).toHaveLength(1)
      expect(response.body.accounts[0]).toMatchObject({
        id: 'account-456',
        name: 'Test Account',
        email: 'test@example.com',
        username: 'test@example.com',
        password: 'testpassword',
        unreadCount: 0,
        color: '#123456'
      })

      expect(mockDatabaseManager.getUserAccounts).toHaveBeenCalledWith('user-123')
      expect(mockDatabaseManager.decrypt).toHaveBeenCalledWith('encrypted-creds')
    })

    it('should handle empty accounts list', async () => {
      // Arrange
      mockDatabaseManager.getUserAccounts = vi.fn().mockResolvedValue([])

      // Act
      const response = await request(app)
        .get('/accounts')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        accounts: []
      })
    })

    it('should handle database errors', async () => {
      // Arrange
      mockDatabaseManager.getUserAccounts = vi.fn().mockRejectedValue(new Error('Database error'))

      // Act
      const response = await request(app)
        .get('/accounts')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        error: 'Failed to load accounts'
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
      testApp.use('/accounts', createAccountsRouter(mockDatabaseManager, failingAuthMiddleware))

      // Act
      const response = await request(testApp)
        .get('/accounts')

      // Assert
      expect(response.status).toBe(401)
      expect(response.body).toMatchObject({
        error: 'Unauthorized'
      })
    })
  })

  describe('POST /accounts', () => {
    it('should create new account with valid data', async () => {
      // Arrange
      const newAccountData = {
        account: {
          name: 'New Account',
          email: 'new@example.com',
          username: 'new@example.com',
          password: 'newpassword',
          color: '#654321',
          imap: { host: 'imap.new.com', port: 993, security: 'SSL/TLS' },
          smtp: { host: 'smtp.new.com', port: 587, security: 'STARTTLS' }
        }
      }

      mockDatabaseManager.encrypt = vi.fn().mockReturnValue('encrypted-new-creds')
      mockDatabaseManager.createAccount = vi.fn().mockResolvedValue(true)

      // Act
      const response = await request(app)
        .post('/accounts')
        .set('Authorization', 'Bearer valid-token')
        .send(newAccountData)

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        account: {
          name: 'New Account',
          email: 'new@example.com',
          username: 'new@example.com',
          password: 'newpassword',
          color: '#654321',
          unreadCount: 0
        }
      })

      expect(mockDatabaseManager.encrypt).toHaveBeenCalledWith(
        JSON.stringify({
          username: 'new@example.com',
          password: 'newpassword'
        })
      )
      expect(mockDatabaseManager.createAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          name: 'New Account',
          email: 'new@example.com',
          encrypted_credentials: 'encrypted-new-creds'
        })
      )
    })

    it('should create account with default values when optional fields missing', async () => {
      // Arrange
      const minimalAccountData = {
        account: {
          name: 'Minimal Account',
          email: 'minimal@example.com'
        }
      }

      mockDatabaseManager.encrypt = vi.fn().mockReturnValue('encrypted-minimal-creds')
      mockDatabaseManager.createAccount = vi.fn().mockResolvedValue(true)

      // Act
      const response = await request(app)
        .post('/accounts')
        .set('Authorization', 'Bearer valid-token')
        .send(minimalAccountData)

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        account: {
          name: 'Minimal Account',
          email: 'minimal@example.com',
          username: 'minimal@example.com',
          password: '',
          unreadCount: 0
        }
      })

      // Should have default IMAP and SMTP configs
      expect(response.body.account.imap).toMatchObject({
        host: '',
        port: 993,
        security: 'SSL/TLS'
      })
      expect(response.body.account.smtp).toMatchObject({
        host: '',
        port: 587,
        security: 'STARTTLS'
      })
    })

    it('should return 400 for missing required fields', async () => {
      // Act
      const response = await request(app)
        .post('/accounts')
        .set('Authorization', 'Bearer valid-token')
        .send({
          account: {
            name: 'Incomplete Account'
            // Missing email
          }
        })

      // Assert
      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        error: 'Missing required account fields'
      })
    })

    it('should return 400 for completely missing account data', async () => {
      // Act
      const response = await request(app)
        .post('/accounts')
        .set('Authorization', 'Bearer valid-token')
        .send({})

      // Assert
      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        error: 'Missing required account fields'
      })
    })

    it('should handle database creation failure', async () => {
      // Arrange
      const accountData = {
        account: {
          name: 'Test Account',
          email: 'test@example.com'
        }
      }

      mockDatabaseManager.encrypt = vi.fn().mockReturnValue('encrypted-creds')
      mockDatabaseManager.createAccount = vi.fn().mockResolvedValue(false)

      // Act
      const response = await request(app)
        .post('/accounts')
        .set('Authorization', 'Bearer valid-token')
        .send(accountData)

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        error: 'Failed to save account'
      })
    })

    it('should handle encryption errors', async () => {
      // Arrange
      const accountData = {
        account: {
          name: 'Test Account',
          email: 'test@example.com'
        }
      }

      mockDatabaseManager.encrypt = vi.fn().mockImplementation(() => {
        throw new Error('Encryption error')
      })

      // Act
      const response = await request(app)
        .post('/accounts')
        .set('Authorization', 'Bearer valid-token')
        .send(accountData)

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        error: 'Failed to create account'
      })
    })
  })

  describe('PUT /accounts/:id', () => {
    it('should update account with valid data', async () => {
      // Arrange
      const updateData = {
        account: {
          name: 'Updated Account',
          email: 'updated@example.com',
          username: 'updated@example.com',
          password: 'updatedpassword',
          color: '#987654'
        }
      }

      mockDatabaseManager.getAccountById = vi.fn().mockResolvedValue(testAccount)
      mockDatabaseManager.decrypt = vi.fn()
        .mockReturnValueOnce(JSON.stringify(decryptedCredentials)) // For initial credentials check
        .mockReturnValueOnce(JSON.stringify({ // For final result
          username: 'updated@example.com',
          password: 'updatedpassword'
        }))
      mockDatabaseManager.encrypt = vi.fn().mockReturnValue('encrypted-updated-creds')
      mockDatabaseManager.updateAccount = vi.fn().mockResolvedValue(true)

      // Mock the updated account retrieval
      const updatedAccount = {
        ...testAccount,
        name: 'Updated Account',
        email: 'updated@example.com',
        encrypted_credentials: 'encrypted-updated-creds'
      }
      mockDatabaseManager.getAccountById
        .mockResolvedValueOnce(testAccount) // For ownership check
        .mockResolvedValueOnce(updatedAccount) // For returning updated data

      // Act
      const response = await request(app)
        .put('/accounts/account-456')
        .set('Authorization', 'Bearer valid-token')
        .send(updateData)

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        account: {
          id: 'account-456',
          name: 'Updated Account',
          email: 'updated@example.com',
          username: 'updated@example.com',
          password: 'updatedpassword'
        }
      })

      expect(mockDatabaseManager.updateAccount).toHaveBeenCalledWith(
        'account-456',
        expect.objectContaining({
          name: 'Updated Account',
          email: 'updated@example.com',
          encrypted_credentials: 'encrypted-updated-creds'
        })
      )
    })

    it('should return 404 for non-existent account', async () => {
      // Arrange
      mockDatabaseManager.getAccountById = vi.fn().mockResolvedValue(null)

      // Act
      const response = await request(app)
        .put('/accounts/nonexistent')
        .set('Authorization', 'Bearer valid-token')
        .send({
          account: { name: 'Updated Name' }
        })

      // Assert
      expect(response.status).toBe(404)
      expect(response.body).toMatchObject({
        error: 'Account not found'
      })
    })

    it('should return 404 for account belonging to different user', async () => {
      // Arrange
      const otherUserAccount = {
        ...testAccount,
        user_id: 'other-user-456'
      }
      mockDatabaseManager.getAccountById = vi.fn().mockResolvedValue(otherUserAccount)

      // Act
      const response = await request(app)
        .put('/accounts/account-456')
        .set('Authorization', 'Bearer valid-token')
        .send({
          account: { name: 'Updated Name' }
        })

      // Assert
      expect(response.status).toBe(404)
      expect(response.body).toMatchObject({
        error: 'Account not found'
      })
    })

    it('should handle partial updates', async () => {
      // Arrange - Only update the name
      const partialUpdateData = {
        account: {
          name: 'Only Name Updated'
        }
      }

      mockDatabaseManager.getAccountById = vi.fn().mockResolvedValue(testAccount)
      mockDatabaseManager.decrypt = vi.fn().mockReturnValue(JSON.stringify(decryptedCredentials))
      mockDatabaseManager.updateAccount = vi.fn().mockResolvedValue(true)

      const updatedAccount = {
        ...testAccount,
        name: 'Only Name Updated'
      }
      mockDatabaseManager.getAccountById
        .mockResolvedValueOnce(testAccount)
        .mockResolvedValueOnce(updatedAccount)

      // Act
      const response = await request(app)
        .put('/accounts/account-456')
        .set('Authorization', 'Bearer valid-token')
        .send(partialUpdateData)

      // Assert
      expect(response.status).toBe(200)
      expect(mockDatabaseManager.updateAccount).toHaveBeenCalledWith(
        'account-456',
        { name: 'Only Name Updated' } // Only name should be updated
      )
    })

    it('should handle database update failure', async () => {
      // Arrange
      mockDatabaseManager.getAccountById = vi.fn().mockResolvedValue(testAccount)
      mockDatabaseManager.updateAccount = vi.fn().mockResolvedValue(false)

      // Act
      const response = await request(app)
        .put('/accounts/account-456')
        .set('Authorization', 'Bearer valid-token')
        .send({
          account: { name: 'Updated Name' }
        })

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        error: 'Failed to update account'
      })
    })
  })

  describe('DELETE /accounts/:id', () => {
    it('should delete account successfully', async () => {
      // Arrange
      mockDatabaseManager.getAccountById = vi.fn().mockResolvedValue(testAccount)
      mockDatabaseManager.deleteAccount = vi.fn().mockResolvedValue(true)

      // Act
      const response = await request(app)
        .delete('/accounts/account-456')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true
      })

      expect(mockDatabaseManager.getAccountById).toHaveBeenCalledWith('account-456')
      expect(mockDatabaseManager.deleteAccount).toHaveBeenCalledWith('account-456')
    })

    it('should return 404 for non-existent account', async () => {
      // Arrange
      mockDatabaseManager.getAccountById = vi.fn().mockResolvedValue(null)

      // Act
      const response = await request(app)
        .delete('/accounts/nonexistent')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(404)
      expect(response.body).toMatchObject({
        error: 'Account not found'
      })

      expect(mockDatabaseManager.deleteAccount).not.toHaveBeenCalled()
    })

    it('should return 404 for account belonging to different user', async () => {
      // Arrange
      const otherUserAccount = {
        ...testAccount,
        user_id: 'other-user-456'
      }
      mockDatabaseManager.getAccountById = vi.fn().mockResolvedValue(otherUserAccount)

      // Act
      const response = await request(app)
        .delete('/accounts/account-456')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(404)
      expect(response.body).toMatchObject({
        error: 'Account not found'
      })

      expect(mockDatabaseManager.deleteAccount).not.toHaveBeenCalled()
    })

    it('should handle database deletion failure', async () => {
      // Arrange
      mockDatabaseManager.getAccountById = vi.fn().mockResolvedValue(testAccount)
      mockDatabaseManager.deleteAccount = vi.fn().mockResolvedValue(false)

      // Act
      const response = await request(app)
        .delete('/accounts/account-456')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        error: 'Failed to delete account'
      })
    })

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockDatabaseManager.getAccountById = vi.fn().mockRejectedValue(new Error('Database error'))

      // Act
      const response = await request(app)
        .delete('/accounts/account-456')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toMatchObject({
        error: 'Failed to delete account'
      })
    })
  })

  describe('Authentication and Authorization', () => {
    it('should apply authentication to all routes', async () => {
      // Test that all routes require authentication
      const routes = [
        { method: 'get', path: '/accounts' },
        { method: 'post', path: '/accounts' },
        { method: 'put', path: '/accounts/test-id' },
        { method: 'delete', path: '/accounts/test-id' }
      ]

      const failingAuthMiddleware = {
        authenticate: vi.fn((req, res, next) => {
          res.status(401).json({ error: 'Unauthorized' })
        }),
      } as unknown as AuthMiddleware

      const testApp = express()
      testApp.use(express.json())
      testApp.use('/accounts', createAccountsRouter(mockDatabaseManager, failingAuthMiddleware))

      for (const route of routes) {
        const response = await request(testApp)[route.method](route.path)
        expect(response.status).toBe(401)
        expect(response.body).toMatchObject({ error: 'Unauthorized' })
      }
    })

    it('should enforce user data isolation', async () => {
      // This test verifies that users can only access their own accounts
      // by checking that all operations verify user ownership
      
      const otherUserAccount = {
        ...testAccount,
        user_id: 'other-user-789'
      }

      // Test GET (implicitly isolated by getUserAccounts(userId))
      mockDatabaseManager.getUserAccounts = vi.fn().mockResolvedValue([])
      let response = await request(app)
        .get('/accounts')
        .set('Authorization', 'Bearer valid-token')
      expect(mockDatabaseManager.getUserAccounts).toHaveBeenCalledWith('user-123')

      // Test PUT with other user's account
      mockDatabaseManager.getAccountById = vi.fn().mockResolvedValue(otherUserAccount)
      response = await request(app)
        .put('/accounts/account-456')
        .set('Authorization', 'Bearer valid-token')
        .send({ account: { name: 'Hacked' } })
      expect(response.status).toBe(404)

      // Test DELETE with other user's account  
      response = await request(app)
        .delete('/accounts/account-456')
        .set('Authorization', 'Bearer valid-token')
      expect(response.status).toBe(404)
    })
  })
})