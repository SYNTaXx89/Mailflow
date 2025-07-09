/**
 * Settings Storage
 * 
 * Handles persistence of application settings and preferences.
 */

import { AppSettings } from '../types';
import { BaseStorage, STORAGE_KEYS } from './BaseStorage';

export class SettingsStorage {
  /**
   * Saves application settings
   */
  static save(settings: AppSettings): boolean {
    return BaseStorage.save(STORAGE_KEYS.SETTINGS, settings);
  }

  /**
   * Loads application settings
   */
  static load(): AppSettings {
    const defaultSettings: AppSettings = {
      theme: 'dark',
      emailsPerPage: 50,
      autoRefresh: 5
    };

    return BaseStorage.load(STORAGE_KEYS.SETTINGS, defaultSettings);
  }

  /**
   * Updates specific setting
   */
  static update<K extends keyof AppSettings>(key: K, value: AppSettings[K]): boolean {
    const settings = this.load();
    settings[key] = value;
    return this.save(settings);
  }
}