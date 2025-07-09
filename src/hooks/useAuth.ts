import { useState, useEffect } from 'react';
import { AppState } from '../types/index';
import { AccountApi, SettingsApi } from '../utils/api';
import { apiConfig, debugApiConfig } from '../config/api';

export const useAuth = () => {
  const initializeAppState = (): AppState => {
    return {
      isSetup: true,
      isAuthenticated: false,
      currentView: 'inbox',
      selectedAccount: null,
      accounts: [],
      settings: {
        theme: 'dark',
        emailsPerPage: 50,
        autoRefresh: 5
      },
      setupData: {
        password: '',
        confirmPassword: ''
      },
      loginPassword: ''
    };
  };

  const [appState, setAppState] = useState<AppState>(initializeAppState);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        console.log('Loading initial data from API...');
        
        try {
          // Debug API configuration in development
          debugApiConfig();
          
          const testResponse = await fetch(apiConfig.accounts);
          console.log('API test response status:', testResponse.status);
          if (!testResponse.ok) {
            console.error('API not accessible, status:', testResponse.status);
          }
        } catch (apiError) {
          console.error('API not accessible:', apiError);
        }
        
        const [accounts, settings] = await Promise.all([
          AccountApi.load(),
          SettingsApi.load()
        ]);
        
        console.log('Successfully loaded accounts from API:', accounts.length, accounts);
        console.log('Successfully loaded settings from API:', settings);
        
        const validAccounts = accounts.filter(account => {
          if (!account.imap) return true;
          const hasValidConfig = account.imap.host && account.password;
          if (!hasValidConfig) {
            console.warn('Account has invalid IMAP config:', account.id, {
              hasHost: !!account.imap.host,
              hasPassword: !!account.password
            });
          }
          return hasValidConfig;
        });
        
        console.log('Valid accounts after filtering:', validAccounts.length);
        
        if (validAccounts.length === 0) {
          console.log('No valid accounts found');
          setAppState(prev => ({
            ...prev,
            isAuthenticated: true,
            accounts: [],
            settings,
            selectedAccount: null
          }));
        } else {
          console.log('Valid accounts found:', validAccounts);
          console.log('Setting selectedAccount to:', validAccounts[0]?.id);
          setAppState(prev => ({
            ...prev,
            isAuthenticated: true,
            accounts: validAccounts,
            settings,
            selectedAccount: validAccounts[0]?.id || null
          }));
        }
      } catch (error) {
        console.error('Failed to load initial data:', error);
        console.error('Error details:', error instanceof Error ? error.message : String(error));
        console.log('No accounts available, starting with empty state');
        setAppState(prev => ({
          ...prev,
          isAuthenticated: true,
          accounts: [],
          selectedAccount: null
        }));
      }
    };
    
    loadInitialData();
  }, []);

  return { appState, setAppState };
};