/**
 * DatabaseManager - SQLite database operations
 * 
 * Handles database initialization, migrations, and basic CRUD operations
 * for the self-hosted Mailflow instance.
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { configManager } from '../config/ConfigManager';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  email: string;
  encrypted_credentials: string;
  config: string;
  created_at: string;
}

export interface Email {
  id: string;
  account_id: string;
  subject: string;
  sender: string;
  recipient: string;
  preview: string;
  full_body?: string;
  date: string;
  is_read: boolean;
  has_attachments?: boolean;
  uid?: string;
  message_id?: string;
}

export interface AppSettings {
  id: string;
  user_id: string;
  key: string;
  value: string;
  created_at: string;
}

export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private encryptionKey: string;

  private constructor() {
    const configDir = configManager.getConfigDir();
    this.dbPath = path.join(configDir, 'database.db');
    
    // Encryption key will be initialized later in initialize() method
    this.encryptionKey = '';
  }

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Initialize database connection and create tables
   */
  async initialize(): Promise<void> {
    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Ensure credentials directory exists
      const credentialsDir = path.join(configManager.getConfigDir(), 'credentials');
      if (!fs.existsSync(credentialsDir)) {
        fs.mkdirSync(credentialsDir, { recursive: true });
      }

      // Generate or load encryption key (now that directories exist)
      this.encryptionKey = this.getOrCreateEncryptionKey();

      // Open database connection
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ Failed to connect to database:', err);
          throw err;
        }
        console.log('✅ Connected to SQLite database');
      });

      // Enable foreign keys
      await this.run('PRAGMA foreign_keys = ON');

      // Create tables
      await this.createTables();
      
      // Run migrations for schema updates
      await this.runMigrations();
      
      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize database:', error);
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Accounts table
      `CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        encrypted_credentials TEXT NOT NULL,
        config TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
        date DATETIME,
        is_read BOOLEAN DEFAULT FALSE,
        has_attachments BOOLEAN DEFAULT FALSE,
        uid TEXT,
        message_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
      )`,
      
      // Settings table
      `CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
      await this.run(table);
    }
  }

  /**
   * Run database migrations for schema updates
   */
  private async runMigrations(): Promise<void> {
    try {
      console.log('🔄 Running database migrations...');
      
      // Check if emails table has old 'body' column instead of 'preview'
      const columns = await this.all(`PRAGMA table_info(emails)`);
      const hasBodyColumn = columns.some((col: any) => col.name === 'body');
      const hasPreviewColumn = columns.some((col: any) => col.name === 'preview');
      const hasFullBodyColumn = columns.some((col: any) => col.name === 'full_body');
      
      if (hasBodyColumn && !hasPreviewColumn) {
        console.log('📝 Migrating emails table: body -> preview, adding full_body...');
        
        // Rename body to preview and add full_body column
        await this.run(`
          CREATE TABLE emails_new (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            subject TEXT,
            sender TEXT,
            recipient TEXT,
            preview TEXT,
            full_body TEXT,
            date DATETIME,
            is_read BOOLEAN DEFAULT FALSE,
            has_attachments BOOLEAN DEFAULT FALSE,
            uid TEXT,
            message_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
          )
        `);
        
        // Copy data from old table, removing PREVIEW: prefix if present
        await this.run(`
          INSERT INTO emails_new 
          SELECT 
            id, account_id, subject, sender, recipient,
            CASE 
              WHEN body LIKE 'PREVIEW:%' THEN SUBSTR(body, 9)
              ELSE body
            END as preview,
            NULL as full_body,
            date, is_read, uid, message_id, created_at
          FROM emails
        `);
        
        // Drop old table and rename new one
        await this.run('DROP TABLE emails');
        await this.run('ALTER TABLE emails_new RENAME TO emails');
        
        console.log('✅ Migration completed: emails table updated');
      } else if (!hasFullBodyColumn) {
        // Just add full_body column if missing
        await this.run('ALTER TABLE emails ADD COLUMN full_body TEXT');
        console.log('✅ Added full_body column to emails table');
      }
      
      // Check if has_attachments column exists
      const hasAttachmentsColumn = columns.some((col: any) => col.name === 'has_attachments');
      if (!hasAttachmentsColumn) {
        await this.run('ALTER TABLE emails ADD COLUMN has_attachments BOOLEAN DEFAULT FALSE');
        console.log('✅ Added has_attachments column to emails table');
      }
      
      console.log('✅ Database migrations completed');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Get or create encryption key for sensitive data
   */
  private getOrCreateEncryptionKey(): string {
    const keyPath = path.join(configManager.getConfigDir(), 'credentials', 'encryption.key');
    
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
   * Execute a SQL query that doesn't return data
   */
  private run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  /**
   * Execute a SQL query that returns a single row
   */
  private get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row as T);
        }
      });
    });
  }

  /**
   * Execute a SQL query that returns multiple rows
   */
  private all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }

  // User operations
  async createUser(id: string, email: string, passwordHash: string, role: 'admin' | 'user' = 'user'): Promise<void> {
    await this.run(
      'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [id, email, passwordHash, role]
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return await this.get<User>('SELECT * FROM users WHERE email = ?', [email]);
  }

  async getUserById(id: string): Promise<User | undefined> {
    return await this.get<User>('SELECT * FROM users WHERE id = ?', [id]);
  }

  async getAllUsers(): Promise<User[]> {
    return await this.all<User>('SELECT * FROM users ORDER BY created_at DESC');
  }

  async updateUser(id: string, updates: Partial<User>): Promise<void> {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    
    await this.run(`UPDATE users SET ${fields} WHERE id = ?`, values);
  }

  async deleteUser(id: string): Promise<void> {
    await this.run('DELETE FROM users WHERE id = ?', [id]);
  }

  // Account operations
  async createAccount(account: Omit<Account, 'created_at'>): Promise<boolean> {
    try {
      await this.run(
        'INSERT INTO accounts (id, user_id, name, email, encrypted_credentials, config) VALUES (?, ?, ?, ?, ?, ?)',
        [account.id, account.user_id, account.name, account.email, account.encrypted_credentials, account.config]
      );
      return true;
    } catch (error) {
      console.error('Failed to create account:', error);
      return false;
    }
  }

  async getAccountsByUserId(userId: string): Promise<Account[]> {
    return await this.all<Account>('SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  }

  // Alias for frontend compatibility
  async getUserAccounts(userId: string): Promise<Account[]> {
    return this.getAccountsByUserId(userId);
  }

  async getAccountById(id: string): Promise<Account | undefined> {
    return await this.get<Account>('SELECT * FROM accounts WHERE id = ?', [id]);
  }

  async updateAccount(id: string, updates: Partial<Account>): Promise<boolean> {
    try {
      const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updates);
      values.push(id);
      
      await this.run(`UPDATE accounts SET ${fields} WHERE id = ?`, values);
      return true;
    } catch (error) {
      console.error('Failed to update account:', error);
      return false;
    }
  }

  async deleteAccount(id: string): Promise<boolean> {
    try {
      await this.run('DELETE FROM accounts WHERE id = ?', [id]);
      return true;
    } catch (error) {
      console.error('Failed to delete account:', error);
      return false;
    }
  }

  // Email operations
  async createEmail(email: Omit<Email, 'created_at'>): Promise<void> {
    await this.run(
      'INSERT INTO emails (id, account_id, subject, sender, recipient, preview, full_body, date, is_read, uid, message_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [email.id, email.account_id, email.subject, email.sender, email.recipient, email.preview, email.full_body, email.date, email.is_read, email.uid, email.message_id]
    );
  }

  async createEmailSafe(email: Omit<Email, 'created_at'>): Promise<void> {
    await this.run(
      'INSERT OR IGNORE INTO emails (id, account_id, subject, sender, recipient, preview, full_body, date, is_read, has_attachments, uid, message_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [email.id, email.account_id, email.subject, email.sender, email.recipient, email.preview, email.full_body, email.date, email.is_read, email.has_attachments, email.uid, email.message_id]
    );
  }

  async getEmailsByAccountId(accountId: string, limit: number = 50): Promise<Email[]> {
    return await this.all<Email>(
      'SELECT * FROM emails WHERE account_id = ? ORDER BY date DESC LIMIT ?',
      [accountId, limit]
    );
  }

  async getEmailById(id: string): Promise<Email | undefined> {
    return await this.get<Email>('SELECT * FROM emails WHERE id = ?', [id]);
  }

  async updateEmail(id: string, updates: Partial<Email>): Promise<void> {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    
    await this.run(`UPDATE emails SET ${fields} WHERE id = ?`, values);
  }

  async deleteEmail(id: string): Promise<void> {
    await this.run('DELETE FROM emails WHERE id = ?', [id]);
  }

  async clearEmailsByAccountId(accountId: string): Promise<void> {
    await this.run('DELETE FROM emails WHERE account_id = ?', [accountId]);
  }

  // Settings operations
  async setSetting(userId: string, key: string, value: string): Promise<void> {
    await this.run(
      'INSERT OR REPLACE INTO settings (id, user_id, key, value) VALUES (?, ?, ?, ?)',
      [crypto.randomUUID(), userId, key, value]
    );
  }

  async getSetting(userId: string, key: string): Promise<string | undefined> {
    const setting = await this.get<AppSettings>('SELECT value FROM settings WHERE user_id = ? AND key = ?', [userId, key]);
    return setting?.value;
  }

  async getAllSettings(userId: string): Promise<Record<string, string>> {
    const settings = await this.all<AppSettings>('SELECT key, value FROM settings WHERE user_id = ?', [userId]);
    return settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('✅ Database connection closed');
          resolve();
        }
      });
    });
  }

  /**
   * Get database health status
   */
  async getHealthStatus(): Promise<{ healthy: boolean; message: string }> {
    try {
      await this.get('SELECT 1');
      return { healthy: true, message: 'Database connection is healthy' };
    } catch (error) {
      return { healthy: false, message: `Database error: ${error}` };
    }
  }
}

// Export singleton instance
export const databaseManager = DatabaseManager.getInstance();