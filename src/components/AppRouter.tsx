/**
 * App Router - Main application routing and setup detection
 * 
 * Handles routing between setup wizard and main application
 * based on instance configuration status.
 */

import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { apiConfig, debugApiConfig } from '../config/api';
import GrainTexture from './GrainTexture';
import SetupWizard from './setup/SetupWizard';
import LoginView from './LoginView';
import EmailClient from '../App'; // Our existing app
import { useJWTAuth } from '../hooks/useJWTAuth';

interface SetupStatus {
  needsSetup: boolean;
  step?: string;
  instanceId?: string;
  version?: string;
  message?: string;
}

const AppRouter: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const auth = useJWTAuth();

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Debug API configuration in development
      debugApiConfig();

      console.log('🔍 Checking setup status...');
      
      const response = await fetch(apiConfig.setup.status);
      
      if (!response.ok) {
        // If we can't reach the setup endpoint, assume server issues
        throw new Error(`Server responded with ${response.status}`);
      }

      const data: SetupStatus = await response.json();
      setSetupStatus(data);

      console.log('✅ Setup status checked:', data);
      
      if (data.needsSetup) {
        console.log(`🔧 Setup required - current step: ${data.step || 'welcome'}`);
      } else {
        console.log('✅ Instance is configured and ready');
      }
    } catch (error) {
      console.error('❌ Failed to check setup status:', error);
      setError(error instanceof Error ? error.message : 'Failed to check setup status');
    } finally {
      setIsLoading(false);
    }
  };


  if (isLoading) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center" style={{ backgroundColor: '#111111' }}>
        <GrainTexture />
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-teal-600 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Loading MailFlow</h1>
          <p className="text-gray-400">Checking instance status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center" style={{ backgroundColor: '#111111' }}>
        <GrainTexture />
        <div className="relative z-10 text-center max-w-md">
          <div className="w-16 h-16 bg-red-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Connection Error</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={checkSetupStatus}
              className="w-full px-6 py-3 bg-gradient-to-r from-teal-600 to-purple-600 text-white font-semibold rounded-lg hover:from-teal-700 hover:to-purple-700 transition-all duration-200"
            >
              Retry Connection
            </button>
            <p className="text-gray-500 text-sm">
              Make sure the MailFlow server is running
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!setupStatus) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center" style={{ backgroundColor: '#111111' }}>
        <GrainTexture />
        <div className="relative z-10 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Initializing...</h1>
        </div>
      </div>
    );
  }

  // Show setup wizard if setup is needed
  if (setupStatus.needsSetup) {
    return <SetupWizard />;
  }

  // Show loading if auth is still initializing
  if (auth.isLoading) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center" style={{ backgroundColor: '#111111' }}>
        <GrainTexture />
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-teal-600 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Loading MailFlow</h1>
          <p className="text-gray-400">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!auth.isAuthenticated) {
    return <LoginView />;
  }

  // Show main application if authenticated
  return <EmailClient />;
};

export default AppRouter;