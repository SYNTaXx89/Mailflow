/**
 * Config Step - Instance configuration
 * 
 * Step for configuring instance settings, features, and optional SMTP.
 */

import React, { useState } from 'react';
import { Settings, Globe, Users, Mail, Loader2 } from 'lucide-react';
import { apiConfig } from '../../config/api';

interface ConfigStepProps {
  setupData: {
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
  adminToken: string | null;
  onNext: (data: any) => void;
  onError: (error: string) => void;
}

const ConfigStep: React.FC<ConfigStepProps> = ({ setupData, adminToken, onNext, onError }) => {
  const [formData, setFormData] = useState(setupData);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const timezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney'
  ];

  const handleInputChange = (field: string, value: any) => {
    const keys = field.split('.');
    if (keys.length === 1) {
      setFormData(prev => ({ ...prev, [field]: value }));
    } else if (keys.length === 2) {
      setFormData(prev => ({
        ...prev,
        [keys[0]]: {
          ...(prev[keys[0] as keyof typeof prev] as Record<string, any>),
          [keys[1]]: value
        }
      }));
    }
    
    // Clear errors
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.instanceName.trim()) {
      newErrors.instanceName = 'Instance name is required';
    }

    if (!formData.timezone) {
      newErrors.timezone = 'Timezone is required';
    }

    // SMTP validation if enabled
    if (formData.smtp?.enabled) {
      if (!formData.smtp.host) {
        newErrors['smtp.host'] = 'SMTP host is required';
      }
      if (!formData.smtp.user) {
        newErrors['smtp.user'] = 'SMTP username is required';
      }
      if (!formData.smtp.password) {
        newErrors['smtp.password'] = 'SMTP password is required';
      }
      if (formData.smtp.port < 1 || formData.smtp.port > 65535) {
        newErrors['smtp.port'] = 'Port must be between 1 and 65535';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch(`${apiConfig.baseUrl}/setup/configure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          instanceName: formData.instanceName,
          timezone: formData.timezone,
          features: formData.features,
          ...(formData.smtp?.enabled && { smtp: formData.smtp })
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to configure instance');
      }

      console.log('✅ Instance configuration saved');
      onNext(data);
    } catch (error) {
      console.error('Configuration failed:', error);
      onError(error instanceof Error ? error.message : 'Failed to configure instance');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl p-8 w-full max-w-2xl border border-gray-700/50 shadow-2xl">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-teal-600 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Settings className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Configure Instance</h1>
        <p className="text-gray-400">Customize your Mailflow instance settings and features</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Settings */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Globe className="w-5 h-5 mr-2" />
            Basic Settings
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Instance Name
              </label>
              <input
                type="text"
                value={formData.instanceName}
                onChange={(e) => handleInputChange('instanceName', e.target.value)}
                className={`w-full px-4 py-3 bg-gray-700/50 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all ${
                  errors.instanceName ? 'border-red-500' : 'border-gray-600'
                }`}
                placeholder="My Mailflow Instance"
                disabled={isLoading}
              />
              {errors.instanceName && (
                <p className="text-red-400 text-sm mt-1">{errors.instanceName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Timezone
              </label>
              <select
                value={formData.timezone}
                onChange={(e) => handleInputChange('timezone', e.target.value)}
                className={`w-full px-4 py-3 bg-gray-700/50 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all ${
                  errors.timezone ? 'border-red-500' : 'border-gray-600'
                }`}
                disabled={isLoading}
              >
                {timezones.map(tz => (
                  <option key={tz} value={tz} className="bg-gray-700">
                    {tz}
                  </option>
                ))}
              </select>
              {errors.timezone && (
                <p className="text-red-400 text-sm mt-1">{errors.timezone}</p>
              )}
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Features
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-700/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium">Multi-User</span>
                <input
                  type="checkbox"
                  checked={formData.features.multiUser}
                  onChange={(e) => handleInputChange('features.multiUser', e.target.checked)}
                  className="w-4 h-4 text-teal-600 bg-gray-700 border-gray-600 rounded focus:ring-teal-500"
                  disabled={isLoading}
                />
              </div>
              <p className="text-gray-400 text-sm">Allow multiple users on this instance</p>
            </div>

            <div className="bg-gray-700/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium">Invitations</span>
                <input
                  type="checkbox"
                  checked={formData.features.invitations}
                  onChange={(e) => handleInputChange('features.invitations', e.target.checked)}
                  className="w-4 h-4 text-teal-600 bg-gray-700 border-gray-600 rounded focus:ring-teal-500"
                  disabled={isLoading}
                />
              </div>
              <p className="text-gray-400 text-sm">Enable user invitation system</p>
            </div>

            <div className="bg-gray-700/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium">Backups</span>
                <input
                  type="checkbox"
                  checked={formData.features.backups}
                  onChange={(e) => handleInputChange('features.backups', e.target.checked)}
                  className="w-4 h-4 text-teal-600 bg-gray-700 border-gray-600 rounded focus:ring-teal-500"
                  disabled={isLoading}
                />
              </div>
              <p className="text-gray-400 text-sm">Automatic data backups</p>
            </div>
          </div>
        </div>

        {/* SMTP Configuration */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Mail className="w-5 h-5 mr-2" />
            SMTP Configuration (Optional)
          </h3>
          
          <div className="bg-gray-700/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-white font-medium">Enable SMTP</span>
                <p className="text-gray-400 text-sm">Configure SMTP for sending emails and notifications</p>
              </div>
              <input
                type="checkbox"
                checked={formData.smtp?.enabled || false}
                onChange={(e) => handleInputChange('smtp.enabled', e.target.checked)}
                className="w-4 h-4 text-teal-600 bg-gray-700 border-gray-600 rounded focus:ring-teal-500"
                disabled={isLoading}
              />
            </div>

            {formData.smtp?.enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    value={formData.smtp.host}
                    onChange={(e) => handleInputChange('smtp.host', e.target.value)}
                    className={`w-full px-4 py-3 bg-gray-700/50 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all ${
                      errors['smtp.host'] ? 'border-red-500' : 'border-gray-600'
                    }`}
                    placeholder="smtp.gmail.com"
                    disabled={isLoading}
                  />
                  {errors['smtp.host'] && (
                    <p className="text-red-400 text-sm mt-1">{errors['smtp.host']}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Port
                  </label>
                  <input
                    type="number"
                    value={formData.smtp.port}
                    onChange={(e) => handleInputChange('smtp.port', parseInt(e.target.value))}
                    className={`w-full px-4 py-3 bg-gray-700/50 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all ${
                      errors['smtp.port'] ? 'border-red-500' : 'border-gray-600'
                    }`}
                    placeholder="587"
                    disabled={isLoading}
                  />
                  {errors['smtp.port'] && (
                    <p className="text-red-400 text-sm mt-1">{errors['smtp.port']}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.smtp.user}
                    onChange={(e) => handleInputChange('smtp.user', e.target.value)}
                    className={`w-full px-4 py-3 bg-gray-700/50 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all ${
                      errors['smtp.user'] ? 'border-red-500' : 'border-gray-600'
                    }`}
                    placeholder="your-email@gmail.com"
                    disabled={isLoading}
                  />
                  {errors['smtp.user'] && (
                    <p className="text-red-400 text-sm mt-1">{errors['smtp.user']}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={formData.smtp.password}
                    onChange={(e) => handleInputChange('smtp.password', e.target.value)}
                    className={`w-full px-4 py-3 bg-gray-700/50 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all ${
                      errors['smtp.password'] ? 'border-red-500' : 'border-gray-600'
                    }`}
                    placeholder="App password or SMTP password"
                    disabled={isLoading}
                  />
                  {errors['smtp.password'] && (
                    <p className="text-red-400 text-sm mt-1">{errors['smtp.password']}</p>
                  )}
                </div>

                <div className="col-span-1 md:col-span-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.smtp.secure}
                      onChange={(e) => handleInputChange('smtp.secure', e.target.checked)}
                      className="w-4 h-4 text-teal-600 bg-gray-700 border-gray-600 rounded focus:ring-teal-500"
                      disabled={isLoading}
                    />
                    <label className="ml-2 text-gray-300">
                      Use secure connection (TLS/SSL)
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between pt-6">
          <button
            type="button"
            onClick={() => onNext({})}
            className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-all duration-200"
            disabled={isLoading}
          >
            Skip Configuration
          </button>
          
          <button
            type="submit"
            disabled={isLoading}
            className="px-8 py-3 bg-gradient-to-r from-teal-600 to-purple-600 text-white font-semibold rounded-lg hover:from-teal-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ConfigStep;