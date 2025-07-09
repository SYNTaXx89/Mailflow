/**
 * AttachmentList Component - Email Attachment Display and Download
 * 
 * Displays a list of email attachments with download functionality.
 * Includes file type icons, size formatting, and secure download handling.
 */

import React, { useState } from 'react';
import { Download, File, FileText, Image, FileCode, FileArchive, Film, Music } from 'lucide-react';
import { EmailAttachment } from '../types';
import { apiConfig } from '../config/api';

interface AttachmentListProps {
  attachments: EmailAttachment[];
  emailId: string;
  accountId: string;
}

/**
 * Get appropriate icon for file type
 */
const getFileIcon = (contentType: string, filename: string) => {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  // Check by MIME type first
  if (contentType.startsWith('image/')) return Image;
  if (contentType.startsWith('video/')) return Film;
  if (contentType.startsWith('audio/')) return Music;
  if (contentType.includes('pdf')) return FileText;
  if (contentType.includes('zip') || contentType.includes('compressed')) return FileArchive;
  
  // Check by file extension
  switch (extension) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
      return Image;
    case 'pdf':
    case 'doc':
    case 'docx':
    case 'txt':
      return FileText;
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return FileArchive;
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'mkv':
      return Film;
    case 'mp3':
    case 'wav':
    case 'flac':
    case 'm4a':
      return Music;
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
    case 'py':
    case 'java':
    case 'cpp':
    case 'c':
    case 'html':
    case 'css':
      return FileCode;
    default:
      return File;
  }
};

/**
 * Format file size to human readable format
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
};

/**
 * AttachmentList Component
 */
export const AttachmentList: React.FC<AttachmentListProps> = ({ attachments, emailId, accountId }) => {
  const [downloadingIds, setDownloadingIds] = useState<Set<number>>(new Set());
  const [downloadErrors, setDownloadErrors] = useState<Map<number, string>>(new Map());

  const handleDownload = async (attachment: EmailAttachment, index: number) => {
    try {
      setDownloadingIds(prev => new Set(prev).add(index));
      setDownloadErrors(prev => {
        const next = new Map(prev);
        next.delete(index);
        return next;
      });

      // Get auth token from storage
      const token = localStorage.getItem('mailflow_access_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Fetch attachment with auth header
      const response = await fetch(`${apiConfig.baseUrl}/emails/${accountId}/${emailId}/attachments/${index + 1}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }

      // Get the blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('Download error:', error);
      setDownloadErrors(prev => {
        const next = new Map(prev);
        next.set(index, error instanceof Error ? error.message : 'Download failed');
        return next;
      });
    } finally {
      setDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-gray-800 rounded-lg">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Attachments ({attachments.length})
      </h3>
      <div className="space-y-2">
        {attachments.map((attachment, index) => {
          const Icon = getFileIcon(attachment.contentType, attachment.filename);
          const isDownloading = downloadingIds.has(index);
          const error = downloadErrors.get(index);
          
          return (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <Icon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate" title={attachment.filename}>
                    {attachment.filename}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatFileSize(attachment.size)}
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => handleDownload(attachment, index)}
                disabled={isDownloading}
                className={`ml-2 p-2 rounded transition-all ${
                  isDownloading 
                    ? 'bg-gray-600 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-teal-500 to-purple-600 hover:from-teal-600 hover:to-purple-700'
                } text-white`}
                title={isDownloading ? 'Downloading...' : 'Download attachment'}
              >
                {isDownloading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
              
              {error && (
                <div className="absolute right-0 top-full mt-1 p-2 bg-red-600 text-white text-xs rounded shadow-lg z-10">
                  {error}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};