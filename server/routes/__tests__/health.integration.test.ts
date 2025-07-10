import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createHealthRouter } from '../health'

describe('Health Routes Integration Tests', () => {
  let app: express.Application

  beforeEach(() => {
    // Setup express app with health routes
    app = express()
    app.use(express.json())
    app.use('/health', createHealthRouter())
  })

  describe('GET /health', () => {
    it('should return health status successfully', async () => {
      // Act
      const response = await request(app)
        .get('/health')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        status: 'ok'
      })
      expect(response.body).toHaveProperty('timestamp')
      expect(typeof response.body.timestamp).toBe('string')
      
      // Verify timestamp is a valid ISO string
      expect(() => new Date(response.body.timestamp)).not.toThrow()
    })

    it('should return consistent response structure', async () => {
      // Act - Make multiple requests
      const response1 = await request(app).get('/health')
      const response2 = await request(app).get('/health')

      // Assert
      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)
      
      expect(response1.body.status).toBe('ok')
      expect(response2.body.status).toBe('ok')
      
      // Timestamps should be different (milliseconds apart)
      expect(response1.body.timestamp).not.toBe(response2.body.timestamp)
    })

    it('should be publicly accessible (no authentication required)', async () => {
      // Act - Request without any headers or authentication
      const response = await request(app)
        .get('/health')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body.status).toBe('ok')
    })

    it('should handle multiple concurrent requests', async () => {
      // Act - Make multiple concurrent requests
      const promises = Array.from({ length: 5 }, () => 
        request(app).get('/health')
      )
      const responses = await Promise.all(promises)

      // Assert
      responses.forEach((response, index) => {
        expect(response.status).toBe(200)
        expect(response.body).toMatchObject({
          status: 'ok'
        })
        expect(response.body).toHaveProperty('timestamp')
      })
    })
  })

  describe('Error Handling', () => {
    it('should return 404 for non-existent health endpoints', async () => {
      // Act
      const response = await request(app)
        .get('/health/nonexistent')

      // Assert
      expect(response.status).toBe(404)
    })

    it('should not accept POST requests to health endpoint', async () => {
      // Act
      const response = await request(app)
        .post('/health')
        .send({ data: 'test' })

      // Assert
      expect(response.status).toBe(404)
    })

    it('should not accept PUT requests to health endpoint', async () => {
      // Act
      const response = await request(app)
        .put('/health')
        .send({ data: 'test' })

      // Assert
      expect(response.status).toBe(404)
    })

    it('should not accept DELETE requests to health endpoint', async () => {
      // Act
      const response = await request(app)
        .delete('/health')

      // Assert
      expect(response.status).toBe(404)
    })
  })
})