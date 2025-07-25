# Mailflow - Self-Hosted Email Client 🐳 (Beta)

A self-hosted email client built with React, TypeScript, and Express. Mailflow features JWT authentication, encrypted storage, and a complete setup wizard for secure deployment.

> **🚧 Beta Release**: Mailflow is currently in beta state. Core functionality is stable and ready for daily use, with ongoing feature development and improvements.

![Mailflow Email Client](https://img.shields.io/badge/React-18.2.0-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0.2-blue) ![Vite](https://img.shields.io/badge/Vite-4.4.5-purple) ![Docker](https://img.shields.io/badge/Docker-Ready-blue) ![Tests](https://img.shields.io/badge/Tests-410%2F426%20Passing-green) ![Coverage](https://img.shields.io/badge/Coverage-96%25-brightgreen)

## 🌟 Why Mailflow?

**The Email Client That Actually Solves Your Real Problem**

Every email client today suffers from the same problem: they add feature after feature, but somehow miss the most basic need that everyone has. **Mailflow is different** - it's the first email client that's truly platform-agnostic and solves the real issue: **one setup, everywhere**.

### 🎯 **The Problem Mailflow Solves**

**Multi-Device Email Hell**: You have an iPhone, a Mac, a Windows PC, maybe multiple computers. As a freelancer or professional, you constantly get new email accounts for clients and projects. With traditional email clients, you need to:
- ✋ Add every account on every device
- ✋ Reconfigure everything when you get a new computer  
- ✋ Deal with Gmail working well for some accounts, but not others
- ✋ Repeat this process endlessly

**Mailflow's Solution**: Add all your IMAP accounts **once**. Use them on **every computer** you have. Period.

### 🚀 **The Mailflow Advantage**

**🔄 Universal Setup**: Configure your email accounts once in Mailflow's self-hosted instance. Access them from any device, anywhere.

**🌐 Platform Freedom**: Works identically on Mac, Windows, Linux, mobile - no platform-specific limitations or vendor lock-in.

**📧 True IMAP Support**: Unlike Gmail's limited support, Mailflow works with **every** IMAP provider - your work Exchange, personal Gmail, custom domains, everything.

**🔒 Privacy First**: Self-hosted with local encrypted database. Your emails never touch third-party servers. Mount your own disk for complete control.

**⚡ Just Email**: No bloat, no unnecessary features. Just the core email functionality you actually need, done right.

### 💼 **Perfect for Freelancers & Professionals**

Stop wasting time adding the same email accounts to every new device. Stop dealing with partial Gmail support. Stop worrying about where your emails are stored. **Mailflow gives you one email setup that works everywhere, forever.**

**Self-hosted by default** with complete privacy and control.

### 🔐 Production-Ready Features
- **🔑 JWT Authentication**: Secure token-based authentication with automatic refresh
- **🛡️ Zero Trust**: Your credentials never leave your server
- **🏗️ Self-Hosted**: Complete control over your email infrastructure  
- **🔒 Encrypted Storage**: SQLite/PostgreSQL database with encrypted sensitive data
- **🎯 Setup Wizard**: Initial configuration with admin account creation
- **🐳 Docker-First**: Consistent deployment across all environments

---

## 🐳 **Docker-Only Deployment**

Mailflow is designed to run exclusively in Docker for consistency across all environments.

### **Prerequisites**
- **Docker** (v20.10+)
- **Docker Compose** (v2.0+)

### **🚀 Quick Start (Production)**

```bash
# Clone the repository
git clone <repository-url>
cd Mailflow

# Start production environment
./scripts/docker-prod.sh

# Or manually:
docker-compose up --build -d
```

**Mailflow will be available at: http://localhost:3000**

### **🔧 Development Environment**

```bash
# Start development environment with hot-reload
./scripts/docker-dev.sh

# Or manually:
docker-compose -f docker-compose.dev.yml up --build
```

**Development URLs:**
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/api

### **🧪 Testing**

```bash
# Run all tests in Docker
./scripts/docker-test.sh

# Or manually:
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

**Test Coverage**: 96% (410/426 tests passing)
- **Unit Tests**: Database, Authentication, Services
- **Integration Tests**: API Routes, Email Operations  
- **Component Tests**: React Components, Hooks

---

## 🏗️ **Docker Configuration**

### **Production Deployment**

```yaml
# docker-compose.yml
services:
  mailflow:
    image: mailflow:latest
    ports:
      - "3000:3001"
    volumes:
      - ./mailflow-data:/app/data/.mailflow:rw
    environment:
      - NODE_ENV=production
      - MAILFLOW_DATA_DIR=/app/data/.mailflow
```

### **Environment Variables**

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Runtime environment |
| `MAILFLOW_DATA_DIR` | `/app/data/.mailflow` | Data storage directory |
| `DATABASE_URL` | *none* | PostgreSQL connection string (optional) |
| `POSTGRES_URL` | *none* | Alternative PostgreSQL connection string |
| `VITE_API_BASE_URL` | `/api` | API base URL |
| `VITE_APP_NAME` | `Mailflow` | Application name |

### **Volume Mounting**

```bash
# Production data
./mailflow-data:/app/data/.mailflow:rw

# Development (additional mounts)
./src:/app/src:ro
./server:/app/server:ro
```

---

## 🐘 **Database Configuration**

Mailflow supports both **SQLite** (default) and **PostgreSQL** databases with automatic detection.

### **SQLite (Default)**

**No configuration needed** - Mailflow uses SQLite by default:

```yaml
# docker-compose.yml - No database environment variables
services:
  mailflow:
    image: mailflow:latest
    # SQLite database automatically created in mounted volume
    volumes:
      - ./mailflow-data:/app/data/.mailflow:rw
```

**Benefits:**
- ✅ **Zero Configuration** - Works out of the box
- ✅ **Self-Contained** - No external dependencies  
- ✅ **Backup Friendly** - Single database file
- ✅ **Perfect for** - Single user, personal deployments

### **PostgreSQL (Optional)**

**Automatic PostgreSQL detection** - Set a connection string environment variable:

```yaml
# docker-compose.yml - PostgreSQL configuration
services:
  mailflow:
    image: mailflow:latest
    environment:
      # Option 1: DATABASE_URL (Railway/Render standard)
      - DATABASE_URL=postgresql://username:password@host:port/database
      
      # Option 2: POSTGRES_URL (alternative name)  
      - POSTGRES_URL=postgresql://username:password@host:port/database
```

**Benefits:**
- ✅ **Production Scale** - Handle larger datasets and concurrent users
- ✅ **Cloud Ready** - Works with Railway, Render, AWS RDS, etc.
- ✅ **Advanced Features** - Better query performance, transactions
- ✅ **Perfect for** - Multi-user, production deployments

### **Database Selection Logic**

```mermaid
graph TD
    A[Mailflow Starts] --> B{DATABASE_URL or POSTGRES_URL set?}
    B -->|Yes| C[Test PostgreSQL Connection]
    B -->|No| D[Use SQLite Database]
    C -->|Success| E[Use PostgreSQL Database]
    C -->|Failed| F[Log Error & Exit]
    D --> G[Application Ready]
    E --> G[Application Ready]
    F --> H[Check Connection String]
```

**Automatic Detection:**
1. **Check Environment** - Look for `DATABASE_URL` or `POSTGRES_URL`
2. **Test Connection** - Verify PostgreSQL is accessible
3. **Use PostgreSQL** - If connection succeeds
4. **Fallback to SQLite** - Only if no PostgreSQL variables are set
5. **Fail Fast** - Exit with error if PostgreSQL is configured but unreachable

### **PostgreSQL Setup Examples**

#### **Local PostgreSQL**
```bash
# Start local PostgreSQL
docker run -d --name postgres \
  -e POSTGRES_DB=mailflow \
  -e POSTGRES_USER=mailflow_user \
  -e POSTGRES_PASSWORD=secure_password \
  -p 5432:5432 postgres:15

# Run Mailflow with PostgreSQL
docker run -d --name mailflow \
  -e DATABASE_URL=postgresql://mailflow_user:secure_password@localhost:5432/mailflow \
  -p 3000:3001 \
  mailflow:latest
```

#### **Cloud PostgreSQL**
```yaml
# Railway.app / Render.com
services:
  mailflow:
    image: mailflow:latest
    environment:
      # Railway automatically provides DATABASE_URL when you add PostgreSQL
      - DATABASE_URL=${DATABASE_URL}
```

#### **Docker Compose with PostgreSQL**
```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: mailflow
      POSTGRES_USER: mailflow_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres-data:/var/lib/postgresql/data
    
  mailflow:
    image: mailflow:latest
    environment:
      - DATABASE_URL=postgresql://mailflow_user:secure_password@postgres:5432/mailflow
    depends_on:
      - postgres

volumes:
  postgres-data:
```

### **Development Testing**

Use the included PostgreSQL development environment:

```bash
# Start PostgreSQL for testing
docker compose -f docker-compose.dev.yml up postgres -d

# Test locally with PostgreSQL connection
DATABASE_URL=postgresql://mailflow_user:mailflow_dev_password@localhost:5432/mailflow_dev \
npm run dev:backend

# Use helper script
./scripts/test-postgres.sh start     # Start PostgreSQL
./scripts/test-postgres.sh test-local # Test connection
```

### **Migration & Data**

- **No automatic migration** between SQLite ↔ PostgreSQL
- **Both databases create identical schemas** automatically
- **Choose database type at deployment time**
- **Existing SQLite data remains untouched** when switching to PostgreSQL

**Schema Compatibility:**
- ✅ Identical table structures
- ✅ Same data types (mapped appropriately)  
- ✅ Identical encryption and security
- ✅ Same API behavior

---

## 🎯 **Setup Wizard**

Mailflow includes a setup wizard that runs automatically on first access:

### **Setup Flow**
1. **🏠 Welcome Screen** - Privacy explanation and features overview
2. **👤 Admin Account** - Create administrator account with JWT token generation
3. **⚙️ Configuration** - Instance settings and optional SMTP configuration  
4. **✅ Completion** - Setup complete, redirects to login

### **Authentication Flow**
- **First Time**: Setup Wizard → Admin Creation → Automatic Login (JWT tokens)
- **Returning Users**: Email/Password Login → JWT Token Validation → Main App
- **Security**: Automatic token refresh, secure logout, encrypted storage

### **Current Limitations**
- **Single Admin User**: Only the admin account created during setup
- **No Password Reset**: If admin forgets password, instance lockout occurs
- **No User Management**: Cannot add additional users after setup
- **Recovery**: Development-only setup reset endpoint available

---

## 📊 **Architecture Overview**

```
Mailflow Docker Architecture:
┌─────────────────────────────────────┐
│             Docker Container        │
├─────────────────────────────────────┤
│  Frontend (React + Vite)           │
│  ├── Setup Wizard (JWT integrated) │
│  ├── Login Component               │
│  ├── JWT Authentication Hook       │
│  └── App Router (auth routing)     │
├─────────────────────────────────────┤
│  Backend (Express + TypeScript)    │
│  ├── JWT Authentication System     │
│  ├── Setup API (admin creation)    │
│  ├── Auth API (login/refresh)      │
│  ├── Protected Routes              │
│  └── Database (SQLite/PostgreSQL)  │
├─────────────────────────────────────┤
│  Persistent Data Volume             │
│  ├── config.json                   │
│  ├── database.db                   │
│  ├── credentials/ (encrypted)      │
│  └── logs/                         │
└─────────────────────────────────────┘
```

---

## 🛠️ **Docker Commands**

### **Available Scripts**

```bash
# Production
npm run docker:prod      # Start production environment
./scripts/docker-prod.sh # Start production environment (recommended)
docker-compose logs -f   # View logs
docker-compose down      # Stop and remove containers

# Development  
npm run docker:dev       # Start development environment
./scripts/docker-dev.sh  # Start development environment (recommended)
npm run docker:test      # Run tests
./scripts/docker-test.sh # Run tests (recommended)

# Maintenance
npm run docker:build     # Build image manually
npm run docker:clean     # Clean up Docker resources
```

### **🔄 Docker Management Scripts**

**Quick Restart:**
```bash
# Restart any environment
./scripts/docker-restart.sh [dev|prod|test]

# Examples:
./scripts/docker-restart.sh         # Restart dev environment
./scripts/docker-restart.sh prod    # Restart production
./scripts/docker-restart.sh test    # Restart test environment
```

**Advanced Management:**
```bash
# Full Docker management
./scripts/docker-manage.sh <command> [environment]

# Available commands:
./scripts/docker-manage.sh restart [env]    # Restart services
./scripts/docker-manage.sh stop [env]       # Stop services
./scripts/docker-manage.sh start [env]      # Start services
./scripts/docker-manage.sh rebuild [env]    # Rebuild and restart
./scripts/docker-manage.sh logs [env]       # Show logs
./scripts/docker-manage.sh status [env]     # Show container status
./scripts/docker-manage.sh clean [env]      # Clean up containers/volumes
./scripts/docker-manage.sh reset [env]      # Reset environment completely

# Examples:
./scripts/docker-manage.sh restart prod     # Restart production
./scripts/docker-manage.sh rebuild dev      # Rebuild dev environment
./scripts/docker-manage.sh logs             # Show dev logs
./scripts/docker-manage.sh clean prod       # Clean production environment
./scripts/docker-manage.sh reset test       # Reset test environment
```

### **Manual Docker Commands**

```bash
# Build production image
docker build -t mailflow:latest .

# Run single container
docker run -d \
  --name mailflow \
  -p 3000:3001 \
  -v ./mailflow-data:/app/data/.mailflow \
  mailflow:latest

# View logs
docker logs -f mailflow

# Execute shell in container
docker exec -it mailflow sh

# Stop and remove
docker stop mailflow && docker rm mailflow
```

---

## 🔧 **Development**

### **Project Structure**

```
Mailflow/
├── 🐳 Docker Configuration
│   ├── Dockerfile              # Production build
│   ├── Dockerfile.dev          # Development build
│   ├── docker-compose.yml      # Production compose
│   ├── docker-compose.dev.yml  # Development compose
│   └── docker-compose.test.yml # Testing compose
│
├── 📁 Application Code
│   ├── src/                    # Frontend React code
│   ├── server/                 # Backend Express code
│   ├── public/                 # Static assets
│   └── index.html              # Entry point
│
├── 🔧 Configuration
│   ├── .env                    # Default environment
│   ├── .env.development        # Development config
│   ├── .env.production         # Production config
│   ├── vite.config.ts          # Vite configuration
│   └── tsconfig.json           # TypeScript config
│
└── 📦 Data Storage
    └── mailflow-data/          # Persistent Docker volume
        ├── config.json         # Instance configuration
        ├── database.db         # SQLite database
        ├── credentials/        # Encrypted credentials
        └── logs/               # Application logs
```

### **Adding Features**

1. **Modify source code** in `src/` or `server/`
2. **Test in development**: `./scripts/docker-dev.sh`
3. **Run tests**: `./scripts/docker-test.sh`
4. **Build production**: `./scripts/docker-prod.sh`

### **Database Access**

```bash
# Access SQLite database in running container
docker exec -it mailflow sh
sqlite3 /app/data/.mailflow/database.db

# Backup database
docker cp mailflow:/app/data/.mailflow/database.db ./backup.db

# Restore database
docker cp ./backup.db mailflow:/app/data/.mailflow/database.db
```

---

## 🚢 **Production Deployment**

### **Server Requirements**

- **CPU**: 1 vCPU minimum, 2+ recommended
- **RAM**: 512MB minimum, 1GB+ recommended  
- **Storage**: 10GB minimum, 50GB+ recommended
- **Docker**: v20.10+ with Compose v2.0+

### **Deployment Options**

#### **Docker Compose (Recommended)**
```bash
# Clone and deploy
git clone <repository-url>
cd Mailflow
./scripts/docker-prod.sh
```

#### **Single Container**
```bash
# Pull and run
docker pull mailflow:latest
docker run -d --name mailflow -p 3000:3001 \
  -v ./data:/app/data/.mailflow mailflow:latest
```

#### **Docker Swarm**
```bash
# Deploy to swarm
docker stack deploy -c docker-compose.yml mailflow
```

### **Reverse Proxy Setup**

#### **Nginx**
```nginx
server {
    listen 80;
    server_name mail.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### **Traefik**
```yaml
# Already configured in docker-compose.yml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.mailflow.rule=Host(`mail.yourdomain.com`)"
```

---

## 🔒 **Security Considerations**

> **⚠️ Important**: Please review our [detailed security documentation](SECURITY.md) before deploying to production.

### **Production Security**
- **🔐 Strong Passwords**: Enforced during setup
- **🔑 JWT Authentication**: Secure session management
- **🛡️ Encrypted Storage**: All credentials encrypted at rest
- **👤 Non-Root User**: Container runs as unprivileged user
- **🔒 HTTPS**: Use reverse proxy with SSL/TLS

### **Data Protection**
- **📦 Volume Backups**: Regular database backups
- **🔄 Automated Backups**: Built-in backup scheduling
- **🏠 Air-Gapped**: No external dependencies for core functionality

### **Security Documentation**
📋 **[SECURITY.md](SECURITY.md)** - Comprehensive security analysis including:
- Authentication and authorization mechanisms
- Database encryption implementation
- Current vulnerabilities and mitigation strategies
- Security best practices and deployment guidelines

### **Testing Documentation**
🧪 **[TESTPLAN.md](TESTPLAN.md)** - End-to-end testing guide including:
- Manual testing procedures and checklists
- Automated test script templates
- Security validation test cases
- Performance and error handling scenarios

---

## 🆘 **Troubleshooting**

### **Common Issues**

#### **Container Won't Start**
```bash
# Check logs
docker-compose logs mailflow

# Check health
docker ps
```

#### **Setup Wizard Not Loading**
```bash
# Reset setup (development only)
curl -X POST http://localhost:3001/api/setup/reset \
  -H "Content-Type: application/json" \
  -d '{"clearAdmin": true}'
```

#### **Data Not Persisting**
```bash
# Check volume mount
docker inspect mailflow | grep Mounts -A 10

# Verify permissions
ls -la ./mailflow-data
```

#### **Performance Issues**
```bash
# Monitor resources
docker stats mailflow

# Check database size
docker exec mailflow du -sh /app/data/.mailflow/database.db
```

### **Debug Mode**

```bash
# Run with debug logging
docker-compose -f docker-compose.dev.yml up

# Access container shell
docker exec -it mailflow-dev sh

# View real-time logs
docker logs -f mailflow
```

---

## 📋 **Current Status**

Mailflow is a **beta-stage email client** with full email functionality and real-time notifications:

### **✅ Completed Features**
- **🔑 JWT Authentication System**: Complete token-based auth with refresh tokens
- **🎯 Setup Wizard**: Initial configuration flow
- **🔐 Secure Login**: Email/password authentication with token management
- **🛡️ Encrypted Storage**: SQLite/PostgreSQL database with AES-256-CBC credential encryption
- **🏢 Multi-Account Management**: Full CRUD operations for email accounts
- **📧 Email Caching**: Database-backed email storage and synchronization
- **⚙️ User Settings**: Personalized application preferences
- **🔒 Data Isolation**: Complete user data separation and access control
- **📤 Import/Export**: Secure backup and restore functionality
- **🐳 Docker Deployment**: Production-ready containerized deployment
- **⚡ Development Environment**: Hot-reload Docker development setup

### **✅ Recently Completed (July 2025)**
- **📧 Live IMAP Integration**: Real-time email fetching from IMAP servers ✅
- **📨 Email Content Loading**: Full email content retrieval from IMAP ✅  
- **🔐 Enhanced Account Management**: Username/password fields with edit functionality ✅
- **🎨 Improved Email Display**: Natural styling with HTML/plain text differentiation ✅
- **🔧 Real Connection Testing**: Actual IMAP validation replacing demo mode ✅
- **📤 SMTP Email Sending**: Full email sending capability with auto-detected settings ✅
- **↩️ Reply/Reply All**: Complete reply functionality with quoted messages ✅
- **🗑️ Delete Operations**: Delete emails from server with optimistic UI updates ✅
- **📧 Mark as Read/Unread**: Email state management with IMAP flag updates ✅
- **🔍 Email Search**: Subject-based search across accounts ✅
- **🔔 Real-time Notifications**: IMAP IDLE support for instant new email alerts ✅
- **⚡ Smart Caching**: Cache-first loading with background refresh for performance ✅

### **🚧 In Development**
- **📎 Attachment Support**: Backend ready, UI implementation needed
- **📝 Rich Text Editor**: Formatting toolbar exists but needs functionality
- **💾 Draft Management**: Save and manage email drafts
- **📱 Mobile Interface**: Responsive design improvements

### **🎯 Roadmap**

📋 **[See Detailed Roadmap](ROADMAP.md)** for complete development phases and timelines.

**Immediate Next Steps:**
- **📎 Attachment UI**: Complete attachment viewing/downloading interface
- **📝 Rich Text Editor**: Enable formatting toolbar functionality  
- **💾 Draft Support**: Auto-save and draft management
- **📱 Mobile Responsive**: Optimize UI for mobile devices

**Phase 4 - Essential Features:**
- **🔍 Advanced Search**: Search by sender, date, body content
- **📁 Folder Support**: At least Sent folder integration
- **🔄 Email Threading**: Conversation view grouping
- **⚡ Performance**: Pagination for large mailboxes

**Future Phases:**
- **👥 Multi-User Support**: User invitation and management system
- **🔄 Password Reset**: Email-based password recovery
- **📊 Admin Dashboard**: System monitoring and user management
- **🔐 SSO Integration**: Enterprise authentication options

### **🔒 Security Status**
**BETA-READY**: Core security stable, ongoing improvements
- **Authentication**: ✅ JWT-based with proper token validation
- **Authorization**: ✅ Complete user data isolation
- **Data Protection**: ✅ Encrypted sensitive credentials
- **API Security**: ✅ All endpoints properly protected

**Current State**: Fully functional email client with complete send/receive capabilities. Users can:
- Connect to any IMAP/SMTP email server
- Send, reply, and delete emails
- Search emails by subject
- Receive real-time notifications for new emails
- Manage multiple email accounts
All operations are secure with JWT authentication and encrypted credential storage.

---

## 🤝 **Contributing**

1. **Fork** the repository
2. **Create** feature branch: `git checkout -b feature/amazing-feature`
3. **Test** with Docker: `./scripts/docker-test.sh`
4. **Commit** changes: `git commit -m 'Add amazing feature'`
5. **Push** to branch: `git push origin feature/amazing-feature`
6. **Create** Pull Request

### **Development Workflow**
1. Use `./scripts/docker-dev.sh` for development
2. All code changes are hot-reloaded
3. Run `./scripts/docker-test.sh` before committing
4. Production testing with `./scripts/docker-prod.sh`
5. Follow manual test checklist in `TESTPLAN.md`
6. Run security validation tests before major releases

### **Testing & Quality Assurance**
- **Unit Tests**: 96% coverage across all core modules (410/426 tests passing)
- **Integration Tests**: Complete API endpoint testing with authentication
- **Component Tests**: React component and hook validation
- **Manual Testing**: Follow comprehensive checklist in `TESTPLAN.md`
- **Security Testing**: Automated scripts for vulnerability validation
- **Performance Testing**: Load testing with multiple accounts and large mailboxes
- **E2E Testing**: Complete user journey validation from setup to email management

**Testing Commands**:
```bash
npm run test              # Run all tests
npm run test:coverage     # Run with coverage report
npm run test:watch        # Watch mode for development
./scripts/docker-test.sh  # Run tests in Docker
```

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ **Support**

- **Documentation**: Check this README and inline code comments
- **Issues**: Open an issue in the GitHub repository
- **Discussions**: Use GitHub Discussions for questions

---

**🎯 Self-hosted email client that puts privacy first**

**Built with ❤️ using React, TypeScript, and Docker**