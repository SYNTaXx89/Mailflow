/**
 * Browser-Compatible IMAP Integration
 * 
 * Since native IMAP libraries require Node.js modules that don't work in browsers,
 * this module provides a browser-compatible interface for IMAP operations.
 * 
 * For now, it simulates IMAP functionality but can be extended to work with:
 * - A backend proxy server
 * - Browser-compatible email APIs (Gmail API, Outlook Graph API, etc.)
 * - WebSocket connections to an IMAP bridge
 */

import { Account, Email, EmailFrom } from '../types';

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

/**
 * Browser-compatible IMAP Service
 */
export class BrowserImapService {
  /**
   * Test account connection
   * Simulates real IMAP connection test
   */
  static async testAccount(account: Account): Promise<boolean> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Validate account configuration
    if (!account.imap || !account.email || !account.imap.host) {
      return false;
    }
    
    // For demo purposes, accept any valid-looking configuration
    const validHosts = [
      'imap.gmail.com',
      'outlook.office365.com', 
      'imap.mail.yahoo.com',
      'imap.mail.me.com',
      'imap.aol.com'
    ];
    
    return validHosts.some(host => account.imap!.host.includes(host)) || 
           account.imap.host.includes('imap');
  }

  /**
   * Fetch emails for account
   * Generates realistic test emails based on account type
   */
  static async fetchEmails(account: Account, limit: number = 30): Promise<Email[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (!account.imap) {
      throw new Error('Account missing IMAP configuration');
    }
    
    // Generate realistic emails based on account type
    const emails: Email[] = [];
    const baseDate = new Date();
    
    // Create sample emails that look realistic for the account
    const emailTemplates = this.getEmailTemplatesForAccount(account);
    
    for (let i = 0; i < Math.min(limit, emailTemplates.length); i++) {
      const template = emailTemplates[i];
      const emailDate = new Date(baseDate.getTime() - (i * 2 * 60 * 60 * 1000)); // 2 hours apart
      
      emails.push({
        id: `imap-${Date.now()}-${i}`,
        accountId: account.id,
        from: template.from,
        subject: template.subject,
        date: emailDate,
        isRead: Math.random() > 0.3, // 70% chance of being read
        preview: template.preview,
        content: template.content
      });
    }
    
    return emails;
  }

  /**
   * Fetch full email content
   */
  static async fetchEmailContent(account: Account, emailId: string): Promise<Email | null> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // In a real implementation, this would fetch the full email body
    // For now, return a more detailed version of existing content
    const uid = emailId.replace('imap-', '');
    
    return {
      id: emailId,
      accountId: account.id,
      from: { name: 'Email Sender', email: 'sender@example.com' },
      subject: 'Sample Email Subject',
      date: new Date(),
      isRead: true,
      preview: 'This is a preview of the email content...',
      content: `This is the full content of email ${uid}.\n\nIt includes multiple paragraphs and more detailed information that wasn't available in the preview.\n\nBest regards,\nSender`
    };
  }

  /**
   * Generate realistic email templates based on account type
   */
  private static getEmailTemplatesForAccount(account: Account): Array<{
    from: EmailFrom;
    subject: string;
    preview: string;
    content: string;
  }> {
    const isWorkAccount = account.name.toLowerCase().includes('work') || 
                         account.email.includes('@company');
    
    const isPersonalAccount = account.email.includes('gmail.com') || 
                             account.email.includes('yahoo.com') ||
                             account.email.includes('icloud.com') ||
                             account.email.includes('hotmail.com') ||
                             account.email.includes('outlook.com') ||
                             account.name.toLowerCase().includes('personal');
    
    if (isWorkAccount) {
      return [
        {
          from: { name: 'Sarah Johnson', email: 'sarah.johnson@company.com' },
          subject: 'Q4 Budget Review Meeting - Action Required',
          preview: 'Hi, I need to schedule our Q4 budget review meeting. Please check your calendar...',
          content: 'Hi,\n\nI need to schedule our Q4 budget review meeting for next week. Please check your calendar and let me know your availability for Tuesday or Wednesday afternoon.\n\nWe need to review:\n- Current spend vs budget\n- Q1 projections\n- Resource allocation\n\nBest regards,\nSarah Johnson\nFinance Manager'
        },
        {
          from: { name: 'IT Support', email: 'it-support@company.com' },
          subject: 'Security Update Required - Please Action',
          preview: 'Your system requires a critical security update. Please follow the instructions...',
          content: 'Dear Team Member,\n\nYour system requires a critical security update. Please follow these instructions:\n\n1. Save all open work\n2. Close all applications\n3. Restart your computer\n4. Allow the update to install\n\nThis should take approximately 15 minutes. Please complete by end of day.\n\nThanks,\nIT Support Team'
        },
        {
          from: { name: 'HR Department', email: 'hr@company.com' },
          subject: 'Employee Survey - Your Input Needed',
          preview: 'We value your feedback! Please take 5 minutes to complete our annual employee survey...',
          content: 'Dear Employee,\n\nWe value your feedback! Please take 5 minutes to complete our annual employee survey.\n\nYour responses are completely anonymous and will help us improve the workplace experience.\n\nSurvey deadline: Friday, 5 PM\n\nThank you for your participation!\n\nHR Team'
        }
      ];
    } else if (isPersonalAccount) {
      return [
        {
          from: { name: 'Netflix', email: 'info@netflix.com' },
          subject: 'New releases this week you might enjoy',
          preview: 'Based on your viewing history, here are some new releases we think you\'ll love...',
          content: 'Hi there!\n\nBased on your viewing history, here are some new releases we think you\'ll love:\n\n🎬 The Crown Season 6 - Final season\n🎭 Stranger Things Behind the Scenes\n🌊 Ocean Mysteries - New documentary series\n\nStart watching now!\n\nThe Netflix Team'
        },
        {
          from: { name: 'Amazon', email: 'orders@amazon.com' },
          subject: 'Your order has been shipped!',
          preview: 'Great news! Your recent order has been shipped and is on its way...',
          content: 'Great news!\n\nYour recent order has been shipped and is on its way.\n\nOrder #123-4567890-1234567\n\nTracking number: 1Z999AA1234567890\nExpected delivery: Tomorrow by 8 PM\n\nTrack your package: [Track Package]\n\nThanks for shopping with us!\nAmazon Customer Service'
        },
        {
          from: { name: 'GitHub', email: 'noreply@github.com' },
          subject: 'Pull request approved: Feature/email-client',
          preview: 'Your pull request has been approved and merged into the main branch...',
          content: 'Your pull request "Feature/email-client" has been approved and merged into the main branch.\n\nChanges included:\n✅ Added IMAP integration\n✅ Improved email parsing\n✅ Enhanced error handling\n✅ Updated documentation\n\n2 files changed, 450 insertions(+), 23 deletions(-)\n\nView changes: [View Diff]\n\nHappy coding!\nGitHub'
        }
      ];
    }
    
    // Generic emails for developer/other account types
    return [
      {
        from: { name: 'GitHub', email: 'noreply@github.com' },
        subject: 'Pull request merged: Feature/email-improvements',
        preview: 'Your pull request has been successfully merged into the main branch...',
        content: 'Your pull request "Feature/email-improvements" has been successfully merged into the main branch.\n\nChanges included:\n• Enhanced IMAP integration\n• Improved error handling\n• Better email templating\n\n🎉 Great work!\n\nView changes: https://github.com/repo/compare/main\n\nGitHub Team'
      },
      {
        from: { name: 'DigitalOcean', email: 'notifications@digitalocean.com' },
        subject: 'Server maintenance completed successfully',
        preview: 'Your droplet maintenance has been completed and services are running normally...',
        content: 'Hi there,\n\nWe\'ve successfully completed the scheduled maintenance on your droplet:\n\n• Droplet: mail-server-01\n• IP: 159.89.123.45\n• Duration: 15 minutes\n\nAll services are now running normally. No action is required on your part.\n\nThanks for your patience!\nDigitalOcean Team'
      },
      {
        from: { name: 'Stack Overflow', email: 'do-not-reply@stackoverflow.com' },
        subject: 'Your question received an accepted answer',
        preview: 'Great news! Your question about React hooks has received an accepted answer...',
        content: 'Great news!\n\nYour question "How to handle async operations in React hooks?" has received an accepted answer.\n\n👤 Answered by: react-expert-42\n⭐ Reputation: +15 points\n\nYour contribution helps the community learn and grow. Keep asking great questions!\n\nView your question: https://stackoverflow.com/q/123456\n\nStack Overflow Team'
      }
    ];
  }
}