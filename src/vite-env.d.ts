/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_DEBUG?: string;
  readonly VITE_JWT_SECRET?: string;
  readonly VITE_SMTP_HOST?: string;
  readonly VITE_SMTP_PORT?: string;
  readonly VITE_SMTP_SECURE?: string;
  readonly VITE_SMTP_USER?: string;
  readonly VITE_SMTP_PASS?: string;
  readonly VITE_IMAP_HOST?: string;
  readonly VITE_IMAP_PORT?: string;
  readonly VITE_IMAP_SECURE?: string;
  readonly VITE_IMAP_USER?: string;
  readonly VITE_IMAP_PASS?: string;
  readonly VITE_NODE_ENV?: string;
  readonly VITE_DATABASE_PATH?: string;
  readonly VITE_ENCRYPTION_KEY?: string;
  readonly VITE_MAILFLOW_CONFIG_PATH?: string;
  readonly VITE_LOG_LEVEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}