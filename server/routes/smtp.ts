/**
 * SMTP Routes - Email Sending API Endpoints
 * 
 * Provides HTTP endpoints for email sending operations using SMTP.
 * Follows the same pattern as the IMAP routes but for outbound email.
 * 
 * Routes:
 * - POST /api/smtp/send - Send an email
 * - POST /api/smtp/test-connection - Test SMTP connection
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { SmtpService, EmailData, EmailAttachmentData } from '../services/SmtpService';
import { Account } from '../../src/types';
import { AuthMiddleware } from '../auth/AuthMiddleware';

export const createSmtpRouter = (authMiddleware: AuthMiddleware) => {
  const router = Router();

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Maximum 10 files
  },
  fileFilter: (req: any, file: any, cb: any) => {
    // Block dangerous file types
    const blockedExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.jar'];
    const extension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    if (blockedExtensions.includes(extension)) {
      return cb(new Error(`File type ${extension} is not allowed for security reasons`));
    }
    
    cb(null, true);
  }
});

/**
 * POST /api/smtp/send
 * Send an email using account SMTP settings
 */
router.post('/send', authMiddleware.authenticate, upload.array('attachments'), async (req: Request, res: Response) => {
  try {
    const { account, emailData, password } = req.body;

    if (!account) {
      return res.status(400).json({
        success: false,
        error: 'Account configuration is required'
      });
    }

    if (!emailData) {
      return res.status(400).json({
        success: false,
        error: 'Email data is required'
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required for SMTP authentication'
      });
    }

    // Parse account and emailData if they're JSON strings first
    let parsedAccount: Account;
    let parsedEmailData: EmailData;
    
    try {
      parsedAccount = typeof account === 'string' ? JSON.parse(account) : account;
      parsedEmailData = typeof emailData === 'string' ? JSON.parse(emailData) : emailData;
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid account or email data format'
      });
    }

    // Validate required email fields
    if (!parsedEmailData.to || !parsedEmailData.subject) {
      return res.status(400).json({
        success: false,
        error: 'Email must have recipient (to) and subject'
      });
    }

    // Handle file attachments
    const attachments: EmailAttachmentData[] = [];
    const files = req.files as Express.Multer.File[];
    
    if (files && files.length > 0) {
      for (const file of files) {
        attachments.push({
          filename: file.originalname,
          content: file.buffer,
          contentType: file.mimetype
        });
      }
    }
    
    // Add attachments to email data
    if (attachments.length > 0) {
      parsedEmailData.attachments = attachments;
    }

    console.log('SMTP Route: Sending email request:', {
      accountEmail: parsedAccount.email,
      to: parsedEmailData.to,
      subject: parsedEmailData.subject,
      hasBody: !!parsedEmailData.body,
      attachmentCount: attachments.length
    });

    // Send email using SMTP service
    const result = await SmtpService.sendEmail(parsedAccount, parsedEmailData, password);

    if (result.success) {
      console.log('SMTP Route: Email sent successfully:', {
        messageId: result.messageId,
        to: emailData.to
      });

      res.json({
        success: true,
        messageId: result.messageId,
        message: 'Email sent successfully'
      });
    } else {
      console.error('SMTP Route: Email sending failed:', result.error);

      res.status(500).json({
        success: false,
        error: result.error || 'Failed to send email'
      });
    }

  } catch (error) {
    console.error('SMTP Route: Unexpected error in /send:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error while sending email'
    });
  }
});

/**
 * POST /api/smtp/test-connection
 * Test SMTP connection without sending an email
 */
router.post('/test-connection', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { account, password } = req.body;

    if (!account) {
      return res.status(400).json({
        success: false,
        error: 'Account configuration is required'
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required for SMTP test'
      });
    }

    console.log('SMTP Route: Testing connection for account:', account.email);

    // Test SMTP connection
    const result = await SmtpService.testConnection(account, password);

    if (result.success) {
      console.log('SMTP Route: Connection test successful for:', account.email);

      res.json({
        success: true,
        message: 'SMTP connection successful'
      });
    } else {
      console.error('SMTP Route: Connection test failed:', result.error);

      res.status(400).json({
        success: false,
        error: result.error || 'SMTP connection test failed'
      });
    }

  } catch (error) {
    console.error('SMTP Route: Unexpected error in /test-connection:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error while testing SMTP connection'
    });
  }
});

/**
 * GET /api/smtp/providers
 * Get SMTP settings for common email providers
 */
router.get('/providers/:email', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { email } = req.params;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Valid email address is required'
      });
    }

    const smtpSettings = SmtpService.getSmtpSettings(email);

    if (smtpSettings) {
      res.json({
        success: true,
        smtp: smtpSettings,
        message: 'SMTP settings found for email provider'
      });
    } else {
      res.json({
        success: false,
        message: 'No SMTP settings found for this email provider'
      });
    }

  } catch (error) {
    console.error('SMTP Route: Error in /providers:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error while getting provider settings'
    });
  }
});

  return router;
};

// Temporary backward compatibility
export default createSmtpRouter;