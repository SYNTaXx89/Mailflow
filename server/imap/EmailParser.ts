import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import { EmailFrom } from '../../src/types';

export interface ParsedAttachment {
  filename: string;
  size: number;
  contentType: string;
  contentId?: string;
  contentDisposition?: 'attachment' | 'inline';
  checksum?: string;
  related?: boolean;
}

export class EmailParser {
  /**
   * Parse email using mailparser
   */
  static async parseEmail(rawEmail: string): Promise<ParsedMail> {
    try {
      return await simpleParser(rawEmail);
    } catch (error) {
      console.error('Error parsing email with mailparser:', error);
      throw error;
    }
  }

  /**
   * Extract email content from parsed mail
   */
  static extractEmailContent(parsedMail: ParsedMail): string {
    if (parsedMail.html) {
      return parsedMail.html;
    }
    
    if (parsedMail.text) {
      return parsedMail.text;
    }
    
    return '';
  }

  /**
   * Parse email headers from parsed mail
   */
  static parseEmailHeaders(parsedMail: ParsedMail): {
    from: EmailFrom;
    subject: string;
    date: Date;
  } {
    const from = parsedMail.from?.value?.[0] || { name: 'Unknown', address: 'unknown@example.com' };
    const subject = parsedMail.subject || 'No Subject';
    const date = parsedMail.date || new Date();

    return {
      from: {
        name: from.name || from.address || 'Unknown',
        email: from.address || 'unknown@example.com'
      },
      subject: subject,
      date: date
    };
  }

  /**
   * Parse email header using custom MIME decoder
   */
  static async parseEmailHeader(header: string): Promise<{
    from: EmailFrom;
    subject: string;
    date: Date;
  }> {
    try {
      console.log('Attempting to parse header with mailparser...');
      const parsedMail = await this.parseEmail(header);
      console.log('mailparser result:', {
        from: parsedMail.from,
        subject: parsedMail.subject,
        date: parsedMail.date
      });
      
      let from: EmailFrom = { name: 'Unknown', email: '' };
      let subject = 'No Subject';
      let date = new Date();

      if (parsedMail.from && parsedMail.from.value && parsedMail.from.value.length > 0) {
        const fromValue = parsedMail.from.value[0];
        from = {
          name: fromValue.name || fromValue.address || 'Unknown',
          email: fromValue.address || 'unknown@example.com'
        };
      }

      if (parsedMail.subject) {
        subject = parsedMail.subject;
      }

      if (parsedMail.date) {
        const parsedDate = new Date(parsedMail.date);
        if (!isNaN(parsedDate.getTime())) {
          date = parsedDate;
        }
      }

      console.log('Extracted header info:', { from, subject, date });
      return { from, subject, date };
    } catch (error) {
      console.error('Error parsing email header with mailparser:', error);
      console.log('Falling back to simple parsing...');
      return this.parseEmailHeaderSimple(header);
    }
  }

  /**
   * Simple fallback email header parser
   */
  static parseEmailHeaderSimple(header: string): {
    from: EmailFrom;
    subject: string;
    date: Date;
  } {
    console.log('Using simple header parser for:', header.substring(0, 200) + '...');
    const lines = header.split('\n');
    let from: EmailFrom = { name: 'Unknown', email: '' };
    let subject = 'No Subject';
    let date = new Date();

    lines.forEach(line => {
      const lowerLine = line.toLowerCase();
      
      if (lowerLine.startsWith('from:')) {
        const fromValue = line.substring(5).trim();
        const emailMatch = fromValue.match(/<([^>]+)>/);
        const email = emailMatch ? emailMatch[1] : fromValue;
        const name = emailMatch ? fromValue.replace(/<[^>]+>/, '').trim().replace(/"/g, '') : '';
        from = { name: name || email, email };
        console.log('Simple parser found from:', from);
      } else if (lowerLine.startsWith('subject:')) {
        subject = line.substring(8).trim();
        console.log('Simple parser found subject:', subject);
      } else if (lowerLine.startsWith('date:')) {
        const dateStr = line.substring(5).trim();
        date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          date = new Date();
        }
        console.log('Simple parser found date:', date);
      }
    });

    const result = { from, subject, date };
    console.log('Simple parser result:', result);
    return result;
  }

  /**
   * Generate preview text from email content
   */
  static generatePreview(content: string): string {
    const text = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return text.length > 150 ? text.substring(0, 150) + '...' : text;
  }

  /**
   * Extract attachments from parsed email
   */
  static extractAttachments(parsedMail: ParsedMail): ParsedAttachment[] {
    const attachments: ParsedAttachment[] = [];
    
    if (!parsedMail.attachments || parsedMail.attachments.length === 0) {
      return attachments;
    }
    
    parsedMail.attachments.forEach((attachment: Attachment, index: number) => {
      attachments.push({
        filename: attachment.filename || `attachment_${index + 1}`,
        size: attachment.size || 0,
        contentType: attachment.contentType || 'application/octet-stream',
        contentId: attachment.contentId,
        contentDisposition: attachment.contentDisposition as 'attachment' | 'inline' | undefined,
        checksum: attachment.checksum,
        related: attachment.related
      });
    });

    return attachments;
  }

  /**
   * Check if email has attachments
   */
  static hasAttachments(parsedMail: ParsedMail): boolean {
    return parsedMail.attachments ? parsedMail.attachments.length > 0 : false;
  }

  /**
   * Extract content from raw email data
   */
  static extractContentFromRawData(data: string): string {
    const lines = data.split('\n');
    let inBody = false;
    const bodyLines: string[] = [];
    
    for (const line of lines) {
      if (line.trim() === '') {
        inBody = true;
        continue;
      }
      if (inBody) {
        bodyLines.push(line);
      }
    }
    
    return bodyLines.join('\n');
  }
}