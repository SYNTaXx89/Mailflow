/**
 * MIME Parser - Dedicated Email Content Processing
 * 
 * This class handles all MIME-related email parsing and content extraction.
 * Separated from ImapContainer to follow single responsibility principle.
 * 
 * Responsibilities:
 * - Parse MIME encoded headers (RFC 2047)
 * - Extract email content from raw MIME data
 * - Handle multipart messages
 * - Decode various transfer encodings
 * - Parse email headers and metadata
 */

export interface RawAttachment {
  filename: string;
  contentType: string;
  size: number;
  contentId?: string;
  encoding?: string;
}

export interface ParsedEmailContent {
  textContent: string;
  htmlContent?: string;
  attachments: RawAttachment[];
}

export interface ParsedEmailHeader {
  from: string;
  to: string;
  subject: string;
  date: Date;
  messageId: string;
}

export class MimeParser {
  
  /**
   * Parse email header fields from raw header string
   */
  static parseEmailHeader(header: string): ParsedEmailHeader {
    const lines = header.split('\n');
    let from = '';
    let to = '';
    let subject = '';
    let date = new Date();
    let messageId = '';

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.startsWith('from:')) {
        from = this.decodeMimeHeader(line.substring(5).trim());
      } else if (lower.startsWith('to:')) {
        to = line.substring(3).trim();
      } else if (lower.startsWith('subject:')) {
        subject = this.decodeMimeHeader(line.substring(8).trim());
      } else if (lower.startsWith('date:')) {
        const dateStr = line.substring(5).trim();
        date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          console.warn(`⚠️ Failed to parse date: "${dateStr}" - using current date`);
          date = new Date();
        }
      } else if (lower.startsWith('message-id:')) {
        messageId = line.substring(11).trim();
      }
    }

    return {
      from: from || 'Unknown',
      to: to || '',
      subject: subject || 'No Subject',
      date: date,
      messageId: messageId || ''
    };
  }

  /**
   * Parse email content from raw MIME data
   */
  static async parseEmailContent(rawData: string): Promise<ParsedEmailContent> {
    console.log(`📧 MimeParser: Parsing email content, length: ${rawData.length} chars`);
    
    // Split headers and body
    const headerBodySplit = rawData.split('\n\n');
    if (headerBodySplit.length < 2) {
      console.log(`⚠️ No clear header/body separation found`);
      return {
        textContent: rawData.trim() || 'No content',
        htmlContent: undefined,
        attachments: []
      };
    }

    const headers = headerBodySplit[0];
    const body = headerBodySplit.slice(1).join('\n\n');
    
    // Parse content-type from headers
    const contentTypeMatch = headers.match(/Content-Type:\s*([^;\n]+)/i);
    const contentType = contentTypeMatch ? contentTypeMatch[1].trim().toLowerCase() : 'text/plain';
    
    console.log(`📋 Content-Type: ${contentType}`);
    
    // Handle multipart content
    if (contentType.startsWith('multipart/')) {
      return this.parseMultipartContent(headers, body);
    }
    
    // Handle single part content
    return this.parseSinglePartContent(headers, body, contentType);
  }

  /**
   * Parse multipart MIME content
   */
  private static parseMultipartContent(headers: string, body: string): ParsedEmailContent {
    // Extract boundary from Content-Type header
    const boundaryMatch = headers.match(/boundary="?([^";\n]+)"?/i);
    if (!boundaryMatch) {
      console.log(`⚠️ No boundary found in multipart content`);
      return { textContent: body.trim() || 'No content', htmlContent: undefined, attachments: [] };
    }

    const boundary = boundaryMatch[1];
    console.log(`🔗 Found boundary: ${boundary}`);
    
    // Split body by boundary
    const parts = body.split(`--${boundary}`);
    let textContent = '';
    let htmlContent = '';
    
    for (const part of parts) {
      if (part.trim() === '' || part.trim() === '--') continue;
      
      // Split part headers and content
      const partSplit = part.split('\n\n');
      if (partSplit.length < 2) continue;
      
      const partHeaders = partSplit[0];
      const partContent = partSplit.slice(1).join('\n\n');
      
      // Get content type and encoding for this part
      const partContentTypeMatch = partHeaders.match(/Content-Type:\s*([^;\n]+)/i);
      const partContentType = partContentTypeMatch ? partContentTypeMatch[1].trim().toLowerCase() : 'text/plain';
      
      const encodingMatch = partHeaders.match(/Content-Transfer-Encoding:\s*([^\n]+)/i);
      const encoding = encodingMatch ? encodingMatch[1].trim().toLowerCase() : '7bit';
      
      console.log(`📄 Part - Type: ${partContentType}, Encoding: ${encoding}`);
      
      // Decode content based on encoding
      let decodedContent = this.decodeContent(partContent, encoding);
      
      // Store content based on type
      if (partContentType === 'text/plain') {
        textContent = decodedContent;
      } else if (partContentType === 'text/html') {
        htmlContent = decodedContent;
      }
    }
    
    return {
      textContent: textContent.trim() || 'No content',
      htmlContent: htmlContent.trim() || undefined,
      attachments: []
    };
  }

  /**
   * Parse single part content
   */
  private static parseSinglePartContent(headers: string, body: string, contentType: string): ParsedEmailContent {
    const encodingMatch = headers.match(/Content-Transfer-Encoding:\s*([^\n]+)/i);
    const encoding = encodingMatch ? encodingMatch[1].trim().toLowerCase() : '7bit';
    
    console.log(`📄 Single part - Type: ${contentType}, Encoding: ${encoding}`);
    
    const decodedContent = this.decodeContent(body, encoding);
    
    if (contentType === 'text/html') {
      return {
        textContent: decodedContent.trim(),
        htmlContent: decodedContent.trim(),
        attachments: []
      };
    } else {
      return {
        textContent: decodedContent.trim() || 'No content',
        htmlContent: undefined,
        attachments: []
      };
    }
  }

  /**
   * Decode content based on transfer encoding
   */
  private static decodeContent(content: string, encoding: string): string {
    try {
      switch (encoding) {
        case 'quoted-printable':
          return this.decodeQuotedPrintable(content);
        case 'base64':
          return this.decodeBase64(content);
        case '7bit':
        case '8bit':
        case 'binary':
        default:
          return content;
      }
    } catch (error) {
      console.warn(`⚠️ Failed to decode content with encoding ${encoding}:`, error);
      return content;
    }
  }

  /**
   * Decode quoted-printable content
   */
  private static decodeQuotedPrintable(input: string): string {
    return input
      .replace(/=\r?\n/g, '') // Remove soft line breaks
      .replace(/=([0-9A-F]{2})/gi, (_match, hex) => {
        return String.fromCharCode(parseInt(hex, 16));
      });
  }

  /**
   * Decode base64 content
   */
  private static decodeBase64(input: string): string {
    try {
      // Remove whitespace and decode
      const cleanInput = input.replace(/\s/g, '');
      return atob(cleanInput);
    } catch (error) {
      console.warn(`⚠️ Base64 decode failed:`, error);
      return input;
    }
  }

  /**
   * Decode MIME encoded headers (RFC 2047)
   * Supports both Q-encoding and Base64 encoding
   */
  static decodeMimeHeader(input: string): string {
    if (!input) return '';
    
    // Handle multiple encoded segments by processing them iteratively
    let decoded = input;

    // Handle =?UTF-8?Q?...?= encoding (Quoted-Printable)
    const qEncodingRegex = /=\?([^?]+)\?Q\?([^?]+)\?=/gi;
    decoded = decoded.replace(qEncodingRegex, (_match, charset, encoded) => {
      try {
        // Decode Q-encoding: replace =XX with hex bytes, _ with space
        const qDecoded = encoded
          .replace(/_/g, ' ')  // Q-encoding uses _ for space
          .replace(/=([0-9A-F]{2})/gi, (_match: string, hex: string) => {
            const charCode = parseInt(hex, 16);
            return String.fromCharCode(charCode);
          });
        
        // For UTF-8, use TextDecoder if available
        if (charset.toUpperCase() === 'UTF-8') {
          try {
            // Convert string to Uint8Array for proper UTF-8 decoding
            const bytes = new Uint8Array(qDecoded.length);
            for (let i = 0; i < qDecoded.length; i++) {
              bytes[i] = qDecoded.charCodeAt(i);
            }
            
            const decoder = new TextDecoder('utf-8');
            return decoder.decode(bytes);
          } catch (decoderError) {
            console.warn(`⚠️ MIME Q-encoding TextDecoder failed, using fallback`);
            return qDecoded;
          }
        } else {
          return qDecoded;
        }
      } catch (e) {
        console.warn(`⚠️ MIME Q-encoding failed for: ${encoded}`);
        return encoded;
      }
    });

    // Handle =?UTF-8?B?...?= encoding (Base64)
    const bEncodingRegex = /=\?([^?]+)\?B\?([^?]+)\?=/gi;
    decoded = decoded.replace(bEncodingRegex, (_match, charset, encoded) => {
      try {
        const base64Decoded = atob(encoded);
        
        if (charset.toUpperCase() === 'UTF-8') {
          try {
            // Convert base64 decoded string to Uint8Array for proper UTF-8 decoding
            const bytes = new Uint8Array(base64Decoded.length);
            for (let i = 0; i < base64Decoded.length; i++) {
              bytes[i] = base64Decoded.charCodeAt(i);
            }
            
            const decoder = new TextDecoder('utf-8');
            return decoder.decode(bytes);
          } catch (decoderError) {
            console.warn(`⚠️ MIME B-encoding TextDecoder failed, using fallback`);
            return base64Decoded;
          }
        } else {
          return base64Decoded;
        }
      } catch (e) {
        console.warn(`⚠️ MIME B-encoding failed for: ${encoded}`);
        return encoded;
      }
    });

    // Clean up any double spaces
    decoded = decoded.replace(/\s+/g, ' ').trim();
    
    return decoded;
  }

  /**
   * Check if email structure has attachments
   */
  static checkForAttachments(struct: any): boolean {
    if (!struct) return false;
    
    // Helper function to recursively check MIME structure
    const hasAttachmentParts = (parts: any): boolean => {
      if (!Array.isArray(parts)) {
        return false;
      }
      
      for (const part of parts) {
        // Check if this part is an attachment
        if (part.disposition) {
          // Check Content-Disposition header
          if (part.disposition.type && part.disposition.type.toLowerCase() === 'attachment') {
            return true;
          }
        }
        
        // Check if Content-Type suggests attachment (not text/plain or text/html)
        if (part.type && part.subtype) {
          const contentType = `${part.type}/${part.subtype}`.toLowerCase();
          
          // Skip common email content types
          if (contentType !== 'text/plain' && 
              contentType !== 'text/html' && 
              contentType !== 'multipart/alternative' &&
              contentType !== 'multipart/related') {
            
            // Additional check: if it has a filename, it's likely an attachment
            if (part.disposition && part.disposition.params && part.disposition.params.filename) {
              return true;
            }
            
            // Or if Content-Type has a name parameter
            if (part.params && part.params.name) {
              return true;
            }
            
            // Check for common attachment content types
            if (contentType.includes('application/') || 
                contentType.includes('image/') ||
                contentType.includes('audio/') ||
                contentType.includes('video/')) {
              return true;
            }
          }
        }
        
        // Recursively check nested parts
        if (Array.isArray(part)) {
          if (hasAttachmentParts(part)) {
            return true;
          }
        }
      }
      
      return false;
    };
    
    // Check if struct is an array (multipart) and has attachment parts
    if (Array.isArray(struct)) {
      return hasAttachmentParts(struct);
    }
    
    // Single part - check if it's an attachment
    return hasAttachmentParts([struct]);
  }

  /**
   * Generate preview text from email content
   */
  static generatePreview(content: string): string {
    const text = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return text.length > 150 ? text.substring(0, 150) + '...' : text;
  }
}