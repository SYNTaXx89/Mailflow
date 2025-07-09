/**
 * Complete Step - Setup completion
 * 
 * Final step that completes the setup process and welcomes users
 * to their new Mailflow instance.
 */

import React, { useState, useEffect } from 'react';
import { CheckCircle, Mail, Loader2, ExternalLink, Users, Shield, Zap } from 'lucide-react';
import { apiConfig } from '../../config/api';

interface CompleteStepProps {
  setupData: any;
  adminToken: string | null;
  onNext: () => void;
  onError: (error: string) => void;
}

const CompleteStep: React.FC<CompleteStepProps> = ({ setupData, adminToken, onNext, onError }) => {
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [finalConfig, setFinalConfig] = useState<any>(null);

  useEffect(() => {
    completeSetup();
  }, []);

  const completeSetup = async () => {
    setIsCompleting(true);
    
    try {
      const response = await fetch(`${apiConfig.baseUrl}/setup/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to complete setup');
      }

      setFinalConfig(data.config);
      setIsCompleted(true);
      
      console.log('🎉 Setup completed successfully!');
    } catch (error) {
      console.error('Setup completion failed:', error);
      onError(error instanceof Error ? error.message : 'Failed to complete setup');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleContinue = () => {
    // Clear the access token from localStorage since we'll need to login properly
    localStorage.removeItem('mailflow_access_token');
    onNext();
  };

  if (isCompleting) {
    return (
      <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl p-8 w-full max-w-lg border border-gray-700/50 shadow-2xl text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-teal-600 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-6">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-4">Finalizing Setup</h1>
        <p className="text-gray-400">
          Completing your Mailflow instance configuration...
        </p>
      </div>
    );
  }

  if (!isCompleted || !finalConfig) {
    return null;
  }

  return (
    <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl p-8 w-full max-w-2xl border border-gray-700/50 shadow-2xl">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-green-600 rounded-xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">
          🎉 Welcome to Mailflow!
        </h1>
        <p className="text-gray-400 text-lg">
          Your self-hosted email client is ready to use
        </p>
      </div>

      {/* Instance Summary */}
      <div className="bg-gray-700/50 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Mail className="w-5 h-5 mr-2" />
          Instance Summary
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Instance Name:</span>
            <div className="text-white font-medium">{finalConfig.instanceName}</div>
          </div>
          
          <div>
            <span className="text-gray-400">Instance ID:</span>
            <div className="text-white font-mono text-xs">{finalConfig.instanceId}</div>
          </div>
          
          <div>
            <span className="text-gray-400">Version:</span>
            <div className="text-white font-medium">{finalConfig.version}</div>
          </div>
          
          <div>
            <span className="text-gray-400">Setup Completed:</span>
            <div className="text-white font-medium">
              {new Date(finalConfig.completedAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      {/* Features Summary */}
      <div className="bg-gray-700/50 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-white mb-4">Enabled Features</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
              finalConfig.features?.multiUser ? 'bg-green-600' : 'bg-gray-600'
            }`}>
              <Users className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-white font-medium">Multi-User</div>
              <div className="text-gray-400 text-sm">
                {finalConfig.features?.multiUser ? 'Enabled' : 'Disabled'}
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
              finalConfig.features?.invitations ? 'bg-green-600' : 'bg-gray-600'
            }`}>
              <Mail className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-white font-medium">Invitations</div>
              <div className="text-gray-400 text-sm">
                {finalConfig.features?.invitations ? 'Enabled' : 'Disabled'}
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
              finalConfig.features?.backups ? 'bg-green-600' : 'bg-gray-600'
            }`}>
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-white font-medium">Backups</div>
              <div className="text-gray-400 text-sm">
                {finalConfig.features?.backups ? 'Enabled' : 'Disabled'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-blue-300 mb-4 flex items-center">
          <Zap className="w-5 h-5 mr-2" />
          Next Steps
        </h3>
        
        <ul className="space-y-3 text-blue-200">
          <li className="flex items-start">
            <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3" />
            <div>
              <div className="font-medium">Login with your admin account</div>
              <div className="text-sm text-blue-300">
                Use the email and password you just created
              </div>
            </div>
          </li>
          
          <li className="flex items-start">
            <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3" />
            <div>
              <div className="font-medium">Add your email accounts</div>
              <div className="text-sm text-blue-300">
                Connect your Gmail, Outlook, or other email providers
              </div>
            </div>
          </li>
          
          <li className="flex items-start">
            <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3" />
            <div>
              <div className="font-medium">Invite team members</div>
              <div className="text-sm text-blue-300">
                Share access with your team (if multi-user is enabled)
              </div>
            </div>
          </li>
        </ul>
      </div>

      {/* Admin Info */}
      <div className="bg-yellow-600/20 border border-yellow-500/50 rounded-lg p-4 mb-8">
        <div className="flex items-start">
          <Shield className="w-5 h-5 text-yellow-400 mt-0.5 mr-3" />
          <div>
            <div className="text-yellow-300 font-medium mb-1">Admin Account Created</div>
            <div className="text-yellow-200 text-sm">
              You can manage users, settings, and instance configuration from the admin panel.
              Your admin email: <span className="font-mono">{setupData.admin.email}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={handleContinue}
          className="px-8 py-3 bg-gradient-to-r from-teal-600 to-purple-600 text-white font-semibold rounded-lg hover:from-teal-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center"
        >
          Continue to Mailflow
          <ExternalLink className="w-5 h-5 ml-2" />
        </button>
      </div>
    </div>
  );
};

export default CompleteStep;