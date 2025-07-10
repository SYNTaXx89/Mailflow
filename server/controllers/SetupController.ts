/**
 * Setup Controller - Initial instance setup management
 * 
 * Handles setup wizard flow, admin account creation, and instance
 * initialization for self-hosted Mailflow instances.
 */

import crypto from 'crypto';
import { Request, Response } from 'express';
import { ConfigManager } from '../config/ConfigManager';
import { DatabaseManager } from '../database/DatabaseManager';
import { PasswordManager } from '../auth/PasswordManager';
import { TokenManager } from '../auth/TokenManager';

export interface SetupStatus {
  needsSetup: boolean;
  step?: 'welcome' | 'admin' | 'config' | 'complete';
  instanceId?: string;
  version?: string;
}

export interface AdminSetupData {
  email: string;
  password: string;
  confirmPassword: string;
  instanceName?: string;
}

export interface InstanceConfig {
  instanceName: string;
  timezone: string;
  features: {
    multiUser: boolean;
    invitations: boolean;
    backups: boolean;
  };
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
  };
}

export class SetupController {
  constructor(
    private configManager: ConfigManager,
    private databaseManager: DatabaseManager,
    private tokenManager: TokenManager
  ) {}

  /**
   * Get current setup status
   */
  async getSetupStatus(req: Request, res: Response): Promise<void> {
    try {
      const isSetupCompleted = this.configManager.isSetupCompleted();
      const instanceId = this.configManager.get('instanceId');
      const version = this.configManager.get('version');

      if (isSetupCompleted) {
        res.json({
          needsSetup: false,
          step: 'complete',
          instanceId,
          version,
          message: 'Instance is already configured'
        });
        return;
      }

      // Check if admin exists in database
      const users = await this.databaseManager.getAllUsers();
      const adminExists = users.some(user => user.role === 'admin');

      let step: SetupStatus['step'] = 'welcome';
      if (adminExists) {
        step = 'config'; // Admin exists, just need to complete config
      }

      res.json({
        needsSetup: true,
        step,
        instanceId,
        version,
        message: 'Setup required'
      });

      console.log('🔧 Setup status requested - needs setup:', !isSetupCompleted);
    } catch (error) {
      console.error('❌ Failed to get setup status:', error);
      res.status(500).json({
        error: 'Setup status check failed',
        message: 'Unable to determine setup status'
      });
    }
  }

  /**
   * Initialize the setup process
   */
  async initializeSetup(req: Request, res: Response): Promise<void> {
    try {
      const isSetupCompleted = this.configManager.isSetupCompleted();
      
      if (isSetupCompleted) {
        res.status(400).json({
          error: 'Setup already completed',
          message: 'Instance is already configured'
        });
        return;
      }

      // Ensure database is ready
      const healthStatus = await this.databaseManager.getHealthStatus();
      if (!healthStatus.healthy) {
        res.status(500).json({
          error: 'Database not ready',
          message: healthStatus.message
        });
        return;
      }

      res.json({
        success: true,
        message: 'Setup initialization successful',
        instanceId: this.configManager.get('instanceId'),
        nextStep: 'admin'
      });

      console.log('🚀 Setup initialization successful');
    } catch (error) {
      console.error('❌ Setup initialization failed:', error);
      res.status(500).json({
        error: 'Setup initialization failed',
        message: 'Unable to initialize setup process'
      });
    }
  }

  /**
   * Create admin account
   */
  async createAdmin(req: Request, res: Response): Promise<void> {
    try {
      // CHECK IF SETUP IS ALREADY COMPLETED
      if (this.configManager.isSetupCompleted()) {
        res.status(403).json({
          error: 'Setup already completed',
          message: 'Admin account can only be created during initial setup'
        });
        return;
      }

      // Check if ANY admin already exists
      const users = await this.databaseManager.getAllUsers();
      const adminExists = users.some(user => user.role === 'admin');
      if (adminExists) {
        res.status(403).json({
          error: 'Admin already exists',
          message: 'An admin account has already been created'
        });
        return;
      }

      const { email, password, confirmPassword, instanceName }: AdminSetupData = req.body;

      // Validate input
      if (!email || !password || !confirmPassword) {
        res.status(400).json({
          error: 'Missing required fields',
          message: 'Email, password, and password confirmation are required'
        });
        return;
      }

      if (password !== confirmPassword) {
        res.status(400).json({
          error: 'Password mismatch',
          message: 'Password and confirmation do not match'
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({
          error: 'Invalid email',
          message: 'Please enter a valid email address'
        });
        return;
      }

      // Validate password strength
      const passwordValidation = PasswordManager.validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        res.status(400).json({
          error: 'Weak password',
          message: 'Password does not meet security requirements',
          details: passwordValidation.errors
        });
        return;
      }

      // Check if this specific email is already taken
      const existingUser = await this.databaseManager.getUserByEmail(email);
      if (existingUser) {
        res.status(400).json({
          error: 'Email already exists',
          message: 'A user with this email already exists'
        });
        return;
      }

      // Hash password
      const passwordHash = await PasswordManager.hash(password);

      // Create admin user
      const adminId = crypto.randomUUID();
      await this.databaseManager.createUser(adminId, email, passwordHash, 'admin');

      // Update instance name if provided
      if (instanceName && instanceName.trim()) {
        await this.configManager.set('instanceName', instanceName.trim());
      }

      // Generate tokens for immediate login
      const tokens = this.tokenManager.generateTokenPair(adminId, email, 'admin');

      res.json({
        success: true,
        message: 'Admin account created successfully',
        user: {
          id: adminId,
          email,
          role: 'admin'
        },
        ...tokens,
        nextStep: 'config'
      });

      console.log('✅ Admin account created:', email);
    } catch (error) {
      console.error('❌ Admin creation failed:', error);
      res.status(500).json({
        error: 'Admin creation failed',
        message: 'Unable to create admin account'
      });
    }
  }

  /**
   * Configure instance settings
   */
  async configureInstance(req: Request, res: Response): Promise<void> {
    try {
      const config: InstanceConfig = req.body;

      // Validate required fields
      if (!config.instanceName || !config.timezone) {
        res.status(400).json({
          error: 'Missing configuration',
          message: 'Instance name and timezone are required'
        });
        return;
      }

      // Update configuration
      await this.configManager.set('instanceName', config.instanceName);
      
      // Update features
      if (config.features) {
        await this.configManager.setDeep('features.multiUser', config.features.multiUser);
        await this.configManager.setDeep('features.invitations', config.features.invitations);
        await this.configManager.setDeep('features.backups', config.features.backups);
      }

      // Configure SMTP if provided
      if (config.smtp) {
        await this.configManager.setDeep('smtp', config.smtp);
      }

      res.json({
        success: true,
        message: 'Instance configuration saved successfully',
        nextStep: 'complete'
      });

      console.log('✅ Instance configuration updated');
    } catch (error) {
      console.error('❌ Instance configuration failed:', error);
      res.status(500).json({
        error: 'Configuration failed',
        message: 'Unable to save instance configuration'
      });
    }
  }

  /**
   * Complete setup process
   */
  async completeSetup(req: Request, res: Response): Promise<void> {
    try {
      // Verify admin exists
      const users = await this.databaseManager.getAllUsers();
      const admin = users.find(user => user.role === 'admin');
      
      if (!admin) {
        res.status(400).json({
          error: 'No admin account',
          message: 'Admin account must be created before completing setup'
        });
        return;
      }

      // Mark setup as completed
      await this.configManager.completeSetup(admin.email, admin.password_hash);

      // Get final configuration
      const finalConfig = {
        instanceId: this.configManager.get('instanceId'),
        instanceName: this.configManager.get('instanceName'),
        version: this.configManager.get('version'),
        features: this.configManager.get('features'),
        completedAt: new Date().toISOString()
      };

      res.json({
        success: true,
        message: 'Setup completed successfully! Welcome to Mailflow.',
        config: finalConfig,
        redirectTo: '/login'
      });

      console.log('🎉 Setup completed successfully for instance:', finalConfig.instanceName);
    } catch (error) {
      console.error('❌ Setup completion failed:', error);
      res.status(500).json({
        error: 'Setup completion failed',
        message: 'Unable to complete setup process'
      });
    }
  }

  /**
   * Reset setup (for development/troubleshooting)
   */
  async resetSetup(req: Request, res: Response): Promise<void> {
    try {
      // Only allow in development
      const isDevelopment = process.env.NODE_ENV !== 'production';
      if (!isDevelopment) {
        res.status(403).json({
          error: 'Not allowed',
          message: 'Setup reset is only available in development mode'
        });
        return;
      }

      // Reset setup in configuration
      await this.configManager.setDeep('setup.completed', false);
      await this.configManager.setDeep('setup.completedAt', null);

      // Optionally clear admin (be careful!)
      const { clearAdmin } = req.body;
      if (clearAdmin) {
        const users = await this.databaseManager.getAllUsers();
        for (const user of users) {
          await this.databaseManager.deleteUser(user.id);
        }
        console.log('⚠️  All users cleared during setup reset');
      }

      res.json({
        success: true,
        message: 'Setup reset successfully',
        warning: 'Instance needs to be reconfigured'
      });

      console.log('🔄 Setup reset completed');
    } catch (error) {
      console.error('❌ Setup reset failed:', error);
      res.status(500).json({
        error: 'Setup reset failed',
        message: 'Unable to reset setup'
      });
    }
  }
}