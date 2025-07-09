/**
 * SettingsModal Component
 * 
 * Modal component for managing application settings and email accounts.
 * Features:
 * - Email account management (view, edit, delete accounts)
 * - General application settings (theme, emails per page)
 * - Import/Export functionality for settings
 * - Quick access to add new accounts
 * 
 * This component provides a centralized location for all user preferences
 * and account management tasks.
 * 
 * Props:
 * - showSettings: Boolean to control modal visibility
 * - setShowSettings: Function to close the settings modal
 * - appState: Current application state containing accounts and settings
 * - setShowAddAccount: Function to open the add account modal
 */

import React, { useState } from 'react';
import { X, Plus, Edit3, Trash2, Moon, Download, Upload, Settings, LogOut, User } from 'lucide-react';
import { AccountApi, SettingsApi, ImportExportApi } from '../utils/api';
import { apiConfig, envInfo } from '../config/api';

interface SettingsModalProps {
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  appState: any;
  auth: any;
  onAddAccount: () => void;
  onEditAccount: (account: any) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  showSettings,
  setShowSettings,
  appState,
  auth,
  onAddAccount,
  onEditAccount
}) => {
  const [settings, setSettings] = useState(appState.settings);
  
  if (!showSettings) return null;
  
  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      auth.logout();
    }
  };
  
  const handleDeleteAccount = async (accountId: string) => {
    if (confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
      try {
        await AccountApi.remove(accountId);
        // Trigger a page reload to refresh the account list
        window.location.reload();
      } catch (error) {
        console.error('Failed to delete account:', error);
        alert('Failed to delete account');
      }
    }
  };
  
  const handleSettingChange = async (key: keyof typeof settings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    try {
      await SettingsApi.save(newSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };
  
  const handleExportSettings = async () => {
    try {
      const exportData = await ImportExportApi.export();
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mailflow-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export settings:', error);
      alert('Failed to export settings');
    }
  };

  const handleImportSettings = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const importData = JSON.parse(event.target?.result as string);
            
            if (importData.accounts && importData.settings) {
              if (confirm('This will replace all current accounts and settings. Continue?')) {
                try {
                  await ImportExportApi.import(importData);
                  window.location.reload();
                } catch (error) {
                  console.error('Failed to import settings:', error);
                  alert('Failed to import settings');
                }
              }
            } else {
              alert('Invalid settings file format');
            }
          } catch (error) {
            alert('Failed to import settings: Invalid file');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="bg-gray-800/95 backdrop-blur-sm rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-700/50 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <h2 className="text-xl font-semibold text-white">Settings</h2>
          <button
            onClick={() => setShowSettings(false)}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-700/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* User Information Section */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
              <User className="w-5 h-5" />
              <span>User Account</span>
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg border border-gray-600/30">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-purple-600 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{auth.user?.email || 'Administrator'}</p>
                    <p className="text-gray-400 text-sm">Logged in user</p>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg hover:bg-red-600/30 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
          
          {/* Email Accounts Management Section */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <h3 className="text-lg font-semibold text-white mb-4">Email Accounts</h3>
            <div className="space-y-4">
              {appState.accounts.map((account: any) => (
                <div key={account.id} className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg border border-gray-600/30">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: account.color }}
                    />
                    <div>
                      <p className="text-white font-medium">{account.name}</p>
                      <p className="text-gray-400 text-sm">{account.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => onEditAccount(account)}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                      title="Edit Account"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteAccount(account.id)}
                      className="p-2 text-gray-400 hover:text-orange-400 transition-colors"
                      title="Delete Account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button 
                onClick={() => {
                  onAddAccount();
                  setShowSettings(false);
                }}
                className="w-full p-4 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition-all flex items-center justify-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>Add Email Account</span>
              </button>
            </div>
          </div>
          
          {/* General Settings Section */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <h3 className="text-lg font-semibold text-white mb-4">General Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Theme</span>
                <button className="flex items-center space-x-2 px-3 py-2 bg-gray-700/50 rounded-lg text-gray-300">
                  <Moon className="w-4 h-4" />
                  <span>Dark</span>
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Emails per page</span>
                <select 
                  value={settings.emailsPerPage}
                  onChange={(e) => handleSettingChange('emailsPerPage', parseInt(e.target.value))}
                  className="px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Auto-refresh interval</span>
                <select 
                  value={settings.autoRefresh}
                  onChange={(e) => handleSettingChange('autoRefresh', parseInt(e.target.value))}
                  className="px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white"
                >
                  <option value={0}>Never</option>
                  <option value={1}>1 minute</option>
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                </select>
              </div>
            </div>
          </div>
          
          {/* Import/Export Section */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <h3 className="text-lg font-semibold text-white mb-4">Import/Export Settings</h3>
            <div className="flex space-x-4">
              <button 
                onClick={handleExportSettings}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600/20 text-purple-400 border border-purple-600/30 rounded-lg hover:bg-purple-600/30 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export Settings</span>
              </button>
              <button 
                onClick={handleImportSettings}
                className="flex items-center space-x-2 px-4 py-2 bg-teal-600/20 text-teal-400 border border-teal-600/30 rounded-lg hover:bg-teal-600/30 transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>Import Settings</span>
              </button>
            </div>
            <div className="space-y-2 mt-4">
              <p className="text-gray-400 text-sm">
                <strong>Export:</strong> Save your accounts and settings to a file for backup or transfer.
              </p>
              <p className="text-gray-400 text-sm">
                <strong>Import:</strong> Restore accounts and settings from a previously exported file.
              </p>
            </div>
          </div>
          
          {/* Development Info Section - Only show in development */}
          {envInfo.isDevelopment && (
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>Development Info</span>
              </h3>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-gray-400 font-medium">Mode:</div>
                    <div className="text-white">{envInfo.mode}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 font-medium">API Base:</div>
                    <div className="text-white font-mono text-xs">{apiConfig.baseUrl}</div>
                  </div>
                </div>
                
                <div>
                  <div className="text-gray-400 font-medium">Application:</div>
                  <div className="text-white">{apiConfig.appName} v{apiConfig.appVersion}</div>
                </div>
                
                <div className="border-t border-gray-600 pt-3">
                  <div className="text-gray-400 font-medium mb-2">Environment Variables:</div>
                  <div className="space-y-1 font-mono text-xs">
                    <div><span className="text-gray-500">VITE_API_BASE_URL:</span> <span className="text-white">{import.meta.env.VITE_API_BASE_URL || 'undefined'}</span></div>
                    <div><span className="text-gray-500">VITE_APP_NAME:</span> <span className="text-white">{import.meta.env.VITE_APP_NAME || 'undefined'}</span></div>
                  </div>
                </div>
                
                <div className="border-t border-gray-600 pt-3">
                  <div className="text-gray-400 font-medium mb-2">Computed URLs:</div>
                  <div className="space-y-1 font-mono text-xs">
                    <div><span className="text-gray-500">Accounts:</span> <span className="text-white">{apiConfig.accounts}</span></div>
                    <div><span className="text-gray-500">Health:</span> <span className="text-white">{apiConfig.health}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Logout Section */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
              <LogOut className="w-5 h-5" />
              <span>Account</span>
            </h3>
            <div className="space-y-4">
              <div className="text-sm text-gray-400 mb-4">
                Sign out of your MailFlow account. You will need to enter your password again to access the application.
              </div>
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to logout?')) {
                    auth.logout();
                  }
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg hover:bg-red-600/30 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;