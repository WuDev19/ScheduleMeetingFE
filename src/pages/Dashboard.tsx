import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  DoorOpen,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  Briefcase,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user, hasAuthority } = useAuth();
  const navigate = useNavigate();
  const [pendingPage, setPendingPage] = useState(0);

  // 1. Fetch My Bookings (Filtered by email / user Booked)
  const { data: myBookings, isLoading: isMyBookingsLoading } = useQuery({
    queryKey: ['bookings', 'my-upcoming', user?.username],
    queryFn: async () => {
      if (!user?.username) return [];
      const response = await apiClient.get(`/booking/filter?bookedBy=${encodeURIComponent(user.username)}&size=100`);
      const list = response.data?.data?.content || [];
      const now = new Date();
      return list
        .filter((b: any) => new Date(b.endTime) > now)
        .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    },
    enabled: !!user?.username,
  });
  const { data: userDetail } = useQuery({
    queryKey: ['user', 'detail', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const response = await apiClient.get(`/user/me/${user.id}`);
      return response.data?.data;
    },
    enabled: !!user?.id,
  });
  // 2. Fetch Pending Bookings for Approvers
  const isApprover = hasAuthority('BOOKING:APPROVE');
  const { data: pendingData, isLoading: isPendingLoading } = useQuery({
    queryKey: ['bookings', 'pending', pendingPage],
    queryFn: async () => {
      const response = await apiClient.get(`/booking/pending?page=${pendingPage}&size=5`);
      return response.data?.data;
    },
    enabled: isApprover && !!user,
  });

  const pendingBookings = pendingData?.content || [];
  const pendingTotalPages = pendingData?.totalPages || 0;

  // 3. Fetch Rooms stats
  const { data: roomsCount } = useQuery({
    queryKey: ['rooms', 'count'],
    queryFn: async () => {
      const response = await apiClient.get('/room/all?page=0&size=1');
      return response.data?.data?.totalElements || 0;
    },
    enabled: !!user,
  });

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString('vi-VN')} lúc ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Greetings section */}
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Chào buổi làm việc, {user?.username}!</h2>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Hôm nay bạn có {myBookings?.length || 0} lịch họp sắp diễn ra.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid-cols-3">
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--accent-light)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Calendar size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>Lịch họp sắp tới</span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              {isMyBookingsLoading ? '...' : (myBookings && myBookings.length > 5 ? '5+' : myBookings?.length || 0)}
            </h3>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            color: 'var(--success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <DoorOpen size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>Tổng số phòng họp</span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              {roomsCount || 0}
            </h3>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(14, 165, 233, 0.08)',
            color: 'var(--info)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Briefcase size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>Bộ phận của bạn</span>
            {/* ✅ [SỬA] Hiển thị department từ userDetail.department.name */}
            {/* Nếu chưa chọn phòng ban, hiển thị "(Chưa cập nhật)" */}
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userDetail?.department?.name || '(Chưa cập nhật)'}
            </h3>
          </div>
        </div>
      </div>

      {/* Main Grid: My Bookings & Approver panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* Approvals (Only visible to Approver/Admin role) */}
        {isApprover && (
          <section className="glass-card" style={{ borderLeft: '4px solid var(--warning)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={20} style={{ color: 'var(--warning)' }} />
                Yêu cầu chờ duyệt ({pendingData?.totalElements || 0})
              </h3>
            </div>

            {isPendingLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="skeleton" style={{ height: '70px', width: '100%' }} />
                <div className="skeleton" style={{ height: '70px', width: '100%' }} />
              </div>
            ) : pendingBookings?.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                Tuyệt vời! Không có yêu cầu nào đang chờ xử lý.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {pendingBookings?.map((item: any) => {
                    let actionBadgeColor = 'var(--accent)';
                    let actionText = 'Đăng ký mới';
                    if (item.actionType === 'UPDATED') {
                      actionBadgeColor = 'var(--info)';
                      actionText = 'Thay đổi thông tin';
                    } else if (item.actionType === 'ADD_EQUIPMENT' || item.actionType === 'UPDATE_EQUIP_QUANTITY') {
                      actionBadgeColor = 'var(--warning)';
                      actionText = 'Cập nhật thiết bị';
                    }

                    return (
                      <div
                        key={item.historyId}
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '1rem',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--bg-primary)',
                          border: '1px solid var(--border-light)',
                          gap: '1rem'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{
                              backgroundColor: actionBadgeColor,
                              color: '#fff',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              textTransform: 'uppercase'
                            }}>
                              {actionText}
                            </span>
                            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</h4>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <span>Phòng: <strong>{item.roomName}</strong></span>
                            <span>Người đặt: <strong>{item.userBooked}</strong></span>
                            <span>Thời gian: {formatDateTime(item.startTime)}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => navigate(`/bookings?tab=approvals&historyId=${item.historyId}`)}
                            className="btn"
                            style={{ backgroundColor: 'var(--success)', color: '#fff', fontSize: '0.8rem', padding: '0.5rem 0.875rem' }}
                          >
                            <CheckCircle size={14} /> Duyệt
                          </button>
                          <button
                            onClick={() => navigate(`/bookings?tab=approvals&historyId=${item.historyId}`)}
                            className="btn"
                            style={{ backgroundColor: 'var(--danger)', color: '#fff', fontSize: '0.8rem', padding: '0.5rem 0.875rem' }}
                          >
                            <XCircle size={14} /> Từ chối
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!isPendingLoading && pendingTotalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      disabled={pendingPage === 0}
                      onClick={() => setPendingPage(prev => Math.max(0, prev - 1))}
                    >
                      <ChevronLeft size={14} /> Trước
                    </button>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Trang {pendingPage + 1} / {pendingTotalPages}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      disabled={pendingPage >= pendingTotalPages - 1}
                      onClick={() => setPendingPage(prev => Math.min(pendingTotalPages - 1, prev + 1))}
                    >
                      Sau <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* My upcoming meetings */}
        <section className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Lịch họp cá nhân sắp tới</h3>
            <Link to="/bookings" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.825rem', fontWeight: 600 }}>
              Xem toàn bộ lịch <ArrowRight size={16} />
            </Link>
          </div>

          {isMyBookingsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="skeleton" style={{ height: '60px', width: '100%' }} />
              <div className="skeleton" style={{ height: '60px', width: '100%' }} />
              <div className="skeleton" style={{ height: '60px', width: '100%' }} />
            </div>
          ) : myBookings?.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <AlertCircle size={40} style={{ color: 'var(--text-tertiary)' }} />
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Không có lịch họp nào sắp diễn ra</p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Bạn có muốn lên lịch họp mới không?</p>
              </div>
              <Link to="/bookings" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
                Đăng ký họp ngay
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {myBookings?.slice(0, 5).map((item: any) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/bookings?bookingId=${item.id}`)}
                  className="glass-card-hover"
                  style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    backgroundColor: 'var(--bg-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <DoorOpen size={14} /> {item.roomName} ({item.roomAddress || 'Tầng ' + item.floorNumber})
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={14} /> {formatDateTime(item.startTime)}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Users size={14} /> {item.attendee} người tham gia
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {/* Visual Badge represent booking status */}
                    <span className="badge badge-approved">Đã duyệt</span>
                    <ArrowRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                </div>
              ))}

              {myBookings && myBookings.length > 5 && (
                <div style={{
                  textAlign: 'center',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--border-light)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-tertiary)',
                  fontSize: '0.85rem'
                }}>
                  ... và còn <strong>{myBookings.length - 5}</strong> lịch họp khác.
                </div>
              )}
            </div>
          )}
        </section>
      </div>

    </div>
  );
};
