/**
 * IMAP API Client - Frontend service for communicating with backend IMAP service
 * 
 * This service provides the same interface as the browser IMAP service but
 * makes HTTP requests to the backend API for real IMAP operations.
 */

import { Account, Email, ComposerData } from '../types';
import { apiConfig } from '../config/api';

interface ApiResponse<T> {
  success?: boolean;
  emails?: T[];
  email?: T;
  error?: string;
}

/**
 * HTTP-based Email Service for real email operations (IMAP + SMTP)
 */
export class ImapApiService {
  /**
   * Test account connection via backend API
   */
  static async testAccount(account: Account, password?: string): Promise<boolean> {
    try {
      const accountPassword = password || account.password;
      if (!accountPassword) {
        console.error('No password available for account');
        return false;
      }

      console.log('Testing connection for account:', {
        email: account.email,
        username: account.username,
        imapHost: account.imap?.host,
        imapPort: account.imap?.port,
        hasPassword: !!accountPassword
      });

      const response = await fetch(`${apiConfig.imap}/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ account, password: accountPassword })
      });
      
      console.log('API Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Response error:', errorText);
        return false;
      }
      
      const data: ApiResponse<never> = await response.json();
      console.log('API Response data:', data);
      return data.success || false;
    } catch (error) {
      console.error('API test connection error:', error);
      return false;
    }
  }

  /**
   * Fetch emails from IMAP server via backend API
   */
  static async fetchEmails(account: Account, limit: number = 30): Promise<Email[]> {
    try {
      const password = account.password;
      if (!password) {
        throw new Error('No password available for account');
      }

      const response = await fetch(`${apiConfig.imap}/fetch-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ account, password, limit })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: ApiResponse<Email> = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Convert date strings back to Date objects
      const emails = (data.emails || []).map(email => ({
        ...email,
        date: new Date(email.date)
      }));
      
      return emails;
    } catch (error) {
      console.error('API fetch emails error:', error);
      throw error;
    }
  }

  /**
   * Fetch full email content via backend API
   */
  static async fetchEmailContent(account: Account, emailId: string): Promise<Email | null> {
    try {
      const password = account.password;
      if (!password) {
        throw new Error('No password available for account');
      }

      const response = await fetch(`${apiConfig.imap}/fetch-email-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ account, password, emailId })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: ApiResponse<Email> = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Convert date string back to Date object
      if (data.email) {
        return {
          ...data.email,
          date: new Date(data.email.date)
        };
      }
      
      return null;
    } catch (error) {
      console.error('API fetch email content error:', error);
      throw error;
    }
  }

  /**
   * Send email via SMTP backend API
   */
  static async sendEmail(account: Account, emailData: ComposerData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const password = account.password;
      if (!password) {
        throw new Error('No password available for account');
      }

      console.log('ImapApiService: Sending email via SMTP API:', {
        accountEmail: account.email,
        to: emailData.to,
        subject: emailData.subject,
        hasBody: !!emailData.body
      });

      const response = await fetch(`${apiConfig.smtp}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          account, 
          emailData: {
            to: emailData.to,
            subject: emailData.subject,
            body: emailData.body
          },
          password 
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('SMTP API Response error:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      console.log('ImapApiService: Email sent successfully:', {
        messageId: data.messageId,
        to: emailData.to
      });

      return {
        success: true,
        messageId: data.messageId
      };
    } catch (error) {
      console.error('ImapApiService: Send email error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email'
      };
    }
  }

  /**
   * Test SMTP connection via backend API
   */
  static async testSmtpConnection(account: Account, password?: string): Promise<boolean> {
    try {
      const accountPassword = password || account.password;
      if (!accountPassword) {
        console.error('No password available for SMTP test');
        return false;
      }

      console.log('Testing SMTP connection for account:', account.email);

      const response = await fetch(`${apiConfig.smtp}/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ account, password: accountPassword })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('SMTP test API error:', errorText);
        return false;
      }
      
      const data = await response.json();
      console.log('SMTP test result:', data);
      return data.success || false;
    } catch (error) {
      console.error('SMTP test connection error:', error);
      return false;
    }
  }

  /**
   * Check if API is available
   */
  static async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(apiConfig.health);
      return response.ok;
    } catch (error) {
      console.error('API health check failed:', error);
      return false;
    }
  }
}