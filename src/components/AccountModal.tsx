/**
 * AccountModal Component - Unified modal for adding and editing email accounts
 * 
 * Refactored to use smaller, focused components for better maintainability.
 */

import React from 'react';
import { X } from 'lucide-react';
import { Account, AccountFormData } from '../types';
import { useAccountForm } from '../hooks/useAccountForm';
import AccountForm from './account/AccountForm';
import ServerSettings from './account/ServerSettings';
import ConnectionTester from './account/ConnectionTester';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: AccountFormData) => void;
  account?: Account;
  isTestingConnection: boolean;
  onTestConnection: (formData: AccountFormData) => void;
}

const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  onSave,
  account,
  isTestingConnection,
  onTestConnection
}) => {
  const isEditMode = !!account;
  const { formData, setFormData, handleEmailChange, validateForm } = useAccountForm(account, isOpen);

  const handleSave = () => {
    if (!validateForm()) {
      alert('Please fill in all required fields (Name, Email, Password)');
      return;
    }
    onSave(formData);
  };

  const handleTestConnection = () => {
    if (!formData.email || !formData.password) {
      alert('Please enter email and password before testing connection');
      return;
    }
    onTestConnection(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800/95 backdrop-blur-sm rounded-2xl w-full max-w-2xl h-[90vh] border border-gray-700/50 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50 flex-shrink-0">
          <h2 className="text-xl font-semibold text-white">
            {isEditMode ? 'Edit Email Account' : 'Add Email Account'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-700/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <AccountForm
            formData={formData}
            setFormData={setFormData}
            onEmailChange={handleEmailChange}
          />
          
          <ServerSettings
            formData={formData}
            setFormData={setFormData}
          />
          
          <ConnectionTester
            formData={formData}
            isTestingConnection={isTestingConnection}
            onTestConnection={handleTestConnection}
          />
        </div>
        
        <div className="flex justify-end gap-3 p-6 border-t border-gray-700/50 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-3 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-700/50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-3 bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl"
          >
            {isEditMode ? 'Update Account' : 'Add Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountModal;