/**
 * IMAP IDLE Connection Manager
 * 
 * Handles real-time IMAP IDLE connections per RFC 2177 specification.
 * Provides instant email notifications with proper timeout handling and fallback.
 * 
 * Key Features:
 * - RFC 2177 compliant IDLE implementation
 * - 29-minute timeout handling (restarts connection automatically)
 * - Capability detection with fallback to polling
 * - Event-driven architecture for real-time notifications
 * - Proper connection lifecycle management
 */

const Imap = require('imap');

export interface IdleCredentials {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

export interface IdleEvents {
  onNewMail: (count: number) => void;
  onMailDeleted: (sequenceNumber: number) => void;
  onError: (error: Error) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export interface IdleStatus {
  isConnected: boolean;
  isIdling: boolean;
  supportsIdle: boolean;
  lastActivity: Date;
  connectionAttempts: number;
}

export class IdleConnectionManager {
  private connection: any = null;
  private credentials: IdleCredentials;
  private events: IdleEvents;
  private status: IdleStatus;
  
  // RFC 2177 timing requirements
  private static readonly IDLE_TIMEOUT_MS = 28 * 60 * 1000; // 28 minutes (1 min safety margin)
  private static readonly RECONNECT_DELAY_MS = 5 * 1000; // 5 seconds
  private static readonly MAX_RECONNECT_ATTEMPTS = 5;
  
  // Polling fallback for servers without IDLE
  private static readonly POLLING_INTERVAL_MS = 60 * 1000; // 1 minute fallback polling
  private pollingTimer: NodeJS.Timeout | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  
  constructor(credentials: IdleCredentials, events: IdleEvents) {
    this.credentials = credentials;
    this.events = events;
    this.status = {
      isConnected: false,
      isIdling: false,
      supportsIdle: false,
      lastActivity: new Date(),
      connectionAttempts: 0
    };
  }

  /**
   * Start IDLE connection with capability detection
   */
  async start(): Promise<void> {
    console.log('🔄 Starting IDLE connection manager...');
    
    try {
      await this.connect();
      await this.checkIdleCapability();
      
      if (this.status.supportsIdle) {
        console.log('✅ Server supports IDLE - starting real-time monitoring');
        await this.startIdleMode();
      } else {
        console.log('⚠️ Server does not support IDLE - falling back to polling');
        this.startPolling();
      }
    } catch (error) {
      console.error('❌ Failed to start IDLE connection:', error);
      this.events.onError(error as Error);
      await this.scheduleReconnect();
    }
  }

  /**
   * Stop IDLE connection and cleanup
   */
  async stop(): Promise<void> {
    console.log('🛑 Stopping IDLE connection manager...');
    
    // Clear timers
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    // Stop IDLE mode if active
    if (this.status.isIdling) {
      await this.stopIdleMode();
    }
    
    // Disconnect
    await this.disconnect();
  }

  /**
   * Get current connection status
   */
  getStatus(): IdleStatus {
    return { ...this.status };
  }

  /**
   * Manually trigger refresh (for user-initiated refresh)
   */
  async manualRefresh(): Promise<void> {
    console.log('🔄 Manual refresh triggered during IDLE connection');
    
    if (this.status.isIdling) {
      // Must stop IDLE before sending commands
      await this.stopIdleMode();
      
      // Trigger refresh callback
      this.events.onNewMail(0); // 0 indicates manual refresh
      
      // Restart IDLE after brief delay
      setTimeout(() => {
        this.startIdleMode().catch(error => {
          console.error('❌ Failed to restart IDLE after manual refresh:', error);
          this.events.onError(error);
        });
      }, 1000);
    } else {
      // In polling mode, just trigger refresh
      this.events.onNewMail(0);
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Establish IMAP connection
   */
  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('📡 IDLE: Starting IMAP connection...');
      console.log('📡 IDLE: Connection parameters:', {
        host: this.credentials.host,
        port: this.credentials.port,
        secure: this.credentials.secure,
        user: this.credentials.user,
        passwordLength: this.credentials.password?.length || 0
      });

      this.connection = new Imap({
        host: this.credentials.host,
        port: this.credentials.port,
        tls: this.credentials.secure,
        user: this.credentials.user,
        password: this.credentials.password,
        keepalive: {
          interval: 10000,    // Send keepalive NOOPs every 10 seconds
          idleInterval: 300000, // Re-send IDLE every 5 minutes (default)
          forceNoop: false    // Use IDLE when available, not NOOP
        },
        connTimeout: 10000, // 10 second connection timeout
        authTimeout: 5000,   // 5 second auth timeout
        debug: console.log   // Enable IMAP protocol debugging
      });

      console.log('📡 IDLE: IMAP object created, setting up event handlers...');

      this.connection.once('ready', () => {
        console.log('✅ IDLE: IMAP connection ready');
        console.log('🔍 IDLE: Connection state:', {
          isConnected: true,
          state: this.connection._state,
          capabilities: this.connection._state?.capabilities || 'not available'
        });
        
        this.status.isConnected = true;
        this.status.connectionAttempts = 0;
        this.status.lastActivity = new Date();
        this.events.onConnect();
        resolve();
      });

      this.connection.once('error', (err: Error) => {
        console.error('❌ IDLE: IMAP connection error:', err);
        console.error('❌ IDLE: Error details:', {
          message: err.message,
          stack: err.stack,
          connectionState: this.connection?._state || 'no state'
        });
        this.status.isConnected = false;
        this.events.onError(err);
        reject(err);
      });

      this.connection.once('end', () => {
        console.log('📡 IDLE: IMAP connection ended');
        console.log('🔍 IDLE: Final connection state:', {
          isConnected: this.status.isConnected,
          isIdling: this.status.isIdling,
          lastActivity: this.status.lastActivity
        });
        this.status.isConnected = false;
        this.status.isIdling = false;
        this.events.onDisconnect();
      });

      this.connection.once('close', (hadError: boolean) => {
        console.log(`📡 IDLE: Connection closed (hadError: ${hadError})`);
      });

      // Set up IDLE-specific event handlers
      this.connection.on('mail', (count: number) => {
        console.log(`🎉 IDLE: *** NEW MAIL DETECTED *** ${count} new messages`);
        console.log(`📧 IDLE: This is the event we're waiting for - new email arrived!`);
        this.status.lastActivity = new Date();
        this.events.onNewMail(count);
      });

      this.connection.on('expunge', (seqno: number) => {
        console.log(`🗑️ IDLE: Email deleted notification: sequence ${seqno}`);
        this.status.lastActivity = new Date();
        this.events.onMailDeleted(seqno);
      });

      this.connection.on('update', (seqno: number, info: any) => {
        console.log(`🔄 IDLE: Email update notification: sequence ${seqno}`, info);
      });

      this.connection.on('alert', (message: string) => {
        console.log(`⚠️ IDLE: Server alert: ${message}`);
      });

      console.log('📡 IDLE: Starting connection...');
      this.connection.connect();
    });
  }

  /**
   * Disconnect from IMAP server
   */
  private async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.connection || !this.status.isConnected) {
        console.log('🔌 IDLE connection already disconnected');
        resolve();
        return;
      }

      console.log('🔌 Disconnecting IDLE IMAP connection...');

      const timeout = setTimeout(() => {
        console.warn('⚠️ IDLE disconnect timeout, forcing cleanup');
        this.status.isConnected = false;
        this.connection = null;
        resolve();
      }, 5000);

      this.connection.once('end', () => {
        clearTimeout(timeout);
        this.status.isConnected = false;
        this.connection = null;
        console.log('✅ IDLE IMAP disconnected gracefully');
        resolve();
      });

      this.connection.end();
    });
  }

  /**
   * Check if server supports IDLE capability
   */
  private async checkIdleCapability(): Promise<void> {
    return new Promise((resolve) => {
      console.log('📋 IDLE: Starting capability check...');
      
      if (!this.connection) {
        console.error('❌ IDLE: No IMAP connection for capability check');
        this.status.supportsIdle = false;
        resolve();
        return;
      }

      console.log('🔍 IDLE: Examining connection object for capability detection...');
      console.log('🔍 IDLE: Connection methods available:', {
        hasServerSupports: typeof this.connection.serverSupports === 'function',
        hasState: !!this.connection._state,
        stateKeys: this.connection._state ? Object.keys(this.connection._state) : 'no state'
      });

      try {
        // Multiple ways to check IDLE capability in node-imap
        let supportsIdle = false;
        let detectionMethod = 'none';
        
        // Method 1: Use serverSupports() if available
        if (typeof this.connection.serverSupports === 'function') {
          try {
            supportsIdle = this.connection.serverSupports('IDLE');
            detectionMethod = 'serverSupports';
            console.log(`📋 IDLE: Method 1 - serverSupports('IDLE'): ${supportsIdle}`);
          } catch (error) {
            console.warn('⚠️ IDLE: serverSupports method failed:', error);
          }
        } else {
          console.log('📋 IDLE: Method 1 - serverSupports method not available');
        }
        
        // Method 2: Check capabilities array if available
        if (!supportsIdle && this.connection._state && this.connection._state.capabilities) {
          const capabilities = this.connection._state.capabilities;
          console.log(`🔍 IDLE: Full capabilities array:`, capabilities);
          
          supportsIdle = capabilities.includes('IDLE');
          if (supportsIdle) detectionMethod = 'capabilities_array';
          
          console.log(`📋 IDLE: Method 2 - capabilities array includes IDLE: ${supportsIdle}`);
          console.log(`🔍 IDLE: Capabilities (${capabilities.length} total):`, capabilities.join(', '));
        } else {
          console.log('📋 IDLE: Method 2 - capabilities array not available');
          if (this.connection._state) {
            console.log('🔍 IDLE: State object exists but no capabilities:', Object.keys(this.connection._state));
          }
        }
        
        // Method 3: Check for IDLE in the raw capability string if available
        if (!supportsIdle && this.connection._state && this.connection._state.capability) {
          const capabilityString = this.connection._state.capability;
          supportsIdle = capabilityString.toUpperCase().includes('IDLE');
          if (supportsIdle) detectionMethod = 'capability_string';
          
          console.log(`📋 IDLE: Method 3 - capability string includes IDLE: ${supportsIdle}`);
          console.log(`🔍 IDLE: Capability string: "${capabilityString}"`);
        }
        
        // Method 4: For Gmail/common servers, assume IDLE support (fallback)
        if (!supportsIdle && (
          this.credentials.host.includes('gmail') || 
          this.credentials.host.includes('imap.gmail') ||
          this.credentials.host.includes('outlook') ||
          this.credentials.host.includes('office365')
        )) {
          supportsIdle = true;
          detectionMethod = 'server_fallback';
          console.log(`📋 IDLE: Method 4 - Known server (${this.credentials.host}), assuming IDLE support: ${supportsIdle}`);
        }
        
        this.status.supportsIdle = supportsIdle;
        console.log(`📋 IDLE: Final capability decision: ${this.status.supportsIdle ? 'SUPPORTED' : 'NOT SUPPORTED'} (via ${detectionMethod})`);
        
        resolve();
      } catch (error) {
        console.error('❌ IDLE: Error during capability check:', error);
        console.error('❌ IDLE: Connection state at error:', this.connection._state);
        this.status.supportsIdle = false;
        resolve();
      }
    });
  }

  /**
   * Start IMAP IDLE mode
   */
  private async startIdleMode(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🚀 IDLE: Starting IDLE mode...');
      
      if (!this.connection || !this.status.isConnected) {
        console.error('❌ IDLE: Cannot start IDLE - no connection or not connected');
        reject(new Error('No IMAP connection'));
        return;
      }

      console.log('📂 IDLE: Opening INBOX for monitoring...');
      
      // Open INBOX for monitoring
      this.connection.openBox('INBOX', true, (err: any, box: any) => {
        if (err) {
          console.error('❌ IDLE: Failed to open INBOX for IDLE:', err);
          reject(err);
          return;
        }

        console.log('✅ IDLE: INBOX opened successfully for monitoring');
        console.log('📊 IDLE: Mailbox info:', {
          messages: box.messages.total,
          unseen: box.messages.unseen,
          recent: box.messages.recent || 0,
          flags: box.flags || []
        });

        // Check IDLE support before attempting to start
        if (!this.status.supportsIdle) {
          console.warn('⚠️ IDLE: Server does not support IDLE capability - cannot start IDLE mode');
          console.log('📋 IDLE: Fallback to polling mode will be used instead');
          reject(new Error('Server does not support IDLE capability'));
          return;
        }

        console.log('✅ IDLE: Server supports IDLE, attempting to start IDLE mode...');

        // node-imap handles IDLE automatically via keepalive mechanism
        try {
          console.log('📡 IDLE: node-imap uses automatic IDLE via keepalive - no manual command needed');
          console.log('🔍 IDLE: Connection keepalive config:', {
            keepalive: this.connection._config?.keepalive,
            interval: this.connection._config?.keepalive?.interval,
            idleInterval: this.connection._config?.keepalive?.idleInterval,
            forceNoop: this.connection._config?.keepalive?.forceNoop
          });
          
          // In node-imap, IDLE is handled automatically when:
          // 1. Server supports IDLE capability (✓ already checked)
          // 2. keepalive is enabled (✓ enabled in constructor)
          // 3. Connection is open and mailbox is selected (✓ INBOX is open)
          
          console.log('✅ IDLE: Automatic IDLE mode activated via keepalive mechanism');
          console.log('📡 IDLE: Listening for \'mail\' events for real-time notifications');
          console.log('⚠️ IDLE: To test, send a new email to this account and watch for "*** NEW MAIL DETECTED ***" message');
          
          this.status.isIdling = true;
          this.status.lastActivity = new Date();

          // Set RFC 2177 compliant timeout (28 minutes)
          console.log(`⏰ IDLE: Setting ${IdleConnectionManager.IDLE_TIMEOUT_MS / (60 * 1000)} minute timeout for IDLE refresh`);
          this.idleTimer = setTimeout(() => {
            console.log('⏰ IDLE: IDLE timeout reached - restarting connection per RFC 2177');
            this.restartIdleConnection();
          }, IdleConnectionManager.IDLE_TIMEOUT_MS);

          console.log('🎉 IDLE: IDLE mode setup complete - ready for real-time notifications');
          resolve();
        } catch (idleErr) {
          console.error('❌ IDLE: IDLE command failed:', idleErr);
          console.error('❌ IDLE: Error details:', {
            message: idleErr instanceof Error ? idleErr.message : String(idleErr),
            name: idleErr instanceof Error ? idleErr.name : 'UnknownError',
            connectionState: this.connection._state
          });
          reject(idleErr as Error);
        }
      });
    });
  }

  /**
   * Stop IMAP IDLE mode (node-imap handles this automatically)
   */
  private async stopIdleMode(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.status.isIdling) {
        resolve();
        return;
      }

      console.log('🛑 Stopping IDLE mode (automatic via node-imap keepalive)...');

      if (this.idleTimer) {
        clearTimeout(this.idleTimer);
        this.idleTimer = null;
      }

      // node-imap handles IDLE termination automatically when connection ends
      // or when other commands are sent. No manual DONE command needed.
      console.log('✅ IDLE mode will stop automatically when connection closes');
      this.status.isIdling = false;
      
      resolve();
    });
  }

  /**
   * Restart IDLE connection (for timeout handling)
   */
  private async restartIdleConnection(): Promise<void> {
    try {
      console.log('🔄 Restarting IDLE connection...');
      
      await this.stopIdleMode();
      await this.disconnect();
      await this.connect();
      await this.startIdleMode();
      
      console.log('✅ IDLE connection restarted successfully');
    } catch (error) {
      console.error('❌ Failed to restart IDLE connection:', error);
      this.events.onError(error as Error);
      await this.scheduleReconnect();
    }
  }

  /**
   * Start polling fallback for servers without IDLE
   */
  private startPolling(): void {
    console.log(`🔄 Starting polling fallback (${IdleConnectionManager.POLLING_INTERVAL_MS / 1000}s interval)`);
    
    this.pollingTimer = setInterval(() => {
      console.log('📊 Polling for new emails...');
      this.status.lastActivity = new Date();
      this.events.onNewMail(0); // 0 indicates polling check
    }, IdleConnectionManager.POLLING_INTERVAL_MS);
  }

  /**
   * Schedule reconnection after failure
   */
  private async scheduleReconnect(): Promise<void> {
    this.status.connectionAttempts++;
    
    if (this.status.connectionAttempts >= IdleConnectionManager.MAX_RECONNECT_ATTEMPTS) {
      console.error('❌ Max reconnection attempts reached, giving up');
      this.events.onError(new Error('Max reconnection attempts reached'));
      return;
    }

    const delay = IdleConnectionManager.RECONNECT_DELAY_MS * this.status.connectionAttempts;
    console.log(`⏳ Scheduling reconnection attempt ${this.status.connectionAttempts} in ${delay / 1000}s`);
    
    setTimeout(() => {
      this.start().catch(error => {
        console.error('❌ Reconnection attempt failed:', error);
      });
    }, delay);
  }
}