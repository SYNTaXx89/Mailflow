/**
 * Email Operations Hook - Simplified and Clean
 * 
 * This hook provides a clean interface for email operations using the EmailRepository.
 * It removes all race condition complexity and non-IMAP logic.
 * 
 * Key principles:
 * - All accounts are IMAP accounts
 * - Always fetch fresh emails
 * - EmailRepository handles all caching logic
 * - Simple loading states only
 */

import { useState, useEffect } from 'react';
import { Email, Account, ComposerType, ComposerData } from '../types/index';
import { apiConfig } from '../config/api';
import { EmailApi } from '../utils/api';
// ImapApiService removed - frontend uses backend API only

export const useEmailOperations = (accounts: Account[], selectedAccountId: string | null, isAuthenticated: boolean) => {
  const [currentEmails, setCurrentEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [isLoadingEmailContent, setIsLoadingEmailContent] = useState(false);
  const [emailLoadError, setEmailLoadError] = useState<string | null>(null);

  // Use direct API calls instead of EmailRepository

  // Load emails when account changes or on initial load
  useEffect(() => {
    loadEmails();
  }, [selectedAccountId, isAuthenticated, accounts]);

  /**
   * Main email loading function - used for all scenarios
   * (initial load, account switch, manual refresh)
   */
  const loadEmails = async (): Promise<void> => {
    if (!selectedAccountId || !isAuthenticated) {
      console.log('useEmailOperations: Clearing emails - no account selected or not authenticated');
      setCurrentEmails([]);
      setSelectedEmail(null);
      setEmailLoadError(null);
      return;
    }
    
    const account = accounts.find(acc => acc.id === selectedAccountId);
    if (!account) {
      console.log('useEmailOperations: Clearing emails - account not found');
      setCurrentEmails([]);
      setSelectedEmail(null);
      setEmailLoadError(null);
      return;
    }

    setIsLoadingEmails(true);
    setEmailLoadError(null);
    
    try {
      console.log('useEmailOperations: Loading emails for account:', selectedAccountId);
      
      // Fetch emails using the smart API
      const response = await fetch(`${apiConfig.baseUrl}/emails/${account.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mailflow_access_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch emails: ${response.status}`);
      }
      
      const data = await response.json();
      const emails = data.emails || [];
      
      console.log('useEmailOperations: Successfully loaded', emails.length, 'emails');
      setCurrentEmails(emails);
      
      // Clear selected email if it's not in the new list
      if (selectedEmail && !emails.find((e: Email) => e.id === selectedEmail.id)) {
        setSelectedEmail(null);
      }
      
    } catch (error) {
      console.error('useEmailOperations: Failed to load emails:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load emails';
      setEmailLoadError(`Error: ${errorMessage}`);
      setCurrentEmails([]);
    } finally {
      setIsLoadingEmails(false);
    }
  };

  /**
   * Load email content for display
   */
  const loadEmailContent = async (email: Email): Promise<void> => {
    // Set as selected immediately for responsive UI
    setSelectedEmail(email);

    // If email already has content, we're done
    if (email.content) {
      console.log('useEmailOperations: Email already has content:', email.id);
      return;
    }

    const account = accounts.find(acc => acc.id === email.accountId);
    if (!account) {
      console.error('useEmailOperations: Account not found for email:', email.accountId);
      return;
    }

    setIsLoadingEmailContent(true);
    
    try {
      console.log('useEmailOperations: Loading content for email:', email.id);
      
      // Use smart API to get content (handles caching)
      const response = await fetch(`${apiConfig.baseUrl}/emails/${account.id}/${email.id}/content`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mailflow_access_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch email content: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('🔍 API Response data.content:', data.content);
      console.log('🔍 attachmentList:', data.content.attachmentList);
      
      const content = data.content.textContent || data.content.htmlContent || 'No content available';
      
      // Update the email with content and attachments
      const updatedEmail = { 
        ...email, 
        content,
        attachments: data.content.attachmentList || []
      };
      console.log('🔍 Updated email attachments:', updatedEmail.attachments);
      setSelectedEmail(updatedEmail);
      
      // Update the email in the current emails list
      setCurrentEmails(prev => 
        prev.map(e => e.id === email.id ? updatedEmail : e)
      );
      
      console.log('useEmailOperations: Successfully loaded email content');
      
    } catch (error) {
      console.error('useEmailOperations: Failed to load email content:', error);
      const updatedEmail = { ...email, content: 'Failed to load email content. Please try again.' };
      setSelectedEmail(updatedEmail);
    } finally {
      setIsLoadingEmailContent(false);
    }
  };

  /**
   * Manual refresh - same as loadEmails but explicit
   */
  const refreshEmails = async (): Promise<void> => {
    if (isLoadingEmails) {
      console.log('useEmailOperations: Refresh already in progress, skipping');
      return;
    }
    
    console.log('useEmailOperations: Manual refresh triggered');
    await loadEmails();
  };

  /**
   * Handle email reply
   */
  const handleReply = async (email: Email, type: ComposerType = 'reply'): Promise<ComposerData> => {
    let emailContent = email.content;
    
    // If no content, try to load it first
    if (!emailContent && email.id.startsWith('imap-')) {
      const account = accounts.find(acc => acc.id === email.accountId);
      if (account) {
        try {
          const response = await fetch(`${apiConfig.baseUrl}/emails/${account.id}/${email.id}/content`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('mailflow_access_token')}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            emailContent = data.content.textContent || data.content.htmlContent || 'No content available';
          } else {
            emailContent = 'Content unavailable';
          }
        } catch (error) {
          console.error('useEmailOperations: Failed to load email content for reply:', error);
          emailContent = 'Content unavailable';
        }
      }
    }
    
    const subject = email.subject.startsWith('Re: ') ? email.subject : `Re: ${email.subject}`;
    const to = type === 'replyAll' ? `${email.from.email}, original-recipients@example.com` : email.from.email;
    
    return {
      to,
      subject,
      body: `\n\nOn ${email.date.toLocaleDateString()}, ${email.from.name} wrote:\n> ${(emailContent || 'No content').split('\n').join('\n> ')}`,
      attachments: []
    };
  };

  /**
   * Handle email deletion
   */
  const handleDelete = async (email: Email): Promise<boolean> => {
    try {
      const success = await EmailApi.remove(email.id);
      if (success) {
        // Remove from current emails
        setCurrentEmails(prev => prev.filter(e => e.id !== email.id));
        
        // Clear selected email if it was deleted
        if (selectedEmail?.id === email.id) {
          setSelectedEmail(null);
        }
        
        console.log('useEmailOperations: Successfully deleted email:', email.id);
        return true;
      }
      return false;
    } catch (error) {
      console.error('useEmailOperations: Failed to delete email:', error);
      return false;
    }
  };

  /**
   * Send new email via SMTP
   */
  const sendEmail = async (composerData: ComposerData, currentAccount: Account): Promise<boolean> => {
    try {
      console.log('useEmailOperations: Sending email via SMTP:', {
        accountEmail: currentAccount.email,
        to: composerData.to,
        subject: composerData.subject
      });

      // Send email via backend SMTP API
      const token = localStorage.getItem('mailflow_access_token');
      if (!token) {
        console.error('useEmailOperations: No authentication token found');
        return false;
      }

      // Prepare request based on whether there are attachments
      let requestOptions: RequestInit;
      
      if (composerData.attachments && composerData.attachments.length > 0) {
        // Use FormData for multipart/form-data when attachments are present
        const formData = new FormData();
        formData.append('account', JSON.stringify(currentAccount));
        formData.append('emailData', JSON.stringify({
          to: composerData.to,
          subject: composerData.subject,
          body: composerData.body || ''
        }));
        formData.append('password', currentAccount.password || '');
        
        // Add attachments
        for (const attachment of composerData.attachments) {
          formData.append('attachments', attachment.file, attachment.name);
        }
        
        requestOptions = {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        };
      } else {
        // Use JSON for simple emails without attachments
        requestOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            account: currentAccount,
            emailData: {
              to: composerData.to,
              subject: composerData.subject,
              body: composerData.body || ''
            },
            password: currentAccount.password
          })
        };
      }
      
      const response = await fetch(`${apiConfig.baseUrl}/smtp/send`, requestOptions);
      const result = await response.json();
      
      if (result.success) {
        console.log('useEmailOperations: Email sent successfully via SMTP:', result.messageId);
        
        // Create a local record of the sent email for the UI
        const sentEmail: Email = {
          id: result.messageId || `sent-${Date.now()}`,
          accountId: currentAccount.id,
          from: { name: currentAccount.name, email: currentAccount.email },
          subject: composerData.subject,
          date: new Date(),
          isRead: true,
          preview: composerData.body.substring(0, 100),
          content: composerData.body
        };
        
        // Add to local storage for reference
        await EmailApi.add(sentEmail);
        
        // Add to current emails if it's for the selected account
        if (currentAccount.id === selectedAccountId) {
          setCurrentEmails(prev => [sentEmail, ...prev]);
        }
        
        return true;
      } else {
        console.error('useEmailOperations: SMTP sending failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('useEmailOperations: Failed to send email:', error);
      return false;
    }
  };

  return {
    // State
    currentEmails,
    selectedEmail,
    isLoadingEmails,
    isLoadingEmailContent,
    emailLoadError,
    
    // Actions
    setSelectedEmail,
    loadEmailContent,
    refreshEmails,
    handleReply,
    handleDelete,
    sendEmail,
    
    // For debugging
    cacheStats: { totalEmails: currentEmails.length, isLoadingEmails }
  };
};