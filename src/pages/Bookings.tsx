import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiClient } from '../api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Calendar as CalendarIcon, 
  List, 
  Plus, 
  Clock, 
  MapPin, 
  Users, 
  X, 
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Mail,
  XCircle,
  FileSpreadsheet
} from 'lucide-react';

// Zod schemas
const bookingFormSchema = z.object({
  title: z.string().min(1, 'Vui lòng nhập tiêu đề cuộc họp'),
  description: z.string().optional(),
  roomId: z.coerce.number().min(1, 'Vui lòng chọn phòng họp'),
  start: z.string().min(1, 'Vui lòng chọn thời gian bắt đầu'),
  end: z.string().min(1, 'Vui lòng chọn thời gian kết thúc'),
  attendee: z.coerce.number().min(1, 'Số lượng tham gia tối thiểu là 1'),
  receiversInput: z.string().optional(), // Comma separated emails, will convert to receivers list
  equipments: z.array(z.object({
    equipmentId: z.coerce.number().min(1, 'Chọn thiết bị'),
    quantity: z.coerce.number().min(1, 'Số lượng tối thiểu là 1')
  })).optional()
}).refine((data) => new Date(data.start) < new Date(data.end), {
  message: "Thời gian kết thúc phải diễn ra sau thời gian bắt đầu",
  path: ["end"]
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

export const Bookings: React.FC = () => {
  const { user, hasAuthority } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Selected Booking ID from query param
  const bookingIdQuery = searchParams.get('bookingId');

  // Views & Filters state
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [calendarViewType, setCalendarViewType] = useState<'DAY' | 'WEEK' | 'MONTH'>('MONTH');
  const [targetDate, setTargetDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterRoom, setFilterRoom] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOrganizer, setFilterOrganizer] = useState('');

  // Modals state
  const [activeModal, setActiveModal] = useState<'create' | 'detail' | 'edit' | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [notes, setNotes] = useState('');

  // 1. Fetch Rooms for dropdowns
  const { data: rooms } = useQuery({
    queryKey: ['rooms', 'dropdown'],
    queryFn: async () => {
      const response = await apiClient.get('/room/all?page=0&size=100');
      return response.data?.data?.content || [];
    }
  });

  // 2. Fetch Equipments for dropdowns
  const { data: equipments } = useQuery({
    queryKey: ['equipments', 'dropdown'],
    queryFn: async () => {
      const response = await apiClient.get('/equipment/all?page=0&size=100');
      return response.data?.data?.content || [];
    }
  });

  // 3. Fetch Bookings list
  const { data: bookings, isLoading: isBookingsLoading } = useQuery({
    queryKey: ['bookings', 'list', viewMode, calendarViewType, targetDate, filterRoom, filterStatus, filterOrganizer],
    queryFn: async () => {
      if (viewMode === 'calendar') {
        const response = await apiClient.get(`/booking/view?viewType=${calendarViewType}&targetDate=${targetDate}`);
        return response.data?.data || [];
      } else {
        let url = `/booking/filter?`;
        if (filterRoom) url += `&roomId=${filterRoom}`;
        if (filterStatus) url += `&status=${filterStatus}`;
        if (filterOrganizer) url += `&bookedBy=${encodeURIComponent(filterOrganizer)}`;
        const response = await apiClient.get(url);
        return response.data?.data || [];
      }
    }
  });

  // 4. Fetch Booking Detail if query param is set
  const { data: bookingDetail } = useQuery({
    queryKey: ['bookings', 'detail', bookingIdQuery],
    queryFn: async () => {
      if (!bookingIdQuery) return null;
      const response = await apiClient.get(`/booking/${bookingIdQuery}`);
      return response.data?.data;
    },
    enabled: !!bookingIdQuery,
  });

  useEffect(() => {
    if (bookingDetail) {
      setSelectedBooking(bookingDetail);
      setActiveModal('detail');
    }
  }, [bookingDetail]);

  // Form Hooks
  const { 
    register, 
    handleSubmit, 
    reset, 
    control,
    formState: { errors } 
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema) as any,
    defaultValues: { equipments: [] }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'equipments'
  });

  // CREATE BOOKING MUTATION
  const createBookingMutation = useMutation({
    mutationFn: async (data: BookingFormValues) => {
      const startDateTime = new Date(data.start).toISOString();
      const endDateTime = new Date(data.end).toISOString();
      // Split email receivers list
      const receivers = data.receiversInput
        ? data.receiversInput.split(',').map((e) => e.trim()).filter((e) => e.length > 0)
        : [];
      
      const payload = {
        roomId: data.roomId,
        userId: user?.id || 1,
        title: data.title,
        description: data.description || '',
        start: startDateTime,
        end: endDateTime,
        attendee: data.attendee,
        equipments: data.equipments || [],
        receivers
      };
      
      await apiClient.post('/booking', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      showToast('Đăng ký lịch họp thành công, chờ người duyệt', 'success');
      setActiveModal(null);
      reset();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Có lỗi trùng lịch hoặc thiếu thiết bị';
      showToast(msg, 'error');
    }
  });

  // CANCEL BOOKING MUTATION
  const cancelBookingMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      await apiClient.patch(`/booking/cancel/${id}`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      showToast('Đã hủy lịch họp thành công', 'success');
      setActiveModal(null);
      setSearchParams({});
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể hủy lịch họp';
      showToast(msg, 'error');
    }
  });

  // APPROVE BOOKING MUTATION
  const approveMutation = useMutation({
    mutationFn: async ({ id, note }: { id: number; note: string }) => {
      await apiClient.patch(`/booking/approve/${id}`, { note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      showToast('Đã phê duyệt lịch họp thành công', 'success');
      setActiveModal(null);
      setSearchParams({});
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra';
      showToast(msg, 'error');
    }
  });

  // REJECT BOOKING MUTATION
  const rejectMutation = useMutation({
    mutationFn: async ({ id, note }: { id: number; note: string }) => {
      await apiClient.patch(`/booking/reject/${id}`, { note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      showToast('Đã từ chối lịch họp thành công', 'success');
      setActiveModal(null);
      setSearchParams({});
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra';
      showToast(msg, 'error');
    }
  });

  // CONFIRM ATTENDANCE MUTATION
  const confirmAttendanceMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.post(`/booking/${id}/attendee/confirm`);
    },
    onSuccess: () => {
      showToast('Đã xác nhận tham gia thành công', 'success');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: () => {
      showToast('Xác nhận tham gia thất bại hoặc bạn đã phản hồi trước đó', 'error');
    }
  });

  // EXPORT EXCEL MUTATION
  const handleExportExcel = async () => {
    try {
      // Export filters request
      const response = await apiClient.get('/booking/export', {
        responseType: 'blob'
      });
      // Download blob
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'danh-sach-lich-hop.xlsx');
      document.body.appendChild(link);
      link.click();
      showToast('Đã tải xuống file excel danh sách lịch họp', 'success');
    } catch (e) {
      showToast('Xuất báo cáo thất bại', 'error');
    }
  };

  const onSubmit = (data: BookingFormValues) => {
    createBookingMutation.mutate(data);
  };

  const handleBookingClick = (booking: any) => {
    setSearchParams({ bookingId: booking.id.toString() });
  };

  const closeDetailModal = () => {
    setActiveModal(null);
    setSearchParams({});
  };

  const changeTargetDate = (offsetDays: number) => {
    const current = new Date(targetDate);
    current.setDate(current.getDate() + offsetDays);
    setTargetDate(current.toISOString().split('T')[0]);
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatFullDate = (timeStr: string) => {
    if (!timeStr) return '';
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return '';
    return `${d.toLocaleDateString('vi-VN')} vào lúc ${formatTime(timeStr)}`;
  };

  const renderMonthCalendar = () => {
    const current = new Date(targetDate);
    const year = current.getFullYear();
    const month = current.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const calendarCells = [];
    
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, dayNum);
      calendarCells.push({
        date: prevDate,
        dayNumber: dayNum,
        isCurrentMonth: false,
        dateString: prevDate.toISOString().split('T')[0]
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const currDate = new Date(year, month, i);
      calendarCells.push({
        date: currDate,
        dayNumber: i,
        isCurrentMonth: true,
        dateString: currDate.toISOString().split('T')[0]
      });
    }

    const remaining = 42 - calendarCells.length;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      calendarCells.push({
        date: nextDate,
        dayNumber: i,
        isCurrentMonth: false,
        dateString: nextDate.toISOString().split('T')[0]
      });
    }

    const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

    return (
      <>
        {/* Weekday headers */}
        <div className="calendar-header-row">
          {weekdays.map((d) => (
            <div key={d} className="calendar-header-cell">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="calendar-grid">
          {calendarCells.map((cell, idx) => {
            const dateBookings = bookings?.filter((b: any) => b.startTime && typeof b.startTime === 'string' && b.startTime.startsWith(cell.dateString)) || [];
            const isToday = new Date().toISOString().split('T')[0] === cell.dateString;
            
            let cellClasses = "calendar-day-cell";
            if (!cell.isCurrentMonth) cellClasses += " inactive";
            if (isToday) cellClasses += " today";

            return (
              <div key={idx} className={cellClasses}>
                <div className="calendar-day-number">
                  {cell.dayNumber}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1, overflow: 'hidden' }}>
                  {dateBookings.slice(0, 2).map((b: any) => {
                    let badgeClass = "calendar-event-badge";
                    if (b.status === 'APPROVED') badgeClass += " approved";
                    else if (b.status === 'PENDING') badgeClass += " pending";
                    else if (b.status === 'REJECTED') badgeClass += " rejected";
                    else if (b.status === 'CANCELLED') badgeClass += " cancelled";
                    else badgeClass += " pending";

                    return (
                      <div 
                        key={b.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBookingClick(b);
                        }}
                        className={badgeClass}
                      >
                        <span style={{ fontWeight: 600, opacity: 0.85 }}>{formatTime(b.startTime)}</span>
                        <span>{b.title}</span>
                      </div>
                    );
                  })}
                  {dateBookings.length > 2 && (
                    <div className="calendar-more-indicator">
                      + {dateBookings.length - 2} lịch họp
                    </div>
                  )}
                </div>

                {/* Hover Popover containing full detail list of bookings of this day */}
                {dateBookings.length > 0 && (
                  <div className="calendar-day-popover">
                    <div className="calendar-day-popover-header">
                      Ngày {cell.dayNumber} - {dateBookings.length} lịch họp
                    </div>
                    <div className="calendar-day-popover-body">
                      {dateBookings.map((b: any) => {
                        let itemClass = "calendar-popover-item";
                        if (b.status === 'APPROVED') itemClass += " approved";
                        else if (b.status === 'PENDING') itemClass += " pending";
                        else if (b.status === 'REJECTED') itemClass += " rejected";
                        else if (b.status === 'CANCELLED') itemClass += " cancelled";

                        return (
                          <div 
                            key={b.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBookingClick(b);
                            }}
                            className={itemClass}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span className="calendar-popover-time">{formatTime(b.startTime)} - {formatTime(b.endTime)}</span>
                              <span className={`badge badge-${b.status?.toLowerCase() || 'pending'}`} style={{ fontSize: '0.62rem', padding: '2px 6px' }}>
                                {b.status === 'APPROVED' ? 'Đã duyệt' : b.status === 'PENDING' ? 'Chờ duyệt' : b.status === 'REJECTED' ? 'Từ chối' : 'Hủy'}
                              </span>
                            </div>
                            <div className="calendar-popover-title">{b.title}</div>
                            <div className="calendar-popover-meta">📍 {b.roomName} (Tầng {b.floorNumber})</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Calendar Legend */}
        <div className="calendar-legend">
          <div className="calendar-legend-item">
            <span className="calendar-legend-dot" style={{ backgroundColor: 'var(--success)' }}></span>
            <span>Đã duyệt</span>
          </div>
          <div className="calendar-legend-item">
            <span className="calendar-legend-dot" style={{ backgroundColor: 'var(--warning)' }}></span>
            <span>Chờ duyệt</span>
          </div>
          <div className="calendar-legend-item">
            <span className="calendar-legend-dot" style={{ backgroundColor: 'var(--danger)' }}></span>
            <span>Từ chối</span>
          </div>
          <div className="calendar-legend-item">
            <span className="calendar-legend-dot" style={{ backgroundColor: 'var(--text-tertiary)' }}></span>
            <span>Đã hủy</span>
          </div>
        </div>
      </>
    );
  };

  const renderWeekCalendar = () => {
    const current = new Date(targetDate);
    const dayOfWeek = current.getDay();
    const startOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const monday = new Date(current);
    monday.setDate(current.getDate() - startOffset);

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      weekDays.push({
        date: day,
        dateString: day.toISOString().split('T')[0],
        label: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][i]
      });
    }

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', overflowX: 'auto', padding: '1.25rem' }}>
        {weekDays.map((day, idx) => {
          const dateBookings = bookings?.filter((b: any) => b.startTime && typeof b.startTime === 'string' && b.startTime.startsWith(day.dateString)) || [];
          const isToday = new Date().toISOString().split('T')[0] === day.dateString;
          
          return (
            <div 
              key={idx} 
              style={{
                minWidth: '120px',
                minHeight: '280px',
                backgroundColor: 'rgba(30, 41, 59, 0.4)',
                border: isToday ? '1px solid var(--accent)' : '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '0.75rem'
              }}
            >
              <div style={{ textAlign: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{day.label}</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: isToday ? 'var(--accent)' : '#fff', marginTop: '0.15rem' }}>
                  {day.date.getDate()}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexGrow: 1, overflowY: 'auto' }}>
                {dateBookings.length === 0 ? (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: '1rem', fontStyle: 'italic' }}>
                    Không có lịch
                  </div>
                ) : (
                  dateBookings.map((b: any) => (
                    <div 
                      key={b.id}
                      onClick={() => handleBookingClick(b)}
                      style={{
                        fontSize: '0.75rem',
                        padding: '6px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        borderLeft: `3px solid ${b.status === 'APPROVED' ? 'var(--success)' : b.status === 'PENDING' ? 'var(--warning)' : 'var(--danger)'}`,
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                        {formatTime(b.startTime)}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        📍 {b.roomName}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDayCalendar = () => {
    const sortedBookings = bookings?.filter((b: any) => b.startTime && typeof b.startTime === 'string' && b.startTime.startsWith(targetDate))
      .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()) || [];

    return (
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
          Lịch trình Ngày {new Date(targetDate).toLocaleDateString('vi-VN')}
        </h3>

        {sortedBookings.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
            Không có cuộc họp nào được lên lịch cho ngày này.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sortedBookings.map((b: any) => (
              <div 
                key={b.id}
                onClick={() => handleBookingClick(b)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  borderLeft: `4px solid ${b.status === 'APPROVED' ? 'var(--success)' : b.status === 'PENDING' ? 'var(--warning)' : 'var(--danger)'}`,
                  cursor: 'pointer'
                }}
              >
                <div style={{ minWidth: '90px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)' }}>
                  {formatTime(b.startTime)} - {formatTime(b.endTime)}
                </div>
                
                <div style={{ flexGrow: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#fff', fontWeight: 600 }}>{b.title}</h4>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    📍 {b.roomName} • {b.attendee} người tham gia
                  </div>
                </div>

                <div>
                  <span className={`badge badge-${b.status?.toLowerCase() || 'pending'}`}>
                    {b.status || 'Chờ duyệt'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const isApprover = hasAuthority('BOOKING:APPROVE');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Top action row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Lịch Đặt Phòng Họp</h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Tra cứu, đăng ký, xuất Excel và phê duyệt yêu cầu sử dụng phòng</p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={handleExportExcel}>
            <FileSpreadsheet size={16} /> Xuất Excel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => {
              reset();
              setActiveModal('create');
            }}
          >
            <Plus size={16} /> Đăng ký lịch họp
          </button>
        </div>
      </div>

      {/* Unified Scheduler Container */}
      <div className="calendar-container">
        {/* Integrated Top Toolbar */}
        <div className="calendar-top-bar">
          {/* Left: View Mode toggles */}
          <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            <button 
              type="button"
              className="btn btn-ghost" 
              style={{ 
                padding: '0.4rem 0.75rem', 
                fontSize: '0.8rem', 
                borderRadius: 'var(--radius-sm)',
                backgroundColor: viewMode === 'list' ? 'var(--bg-secondary)' : 'transparent',
                color: viewMode === 'list' ? 'var(--accent)' : 'var(--text-secondary)',
                boxShadow: viewMode === 'list' ? 'var(--shadow-sm)' : 'none'
              }}
              onClick={() => setViewMode('list')}
            >
              <List size={16} /> Danh sách
            </button>
            <button 
              type="button"
              className="btn btn-ghost" 
              style={{ 
                padding: '0.4rem 0.75rem', 
                fontSize: '0.8rem', 
                borderRadius: 'var(--radius-sm)',
                backgroundColor: viewMode === 'calendar' ? 'var(--bg-secondary)' : 'transparent',
                color: viewMode === 'calendar' ? 'var(--accent)' : 'var(--text-secondary)',
                boxShadow: viewMode === 'calendar' ? 'var(--shadow-sm)' : 'none'
              }}
              onClick={() => setViewMode('calendar')}
            >
              <CalendarIcon size={16} /> Lịch biểu
            </button>
          </div>

          {/* Center: Date picker for Calendar view */}
          {viewMode === 'calendar' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button type="button" className="calendar-control-btn" onClick={() => changeTargetDate(-7)}>
                <ChevronLeft size={16} />
              </button>
              <input 
                type="date" 
                className="calendar-date-input" 
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
              <button type="button" className="calendar-control-btn" onClick={() => changeTargetDate(7)}>
                <ChevronRight size={16} />
              </button>

              {/* Sub-view selection */}
              <select 
                className="calendar-date-input" 
                style={{ appearance: 'none', minWidth: '120px' }}
                value={calendarViewType}
                onChange={(e: any) => setCalendarViewType(e.target.value)}
              >
                <option value="MONTH">Theo Tháng</option>
                <option value="WEEK">Theo Tuần</option>
                <option value="DAY">Theo Ngày</option>
              </select>
            </div>
          ) : (
            /* Right: Filters (list view only) */
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select 
                className="calendar-date-input" 
                style={{ appearance: 'none', minWidth: '130px' }}
                value={filterRoom}
                onChange={(e) => setFilterRoom(e.target.value)}
              >
                <option value="">-- Phòng họp --</option>
                {rooms?.map((r: any) => (
                  <option key={r.id} value={r.id}>{r.roomName}</option>
                ))}
              </select>

              <select 
                className="calendar-date-input" 
                style={{ appearance: 'none', minWidth: '120px' }}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">-- Trạng thái --</option>
                <option value="PENDING">Đang chờ</option>
                <option value="APPROVED">Đã duyệt</option>
                <option value="REJECTED">Từ chối</option>
                <option value="CANCELLED">Đã hủy</option>
              </select>

              <input 
                type="text" 
                className="calendar-date-input" 
                style={{ maxWidth: '140px' }}
                placeholder="Người đặt..."
                value={filterOrganizer}
                onChange={(e) => setFilterOrganizer(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Display Area Content */}
        {isBookingsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem' }}>
            <div className="skeleton" style={{ height: '80px', width: '100%' }} />
            <div className="skeleton" style={{ height: '80px', width: '100%' }} />
            <div className="skeleton" style={{ height: '80px', width: '100%' }} />
          </div>
        ) : viewMode === 'calendar' ? (
          bookings?.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              Không tìm thấy cuộc họp nào trong hệ thống cho khoảng thời gian này.
            </div>
          ) : (
            calendarViewType === 'MONTH' ? renderMonthCalendar() :
            calendarViewType === 'WEEK' ? renderWeekCalendar() :
            renderDayCalendar()
          )
        ) : bookings?.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            Không tìm thấy cuộc họp nào trong hệ thống.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.25rem' }}>
            {bookings?.map((item: any) => (
              <div 
                key={item.id}
                onClick={() => handleBookingClick(item)}
                className="glass-card glass-card-hover"
                style={{
                  padding: '1.25rem',
                  borderLeft: `4px solid ${
                    item.status === 'APPROVED' ? 'var(--success)' : 
                    item.status === 'REJECTED' ? 'var(--danger)' : 
                    item.status === 'PENDING' ? 'var(--warning)' : 'var(--text-tertiary)'
                  }`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 600 }}>{item.title}</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <MapPin size={14} /> {item.roomName} (Tầng {item.floorNumber})
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={14} /> {formatTime(item.startTime)} - {formatTime(item.endTime)} ({new Date(item.startTime).toLocaleDateString('vi-VN')})
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Users size={14} /> {item.attendee} người tham gia
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span className={`badge badge-${item.status?.toLowerCase() || 'pending'}`}>
                    {item.status || 'Chờ duyệt'}
                  </span>
                  <ChevronRight size={18} style={{ color: 'var(--text-tertiary)' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE BOOKING MODAL */}
      {activeModal === 'create' && (
        <div className="modal-overlay">
          <form onSubmit={handleSubmit(onSubmit)} className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Đăng ký phòng họp</h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px', minWidth: 'auto' }} onClick={() => setActiveModal(null)}>
                <XCircle size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="book-title">Tiêu đề cuộc họp *</label>
                <input 
                  id="book-title"
                  className="form-control" 
                  placeholder="Họp tổng kết tuần / Kick-off dự án..." 
                  {...register('title')}
                />
                {errors.title && <span className="form-error">{errors.title.message}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="book-desc">Mô tả nội dung cuộc họp</label>
                <textarea 
                  id="book-desc"
                  className="form-control" 
                  style={{ minHeight: '50px', resize: 'vertical' }}
                  placeholder="Thảo luận kế hoạch phát triển quý tiếp theo..." 
                  {...register('description')}
                />
              </div>

              <div className="grid-cols-2" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="book-room">Chọn Phòng họp *</label>
                  <select 
                    id="book-room"
                    className="form-control" 
                    {...register('roomId')}
                  >
                    <option value="">-- Chọn phòng trống --</option>
                    {rooms?.map((r: any) => (
                      <option key={r.id} value={r.id}>{r.roomName} (Tầng {r.floorNumber} - {r.capacity} chỗ)</option>
                    ))}
                  </select>
                  {errors.roomId && <span className="form-error">{errors.roomId.message}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="book-attendees">Số người tham dự họp *</label>
                  <input 
                    id="book-attendees"
                    type="number" 
                    className="form-control" 
                    placeholder="8" 
                    {...register('attendee')}
                  />
                  {errors.attendee && <span className="form-error">{errors.attendee.message}</span>}
                </div>
              </div>

              <div className="grid-cols-2" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="book-start">Thời gian bắt đầu *</label>
                  <input 
                    id="book-start"
                    type="datetime-local" 
                    className="form-control" 
                    {...register('start')}
                  />
                  {errors.start && <span className="form-error">{errors.start.message}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="book-end">Thời gian kết thúc *</label>
                  <input 
                    id="book-end"
                    type="datetime-local" 
                    className="form-control" 
                    {...register('end')}
                  />
                  {errors.end && <span className="form-error">{errors.end.message}</span>}
                </div>
              </div>

              {/* Receivers emails invite */}
              <div className="form-group">
                <label className="form-label" htmlFor="book-receivers">Mời đại biểu tham dự (Email cách nhau bởi dấu phẩy)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                    <Mail size={16} />
                  </span>
                  <input 
                    id="book-receivers"
                    className="form-control" 
                    style={{ width: '100%', paddingLeft: '2.5rem' }}
                    placeholder="partner@company.com, ceo@company.com" 
                    {...register('receiversInput')}
                  />
                </div>
              </div>

              {/* Equipment selections */}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span className="form-label">Yêu cầu bổ sung thiết bị họp</span>
                  <button 
                    type="button" 
                    className="btn btn-ghost" 
                    style={{ fontSize: '0.75rem', padding: '4px 8px', color: 'var(--accent)' }}
                    onClick={() => append({ equipmentId: 1, quantity: 1 })}
                  >
                    Thêm thiết bị
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '120px', overflowY: 'auto' }}>
                  {fields.map((field, index) => (
                    <div key={field.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <select 
                        className="form-control" 
                        style={{ flexGrow: 1 }}
                        {...register(`equipments.${index}.equipmentId` as const)}
                      >
                        {equipments?.map((eq: any) => (
                          <option key={eq.id} value={eq.id}>{eq.equipmentName}</option>
                        ))}
                      </select>
                      
                      <input 
                        type="number" 
                        className="form-control" 
                        style={{ width: '80px' }} 
                        placeholder="SL"
                        {...register(`equipments.${index}.quantity` as const)}
                      />

                      <button 
                        type="button" 
                        className="btn btn-ghost" 
                        style={{ color: 'var(--danger)', padding: '6px', minWidth: 'auto' }}
                        onClick={() => remove(index)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={createBookingMutation.isPending}>
                {createBookingMutation.isPending ? 'Đang gửi...' : 'Đăng Ký Đặt Lịch'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DETAIL MODAL */}
      {activeModal === 'detail' && selectedBooking && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Chi tiết cuộc họp</h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px', minWidth: 'auto' }} onClick={closeDetailModal}>
                <XCircle size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Title & Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedBooking.title}</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    {selectedBooking.description || 'Không có mô tả chi tiết cho cuộc họp này.'}
                  </p>
                </div>
                <span className={`badge badge-${selectedBooking.status?.toLowerCase() || 'pending'}`}>
                  {selectedBooking.status || 'Chờ duyệt'}
                </span>
              </div>

              {/* Metadata Info Panel */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: 'var(--bg-tertiary)', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <MapPin size={16} style={{ color: 'var(--accent)' }} />
                  <span>Phòng họp: <strong>{selectedBooking.roomName}</strong> (Tầng {selectedBooking.floorNumber} - {selectedBooking.roomAddress || 'Tòa A'})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <Clock size={16} style={{ color: 'var(--accent)' }} />
                  <span>Bắt đầu: <strong>{formatFullDate(selectedBooking.startTime)}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <Clock size={16} style={{ color: 'var(--accent)' }} />
                  <span>Kết thúc: <strong>{formatFullDate(selectedBooking.endTime)}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <Users size={16} style={{ color: 'var(--accent)' }} />
                  <span>Quy mô đại biểu: <strong>{selectedBooking.attendee} người tham dự</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <UserCheck size={16} style={{ color: 'var(--accent)' }} />
                  <span>Người đặt lịch: <strong>{selectedBooking.userBooked}</strong> ({selectedBooking.phone})</span>
                </div>
              </div>

              {/* Equipment list request details */}
              {selectedBooking.equipments && selectedBooking.equipments.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Thiết bị họp bổ sung</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {selectedBooking.equipments.map((eq: any, index: number) => (
                      <div 
                        key={index}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.75rem',
                          backgroundColor: 'var(--bg-primary)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-light)',
                          fontSize: '0.8rem'
                        }}
                      >
                        <span>{eq.equipmentName}</span>
                        <strong>Số lượng: x{eq.usingQuantity || eq.quantity}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reject / Cancel inputs if status permits */}
              {selectedBooking.status === 'PENDING' && (
                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                  <label className="form-label" htmlFor="detail-notes">Ý kiến đóng góp / Lý do từ chối (bắt buộc khi từ chối)</label>
                  <textarea 
                    id="detail-notes"
                    className="form-control"
                    placeholder="Nhập ghi chú ý kiến tại đây..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{ minHeight: '60px', width: '100%' }}
                  />
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeDetailModal}>Đóng</button>

              {/* Confirm attendance button */}
              {selectedBooking.status === 'APPROVED' && (
                <button 
                  type="button" 
                  className="btn" 
                  style={{ backgroundColor: 'var(--info)', color: '#fff' }}
                  onClick={() => confirmAttendanceMutation.mutate(selectedBooking.id)}
                >
                  Xác nhận tham gia
                </button>
              )}

              {/* Actions for Approvers */}
              {isApprover && selectedBooking.status === 'PENDING' && (
                <>
                  <button 
                    type="button" 
                    className="btn btn-danger"
                    onClick={() => {
                      if (!notes) {
                        showToast('Vui lòng nhập lý do từ chối vào ô ghi chú', 'error');
                        return;
                      }
                      rejectMutation.mutate({ id: selectedBooking.id, note: notes });
                    }}
                  >
                    Từ chối
                  </button>
                  <button 
                    type="button" 
                    className="btn"
                    style={{ backgroundColor: 'var(--success)', color: '#fff' }}
                    onClick={() => approveMutation.mutate({ id: selectedBooking.id, note: notes })}
                  >
                    Phê duyệt
                  </button>
                </>
              )}

              {/* Actions for Booking owner */}
              {selectedBooking.status === 'PENDING' && !isApprover && (
                <button 
                  type="button" 
                  className="btn btn-danger"
                  onClick={() => cancelBookingMutation.mutate({ id: selectedBooking.id, reason: 'Người dùng hủy đặt' })}
                >
                  Hủy lịch đặt
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
