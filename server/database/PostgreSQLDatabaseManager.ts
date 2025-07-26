/**
 * PostgreSQLDatabaseManager - PostgreSQL database operations
 * 
 * Provides identical interface to SQLite DatabaseManager but uses PostgreSQL
 * underneath. Maintains same encryption, migrations, and CRUD operations.
 */

import { Pool, PoolClient } from 'pg';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { ConfigManager } from '../config/ConfigManager';
import { IDatabaseManager, User, Account, Email, AppSettings } from './IDatabaseManager';

export class PostgreSQLDatabaseManager implements IDatabaseManager {
  private pool: Pool;
  private encryptionKey: string;

  constructor(private configManager: ConfigManager, private connectionString: string) {
    if (!this.connectionString) {
      throw new Error('PostgreSQL connection string is required but was undefined');
    }
    
    const shouldUseSSL = this.connectionString.includes('supabase.co') || this.connectionString.includes('amazonaws.com') || process.env.NODE_ENV === 'production';
    console.log(`🔧 SSL Detection: shouldUseSSL=${shouldUseSSL}, NODE_ENV=${process.env.NODE_ENV}`);
    console.log(`🔧 Connection string contains supabase.co: ${this.connectionString.includes('supabase.co')}`);
    
    this.pool = new Pool({
      connectionString: this.connectionString,
      // Configure SSL properly for cloud databases
      ssl: shouldUseSSL 
        ? { 
            rejectUnauthorized: false // Accept self-signed certificates
          } 
        : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000, // Increased timeout for external connections
      // Additional debugging for connection issues
      ...(process.env.NODE_ENV === 'development' && {
        application_name: 'mailflow-dev',
        connect_timeout: 15,
      })
    });
    
    // Encryption key will be initialized in initialize() method
    this.encryptionKey = '';
  }

  /**
   * Extract hostname from connection string for explicit host configuration
   */
  private extractHostFromConnectionString(): string {
    try {
      const url = new URL(this.connectionString);
      return url.hostname;
    } catch (error) {
      console.warn('⚠️ Could not parse connection string URL, using default host behavior');
      return '';
    }
  }

  /**
   * Initialize database connection and create tables
   */
  async initialize(): Promise<void> {
    try {
      // Debug connection configuration
      console.log('🔧 PostgreSQL Debug Info:');
      console.log(`🔧 Connection string pattern: postgresql://***:***@${this.connectionString.split('@')[1]}`);
      console.log(`🔧 Pool configuration:`, {
        ssl: this.pool.options.ssl,
        max: this.pool.options.max,
        connectionTimeoutMillis: this.pool.options.connectionTimeoutMillis
      });
      
      // Test connection with detailed error handling
      console.log('🔧 Testing PostgreSQL connection...');
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW() as current_time, current_database() as db_name, current_user as user_name');
      console.log('✅ Connection successful! Database info:', result.rows[0]);
      client.release();

      // Ensure credentials directory exists for encryption key
      const credentialsDir = path.join(this.configManager.getConfigDir(), 'credentials');
      if (!fs.existsSync(credentialsDir)) {
        fs.mkdirSync(credentialsDir, { recursive: true });
      }

      // Generate or load encryption key
      this.encryptionKey = this.getOrCreateEncryptionKey();

      // Create tables
      await this.createTables();
      
      // Run migrations for schema updates
      await this.runMigrations();
      
      console.log('✅ PostgreSQL database initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize PostgreSQL database:', error);
      
      // Provide specific troubleshooting information
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('password authentication failed')) {
        console.error('🔧 Authentication failed. Please check:');
        console.error('   - Username and password are correct');
        console.error('   - Database name exists');
        console.error('   - User has permission to access the database');
      } else if (errorMessage.includes('certificate')) {
        console.error('🔧 SSL certificate issue. Try setting rejectUnauthorized: false for development');
      } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ENETUNREACH')) {
        console.error('🔧 Network connectivity issue. Check host and port settings');
      }
      
      throw error;
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    const tables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Accounts table
      `CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        encrypted_credentials TEXT NOT NULL,
        config TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )`,
      
      // Emails table
      `CREATE TABLE IF NOT EXISTS emails (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        subject TEXT,
        sender TEXT,
        recipient TEXT,
        preview TEXT,
        full_body TEXT,
        date TIMESTAMP,
        is_read BOOLEAN DEFAULT FALSE,
        has_attachments BOOLEAN DEFAULT FALSE,
        uid TEXT,
        message_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
      )`,
      
      // Settings table
      `CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(user_id, key)
      )`,
      
      // Indexes for performance
      `CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_emails_account_id ON emails(account_id)`,
      `CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date)`,
      `CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id)`
    ];

    for (const table of tables) {
      await this.query(table);
    }
  }

  /**
   * Run database migrations for schema updates
   */
  private async runMigrations(): Promise<void> {
    try {
      console.log('🔄 Running PostgreSQL database migrations...');
      
      // Check if emails table has old structure and migrate if needed
      const columns = await this.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'emails' AND table_schema = 'public'
      `);
      
      const columnNames = columns.map((col: any) => col.column_name);
      const hasBodyColumn = columnNames.includes('body');
      const hasPreviewColumn = columnNames.includes('preview');
      const hasFullBodyColumn = columnNames.includes('full_body');
      const hasAttachmentsColumn = columnNames.includes('has_attachments');
      
      if (hasBodyColumn && !hasPreviewColumn) {
        console.log('📝 Migrating emails table: body -> preview, adding full_body...');
        
        // Add new columns
        await this.query('ALTER TABLE emails ADD COLUMN preview TEXT');
        await this.query('ALTER TABLE emails ADD COLUMN full_body TEXT');
        
        // Copy data from body to preview, removing PREVIEW: prefix if present
        await this.query(`
          UPDATE emails 
          SET preview = CASE 
            WHEN body LIKE 'PREVIEW:%' THEN SUBSTR(body, 9)
            ELSE body
          END
        `);
        
        // Drop old body column
        await this.query('ALTER TABLE emails DROP COLUMN body');
        
        console.log('✅ Migration completed: emails table updated');
      } else if (!hasFullBodyColumn) {
        // Just add full_body column if missing
        await this.query('ALTER TABLE emails ADD COLUMN full_body TEXT');
        console.log('✅ Added full_body column to emails table');
      }
      
      // Check if has_attachments column exists
      if (!hasAttachmentsColumn) {
        await this.query('ALTER TABLE emails ADD COLUMN has_attachments BOOLEAN DEFAULT FALSE');
        console.log('✅ Added has_attachments column to emails table');
      }
      
      console.log('✅ PostgreSQL database migrations completed');
    } catch (error) {
      console.error('❌ PostgreSQL migration failed:', error);
      throw error;
    }
  }

  /**
   * Get or create encryption key for sensitive data
   */
  private getOrCreateEncryptionKey(): string {
    const keyPath = path.join(this.configManager.getConfigDir(), 'credentials', 'encryption.key');
    
    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath, 'utf8');
    } else {
      const key = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(keyPath, key, 'utf8');
      return key;
    }
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey, 'hex'), iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: string): string {
    const [ivHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey, 'hex'), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Execute a SQL query
   */
  private async query(sql: string, params: any[] = []): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  // User operations
  async createUser(id: string, email: string, passwordHash: string, role: 'admin' | 'user' = 'user'): Promise<void> {
    await this.query(
      'INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      [id, email, passwordHash, role]
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await this.query('SELECT * FROM users WHERE email = $1', [email]);
    return result[0];
  }

  async getUserById(id: string): Promise<User | undefined> {
    const result = await this.query('SELECT * FROM users WHERE id = $1', [id]);
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await this.query('SELECT * FROM users ORDER BY created_at DESC');
  }

  async updateUser(id: string, updates: Partial<User>): Promise<void> {
    // Validate column names to prevent SQL injection
    const allowedFields = ['email', 'password_hash', 'role'];
    const validUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => allowedFields.includes(key))
    );
    
    if (Object.keys(validUpdates).length === 0) {
      throw new Error('No valid fields to update');
    }
    
    const fields = Object.keys(validUpdates).map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = Object.values(validUpdates);
    values.unshift(id);
    
    await this.query(`UPDATE users SET ${fields} WHERE id = $1`, values);
  }

  async deleteUser(id: string): Promise<void> {
    await this.query('DELETE FROM users WHERE id = $1', [id]);
  }

  // Account operations
  async createAccount(account: Omit<Account, 'created_at'>): Promise<boolean> {
    try {
      await this.query(
        'INSERT INTO accounts (id, user_id, name, email, encrypted_credentials, config) VALUES ($1, $2, $3, $4, $5, $6)',
        [account.id, account.user_id, account.name, account.email, account.encrypted_credentials, account.config]
      );
      return true;
    } catch (error) {
      console.error('Failed to create account:', error);
      return false;
    }
  }

  async getAccountsByUserId(userId: string): Promise<Account[]> {
    return await this.query('SELECT * FROM accounts WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  }

  // Alias for frontend compatibility
  async getUserAccounts(userId: string): Promise<Account[]> {
    return this.getAccountsByUserId(userId);
  }

  async getAccountById(id: string): Promise<Account | undefined> {
    const result = await this.query('SELECT * FROM accounts WHERE id = $1', [id]);
    return result[0];
  }

  async updateAccount(id: string, updates: Partial<Account>): Promise<boolean> {
    try {
      // Validate column names to prevent SQL injection
      const allowedFields = ['name', 'email', 'encrypted_credentials', 'config'];
      const validUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key]) => allowedFields.includes(key))
      );
      
      if (Object.keys(validUpdates).length === 0) {
        throw new Error('No valid fields to update');
      }
      
      const fields = Object.keys(validUpdates).map((key, index) => `${key} = $${index + 2}`).join(', ');
      const values = Object.values(validUpdates);
      values.unshift(id);
      
      await this.query(`UPDATE accounts SET ${fields} WHERE id = $1`, values);
      return true;
    } catch (error) {
      console.error('Failed to update account:', error);
      return false;
    }
  }

  async deleteAccount(id: string): Promise<boolean> {
    try {
      await this.query('DELETE FROM accounts WHERE id = $1', [id]);
      return true;
    } catch (error) {
      console.error('Failed to delete account:', error);
      return false;
    }
  }

  // Email operations
  async createEmail(email: Omit<Email, 'created_at'>): Promise<void> {
    await this.query(
      'INSERT INTO emails (id, account_id, subject, sender, recipient, preview, full_body, date, is_read, uid, message_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
      [email.id, email.account_id, email.subject, email.sender, email.recipient, email.preview, email.full_body, email.date, email.is_read, email.uid, email.message_id]
    );
  }

  async createEmailSafe(email: Omit<Email, 'created_at'>): Promise<void> {
    await this.query(
      'INSERT INTO emails (id, account_id, subject, sender, recipient, preview, full_body, date, is_read, has_attachments, uid, message_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO NOTHING',
      [email.id, email.account_id, email.subject, email.sender, email.recipient, email.preview, email.full_body, email.date, email.is_read, email.has_attachments, email.uid, email.message_id]
    );
  }

  async getEmailsByAccountId(accountId: string, limit: number = 50): Promise<Email[]> {
    return await this.query(
      'SELECT * FROM emails WHERE account_id = $1 ORDER BY date DESC LIMIT $2',
      [accountId, limit]
    );
  }

  async getEmailById(id: string): Promise<Email | undefined> {
    const result = await this.query('SELECT * FROM emails WHERE id = $1', [id]);
    return result[0];
  }

  async updateEmail(id: string, updates: Partial<Email>): Promise<void> {
    // Validate column names to prevent SQL injection
    const allowedFields = ['subject', 'sender', 'recipient', 'preview', 'full_body', 'date', 'is_read', 'has_attachments', 'uid', 'message_id'];
    const validUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => allowedFields.includes(key))
    );
    
    if (Object.keys(validUpdates).length === 0) {
      throw new Error('No valid fields to update');
    }
    
    const fields = Object.keys(validUpdates).map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = Object.values(validUpdates);
    values.unshift(id);
    
    await this.query(`UPDATE emails SET ${fields} WHERE id = $1`, values);
  }

  async deleteEmail(id: string): Promise<void> {
    await this.query('DELETE FROM emails WHERE id = $1', [id]);
  }

  async clearEmailsByAccountId(accountId: string): Promise<void> {
    await this.query('DELETE FROM emails WHERE account_id = $1', [accountId]);
  }

  // Settings operations
  async setSetting(userId: string, key: string, value: string): Promise<void> {
    await this.query(
      'INSERT INTO settings (id, user_id, key, value) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, key) DO UPDATE SET value = $4',
      [crypto.randomUUID(), userId, key, value]
    );
  }

  async getSetting(userId: string, key: string): Promise<string | undefined> {
    const result = await this.query('SELECT value FROM settings WHERE user_id = $1 AND key = $2', [userId, key]);
    return result[0]?.value;
  }

  async getAllSettings(userId: string): Promise<Record<string, string>> {
    const settings = await this.query('SELECT key, value FROM settings WHERE user_id = $1', [userId]);
    return settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.pool.end();
    console.log('✅ PostgreSQL database connection closed');
  }

  /**
   * Get database health status
   */
  async getHealthStatus(): Promise<{ healthy: boolean; message: string }> {
    try {
      const result = await this.query('SELECT 1 as test');
      return { healthy: true, message: 'PostgreSQL connection is healthy' };
    } catch (error) {
      return { healthy: false, message: `PostgreSQL error: ${error}` };
    }
  }
}