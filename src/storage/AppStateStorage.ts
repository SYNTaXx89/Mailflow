/**
 * Application State Storage
 * 
 * Handles persistence of the main application state including
 * setup status, current view, and settings.
 */

import { AppState } from '../types';
import { BaseStorage, STORAGE_KEYS } from './BaseStorage';

export class AppStateStorage {
  /**
   * Saves the complete application state
   */
  static save(appState: AppState): boolean {
    return BaseStorage.save(STORAGE_KEYS.APP_STATE, {
      isSetup: appState.isSetup,
      isAuthenticated: false, // Never persist authentication state
      currentView: appState.currentView,
      selectedAccount: appState.selectedAccount,
      settings: appState.settings
    });
  }

  /**
   * Loads the application state with defaults
   */
  static load(): Partial<AppState> {
    const defaultState: Partial<AppState> = {
      isSetup: false,
      isAuthenticated: false,
      currentView: 'setup',
      selectedAccount: null,
      settings: {
        theme: 'dark',
        emailsPerPage: 50,
        autoRefresh: 5
      }
    };

    return BaseStorage.load(STORAGE_KEYS.APP_STATE, defaultState);
  }

  /**
   * Saves the setup password securely
   */
  static savePassword(password: string): boolean {
    // In a real application, this should be hashed
    return BaseStorage.save(STORAGE_KEYS.SETUP_PASSWORD, password);
  }

  /**
   * Loads the setup password
   */
  static loadPassword(): string | null {
    return BaseStorage.load(STORAGE_KEYS.SETUP_PASSWORD, null);
  }
}