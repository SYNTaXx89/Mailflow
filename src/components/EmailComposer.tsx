/**
 * EmailComposer Component
 * 
 * Modal component for composing new emails or replying to existing ones.
 * Features:
 * - Plain text email composition with textarea
 * - Support for different composition types (new, reply, reply all)
 * - Auto-fills recipient and subject for replies
 * - Validates email data before sending
 * - Loading state during email sending
 * 
 * Props:
 * - showComposer: Boolean to control modal visibility
 * - setShowComposer: Function to close the composer
 * - composerType: Type of composition (new, reply, replyAll)
 * - composerData: Current email composition data
 * - setComposerData: Function to update composition data
 * - sendEmail: Function called when email is sent
 * - isSendingEmail: Boolean indicating if email is being sent
 * - emailSentSuccess: Boolean indicating if email was sent successfully
 */

import React, { useState, useRef } from 'react';
import { X, Send, Loader2, Check, Paperclip, FileText, Image, Archive, Trash2 } from 'lucide-react';
import { EmailComposerProps, ComposerAttachment } from '../types';

const EmailComposer: React.FC<EmailComposerProps> = ({
  showComposer,
  setShowComposer,
  composerType,
  composerData,
  setComposerData,
  sendEmail,
  isSendingEmail = false,
  emailSentSuccess = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  if (!showComposer) return null;
  
  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    
    const newAttachments: ComposerAttachment[] = [];
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.jar'];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        alert(`File \"${file.name}\" is too large. Maximum size is 10MB.`);
        continue;
      }
      
      // Check blocked extensions
      const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (BLOCKED_EXTENSIONS.includes(extension)) {
        alert(`File type \"${extension}\" is not allowed for security reasons.`);
        continue;
      }
      
      const attachment: ComposerAttachment = {
        id: Date.now().toString() + i,
        file,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream'
      };
      newAttachments.push(attachment);
    }
    
    if (newAttachments.length > 0) {
      setComposerData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newAttachments]
      }));
    }
  };
  
  const handleRemoveAttachment = (attachmentId: string) => {
    setComposerData(prev => ({
      ...prev,
      attachments: prev.attachments.filter(att => att.id !== attachmentId)
    }));
  };
  
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };
  
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (type.includes('pdf') || type.includes('document') || type.includes('text')) return <FileText className="w-4 h-4" />;
    return <Archive className="w-4 h-4" />;
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800/95 backdrop-blur-sm rounded-2xl w-full max-w-4xl h-[90vh] border border-gray-700/50 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <h2 className="text-xl font-semibold text-white">
            {composerType === 'reply' ? 'Reply' : composerType === 'replyAll' ? 'Reply All' : 'New Email'}
          </h2>
          <button
            onClick={() => setShowComposer(false)}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-700/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">To</label>
            <input
              type="email"
              value={composerData.to}
              onChange={(e) => setComposerData(prev => ({ ...prev, to: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              placeholder="recipient@example.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Subject</label>
            <input
              type="text"
              value={composerData.subject}
              onChange={(e) => setComposerData(prev => ({ ...prev, subject: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              placeholder="Email subject"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
            <div className="border border-gray-600 rounded-lg overflow-hidden">
              <textarea
                value={composerData.body}
                onChange={(e) => setComposerData(prev => ({ ...prev, body: e.target.value }))}
                placeholder="Write your message here..."
                className="min-h-[150px] w-full p-4 bg-gray-700/50 text-white focus:outline-none resize-none border-none"
                style={{ 
                  maxHeight: '200px', 
                  direction: 'ltr',
                  textAlign: 'left',
                  fontFamily: 'inherit'
                }}
                dir="ltr"
              />
            </div>
          </div>
          
          {/* Attachments Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">Attachments</label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-2 px-3 py-1 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white rounded-lg transition-colors text-sm"
              >
                <Paperclip className="w-4 h-4" />
                <span>Add Files</span>
              </button>
            </div>
            
            {/* File Input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
            
            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-3 transition-colors ${
                isDragging 
                  ? 'border-teal-500 bg-teal-500/10' 
                  : 'border-gray-600 hover:border-gray-500'
              }`}
            >
              {composerData.attachments.length > 0 ? (
                <div className="space-y-2">
                  {composerData.attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center justify-between p-2 bg-gray-700/30 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="text-gray-400">
                          {getFileIcon(attachment.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white truncate">{attachment.name}</div>
                          <div className="text-xs text-gray-400">{formatFileSize(attachment.size)}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveAttachment(attachment.id)}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-3">
                  <Paperclip className="w-6 h-6 mx-auto text-gray-500 mb-1" />
                  <p className="text-gray-400 text-sm">Drag & drop files here or click "Add Files"</p>
                  <p className="text-gray-500 text-xs mt-1">Max 10MB per file</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-end space-x-4 p-6 border-t border-gray-700/50 flex-shrink-0">
          <button
            onClick={() => setShowComposer(false)}
            className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={sendEmail}
            disabled={isSendingEmail || emailSentSuccess}
            className={`flex items-center space-x-2 px-6 py-2 font-semibold rounded-lg transition-all duration-200 shadow-lg ${
              emailSentSuccess
                ? 'bg-green-600 cursor-not-allowed'
                : isSendingEmail 
                  ? 'bg-gray-600 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-teal-600 to-purple-600 hover:from-teal-700 hover:to-purple-700 hover:shadow-xl'
            } text-white`}
          >
            {emailSentSuccess ? (
              <Check className="w-4 h-4" />
            ) : isSendingEmail ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>
              {emailSentSuccess ? 'Sent!' : isSendingEmail ? 'Sending...' : 'Send'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailComposer;