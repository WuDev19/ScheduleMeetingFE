import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div 
      data-theme="light"
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at top, #d9f3ee, #f4faf8 60%, #ffffff 100%)',
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
          background: 'rgba(20, 184, 166, 0.2)',
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
          background: 'rgba(16, 185, 129, 0.15)',
          filter: 'blur(100px)',
          zIndex: 1
        }}
      />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '960px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {children}
      </div>
    </div>
  );
};
