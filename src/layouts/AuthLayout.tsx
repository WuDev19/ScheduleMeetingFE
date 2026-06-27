import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div 
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at top, #1e1b4b, #0f172a)',
        padding: '1.5rem',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Decorative Blur Circles */}
      <div 
        style={{
          position: 'absolute',
          top: '-10%',
          left: '10%',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'rgba(124, 58, 237, 0.15)',
          filter: 'blur(100px)',
          zIndex: 1
        }}
      />
      <div 
        style={{
          position: 'absolute',
          bottom: '-10%',
          right: '10%',
          width: '350px',
          height: '350px',
          borderRadius: '50%',
          background: 'rgba(59, 130, 246, 0.12)',
          filter: 'blur(100px)',
          zIndex: 1
        }}
      />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '440px' }}>
        {children}
      </div>
    </div>
  );
};
