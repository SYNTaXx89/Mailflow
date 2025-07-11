import { EmailFrom } from '../../src/types';

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

export interface EmailPreview {
  id: string;
  accountId: string;
  from: EmailFrom;
  subject: string;
  date: Date;
  isRead: boolean;
  preview: string;
  uid: number;
}

export interface EmailFull extends EmailPreview {
  content: string;
  html?: string;
}