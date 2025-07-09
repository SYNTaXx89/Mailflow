/**
 * Admin Step - Admin account creation
 * 
 * Step for creating the initial admin account during setup.
 * Includes password validation and security requirements.
 */

import React, { useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, Server } from 'lucide-react';
import { apiConfig } from '../../config/api';

interface AdminStepProps {
  setupData: {
    email: string;
    password: string;
    confirmPassword: string;
    instanceName: string;
  };
  onNext: (data: any) => void;
  onError: (error: string) => void;
}

const AdminStep: React.FC<AdminStepProps> = ({ setupData, onNext, onError }) => {
  const [formData, setFormData] = useState(setupData);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validatePassword = (password: string) => {
    const requirements = [
      { test: password.length >= 8, text: 'At least 8 characters' },
      { test: /[A-Z]/.test(password), text: 'One uppercase letter' },
      { test: /[a-z]/.test(password), text: 'One lowercase letter' },
      { test: /\d/.test(password), text: 'One number' },
      { test: /[!@#$%^&*(),.?":{}|<>]/.test(password), text: 'One special character' }
    ];
    
    return requirements;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear specific error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Instance name validation
    if (!formData.instanceName.trim()) {
      newErrors.instanceName = 'Instance name is required';
    } else if (formData.instanceName.trim().length < 3) {
      newErrors.instanceName = 'Instance name must be at least 3 characters';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else {
      const requirements = validatePassword(formData.password);
      const failedRequirements = requirements.filter(req => !req.test);
      if (failedRequirements.length > 0) {
        newErrors.password = `Password must meet all security requirements`;
      }
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      const response = await fetch(`${apiConfig.setup.initialize}`, {
        method: 'POST'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to initialize setup');
      }

      // Create admin account
      const adminResponse = await fetch(`${apiConfig.baseUrl}/setup/admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          instanceName: formData.instanceName
        })
      });

      const adminData = await adminResponse.json();

      if (!adminResponse.ok) {
        if (adminData.details) {
          // Handle password validation errors
          setErrors({ password: adminData.details.join(', ') });
        } else {
          throw new Error(adminData.message || 'Failed to create admin account');
        }
        return;
      }

      console.log('✅ Admin account created successfully');
      onNext(adminData);
    } catch (error) {
      console.error('Admin creation failed:', error);
      onError(error instanceof Error ? error.message : 'Failed to create admin account');
    } finally {
      setIsLoading(false);
    }
  };

  const passwordRequirements = validatePassword(formData.password);

  return (
    <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl p-8 w-full max-w-lg border border-gray-700/50 shadow-2xl">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-teal-600 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Create Admin Account</h1>
        <p className="text-gray-400">Set up your administrator account to manage this MailFlow instance</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Instance Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Instance Name
          </label>
          <div className="relative">
            <Server className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={formData.instanceName}
              onChange={(e) => handleInputChange('instanceName', e.target.value)}
              className={`w-full pl-10 pr-4 py-3 bg-gray-700/50 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all ${
                errors.instanceName ? 'border-red-500' : 'border-gray-600'
              }`}
              placeholder="My MailFlow Instance"
              disabled={isLoading}
            />
          </div>
          {errors.instanceName && (
            <p className="text-red-400 text-sm mt-1 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.instanceName}
            </p>
          )}
        </div>

        {/* Admin Email */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Admin Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={`w-full pl-10 pr-4 py-3 bg-gray-700/50 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all ${
                errors.email ? 'border-red-500' : 'border-gray-600'
              }`}
              placeholder="admin@example.com"
              disabled={isLoading}
            />
          </div>
          {errors.email && (
            <p className="text-red-400 text-sm mt-1 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.email}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className={`w-full pl-10 pr-12 py-3 bg-gray-700/50 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all ${
                errors.password ? 'border-red-500' : 'border-gray-600'
              }`}
              placeholder="Enter a strong password"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          
          {/* Password Requirements */}
          {formData.password && (
            <div className="mt-3 space-y-1">
              {passwordRequirements.map((req, index) => (
                <div key={index} className="flex items-center text-sm">
                  {req.test ? (
                    <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                  ) : (
                    <div className="w-4 h-4 border-2 border-gray-400 rounded-full mr-2" />
                  )}
                  <span className={req.test ? 'text-green-400' : 'text-gray-400'}>
                    {req.text}
                  </span>
                </div>
              ))}
            </div>
          )}
          
          {errors.password && (
            <p className="text-red-400 text-sm mt-1 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.password}
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              className={`w-full pl-10 pr-12 py-3 bg-gray-700/50 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all ${
                errors.confirmPassword ? 'border-red-500' : 'border-gray-600'
              }`}
              placeholder="Confirm your password"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-red-400 text-sm mt-1 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.confirmPassword}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 bg-gradient-to-r from-teal-600 to-purple-600 text-white font-semibold rounded-lg hover:from-teal-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Creating Account...
            </>
          ) : (
            'Create Admin Account'
          )}
        </button>
      </form>
    </div>
  );
};

export default AdminStep;