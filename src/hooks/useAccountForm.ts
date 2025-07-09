import { useState, useEffect } from 'react';
import { Account, AccountFormData } from '../types';
import { autoDetectSettings } from '../components/account/ProviderAutoDetect';

export const useAccountForm = (account?: Account, isOpen?: boolean) => {
  const [formData, setFormData] = useState<AccountFormData>({
    name: '',
    email: '',
    username: '',
    password: '',
    imapHost: '',
    imapPort: '993',
    imapSecurity: 'SSL/TLS',
    smtpHost: '',
    smtpPort: '587',
    smtpSecurity: 'STARTTLS'
  });

  useEffect(() => {
    if (isOpen) {
      if (account) {
        setFormData({
          name: account.name,
          email: account.email,
          username: account.username || account.email,
          password: account.password || '',
          imapHost: account.imap?.host || '',
          imapPort: account.imap?.port?.toString() || '993',
          imapSecurity: account.imap?.security || 'SSL/TLS',
          smtpHost: account.smtp?.host || '',
          smtpPort: account.smtp?.port?.toString() || '587',
          smtpSecurity: account.smtp?.security || 'STARTTLS'
        });
      } else {
        setFormData({
          name: '',
          email: '',
          username: '',
          password: '',
          imapHost: '',
          imapPort: '993',
          imapSecurity: 'SSL/TLS',
          smtpHost: '',
          smtpPort: '587',
          smtpSecurity: 'STARTTLS'
        });
      }
    }
  }, [account, isOpen]);

  const handleEmailChange = (email: string) => {
    setFormData(prev => ({
      ...prev,
      email,
      username: email
    }));
    
    if (email.includes('@')) {
      autoDetectSettings(email, setFormData);
    }
  };

  const validateForm = (): boolean => {
    return !!(formData.name && formData.email && formData.password);
  };

  return {
    formData,
    setFormData,
    handleEmailChange,
    validateForm
  };
};