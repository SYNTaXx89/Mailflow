/**
 * ConfigManager - File-based configuration management
 * 
 * Handles loading, saving, and validation of application configuration
 * stored in the .mailflow directory for self-hosted instances.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface MailFlowConfig {
  version: string;
  instanceId: string;
  instanceName: string;
  setup: {
    completed: boolean;
    completedAt?: string;
  };
  admin?: {
    email: string;
    passwordHash: string;
  };
  database: {
    path: string;
    encryptionEnabled: boolean;
    backupEnabled: boolean;
    backupInterval: string;
  };
  security: {
    jwtSecret: string;
    sessionTimeout: number;
    rateLimitEnabled: boolean;
  };
  features: {
    multiUser: boolean;
    invitations: boolean;
    backups: boolean;
  };
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: MailFlowConfig | null = null;
  private readonly configPath: string;
  private readonly configDir: string;

  private constructor() {
    // Use Docker-friendly data directory
    const dataDir = process.env.MAILFLOW_DATA_DIR || path.join(process.cwd(), '.mailflow');
    this.configDir = dataDir;
    this.configPath = path.join(this.configDir, 'config.json');
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Initialize configuration system
   */
  async initialize(): Promise<void> {
    try {
      // Ensure .mailflow directory exists
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
        fs.mkdirSync(path.join(this.configDir, 'credentials'), { recursive: true });
        fs.mkdirSync(path.join(this.configDir, 'logs'), { recursive: true });
      }

      // Load existing config or create default
      if (fs.existsSync(this.configPath)) {
        await this.loadConfig();
      } else {
        await this.createDefaultConfig();
      }

      console.log('✅ ConfigManager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize ConfigManager:', error);
      throw error;
    }
  }

  /**
   * Load configuration from file
   */
  private async loadConfig(): Promise<void> {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
      
      // Validate configuration
      this.validateConfig();
      
      console.log('✅ Configuration loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load configuration:', error);
      throw error;
    }
  }

  /**
   * Create default configuration
   */
  private async createDefaultConfig(): Promise<void> {
    this.config = {
      version: '1.0.0',
      instanceId: crypto.randomUUID(),
      instanceName: 'MailFlow Instance',
      setup: {
        completed: false
      },
      database: {
        path: './database.db',
        encryptionEnabled: true,
        backupEnabled: true,
        backupInterval: 'daily'
      },
      security: {
        jwtSecret: crypto.randomBytes(64).toString('hex'),
        sessionTimeout: 3600, // 1 hour
        rateLimitEnabled: true
      },
      features: {
        multiUser: true,
        invitations: true,
        backups: true
      }
    };

    await this.saveConfig();
    console.log('✅ Default configuration created');
  }

  /**
   * Save configuration to file
   */
  private async saveConfig(): Promise<void> {
    try {
      const configData = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, configData, 'utf8');
      console.log('✅ Configuration saved successfully');
    } catch (error) {
      console.error('❌ Failed to save configuration:', error);
      throw error;
    }
  }

  /**
   * Validate configuration structure
   */
  private validateConfig(): void {
    if (!this.config) {
      throw new Error('Configuration is null');
    }

    // Check required fields
    const requiredFields = ['version', 'instanceId', 'setup', 'database', 'security', 'features'];
    for (const field of requiredFields) {
      if (!(field in this.config)) {
        throw new Error(`Missing required configuration field: ${field}`);
      }
    }

    // Validate security settings
    if (!this.config.security.jwtSecret || this.config.security.jwtSecret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters long');
    }
  }

  /**
   * Get configuration value
   */
  get<K extends keyof MailFlowConfig>(key: K): MailFlowConfig[K] | undefined {
    return this.config?.[key];
  }

  /**
   * Get nested configuration value
   */
  getDeep(path: string): any {
    if (!this.config) return undefined;
    
    const keys = path.split('.');
    let value: any = this.config;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Set configuration value
   */
  async set<K extends keyof MailFlowConfig>(key: K, value: MailFlowConfig[K]): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not initialized');
    }
    
    this.config[key] = value;
    await this.saveConfig();
  }

  /**
   * Set nested configuration value
   */
  async setDeep(path: string, value: any): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not initialized');
    }
    
    const keys = path.split('.');
    let current: any = this.config;
    
    // Navigate to the parent of the target property
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    // Set the final value
    current[keys[keys.length - 1]] = value;
    await this.saveConfig();
  }

  /**
   * Check if setup is completed
   */
  isSetupCompleted(): boolean {
    return this.config?.setup.completed === true;
  }

  /**
   * Mark setup as completed
   */
  async completeSetup(adminEmail: string, passwordHash: string): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not initialized');
    }
    
    this.config.setup.completed = true;
    this.config.setup.completedAt = new Date().toISOString();
    this.config.admin = {
      email: adminEmail,
      passwordHash
    };
    
    await this.saveConfig();
  }

  /**
   * Get full configuration (for debugging)
   */
  getFullConfig(): MailFlowConfig | null {
    return this.config;
  }

  /**
   * Get configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Get configuration directory path
   */
  getConfigDir(): string {
    return this.configDir;
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance();