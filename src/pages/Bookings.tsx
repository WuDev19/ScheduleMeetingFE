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
  FileSpreadsheet,
  Package,
  ArrowRight,
  CheckCircle
} from 'lucide-react';

// Helper to format Date to local YYYY-MM-DD
const formatLocalYYYYMMDD = (date: Date): string => {
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd}`;
};

// Helper to parse local YYYY-MM-DD to a local Date object (at midnight)
const parseLocalYYYYMMDD = (dateStr: string): Date => {
  const [yyyy, MM, dd] = dateStr.split('-').map(Number);
  return new Date(yyyy, MM - 1, dd || 1);
};

// Helper to get local YYYY-MM-DD from an API date/time string
const getLocalDateStr = (dateTimeStr: string | undefined | null): string => {
  if (!dateTimeStr) return '';
  const date = new Date(dateTimeStr);
  if (isNaN(date.getTime())) return '';
  return formatLocalYYYYMMDD(date);
};

// Helper to format Date/string to local YYYY-MM-DDTHH:mm for datetime-local input
const formatDateTimeLocal = (dateTimeStr: string | undefined | null): string => {
  if (!dateTimeStr) return '';
  const date = new Date(dateTimeStr);
  if (isNaN(date.getTime())) return '';
  const pad = (num: number) => String(num).padStart(2, '0');
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
};

// Helper to check if two time strings represent the same instant
const isSameTime = (timeStrA: string | undefined | null, timeStrB: string | undefined | null): boolean => {
  if (!timeStrA || !timeStrB) return timeStrA === timeStrB;
  const dA = new Date(timeStrA);
  const dB = new Date(timeStrB);
  return dA.getTime() === dB.getTime();
};

// Helper to format date string to "yyyy-MM-dd HH:mm:ssXXX"
const formatDateTimeForApi = (dateTimeStr: string): string => {
  if (!dateTimeStr) return '';
  const date = new Date(dateTimeStr);
  const pad = (num: number) => String(num).padStart(2, '0');

  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());

  const offsetMinutes = date.getTimezoneOffset();
  const offsetSign = offsetMinutes <= 0 ? '+' : '-';
  const absOffsetMinutes = Math.abs(offsetMinutes);
  const offsetHours = pad(Math.floor(absOffsetMinutes / 60));
  const offsetMins = pad(absOffsetMinutes % 60);

  return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}${offsetSign}${offsetHours}:${offsetMins}`;
};

const EquipmentRow: React.FC<{
  eq: any;
  canEdit: boolean;
  onUpdate: (quantity: number) => void;
  isPending: boolean;
}> = ({ eq, canEdit, onUpdate, isPending }) => {
  const [qty, setQty] = useState(eq.usingQuantity || eq.quantity || 1);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setQty(eq.usingQuantity || eq.quantity || 1);
  }, [eq]);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.5rem 0.75rem',
        backgroundColor: 'var(--bg-primary)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-light)',
        fontSize: '0.8rem',
        gap: '0.5rem'
      }}
    >
      <span>{eq.equipmentName}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {isEditing && canEdit ? (
          <>
            <input
              type="number"
              className="form-control"
              style={{ width: '60px', padding: '2px 5px', fontSize: '0.75rem', height: '26px' }}
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
            <button
              type="button"
              className="btn"
              style={{
                backgroundColor: 'var(--success)',
                color: '#fff',
                padding: '2px 8px',
                fontSize: '0.7rem',
                minWidth: 'auto',
                height: '26px'
              }}
              disabled={isPending}
              onClick={() => {
                if (qty === (eq.usingQuantity || eq.quantity)) {
                  setIsEditing(false);
                  return;
                }
                onUpdate(qty);
                setIsEditing(false);
              }}
            >
              Lưu
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                padding: '2px 8px',
                fontSize: '0.7rem',
                minWidth: 'auto',
                height: '26px'
              }}
              onClick={() => {
                setQty(eq.usingQuantity || eq.quantity || 1);
                setIsEditing(false);
              }}
            >
              Hủy
            </button>
          </>
        ) : (
          <>
            <strong>Số lượng: x{eq.usingQuantity || eq.quantity}</strong>
            {canEdit && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{
                  color: 'var(--accent)',
                  padding: '2px 6px',
                  fontSize: '0.7rem',
                  minWidth: 'auto',
                  border: '1px solid var(--border-light)',
                  borderRadius: '4px'
                }}
                onClick={() => setIsEditing(true)}
              >
                Sửa số lượng
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

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

const editBookingFormSchema = z.object({
  title: z.string().min(1, 'Vui lòng nhập tiêu đề cuộc họp'),
  description: z.string().optional(),
  roomId: z.coerce.number().min(1, 'Vui lòng chọn phòng họp'),
  start: z.string().min(1, 'Vui lòng chọn thời gian bắt đầu'),
  end: z.string().min(1, 'Vui lòng chọn thời gian kết thúc'),
  attendee: z.coerce.number().min(1, 'Số lượng tham gia tối thiểu là 1'),
}).refine((data) => new Date(data.start) < new Date(data.end), {
  message: "Thời gian kết thúc phải diễn ra sau thời gian bắt đầu",
  path: ["end"]
});

type EditBookingFormValues = z.infer<typeof editBookingFormSchema>;

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
  const [targetDate, setTargetDate] = useState(() => formatLocalYYYYMMDD(new Date()));
  const [filterRoom, setFilterRoom] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOrganizer, setFilterOrganizer] = useState('');
  const [filterMyBookings, setFilterMyBookings] = useState(false);
  const [listPage, setListPage] = useState(0);

  // Reset page when filters change
  useEffect(() => {
    setListPage(0);
  }, [filterRoom, filterStatus, filterOrganizer, filterMyBookings, viewMode]);

  // Sub-tabs for Approver
  const isApprover = hasAuthority('BOOKING:APPROVE');
  const [activeSubTab, setActiveSubTab] = useState<'scheduler' | 'approvals'>('scheduler');

  // Modals state
  const [activeModal, setActiveModal] = useState<'create' | 'detail' | 'edit' | 'approval-detail' | 'add-equipment' | null>(null);
  const [addEquipRows, setAddEquipRows] = useState<{ equipmentId: number; quantity: number; action: 'ADD' | 'DELETE' }[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Fetch pending approvals for Approver
  const { data: pendingApprovals, isLoading: isPendingApprovalsLoading } = useQuery({
    queryKey: ['bookings', 'pending'],
    queryFn: async () => {
      const response = await apiClient.get('/booking/pending?page=0&size=10');
      return response.data?.data?.content || [];
    },
    enabled: isApprover,
  });

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
    queryKey: ['bookings', 'list', viewMode, calendarViewType, targetDate, filterRoom, filterStatus, filterOrganizer, filterMyBookings, listPage],
    queryFn: async () => {
      if (viewMode === 'calendar') {
        const url = `/booking/view?viewType=${calendarViewType}&targetDate=${targetDate}`;
        const response = await apiClient.get(url);
        let result = response.data?.data || [];

        try {
          const unavailResponse = await apiClient.get('/unavailability-room/all?isDeleted=false&page=0&size=1000');
          const unavailList = unavailResponse.data?.data?.content || [];
          const mappedUnavail = unavailList.map((un: any) => ({
            id: `unavail-${un.unId}`,
            title: `[BẬN/BẢO TRÌ] ${un.reason}`,
            startTime: un.start,
            endTime: un.end,
            roomName: un.room?.roomName || 'Phòng họp',
            roomId: un.room?.id,
            status: 'UNAVAILABLE',
            isUnavailability: true
          }));
          result = [...result, ...mappedUnavail];
        } catch (error) {
          console.error("Error fetching unavailabilities for calendar:", error);
        }

        // Client-side filter: compare username from JWT (user.username = JWT sub claim) with b.username from API
        if (filterMyBookings && user?.username) {
          result = result.filter((b: any) => b.username === user.username);
        }
        return result;
      } else {
        let url = `/booking/filter?page=${listPage}&size=10`;
        if (filterRoom) url += `&roomId=${filterRoom}`;
        if (filterStatus) url += `&status=${filterStatus}`;
        if (filterOrganizer) url += `&bookedBy=${encodeURIComponent(filterOrganizer)}`;
        if (filterMyBookings && user?.username) url += `&bookedBy=${encodeURIComponent(user.username)}`;
        const response = await apiClient.get(url);
        const pageData = response.data?.data;
        return {
          content: pageData?.content || (Array.isArray(pageData) ? pageData : []),
          totalPages: pageData?.totalPages ?? 1,
          totalElements: pageData?.totalElements ?? 0,
        };
      }
    }
  });

  // 4. Fetch Booking Detail if query param is set
  const { data: bookingDetail, isError: isBookingDetailError } = useQuery({
    queryKey: ['bookings', 'detail', bookingIdQuery],
    queryFn: async () => {
      if (!bookingIdQuery) return null;
      const response = await apiClient.get(`/booking/${bookingIdQuery}`);
      return response.data?.data;
    },
    enabled: !!bookingIdQuery,
    retry: false,
  });

  useEffect(() => {
    if (bookingDetail) {
      setSelectedBooking(bookingDetail);
      setActiveModal('detail');
    }
  }, [bookingDetail]);

  useEffect(() => {
    if (isBookingDetailError && bookingIdQuery) {
      showToast('Bạn không có quyền xem lịch họp này.', 'error');
      setSearchParams({});
    }
  }, [isBookingDetailError]);

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

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    formState: { errors: errorsEdit }
  } = useForm<EditBookingFormValues>({
    resolver: zodResolver(editBookingFormSchema) as any,
  });

  // CREATE BOOKING MUTATION
  const createBookingMutation = useMutation({
    mutationFn: async (data: BookingFormValues) => {
      const startDateTime = formatDateTimeForApi(data.start);
      const endDateTime = formatDateTimeForApi(data.end);
      // Split email receivers list
      const receivers = data.receiversInput
        ? data.receiversInput.split(',').map((e) => e.trim()).filter((e) => e.length > 0)
        : [];

      const payload = {
        roomId: data.roomId,
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

  // UPDATE BOOKING MUTATION
  const updateBookingMutation = useMutation({
    mutationFn: async (data: EditBookingFormValues) => {
      const hasRoomChanged = Number(data.roomId) !== Number(selectedBooking.roomId);
      const hasTimeChanged = !isSameTime(data.start, selectedBooking.startTime) || !isSameTime(data.end, selectedBooking.endTime);

      const payload: {
        title: string;
        description: string;
        attendeeCount: number;
        roomId?: number;
        start?: string;
        end?: string;
        newRoomId?: number;
      } = {
        title: data.title,
        description: data.description || '',
        attendeeCount: Number(data.attendee),
      };

      if (hasRoomChanged || hasTimeChanged) {
        payload.roomId = Number(data.roomId);
        payload.start = formatDateTimeForApi(data.start);
        payload.end = formatDateTimeForApi(data.end);
        if (hasRoomChanged) {
          payload.newRoomId = Number(data.roomId);
        }
      }

      await apiClient.patch(`/booking/${selectedBooking.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookings', 'pending'] });
      showToast('Cập nhật lịch họp thành công', 'success');
      setActiveModal(null);
      setSearchParams({});
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      const msg = error.response?.data?.message || 'Có lỗi xảy ra khi cập nhật lịch họp';
      showToast(msg, 'error');
    }
  });

  const onEditSubmit = (data: EditBookingFormValues) => {
    updateBookingMutation.mutate(data);
  };

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

  // COMPLETE BOOKING MUTATION
  const completeBookingMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.patch(`/booking/${id}`, { isCompleted: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      showToast('Đã xác nhận hoàn thành cuộc họp', 'success');
      setActiveModal(null);
      setSearchParams({});
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể xác nhận hoàn thành cuộc họp';
      showToast(msg, 'error');
    }
  });



  // ADD EQUIPMENT MUTATION
  const addEquipmentMutation = useMutation({
    mutationFn: async ({ bookingId, rows }: { bookingId: number; rows: { equipmentId: number; quantity: number; action: string }[] }) => {
      const payload = rows.map(r => ({
        equipmentId: parseInt(String(r.equipmentId), 10),
        quantity: r.action === 'DELETE' ? 1 : parseInt(String(r.quantity), 10),
        action: r.action
      }));
      await apiClient.post(`/booking/${bookingId}/equipment`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      showToast('Đã gửi yêu cầu bổ sung thiết bị thành công, chờ approver duyệt', 'success');
      setActiveModal(null);
      setAddEquipRows([]);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi gửi yêu cầu bổ sung thiết bị';
      showToast(msg, 'error');
    }
  });

  // UPDATE EQUIPMENT QUANTITY MUTATION
  const updateEquipmentQuantityMutation = useMutation({
    mutationFn: async ({ bookingId, equipmentId, beId, quantity }: { bookingId: number; equipmentId: number; beId: number; quantity: number }) => {
      await apiClient.patch(`/booking/${bookingId}/equipment/${equipmentId}/${beId}`, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookings', 'pending'] });
      showToast('Yêu cầu cập nhật số lượng thiết bị thành công, chờ phê duyệt', 'success');
      setActiveModal(null);
      setSearchParams({});
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật số lượng thiết bị';
      showToast(msg, 'error');
    }
  });

  // APPROVE BOOKING MUTATION
  const approveMutation = useMutation({
    mutationFn: async ({ id, actionType, historyId, newData }: { id: number; actionType: string; historyId: number; newData: any }) => {
      await apiClient.patch(`/booking/approve/${id}`, { actionType, historyId, newData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookings', 'pending'] });
      showToast('Đã phê duyệt lịch họp thành công', 'success');
      setActiveModal(null);
      setSearchParams({});
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi phê duyệt';
      showToast(msg, 'error');
    }
  });

  // REJECT BOOKING MUTATION
  const rejectMutation = useMutation({
    mutationFn: async ({ id, actionType, historyId, reason, oldPayload, newPayload }: { id: number; actionType: string; historyId: number; reason: string; oldPayload: any; newPayload: any }) => {
      await apiClient.patch(`/booking/reject/${id}`, { actionType, historyId, reason, oldPayload, newPayload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookings', 'pending'] });
      showToast('Đã từ chối lịch họp thành công', 'success');
      setActiveModal(null);
      setSearchParams({});
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi từ chối';
      showToast(msg, 'error');
    }
  });

  // EXPORT EXCEL MUTATION
  const handleExportExcel = async () => {
    try {
      const isPrivileged = isApprover || hasAuthority('ADMIN') || user?.roles?.some((r: any) => r.roleName === 'ADMIN' || r.roleName === 'APPROVER');
      const exportType = isPrivileged ? 'APPROVER' : 'REGISTER';
      const response = await apiClient.get(`/booking/export?exportType=${exportType}`, {
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
    setShowCancelConfirm(false);
    setCancelReason('');
  };

  const changeTargetDate = (direction: 1 | -1) => {
    const current = parseLocalYYYYMMDD(targetDate);
    if (calendarViewType === 'DAY') {
      current.setDate(current.getDate() + direction);
    } else if (calendarViewType === 'WEEK') {
      current.setDate(current.getDate() + direction * 7);
    } else {
      // MONTH: shift by 1 month
      current.setMonth(current.getMonth() + direction);
    }
    setTargetDate(formatLocalYYYYMMDD(current));
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'Đã duyệt';
      case 'PENDING': return 'Chờ duyệt';
      case 'REJECTED': return 'Từ chối';
      case 'CANCELLED': return 'Đã hủy';
      case 'CANCEL_PENDING': return 'Chờ hủy';
      case 'UNAVAILABLE': return 'Bận/Bảo trì';
      default: return status || 'Chờ duyệt';
    }
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
    return `${d.toLocaleDateString('vi-VN')} vào lúc ${formatTime(timeStr)}`;
  };

  const getRoomNameById = (id: number) => {
    const r = rooms?.find((item: any) => Number(item.id) === Number(id));
    return r ? r.roomName : `Phòng #${id}`;
  };

  const getEquipmentNameById = (id: number) => {
    const eq = equipments?.find((item: any) => Number(item.equipmentId) === Number(id));
    return eq ? eq.equipmentName : `Thiết bị #${id}`;
  };

  const renderOldField = (label: string, oldVal: any, newVal: any, formatFn?: (val: any) => string) => {
    const formattedOld = formatFn ? formatFn(oldVal) : String(oldVal ?? '');
    const formattedNew = formatFn ? formatFn(newVal) : String(newVal ?? '');
    const isChanged = formattedOld !== formattedNew;

    return (
      <div style={{
        padding: '0.75rem',
        borderRadius: 'var(--radius-md)',
        backgroundColor: isChanged ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.01)',
        border: isChanged ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(255,255,255,0.03)',
        color: isChanged ? 'var(--danger)' : 'var(--text-secondary)',
        textDecoration: isChanged ? 'line-through' : 'none',
        boxShadow: isChanged ? '0 4px 12px rgba(239, 68, 68, 0.05)' : 'none',
        transition: 'all 0.2s ease'
      }}>
        <span style={{ fontSize: '0.75rem', display: 'block', fontWeight: 600, color: 'var(--text-tertiary)', textDecoration: 'none', marginBottom: '4px' }}>
          {label} (Cũ)
        </span>
        <span style={{ fontSize: '0.95rem', fontWeight: isChanged ? 600 : 'normal' }}>
          {formattedOld || '(trống)'}
        </span>
      </div>
    );
  };

  const renderNewField = (label: string, oldVal: any, newVal: any, formatFn?: (val: any) => string) => {
    const formattedOld = formatFn ? formatFn(oldVal) : String(oldVal ?? '');
    const formattedNew = formatFn ? formatFn(newVal) : String(newVal ?? '');
    const isChanged = formattedOld !== formattedNew;

    return (
      <div style={{
        padding: '0.75rem',
        borderRadius: 'var(--radius-md)',
        backgroundColor: isChanged ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.01)',
        border: isChanged ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(255,255,255,0.03)',
        color: isChanged ? 'var(--success)' : 'var(--text-primary)',
        boxShadow: isChanged ? '0 4px 12px rgba(16, 185, 129, 0.05)' : 'none',
        transition: 'all 0.2s ease'
      }}>
        <span style={{ fontSize: '0.75rem', display: 'block', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
          {label} (Mới)
        </span>
        <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>
          {formattedNew || '(trống)'}
        </span>
      </div>
    );
  };

  const renderSingleField = (label: string, value: any, formatFn?: (val: any) => string) => {
    const formatted = formatFn ? formatFn(value) : String(value ?? '');
    return (
      <div style={{
        padding: '0.75rem',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'rgba(255, 255, 255, 0.01)',
        border: '1px solid rgba(255,255,255,0.03)'
      }}>
        <span style={{ fontSize: '0.75rem', display: 'block', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
          {label}
        </span>
        <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 600 }}>
          {formatted || '(trống)'}
        </span>
      </div>
    );
  };

  const renderOldEquipments = (history: any) => {
    const oldEquips = history.oldData?.equipments || [];
    const newEquips = history.newData?.equipments || [];
    const allEquipIds = Array.from(new Set([
      ...oldEquips.map((e: any) => e.equipmentId),
      ...newEquips.map((e: any) => e.equipmentId)
    ])).filter(Boolean);

    if (allEquipIds.length === 0) return null;

    return (
      <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h5 style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
          Thiết bị sử dụng:
        </h5>
        {allEquipIds.map((eqId: any) => {
          const oldEq = oldEquips.find((e: any) => e.equipmentId === eqId);
          const newEq = newEquips.find((e: any) => e.equipmentId === eqId);
          const eqName = oldEq?.equipmentName || newEq?.equipmentName || `Thiết bị #${eqId}`;
          const oldQty = oldEq?.usingQuantity || 0;
          const newQty = newEq?.usingQuantity || 0;
          const isChanged = oldQty !== newQty;

          return (
            <div key={eqId} style={{
              padding: '0.6rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: isChanged ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.01)',
              border: isChanged ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid transparent',
              color: isChanged ? 'var(--danger)' : 'var(--text-secondary)',
              textDecoration: isChanged ? 'line-through' : 'none',
              fontSize: '0.875rem'
            }}>
              {eqName}: {oldQty ? `x${oldQty}` : 'Không sử dụng'}
            </div>
          );
        })}
      </div>
    );
  };

  const renderNewEquipments = (history: any) => {
    const oldEquips = history.oldData?.equipments || [];
    const newEquips = history.newData?.equipments || [];
    const allEquipIds = Array.from(new Set([
      ...oldEquips.map((e: any) => e.equipmentId),
      ...newEquips.map((e: any) => e.equipmentId)
    ])).filter(Boolean);

    if (allEquipIds.length === 0) return null;

    return (
      <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h5 style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
          Thiết bị sử dụng:
        </h5>
        {allEquipIds.map((eqId: any) => {
          const oldEq = oldEquips.find((e: any) => e.equipmentId === eqId);
          const newEq = newEquips.find((e: any) => e.equipmentId === eqId);
          const eqName = newEq?.equipmentName || oldEq?.equipmentName || `Thiết bị #${eqId}`;
          const oldQty = oldEq?.usingQuantity || 0;
          const newQty = newEq?.usingQuantity || 0;
          const isChanged = oldQty !== newQty;

          return (
            <div key={eqId} style={{
              padding: '0.6rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: isChanged ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.01)',
              border: isChanged ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid transparent',
              color: isChanged ? 'var(--success)' : 'var(--text-primary)',
              fontWeight: isChanged ? 600 : 'normal',
              fontSize: '0.875rem'
            }}>
              {eqName}: {newQty ? `x${newQty}` : 'Không sử dụng'}
            </div>
          );
        })}
      </div>
    );
  };

  const renderApprovalsList = () => {
    const handleViewHistoryDetail = async (historyId: number) => {
      try {
        const response = await apiClient.get(`/booking/pending/detail/${historyId}`);
        const historyData = response.data?.data;
        setSelectedHistory(historyData);

        if (historyData?.bookingId) {
          const detailRes = await apiClient.get(`/booking/${historyData.bookingId}`);
          setSelectedBooking(detailRes.data?.data);
        }

        setNotes(''); // Clear notes input
        setActiveModal('approval-detail');
      } catch (err: any) {
        showToast('Không thể tải chi tiết lịch sử phê duyệt', 'error');
      }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: '0 0 1rem 0' }}>Yêu Cầu Chờ Phê Duyệt</h3>
          {isPendingApprovalsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="skeleton" style={{ height: '70px', width: '100%' }} />
              <div className="skeleton" style={{ height: '70px', width: '100%' }} />
            </div>
          ) : !pendingApprovals || pendingApprovals.length === 0 ? (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
              Không có yêu cầu đặt phòng nào đang chờ duyệt.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {pendingApprovals.map((item: any) => {
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
                    className="glass-card glass-card-hover"
                    style={{
                      padding: '1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderLeft: `4px solid ${actionBadgeColor}`,
                      gap: '1rem'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flexGrow: 1 }}>
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
                        <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 600 }}>{item.title}</h4>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        <span>📍 <strong>Phòng:</strong> {item.roomName}</span>
                        <span>👤 <strong>Người đăng ký:</strong> {item.userBooked} ({item.phone})</span>
                        <span>⏰ <strong>Thời gian họp:</strong> {formatTime(item.startTime)} - {formatTime(item.endTime)} ({new Date(item.startTime).toLocaleDateString('vi-VN')})</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                      onClick={() => handleViewHistoryDetail(item.historyId)}
                    >
                      Xem & Duyệt
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Shared booking card renderer used consistently across all 3 calendar views
  const getStatusColor = (status: string) => {
    if (status === 'APPROVED') return 'var(--success)';
    if (status === 'PENDING') return 'var(--warning)';
    if (status === 'REJECTED') return 'var(--danger)';
    if (status === 'CANCELLED') return 'var(--text-tertiary)';
    if (status === 'UNAVAILABLE') return 'var(--text-tertiary)';
    return 'var(--warning)';
  };

  const getStatusBg = (status: string) => {
    if (status === 'APPROVED') return 'rgba(16, 185, 129, 0.12)';
    if (status === 'PENDING') return 'rgba(245, 158, 11, 0.12)';
    if (status === 'REJECTED') return 'rgba(239, 68, 68, 0.12)';
    if (status === 'CANCELLED') return 'rgba(100, 116, 139, 0.12)';
    if (status === 'UNAVAILABLE') return 'rgba(100, 116, 139, 0.18)';
    return 'rgba(245, 158, 11, 0.12)';
  };

  const renderBookingCard = (b: any, compact = false) => (
    <div
      key={b.id}
      onClick={(e) => {
        e.stopPropagation();
        if (b.isUnavailability) {
          showToast(b.title, 'info');
          return;
        }
        handleBookingClick(b);
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? '2px' : '4px',
        padding: compact ? '5px 7px' : '7px 10px',
        borderRadius: '6px',
        backgroundColor: getStatusBg(b.status),
        borderLeft: `3px solid ${getStatusColor(b.status)}`,
        cursor: 'pointer',
        transition: 'opacity 0.15s ease',
        overflow: 'hidden',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'space-between' }}>
        <span style={{ fontSize: compact ? '0.65rem' : '0.7rem', fontWeight: 700, color: getStatusColor(b.status) }}>
          {formatTime(b.startTime)}{!compact && ` – ${formatTime(b.endTime)}`}
        </span>
        <span style={{
          fontSize: '0.6rem', fontWeight: 600, padding: '1px 5px', borderRadius: '3px',
          backgroundColor: getStatusColor(b.status), color: '#fff', whiteSpace: 'nowrap', flexShrink: 0
        }}>
          {getStatusLabel(b.status)}
        </span>
      </div>
      <div style={{ fontSize: compact ? '0.7rem' : '0.75rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {b.title}
      </div>
      {!compact && (
        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          📍 {b.roomName}
        </div>
      )}
    </div>
  );

  const renderCalendarLegend = () => (
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
  );

  const renderMonthCalendar = () => {
    const current = parseLocalYYYYMMDD(targetDate);
    const year = current.getFullYear();
    const month = current.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    // Monday-first: Sunday(0) → offset 6, else dayOfWeek - 1
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const calendarCells: { date: Date; dayNumber: number; isCurrentMonth: boolean; dateString: string }[] = [];

    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, dayNum);
      calendarCells.push({ date: prevDate, dayNumber: dayNum, isCurrentMonth: false, dateString: formatLocalYYYYMMDD(prevDate) });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const currDate = new Date(year, month, i);
      calendarCells.push({ date: currDate, dayNumber: i, isCurrentMonth: true, dateString: formatLocalYYYYMMDD(currDate) });
    }

    const remaining = 42 - calendarCells.length;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      calendarCells.push({ date: nextDate, dayNumber: i, isCurrentMonth: false, dateString: formatLocalYYYYMMDD(nextDate) });
    }

    const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    const todayStr = formatLocalYYYYMMDD(new Date());

    // Pre-build a date→bookings map for all bookings in this month view
    const bookingsByDate: Record<string, any[]> = {};
    (bookings || []).forEach((b: any) => {
      const ds = getLocalDateStr(b.startTime);
      if (!ds) return;
      if (!bookingsByDate[ds]) bookingsByDate[ds] = [];
      bookingsByDate[ds].push(b);
    });

    return (
      <>
        <div className="calendar-header-row">
          {weekdays.map((d) => (
            <div key={d} className="calendar-header-cell">{d}</div>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarCells.map((cell, idx) => {
            const dateBookings = bookingsByDate[cell.dateString] || [];
            const isToday = todayStr === cell.dateString;
            let cellClasses = "calendar-day-cell";
            if (!cell.isCurrentMonth) cellClasses += " inactive";
            if (isToday) cellClasses += " today";

            return (
              <div key={idx} className={cellClasses}>
                <div className="calendar-day-number">{cell.dayNumber}</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flexGrow: 1, overflow: 'hidden' }}>
                  {dateBookings.slice(0, 2).map((b: any) => renderBookingCard(b, true))}
                  {dateBookings.length > 2 && (
                    <div className="calendar-more-indicator">+ {dateBookings.length - 2} lịch họp</div>
                  )}
                </div>

                {dateBookings.length > 0 && (
                  <div className="calendar-day-popover" style={{
                    zIndex: 100, minWidth: '300px', maxWidth: '340px',
                    // Smart position: cells in last 3 columns show popover to the left
                    ...(idx % 7 >= 4 ? { right: '0', left: 'auto' } : { left: '100%', right: 'auto' }),
                    // Cells in last 2 rows show popover upward
                    ...(idx >= 28 ? { bottom: '0', top: 'auto' } : { top: '0', bottom: 'auto' }),
                  }}>
                    <div className="calendar-day-popover-header">
                      Ngày {cell.dayNumber}/{current.getMonth() + 1} — {dateBookings.length} lịch họp
                    </div>
                    <div className="calendar-day-popover-body" style={{
                      display: 'flex', flexDirection: 'column', gap: '6px',
                      maxHeight: '280px', overflowY: 'auto',
                      paddingRight: '2px',
                    }}>
                      {dateBookings.map((b: any) => (
                        <div
                          key={b.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (b.isUnavailability) {
                              showToast(b.title, 'info');
                              return;
                            }
                            handleBookingClick(b);
                          }}
                          style={{
                            display: 'flex', flexDirection: 'column', gap: '4px',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            backgroundColor: getStatusBg(b.status),
                            borderLeft: `3px solid ${getStatusColor(b.status)}`,
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: getStatusColor(b.status) }}>
                              {formatTime(b.startTime)} – {formatTime(b.endTime)}
                            </span>
                            <span style={{
                              fontSize: '0.62rem', fontWeight: 600, padding: '2px 7px', borderRadius: '4px',
                              backgroundColor: getStatusColor(b.status), color: '#fff', whiteSpace: 'nowrap', flexShrink: 0,
                            }}>
                              {getStatusLabel(b.status)}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{b.title}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>📍 {b.roomName}{b.floorNumber ? ` (Tầng ${b.floorNumber})` : ''}</div>
                          {b.attendee && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>👥 {b.attendee} người tham gia</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {renderCalendarLegend()}
      </>
    );
  };

  const renderWeekCalendar = () => {
    const current = parseLocalYYYYMMDD(targetDate);
    const dayOfWeek = current.getDay();
    const startOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const monday = new Date(current);
    monday.setDate(current.getDate() - startOffset);

    const weekDays: { date: Date; dateString: string; label: string; dayNum: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      weekDays.push({
        date: day,
        dateString: formatLocalYYYYMMDD(day),
        label: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][i],
        dayNum: day.getDate(),
      });
    }

    // Pre-build booking map for the week
    const bookingsByDate: Record<string, any[]> = {};
    (bookings || []).forEach((b: any) => {
      const ds = getLocalDateStr(b.startTime);
      if (!ds) return;
      if (!bookingsByDate[ds]) bookingsByDate[ds] = [];
      bookingsByDate[ds].push(b);
    });

    const todayStr = formatLocalYYYYMMDD(new Date());
    const sunday = weekDays[6].date;

    // Week range label: "23/06 – 29/06/2026"
    const fmtDay = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const weekRangeLabel = `${fmtDay(monday)} – ${fmtDay(sunday)}/${sunday.getFullYear()}`;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Week range sub-header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
          padding: '0.65rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.08)',
          backgroundColor: 'rgba(248,249,250,0.06)'
        }}>
          <button
            type="button"
            className="calendar-control-btn"
            onClick={() => changeTargetDate(-1)}
            style={{ padding: '4px 8px' }}
          >
            <ChevronLeft size={15} />
          </button>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.01em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CalendarIcon size={14} style={{ opacity: 0.6 }} /> {weekRangeLabel}
          </span>
          <button
            type="button"
            className="calendar-control-btn"
            onClick={() => changeTargetDate(1)}
            style={{ padding: '4px 8px' }}
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {/* 7-column week grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', padding: '0.75rem', overflowX: 'auto' }}>
          {weekDays.map((day, idx) => {
            const dateBookings = bookingsByDate[day.dateString] || [];
            const isToday = todayStr === day.dateString;

            return (
              <div
                key={idx}
                style={{
                  minWidth: '110px',
                  minHeight: '260px',
                  backgroundColor: isToday ? 'rgba(99, 102, 241, 0.06)' : 'rgba(255,255,255,0.03)',
                  border: isToday ? '1.5px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                {/* Day header */}
                <div style={{
                  textAlign: 'center',
                  padding: '0.6rem 0.5rem',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                  backgroundColor: isToday ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)',
                }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: isToday ? 'var(--accent)' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {day.label}
                  </div>
                  <div style={{
                    fontSize: '1.3rem', fontWeight: 700,
                    color: isToday ? 'var(--accent)' : 'var(--text-primary)',
                    marginTop: '2px',
                  }}>
                    {day.dayNum}
                  </div>
                </div>

                {/* Bookings list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '0.5rem', flexGrow: 1, overflowY: 'auto', maxHeight: '320px' }}>
                  {dateBookings.length === 0 ? (
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: '1rem', fontStyle: 'italic' }}>
                      Không có lịch
                    </div>
                  ) : (
                    dateBookings.map((b: any) => (
                      <div
                        key={b.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (b.isUnavailability) {
                            showToast(b.title, 'info');
                            return;
                          }
                          handleBookingClick(b);
                        }}
                        style={{
                          display: 'flex', flexDirection: 'column', gap: '3px',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          backgroundColor: getStatusBg(b.status),
                          borderLeft: `3px solid ${getStatusColor(b.status)}`,
                          cursor: 'pointer',
                          transition: 'opacity 0.15s ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: getStatusColor(b.status), whiteSpace: 'nowrap' }}>
                            {formatTime(b.startTime)}–{formatTime(b.endTime)}
                          </span>
                          <span style={{
                            fontSize: '0.58rem', fontWeight: 600, padding: '1px 5px', borderRadius: '3px',
                            backgroundColor: getStatusColor(b.status), color: '#fff', whiteSpace: 'nowrap', flexShrink: 0,
                          }}>
                            {getStatusLabel(b.status)}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.title}
                        </div>
                        <div style={{ fontSize: '0.63rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

        {renderCalendarLegend()}
      </div>
    );
  };

  const renderDayCalendar = () => {
    const dayBookings = (bookings || [])
      .filter((b: any) => b.startTime && getLocalDateStr(b.startTime) === targetDate)
      .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    // Time slots: 00:00 → 24:00 in 2-hour blocks
    const TIME_SLOTS: { label: string; startH: number; endH: number }[] = [];
    for (let h = 0; h < 24; h += 2) {
      TIME_SLOTS.push({
        label: `${String(h).padStart(2, '0')}:00 – ${String(h + 2).padStart(2, '0')}:00`,
        startH: h,
        endH: h + 2,
      });
    }

    const getBookingsForSlot = (startH: number, endH: number) => {
      return dayBookings.filter((b: any) => {
        const bStart = new Date(b.startTime).getHours() + new Date(b.startTime).getMinutes() / 60;
        const bEnd = new Date(b.endTime).getHours() + new Date(b.endTime).getMinutes() / 60;
        // Overlap: booking starts before slot ends AND booking ends after slot starts
        return bStart < endH && bEnd > startH;
      });
    };

    const displayDate = parseLocalYYYYMMDD(targetDate);
    const dateLabel = displayDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    const todayStr = formatLocalYYYYMMDD(new Date());
    const isToday = targetDate === todayStr;
    const nowH = new Date().getHours() + new Date().getMinutes() / 60;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Day header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
          padding: '0.65rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.07)',
          backgroundColor: 'rgba(248,249,250,0.04)'
        }}>
          <button type="button" className="calendar-control-btn" onClick={() => changeTargetDate(-1)} style={{ padding: '4px 8px' }}>
            <ChevronLeft size={15} />
          </button>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: isToday ? 'var(--accent)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CalendarIcon size={14} style={{ opacity: 0.6 }} />
            {dateLabel}
            {isToday && <span style={{ fontSize: '0.72rem', backgroundColor: 'var(--accent)', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>Hôm nay</span>}
          </span>
          <button type="button" className="calendar-control-btn" onClick={() => changeTargetDate(1)} style={{ padding: '4px 8px' }}>
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Hourly slots */}
        <div style={{ padding: '0.75rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {TIME_SLOTS.map((slot, idx) => {
            const slotBookings = getBookingsForSlot(slot.startH, slot.endH);
            const isCurrentSlot = isToday && nowH >= slot.startH && nowH < slot.endH;
            const hasBookings = slotBookings.length > 0;

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  padding: hasBookings ? '8px 10px' : '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isCurrentSlot
                    ? 'rgba(99, 102, 241, 0.08)'
                    : hasBookings
                      ? 'rgba(255,255,255,0.02)'
                      : 'transparent',
                  border: isCurrentSlot
                    ? '1px solid rgba(99,102,241,0.2)'
                    : hasBookings
                      ? '1px solid rgba(255,255,255,0.05)'
                      : '1px solid transparent',
                  minHeight: hasBookings ? '56px' : '36px',
                  transition: 'background-color 0.15s ease',
                }}
              >
                {/* Time label */}
                <div style={{
                  minWidth: '105px', flexShrink: 0,
                  fontSize: '0.72rem', fontWeight: isCurrentSlot ? 700 : 500,
                  color: isCurrentSlot ? 'var(--accent)' : 'var(--text-tertiary)',
                  paddingTop: '2px',
                  display: 'flex', alignItems: 'center', gap: '5px'
                }}>
                  {isCurrentSlot && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent)', display: 'inline-block', flexShrink: 0 }} />}
                  {slot.label}
                </div>

                {/* Divider */}
                <div style={{
                  width: '1px', alignSelf: 'stretch',
                  backgroundColor: isCurrentSlot ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)',
                  flexShrink: 0
                }} />

                {/* Bookings in this slot */}
                <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {slotBookings.length === 0 ? (
                    <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.08)', paddingTop: '2px' }}>
                      —
                    </div>
                  ) : (
                    slotBookings.map((b: any) => renderBookingCard(b, false))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {renderCalendarLegend()}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {isApprover && (
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '-0.5rem' }}>
          <button
            className={`btn ${activeSubTab === 'scheduler' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
            onClick={() => setActiveSubTab('scheduler')}
          >
            <CalendarIcon size={16} /> Lịch trình & Tra cứu
          </button>
          <button
            className={`btn ${activeSubTab === 'approvals' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '0.9rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setActiveSubTab('approvals')}
          >
            <UserCheck size={16} /> Phê duyệt yêu cầu
            {pendingApprovals && pendingApprovals.length > 0 && (
              <span style={{
                backgroundColor: 'var(--danger)',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '10px',
                lineHeight: 1
              }}>
                {pendingApprovals.length}
              </span>
            )}
          </button>
        </div>
      )}

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

      {activeSubTab === 'scheduler' ? (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {/* Navigation arrows + date display */}
                <button type="button" className="calendar-control-btn" onClick={() => changeTargetDate(-1)}>
                  <ChevronLeft size={16} />
                </button>

                {/* MONTH & WEEK: show MM/YYYY only | DAY: show full date input */}
                {calendarViewType === 'DAY' ? (
                  <input
                    type="date"
                    className="calendar-date-input"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                ) : (
                  /* Month/Week: clickable MM/YYYY label backed by a hidden month input */
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)',
                      padding: '0.38rem 0.7rem',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      cursor: 'pointer',
                      letterSpacing: '0.02em',
                      userSelect: 'none',
                    }}>
                      {String(parseLocalYYYYMMDD(targetDate).getMonth() + 1).padStart(2, '0')}/{parseLocalYYYYMMDD(targetDate).getFullYear()}
                    </span>
                    <input
                      type="month"
                      style={{
                        position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%',
                      }}
                      value={`${parseLocalYYYYMMDD(targetDate).getFullYear()}-${String(parseLocalYYYYMMDD(targetDate).getMonth() + 1).padStart(2, '0')}`}
                      onChange={(e) => {
                        if (e.target.value) {
                          const [y, m] = e.target.value.split('-');
                          const newDate = new Date(Number(y), Number(m) - 1, 1);
                          setTargetDate(formatLocalYYYYMMDD(newDate));
                        }
                      }}
                    />
                  </div>
                )}

                <button type="button" className="calendar-control-btn" onClick={() => changeTargetDate(1)}>
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

                {/* My Bookings Toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: filterMyBookings ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none', border: filterMyBookings ? '1px solid var(--accent)' : '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '0.3rem 0.65rem', transition: 'all 0.2s ease', backgroundColor: filterMyBookings ? 'rgba(99,102,241,0.1)' : 'transparent' }}>
                  <input
                    type="checkbox"
                    style={{ accentColor: 'var(--accent)', width: '14px', height: '14px' }}
                    checked={filterMyBookings}
                    onChange={(e) => {
                      setFilterMyBookings(e.target.checked);
                      if (e.target.checked) {
                        setFilterOrganizer('');
                      }
                    }}
                  />
                  Lịch của tôi
                </label>
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
                  onChange={(e) => {
                    setFilterOrganizer(e.target.value);
                    if (e.target.value) {
                      setFilterMyBookings(false);
                    }
                  }}
                />

                {/* My Bookings Toggle for list view */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: filterMyBookings ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none', border: filterMyBookings ? '1px solid var(--accent)' : '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '0.3rem 0.65rem', transition: 'all 0.2s ease', backgroundColor: filterMyBookings ? 'rgba(99,102,241,0.1)' : 'transparent' }}>
                  <input
                    type="checkbox"
                    style={{ accentColor: 'var(--accent)', width: '14px', height: '14px' }}
                    checked={filterMyBookings}
                    onChange={(e) => {
                      setFilterMyBookings(e.target.checked);
                      if (e.target.checked) {
                        setFilterOrganizer('');
                      }
                    }}
                  />
                  Lịch của tôi
                </label>
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
            calendarViewType === 'MONTH' ? renderMonthCalendar() :
              calendarViewType === 'WEEK' ? renderWeekCalendar() :
                renderDayCalendar()
          ) : (() => {
            const listItems: any[] = viewMode === 'list' ? (bookings as any)?.content ?? [] : [];
            const totalPages: number = viewMode === 'list' ? (bookings as any)?.totalPages ?? 1 : 1;
            const totalElements: number = viewMode === 'list' ? (bookings as any)?.totalElements ?? 0 : 0;
            return listItems.length === 0 ? (
              <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                Không tìm thấy cuộc họp nào trong hệ thống.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.25rem' }}>
                {listItems.map((item: any) => (
                  <div
                    key={item.id}
                    onClick={() => handleBookingClick(item)}
                    className="glass-card glass-card-hover"
                    style={{
                      padding: '1.25rem',
                      borderLeft: `4px solid ${item.status === 'APPROVED' ? 'var(--success)' :
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
                        {getStatusLabel(item.status)}
                      </span>
                      <ChevronRight size={18} style={{ color: 'var(--text-tertiary)' }} />
                    </div>
                  </div>
                ))}

                {/* Pagination */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-light)',
                  marginTop: '0.25rem',
                  flexWrap: 'wrap'
                }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                    disabled={listPage === 0}
                    onClick={() => setListPage(0)}
                  >
                    «
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                    disabled={listPage === 0}
                    onClick={() => setListPage(p => Math.max(0, p - 1))}
                  >
                    <ChevronLeft size={15} />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i)
                    .filter(i => Math.abs(i - listPage) <= 2)
                    .map(i => (
                      <button
                        key={i}
                        type="button"
                        className="btn"
                        style={{
                          padding: '0.35rem 0.7rem',
                          fontSize: '0.8rem',
                          minWidth: '36px',
                          backgroundColor: i === listPage ? 'var(--accent)' : 'transparent',
                          color: i === listPage ? '#fff' : 'var(--text-secondary)',
                          border: i === listPage ? 'none' : '1px solid var(--border-light)',
                          fontWeight: i === listPage ? 700 : 400
                        }}
                        onClick={() => setListPage(i)}
                      >
                        {i + 1}
                      </button>
                    ))
                  }

                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                    disabled={listPage >= totalPages - 1}
                    onClick={() => setListPage(p => Math.min(totalPages - 1, p + 1))}
                  >
                    <ChevronRight size={15} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                    disabled={listPage >= totalPages - 1}
                    onClick={() => setListPage(totalPages - 1)}
                  >
                    »
                  </button>

                  <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginLeft: '0.25rem' }}>
                    Trang {listPage + 1} / {totalPages}
                    {totalElements > 0 && ` · ${totalElements} lịch họp`}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        renderApprovalsList()
      )}

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
                          <option key={String(eq.equipmentId)} value={String(eq.equipmentId)}>{eq.equipmentName}</option>
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

      {activeModal === 'edit' && (
        <div className="modal-overlay">
          <form onSubmit={handleSubmitEdit(onEditSubmit)} className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Cập nhật lịch họp</h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px', minWidth: 'auto' }} onClick={() => setActiveModal(null)}>
                <XCircle size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-title">Tiêu đề cuộc họp *</label>
                <input
                  id="edit-title"
                  className="form-control"
                  placeholder="Họp tổng kết tuần / Kick-off dự án..."
                  {...registerEdit('title')}
                />
                {errorsEdit.title && <span className="form-error">{errorsEdit.title.message}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-desc">Mô tả nội dung cuộc họp</label>
                <textarea
                  id="edit-desc"
                  className="form-control"
                  style={{ minHeight: '50px', resize: 'vertical' }}
                  placeholder="Thảo luận kế hoạch phát triển quý tiếp theo..."
                  {...registerEdit('description')}
                />
              </div>

              <div className="grid-cols-2" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-room">Chọn Phòng họp *</label>
                  <select
                    id="edit-room"
                    className="form-control"
                    {...registerEdit('roomId')}
                  >
                    <option value="">-- Chọn phòng trống --</option>
                    {rooms?.map((r: any) => (
                      <option key={r.id} value={r.id}>{r.roomName} (Tầng {r.floorNumber} - {r.capacity} chỗ)</option>
                    ))}
                  </select>
                  {errorsEdit.roomId && <span className="form-error">{errorsEdit.roomId.message}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-attendees">Số người tham dự họp *</label>
                  <input
                    id="edit-attendees"
                    type="number"
                    className="form-control"
                    placeholder="8"
                    {...registerEdit('attendee')}
                  />
                  {errorsEdit.attendee && <span className="form-error">{errorsEdit.attendee.message}</span>}
                </div>
              </div>

              <div className="grid-cols-2" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-start">Thời gian bắt đầu *</label>
                  <input
                    id="edit-start"
                    type="datetime-local"
                    className="form-control"
                    {...registerEdit('start')}
                  />
                  {errorsEdit.start && <span className="form-error">{errorsEdit.start.message}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-end">Thời gian kết thúc *</label>
                  <input
                    id="edit-end"
                    type="datetime-local"
                    className="form-control"
                    {...registerEdit('end')}
                  />
                  {errorsEdit.end && <span className="form-error">{errorsEdit.end.message}</span>}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={updateBookingMutation.isPending}>
                {updateBookingMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                  <span className={`badge badge-${selectedBooking.status?.toLowerCase() || 'pending'}`}>
                    {getStatusLabel(selectedBooking.status)}
                  </span>
                  {selectedBooking.isCompleted && (
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 700,
                      padding: '2px 8px', borderRadius: '4px',
                      backgroundColor: 'rgba(16,185,129,0.12)', color: 'var(--success)',
                      display: 'flex', alignItems: 'center', gap: '4px'
                    }}>
                      <CheckCircle size={12} /> Đã hoàn thành
                    </span>
                  )}
                </div>
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
                    {selectedBooking.equipments.map((eq: any, index: number) => {
                      const isOwner = !isApprover;
                      const canEdit = (selectedBooking.status === 'PENDING' || selectedBooking.status === 'APPROVED') && isOwner;
                      return (
                        <EquipmentRow
                          key={eq.bookingEquipmentId || index}
                          eq={eq}
                          canEdit={canEdit}
                          isPending={updateEquipmentQuantityMutation.isPending}
                          onUpdate={(quantity) => {
                            updateEquipmentQuantityMutation.mutate({
                              bookingId: selectedBooking.id,
                              equipmentId: eq.equipmentId,
                              beId: eq.bookingEquipmentId,
                              quantity
                            });
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cancel reason input - only for booking owner, shown when they click "Hủy lịch đặt" */}
              {(selectedBooking.status === 'PENDING' || selectedBooking.status === 'APPROVED') && !isApprover && showCancelConfirm && (
                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                  <label className="form-label" htmlFor="cancel-reason">
                    Lý do hủy lịch <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <textarea
                    id="cancel-reason"
                    className="form-control"
                    placeholder="Vui lòng nhập lý do hủy lịch họp này..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    style={{ minHeight: '70px', width: '100%', resize: 'vertical' }}
                  />
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

              {showCancelConfirm ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem', fontWeight: 600, width: '100%' }}
                    onClick={() => { setShowCancelConfirm(false); setCancelReason(''); }}
                  >
                    Quay lại
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem', fontWeight: 600, width: '100%' }}
                    disabled={cancelBookingMutation.isPending}
                    onClick={() => {
                      if (!cancelReason.trim()) {
                        showToast('Vui lòng nhập lý do hủy lịch', 'error');
                        return;
                      }
                      cancelBookingMutation.mutate({ id: selectedBooking.id, reason: cancelReason.trim() });
                      setShowCancelConfirm(false);
                      setCancelReason('');
                    }}
                  >
                    {cancelBookingMutation.isPending ? 'Đang hủy...' : 'Xác nhận hủy'}
                  </button>
                </div>
              ) : (
                <>
                  {/* Row 1: secondary actions, equal-width columns so they line up with row 2 */}
                  {(() => {
                    const showComplete = selectedBooking.status === 'APPROVED' && !selectedBooking.isCompleted && !isApprover;
                    const showAddEquip = (selectedBooking.status === 'APPROVED' || selectedBooking.status === 'PENDING') && !isApprover;
                    if (!showComplete && !showAddEquip) return null;
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        {showComplete && (
                          <button
                            type="button"
                            className="btn"
                            style={{
                              padding: '0.55rem 1.1rem',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              width: '100%',
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              color: 'var(--success)',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              whiteSpace: 'nowrap'
                            }}
                            disabled={completeBookingMutation.isPending}
                            onClick={() => completeBookingMutation.mutate(selectedBooking.id)}
                          >
                            <CheckCircle size={15} />
                            {completeBookingMutation.isPending ? 'Đang xác nhận...' : 'Xác nhận hoàn thành'}
                          </button>
                        )}
                        {showAddEquip && (
                          <button
                            type="button"
                            className="btn"
                            style={{
                              padding: '0.55rem 1.1rem',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              width: '100%',
                              gridColumn: showComplete ? undefined : '1 / -1',
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              color: 'var(--warning)',
                              border: '1px solid rgba(245, 158, 11, 0.4)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              whiteSpace: 'nowrap'
                            }}
                            onClick={() => {
                              setAddEquipRows([{ equipmentId: parseInt(String(equipments?.[0]?.equipmentId || 1), 10), quantity: 1, action: 'ADD' }]);
                              setActiveModal('add-equipment');
                            }}
                          >
                            <Package size={15} />
                            Bổ sung thiết bị
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Row 2: Đóng, Chỉnh sửa, and Hủy lịch đặt */}
                  {(() => {
                    const isEditableStatus = selectedBooking.status === 'PENDING' || selectedBooking.status === 'APPROVED';
                    const isBookingOwner = selectedBooking.username === user?.username;
                    const isAdmin = hasAuthority('ADMIN');
                    const canEdit = (isBookingOwner || isAdmin) && isEditableStatus;
                    const canCancel = isBookingOwner && isEditableStatus && !isApprover;

                    let cols = '1fr';
                    if (canEdit && canCancel) {
                      cols = '1fr 1fr 1fr';
                    } else if (canEdit || canCancel) {
                      cols = '1fr 1fr';
                    }

                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{
                            padding: '0.55rem 1.1rem', fontSize: '0.85rem', fontWeight: 600, width: '100%'
                          }}
                          onClick={() => {
                            closeDetailModal();
                            setShowCancelConfirm(false);
                            setCancelReason('');
                          }}
                        >
                          Đóng
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{
                              padding: '0.55rem 1.1rem', fontSize: '0.85rem', fontWeight: 600, width: '100%'
                            }}
                            onClick={() => {
                              setActiveModal('edit');
                              resetEdit({
                                title: selectedBooking.title,
                                description: selectedBooking.description || '',
                                roomId: selectedBooking.roomId,
                                start: formatDateTimeLocal(selectedBooking.startTime),
                                end: formatDateTimeLocal(selectedBooking.endTime),
                                attendee: selectedBooking.attendee
                              });
                            }}
                          >
                            Chỉnh sửa
                          </button>
                        )}
                        {canCancel && (
                          <button
                            type="button"
                            className="btn btn-danger"
                            style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem', fontWeight: 600, width: '100%' }}
                            onClick={() => setShowCancelConfirm(true)}
                          >
                            Hủy lịch đặt
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADD EQUIPMENT MODAL */}
      {activeModal === 'add-equipment' && selectedBooking && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Package size={16} style={{ color: 'var(--warning)' }} />
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Yêu cầu bổ sung thiết bị</h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                    {selectedBooking.title}
                  </p>
                </div>
              </div>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px', minWidth: 'auto' }}
                onClick={() => { setActiveModal('detail'); setAddEquipRows([]); }}>
                <XCircle size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Current equipment list */}
              {selectedBooking.equipments && selectedBooking.equipments.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 0.6rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Thiết bị hiện tại của cuộc họp
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {selectedBooking.equipments.map((eq: any, idx: number) => (
                      <div key={idx} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.5rem 0.75rem',
                        backgroundColor: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-light)',
                        fontSize: '0.85rem'
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Package size={13} style={{ color: 'var(--text-tertiary)' }} />
                          {eq.equipmentName}
                        </span>
                        <span style={{
                          backgroundColor: 'rgba(99,102,241,0.12)',
                          color: 'var(--accent)',
                          fontWeight: 700, fontSize: '0.78rem',
                          padding: '2px 8px', borderRadius: '4px'
                        }}>x{eq.usingQuantity || eq.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New equipment rows to add */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Thiết bị yêu cầu bổ sung
                  </h4>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: '0.75rem', padding: '4px 10px', color: 'var(--accent)', border: '1px dashed var(--accent)', borderRadius: 'var(--radius-sm)' }}
                    onClick={() => setAddEquipRows(prev => [...prev, { equipmentId: parseInt(String(equipments?.[0]?.equipmentId || 1), 10), quantity: 1, action: 'ADD' }])}
                  >
                    <Plus size={13} /> Thêm dòng
                  </button>
                </div>

                {addEquipRows.length === 0 ? (
                  <div style={{
                    padding: '1.5rem', textAlign: 'center', color: 'var(--text-tertiary)',
                    fontSize: '0.85rem', fontStyle: 'italic',
                    border: '2px dashed var(--border-light)', borderRadius: 'var(--radius-md)'
                  }}>
                    Nhấn "Thêm dòng" để bắt đầu yêu cầu bổ sung thiết bị
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {addEquipRows.map((row, idx) => (
                      <div key={idx} style={{
                        display: 'flex', gap: '0.5rem', alignItems: 'center',
                        padding: '0.6rem 0.75rem',
                        backgroundColor: row.action === 'DELETE' ? 'rgba(239,68,68,0.05)' : 'rgba(16,185,129,0.05)',
                        borderRadius: 'var(--radius-sm)',
                        border: row.action === 'DELETE' ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(16,185,129,0.2)'
                      }}>
                        {/* Action select */}
                        <select
                          className="form-control"
                          style={{ width: '90px', flexShrink: 0, fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                          value={row.action}
                          onChange={e => {
                            const newAction = e.target.value as 'ADD' | 'DELETE';
                            let nextEquipmentId: number = parseInt(String(row.equipmentId), 10);
                            if (newAction === 'DELETE') {
                              const currentEquips = selectedBooking?.equipments || [];
                              if (currentEquips.length > 0) {
                                nextEquipmentId = parseInt(String(currentEquips[0].equipmentId), 10);
                              }
                            } else {
                              if (equipments && equipments.length > 0) {
                                nextEquipmentId = parseInt(String(equipments[0].equipmentId), 10);
                              }
                            }
                            setAddEquipRows(prev => prev.map((r, i) => i === idx ? { ...r, action: newAction, equipmentId: nextEquipmentId } : r));
                          }}
                        >
                          <option value="ADD">Thêm</option>
                          {selectedBooking?.equipments && selectedBooking.equipments.length > 0 && (
                            <option value="DELETE">Xóa</option>
                          )}
                        </select>

                        {/* Equipment select */}
                        <select
                          className="form-control"
                          style={{ flexGrow: 1, fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                          value={String(row.equipmentId)}
                          onChange={e => setAddEquipRows(prev => prev.map((r, i) => i === idx ? { ...r, equipmentId: parseInt(e.target.value, 10) } : r))}
                        >
                          {row.action === 'DELETE' ? (
                            (selectedBooking?.equipments || []).map((eq: any) => (
                              <option key={String(eq.equipmentId)} value={String(eq.equipmentId)}>{eq.equipmentName} (x{eq.usingQuantity || eq.quantity})</option>
                            ))
                          ) : (
                            equipments?.map((eq: any) => (
                              <option key={String(eq.equipmentId)} value={String(eq.equipmentId)}>{eq.equipmentName}</option>
                            ))
                          )}
                        </select>

                        {/* Quantity input */}
                        {row.action !== 'DELETE' && (
                          <input
                            type="number"
                            className="form-control"
                            style={{ width: '72px', flexShrink: 0, fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                            placeholder="SL"
                            min={1}
                            value={row.quantity}
                            onChange={e => setAddEquipRows(prev => prev.map((r, i) => i === idx ? { ...r, quantity: Math.max(1, Number(e.target.value)) } : r))}
                          />
                        )}

                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ color: 'var(--danger)', padding: '6px', minWidth: 'auto', flexShrink: 0 }}
                          onClick={() => setAddEquipRows(prev => prev.filter((_, i) => i !== idx))}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Info note */}
              <div style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem',
                color: 'var(--warning)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem'
              }}>
                <span style={{ flexShrink: 0, marginTop: '1px' }}>⚠️</span>
                <span>Yêu cầu bổ sung thiết bị cần được approver phê duyệt trước khi có hiệu lực. Vui lòng chờ xác nhận.</span>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary"
                onClick={() => { setActiveModal('detail'); setAddEquipRows([]); }}>
                Quay lại
              </button>
              <button
                type="button"
                className="btn"
                style={{ backgroundColor: 'var(--warning)', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}
                disabled={addEquipRows.length === 0 || addEquipmentMutation.isPending}
                onClick={() => {
                  if (addEquipRows.length === 0) {
                    showToast('Vui lòng thêm ít nhất một thiết bị', 'error');
                    return;
                  }
                  addEquipmentMutation.mutate({ bookingId: selectedBooking.id, rows: addEquipRows });
                }}
              >
                <Package size={15} />
                {addEquipmentMutation.isPending ? 'Đang gửi...' : 'Gửi yêu cầu bổ sung'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APPROVAL DETAIL & COMPARISON MODAL */}
      {activeModal === 'approval-detail' && selectedHistory && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                Chi tiết yêu cầu phê duyệt
              </h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px', minWidth: 'auto' }} onClick={() => setActiveModal(null)}>
                <XCircle size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Basic Request Info */}
              <div className="glass-card" style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1rem', color: '#3f3838ff', fontWeight: 600 }}>{selectedHistory.title}</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                      Người yêu cầu: <strong>{selectedHistory.userBooked}</strong> ({selectedHistory.email} | {selectedHistory.phone})
                    </p>
                  </div>
                  <span className={`badge badge-pending`} style={{ fontSize: '0.7rem', padding: '4px 8px' }}>
                    {selectedHistory.actionType === 'CREATED' ? 'Đăng ký mới' : selectedHistory.actionType === 'UPDATED' ? 'Thay đổi thông tin' : 'Cập nhật thiết bị'}
                  </span>
                </div>
              </div>

              {/* Old vs New Side-by-Side Comparison Grid */}
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                  {selectedHistory.actionType === 'ADD_EQUIPMENT' || selectedHistory.actionType === 'UPDATE_EQUIP_QUANTITY'
                    ? 'Thiết bị yêu cầu bổ sung'
                    : 'So sánh thay đổi chi tiết'
                  }
                </h4>

                {selectedHistory.actionType === 'CREATED' ? (
                  <>
                    {/* Single Card for New Registration */}
                    <div className="glass-card" style={{
                      padding: '1.25rem',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem'
                    }}>
                      <h5 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent)', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
                        Thông tin phòng họp đăng ký mới
                      </h5>
                      {renderSingleField('Tiêu đề cuộc họp', selectedHistory.newData?.title || selectedHistory.title)}
                      {renderSingleField('Mô tả cuộc họp', selectedHistory.newData?.description || selectedHistory.description || '(trống)')}
                      {renderSingleField('Phòng họp', getRoomNameById(selectedHistory.newData?.roomId) || selectedHistory.roomName)}
                      {renderSingleField('Thời gian bắt đầu', selectedHistory.newData?.startTime || selectedHistory.startTime, formatFullDate)}
                      {renderSingleField('Thời gian kết thúc', selectedHistory.newData?.endTime || selectedHistory.endTime, formatFullDate)}
                      {renderSingleField('Số người tham gia', selectedHistory.newData?.attendeeCount || selectedHistory.attendee, (val) => val ? `${val} người` : '')}
                    </div>

                    {/* Equipment list request details for CREATED booking if present */}
                    {selectedHistory.newData?.equipments && selectedHistory.newData.equipments.length > 0 && (
                      <div style={{ marginTop: '1.25rem' }}>
                        <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Thiết bị yêu cầu kèm theo
                        </h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {selectedHistory.newData.equipments.map((eq: any, idx: number) => (
                            <div key={idx} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '0.5rem 0.75rem',
                              backgroundColor: 'var(--bg-tertiary)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-light)',
                              fontSize: '0.85rem'
                            }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)' }}>
                                <Package size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                                {getEquipmentNameById(eq.equipmentId)}
                              </span>
                              <span style={{
                                backgroundColor: 'rgba(99,102,241,0.12)',
                                color: 'var(--accent)',
                                fontWeight: 700, fontSize: '0.78rem',
                                padding: '2px 8px', borderRadius: '4px'
                              }}>x{eq.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>

                ) : selectedHistory.actionType === 'ADD_EQUIPMENT' ? (
                  /* ADD_EQUIPMENT: specialized layout showing only equipment requests */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    {/* Context info — booking this applies to */}
                    <div className="glass-card" style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(245, 158, 11, 0.04)',
                      border: '1px solid rgba(245, 158, 11, 0.2)',
                      display: 'flex', flexDirection: 'column', gap: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        <Package size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                        <span>Yêu cầu bổ sung thiết bị cho cuộc họp:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{selectedHistory.title}</strong>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-tertiary)', paddingLeft: '1.4rem' }}>
                        <span>📍 {selectedHistory.roomName}</span>
                        <span>⏰ {formatTime(selectedHistory.startTime?.toString())} – {formatTime(selectedHistory.endTime?.toString())} ({new Date(selectedHistory.startTime?.toString()).toLocaleDateString('vi-VN')})</span>
                        <span>👤 {selectedHistory.userBooked}</span>
                      </div>
                    </div>

                    {/* Equipment changes — two columns side by side: Left is Old, Right is New */}
                    {(() => {
                      const newEquips: any[] = selectedHistory.newData?.equipments || [];
                      const oldEquips: any[] = selectedHistory.oldData?.equipments || [];

                      if (newEquips.length === 0 && oldEquips.length === 0) {
                        return (
                          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-tertiary)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                            Không có dữ liệu thiết bị
                          </div>
                        );
                      }

                      const allEquipIds = Array.from(new Set([
                        ...newEquips.map((e: any) => e.equipmentId),
                        ...oldEquips.map((e: any) => e.equipmentId)
                      ])).filter(Boolean);

                      const rows = allEquipIds.map((eqId: any) => {
                        const newEq = newEquips.find((e: any) => e.equipmentId === eqId);
                        const oldEq = oldEquips.find((e: any) => e.equipmentId === eqId);
                        const eqName = newEq?.equipmentName || oldEq?.equipmentName || `Thiết bị #${eqId}`;
                        const oldQty = oldEq?.usingQuantity ?? null;
                        const newQty = newEq?.usingQuantity ?? null;
                        const isNew = oldQty === null && newQty !== null;
                        const isRemoved = newQty === null && oldQty !== null;
                        const isChanged = !isNew && !isRemoved && oldQty !== newQty;
                        return { eqId, eqName, oldQty, newQty, isNew, isRemoved, isChanged };
                      });

                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

                          {/* Left Card: Old equipment list */}
                          <div className="glass-card" style={{
                            padding: '1.25rem',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.08), 0 2px 6px rgba(0, 0, 0, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            backgroundColor: 'rgba(239, 68, 68, 0.02)',
                            display: 'flex', flexDirection: 'column', gap: '0.6rem'
                          }}>
                            <h5 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--danger)', borderBottom: '1px solid rgba(239, 68, 68, 0.15)', paddingBottom: '0.5rem' }}>
                              Thiết bị Cũ (Hiện tại)
                            </h5>
                            {rows.filter(r => !r.isNew).length === 0 && (
                              <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '0.4rem 0.75rem' }}>
                                Chưa có thiết bị nào
                              </span>
                            )}
                            {rows.filter(({ isNew }) => !isNew).map(({ eqId, eqName, oldQty, isRemoved, isChanged }) => (
                              <div key={eqId} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '0.6rem 0.75rem',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: (isChanged || isRemoved) ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255,255,255,0.01)',
                                border: (isChanged || isRemoved) ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid transparent',
                              }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                                  <Package size={14} style={{ flexShrink: 0 }} />
                                  {eqName}
                                </span>
                                <span style={{
                                  fontSize: '0.85rem', fontWeight: 600,
                                  color: (isChanged || isRemoved) ? 'var(--danger)' : 'var(--text-secondary)',
                                  textDecoration: (isChanged || isRemoved) ? 'line-through' : 'none'
                                }}>
                                  {`x${oldQty}`}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Right Card: New equipment list (requested) */}
                          <div className="glass-card" style={{
                            padding: '1.25rem',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: '0 12px 32px rgba(16, 185, 129, 0.12), 0 2px 10px rgba(0, 0, 0, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            backgroundColor: 'rgba(16, 185, 129, 0.02)',
                            display: 'flex', flexDirection: 'column', gap: '0.6rem'
                          }}>
                            <h5 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--success)', borderBottom: '1px solid rgba(16, 185, 129, 0.15)', paddingBottom: '0.5rem' }}>
                              Thiết bị Mới (Yêu cầu duyệt)
                            </h5>
                            {rows.map(({ eqId, eqName, newQty, isNew, isRemoved, isChanged }) => (
                              <div key={eqId} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '0.6rem 0.75rem',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: (isChanged || isNew) ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.01)',
                                border: (isChanged || isNew) ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid transparent',
                              }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', color: isRemoved ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                                  <Package size={14} style={{ flexShrink: 0, opacity: isRemoved ? 0.5 : 1 }} />
                                  {eqName}
                                </span>
                                <span style={{
                                  fontSize: '0.85rem', fontWeight: 700,
                                  color: isRemoved ? 'var(--text-tertiary)' : ((isChanged || isNew) ? 'var(--success)' : 'var(--text-primary)')
                                }}>
                                  {isRemoved ? 'Đã xóa' : `x${newQty}`}
                                </span>
                              </div>
                            ))}
                          </div>

                        </div>
                      );
                    })()}
                  </div>

                ) : selectedHistory.actionType === 'UPDATE_EQUIP_QUANTITY' ? (
                  /* UPDATE_EQUIP_QUANTITY: specialized layout for updating quantity of a single equipment */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    {/* Context info — booking this applies to */}
                    <div className="glass-card" style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(99, 102, 241, 0.04)',
                      border: '1px solid rgba(99, 102, 241, 0.2)',
                      display: 'flex', flexDirection: 'column', gap: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        <Package size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        <span>Yêu cầu cập nhật số lượng thiết bị cho cuộc họp:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{selectedHistory.title}</strong>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-tertiary)', paddingLeft: '1.4rem' }}>
                        <span>📍 {selectedHistory.roomName}</span>
                        <span>⏰ {formatTime(selectedHistory.startTime?.toString())} – {formatTime(selectedHistory.endTime?.toString())} ({new Date(selectedHistory.startTime?.toString()).toLocaleDateString('vi-VN')})</span>
                        <span>👤 {selectedHistory.userBooked}</span>
                      </div>
                    </div>

                    {/* Change comparison — large, clear old vs new visual */}
                    {(() => {
                      const beId = selectedHistory.newData?.bookingEquipmentId || selectedHistory.newData?.beId;
                      const oldQty = Number(selectedHistory.oldData?.quantity) || 0;
                      const newQty = Number(selectedHistory.newData?.quantity) || 0;
                      const matchingEquip = (selectedBooking?.equipments || []).find(
                        (e: any) => Number(e.bookingEquipmentId) === Number(beId)
                      );
                      const eqName = matchingEquip?.equipmentName || `Thiết bị #${beId}`;
                      const diff = newQty - oldQty;
                      const isIncrease = diff > 0;
                      const isDecrease = diff < 0;
                      const deltaColor = isIncrease ? 'var(--success)' : isDecrease ? 'var(--danger)' : 'var(--text-tertiary)';
                      const deltaBg = isIncrease ? 'rgba(16,185,129,0.12)' : isDecrease ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.06)';

                      return (
                        <div className="glass-card" style={{
                          padding: '1.25rem',
                          borderRadius: 'var(--radius-lg)',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          backgroundColor: 'rgba(245, 158, 11, 0.02)',
                          display: 'flex', flexDirection: 'column', gap: '1rem'
                        }}>
                          {/* Equipment name header */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <Package size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                              <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{eqName}</span>
                            </div>
                            <span style={{
                              fontSize: '0.78rem', fontWeight: 700,
                              padding: '3px 10px', borderRadius: '6px',
                              backgroundColor: deltaBg, color: deltaColor
                            }}>
                              {isIncrease ? `+${diff} (Tăng)` : isDecrease ? `${diff} (Giảm)` : 'Không đổi'}
                            </span>
                          </div>

                          {/* Old vs New big numbers */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '1rem' }}>
                            {/* Old quantity box */}
                            <div style={{
                              textAlign: 'center',
                              padding: '1rem',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: 'rgba(239, 68, 68, 0.06)',
                              border: '1px solid rgba(239, 68, 68, 0.2)'
                            }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.4rem' }}>
                                Số lượng cũ
                              </div>
                              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', textDecoration: 'line-through', textDecorationColor: 'var(--danger)', opacity: 0.7 }}>
                                {oldQty}
                              </div>
                            </div>

                            {/* Arrow */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                              <ArrowRight size={28} />
                            </div>

                            {/* New quantity box */}
                            <div style={{
                              textAlign: 'center',
                              padding: '1rem',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: 'rgba(16, 185, 129, 0.06)',
                              border: '1px solid rgba(16, 185, 129, 0.25)'
                            }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.4rem' }}>
                                Số lượng mới (Yêu cầu)
                              </div>
                              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--success)' }}>
                                {newQty}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                ) : (
                  /* UPDATED: Two columns side by side: Left is Old, Right is New */
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

                    {/* Left Card: Old Info (Reddish border, soft shadow) */}
                    <div className="glass-card" style={{
                      padding: '1.25rem',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: '0 8px 24px rgba(239, 68, 68, 0.08), 0 2px 6px rgba(0, 0, 0, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      backgroundColor: 'rgba(239, 68, 68, 0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem'
                    }}>
                      <h5 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--danger)', borderBottom: '1px solid rgba(239, 68, 68, 0.15)', paddingBottom: '0.5rem' }}>
                        Thông tin Cũ (Bị thay đổi)
                      </h5>
                      {renderOldField('Tiêu đề', selectedHistory.oldData?.title, selectedHistory.newData?.title)}
                      {renderOldField('Mô tả', selectedHistory.oldData?.description, selectedHistory.newData?.description)}
                      {renderOldField('Phòng họp', selectedHistory.oldData?.roomId, selectedHistory.newData?.roomId, getRoomNameById)}
                      {renderOldField('Thời gian bắt đầu', selectedHistory.oldData?.startTime, selectedHistory.newData?.startTime, formatFullDate)}
                      {renderOldField('Thời gian kết thúc', selectedHistory.oldData?.endTime, selectedHistory.newData?.endTime, formatFullDate)}
                      {renderOldField('Số người tham gia', selectedHistory.oldData?.attendeeCount, selectedHistory.newData?.attendeeCount, (val) => val ? `${val} người` : '')}

                      {/* Old Equipments */}
                      {renderOldEquipments(selectedHistory)}
                    </div>

                    {/* Right Card: New Info (Greenish border, strong shadow) */}
                    <div className="glass-card" style={{
                      padding: '1.25rem',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: '0 12px 32px rgba(16, 185, 129, 0.12), 0 2px 10px rgba(0, 0, 0, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      backgroundColor: 'rgba(16, 185, 129, 0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem'
                    }}>
                      <h5 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--success)', borderBottom: '1px solid rgba(16, 185, 129, 0.15)', paddingBottom: '0.5rem' }}>
                        Thông tin Mới (Yêu cầu duyệt)
                      </h5>
                      {renderNewField('Tiêu đề', selectedHistory.oldData?.title, selectedHistory.newData?.title)}
                      {renderNewField('Mô tả', selectedHistory.oldData?.description, selectedHistory.newData?.description)}
                      {renderNewField('Phòng họp', selectedHistory.oldData?.roomId, selectedHistory.newData?.roomId, getRoomNameById)}
                      {renderNewField('Thời gian bắt đầu', selectedHistory.oldData?.startTime, selectedHistory.newData?.startTime, formatFullDate)}
                      {renderNewField('Thời gian kết thúc', selectedHistory.oldData?.endTime, selectedHistory.newData?.endTime, formatFullDate)}
                      {renderNewField('Số người tham gia', selectedHistory.oldData?.attendeeCount, selectedHistory.newData?.attendeeCount, (val) => val ? `${val} người` : '')}

                      {/* New Equipments */}
                      {renderNewEquipments(selectedHistory)}
                    </div>

                  </div>
                )}
              </div>

              {/* Review notes */}
              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                <label className="form-label" htmlFor="review-notes">Ý kiến đóng góp / Lý do từ chối (bắt buộc khi từ chối)</label>
                <textarea
                  id="review-notes"
                  className="form-control"
                  style={{ minHeight: '60px', resize: 'vertical' }}
                  placeholder="Ghi chú phản hồi duyệt hoặc lý do từ chối yêu cầu họp..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

            </div>

            <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Đóng</button>

              <button
                type="button"
                className="btn btn-danger"
                disabled={rejectMutation.isPending || approveMutation.isPending}
                onClick={() => {
                  if (!notes.trim()) {
                    showToast('Vui lòng nhập lý do từ chối vào ô ý kiến đóng góp', 'error');
                    return;
                  }
                  rejectMutation.mutate({
                    id: selectedHistory.bookingId,
                    actionType: selectedHistory.actionType,
                    historyId: selectedHistory.historyId,
                    reason: notes,
                    oldPayload: selectedHistory.oldData,
                    newPayload: selectedHistory.newData
                  });
                }}
              >
                Từ chối
              </button>

              <button
                type="button"
                className="btn"
                style={{ backgroundColor: 'var(--success)', color: '#fff' }}
                disabled={rejectMutation.isPending || approveMutation.isPending}
                onClick={() => {
                  approveMutation.mutate({
                    id: selectedHistory.bookingId,
                    actionType: selectedHistory.actionType,
                    historyId: selectedHistory.historyId,
                    newData: selectedHistory.newData
                  });
                }}
              >
                Phê duyệt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};