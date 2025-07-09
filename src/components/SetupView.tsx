/**
 * SetupView Component
 * 
 * Initial setup screen for new users to create their master password.
 * This component handles the first-time user experience where users:
 * - Create a master password for the application
 * - Confirm the password to ensure accuracy
 * - Validate password strength and matching
 * 
 * Props:
 * - appState: Current application state
 * - setAppState: Function to update application state
 * - showPassword: Boolean to toggle password visibility
 * - setShowPassword: Function to toggle password visibility
 * - errors: Object containing validation errors
 * - handleSetup: Function called when setup is complete
 */

import React from 'react';
import { Mail, Eye, EyeOff, Upload } from 'lucide-react';
import GrainTexture from './GrainTexture';
import { SetupViewProps } from '../types';
import { AccountStorage, SettingsStorage } from '../utils/storage';

const SetupView: React.FC<SetupViewProps> = ({
  appState,
  setAppState,
  showPassword,
  setShowPassword,
  errors,
  handleSetup
}) => {
  const handleImportSettings = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target?.result as string);
            if (data.accounts) AccountStorage.save(data.accounts);
            if (data.settings) SettingsStorage.save(data.settings);
            alert('Settings imported successfully! Please complete setup to continue.');
          } catch (error) {
            alert('Failed to import settings. Please check the file format.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#111111' }}>
      <GrainTexture />
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl p-8 w-full max-w-md border border-gray-700/50 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-teal-600 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Welcome to MailFlow</h1>
            <p className="text-gray-400">Set up your secure email client</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Master Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={appState.setupData.password}
                  onChange={(e) => setAppState(prev => ({
                    ...prev,
                    setupData: { ...prev.setupData, password: e.target.value }
                  }))}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all pr-12"
                  placeholder="Create a strong password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="text-orange-400 text-sm mt-1">{errors.password}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
              <input
                type="password"
                value={appState.setupData.confirmPassword}
                onChange={(e) => setAppState(prev => ({
                  ...prev,
                  setupData: { ...prev.setupData, confirmPassword: e.target.value }
                }))}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                placeholder="Confirm your password"
              />
              {errors.confirmPassword && <p className="text-orange-400 text-sm mt-1">{errors.confirmPassword}</p>}
            </div>
            
            <button
              onClick={handleSetup}
              className="w-full py-3 bg-gradient-to-r from-teal-600 to-purple-600 text-white font-semibold rounded-lg hover:from-teal-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Create Account
            </button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-800/80 text-gray-400">Or</span>
              </div>
            </div>
            
            <button
              onClick={handleImportSettings}
              className="w-full py-3 bg-gray-700/50 text-gray-300 font-medium rounded-lg hover:bg-gray-700 transition-all duration-200 border border-gray-600 flex items-center justify-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>Import Existing Settings</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupView;