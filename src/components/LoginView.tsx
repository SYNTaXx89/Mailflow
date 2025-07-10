/**
 * LoginView Component
 * 
 * JWT-based login screen for user authentication.
 * Handles email/password authentication and token management.
 */

import React, { useState } from 'react';
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import GrainTexture from './GrainTexture';
import { useAuth } from '../contexts/AuthContext';

const LoginView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    setError(null);

    try {
      await auth.login(email, password);
      // No need to do anything else - auth state will update and trigger re-render
    } catch (error) {
      console.error('❌ Login failed:', error);
      setError(error instanceof Error ? error.message : 'Login failed');
    }
  };
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#111111' }}>
      <GrainTexture />
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl p-8 w-full max-w-md border border-gray-700/50 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-teal-600 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-gray-400">Sign in to your Mailflow account</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                  placeholder="admin@example.com"
                  disabled={auth.isLoading}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                  placeholder="Enter your password"
                  disabled={auth.isLoading}
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center space-x-2 text-red-400 bg-red-900/20 border border-red-900/50 rounded-lg p-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}
            
            {/* Login Button */}
            <button
              type="submit"
              disabled={auth.isLoading}
              className="w-full py-3 bg-gradient-to-r from-teal-600 to-purple-600 text-white font-semibold rounded-lg hover:from-teal-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {auth.isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginView;