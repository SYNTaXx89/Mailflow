/**
 * Components Index - Central Export File
 * 
 * This file provides a central location for exporting all components,
 * making imports cleaner and more organized throughout the application.
 * 
 * Instead of:
 * import SetupView from './components/SetupView';
 * import LoginView from './components/LoginView';
 * import EmailComposer from './components/EmailComposer';
 * 
 * You can now use:
 * import { SetupView, LoginView, EmailComposer } from './components';
 * 
 * This also makes it easier to:
 * - Track what components are available
 * - Reorganize file structure without breaking imports
 * - Add barrel exports for component groups
 */

// UI Components - Core interface elements
export { default as GrainTexture } from './GrainTexture';

// Authentication & Setup Components
export { default as SetupView } from './SetupView';
export { default as LoginView } from './LoginView';

// Main Application Components  
export { default as Sidebar } from './Sidebar';
export { default as EmailView } from './EmailView';
export { default as EmailOverview } from './EmailOverview';
export { default as MainEmailInterface } from './MainEmailInterface';
export { AttachmentList } from './AttachmentList';

// Modal Components
export { default as EmailComposer } from './EmailComposer';
export { default as AddAccountModal } from './AddAccountModal';
export { default as AccountModal } from './AccountModal';
export { default as SettingsModal } from './SettingsModal';

// Account Components
export { default as AccountForm } from './account/AccountForm';
export { default as ServerSettings } from './account/ServerSettings';
export { default as ConnectionTester } from './account/ConnectionTester';

// Re-export types for convenience
export * from '../types';