# Testing Tutorial - Mailflow Vite Project

This guide walks you through setting up comprehensive testing for the Mailflow Vite project.

## 🧪 **Testing Setup for Vite Project**

### **1. Install Testing Dependencies**

```bash
# Core testing framework
npm install -D vitest

# React testing utilities
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event

# Testing environment
npm install -D jsdom

# Optional: Coverage reporting
npm install -D @vitest/ui c8
```

### **2. Configure Vite for Testing**

Create `vitest.config.ts` in your root directory:

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  },
})
```

### **3. Create Test Setup File**

Create `src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock environment variables
vi.mock('import.meta.env', () => ({
  VITE_API_BASE_URL: 'http://localhost:3001/api',
  VITE_APP_NAME: 'Mailflow'
}))

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
})

// Mock fetch
global.fetch = vi.fn()
```

### **4. Update package.json Scripts**

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:watch": "vitest --watch"
  }
}
```

### **5. Example Test Files**

#### **Unit Test Example** (`src/utils/__tests__/api.test.ts`):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '../api'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('API Utils', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('should make GET request with correct headers', async () => {
    const mockResponse = { data: 'test' }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const result = await api.get('/test')

    expect(mockFetch).toHaveBeenCalledWith('/test', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    expect(result).toEqual(mockResponse)
  })

  it('should handle errors correctly', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    await expect(api.get('/test')).rejects.toThrow('Network error')
  })
})
```

#### **Component Test Example** (`src/components/__tests__/LoginView.test.tsx`):

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginView } from '../LoginView'

// Mock hooks
vi.mock('../../hooks/useJWTAuth', () => ({
  useJWTAuth: () => ({
    login: vi.fn(),
    loading: false,
    error: null,
  }),
}))

describe('LoginView', () => {
  it('should render login form', () => {
    render(<LoginView />)
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
  })

  it('should validate email format', async () => {
    const user = userEvent.setup()
    render(<LoginView />)

    const emailInput = screen.getByLabelText(/email/i)
    await user.type(emailInput, 'invalid-email')
    
    fireEvent.blur(emailInput)
    
    await waitFor(() => {
      expect(screen.getByText(/invalid email format/i)).toBeInTheDocument()
    })
  })

  it('should call login on form submission', async () => {
    const mockLogin = vi.fn()
    vi.mocked(useJWTAuth).mockReturnValue({
      login: mockLogin,
      loading: false,
      error: null,
    })

    const user = userEvent.setup()
    render(<LoginView />)

    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /login/i }))

    expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123')
  })
})
```

#### **Hook Test Example** (`src/hooks/__tests__/useJWTAuth.test.ts`):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useJWTAuth } from '../useJWTAuth'

// Mock API
vi.mock('../../utils/jwtApi', () => ({
  jwtApi: {
    login: vi.fn(),
    refreshToken: vi.fn(),
    logout: vi.fn(),
  },
}))

describe('useJWTAuth', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('should handle successful login', async () => {
    const mockLoginResponse = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: '1', email: 'test@example.com' },
    }

    vi.mocked(jwtApi.login).mockResolvedValueOnce(mockLoginResponse)

    const { result } = renderHook(() => useJWTAuth())

    await act(async () => {
      await result.current.login('test@example.com', 'password')
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user).toEqual(mockLoginResponse.user)
    expect(localStorage.setItem).toHaveBeenCalledWith('accessToken', 'access-token')
  })

  it('should handle login error', async () => {
    vi.mocked(jwtApi.login).mockRejectedValueOnce(new Error('Invalid credentials'))

    const { result } = renderHook(() => useJWTAuth())

    await act(async () => {
      await result.current.login('test@example.com', 'wrong-password')
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.error).toBe('Invalid credentials')
  })
})
```

### **6. Testing Dependency Injection Components**

#### **Example: Testing DatabaseManager with Constructor Injection**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DatabaseManager } from '../DatabaseManager'
import { ConfigManager } from '../../config/ConfigManager'

describe('DatabaseManager - Dependency Injection Pattern', () => {
  let databaseManager: DatabaseManager
  let mockConfigManager: any

  beforeEach(() => {
    // Create mock ConfigManager instance
    mockConfigManager = {
      getConfigDir: vi.fn().mockReturnValue('/test/config'),
      getDeep: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      initialize: vi.fn(),
    }
    
    // Create DatabaseManager with mocked ConfigManager
    databaseManager = new DatabaseManager(mockConfigManager)
    
    // Mock the database property to simulate initialization
    ;(databaseManager as any).db = mockDatabase
    ;(databaseManager as any).encryptionKey = 'test-key'
  })

  it('should create instance with injected ConfigManager', () => {
    expect(databaseManager).toBeInstanceOf(DatabaseManager)
    expect(mockConfigManager.getConfigDir).toHaveBeenCalled()
  })

  it('should create different instances for different ConfigManager instances', () => {
    const anotherConfigManager = { ...mockConfigManager }
    const anotherDbManager = new DatabaseManager(anotherConfigManager)
    
    expect(databaseManager).not.toBe(anotherDbManager)
  })
})
```

#### **Pattern: Testing Route Factory Functions**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAccountsRouter } from '../accounts'
import { DatabaseManager } from '../../database/DatabaseManager'
import { AuthMiddleware } from '../../auth/AuthMiddleware'

describe('Accounts Routes - Factory Pattern', () => {
  let mockDatabaseManager: DatabaseManager
  let mockAuthMiddleware: AuthMiddleware
  let router: express.Router

  beforeEach(() => {
    mockDatabaseManager = {
      getUserAccounts: vi.fn(),
      createAccount: vi.fn(),
      // ... other methods
    } as unknown as DatabaseManager
    
    mockAuthMiddleware = {
      authenticate: vi.fn((req, res, next) => next()),
      requireAdmin: vi.fn((req, res, next) => next()),
    } as unknown as AuthMiddleware

    // Create router with injected dependencies
    router = createAccountsRouter(mockDatabaseManager, mockAuthMiddleware)
  })

  it('should apply authentication middleware to all routes', () => {
    expect(mockAuthMiddleware.authenticate).toBeDefined()
  })
})
```

### **7. Build Process Integration**

#### **Update your CI/CD pipeline** (`.github/workflows/test.yml`):

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test:coverage
      
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

#### **Pre-commit hooks** (using Husky):

```bash
npm install -D husky lint-staged
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

Add to `package.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "npm run test:run -- --related",
      "npm run lint"
    ]
  }
}
```

### **7. Running Tests**

```bash
# Run tests in watch mode (development)
npm run test

# Run tests once (CI/CD)
npm run test:run

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui

# Run specific test file
npm run test -- src/components/__tests__/LoginView.test.tsx

# Run tests matching pattern
npm run test -- --grep "login"
```

### **8. VSCode Integration**

Install the **"Vitest"** extension and add to `.vscode/settings.json`:

```json
{
  "vitest.enable": true,
  "vitest.commandLine": "npm run test",
  "testing.automaticallyOpenPeekView": "never"
}
```

### **9. Directory Structure for Tests**

```
src/
├── test/
│   └── setup.ts
├── components/
│   ├── __tests__/
│   │   ├── LoginView.test.tsx
│   │   ├── EmailComposer.test.tsx
│   │   └── Sidebar.test.tsx
│   └── ...
├── hooks/
│   ├── __tests__/
│   │   ├── useJWTAuth.test.ts
│   │   ├── useEmailOperations.test.ts
│   │   └── useAccountManagement.test.ts
│   └── ...
├── utils/
│   ├── __tests__/
│   │   ├── api.test.ts
│   │   ├── dateUtils.test.ts
│   │   └── jwtApi.test.ts
│   └── ...
└── ...

server/
├── auth/
│   ├── __tests__/
│   │   ├── AuthMiddleware.test.ts
│   │   ├── TokenManager.test.ts
│   │   └── PasswordManager.test.ts
│   └── ...
├── database/
│   ├── __tests__/
│   │   ├── DatabaseManager.test.ts
│   │   ├── DatabaseManager-simple.test.ts    # New dependency injection tests
│   │   └── DatabaseManager-basic.test.ts     # Constructor tests
│   └── ...
└── ...
```

### **10. Test Utilities and Helpers**

Create `src/test/utils.tsx` for common test utilities:

```typescript
import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

// Mock providers wrapper
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  )
}

// Custom render function
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

// Common test data factories
export const createMockUser = (overrides = {}) => ({
  id: '1',
  email: 'test@example.com',
  role: 'user',
  ...overrides,
})

export const createMockAccount = (overrides = {}) => ({
  id: '1',
  user_id: '1',
  name: 'Test Account',
  email: 'test@example.com',
  ...overrides,
})

export const createMockEmail = (overrides = {}) => ({
  id: '1',
  account_id: '1',
  subject: 'Test Email',
  sender: 'sender@example.com',
  recipient: 'test@example.com',
  preview: 'This is a test email',
  date: new Date().toISOString(),
  is_read: false,
  ...overrides,
})
```

### **11. Mocking External Dependencies**

Create `src/test/mocks/` directory for complex mocks:

```typescript
// src/test/mocks/server.ts - for API mocking
import { setupServer } from 'msw/node'
import { rest } from 'msw'

export const server = setupServer(
  rest.post('/api/auth/login', (req, res, ctx) => {
    return res(
      ctx.json({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: { id: '1', email: 'test@example.com' }
      })
    )
  }),
  
  rest.get('/api/accounts', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        accounts: [createMockAccount()]
      })
    )
  })
)

// Setup for tests
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### **12. Next Steps**

1. **Start with critical components** from your CoverageRoadmap
2. **Set coverage thresholds** that fail builds if not met
3. **Add test data factories** for consistent test data
4. **Mock external dependencies** (IMAP, SMTP, database)
5. **Integrate with your Docker setup** for consistent environments

This setup gives you a robust testing foundation that integrates seamlessly with your Vite build process and can enforce quality gates in your deployment pipeline.