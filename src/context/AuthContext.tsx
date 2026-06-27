import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

export interface User {
  id: number;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  hasAuthority: (authority: string) => boolean;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function parseJwt(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) {
      if (pad === 1) {
        throw new Error('Invalid base64Url string');
      }
      base64 += '='.repeat(4 - pad);
    }
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to parse JWT', e);
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initAuth = () => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      const decoded = parseJwt(token);
      if (decoded) {
        // Expiration check
        const isExpired = decoded.exp * 1000 < Date.now();
        if (!isExpired) {
          setAccessToken(token);
          setUser({
            id: decoded.userId || 0,
            username: decoded.sub || '',
            email: decoded.email || decoded.sub || '',
            roles: decoded.roles || [],
            permissions: decoded.permissions || [],
          });
        } else {
          // Token is expired, let axios client handle it via refresh token or clear
          const refresh = localStorage.getItem('refreshToken');
          if (!refresh) {
            logout();
          }
        }
      } else {
        logout();
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    initAuth();

    // Listen for logout events dispatched from API client interceptors
    const handleLogoutEvent = () => {
      logout();
    };
    window.addEventListener('auth-logout', handleLogoutEvent);

    return () => {
      window.removeEventListener('auth-logout', handleLogoutEvent);
    };
  }, []);

  const login = (token: string, refresh: string) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', refresh);
    const decoded = parseJwt(token);
    if (decoded) {
      setUser({
        id: decoded.userId || 0,
        username: decoded.sub || '',
        email: decoded.email || decoded.sub || '',
        roles: decoded.roles || [],
        permissions: decoded.permissions || [],
      });
      setAccessToken(token);
    }
  };

  const logout = async () => {
    const accToken = localStorage.getItem('accessToken');
    const refToken = localStorage.getItem('refreshToken');

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    setAccessToken(null);

    if (accToken && refToken) {
      try {
        await axios.post('http://localhost:8080/api/v1/auth/logout', {
          accessToken: accToken,
          refreshToken: refToken
        });
      } catch (e) {
        console.error('Failed to notify backend logout', e);
      }
    }
  };

  const hasAuthority = (authority: string): boolean => {
    if (!user) return false;
    return user.permissions.includes(authority) || user.roles.includes('ADMIN');
  };

  const hasRole = (role: string): boolean => {
    if (!user) return false;
    return user.roles.includes(role);
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, logout, hasAuthority, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
