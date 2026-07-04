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
  Users,
  Bell,
  LogOut,
  Sun,
  Moon,
  Menu,
  Check,
  Trash2,
  Building,
  X,
  Clock,
  CheckCircle,
  Eye
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, logout, hasRole } = useAuth();
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

  // Booking Detail Modal state
  const [viewingBookingDetail, setViewingBookingDetail] = useState<any>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [selectedNotificationIds, setSelectedNotificationIds] = useState<number[]>([]);

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

  // Fetch details and open modal
  const handleViewBookingDetail = async (bookingId: number, notificationId: number) => {
    try {
      setIsDetailLoading(true);
      setViewingBookingDetail({}); // open modal with loading indicator
      const response = await apiClient.get(`/booking/${bookingId}/detail/notification/${notificationId}`);
      setViewingBookingDetail(response.data?.data);
      // Mark as read
      markAsReadMutation.mutate(notificationId);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể tải chi tiết cuộc họp';
      showToast(msg, 'error');
      setViewingBookingDetail(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Confirm booking mutation
  const confirmParticipateMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      await apiClient.post(`/booking/${bookingId}/attendee/confirm`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      showToast('Xác nhận tham gia họp thành công!', 'success');
      setViewingBookingDetail((prev: any) => prev ? { ...prev, status: 'APPROVED' } : null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể xác nhận tham gia';
      showToast(msg, 'error');
    }
  });

  // Delete selected notifications mutation
  const deleteSelectedMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete('/notification/selected', {
        data: selectedNotificationIds
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setSelectedNotificationIds([]);
      showToast('Đã xóa các thông báo đã chọn', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể xóa các thông báo đã chọn';
      showToast(msg, 'error');
    }
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
    ...(hasRole('ADMIN') ? [
      { name: 'Quản lý Tòa Nhà', path: '/buildings', icon: <Building size={18} /> },
      { name: 'Quản lý Nhân Viên', path: '/users', icon: <Users size={18} /> }
    ] : []),
    { name: 'Hồ Sơ Cá Nhân', path: '/profile', icon: <User size={18} /> },
  ];

  const getPageTitle = () => {
    const activeItem = navItems.find((item) => item.path === location.pathname);
    return activeItem ? activeItem.name : 'ScheduleMeeting';
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
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }} className="text-gradient">ScheduleMeeting</h2>
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
        <h2 style={{ fontSize: '1.2rem', margin: 0 }}>ScheduleMeeting</h2>
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
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        {selectedNotificationIds.length > 0 ? (
                          <button
                            onClick={() => deleteSelectedMutation.mutate()}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--danger)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                            disabled={deleteSelectedMutation.isPending}
                          >
                            Xóa đã chọn ({selectedNotificationIds.length})
                          </button>
                        ) : unreadData?.unreadCount > 0 && (
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
                    </div>

                    <div style={{ overflowY: 'auto', flexGrow: 1, maxHeight: '380px' }}>
                      {notificationsData?.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                          Không có thông báo nào mới
                        </div>
                      ) : (
                        notificationsData?.map((item: any) => (
                          <div
                            key={item.notificationId}
                            style={{
                              padding: '1rem 1.25rem',
                              borderBottom: '1px solid var(--border-light)',
                              display: 'flex',
                              flexDirection: 'row',
                              gap: '0.75rem',
                              backgroundColor: !item.isRead ? 'var(--accent-light)' : 'transparent',
                              position: 'relative',
                              transition: 'all var(--transition-fast)',
                            }}
                          >
                            {/* Checkbox for batch selection */}
                            <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'flex-start', marginTop: '2px' }}>
                              <input
                                type="checkbox"
                                checked={selectedNotificationIds.includes(item.notificationId)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedNotificationIds(prev => [...prev, item.notificationId]);
                                  } else {
                                    setSelectedNotificationIds(prev => prev.filter(id => id !== item.notificationId));
                                  }
                                }}
                                style={{
                                  width: '15px',
                                  height: '15px',
                                  cursor: 'pointer',
                                  accentColor: 'var(--accent)'
                                }}
                              />
                            </div>

                            {/* Card Content wrapper */}
                            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingRight: '2.5rem' }}>
                                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: !item.isRead ? 700 : 500, color: 'var(--text-primary)' }}>
                                  {item.title || 'Thông báo lịch họp'}
                                </h4>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                                  {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                {item.message}
                              </p>

                              {item.bookingId && (
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                  <button
                                    onClick={() => handleViewBookingDetail(item.bookingId, item.notificationId)}
                                    className="btn btn-ghost"
                                    style={{ padding: '2px 8px', fontSize: '0.7rem', height: '24px', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid var(--border-light)' }}
                                  >
                                    <Eye size={12} /> Chi tiết
                                  </button>
                                  {item.title === 'Thông báo lịch họp' && item.message?.includes('mời') && (
                                    <button
                                      onClick={() => {
                                        confirmParticipateMutation.mutate(item.bookingId);
                                        markAsReadMutation.mutate(item.notificationId);
                                      }}
                                      className="btn"
                                      style={{ padding: '2px 8px', fontSize: '0.7rem', height: '24px', backgroundColor: 'var(--success)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                                      disabled={confirmParticipateMutation.isPending}
                                    >
                                      <CheckCircle size={12} /> Xác nhận
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Action Buttons inside notify card */}
                            <div style={{
                              position: 'absolute',
                              right: '12px',
                              top: '12px',
                              display: 'flex',
                              gap: '0.25rem',
                            }}>
                              {!item.isRead && (
                                <button
                                  onClick={() => markAsReadMutation.mutate(item.notificationId)}
                                  className="btn btn-ghost"
                                  style={{ padding: '4px', minWidth: 'auto', color: 'var(--success)' }}
                                  title="Đánh dấu đã đọc"
                                >
                                  <Check size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => deleteMutation.mutate(item.notificationId)}
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

      {/* Booking Detail Modal from Notification */}
      {viewingBookingDetail && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bell size={20} style={{ color: 'var(--accent)' }} />
                Chi Tiết Cuộc Họp
              </h3>
              <button
                type="button"
                className="btn-close"
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                onClick={() => setViewingBookingDetail(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {isDetailLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  <div className="spinner" style={{ width: '24px', height: '24px', margin: '0 auto 10px auto', border: '3px solid var(--border-light)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  Đang tải chi tiết cuộc họp...
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className={`badge ${viewingBookingDetail.status === 'APPROVED' ? 'badge-approved' :
                        viewingBookingDetail.status === 'PENDING' ? 'badge-pending' :
                          viewingBookingDetail.status === 'REJECTED' ? 'badge-rejected' : 'badge-cancelled'
                        }`} style={{ fontSize: '0.75rem' }}>
                        {viewingBookingDetail.status === 'APPROVED' ? 'Đã duyệt' :
                          viewingBookingDetail.status === 'PENDING' ? 'Chờ duyệt' :
                            viewingBookingDetail.status === 'REJECTED' ? 'Từ chối' : 'Đã hủy'}
                      </span>
                      {viewingBookingDetail.titleNotification && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                          ({viewingBookingDetail.titleNotification})
                        </span>
                      )}
                    </div>
                    <h4 style={{ margin: '0.5rem 0 0 0', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {viewingBookingDetail.title}
                    </h4>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <Clock size={16} style={{ color: 'var(--accent)', minWidth: '16px' }} />
                      <span style={{ fontWeight: 600 }}>Thời gian:</span>
                      <span>
                        {new Date(viewingBookingDetail.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(viewingBookingDetail.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {', '}
                        {new Date(viewingBookingDetail.startTime).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <DoorOpen size={16} style={{ color: 'var(--accent)', minWidth: '16px' }} />
                      <span style={{ fontWeight: 600 }}>Phòng họp:</span>
                      <span>{viewingBookingDetail.roomName} (Tầng {viewingBookingDetail.floorNumber}, {viewingBookingDetail.roomAddress})</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <User size={16} style={{ color: 'var(--accent)', minWidth: '16px' }} />
                      <span style={{ fontWeight: 600 }}>Người đặt:</span>
                      <span>{viewingBookingDetail.userBooked} ({viewingBookingDetail.email}{viewingBookingDetail.phone ? `, SĐT: ${viewingBookingDetail.phone}` : ''})</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <Users size={16} style={{ color: 'var(--accent)', minWidth: '16px' }} />
                      <span style={{ fontWeight: 600 }}>Số lượng tham gia:</span>
                      <span>{viewingBookingDetail.attendee} người</span>
                    </div>
                  </div>

                  {viewingBookingDetail.description && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Mô tả cuộc họp:</span>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, backgroundColor: 'rgba(0,0,0,0.01)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', whiteSpace: 'pre-wrap' }}>
                        {viewingBookingDetail.description}
                      </p>
                    </div>
                  )}

                  {viewingBookingDetail.messageNotification && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', borderLeft: '3px solid var(--accent)', paddingLeft: '0.75rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>Nội dung thông báo:</span>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        "{viewingBookingDetail.messageNotification}"
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setViewingBookingDetail(null)}>
                Đóng
              </button>
              {!isDetailLoading &&
                viewingBookingDetail.status === 'PENDING' &&
                viewingBookingDetail.titleNotification === 'Thông báo lịch họp' &&
                viewingBookingDetail.messageNotification?.includes('mời') && (
                  <button
                    type="button"
                    className="btn btn-success"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'var(--success)', color: '#fff', border: 'none' }}
                    onClick={() => confirmParticipateMutation.mutate(viewingBookingDetail.id)}
                    disabled={confirmParticipateMutation.isPending}
                  >
                    <CheckCircle size={16} />
                    {confirmParticipateMutation.isPending ? 'Đang xác nhận...' : 'Xác nhận tham gia'}
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

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
