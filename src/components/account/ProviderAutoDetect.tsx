import { AccountFormData } from '../../types';

export const commonProviders: Record<string, Partial<AccountFormData>> = {
  'gmail.com': {
    imapHost: 'imap.gmail.com',
    imapPort: '993',
    imapSecurity: 'SSL/TLS',
    smtpHost: 'smtp.gmail.com',
    smtpPort: '587',
    smtpSecurity: 'STARTTLS'
  },
  'outlook.com': {
    imapHost: 'outlook.office365.com',
    imapPort: '993',
    imapSecurity: 'SSL/TLS',
    smtpHost: 'smtp-mail.outlook.com',
    smtpPort: '587',
    smtpSecurity: 'STARTTLS'
  },
  'hotmail.com': {
    imapHost: 'outlook.office365.com',
    imapPort: '993',
    imapSecurity: 'SSL/TLS',
    smtpHost: 'smtp-mail.outlook.com',
    smtpPort: '587',
    smtpSecurity: 'STARTTLS'
  },
  'yahoo.com': {
    imapHost: 'imap.mail.yahoo.com',
    imapPort: '993',
    imapSecurity: 'SSL/TLS',
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: '587',
    smtpSecurity: 'STARTTLS'
  },
  'icloud.com': {
    imapHost: 'imap.mail.me.com',
    imapPort: '993',
    imapSecurity: 'SSL/TLS',
    smtpHost: 'smtp.mail.me.com',
    smtpPort: '587',
    smtpSecurity: 'STARTTLS'
  }
};

export const autoDetectSettings = (
  email: string,
  setFormData: React.Dispatch<React.SetStateAction<AccountFormData>>
) => {
  const domain = email.split('@')[1]?.toLowerCase();
  
  if (commonProviders[domain]) {
    setFormData(prev => ({
      ...prev,
      ...commonProviders[domain]
    }));
  }
};