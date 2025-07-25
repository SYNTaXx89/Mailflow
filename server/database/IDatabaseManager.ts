/**
 * Database Manager Interface
 * 
 * Common interface for both SQLite and PostgreSQL database managers
 * to ensure they have identical public APIs.
 */

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

export interface IDatabaseManager {
  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;
  getHealthStatus(): Promise<{ healthy: boolean; message: string }>;

  // Encryption
  encrypt(data: string): string;
  decrypt(encryptedData: string): string;

  // User operations
  createUser(id: string, email: string, passwordHash: string, role?: 'admin' | 'user'): Promise<void>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<User>): Promise<void>;
  deleteUser(id: string): Promise<void>;

  // Account operations
  createAccount(account: Omit<Account, 'created_at'>): Promise<boolean>;
  getAccountsByUserId(userId: string): Promise<Account[]>;
  getUserAccounts(userId: string): Promise<Account[]>; // Alias
  getAccountById(id: string): Promise<Account | undefined>;
  updateAccount(id: string, updates: Partial<Account>): Promise<boolean>;
  deleteAccount(id: string): Promise<boolean>;

  // Email operations
  createEmail(email: Omit<Email, 'created_at'>): Promise<void>;
  createEmailSafe(email: Omit<Email, 'created_at'>): Promise<void>;
  getEmailsByAccountId(accountId: string, limit?: number): Promise<Email[]>;
  getEmailById(id: string): Promise<Email | undefined>;
  updateEmail(id: string, updates: Partial<Email>): Promise<void>;
  deleteEmail(id: string): Promise<void>;
  clearEmailsByAccountId(accountId: string): Promise<void>;

  // Settings operations
  setSetting(userId: string, key: string, value: string): Promise<void>;
  getSetting(userId: string, key: string): Promise<string | undefined>;
  getAllSettings(userId: string): Promise<Record<string, string>>;
}