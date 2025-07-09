/**
 * Welcome Step - Setup wizard introduction
 * 
 * First step of the setup wizard that welcomes users and explains
 * the self-hosted MailFlow setup process.
 */

import React from 'react';
import { Mail, Shield, Server, Users } from 'lucide-react';

interface WelcomeStepProps {
  setupStatus: any;
  onNext: () => void;
  onError: (error: string) => void;
}

const WelcomeStep: React.FC<WelcomeStepProps> = ({ setupStatus, onNext }) => {
  return (
    <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl p-8 w-full max-w-2xl border border-gray-700/50 shadow-2xl">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-gradient-to-br from-teal-600 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-6">
          <Mail className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">Welcome to MailFlow</h1>
        <p className="text-gray-400 text-lg">
          Your self-hosted, privacy-first email client
        </p>
      </div>

      <div className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-teal-600/20 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Shield className="w-6 h-6 text-teal-400" />
            </div>
            <h3 className="font-semibold text-white mb-2">Privacy First</h3>
            <p className="text-gray-400 text-sm">
              Your emails and credentials never leave your server
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Server className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="font-semibold text-white mb-2">Self-Hosted</h3>
            <p className="text-gray-400 text-sm">
              Complete control over your email infrastructure
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="font-semibold text-white mb-2">Multi-User</h3>
            <p className="text-gray-400 text-sm">
              Support for teams and organizations
            </p>
          </div>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-white mb-3">What we'll set up:</h3>
          <ul className="space-y-2 text-gray-300">
            <li className="flex items-center">
              <div className="w-2 h-2 bg-teal-400 rounded-full mr-3" />
              Create your admin account
            </li>
            <li className="flex items-center">
              <div className="w-2 h-2 bg-teal-400 rounded-full mr-3" />
              Configure instance settings
            </li>
            <li className="flex items-center">
              <div className="w-2 h-2 bg-teal-400 rounded-full mr-3" />
              Set up optional features
            </li>
            <li className="flex items-center">
              <div className="w-2 h-2 bg-teal-400 rounded-full mr-3" />
              Initialize your secure email client
            </li>
          </ul>
        </div>

        {setupStatus && (
          <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-4 mb-6">
            <div className="flex items-center mb-2">
              <Mail className="w-4 h-4 text-blue-400 mr-2" />
              <span className="text-blue-300 font-medium">Instance Information</span>
            </div>
            <div className="text-sm text-blue-200 space-y-1">
              <div>Instance ID: <span className="font-mono">{setupStatus.instanceId}</span></div>
              <div>Version: <span className="font-mono">{setupStatus.version}</span></div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <button
          onClick={onNext}
          className="px-8 py-3 bg-gradient-to-r from-teal-600 to-purple-600 text-white font-semibold rounded-lg hover:from-teal-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          Get Started
        </button>
      </div>
    </div>
  );
};

export default WelcomeStep;