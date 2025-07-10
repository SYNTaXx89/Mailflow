/**
 * EmailView Component
 * 
 * Main content area for displaying selected emails or empty state.
 * Features:
 * - Email header with sender information and timestamp
 * - Action buttons (Reply, Reply All, Delete)
 * - Email content display with proper formatting
 * - Empty state when no email is selected
 * - Responsive design for different screen sizes
 * 
 * This component handles the email reading experience and provides
 * quick actions for email management.
 * 
 * Props:
 * - selectedEmail: The currently selected email to display
 * - formatDate: Function to format email dates
 * - handleReply: Function to handle reply actions
 * - handleDelete: Function to handle email deletion
 */

import React from 'react';
import { Mail, Reply, ReplyAll, Trash2, Loader2 } from 'lucide-react';
import { EmailViewProps } from '../types';
import { AttachmentList } from './AttachmentList';

const EmailView: React.FC<EmailViewProps> = ({
  selectedEmail,
  formatDate,
  handleReply,
  handleDelete,
  isLoadingEmailContent = false
}) => {
  /**
   * Process HTML content to fix common issues and enhance rendering
   */
  const processHtmlContent = (html: string): string => {
    // Check for potentially problematic CSS before processing
    const hasProblematicCSS = /style="[^"]*(?:position|z-index|margin|padding|body|html)[^"]*"/gi.test(html) ||
                              /<style/gi.test(html) ||
                              /<link[^>]*stylesheet/gi.test(html);
    
    if (hasProblematicCSS) {
      console.warn('⚠️ Email contains potentially problematic CSS that could affect layout:', {
        subject: selectedEmail?.subject,
        id: selectedEmail?.id
      });
    }

    let processed = html
      // Remove scripts for security
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove external styles and style blocks that could affect layout
      .replace(/<link[^>]*stylesheet[^>]*>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // Remove meta tags that might interfere
      .replace(/<meta[^>]*>/gi, '')
      // Remove CSS that could affect parent elements
      .replace(/style="[^"]*(?:position\s*:|z-index\s*:|margin\s*:|padding\s*:)[^"]*"/gi, (match) => {
        // Keep safe inline styles, remove potentially problematic ones
        return match
          .replace(/position\s*:[^;"]*/gi, '')
          .replace(/z-index\s*:[^;"]*/gi, '')
          .replace(/margin\s*:[^;"]*/gi, '')
          .replace(/padding\s*:[^;"]*/gi, '')
          .replace(/style="[;\s]*"/gi, '') // Remove empty style attributes
          .replace(/style=""/gi, ''); // Remove completely empty style attributes
      })
      // Convert relative URLs to absolute (basic implementation)
      .replace(/src="\/([^"]*)"([^>]*)>/gi, 'src="$1"$2>')
      // Fix image URLs with spaces
      .replace(/<img([^>]+)src="([^"]*)"([^>]*)>/gi, (match, before, src, after) => {
        if (src && src.includes(' ')) {
          const encodedSrc = src.replace(/ /g, '%20');
          return `<img${before}src="${encodedSrc}"${after}>`;
        }
        return match;
      })
      // Fix other URLs with spaces
      .replace(/href="([^"]*)"([^>]*)>/gi, (match, href, after) => {
        if (href && href.includes(' ') && !href.startsWith('mailto:')) {
          const encodedHref = href.replace(/ /g, '%20');
          return `href="${encodedHref}"${after}>`;
        }
        return match;
      });

    // Remove body and html tags to prevent layout interference
    processed = processed
      .replace(/<html[^>]*>/gi, '')
      .replace(/<\/html>/gi, '')
      .replace(/<body[^>]*>/gi, '')
      .replace(/<\/body>/gi, '')
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, ''); // Remove head section entirely

    // Enhance text readability for dark theme
    processed = processed
      .replace(/<p([^>]*style="[^"]*")([^>]*)>/gi, '<p$1$2 style="color: #d1d5db !important; margin: 0 0 1em 0;">')
      .replace(/<p([^>]*)>/gi, '<p$1 style="color: #d1d5db !important; margin: 0 0 1em 0;">')
      .replace(/<div([^>]*style="[^"]*")([^>]*)>/gi, '<div$1$2 style="color: #d1d5db !important;">')
      .replace(/<div([^>]*)>/gi, '<div$1 style="color: #d1d5db !important;">')
      .replace(/<span([^>]*style="[^"]*")([^>]*)>/gi, '<span$1$2 style="color: #d1d5db !important;">')
      .replace(/<span([^>]*)>/gi, '<span$1 style="color: #d1d5db !important;">')
      .replace(/<td([^>]*)>/gi, '<td$1 style="color: #d1d5db !important;">')
      .replace(/<th([^>]*)>/gi, '<th$1 style="color: #d1d5db !important;">')
      .replace(/<h([1-6])([^>]*)>/gi, '<h$1$2 style="color: #d1d5db !important;">')
      .replace(/<li([^>]*)>/gi, '<li$1 style="color: #d1d5db !important;">')
      .replace(/<a([^>]*)>/gi, '<a$1 style="color: #60a5fa !important;">');

    return processed;
  };

  // Empty state when no email is selected
  if (!selectedEmail) {
    return (
      <div className="flex-1 h-full relative z-10">
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <Mail className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-400 mb-2">Select an email to read</h2>
            <p className="text-gray-500">Choose an email from the sidebar to view its content</p>
          </div>
        </div>
      </div>
    );
  }

  // Email content view
  return (
    <div className="flex-1 h-full relative z-10">
      <div className="h-full flex flex-col">
        {/* Email Header */}
        <header className="bg-gray-800/90 backdrop-blur-sm border-b border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white mb-1">{selectedEmail.subject}</h1>
              <p className="text-gray-400">
                From: {selectedEmail.from.name} &lt;{selectedEmail.from.email}&gt;
              </p>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              <span className="text-gray-400 mr-4">{formatDate(selectedEmail.date)}</span>
              
              <button
                onClick={() => handleReply(selectedEmail, 'reply')}
                className="flex items-center space-x-2 px-3 py-2 bg-teal-600/20 text-teal-400 border border-teal-600/30 rounded-lg hover:bg-teal-600/30 transition-colors"
                title="Reply"
              >
                <Reply className="w-4 h-4" />
                <span className="hidden sm:inline">Reply</span>
              </button>
              
              <button
                onClick={() => handleReply(selectedEmail, 'replyAll')}
                className="flex items-center space-x-2 px-3 py-2 bg-purple-600/20 text-purple-400 border border-purple-600/30 rounded-lg hover:bg-purple-600/30 transition-colors"
                title="Reply All"
              >
                <ReplyAll className="w-4 h-4" />
                <span className="hidden sm:inline">Reply All</span>
              </button>
              
              <button
                onClick={() => handleDelete(selectedEmail)}
                className="flex items-center space-x-2 px-3 py-2 bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg hover:bg-red-600/30 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            </div>
          </div>
        </header>
        
        {/* Email Content */}
        <div className="flex-1 overflow-y-auto">
            {isLoadingEmailContent ? (
              // Loading state
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center space-x-3">
                  <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
                  <span className="text-gray-400">Loading email content...</span>
                </div>
              </div>
            ) : selectedEmail.content ? (
              (() => {
                // Enhanced HTML detection - more comprehensive
                const content = selectedEmail.content;
                const hasHtmlTags = content.includes('<html') || 
                                   content.includes('<body') ||
                                   content.includes('<div') ||
                                   content.includes('<p') ||
                                   content.includes('<br') ||
                                   content.includes('<span') ||
                                   content.includes('<table') ||
                                   content.includes('<img') ||
                                   content.includes('<a ') ||
                                   content.includes('<strong') ||
                                   content.includes('<em>') ||
                                   content.includes('<h1') ||
                                   content.includes('<h2') ||
                                   content.includes('<h3');
                
                // Check for HTML tag patterns
                const htmlTagPattern = /<[a-zA-Z][^>]*>/;
                const hasValidHtmlStructure = htmlTagPattern.test(content);
                
                const isHtmlContent = hasHtmlTags || hasValidHtmlStructure;
                
                console.log('🔍 Email Content Analysis:', {
                  hasHtmlTags,
                  hasValidHtmlStructure,
                  isHtmlContent,
                  contentLength: content.length,
                  contentPreview: content.substring(0, 200),
                  emailId: selectedEmail.id,
                  subject: selectedEmail.subject
                });
                
                if (isHtmlContent) {
                  // HTML content - isolated container to prevent CSS leakage
                  return (
                    <div className="p-6">
                      <div 
                        className="text-gray-300 leading-relaxed font-sans"
                        dangerouslySetInnerHTML={{ 
                          __html: processHtmlContent(selectedEmail.content)
                        }}
                        style={{
                          // Base styles for HTML email content with isolation
                          color: '#d1d5db',
                          backgroundColor: 'transparent',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                          fontSize: '14px',
                          lineHeight: '1.6',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          wordWrap: 'break-word',
                          // CSS isolation properties
                          isolation: 'isolate',
                          contain: 'style layout',
                          position: 'relative'
                        }}
                      />
                    </div>
                  );
                } else {
                  // Plain text content - with padding for readability
                  return (
                    <div className="p-6">
                      <pre className="whitespace-pre-wrap text-gray-300 leading-relaxed font-sans">
                        {selectedEmail.content}
                      </pre>
                    </div>
                  );
                }
              })()
            ) : (
              // No content available - show preparing to load state
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-4">
                    <Loader2 className="w-8 h-8 text-gray-500 animate-spin mr-3" />
                    <Mail className="w-12 h-12 text-gray-600" />
                  </div>
                  <p className="text-gray-400">Preparing email content...</p>
                  <p className="text-gray-500 text-sm">Loading from server</p>
                </div>
              </div>
            )}
            
            {/* Attachment List */}
            {selectedEmail.hasAttachments && (
              selectedEmail.attachments && selectedEmail.attachments.length > 0 ? (
                <AttachmentList 
                  attachments={selectedEmail.attachments}
                  emailId={selectedEmail.id}
                  accountId={selectedEmail.accountId}
                />
              ) : (
                <div className="mt-4 p-4 bg-gray-800 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">
                    📎 This email has attachments
                  </h3>
                  <p className="text-sm text-gray-400">
                    {isLoadingEmailContent ? 
                      'Loading attachment details...' : 
                      'Attachment details will load when email content is fully loaded...'
                    }
                  </p>
                </div>
              )
            )}
        </div>
      </div>
    </div>
  );
};

export default EmailView;