/**
 * Environment Info Debug Component
 * 
 * Shows environment variables and API configuration in development mode.
 * Useful for debugging environment variable setup.
 */

import React from 'react';
import { apiConfig, envInfo } from '../../config/api';

interface EnvInfoProps {
  className?: string;
}

const EnvInfo: React.FC<EnvInfoProps> = ({ className = '' }) => {
  // Only show in development
  if (!envInfo.isDevelopment) {
    return null;
  }

  return (
    <div className={`fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-lg text-xs max-w-sm ${className}`}>
      <div className="font-bold mb-2">🔧 Environment Info</div>
      
      <div className="space-y-1">
        <div><strong>Mode:</strong> {envInfo.mode}</div>
        <div><strong>API Base:</strong> {apiConfig.baseUrl}</div>
        <div><strong>App:</strong> {apiConfig.appName} v{apiConfig.appVersion}</div>
        
        <div className="border-t border-gray-600 mt-2 pt-2">
          <div className="font-semibold">Environment Variables:</div>
          <div>VITE_API_BASE_URL: {import.meta.env.VITE_API_BASE_URL || 'undefined'}</div>
          <div>VITE_APP_NAME: {import.meta.env.VITE_APP_NAME || 'undefined'}</div>
        </div>
        
        <div className="border-t border-gray-600 mt-2 pt-2">
          <div className="font-semibold">Computed URLs:</div>
          <div>Accounts: {apiConfig.accounts}</div>
          <div>Health: {apiConfig.health}</div>
        </div>
      </div>
    </div>
  );
};

export default EnvInfo;