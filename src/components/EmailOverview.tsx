/**
 * Email Overview Component
 * 
 * Main email client interface showing accounts, email list, and email content.
 * This is a simplified version that works with the current JWT authentication system.
 */

import React, { useState } from 'react';
import { Mail, Settings, Plus, User, LogOut } from 'lucide-react';
import { GrainTexture } from './index';
import { useJWTAuth } from '../hooks/useJWTAuth';

interface EmailOverviewProps {
  onNavigateWelcome: () => void;
}

const EmailOverview: React.FC<EmailOverviewProps> = ({ onNavigateWelcome }) => {
  const auth = useJWTAuth();
  const [selectedEmail, setSelectedEmail] = useState<any>(null);

  // Mock data for demonstration (will be replaced with real data later)
  const mockAccounts = [
    { id: '1', name: 'Primary Account', email: auth.user?.email, unreadCount: 3 }
  ];

  const mockEmails = [
    {
      id: '1',
      subject: 'Welcome to MailFlow!',
      sender: 'MailFlow Team <team@mailflow.com>',
      preview: 'Thank you for setting up your MailFlow instance...',
      date: new Date(),
      isRead: false
    },
    {
      id: '2', 
      subject: 'Getting Started Guide',
      sender: 'Support <support@mailflow.com>',
      preview: 'Here are some tips to get the most out of MailFlow...',
      date: new Date(Date.now() - 86400000),
      isRead: true
    }
  ];

  const handleLogout = () => {
    auth.logout();
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="min-h-screen relative flex" style={{ backgroundColor: '#111111' }}>
      <GrainTexture />
      
      {/* Sidebar */}
      <div className="relative z-10 w-80 bg-gray-900/50 backdrop-blur-sm border-r border-gray-700/50 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white">MailFlow</h1>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={onNavigateWelcome}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                title="User Info"
              >
                <User className="w-5 h-5" />
              </button>
              <button
                onClick={() => alert('Settings coming soon')}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <button
            onClick={() => alert('Email composition coming soon')}
            className="w-full py-2 px-4 bg-gradient-to-r from-teal-600 to-purple-600 text-white font-semibold rounded-lg hover:from-teal-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Compose</span>
          </button>
        </div>

        {/* Account Selection */}
        <div className="p-4 border-b border-gray-700/50">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Accounts</h3>
          {mockAccounts.map(account => (
            <div
              key={account.id}
              className="p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">{account.name}</div>
                  <div className="text-gray-400 text-sm">{account.email}</div>
                </div>
                {account.unreadCount > 0 && (
                  <div className="w-5 h-5 bg-teal-600 text-white text-xs rounded-full flex items-center justify-center">
                    {account.unreadCount}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          <button
            onClick={() => alert('Add account functionality coming soon')}
            className="w-full mt-2 py-2 px-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors flex items-center justify-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Account</span>
          </button>
        </div>

        {/* Email List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Inbox</h3>
            <div className="space-y-1">
              {mockEmails.map(email => (
                <div
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedEmail?.id === email.id
                      ? 'bg-teal-600/20 border border-teal-600/30'
                      : 'hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className={`font-medium truncate ${!email.isRead ? 'text-white' : 'text-gray-300'}`}>
                      {email.sender.split('<')[0].trim()}
                    </div>
                    <div className="text-xs text-gray-400 ml-2">
                      {formatDate(email.date)}
                    </div>
                  </div>
                  <div className={`text-sm truncate mb-1 ${!email.isRead ? 'text-white' : 'text-gray-400'}`}>
                    {email.subject}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {email.preview}
                  </div>
                  {!email.isRead && (
                    <div className="w-2 h-2 bg-teal-600 rounded-full mt-1"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col">
        {selectedEmail ? (
          <div className="p-6">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6">
              <div className="border-b border-gray-700 pb-4 mb-4">
                <h2 className="text-xl font-semibold text-white mb-2">{selectedEmail.subject}</h2>
                <div className="text-gray-300">
                  <div>From: {selectedEmail.sender}</div>
                  <div>Date: {selectedEmail.date.toLocaleString()}</div>
                </div>
              </div>
              <div className="text-gray-300 leading-relaxed">
                <p>Welcome to your MailFlow self-hosted email client!</p>
                <br />
                <p>This is a demonstration of the email viewing interface. In the full implementation, this would show the actual email content loaded from your IMAP server.</p>
                <br />
                <p>Current features implemented:</p>
                <ul className="list-disc ml-6 mt-2">
                  <li>JWT Authentication System</li>
                  <li>Setup Wizard</li>
                  <li>Secure Login/Logout</li>
                  <li>Docker Deployment</li>
                  <li>Encrypted Data Storage</li>
                </ul>
                <br />
                <p>Coming soon:</p>
                <ul className="list-disc ml-6 mt-2">
                  <li>IMAP/SMTP Integration</li>
                  <li>Real Email Management</li>
                  <li>Account Configuration</li>
                  <li>Email Composition</li>
                </ul>
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-700 flex space-x-3">
                <button
                  onClick={() => alert('Reply functionality coming soon')}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                  Reply
                </button>
                <button
                  onClick={() => alert('Forward functionality coming soon')}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Forward
                </button>
                <button
                  onClick={() => alert('Delete functionality coming soon')}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <Mail className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Email Selected</h3>
              <p>Select an email from the sidebar to view its content</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailOverview;