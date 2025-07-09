/**
 * Main Email Interface Component
 * 
 * Restored comprehensive email client interface integrating:
 * - Account management separate from admin authentication
 * - Real email account state and CRUD operations
 * - Full integration of Sidebar, EmailView, and modal components
 * - Backend API connectivity for accounts, emails, and settings
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GrainTexture, Sidebar, EmailView, AddAccountModal, SettingsModal, EmailComposer } from './index';
import { useJWTAuth } from '../hooks/useJWTAuth';
import { Account, Email, AppState, ComposerData, ComposerType, NewAccountData } from '../types';
import { AccountApi, SettingsApi } from '../utils/api';
import { AppStateStorage } from '../utils/storage';
import { apiConfig } from '../config/api';

interface MainEmailInterfaceProps {
  // No props needed - removed welcome navigation
}

const MainEmailInterface: React.FC<MainEmailInterfaceProps> = () => {
  const auth = useJWTAuth();
  
  // Main application state (separate from admin authentication)
  const [appState, setAppState] = useState<AppState>({
    isSetup: true, // Already handled by JWT setup
    isAuthenticated: true, // Already handled by JWT auth
    currentView: 'main',
    selectedAccount: null,
    accounts: [],
    settings: {
      theme: 'dark',
      emailsPerPage: 50,
      autoRefresh: 5
    },
    setupData: { password: '', confirmPassword: '' },
    loginPassword: ''
  });

  // Email and UI state
  const [currentEmails, setCurrentEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [emailLoadError, setEmailLoadError] = useState<string | null>(null);
  const [isLoadingEmailContent, setIsLoadingEmailContent] = useState(false);

  // IDLE connection state
  const [idleConnections, setIdleConnections] = useState<Map<string, any>>(new Map());
  const [idleStatus, setIdleStatus] = useState<Map<string, any>>(new Map());
  
  // Real-time update polling
  const [realtimePolling, setRealtimePolling] = useState<NodeJS.Timeout | null>(null);
  const emailCountRef = useRef<number>(0);

  // Modal states
  const [showSettings, setShowSettings] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  
  // Account management state
  const [editingAccount, setEditingAccount] = useState<any>(null); // Account being edited, null for new account
  const [newAccountData, setNewAccountData] = useState<NewAccountData>({
    name: '',
    email: '',
    username: '',
    password: '',
    imapHost: '',
    imapPort: '993',
    imapSecurity: 'SSL/TLS',
    smtpHost: '',
    smtpPort: '587',
    smtpSecurity: 'STARTTLS'
  });
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Email composer state  
  const [composerType, setComposerType] = useState<ComposerType>('new');
  const [composerData, setComposerData] = useState<ComposerData>({
    to: '',
    subject: '',
    body: '',
    attachments: []
  });
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);

  /**
   * Load application state and accounts on mount
   */
  useEffect(() => {
    const loadAppState = async () => {
      try {
        // Load persisted app state
        const savedState = AppStateStorage.load();
        
        // Load accounts from backend
        const accounts = await AccountApi.load();
        
        // Load settings from backend
        const settings = await SettingsApi.load();
        
        setAppState(prev => ({
          ...prev,
          ...savedState,
          accounts,
          settings
        }));
        
        // Auto-select first account if none selected
        if (!savedState.selectedAccount && accounts.length > 0) {
          const firstAccount = accounts[0].id;
          const newState = { ...appState, ...savedState, accounts, settings, selectedAccount: firstAccount };
          setAppState(newState);
          AppStateStorage.save(newState);
        }
        
        // Start IDLE connections for all accounts
        console.log(`🔄 Starting IDLE connections for ${accounts.length} accounts...`);
        for (const account of accounts) {
          try {
            await startIdleConnection(account.id);
          } catch (error) {
            console.warn(`⚠️ Failed to start IDLE for account ${account.id}:`, error);
          }
        }
        
        // Start real-time email checking as backup
        console.log('🔄 URGENT: About to start real-time email checking...');
        startRealtimeEmailChecking();
        console.log('✅ URGENT: Real-time email checking started!');
      } catch (error) {
        console.error('Failed to load app state:', error);
      }
    };

    loadAppState();
  }, []);

  /**
   * Cleanup IDLE connections on unmount
   */
  useEffect(() => {
    return () => {
      console.log('🛑 Component unmounting - cleaning up all connections');
      
      // Stop real-time polling
      stopRealtimeEmailChecking();
      
      // Stop all IDLE connections
      for (const accountId of idleConnections.keys()) {
        stopIdleConnection(accountId).catch(error => {
          console.warn(`⚠️ Error stopping IDLE for account ${accountId} during cleanup:`, error);
        });
      }
    };
  }, [idleConnections, realtimePolling]);

  /**
   * Load emails when selected account changes (using cache-first strategy)
   */
  useEffect(() => {
    console.log('🔍 DEBUG: useEffect triggered - selectedAccount:', appState.selectedAccount, 'auth.isAuthenticated:', auth.isAuthenticated, 'appState.isAuthenticated:', appState.isAuthenticated);
    if (appState.selectedAccount) {
      console.log('🔄 Account changed - loading emails with cache-first strategy');
      if (auth.isAuthenticated) {
        console.log('🔍 DEBUG: About to call loadEmailsForAccount');
        loadEmailsForAccount(appState.selectedAccount, false); // Use cache-first
      } else {
        console.log('🔍 DEBUG: Not authenticated, skipping email load');
      }
    } else {
      console.log('🔍 DEBUG: No selected account, clearing emails');
      setCurrentEmails([]);
      setSelectedEmail(null);
    }
  }, [appState.selectedAccount, auth.isAuthenticated]);

  /**
   * ⚡ Load emails using smart API (cache-first with background refresh)
   */
  const loadEmailsForAccount = async (accountId: string, forceRefresh: boolean = false) => {
    setIsLoadingEmails(true);
    setEmailLoadError(null);
    
    try {
      console.log(`📧 Loading emails for account: ${accountId} (Force refresh: ${forceRefresh})`);
      
      const token = localStorage.getItem('mailflow_access_token');
      const queryParams = new URLSearchParams({
        limit: '30',
        ...(forceRefresh && { forceRefresh: 'true' })
      });
      
      const url = `${apiConfig.baseUrl}/emails/${accountId}?${queryParams}`;
      console.log('🔍 DEBUG: Fetching from URL:', url);
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('⏰ Request timeout after 15 seconds');
        controller.abort();
      }, 15000); // 15 second timeout (reasonable for email loading)
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log('🔍 DEBUG: Response status:', response.status, 'ok:', response.ok);

      if (response.ok) {
        const result = await response.json();
        const { emails, source, metadata } = result;
        
        console.log(`✅ Smart API response - Count: ${emails?.length || 0}, Source: ${source}`);
        console.log(`📊 Metadata:`, metadata);
        
        if (emails && emails.length > 0) {
          // Convert date strings back to Date objects
          const processedEmails = emails.map((email: any) => ({
            ...email,
            date: new Date(email.date)
          }));
          
          console.log('🔍 DEBUG: About to set', processedEmails.length, 'emails to state');
          console.log('🔍 DEBUG: First email:', processedEmails[0]);
          setCurrentEmails(processedEmails);
          
          // User feedback based on source
          if (source === 'cache' && metadata.isRefreshing) {
            console.log('💡 Showing cached emails, refreshing in background...');
          } else if (source === 'cache') {
            console.log('⚡ Lightning fast: Served from cache');
          } else if (source === 'imap') {
            console.log('🔄 Fresh data: Fetched from email server');
          } else if (source === 'hybrid') {
            console.log('🚀 Hybrid: Cache + background refresh');
          }
        } else {
          console.log('📭 No emails found - emails:', emails);
          setCurrentEmails([]);
        }
      } else {
        const errorResult = await response.json();
        console.error('❌ Smart API error:', errorResult);
        setEmailLoadError(errorResult.error || 'Failed to load emails');
      }
      
      // Clear selected email if it's not in the new list
      if (selectedEmail && !currentEmails.find(e => e.id === selectedEmail.id)) {
        setSelectedEmail(null);
      }
      
    } catch (error) {
      console.error('❌ Failed to load emails:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        setEmailLoadError('Request timeout - the server is taking too long to respond');
      } else {
        setEmailLoadError(error instanceof Error ? error.message : 'Failed to load emails');
      }
      setCurrentEmails([]); // Clear emails on error
    } finally {
      console.log('🔍 DEBUG: Setting isLoadingEmails to false');
      setIsLoadingEmails(false);
    }
  };

  /**
   * Refresh emails for current account (IDLE-aware refresh)
   */
  const refreshEmails = useCallback(async () => {
    if (appState.selectedAccount) {
      console.log('🔄 User refresh triggered - checking IDLE connection');
      
      // Check if we have an active IDLE connection
      const hasIdleConnection = idleConnections.has(appState.selectedAccount);
      
      if (hasIdleConnection) {
        console.log('📡 Using IDLE-aware refresh');
        await refreshDuringIdle(appState.selectedAccount);
      } else {
        console.log('🔄 No IDLE connection - using regular refresh');
        await loadEmailsForAccount(appState.selectedAccount, true); // forceRefresh = true
      }
    }
  }, [appState.selectedAccount, idleConnections]);

  /**
   * Soft refresh (use cache-first strategy)
   */
  const softRefreshEmails = useCallback(async () => {
    if (appState.selectedAccount) {
      console.log('⚡ Soft refresh - cache-first strategy');
      await loadEmailsForAccount(appState.selectedAccount, false); // forceRefresh = false
    }
  }, [appState.selectedAccount]);

  /**
   * ⚡ Load email content using smart API (cache-first)
   */
  const loadEmailContent = async (email: Email) => {
    setIsLoadingEmailContent(true);
    
    try {
      console.log('📄 Loading email content:', email.subject);
      
      const token = localStorage.getItem('mailflow_access_token');
      
      const response = await fetch(`${apiConfig.baseUrl}/emails/${email.accountId}/${email.id}/content`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Email content loaded, source: ${result.source}, time: ${result.fetchTime}ms`);
        
        if (result.content) {
          // Update the selected email with the full content
          // Prefer HTML content for better rendering, fall back to text
          const content = result.content.htmlContent || result.content.textContent || 'No content';
          
          console.log('📄 Content type analysis:', {
            source: result.source,
            hasHtml: !!result.content.htmlContent,
            hasText: !!result.content.textContent,
            htmlLength: result.content.htmlContent?.length || 0,
            textLength: result.content.textContent?.length || 0,
            usingHtml: !!result.content.htmlContent,
            contentPreview: content.substring(0, 100) + '...',
            attachmentCount: result.content.attachmentList?.length || 0
          });
          setSelectedEmail(prev => prev ? {
            ...prev,
            content: content,
            attachments: result.content.attachmentList || [],
            hasAttachments: (result.content.attachmentList && result.content.attachmentList.length > 0) || prev.hasAttachments
          } : null);
        }
      } else {
        const errorResult = await response.json();
        console.error('❌ Email content fetch failed:', errorResult);
      }
    } catch (error) {
      console.error('❌ Failed to load email content:', error);
    } finally {
      setIsLoadingEmailContent(false);
    }
  };

  /**
   * Handle email composition
   */
  const handleNewEmail = () => {
    setComposerType('new');
    setComposerData({ to: '', subject: '', body: '', attachments: [] });
    setEmailSentSuccess(false); // Reset success state
    setShowComposer(true);
  };

  const handleReply = async (email: Email, type: ComposerType = 'reply') => {
    setComposerType(type);
    setComposerData({
      to: type === 'replyAll' ? `${email.from.email}, ...` : email.from.email,
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body: `\n\n--- Original Message ---\nFrom: ${email.from.name} <${email.from.email}>\nDate: ${email.date.toLocaleString()}\nSubject: ${email.subject}\n\n${email.content}`,
      attachments: []
    });
    setEmailSentSuccess(false); // Reset success state
    setShowComposer(true);
  };

  const sendEmail = async () => {
    if (isSendingEmail) return; // Prevent double-sending
    
    if (!appState.selectedAccount) {
      alert('❌ No account selected');
      return;
    }

    // Find the selected account details
    const selectedAccount = appState.accounts.find(acc => acc.id === appState.selectedAccount);
    if (!selectedAccount) {
      alert('❌ Account not found');
      return;
    }

    // Validate email data
    if (!composerData.to.trim()) {
      alert('❌ Please enter a recipient email address');
      return;
    }

    if (!composerData.subject.trim()) {
      alert('❌ Please enter a subject');
      return;
    }

    setIsSendingEmail(true);
    try {
      console.log('📧 Sending email via SMTP...', {
        from: selectedAccount.email,
        to: composerData.to,
        subject: composerData.subject
      });

      const token = localStorage.getItem('mailflow_access_token');
      console.log('🔑 Using JWT token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN FOUND');
      
      if (!token) {
        alert('❌ Not authenticated. Please refresh the page and ensure you are logged in.');
        return;
      }
      // Prepare request based on whether there are attachments
      let requestOptions: RequestInit;
      
      if (composerData.attachments && composerData.attachments.length > 0) {
        // Use FormData for multipart/form-data when attachments are present
        const formData = new FormData();
        formData.append('account', JSON.stringify(selectedAccount));
        formData.append('emailData', JSON.stringify({
          to: composerData.to,
          subject: composerData.subject,
          body: composerData.body || ''
        }));
        formData.append('password', selectedAccount.password);
        
        // Add attachments
        for (const attachment of composerData.attachments) {
          formData.append('attachments', attachment.file, attachment.name);
        }
        
        requestOptions = {
          method: 'POST',
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: formData
        };
      } else {
        // Use JSON for simple emails without attachments
        requestOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            account: selectedAccount,
            emailData: {
              to: composerData.to,
              subject: composerData.subject,
              body: composerData.body || ''
            },
            password: selectedAccount.password
          })
        };
      }
      
      const response = await fetch(`${apiConfig.baseUrl}/smtp/send`, requestOptions);

      const result = await response.json();

      if (result.success) {
        console.log('✅ Email sent successfully:', result.messageId);
        
        // Show success checkmark
        setEmailSentSuccess(true);
        
        // Auto-close modal after 1.5 seconds
        setTimeout(() => {
          setShowComposer(false);
          setEmailSentSuccess(false);
          
          // Reset composer data
          setComposerData({ to: '', subject: '', body: '', attachments: [] });
        }, 1500);
      } else {
        console.error('❌ Email sending failed:', result.error);
        alert(`❌ Failed to send email: ${result.error}`);
      }

    } catch (error) {
      console.error('❌ Email sending error:', error);
      alert(`❌ Failed to send email: ${error instanceof Error ? error.message : 'Network error'}`);
    } finally {
      setIsSendingEmail(false);
    }
  };


  /**
   * ⚡ Delete email using smart API (IMAP + cache)
   */
  const handleDelete = async (email: Email) => {
    if (confirm('Are you sure you want to delete this email?')) {
      try {
        console.log('🗑️ Deleting email:', email.subject);
        
        const token = localStorage.getItem('mailflow_access_token');
        const response = await fetch(`${apiConfig.baseUrl}/emails/${email.accountId}/${email.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });

        if (response.ok) {
          console.log('✅ Email deleted successfully');
          // Remove from local state immediately (optimistic update)
          setCurrentEmails(prev => prev.filter(e => e.id !== email.id));
          if (selectedEmail?.id === email.id) {
            setSelectedEmail(null);
          }
        } else {
          const errorResult = await response.json();
          console.error('❌ Delete failed:', errorResult);
          alert('Failed to delete email: ' + errorResult.error);
        }
      } catch (error) {
        console.error('❌ Delete error:', error);
        alert('Failed to delete email');
      }
    }
  };

  /**
   * ⚡ Mark email as read using smart API (IMAP + cache)
   */
  const markEmailAsRead = async (email: Email) => {
    if (email.isRead) return; // Already read
    
    try {
      console.log('📖 Marking email as read:', email.subject);
      
      const token = localStorage.getItem('mailflow_access_token');
      const response = await fetch(`${apiConfig.baseUrl}/emails/${email.accountId}/${email.id}/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (response.ok) {
        console.log('✅ Email marked as read');
        // Update local state immediately (optimistic update)
        setCurrentEmails(prev => prev.map(e => 
          e.id === email.id ? { ...e, isRead: true } : e
        ));
      } else {
        const errorResult = await response.json();
        console.error('❌ Mark as read failed:', errorResult);
      }
    } catch (error) {
      console.error('❌ Mark as read error:', error);
    }
  };

  // ============================================================================
  // IDLE CONNECTION MANAGEMENT
  // ============================================================================

  /**
   * Start IDLE connection for an account
   */
  const startIdleConnection = async (accountId: string) => {
    try {
      console.log(`🔄 Starting IDLE connection for account: ${accountId}`);
      
      const token = localStorage.getItem('mailflow_access_token');
      const response = await fetch(`${apiConfig.baseUrl}/idle/${accountId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ IDLE connection started for account: ${accountId}`, result.status);
        
        // Update local state
        setIdleConnections(prev => {
          const newMap = new Map(prev);
          newMap.set(accountId, { connected: true, startedAt: new Date() });
          return newMap;
        });
        
        setIdleStatus(prev => {
          const newMap = new Map(prev);
          newMap.set(accountId, result.status);
          return newMap;
        });
      } else {
        const errorResult = await response.json();
        console.error(`❌ Failed to start IDLE for account ${accountId}:`, errorResult);
      }
    } catch (error) {
      console.error(`❌ Error starting IDLE connection for account ${accountId}:`, error);
    }
  };

  /**
   * Stop IDLE connection for an account
   */
  const stopIdleConnection = async (accountId: string) => {
    try {
      console.log(`🛑 Stopping IDLE connection for account: ${accountId}`);
      
      const token = localStorage.getItem('mailflow_access_token');
      const response = await fetch(`${apiConfig.baseUrl}/idle/${accountId}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (response.ok) {
        console.log(`✅ IDLE connection stopped for account: ${accountId}`);
        
        // Update local state
        setIdleConnections(prev => {
          const newMap = new Map(prev);
          newMap.delete(accountId);
          return newMap;
        });
        
        setIdleStatus(prev => {
          const newMap = new Map(prev);
          newMap.delete(accountId);
          return newMap;
        });
      } else {
        const errorResult = await response.json();
        console.error(`❌ Failed to stop IDLE for account ${accountId}:`, errorResult);
      }
    } catch (error) {
      console.error(`❌ Error stopping IDLE connection for account ${accountId}:`, error);
    }
  };


  /**
   * Refresh during IDLE connection
   */
  const refreshDuringIdle = async (accountId: string) => {
    try {
      console.log(`🔄 Manual refresh during IDLE for account: ${accountId}`);
      
      const token = localStorage.getItem('mailflow_access_token');
      const response = await fetch(`${apiConfig.baseUrl}/idle/${accountId}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (response.ok) {
        console.log(`✅ Manual refresh completed for account: ${accountId}`);
        // Reload emails to show any new content
        await loadEmailsForAccount(accountId, false);
      } else {
        const errorResult = await response.json();
        console.error(`❌ Manual refresh failed for account ${accountId}:`, errorResult);
      }
    } catch (error) {
      console.error(`❌ Error during manual refresh for account ${accountId}:`, error);
    }
  };

  /**
   * Start real-time email checking (supplements IDLE)
   */
  const startRealtimeEmailChecking = () => {
    console.log('🔄 URGENT: startRealtimeEmailChecking function called!');
    
    if (realtimePolling) {
      console.log('🔄 URGENT: Clearing existing polling interval');
      clearInterval(realtimePolling);
    }

    console.log('🔄 URGENT: Setting up 5-second polling interval...');
    
    const interval = setInterval(async () => {
      if (appState.selectedAccount) {
        try {
          // Only do a soft refresh to get new emails without disrupting UI
          // Use ref to get current count and avoid closure issues
          emailCountRef.current = currentEmails.length;
          const emailCountBefore = emailCountRef.current;
          console.log(`🔄 URGENT: Frontend polling check - emails in state: ${emailCountBefore}`);
          console.log(`🔄 URGENT: Selected account: ${appState.selectedAccount}`);
          
          console.log(`🔍 URGENT: About to call loadEmailsForAccount for ${appState.selectedAccount}`);
          await loadEmailsForAccount(appState.selectedAccount, false);
          console.log(`🔍 URGENT: loadEmailsForAccount completed, emails now: ${currentEmails.length}`);
          
          // Check immediately using state callback to avoid closure issues
          setCurrentEmails(currentEmailsState => {
            const emailCountAfter = currentEmailsState.length;
            console.log(`🔍 URGENT: State callback - Before: ${emailCountBefore}, After: ${emailCountAfter}`);
            if (emailCountAfter > emailCountBefore) {
              console.log(`🎉🎉🎉 FRONTEND SUCCESS: Detected ${emailCountAfter - emailCountBefore} new emails via polling!`);
            } else {
              console.log(`❌ Frontend: No new emails detected in this poll cycle`);
            }
            return currentEmailsState; // Don't modify, just observe
          });
        } catch (error) {
          console.warn('⚠️ Real-time email check failed:', error);
        }
      }
    }, 5000); // 5 seconds - much more responsive!

    console.log('✅ URGENT: Polling interval created, setting in state...');
    setRealtimePolling(interval);
    console.log('✅ URGENT: Polling interval stored in state!');
  };

  /**
   * Stop real-time email checking
   */
  const stopRealtimeEmailChecking = () => {
    if (realtimePolling) {
      console.log('🛑 Stopping real-time email checking');
      clearInterval(realtimePolling);
      setRealtimePolling(null);
    }
  };

  // ============================================================================
  // ACCOUNT MANAGEMENT
  // ============================================================================

  /**
   * Account management functions
   */
  const testConnection = async () => {
    setIsTestingConnection(true);
    try {
      // Build account object for testing
      const testAccount = {
        email: newAccountData.email,
        username: newAccountData.username || newAccountData.email,
        imap: {
          host: newAccountData.imapHost,
          port: parseInt(newAccountData.imapPort),
          security: newAccountData.imapSecurity
        },
        smtp: {
          host: newAccountData.smtpHost,
          port: parseInt(newAccountData.smtpPort),
          security: newAccountData.smtpSecurity
        }
      };

      // Test IMAP connection
      const token = localStorage.getItem('mailflow_access_token');
      const response = await fetch(`${apiConfig.baseUrl}/imap/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          account: testAccount,
          password: newAccountData.password
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
      alert('❌ Connection test failed: ' + (error instanceof Error ? error.message : 'Network error'));
    } finally {
      setIsTestingConnection(false);
    }
  };

  const saveAccount = async () => {
    try {
      let success = false;
      
      if (editingAccount) {
        // Edit mode - update existing account
        const updatedAccount = {
          name: newAccountData.name,
          email: newAccountData.email,
          username: newAccountData.username || newAccountData.email,
          password: newAccountData.password,
          imap: {
            host: newAccountData.imapHost,
            port: parseInt(newAccountData.imapPort),
            security: newAccountData.imapSecurity
          },
          smtp: {
            host: newAccountData.smtpHost,
            port: parseInt(newAccountData.smtpPort),
            security: newAccountData.smtpSecurity
          }
        };
        
        success = await AccountApi.update(editingAccount.id, updatedAccount);
      } else {
        // Add mode - create new account
        const newAccount: Account = {
          id: Date.now().toString(),
          name: newAccountData.name,
          email: newAccountData.email,
          username: newAccountData.username || newAccountData.email,
          password: newAccountData.password,
          unreadCount: 0,
          color: '#' + Math.floor(Math.random()*16777215).toString(16),
          imap: {
            host: newAccountData.imapHost,
            port: parseInt(newAccountData.imapPort),
            security: newAccountData.imapSecurity
          },
          smtp: {
            host: newAccountData.smtpHost,
            port: parseInt(newAccountData.smtpPort),
            security: newAccountData.smtpSecurity
          }
        };
        
        success = await AccountApi.add(newAccount);
      }
      
      if (success) {
        // Reload accounts
        const accounts = await AccountApi.load();
        const newState = { ...appState, accounts };
        setAppState(newState);
        AppStateStorage.save(newState);
        
        setShowAddAccount(false);
        setEditingAccount(null);
        // Reset form
        setNewAccountData({
          name: '', email: '', username: '', password: '',
          imapHost: '', imapPort: '993', imapSecurity: 'SSL/TLS',
          smtpHost: '', smtpPort: '587', smtpSecurity: 'STARTTLS'
        });
      } else {
        alert(editingAccount ? 'Failed to update account' : 'Failed to add account');
      }
    } catch (error) {
      console.error('Failed to save account:', error);
      alert('Failed to save account: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const autoDetectSettings = (email: string) => {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return;
    
    const providers: Record<string, any> = {
      'gmail.com': {
        imapHost: 'imap.gmail.com', imapPort: '993', imapSecurity: 'SSL/TLS',
        smtpHost: 'smtp.gmail.com', smtpPort: '587', smtpSecurity: 'STARTTLS'
      },
      'outlook.com': {
        imapHost: 'outlook.office365.com', imapPort: '993', imapSecurity: 'SSL/TLS',
        smtpHost: 'smtp.office365.com', smtpPort: '587', smtpSecurity: 'STARTTLS'
      },
      'yahoo.com': {
        imapHost: 'imap.mail.yahoo.com', imapPort: '993', imapSecurity: 'SSL/TLS',
        smtpHost: 'smtp.mail.yahoo.com', smtpPort: '587', smtpSecurity: 'STARTTLS'
      },
      'icloud.com': {
        imapHost: 'imap.mail.me.com', imapPort: '993', imapSecurity: 'SSL/TLS',
        smtpHost: 'smtp.mail.me.com', smtpPort: '587', smtpSecurity: 'STARTTLS'
      }
    };
    
    const settings = providers[domain];
    if (settings) {
      setNewAccountData(prev => ({ ...prev, ...settings }));
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="h-screen relative flex overflow-hidden" style={{ backgroundColor: '#111111' }}>
      <GrainTexture />
      
      {/* Sidebar */}
      <Sidebar
        appState={appState}
        setAppState={setAppState}
        currentEmails={currentEmails}
        selectedEmail={selectedEmail}
        setSelectedEmail={setSelectedEmail}
        setShowSettings={setShowSettings}
        formatDate={formatDate}
        isLoadingEmails={isLoadingEmails}
        emailLoadError={emailLoadError}
        loadEmailContent={loadEmailContent}
        isLoadingEmailContent={isLoadingEmailContent}
        refreshEmails={refreshEmails}
        softRefreshEmails={softRefreshEmails}
        idleStatus={idleStatus}
        idleConnections={idleConnections}
        markEmailAsRead={markEmailAsRead}
        onNewEmail={handleNewEmail}
      />

      {/* Main Email Content */}
      <EmailView
        selectedEmail={selectedEmail}
        formatDate={formatDate}
        handleReply={handleReply}
        handleDelete={handleDelete}
        isLoadingEmailContent={isLoadingEmailContent}
      />

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          appState={appState}
          auth={auth}
          onAddAccount={() => {
            // Reset editing state and form for new account
            setEditingAccount(null);
            setNewAccountData({
              name: '', email: '', username: '', password: '',
              imapHost: '', imapPort: '993', imapSecurity: 'SSL/TLS',
              smtpHost: '', smtpPort: '587', smtpSecurity: 'STARTTLS'
            });
            setShowSettings(false);
            setShowAddAccount(true);
          }}
          onEditAccount={(account) => {
            // Set up edit mode
            setEditingAccount(account);
            setNewAccountData({
              name: account.name,
              email: account.email,
              username: account.username || account.email,
              password: account.password || '',
              imapHost: account.imap?.host || '',
              imapPort: account.imap?.port?.toString() || '993',
              imapSecurity: account.imap?.security || 'SSL/TLS',
              smtpHost: account.smtp?.host || '',
              smtpPort: account.smtp?.port?.toString() || '587',
              smtpSecurity: account.smtp?.security || 'STARTTLS'
            });
            setShowSettings(false);
            setShowAddAccount(true);
          }}
        />
      )}

      {/* Add Account Modal */}
      {showAddAccount && (
        <AddAccountModal
          showAddAccount={showAddAccount}
          setShowAddAccount={setShowAddAccount}
          newAccountData={newAccountData}
          setNewAccountData={setNewAccountData}
          isTestingConnection={isTestingConnection}
          testConnection={testConnection}
          saveAccount={saveAccount}
          autoDetectSettings={autoDetectSettings}
          editingAccount={editingAccount}
        />
      )}

      {/* Email Composer Modal */}
      {showComposer && (
        <EmailComposer
          showComposer={showComposer}
          setShowComposer={(show) => {
            setShowComposer(show);
            if (!show) {
              setEmailSentSuccess(false); // Reset success state when manually closing
            }
          }}
          composerType={composerType}
          composerData={composerData}
          setComposerData={setComposerData}
          sendEmail={sendEmail}
          isSendingEmail={isSendingEmail}
          emailSentSuccess={emailSentSuccess}
        />
      )}
    </div>
  );
};

export default MainEmailInterface;