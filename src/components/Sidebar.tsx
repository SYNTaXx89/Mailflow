/**
 * Sidebar Component
 * 
 * Left sidebar containing email accounts and email list for the selected account.
 * Features:
 * - Application branding and logo
 * - Settings button for accessing application preferences
 * - Account switcher with visual indicators for unread counts
 * - Email list for the currently selected account
 * - Visual indicators for read/unread emails
 * - Click handlers for account and email selection
 * 
 * This component manages the primary navigation and email browsing interface.
 * 
 * Props:
 * - appState: Current application state
 * - setAppState: Function to update application state
 * - currentEmails: Array of emails for the selected account
 * - selectedEmail: Currently selected email
 * - setSelectedEmail: Function to select an email
 * - setShowSettings: Function to open the settings modal
 * - formatDate: Function to format email dates
 */

import React from 'react';
import { Mail, Settings, Loader2, AlertCircle, Plus, Paperclip } from 'lucide-react';
import { SidebarProps } from '../types';
import { AppStateStorage } from '../utils/storage';

const Sidebar: React.FC<SidebarProps> = ({
  appState,
  setAppState,
  currentEmails,
  selectedEmail,
  setSelectedEmail,
  setShowSettings,
  formatDate,
  isLoadingEmails = false,
  emailLoadError = null,
  loadEmailContent,
  isLoadingEmailContent = false,
  refreshEmails,
  // softRefreshEmails,
  markEmailAsRead,
  onNewEmail,
  idleStatus,
  idleConnections
}) => {
  console.log('Sidebar render - currentEmails:', currentEmails.length, currentEmails);
  console.log('Sidebar render - isLoadingEmails:', isLoadingEmails);
  console.log('Sidebar render - emailLoadError:', emailLoadError);
  console.log('Sidebar render - selectedAccount:', appState.selectedAccount);

  /**
   * Get IDLE connection status indicator
   */
  const getIdleStatusIndicator = (accountId: string) => {
    const hasConnection = idleConnections?.has(accountId);
    const status = idleStatus?.get(accountId);
    
    if (!hasConnection || !status) {
      return {
        color: 'bg-gray-500',
        tooltip: 'No real-time connection',
        icon: '📭'
      };
    }
    
    if (status.isIdling && status.supportsIdle) {
      return {
        color: 'bg-green-500',
        tooltip: 'Real-time IDLE active',
        icon: '📡'
      };
    }
    
    if (status.isConnected && !status.supportsIdle) {
      return {
        color: 'bg-yellow-500',
        tooltip: 'Polling mode (no IDLE support)',
        icon: '🔄'
      };
    }
    
    if (status.isConnected) {
      return {
        color: 'bg-blue-500',
        tooltip: 'Connected (starting IDLE...)',
        icon: '⏳'
      };
    }
    
    return {
      color: 'bg-red-500',
      tooltip: 'Connection error',
      icon: '❌'
    };
  };
  console.log('Sidebar render - accounts.length:', appState.accounts.length);
  console.log('Sidebar render - currentEmails sample:', currentEmails.slice(0, 2));
  console.log('🔍 DEBUG: About to render', currentEmails.length, 'emails in sidebar');
  
  return (
    <div className="w-80 h-full bg-gray-800/90 backdrop-blur-sm border-r border-gray-700/50 relative z-10 flex flex-col">
      {/* Header Section */}
      <header className="p-6 border-b border-gray-700/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Mailflow</h1>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onNewEmail}
              className="p-2 text-teal-400 hover:text-teal-300 transition-colors rounded-lg hover:bg-teal-600/20 border border-teal-600/30"
              title="Compose New Email"
              disabled={!appState.selectedAccount}
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-700/50"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Account Switcher */}
        <div className="space-y-2">
          {appState.accounts.map((account: any) => (
            <button
              key={account.id}
              onClick={() => {
                const newState = { ...appState, selectedAccount: account.id };
                setAppState(newState);
                AppStateStorage.save(newState);
              }}
              className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                appState.selectedAccount === account.id
                  ? 'bg-gradient-to-r from-teal-600/20 to-purple-600/20 border border-teal-500/30'
                  : 'hover:bg-gray-700/30'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: account.color }}
                />
                <div className="text-left">
                  <p className="text-white font-medium text-sm">{account.name}</p>
                  <div className="flex items-center space-x-2">
                    <p className="text-gray-400 text-xs">{account.email}</p>
                    {(() => {
                      const idleIndicator = getIdleStatusIndicator(account.id);
                      return (
                        <div 
                          className={`w-2 h-2 rounded-full ${idleIndicator.color}`}
                          title={idleIndicator.tooltip}
                        />
                      );
                    })()}
                  </div>
                </div>
              </div>
              {account.unreadCount > 0 && (
                <span 
                  className="px-2 py-1 text-xs font-semibold rounded-full text-white"
                  style={{ backgroundColor: '#d66800' }}
                >
                  {account.unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>
      
      {/* Email List Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              {appState.accounts.find((a: any) => a.id === appState.selectedAccount)?.name || 'Inbox'}
              <span className="text-sm text-gray-400 ml-2">({currentEmails.length})</span>
            </h2>
            <div className="flex items-center space-x-2">
              {isLoadingEmails && (
                <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />
              )}
              {/* Refresh buttons */}
              {appState.selectedAccount && refreshEmails && (
                <>
                  {/* Force refresh button (full IMAP) */}
                  <button
                    onClick={refreshEmails}
                    disabled={isLoadingEmails}
                    className="p-1.5 text-gray-400 hover:text-teal-400 transition-colors rounded-lg hover:bg-gray-700/50 disabled:opacity-50"
                    title="Force refresh from IMAP server"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </>
              )}
              {emailLoadError && refreshEmails && (
                <button
                  onClick={refreshEmails}
                  disabled={isLoadingEmails}
                  className="p-1.5 text-orange-400 hover:text-orange-300 transition-colors rounded-lg hover:bg-orange-900/20 disabled:opacity-50"
                  title="Retry loading emails"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          {emailLoadError && (
            <div className="mb-4 p-3 bg-orange-900/20 border border-orange-600/30 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-orange-300 text-sm font-medium mb-1">Email Loading Issue</p>
                  <p className="text-orange-200 text-xs mb-2">{emailLoadError}</p>
                  {emailLoadError.includes('IMAP') && (
                    <div className="text-orange-200 text-xs">
                      <p className="mb-1">• Check your internet connection</p>
                      <p className="mb-1">• Verify IMAP server settings</p>
                      <p>• Account password may have changed</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-2">

            
            {appState.accounts.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400">No accounts configured</p>
                <p className="text-gray-500 text-sm">Add an email account to get started</p>
              </div>
            ) : currentEmails.length === 0 && !isLoadingEmails ? (
              <div className="text-center py-8">
                <Mail className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400">No emails found</p>
                <p className="text-gray-500 text-sm">
                  {emailLoadError ? 'Connection failed - check settings' : 'Mailbox may be empty or try refreshing'}
                </p>
              </div>
            ) : (
              currentEmails.map((email) => (
              <button
                key={email.id}
                onClick={async () => {
                  console.log('📧 Email clicked, starting content load immediately...');
                  
                  // Set the selected email first
                  setSelectedEmail(email);
                  
                  // Start loading content immediately (non-blocking)
                  const contentLoadPromise = loadEmailContent ? loadEmailContent(email) : Promise.resolve();
                  
                  // Mark email as read in parallel (non-blocking)
                  if (!email.isRead && markEmailAsRead) {
                    markEmailAsRead(email).catch(error => {
                      console.warn('⚠️ Failed to mark email as read:', error);
                    });
                  }
                  
                  // Wait for content load to complete
                  try {
                    await contentLoadPromise;
                  } catch (error) {
                    console.error('❌ Failed to load email content:', error);
                  }
                }}
                disabled={isLoadingEmailContent}
                className={`w-full text-left p-4 rounded-lg transition-all border relative ${
                  selectedEmail?.id === email.id
                    ? 'bg-gray-700/50 border-gray-600'
                    : 'hover:bg-gray-700/30 border-transparent'
                } ${!email.isRead ? 'bg-gray-700/20' : ''}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <p className={`font-medium text-sm ${!email.isRead ? 'text-white' : 'text-gray-300'}`}>
                    {email.from.name}
                  </p>
                  <span className="text-xs text-gray-400">{formatDate(email.date)}</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <p className={`text-sm flex-1 ${!email.isRead ? 'text-white font-medium' : 'text-gray-300'}`}>
                    {email.subject}
                  </p>
                  {email.hasAttachments && (
                    <Paperclip className="w-3 h-3 text-gray-400" />
                  )}
                </div>
                <p className="text-xs text-gray-400 line-clamp-2">{email.preview}</p>
                {!email.isRead && (
                  <div className="w-2 h-2 bg-orange-500 rounded-full absolute top-4 left-2" />
                )}
              </button>
            ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;