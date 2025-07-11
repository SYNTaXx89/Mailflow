import { useState, useEffect } from 'react';
import { Account, AccountFormData, AppState } from '../types/index';
import { AccountApi, EmailApi } from '../utils/api';
import { apiConfig } from '../config/api';

export const useAccountManagement = (appState: AppState, setAppState: React.Dispatch<React.SetStateAction<AppState>>) => {
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>(undefined);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  useEffect(() => {
    const updateUnreadCounts = async () => {
      if (!appState.isAuthenticated || appState.accounts.length === 0) return;
      
      try {
        const updatedAccounts = await Promise.all(
          appState.accounts.map(async (account) => {
            const accountEmails = await EmailApi.getByAccount(account.id);
            const unreadCount = accountEmails.filter(email => !email.isRead).length;
            return { ...account, unreadCount };
          })
        );
        
        if (JSON.stringify(updatedAccounts) !== JSON.stringify(appState.accounts)) {
          setAppState(prev => ({ ...prev, accounts: updatedAccounts }));
        }
      } catch (error) {
        console.error('Failed to update unread counts:', error);
      }
    };
    
    updateUnreadCounts();
  }, [appState.isAuthenticated, appState.accounts.length, setAppState]);

  const testConnection = async (formData: AccountFormData): Promise<void> => {
    setIsTestingConnection(true);
    
    try {
      const testAccount: Account = {
        id: 'test',
        name: formData.name,
        email: formData.email,
        username: formData.username,
        unreadCount: 0,
        color: '#004c60',
        imap: {
          host: formData.imapHost,
          port: parseInt(formData.imapPort),
          security: formData.imapSecurity
        },
        smtp: {
          host: formData.smtpHost,
          port: parseInt(formData.smtpPort),
          security: formData.smtpSecurity
        }
      };
      
      // Test connection via backend API
      const token = localStorage.getItem('mailflow_access_token');
      const response = await fetch(`${apiConfig.baseUrl}/imap/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          account: testAccount,
          password: formData.password
        })
      });

      const result = await response.json();
      
      if (result.success) {
        alert('✅ Connection test successful! IMAP connection verified.');
      } else {
        alert('❌ Connection test failed: ' + (result.error || 'Unable to connect to email server'));
      }
    } catch (error) {
      console.error('Connection test error:', error);
      alert('Connection test failed. Please check your settings.');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const saveAccount = async (formData: AccountFormData): Promise<void> => {
    if (!formData.name || !formData.email || !formData.password) {
      alert('Please fill in all required fields');
      return;
    }

    if (editingAccount) {
      const updatedAccount: Account = {
        ...editingAccount,
        name: formData.name,
        email: formData.email,
        username: formData.username,
        password: formData.password,
        imap: {
          host: formData.imapHost,
          port: parseInt(formData.imapPort),
          security: formData.imapSecurity
        },
        smtp: {
          host: formData.smtpHost,
          port: parseInt(formData.smtpPort),
          security: formData.smtpSecurity
        }
      };

      try {
        const success = await AccountApi.update(editingAccount.id, updatedAccount);
        if (success) {
          const updatedAccounts = appState.accounts.map(acc => 
            acc.id === editingAccount.id ? updatedAccount : acc
          );
          setAppState(prev => ({ ...prev, accounts: updatedAccounts }));
          
          setEditingAccount(undefined);
          setShowAccountModal(false);
        } else {
          alert('Failed to update account');
        }
      } catch (error) {
        console.error('Failed to update account:', error);
        alert('Failed to update account');
      }
    } else {
      const newAccount: Account = {
        id: `account-${Date.now()}`,
        name: formData.name,
        email: formData.email,
        username: formData.username,
        password: formData.password,
        unreadCount: 0,
        color: '#004c60',
        imap: {
          host: formData.imapHost,
          port: parseInt(formData.imapPort),
          security: formData.imapSecurity
        },
        smtp: {
          host: formData.smtpHost,
          port: parseInt(formData.smtpPort),
          security: formData.smtpSecurity
        }
      };

      try {
        const success = await AccountApi.add(newAccount);
        if (success) {
          const updatedAccounts = [...appState.accounts, newAccount];
          setAppState(prev => ({ ...prev, accounts: updatedAccounts }));
          setShowAccountModal(false);
        } else {
          alert('Failed to save account');
        }
      } catch (error) {
        console.error('Failed to save account:', error);
        alert('Failed to save account');
      }
    }
  };

  const openAddAccountModal = (): void => {
    setEditingAccount(undefined);
    setShowAccountModal(true);
  };

  const openEditAccountModal = (account: Account): void => {
    setEditingAccount(account);
    setShowAccountModal(true);
  };

  return {
    showAccountModal,
    setShowAccountModal,
    editingAccount,
    setEditingAccount,
    isTestingConnection,
    testConnection,
    saveAccount,
    openAddAccountModal,
    openEditAccountModal
  };
};