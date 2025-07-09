/**
 * Setup Wizard - n8n-style initial setup flow
 * 
 * Guides users through the initial setup process for self-hosted
 * Mailflow instances including admin account creation and configuration.
 */

import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { apiConfig } from '../../config/api';
import GrainTexture from '../GrainTexture';
import WelcomeStep from './WelcomeStep';
import AdminStep from './AdminStep';
import ConfigStep from './ConfigStep';
import CompleteStep from './CompleteStep';

export interface SetupStatus {
  needsSetup: boolean;
  step?: 'welcome' | 'admin' | 'config' | 'complete';
  instanceId?: string;
  version?: string;
}

export interface SetupData {
  admin: {
    email: string;
    password: string;
    confirmPassword: string;
    instanceName: string;
  };
  config: {
    instanceName: string;
    timezone: string;
    features: {
      multiUser: boolean;
      invitations: boolean;
      backups: boolean;
    };
    smtp?: {
      enabled: boolean;
      host: string;
      port: number;
      secure: boolean;
      user: string;
      password: string;
    };
  };
}

const SetupWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<'welcome' | 'admin' | 'config' | 'complete'>('welcome');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  const [setupData, setSetupData] = useState<SetupData>({
    admin: {
      email: '',
      password: '',
      confirmPassword: '',
      instanceName: 'My Mailflow Instance'
    },
    config: {
      instanceName: 'My Mailflow Instance',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      features: {
        multiUser: true,
        invitations: true,
        backups: true
      },
      smtp: {
        enabled: false,
        host: '',
        port: 587,
        secure: true,
        user: '',
        password: ''
      }
    }
  });

  /**
   * Check setup status on component mount
   */
  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${apiConfig.setup.status}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to check setup status');
      }

      setSetupStatus(data);

      // If setup is complete, redirect to login
      if (!data.needsSetup) {
        window.location.href = '/login';
        return;
      }

      // Set current step based on status
      setCurrentStep(data.step || 'welcome');

      console.log('🔧 Setup status:', data);
    } catch (error) {
      console.error('Failed to check setup status:', error);
      setError(error instanceof Error ? error.message : 'Failed to check setup status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStepComplete = (step: string, data: any) => {
    switch (step) {
      case 'welcome':
        setCurrentStep('admin');
        break;
      
      case 'admin':
        // Store admin token for authenticated requests
        if (data.accessToken) {
          setAdminToken(data.accessToken);
          localStorage.setItem('mailflow_access_token', data.accessToken);
        }
        // Update setup data with admin info
        setSetupData(prev => ({
          ...prev,
          admin: { ...prev.admin, ...data.user },
          config: { ...prev.config, instanceName: data.user.instanceName || prev.config.instanceName }
        }));
        setCurrentStep('config');
        break;
      
      case 'config':
        setCurrentStep('complete');
        break;
      
      case 'complete':
        // Redirect to main application
        window.location.href = '/';
        break;
    }
  };

  const handleError = (error: string) => {
    setError(error);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <WelcomeStep
            setupStatus={setupStatus}
            onNext={() => handleStepComplete('welcome', {})}
            onError={handleError}
          />
        );
      
      case 'admin':
        return (
          <AdminStep
            setupData={setupData.admin}
            onNext={(data) => handleStepComplete('admin', data)}
            onError={handleError}
          />
        );
      
      case 'config':
        return (
          <ConfigStep
            setupData={setupData.config}
            adminToken={adminToken}
            onNext={(data) => handleStepComplete('config', data)}
            onError={handleError}
          />
        );
      
      case 'complete':
        return (
          <CompleteStep
            setupData={setupData}
            adminToken={adminToken}
            onNext={() => handleStepComplete('complete', {})}
            onError={handleError}
          />
        );
      
      default:
        return null;
    }
  };

  const getStepNumber = (step: string): number => {
    const steps = ['welcome', 'admin', 'config', 'complete'];
    return steps.indexOf(step) + 1;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center" style={{ backgroundColor: '#111111' }}>
        <GrainTexture />
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-teal-600 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Initializing Mailflow</h1>
          <p className="text-gray-400">Checking setup status...</p>
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
          <h1 className="text-2xl font-bold text-white mb-2">Setup Error</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={checkSetupStatus}
            className="px-6 py-3 bg-gradient-to-r from-teal-600 to-purple-600 text-white font-semibold rounded-lg hover:from-teal-700 hover:to-purple-700 transition-all duration-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#111111' }}>
      <GrainTexture />
      
      {/* Progress indicator */}
      <div className="relative z-10 pt-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-4">
              {['welcome', 'admin', 'config', 'complete'].map((step, index) => {
                const stepNumber = index + 1;
                const currentStepNumber = getStepNumber(currentStep);
                const isActive = stepNumber === currentStepNumber;
                const isCompleted = stepNumber < currentStepNumber;
                
                return (
                  <div key={step} className="flex items-center">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                      ${isCompleted ? 'bg-green-600 text-white' : 
                        isActive ? 'bg-gradient-to-r from-teal-600 to-purple-600 text-white' : 
                        'bg-gray-700 text-gray-400'}
                    `}>
                      {isCompleted ? <CheckCircle className="w-5 h-5" /> : stepNumber}
                    </div>
                    
                    {index < 3 && (
                      <div className={`
                        w-12 h-1 mx-2
                        ${stepNumber < currentStepNumber ? 'bg-green-600' : 'bg-gray-700'}
                      `} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
      {/* Step content */}
      <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-200px)] px-4">
        {renderStep()}
      </div>
    </div>
  );
};

export default SetupWizard;