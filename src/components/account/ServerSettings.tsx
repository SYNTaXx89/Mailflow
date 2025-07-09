import React from 'react';
import { AccountFormData } from '../../types';

interface ServerSettingsProps {
  formData: AccountFormData;
  setFormData: React.Dispatch<React.SetStateAction<AccountFormData>>;
}

const ServerSettings: React.FC<ServerSettingsProps> = ({
  formData,
  setFormData
}) => {
  return (
    <>
      {/* IMAP Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white">IMAP Settings (Incoming Mail)</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              IMAP Host
            </label>
            <input
              type="text"
              value={formData.imapHost}
              onChange={(e) => setFormData(prev => ({ ...prev, imapHost: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              placeholder="imap.gmail.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Port
            </label>
            <input
              type="text"
              value={formData.imapPort}
              onChange={(e) => setFormData(prev => ({ ...prev, imapPort: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              placeholder="993"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Security
          </label>
          <select
            value={formData.imapSecurity}
            onChange={(e) => setFormData(prev => ({ ...prev, imapSecurity: e.target.value as 'SSL/TLS' | 'STARTTLS' | 'None' }))}
            className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
          >
            <option value="SSL/TLS">SSL/TLS</option>
            <option value="STARTTLS">STARTTLS</option>
            <option value="None">None</option>
          </select>
        </div>
      </div>

      {/* SMTP Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white">SMTP Settings (Outgoing Mail)</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              SMTP Host
            </label>
            <input
              type="text"
              value={formData.smtpHost}
              onChange={(e) => setFormData(prev => ({ ...prev, smtpHost: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              placeholder="smtp.gmail.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Port
            </label>
            <input
              type="text"
              value={formData.smtpPort}
              onChange={(e) => setFormData(prev => ({ ...prev, smtpPort: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              placeholder="587"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Security
          </label>
          <select
            value={formData.smtpSecurity}
            onChange={(e) => setFormData(prev => ({ ...prev, smtpSecurity: e.target.value as 'SSL/TLS' | 'STARTTLS' | 'None' }))}
            className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
          >
            <option value="STARTTLS">STARTTLS</option>
            <option value="SSL/TLS">SSL/TLS</option>
            <option value="None">None</option>
          </select>
        </div>
      </div>
    </>
  );
};

export default ServerSettings;