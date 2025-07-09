/**
 * GrainTexture Component
 * 
 * Provides a subtle grain texture overlay for the application background.
 * This is a purely visual component that adds depth and texture to the UI.
 * 
 * Usage: Place this component as the first child in any full-screen container
 * to add the grain effect behind other content.
 */

import React from 'react';

const GrainTexture: React.FC = () => (
  <div 
    className="fixed inset-0 pointer-events-none opacity-20"
    style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'repeat',
      backgroundSize: '128px 128px'
    }}
  />
);

export default GrainTexture;