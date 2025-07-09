import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import { AccountFormData } from '../../types';

interface ConnectionTesterProps {
  formData: AccountFormData;
  isTestingConnection: boolean;
  onTestConnection: () => void;
}

const ConnectionTester: React.FC<ConnectionTesterProps> = ({
  formData,
  isTestingConnection,
  onTestConnection
}) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-white">Connection Test</h3>
      
      <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
        <p className="text-gray-300 text-sm mb-4">
          Test your connection settings to ensure they work before saving the account.
        </p>
        
        <button
          onClick={onTestConnection}
          disabled={isTestingConnection || !formData.email || !formData.password}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          {isTestingConnection ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Test Connection
            </>
          )}
        </button>
        
        {(!formData.email || !formData.password) && (
          <p className="text-amber-400 text-xs mt-2">
            Email and password are required for connection testing
          </p>
        )}
      </div>
    </div>
  );
};

export default ConnectionTester;