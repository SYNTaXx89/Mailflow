/**
 * Main App Component - Mailflow Email Client
 * 
 * This is the root component that orchestrates the entire email client application.
 * Simplified to only show the main email interface.
 */

import MainEmailInterface from './components/MainEmailInterface';

const EmailClient = () => {
  return (
    <div className="relative">
      <MainEmailInterface />
    </div>
  );
};

export default EmailClient;