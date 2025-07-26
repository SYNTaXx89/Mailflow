/**
 * Database Factory - Creates appropriate database manager based on environment
 * 
 * Automatically detects PostgreSQL connection string and switches between
 * SQLite (local/fallback) and PostgreSQL (production) implementations.
 */

import { DatabaseManager } from './DatabaseManager';
import { PostgreSQLDatabaseManager } from './PostgreSQLDatabaseManager';
import { ConfigManager } from '../config/ConfigManager';
import { IDatabaseManager } from './IDatabaseManager';

/**
 * Create database manager based on environment variables
 * 
 * Checks for PostgreSQL configuration in environment:
 * Option 1 - Connection URLs:
 * - DATABASE_URL (Railway/Render standard)
 * - POSTGRES_URL (alternative name)
 * 
 * Option 2 - Individual parameters:
 * - POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
 * 
 * If found, uses PostgreSQL. Otherwise, falls back to SQLite.
 */
export async function createDatabaseManager(configManager: ConfigManager): Promise<IDatabaseManager> {
  // Check for PostgreSQL connection - either full URL or individual components
  const postgresUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  // Check for individual PostgreSQL parameters
  const postgresHost = process.env.POSTGRES_HOST;
  const postgresPort = process.env.POSTGRES_PORT || '5432';
  const postgresDb = process.env.POSTGRES_DB;
  const postgresUser = process.env.POSTGRES_USER;
  const postgresPassword = process.env.POSTGRES_PASSWORD;
  
  let connectionString: string | null = null;
  
  if (postgresUrl) {
    // Use provided connection URL
    connectionString = postgresUrl;
    console.log('🐘 PostgreSQL connection URL detected, using PostgreSQL database');
    console.log(`📡 Connecting to: ${postgresUrl.replace(/\/\/[^@]+@/, '//***:***@')}`); // Hide credentials in logs
  } else if (postgresHost && postgresDb && postgresUser && postgresPassword) {
    // Validate all required parameters are present and non-empty
    const params = { postgresHost, postgresDb, postgresUser, postgresPassword, postgresPort };
    const missingParams = Object.entries(params).filter(([key, value]) => !value || value.trim() === '');
    
    if (missingParams.length > 0) {
      console.error('❌ Missing or empty PostgreSQL parameters:', missingParams.map(([key]) => key));
      throw new Error(`Missing PostgreSQL parameters: ${missingParams.map(([key]) => key).join(', ')}`);
    }

    // Build connection URL from individual parameters (SSL handled by Pool config)
    connectionString = `postgresql://${encodeURIComponent(postgresUser)}:${encodeURIComponent(postgresPassword)}@${postgresHost}:${postgresPort}/${postgresDb}`;
    console.log('🐘 PostgreSQL parameters detected, using PostgreSQL database');
    console.log(`📡 Connecting to: postgresql://***:***@${postgresHost}:${postgresPort}/${postgresDb} (SSL handled by Pool config)`); // Hide credentials in logs
  }
  
  if (connectionString) {
    const pgManager = new PostgreSQLDatabaseManager(configManager, connectionString);
    await pgManager.initialize();
    return pgManager;
  } else {
    console.log('📁 No PostgreSQL configuration found, using SQLite database');
    
    const sqliteManager = new DatabaseManager(configManager);
    await sqliteManager.initialize();
    return sqliteManager;
  }
}

// Re-export all types for compatibility with existing imports
export type { User, Account, Email, AppSettings } from './IDatabaseManager';
export type { IDatabaseManager } from './IDatabaseManager';

// Re-export classes for type unions
export { DatabaseManager } from './DatabaseManager';
export { PostgreSQLDatabaseManager } from './PostgreSQLDatabaseManager';