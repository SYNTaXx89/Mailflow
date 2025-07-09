/**
 * SMTP Service - Backend Email Sending Service
 * 
 * This service handles actual email sending via SMTP using nodemailer.
 * It follows the same pattern as the IMAP service but for outbound email.
 * 
 * Features:
 * - Account-based SMTP configuration
 * - Secure authentication and TLS support
 * - Comprehensive error handling
 * - Support for HTML and plain text emails
 */

import nodemailer from 'nodemailer';
import { Account } from '../../src/types';

export interface EmailAttachmentData {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface EmailData {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
  attachments?: EmailAttachmentData[];
}

export interface SmtpResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class SmtpService {
  /**
   * Send an email using the account's SMTP configuration
   */
  static async sendEmail(account: Account, emailData: EmailData, password: string): Promise<SmtpResult> {
    try {
      console.log('SmtpService: Sending email for account:', {
        email: account.email,
        smtpHost: account.smtp?.host,
        smtpPort: account.smtp?.port,
        smtpSecurity: account.smtp?.security,
        to: emailData.to,
        subject: emailData.subject
      });

      console.log('SmtpService: Full SMTP config received:', JSON.stringify(account.smtp, null, 2));

      if (!account.smtp || !account.smtp.host) {
        throw new Error('Account missing SMTP configuration');
      }

      if (!password) {
        throw new Error('Password required for SMTP authentication');
      }

      // Create transporter with account SMTP settings
      const isSSL = account.smtp.port === 465 || account.smtp.security === 'SSL';
      
      console.log('SmtpService: SSL Configuration:', {
        port: account.smtp.port,
        securitySetting: account.smtp.security,
        calculatedSSL: isSSL,
        portCheck: account.smtp.port === 465,
        securityCheck: account.smtp.security === 'SSL'
      });
      
      const transporter = nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: isSSL, // true for SSL (port 465), false for STARTTLS (port 587)
        auth: {
          user: account.username || account.email,
          pass: password
        },
        // Connection timeout and additional options
        connectionTimeout: 60000, // 60 seconds
        greetingTimeout: 30000,    // 30 seconds  
        socketTimeout: 60000,      // 60 seconds
        // TLS options
        tls: {
          // Don't fail on invalid certificates (for self-signed certificates)
          rejectUnauthorized: false,
          // Force TLS version
          minVersion: 'TLSv1.2' as any
        },
        // Debug for troubleshooting
        debug: true,
        logger: console
      } as any);

      // Verify SMTP connection
      console.log('SmtpService: Verifying SMTP connection...');
      await transporter.verify();
      console.log('SmtpService: SMTP connection verified successfully');

      // Prepare email content
      // Convert plain text line breaks to HTML
      const htmlBody = this.textToHtml(emailData.body);
      
      const mailOptions: any = {
        from: `"${account.name}" <${account.email}>`,
        to: emailData.to,
        subject: emailData.subject,
        html: htmlBody, // HTML body with proper line breaks
        text: emailData.body, // Plain text original
        replyTo: emailData.replyTo || account.email
      };

      // Add attachments if provided
      if (emailData.attachments && emailData.attachments.length > 0) {
        mailOptions.attachments = emailData.attachments.map(attachment => ({
          filename: attachment.filename,
          content: attachment.content,
          contentType: attachment.contentType
        }));
        
        console.log('SmtpService: Adding attachments to email:', {
          attachmentCount: emailData.attachments.length,
          attachments: emailData.attachments.map(att => ({
            filename: att.filename,
            size: att.content.length,
            contentType: att.contentType
          }))
        });
      }

      console.log('SmtpService: Sending email with options:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        hasHtml: !!mailOptions.html,
        hasText: !!mailOptions.text
      });

      // Send email
      const info = await transporter.sendMail(mailOptions);
      
      console.log('SmtpService: Email sent successfully:', {
        messageId: info.messageId,
        response: info.response
      });

      return {
        success: true,
        messageId: info.messageId
      };

    } catch (error) {
      console.error('SmtpService: Failed to send email:', error);
      
      let errorMessage = 'Failed to send email';
      
      if (error instanceof Error) {
        // Map common SMTP errors to user-friendly messages
        if (error.message.includes('Invalid login')) {
          errorMessage = 'Invalid email credentials. Please check your password.';
        } else if (error.message.includes('authentication failed')) {
          errorMessage = 'Email authentication failed. Please verify your credentials.';
        } else if (error.message.includes('ECONNREFUSED')) {
          errorMessage = 'Cannot connect to email server. Please check your SMTP settings.';
        } else if (error.message.includes('ENOTFOUND')) {
          errorMessage = 'Email server not found. Please check your SMTP host.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Connection timeout. Please try again.';
        } else {
          errorMessage = error.message;
        }
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Test SMTP connection without sending an email
   */
  static async testConnection(account: Account, password: string): Promise<SmtpResult> {
    try {
      console.log('SmtpService: Testing SMTP connection for account:', account.email);

      if (!account.smtp || !account.smtp.host) {
        throw new Error('Account missing SMTP configuration');
      }

      if (!password) {
        throw new Error('Password required for SMTP test');
      }

      const isSSL = account.smtp.port === 465 || account.smtp.security === 'SSL';
      const transporter = nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: isSSL,
        auth: {
          user: account.username || account.email,
          pass: password
        },
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
        tls: {
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2' as any
        },
        debug: true,
        logger: console
      } as any);

      // Verify connection
      await transporter.verify();
      
      console.log('SmtpService: SMTP connection test successful');
      return { success: true };

    } catch (error) {
      console.error('SmtpService: SMTP connection test failed:', error);
      
      let errorMessage = 'SMTP connection test failed';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Convert plain text to HTML (preserve line breaks and basic formatting)
   */
  private static textToHtml(text: string): string {
    if (!text) return '';
    
    return text
      // Escape HTML characters first
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      // Convert line breaks to <br> tags
      .replace(/\r?\n/g, '<br>')
      // Convert multiple spaces to non-breaking spaces (preserve formatting)
      .replace(/  /g, ' &nbsp;')
      // Wrap in a div for better rendering
      .replace(/^(.*)$/, '<div>$1</div>');
  }

  /**
   * Convert HTML to plain text (simple implementation)
   */
  private static htmlToText(html: string): string {
    if (!html) return '';
    
    return html
      // Convert <br> to newlines (before removing tags)
      .replace(/<br\s*\/?>/gi, '\n')
      // Remove HTML tags
      .replace(/<[^>]*>/g, '')
      // Convert HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get common SMTP settings for popular providers
   */
  static getSmtpSettings(email: string): { host: string; port: number; security: string } | null {
    const domain = email.split('@')[1]?.toLowerCase();
    
    const providers: Record<string, { host: string; port: number; security: string }> = {
      'gmail.com': { host: 'smtp.gmail.com', port: 587, security: 'STARTTLS' },
      'outlook.com': { host: 'smtp-mail.outlook.com', port: 587, security: 'STARTTLS' },
      'hotmail.com': { host: 'smtp-mail.outlook.com', port: 587, security: 'STARTTLS' },
      'yahoo.com': { host: 'smtp.mail.yahoo.com', port: 587, security: 'STARTTLS' },
      'icloud.com': { host: 'smtp.mail.me.com', port: 587, security: 'STARTTLS' }
    };

    return providers[domain] || null;
  }
}