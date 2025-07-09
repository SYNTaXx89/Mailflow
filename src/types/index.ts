/**
 * Types Index - Central Type Export File
 * 
 * This file provides a central location for exporting all TypeScript types and interfaces
 * used throughout the MailFlow email client application.
 * 
 * Types are organized by category:
 * - Core Data Types: Account, Email, etc.
 * - Application State: AppState, Settings, etc.
 * - Form Data: Composer, Account setup, etc.
 * - Component Props: Interface definitions for component props
 */

// ============================================================================
// CORE DATA TYPES
// ============================================================================

// Account related types
export interface Account {
  id: string;
  name: string;
  email: string;
  username?: string; // Username for authentication (can be different from email)
  password?: string; // Store password in clear text (will be secured later)
  unreadCount: number;
  color: string;
  imap?: {
    host: string;
    port: number;
    security: string;
  };
  smtp?: {
    host: string;
    port: number;
    security: string;
  };
}

// Email related types
export interface EmailFrom {
  name: string;
  email: string;
}

export interface EmailAttachment {
  filename: string;
  size: number;
  contentType: string;
}

export interface Email {
  id: string;
  accountId: string;
  from: EmailFrom;
  subject: string;
  date: Date;
  isRead: boolean;
  preview: string;
  content: string;
  uid?: string | number; // IMAP UID for fetching full content
  hasAttachments?: boolean;
  attachments?: EmailAttachment[];
}

// ============================================================================
// APPLICATION STATE TYPES
// ============================================================================

export interface AppSettings {
  theme: string;
  emailsPerPage: number;
  autoRefresh: number;
}

export interface SetupData {
  password: string;
  confirmPassword: string;
}

export interface AppState {
  isSetup: boolean;
  isAuthenticated: boolean;
  currentView: string;
  selectedAccount: string | null;
  accounts: Account[];
  settings: AppSettings;
  setupData: SetupData;
  loginPassword: string;
}

// ============================================================================
// FORM DATA TYPES
// ============================================================================

// Composer related types
export type ComposerType = 'reply' | 'replyAll' | 'new';

export interface ComposerAttachment {
  file: File;
  id: string;
  name: string;
  size: number;
  type: string;
}

export interface ComposerData {
  to: string;
  subject: string;
  body: string;
  attachments: ComposerAttachment[];
}

// Account form data (used for both new and edit)
export interface AccountFormData {
  name: string;
  email: string;
  username: string;
  password: string;
  imapHost: string;
  imapPort: string;
  imapSecurity: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecurity: string;
}

// Legacy interface for backward compatibility
export type NewAccountData = AccountFormData;

// ============================================================================
// COMPONENT PROPS INTERFACES
// ============================================================================

export interface SetupViewProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  errors: Record<string, string>;
  handleSetup: () => void;
}

export interface LoginViewProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  errors: Record<string, string>;
  handleLogin: () => void;
}

export interface EmailComposerProps {
  showComposer: boolean;
  setShowComposer: React.Dispatch<React.SetStateAction<boolean>>;
  composerType: ComposerType;
  composerData: ComposerData;
  setComposerData: React.Dispatch<React.SetStateAction<ComposerData>>;
  sendEmail: () => Promise<void>;
  isSendingEmail?: boolean;
  emailSentSuccess?: boolean;
}

export interface SidebarProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  currentEmails: Email[];
  selectedEmail: Email | null;
  setSelectedEmail: React.Dispatch<React.SetStateAction<Email | null>>;
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
  formatDate: (date: Date) => string;
  isLoadingEmails?: boolean;
  emailLoadError?: string | null;
  loadEmailContent?: (email: Email) => Promise<void>;
  isLoadingEmailContent?: boolean;
  refreshEmails?: () => Promise<void>;
  softRefreshEmails?: () => Promise<void>;
  markEmailAsRead?: (email: Email) => Promise<void>;
  onNewEmail?: () => void;
  idleStatus?: Map<string, any>;
  idleConnections?: Map<string, any>;
}

export interface EmailViewProps {
  selectedEmail: Email | null;
  formatDate: (date: Date) => string;
  handleReply: (email: Email, type?: ComposerType) => Promise<void>;
  handleDelete: (email: Email) => void;
  isLoadingEmailContent?: boolean;
}

export interface AddAccountModalProps {
  showAddAccount: boolean;
  setShowAddAccount: React.Dispatch<React.SetStateAction<boolean>>;
  newAccountData: NewAccountData;
  setNewAccountData: React.Dispatch<React.SetStateAction<NewAccountData>>;
  isTestingConnection: boolean;
  testConnection: () => Promise<void>;
  saveAccount: () => void;
  autoDetectSettings: (email: string) => void;
}

export interface SettingsModalProps {
  showSettings: boolean;
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
  appState: AppState;
  setShowAddAccount: React.Dispatch<React.SetStateAction<boolean>>;
}