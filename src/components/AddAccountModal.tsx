/**
 * AddAccountModal Component
 * 
 * Modal component for adding new email accounts to the application.
 * Features:
 * - Account information form (name, email, password)
 * - IMAP settings for incoming mail (server, port, security)
 * - SMTP settings for outgoing mail (server, port, security)
 * - Auto-detection of common email provider settings
 * - Connection testing functionality
 * - Form validation before saving
 * 
 * This component removes the duplicate code that was present in the original App.tsx
 * and provides a clean, single implementation for account management.
 * 
 * Props:
 * - showAddAccount: Boolean to control modal visibility
 * - setShowAddAccount: Function to close the modal
 * - newAccountData: Current form data for the new account
 * - setNewAccountData: Function to update form data
 * - isTestingConnection: Boolean indicating connection test status
 * - testConnection: Function to test email server connection
 * - saveAccount: Function to save the new account
 * - autoDetectSettings: Function to auto-detect provider settings
 */

import React, { useState } from 'react';
import { X, Plus, Check, Eye, EyeOff } from 'lucide-react';
import { AddAccountModalProps } from '../types';

interface ExtendedAddAccountModalProps extends AddAccountModalProps {
  editingAccount?: any; // Account being edited, null for new account
}

const AddAccountModal: React.FC<ExtendedAddAccountModalProps> = ({
  showAddAccount,
  setShowAddAccount,
  newAccountData,
  setNewAccountData,
  isTestingConnection,
  testConnection,
  saveAccount,
  autoDetectSettings,
  editingAccount
}) => {
  const [showPassword, setShowPassword] = useState(false);
  
  if (!showAddAccount) return null;
  
  const isEditing = !!editingAccount;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800/95 backdrop-blur-sm rounded-2xl w-full max-w-2xl h-[90vh] border border-gray-700/50 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50 flex-shrink-0">
          <h2 className="text-xl font-semibold text-white">
            {isEditing ? 'Edit Email Account' : 'Add Email Account'}
          </h2>
          <button
            onClick={() => setShowAddAccount(false)}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-700/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Account Information Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">Account Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Display Name *</label>
                <input
                  type="text"
                  value={newAccountData.name}
                  onChange={(e) => setNewAccountData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                  placeholder="Work Email, Client ABC, etc."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email Address *</label>
                <input
                  type="email"
                  value={newAccountData.email}
                  onChange={(e) => {
                    const email = e.target.value;
                    setNewAccountData(prev => ({ ...prev, email }));
                    if (email.includes('@')) {
                      autoDetectSettings(email);
                    }
                  }}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                  placeholder="your@email.com"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
                <input
                  type="text"
                  value={newAccountData.username}
                  onChange={(e) => setNewAccountData(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                  placeholder="Login username (if different from email)"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newAccountData.password}
                    onChange={(e) => setNewAccountData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-4 py-3 pr-12 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                    placeholder="Email account password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* IMAP Settings Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">IMAP Settings (Incoming Mail)</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">IMAP Server</label>
                <input
                  type="text"
                  value={newAccountData.imapHost}
                  onChange={(e) => setNewAccountData(prev => ({ ...prev, imapHost: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                  placeholder="imap.example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Port</label>
                <input
                  type="number"
                  value={newAccountData.imapPort}
                  onChange={(e) => setNewAccountData(prev => ({ ...prev, imapPort: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                  placeholder="993"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Security</label>
              <select
                value={newAccountData.imapSecurity}
                onChange={(e) => setNewAccountData(prev => ({ ...prev, imapSecurity: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              >
                <option value="SSL/TLS">SSL/TLS</option>
                <option value="STARTTLS">STARTTLS</option>
                <option value="None">None (Not Recommended)</option>
              </select>
            </div>
          </div>

          {/* SMTP Settings Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">SMTP Settings (Outgoing Mail)</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">SMTP Server</label>
                <input
                  type="text"
                  value={newAccountData.smtpHost}
                  onChange={(e) => setNewAccountData(prev => ({ ...prev, smtpHost: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                  placeholder="smtp.example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Port</label>
                <input
                  type="number"
                  value={newAccountData.smtpPort}
                  onChange={(e) => setNewAccountData(prev => ({ ...prev, smtpPort: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                  placeholder="587"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Security</label>
              <select
                value={newAccountData.smtpSecurity}
                onChange={(e) => setNewAccountData(prev => ({ ...prev, smtpSecurity: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              >
                <option value="STARTTLS">STARTTLS</option>
                <option value="SSL/TLS">SSL/TLS</option>
                <option value="None">None (Not Recommended)</option>
              </select>
            </div>
          </div>

          {/* Help Section */}
          <div className="bg-teal-600/10 border border-teal-600/30 rounded-lg p-4">
            <p className="text-teal-400 text-sm">
              <strong>Tip:</strong> For Gmail, Outlook, Yahoo, and iCloud, settings are auto-detected when you enter your email address. You may need to use an app-specific password instead of your regular password.
            </p>
          </div>
        </div>
        
        {/* Footer with action buttons */}
        <div className="flex items-center justify-between p-6 border-t border-gray-700/50 flex-shrink-0">
          <button
            onClick={testConnection}
            disabled={isTestingConnection || !newAccountData.email || !newAccountData.password}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600/20 text-purple-400 border border-purple-600/30 rounded-lg hover:bg-purple-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTestingConnection ? (
              <>
                <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                <span>Testing...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Test Connection</span>
              </>
            )}
          </button>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowAddAccount(false)}
              className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveAccount}
              className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-teal-600 to-purple-600 text-white font-semibold rounded-lg hover:from-teal-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {isEditing ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{isEditing ? 'Update Account' : 'Add Account'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddAccountModal;