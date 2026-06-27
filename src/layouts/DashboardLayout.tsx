import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiClient } from '../api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Home, 
  Calendar, 
  DoorOpen, 
  User, 
  Bell, 
  LogOut, 
  Sun, 
  Moon, 
  Menu, 
  Check, 
  Trash2, 
  Building 
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Dark/Light Mode state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Drawer / Menu responsiveness
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // Fetch unread notification count
  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const response = await apiClient.get('/notification/unread-count');
      return response.data?.data || { unreadCount: 0 };
    },
    enabled: !!user,
    refetchInterval: 30000, // refresh count every 30s
  });

  // Fetch notifications
  const { data: notificationsData } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: async () => {
      // Endpoint pagination parameters default
      const response = await apiClient.get('/notification?page=0&size=20&sort=createdAt,desc');
      return response.data?.data?.content || [];
    },
    enabled: isNotificationOpen && !!user,
  });

  // Mark single as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.patch(`/notification/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiClient.patch('/notification/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      showToast('Đã đánh dấu tất cả thông báo là đã đọc', 'success');
    },
  });

  // Delete notification mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/notification/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      showToast('Đã xóa thông báo', 'success');
    },
  });

  const handleLogout = () => {
    logout();
    showToast('Đăng xuất thành công', 'success');
    navigate('/login');
  };

  // Nav Items configuration
  const navItems = [
    { name: 'Dashboard', path: '/', icon: <Home size={18} /> },
    { name: 'Lịch Đặt Phòng', path: '/bookings', icon: <Calendar size={18} /> },
    { name: 'Phòng Họp', path: '/rooms', icon: <DoorOpen size={18} /> },
    { name: 'Hồ Sơ Cá Nhân', path: '/profile', icon: <User size={18} /> },
  ];

  const getPageTitle = () => {
    const activeItem = navItems.find((item) => item.path === location.pathname);
    return activeItem ? activeItem.name : 'SynchroSpace';
  };

  return (
    <div className="dashboard-container" style={{ display: 'flex', minHeight: '100vh', width: '100vw' }}>
      
      {/* SIDEBAR - Left panel */}
      <aside 
        className={`glass-card ${isSidebarOpen ? 'sidebar-open' : ''}`}
        style={{
          width: '260px',
          minWidth: '260px',
          borderRadius: 0,
          borderWidth: '0 1px 0 0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '2rem 1.5rem',
          height: '100vh',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          transition: 'all var(--transition-normal)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', flexGrow: 1 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingLeft: '0.5rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--accent) 0%, #3b82f6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: 'var(--shadow-md)'
            }}>
              <Building size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }} className="text-gradient">SynchroSpace</h2>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>MEETING SPACE MANAGER</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    backgroundColor: isActive ? 'var(--accent-light)' : 'transparent',
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '0.9rem',
                    transition: 'all var(--transition-fast)',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--accent-border)' : 'transparent'
                  }}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile footer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: '1rem',
              border: '2px solid var(--border-light)'
            }}>
              {user?.username?.substring(0, 2).toUpperCase() || 'US'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {user?.username}
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-tertiary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {user?.email}
              </p>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="btn btn-ghost"
            style={{ 
              justifyContent: 'flex-start', 
              color: 'var(--danger)', 
              backgroundColor: 'transparent',
              padding: '0.75rem 1rem',
              width: '100%'
            }}
          >
            <LogOut size={16} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER BUTTONS */}
      <div className="mobile-header-trigger" style={{ display: 'none' }}>
        <button className="btn btn-ghost" onClick={() => setIsSidebarOpen(true)}>
          <Menu size={24} />
        </button>
        <h2 style={{ fontSize: '1.2rem', margin: 0 }}>SynchroSpace</h2>
      </div>

      {/* SIDEBAR OVERLAY FOR MOBILE */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)} 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            zIndex: 99,
          }}
        />
      )}

      {/* MAIN CONTAINER */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        
        {/* HEADER */}
        <header 
          style={{
            height: '70px',
            backgroundColor: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 2rem',
            position: 'sticky',
            top: 0,
            zIndex: 90,
          }}
        >
          {/* Page Title / Left side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              className="mobile-burger-btn" 
              onClick={() => setIsSidebarOpen(true)}
              style={{
                display: 'none',
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              <Menu size={24} />
            </button>
            <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>{getPageTitle()}</h1>
          </div>

          {/* Action buttons / Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Dark mode button */}
            <button 
              onClick={toggleTheme}
              className="btn btn-ghost"
              style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%' }}
              aria-label="Toggle theme mode"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            {/* Notification Badge */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="btn btn-ghost"
                style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%' }}
                aria-label="View notifications list"
              >
                <Bell size={20} />
                {unreadData?.unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    backgroundColor: 'var(--danger)',
                    color: '#ffffff',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid var(--bg-secondary)',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    {unreadData.unreadCount > 9 ? '9+' : unreadData.unreadCount}
                  </span>
                )}
              </button>

              {/* NOTIFICATION DRAWER / PANEL */}
              {isNotificationOpen && (
                <>
                  {/* Backdrop */}
                  <div 
                    onClick={() => setIsNotificationOpen(false)}
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 101 }}
                  />
                  
                  <div 
                    className="glass-card"
                    style={{
                      position: 'absolute',
                      top: '50px',
                      right: 0,
                      width: '360px',
                      maxHeight: '480px',
                      zIndex: 102,
                      padding: 0,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{
                      padding: '1rem 1.25rem',
                      borderBottom: '1px solid var(--border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'var(--bg-tertiary)'
                    }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Thông báo</span>
                      {unreadData?.unreadCount > 0 && (
                        <button 
                          onClick={() => markAllReadMutation.mutate()}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Đánh dấu đã đọc tất cả
                        </button>
                      )}
                    </div>

                    <div style={{ overflowY: 'auto', flexGrow: 1, maxHeight: '380px' }}>
                      {notificationsData?.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                          Không có thông báo nào mới
                        </div>
                      ) : (
                        notificationsData?.map((item: any) => (
                          <div 
                            key={item.id} 
                            style={{
                              padding: '1rem 1.25rem',
                              borderBottom: '1px solid var(--border-light)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.25rem',
                              backgroundColor: item.status === 'UNREAD' ? 'var(--accent-light)' : 'transparent',
                              position: 'relative',
                              transition: 'all var(--transition-fast)',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingRight: '2rem' }}>
                              <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: item.status === 'UNREAD' ? 700 : 500, color: 'var(--text-primary)' }}>
                                {item.title || 'Thông báo lịch họp'}
                              </h4>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {item.message}
                            </p>
                            
                            {/* Action Buttons inside notify card */}
                            <div style={{ 
                              position: 'absolute', 
                              right: '10px', 
                              bottom: '10px', 
                              display: 'flex', 
                              gap: '0.25rem',
                            }}>
                              {item.status === 'UNREAD' && (
                                <button 
                                  onClick={() => markAsReadMutation.mutate(item.id)}
                                  className="btn btn-ghost" 
                                  style={{ padding: '4px', minWidth: 'auto', color: 'var(--success)' }}
                                  title="Đánh dấu đã đọc"
                                >
                                  <Check size={14} />
                                </button>
                              )}
                              <button 
                                onClick={() => deleteMutation.mutate(item.id)}
                                className="btn btn-ghost" 
                                style={{ padding: '4px', minWidth: 'auto', color: 'var(--danger)' }}
                                title="Xóa thông báo"
                              >
                                  <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* MAIN BODY CONTENTS */}
        <main style={{ flexGrow: 1, padding: '2rem', overflowY: 'auto' }}>
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .dashboard-container {
            flex-direction: column;
          }
          aside {
            position: fixed !important;
            left: -260px;
            top: 0;
            bottom: 0;
            box-shadow: var(--shadow-lg) !important;
            transition: transform var(--transition-normal) !important;
          }
          .sidebar-open {
            transform: translateX(260px);
          }
          .mobile-header-trigger {
            display: flex !important;
            align-items: center;
            gap: 1rem;
            height: 60px;
            padding: 0 1rem;
            background-color: var(--bg-secondary);
            border-bottom: 1px solid var(--border-light);
          }
          .mobile-burger-btn {
            display: block !important;
          }
          header {
            position: sticky;
            top: 0;
          }
        }
      `}</style>
    </div>
  );
};
