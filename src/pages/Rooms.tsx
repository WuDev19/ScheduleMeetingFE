import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiClient } from '../api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Search,
  DoorOpen,
  Users,
  Layers,
  Plus,
  Edit3,
  Trash2,
  XCircle,
  ListPlus,
  Mail,
  Calendar
} from 'lucide-react';

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

// Form validation schemas
const roomSchema = z.object({
  roomName: z.string().min(1, 'Vui lòng nhập tên phòng'),
  capacity: z.coerce.number().min(1, 'Sức chứa phải lớn hơn hoặc bằng 1'),
  floorNumber: z.coerce.number().min(1, 'Số tầng không hợp lệ'),
  description: z.string().optional(),
  buildingId: z.coerce.number().min(1, 'Vui lòng chọn tòa nhà'),
  equipments: z.array(z.object({
    equipmentId: z.coerce.number().min(1, 'Vui lòng chọn thiết bị'),
    quantity: z.coerce.number().min(1, 'Số lượng tối thiểu là 1')
  })).optional()
});



const bookingFormSchema = z.object({
  title: z.string().min(1, 'Vui lòng nhập tiêu đề cuộc họp'),
  description: z.string().optional(),
  roomId: z.coerce.number().min(1, 'Vui lòng chọn phòng họp'),
  start: z.string().min(1, 'Vui lòng chọn thời gian bắt đầu'),
  end: z.string().min(1, 'Vui lòng chọn thời gian kết thúc'),
  attendee: z.coerce.number().min(1, 'Số lượng tham gia tối thiểu là 1'),
  receiversInput: z.string().optional(),
  equipments: z.array(z.object({
    equipmentId: z.coerce.number().min(1, 'Chọn thiết bị'),
    quantity: z.coerce.number().min(1, 'Số lượng tối thiểu là 1')
  })).optional()
}).refine((data) => new Date(data.start) < new Date(data.end), {
  message: "Thời gian kết thúc phải diễn ra sau thời gian bắt đầu",
  path: ["end"]
});

const equipmentSchema = z.object({
  equipmentName: z.string().min(1, 'Tên thiết bị không được để trống'),
  description: z.string().optional().or(z.literal('')),
  availableQuantity: z.coerce.number().min(0, 'Số lượng tối thiểu là 0')
});

const unavailabilitySchema = z.object({
  roomId: z.coerce.number().min(1, 'Vui lòng chọn phòng họp'),
  reason: z.string().min(1, 'Vui lòng nhập lý do không khả dụng'),
  start: z.string().min(1, 'Vui lòng chọn thời gian bắt đầu'),
  end: z.string().min(1, 'Vui lòng chọn thời gian kết thúc'),
}).refine((data) => new Date(data.start) < new Date(data.end), {
  message: "Thời gian kết thúc phải diễn ra sau thời gian bắt đầu",
  path: ["end"]
});

type RoomFormValues = z.infer<typeof roomSchema>;
type BookingFormValues = z.infer<typeof bookingFormSchema>;
type EquipmentFormValues = z.infer<typeof equipmentSchema>;
type UnavailabilityFormValues = z.infer<typeof unavailabilitySchema>;

export const Rooms: React.FC = () => {
  const { hasAuthority, user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'rooms' | 'equipments' | 'unavailabilities'>('rooms');
  const [keyword, setKeyword] = useState('');
  const [filterFloor, setFilterFloor] = useState<string>('');
  const [filterCapacity, setFilterCapacity] = useState<string>('');
  const [filterStart, setFilterStart] = useState<string>('');
  const [filterEnd, setFilterEnd] = useState<string>('');
  const [activeModal, setActiveModal] = useState<'create' | 'edit' | 'assign' | 'book' | 'create-equip' | 'edit-equip' | 'create-unavail' | 'edit-unavail' | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);

  // Equipment tab states
  const [equipKeyword, setEquipKeyword] = useState('');
  const [equipPage, setEquipPage] = useState(0);
  const [equipPageSize] = useState(6);
  const [selectedEquip, setSelectedEquip] = useState<any>(null);

  // Unavailability tab states
  const [unavailKeyword, setUnavailKeyword] = useState('');
  const [unavailPage, setUnavailPage] = useState(0);
  const [unavailPageSize] = useState(6);
  const [unavailStart, setUnavailStart] = useState('');
  const [unavailEnd, setUnavailEnd] = useState('');
  const [selectedUnavail, setSelectedUnavail] = useState<any>(null);
  const [unavailDeletedFilter, setUnavailDeletedFilter] = useState<boolean>(false);
  const [hasCheckedOverlap, setHasCheckedOverlap] = useState(false);
  const canManageUnavailability = hasAuthority('ROOM_UNAVAILABLE:MANAGE');

  const handleFloorChange = (val: string) => {
    setFilterFloor(val);
    if (val !== '') {
      setFilterStart('');
      setFilterEnd('');
    }
  };

  const preventNegativeNumber = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (["-", "+", "e", "E"].includes(e.key)) {
      e.preventDefault();
    }
  };

  const normalizeNegativeNumber = (
    e: React.FormEvent<HTMLInputElement>
  ) => {
    const input = e.currentTarget;

    if (input.value === "") return;

    const value = Number(input.value);

    if (value < 0) {
      input.value = "0";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  const handleCapacityChange = (val: string) => {
    setFilterCapacity(val);
    if (val !== '') {
      setFilterStart('');
      setFilterEnd('');
    }
  };

  // Rooms tab pagination states
  const [roomPage, setRoomPage] = useState(0);
  const [roomPageSize] = useState(24);

  // 1. Fetch Rooms list (paginated)
  const { data: roomsPageData, isLoading: isRoomsLoading } = useQuery({
    queryKey: ['rooms', 'list', keyword, filterFloor, filterCapacity, filterStart, filterEnd, roomPage, roomPageSize],
    queryFn: async () => {
      if (filterStart && filterEnd) {
        const startTime = formatDateTimeForApi(filterStart);
        const endTime = formatDateTimeForApi(filterEnd);
        const response = await apiClient.request({
          url: '/room/not-overlap',
          method: 'GET',
          params: { start: startTime, end: endTime, page: roomPage, size: roomPageSize }
        });
        return response.data?.data;
      }

      let url = `/room/all?page=${roomPage}&size=${roomPageSize}`;
      if (keyword) {
        url = `/room/search?keyword=${encodeURIComponent(keyword)}&page=${roomPage}&size=${roomPageSize}`;
      } else if (filterFloor || filterCapacity) {
        url = `/room/filter?page=${roomPage}&size=${roomPageSize}`;
        if (filterFloor) url += `&floorNumber=${filterFloor}`;
        if (filterCapacity) url += `&capacity=${filterCapacity}`;
      }
      const response = await apiClient.get(url);
      return response.data?.data;
    }
  });

  const roomsList = roomsPageData?.content || [];
  const roomsTotalPages = roomsPageData?.totalPages || 0;

  // Fetch all rooms for select dropdowns
  const { data: allRoomsData } = useQuery({
    queryKey: ['rooms', 'all-for-select'],
    queryFn: async () => {
      const response = await apiClient.get('/room/all?page=0&size=1000');
      return response.data?.data?.content || [];
    }
  });

  // 2. Fetch Buildings for select menus
  const { data: buildings } = useQuery({
    queryKey: ['buildings', 'list'],
    queryFn: async () => {
      const response = await apiClient.get('/building/all?page=0&size=24');
      return response.data?.data?.content || [];
    }
  });

  // 3. Fetch Equipments for assignment
  const { data: equipmentsList } = useQuery({
    queryKey: ['equipments', 'list'],
    queryFn: async () => {
      const response = await apiClient.get('/equipment/all?page=0&size=24');
      return response.data?.data?.content || [];
    }
  });

  // Fetch paginated equipment list for Equipments tab
  const { data: equipData, isLoading: isEquipLoading } = useQuery({
    queryKey: ['equipments', 'search', equipKeyword, equipPage],
    queryFn: async () => {
      const response = await apiClient.get(`/equipment/search?keyword=${encodeURIComponent(equipKeyword)}&page=${equipPage}&size=${equipPageSize}`);
      return response.data?.data;
    }
  });

  const equipList = equipData?.content || [];
  const equipTotalPages = equipData?.totalPages || 0;

  // Fetch paginated room unavailability list
  const { data: unavailData, isLoading: isUnavailLoading } = useQuery({
    queryKey: ['unavailabilities', 'search', unavailKeyword, unavailStart, unavailEnd, unavailPage, unavailDeletedFilter],
    queryFn: async () => {
      const isDeletedParam = `&isDeleted=${unavailDeletedFilter}`;
      if (unavailStart && unavailEnd) {
        const startOffset = formatDateTimeForApi(unavailStart);
        const endOffset = formatDateTimeForApi(unavailEnd);
        const response = await apiClient.get(`/unavailability-room/filter?start=${encodeURIComponent(startOffset)}&end=${encodeURIComponent(endOffset)}&page=${unavailPage}&size=${unavailPageSize}${isDeletedParam}`);
        return response.data?.data;
      }

      if (unavailKeyword) {
        const response = await apiClient.get(`/unavailability-room/search?keyword=${encodeURIComponent(unavailKeyword)}&page=${unavailPage}&size=${unavailPageSize}${isDeletedParam}`);
        return response.data?.data;
      }

      const response = await apiClient.get(`/unavailability-room/all?page=${unavailPage}&size=${unavailPageSize}${isDeletedParam}`);
      return response.data?.data;
    },
    enabled: activeTab === 'unavailabilities' && (hasAuthority('ROOM_UNAVAILABLE:VIEW') || hasAuthority('ROOM:CREATE'))
  });

  const unavailList = unavailData?.content || [];
  const unavailTotalPages = unavailData?.totalPages || 0;

  // React Hook Form for Room creation/updates
  const {
    register: roomRegister,
    handleSubmit: handleRoomSubmit,
    reset: resetRoomForm,
    control,
    watch,
    formState: { errors: roomErrors }
  } = useForm<RoomFormValues>({
    resolver: zodResolver(roomSchema) as any,
    defaultValues: { equipments: [] }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'equipments'
  });



  // React Hook Form for direct booking
  const {
    register: bookingRegister,
    handleSubmit: handleBookingSubmit,
    reset: resetBookingForm,
    control: bookingControl,
    watch: bookingWatch,
    formState: { errors: bookingErrors }
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema) as any,
    defaultValues: { equipments: [] }
  });

  const {
    fields: bookingFields,
    append: bookingAppend,
    remove: bookingRemove
  } = useFieldArray({
    control: bookingControl,
    name: 'equipments'
  });

  // React Hook Form for Room Unavailability
  const {
    register: unavailRegister,
    handleSubmit: handleUnavailSubmit,
    reset: resetUnavailForm,
    watch: unavailWatch,
    formState: { errors: unavailErrors }
  } = useForm<UnavailabilityFormValues>({
    resolver: zodResolver(unavailabilitySchema) as any,
  });

  const watchedUnavailRoomId = unavailWatch('roomId');
  const watchedUnavailStart = unavailWatch('start');
  const watchedUnavailEnd = unavailWatch('end');

  // Query to fetch overlapping bookings for unavailability creation
  const { data: overlappingBookings, isFetching: isOverlappingLoading, refetch: checkOverlapping } = useQuery({
    queryKey: ['unavail-overlap', watchedUnavailRoomId, watchedUnavailStart, watchedUnavailEnd],
    queryFn: async () => {
      if (!watchedUnavailRoomId || !watchedUnavailStart || !watchedUnavailEnd) return [];
      const startTime = formatDateTimeForApi(watchedUnavailStart);
      const endTime = formatDateTimeForApi(watchedUnavailEnd);
      const response = await apiClient.get(`/booking/overlap-room-unavailability/${watchedUnavailRoomId}`, {
        params: { start: startTime, end: endTime }
      });
      return response.data?.data || [];
    },
    enabled: false
  });

  React.useEffect(() => {
    setHasCheckedOverlap(false);
  }, [watchedUnavailRoomId, watchedUnavailStart, watchedUnavailEnd, activeModal]);

  const handleCheckOverlap = async () => {
    if (!watchedUnavailRoomId || !watchedUnavailStart || !watchedUnavailEnd) {
      showToast("Vui lòng chọn phòng họp và khoảng thời gian", "info");
      return;
    }
    await checkOverlapping();
    setHasCheckedOverlap(true);
  };

  // React Hook Form for Equipment CRUD
  const {
    register: equipRegister,
    handleSubmit: handleEquipSubmit,
    reset: resetEquipForm,
    formState: { errors: equipErrors }
  } = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentSchema) as any,
    values: selectedEquip ? {
      equipmentName: selectedEquip.equipmentName || '',
      description: selectedEquip.description || '',
      availableQuantity: selectedEquip.availableQuantity || 0
    } : undefined
  });

  // CREATE ROOM MUTATION
  const createRoomMutation = useMutation({
    mutationFn: async (data: RoomFormValues) => {
      await apiClient.post('/room', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      showToast('Tạo phòng họp mới thành công', 'success');
      setActiveModal(null);
      resetRoomForm();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể tạo phòng họp';
      showToast(msg, 'error');
    }
  });

  // UPDATE ROOM MUTATION
  const updateRoomMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: RoomFormValues }) => {
      await apiClient.patch(`/room/${id}`, {
        roomName: data.roomName,
        capacity: data.capacity,
        floorNumber: data.floorNumber,
        description: data.description
      });
      if (data.equipments) {
        const originalEquipmentIds = selectedRoom?.equipments?.map((e: any) => Number(e.equipmentId)) || [];

        // 2. Lọc ra các thiết bị mới được thêm vào form (chưa có trong danh sách cũ)
        const newlyAddedEquipments = data.equipments
          .filter((item: any) => !originalEquipmentIds.includes(Number(item.equipmentId)))
          .map((item: any) => ({
            equipmentId: Number(item.equipmentId),
            quantity: Number(item.quantity)
          }));

        // 3. Chỉ gửi request API nếu thực sự có thiết bị mới được thêm vào
        if (newlyAddedEquipments.length > 0) {
          await apiClient.post(`/room/${id}/equipment`, newlyAddedEquipments);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      showToast('Cập nhật phòng họp thành công', 'success');
      setActiveModal(null);
      resetRoomForm();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể cập nhật phòng họp';
      showToast(msg, 'error');
    }
  });

  // DELETE ROOM MUTATION
  const deleteRoomMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/room/soft/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      showToast('Đã xóa phòng họp thành công', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể xóa phòng họp';
      showToast(msg, 'error');
    }
  });

  // UPDATE ROOM EQUIPMENT QUANTITY MUTATION
  const updateRoomEquipQtyMutation = useMutation({
    mutationFn: async ({ roomId, reId, quantity }: { roomId: number; reId: number; quantity: number }) => {
      await apiClient.patch(`/room/${roomId}/equipment/${reId}`, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      showToast('Cập nhật số lượng thiết bị thành công', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể cập nhật số lượng';
      showToast(msg, 'error');
    }
  });

  // DELETE ROOM EQUIPMENT MUTATION
  const deleteRoomEquipMutation = useMutation({
    mutationFn: async ({ roomId, reId }: { roomId: number; reId: number }) => {
      await apiClient.delete(`/room/${roomId}/equipment/${reId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      showToast('Xóa thiết bị khỏi phòng thành công', 'success');
      // Also update selectedRoom locally to refresh UI immediately
      setSelectedRoom((prev: any) => prev ? {
        ...prev,
        equipments: prev.equipments?.filter((e: any) => e.roomEquipmentId !== deleteRoomEquipMutation.variables?.reId)
      } : prev);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể xóa thiết bị';
      showToast(msg, 'error');
    }
  });

  // CREATE EQUIPMENT MUTATION
  const createEquipMutation = useMutation({
    mutationFn: async (data: EquipmentFormValues) => {
      await apiClient.post('/equipment', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipments'] });
      showToast('Tạo thiết bị mới thành công', 'success');
      setActiveModal(null);
      resetEquipForm();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể tạo thiết bị';
      showToast(msg, 'error');
    }
  });

  // UPDATE EQUIPMENT MUTATION
  const updateEquipMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: EquipmentFormValues }) => {
      await apiClient.patch(`/equipment/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipments'] });
      showToast('Cập nhật thiết bị thành công', 'success');
      setActiveModal(null);
      resetEquipForm();
      setSelectedEquip(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể cập nhật thiết bị';
      showToast(msg, 'error');
    }
  });

  // DELETE EQUIPMENT MUTATION
  const deleteEquipMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/equipment/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipments'] });
      showToast('Xóa thiết bị thành công', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể xóa thiết bị';
      showToast(msg, 'error');
    }
  });

  // CREATE ROOM UNAVAILABILITY MUTATION
  const createUnavailMutation = useMutation({
    mutationFn: async (payload: { roomId: number; reason: string; startTime: string; endTime: string; bookingIdOverLap: number[] }) => {
      await apiClient.post('/unavailability-room', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unavailabilities'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      showToast('Thêm phòng họp không khả dụng thành công', 'success');
      setActiveModal(null);
      resetUnavailForm();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể thêm phòng họp không khả dụng';
      showToast(msg, 'error');
    }
  });

  // UPDATE ROOM UNAVAILABILITY MUTATION
  const updateUnavailMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: { reason: string; startTime: string; endTime: string } }) => {
      await apiClient.patch(`/unavailability-room/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unavailabilities'] });
      showToast('Cập nhật phòng họp không khả dụng thành công', 'success');
      setActiveModal(null);
      resetUnavailForm();
      setSelectedUnavail(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể cập nhật phòng họp không khả dụng';
      showToast(msg, 'error');
    }
  });

  // DELETE ROOM UNAVAILABILITY (SOFT DELETE) MUTATION
  const deleteUnavailMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/unavailability-room/soft/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unavailabilities'] });
      showToast('Đã xóa phòng họp không khả dụng thành công', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể xóa phòng họp không khả dụng';
      showToast(msg, 'error');
    }
  });

  // CREATE BOOKING MUTATION FROM ROOM PAGE
  const createBookingFromRoomMutation = useMutation({
    mutationFn: async (data: BookingFormValues) => {
      const startDateTime = formatDateTimeForApi(data.start);
      const endDateTime = formatDateTimeForApi(data.end);
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
      resetBookingForm();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Có lỗi trùng lịch hoặc thiếu thiết bị';
      showToast(msg, 'error');
    }
  });

  const handleEditClick = (room: any) => {
    setSelectedRoom(room);
    resetRoomForm({
      roomName: room.roomName,
      capacity: room.capacity,
      floorNumber: room.floorNumber,
      description: room.description || '',
      buildingId: room.building?.id || 1,
      equipments: [] // Existing equipments shown separately with inline edit/delete
    });
    setActiveModal('edit');
  };



  const handleBookClick = (room: any) => {
    setSelectedRoom(room);
    resetBookingForm({
      title: '',
      description: '',
      roomId: room.id,
      start: '',
      end: '',
      attendee: 1,
      receiversInput: '',
      equipments: []
    });
    setActiveModal('book');
  };

  const handleEditEquipClick = (equip: any) => {
    setSelectedEquip(equip);
    resetEquipForm({
      equipmentName: equip.equipmentName,
      description: equip.description || '',
      availableQuantity: equip.availableQuantity
    });
    setActiveModal('edit-equip');
  };

  const handleDeleteEquip = (id: number, name: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa thiết bị "${name}"?`)) {
      deleteEquipMutation.mutate(id);
    }
  };

  const handleEditUnavailClick = (unavail: any) => {
    setSelectedUnavail(unavail);
    resetUnavailForm({
      roomId: unavail.room?.id || 1,
      reason: unavail.reason,
      start: formatDateTimeLocal(unavail.start),
      end: formatDateTimeLocal(unavail.end)
    });
    setActiveModal('edit-unavail');
  };

  const handleDeleteUnavail = (id: number, roomName: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa lịch bận/bảo trì của phòng "${roomName}"?`)) {
      deleteUnavailMutation.mutate(id);
    }
  };

  const onSaveUnavail = (data: UnavailabilityFormValues) => {
    if (activeModal === 'create-unavail') {
      const bookingIds = (overlappingBookings || []).map((b: any) => Number(b.bookingId));
      createUnavailMutation.mutate({
        roomId: Number(data.roomId),
        reason: data.reason,
        startTime: formatDateTimeForApi(data.start),
        endTime: formatDateTimeForApi(data.end),
        bookingIdOverLap: bookingIds
      });
    } else if (activeModal === 'edit-unavail' && selectedUnavail) {
      updateUnavailMutation.mutate({
        id: selectedUnavail.unId,
        payload: {
          reason: data.reason,
          startTime: formatDateTimeForApi(data.start),
          endTime: formatDateTimeForApi(data.end)
        }
      });
    }
  };

  const onSaveRoom = (data: RoomFormValues) => {
    if (activeModal === 'create') {
      createRoomMutation.mutate(data);
    } else if (activeModal === 'edit' && selectedRoom) {
      updateRoomMutation.mutate({ id: selectedRoom.id, data });
    }
  };

  const onSaveEquip = (data: EquipmentFormValues) => {
    if (activeModal === 'create-equip') {
      createEquipMutation.mutate(data);
    } else if (activeModal === 'edit-equip' && selectedEquip) {
      updateEquipMutation.mutate({ id: selectedEquip.equipmentId, data });
    }
  };

  const onSaveBooking = (data: BookingFormValues) => {
    createBookingFromRoomMutation.mutate(data);
  };



  // Filter options for Room Equipments
  const watchedRoomEquipments = watch('equipments') || [];
  const getAvailableEquipments = (currentIndex: number) => {
    const selectedInForm = watchedRoomEquipments
      .map((item: any, idx: number) => idx !== currentIndex ? Number(item?.equipmentId) : null)
      .filter((id: number | null) => id !== null && !isNaN(id));

    // Also exclude equipment already assigned to the room (shown in the existing section)
    const alreadyAssigned = (selectedRoom?.equipments || []).map((e: any) => Number(e.equipmentId));

    return equipmentsList?.filter((eq: any) => !
      selectedInForm.includes(Number(eq.equipmentId)) &&
      !alreadyAssigned.includes(Number(eq.equipmentId))
    ) || [];
  };

  const handleAddEquipmentRow = () => {
    const available = getAvailableEquipments(-1);
    if (available.length > 0) {
      append({ equipmentId: available[0].equipmentId, quantity: 1 });
    } else {
      append({ equipmentId: '', quantity: 1 } as any);
    }
  };

  // Filter options for Booking Equipments
  const watchedBookingEquipments = bookingWatch('equipments') || [];
  const getAvailableBookingEquipments = (currentIndex: number) => {
    const selectedIds = watchedBookingEquipments
      .map((item: any, idx: number) => idx !== currentIndex ? Number(item?.equipmentId) : null)
      .filter((id: number | null) => id !== null && !isNaN(id));

    return equipmentsList?.filter((eq: any) => !selectedIds.includes(Number(eq.equipmentId))) || [];
  };

  const handleAddBookingEquipmentRow = () => {
    const available = getAvailableBookingEquipments(-1);
    if (available.length > 0) {
      bookingAppend({ equipmentId: available[0].equipmentId, quantity: 1 });
    } else {
      bookingAppend({ equipmentId: '', quantity: 1 } as any);
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa phòng họp "${name}"?`)) {
      deleteRoomMutation.mutate(id);
    }
  };

  const isAdmin = hasAuthority('ROOM:CREATE');
  const canViewUnavailability = hasAuthority('ROOM_UNAVAILABLE:VIEW') || isAdmin;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Tab controls */}
      {(isAdmin || canViewUnavailability) && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', marginBottom: '0.5rem', gap: '1rem' }}>
          <button
            onClick={() => setActiveTab('rooms')}
            style={{
              padding: '10px 16px',
              fontSize: '0.88rem',
              fontWeight: 600,
              border: 'none',
              background: 'none',
              color: activeTab === 'rooms' ? 'var(--accent)' : 'var(--text-tertiary)',
              borderBottom: activeTab === 'rooms' ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            Danh sách Phòng họp
          </button>
          {canViewUnavailability && (
            <button
              onClick={() => {
                setActiveTab('unavailabilities');
                setUnavailPage(0);
              }}
              style={{
                padding: '10px 16px',
                fontSize: '0.88rem',
                fontWeight: 600,
                border: 'none',
                background: 'none',
                color: activeTab === 'unavailabilities' ? 'var(--accent)' : 'var(--text-tertiary)',
                borderBottom: activeTab === 'unavailabilities' ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              Phòng Không Khả Dụng
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => {
                setActiveTab('equipments');
                setEquipPage(0);
              }}
              style={{
                padding: '10px 16px',
                fontSize: '0.88rem',
                fontWeight: 600,
                border: 'none',
                background: 'none',
                color: activeTab === 'equipments' ? 'var(--accent)' : 'var(--text-tertiary)',
                borderBottom: activeTab === 'equipments' ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              Quản lý Thiết bị
            </button>
          )}
        </div>
      )}

      {activeTab === 'rooms' && (
        <>
          {/* Header controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Danh Sách Phòng Họp</h2>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Quản lý phòng họp, thiết bị, và tra cứu phòng trống</p>
            </div>

            {isAdmin && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setSelectedRoom(null);
                  resetRoomForm({ roomName: '', capacity: 1, floorNumber: 0, description: '', buildingId: 1, equipments: [] });
                  setActiveModal('create');
                }}
              >
                <Plus size={16} /> Tạo phòng họp mới
              </button>
            )}
          </div>

          {/* Filter panel */}
          <div className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', padding: '1rem' }}>
            <div style={{ flexGrow: 1, minWidth: '240px', position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                <Search size={16} />
              </span>
              <input
                type="text"
                className="form-control"
                style={{ width: '100%', paddingLeft: '2.5rem' }}
                placeholder="Tìm theo tên phòng họp..."
                value={keyword}
                onChange={(e) => { setKeyword(e.target.value); setRoomPage(0); }}
              />
            </div>


            <input
              type="number"
              className="form-control"
              style={{ width: '130px' }}
              placeholder="Tầng..."
              value={filterFloor}
              onChange={(e) => handleFloorChange(Math.max(Number(e.target.value), 0).toString())}
            />

            <input
              type="number"
              className="form-control"
              style={{ width: '150px' }}
              placeholder="Nhập sức chứa..."
              value={filterCapacity}
              onChange={(e) => handleCapacityChange(Math.max(Number(e.target.value), 1).toString())}
            />

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Từ:</span>
              <input
                type="datetime-local"
                className="form-control"
                style={{ width: '200px' }}
                value={filterStart}
                onChange={(e) => {
                  setFilterStart(e.target.value);
                  setRoomPage(0);
                  if (e.target.value !== '') {
                    setFilterFloor('');
                    setFilterCapacity('');
                  }
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Đến:</span>
              <input
                type="datetime-local"
                className="form-control"
                style={{ width: '200px' }}
                value={filterEnd}
                onChange={(e) => {
                  setFilterEnd(e.target.value);
                  setRoomPage(0);
                  if (e.target.value !== '') {
                    setFilterFloor('');
                    setFilterCapacity('');
                  }
                }}
              />
            </div>
          </div>

          {/* Grid listing */}
          {isRoomsLoading ? (
            <div className="grid-cols-3">
              <div className="skeleton" style={{ height: '220px' }} />
              <div className="skeleton" style={{ height: '220px' }} />
              <div className="skeleton" style={{ height: '220px' }} />
            </div>
          ) : roomsList.length === 0 ? (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              Không tìm thấy phòng họp nào khớp với bộ lọc của bạn.
            </div>
          ) : (
            <div className="grid-cols-3">
              {roomsList.map((room: any) => (
                <div
                  key={room.id}
                  className="glass-card glass-card-hover"
                  style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '230px' }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                        <DoorOpen size={20} style={{ color: 'var(--accent)' }} />
                        {room.roomName}
                      </h3>
                      <span className="badge badge-approved" style={{ fontSize: '0.65rem' }}>
                        {room.building?.buildingName || 'Tòa A'}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
                      {room.description || 'Không có mô tả chi tiết phòng họp.'}
                    </p>

                    {/* Badges for capacity & floor */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', backgroundColor: 'var(--bg-tertiary)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                        <Users size={12} /> {room.capacity} chỗ ngồi
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', backgroundColor: 'var(--bg-tertiary)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                        <Layers size={12} /> Tầng {room.floorNumber}
                      </span>
                    </div>

                    {/* Equipments inside room */}
                    {room.equipments && room.equipments.length > 0 && (
                      <div style={{ marginBottom: '1.25rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.25rem' }}>Thiết bị đi kèm:</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                          {room.equipments.map((eq: any, index: number) => (
                            <span
                              key={index}
                              style={{
                                fontSize: '0.7rem',
                                color: 'var(--accent)',
                                backgroundColor: 'var(--accent-light)',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                border: '1px solid var(--accent-border)'
                              }}
                            >
                              {eq.equipmentName || eq.name} x{eq.quantity || eq.usingQuantity}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action row */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      borderTop: '1px solid var(--border-light)',
                      paddingTop: '0.75rem',
                      marginTop: '0.5rem',
                      gap: '0.5rem'
                    }}
                  >
                    <button
                      onClick={() => handleBookClick(room)}
                      className="btn btn-ghost"
                      style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Calendar size={14} /> Đăng ký lịch
                    </button>

                    {isAdmin && (
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        <button
                          onClick={() => handleEditClick(room)}
                          className="btn btn-ghost"
                          style={{ padding: '6px', minWidth: 'auto', color: 'var(--text-secondary)' }}
                          title="Chỉnh sửa phòng"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(room.id, room.roomName)}
                          className="btn btn-ghost"
                          style={{ padding: '6px', minWidth: 'auto', color: 'var(--danger)' }}
                          title="Xóa phòng"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Rooms Pagination */}
          {roomsTotalPages >= 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                className="btn btn-secondary"
                disabled={roomPage === 0}
                onClick={() => setRoomPage((p) => Math.max(0, p - 1))}
                style={{ padding: '6px 12px', fontSize: '0.82rem' }}
              >
                Trước
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Trang {roomPage + 1} / {roomsTotalPages}
              </span>
              <button
                className="btn btn-secondary"
                disabled={roomPage >= roomsTotalPages - 1}
                onClick={() => setRoomPage((p) => Math.min(roomsTotalPages - 1, p + 1))}
                style={{ padding: '6px 12px', fontSize: '0.82rem' }}
              >
                Sau
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === 'equipments' && isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Header controls for Equipments */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Quản Lý Thiết Bị</h2>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Danh mục thiết bị phục vụ các cuộc họp</p>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => {
                setSelectedEquip(null);
                resetEquipForm({ equipmentName: '', description: '', availableQuantity: 1 });
                setActiveModal('create-equip');
              }}
            >
              <Plus size={16} /> Thêm thiết bị mới
            </button>
          </div>

          {/* Search toolbar */}
          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem' }}>
            <div style={{ position: 'relative', flexGrow: 1, maxWidth: '400px' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                <Search size={16} />
              </span>
              <input
                type="text"
                className="form-control"
                style={{ width: '100%', paddingLeft: '2.5rem' }}
                placeholder="Tìm theo tên thiết bị..."
                value={equipKeyword}
                onChange={(e) => {
                  setEquipKeyword(e.target.value);
                  setEquipPage(0);
                }}
              />
            </div>
          </div>

          {/* Equipments Listing */}
          {isEquipLoading ? (
            <div className="grid-cols-3">
              <div className="skeleton" style={{ height: '150px' }} />
              <div className="skeleton" style={{ height: '150px' }} />
              <div className="skeleton" style={{ height: '150px' }} />
            </div>
          ) : equipList.length === 0 ? (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              Không tìm thấy thiết bị nào khớp với từ khóa của bạn.
            </div>
          ) : (
            <>
              <div className="grid-cols-3">
                {equipList.map((eq: any) => (
                  <div
                    key={eq.equipmentId}
                    className="glass-card"
                    style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '140px', borderLeft: '4px solid var(--accent)' }}
                  >
                    <div>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {eq.equipmentName}
                      </h4>
                      <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', color: 'var(--text-tertiary)', minHeight: '36px' }}>
                        {eq.description || 'Không có mô tả chi tiết thiết bị.'}
                      </p>
                      <span className="badge badge-approved" style={{ fontSize: '0.72rem' }}>
                        Tổng số lượng: {eq.availableQuantity}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleEditEquipClick(eq)}
                        className="btn btn-ghost"
                        style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Edit3 size={12} /> Sửa
                      </button>
                      <button
                        onClick={() => handleDeleteEquip(eq.equipmentId, eq.equipmentName)}
                        className="btn btn-ghost"
                        style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Trash2 size={12} /> Xóa
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Equipments Pagination */}
              {equipTotalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                  <button
                    className="btn btn-secondary"
                    disabled={equipPage === 0}
                    onClick={() => setEquipPage((p) => Math.max(0, p - 1))}
                    style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                  >
                    Trước
                  </button>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Trang {equipPage + 1} / {equipTotalPages}
                  </span>
                  <button
                    className="btn btn-secondary"
                    disabled={equipPage >= equipTotalPages - 1}
                    onClick={() => setEquipPage((p) => Math.min(equipTotalPages - 1, p + 1))}
                    style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                  >
                    Sau
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'unavailabilities' && canViewUnavailability && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Header controls for Unavailability */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Phòng Không Khả Dụng</h2>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Danh sách thời gian bảo trì/bận của phòng họp</p>
            </div>

            {canManageUnavailability && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setSelectedUnavail(null);
                  resetUnavailForm({ roomId: allRoomsData?.[0]?.id || '', reason: '', start: '', end: '' });
                  setActiveModal('create-unavail');
                }}
              >
                <Plus size={16} /> Thêm lịch phòng không khả dụng
              </button>
            )}
          </div>

          {canManageUnavailability && (
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', gap: '1rem', marginBottom: '-0.5rem' }}>
              <button
                onClick={() => {
                  setUnavailDeletedFilter(false);
                  setUnavailPage(0);
                }}
                style={{
                  padding: '8px 12px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  border: 'none',
                  background: 'none',
                  color: !unavailDeletedFilter ? 'var(--accent)' : 'var(--text-tertiary)',
                  borderBottom: !unavailDeletedFilter ? '2px solid var(--accent)' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                Lịch bận hiện tại
              </button>
              <button
                onClick={() => {
                  setUnavailDeletedFilter(true);
                  setUnavailPage(0);
                }}
                style={{
                  padding: '8px 12px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  border: 'none',
                  background: 'none',
                  color: unavailDeletedFilter ? 'var(--accent)' : 'var(--text-tertiary)',
                  borderBottom: unavailDeletedFilter ? '2px solid var(--accent)' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                Lịch sử đã xóa
              </button>
            </div>
          )}

          {/* Search/filter toolbar */}
          <div className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', padding: '1rem' }}>
            <div style={{ position: 'relative', flexGrow: 1, minWidth: '240px' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                <Search size={16} />
              </span>
              <input
                type="text"
                className="form-control"
                style={{ width: '100%', paddingLeft: '2.5rem' }}
                placeholder="Tìm theo lý do bận..."
                value={unavailKeyword}
                onChange={(e) => {
                  setUnavailKeyword(e.target.value);
                  setUnavailPage(0);
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Từ:</span>
              <input
                type="datetime-local"
                className="form-control"
                style={{ width: '200px' }}
                value={unavailStart}
                onChange={(e) => {
                  setUnavailStart(e.target.value);
                  setUnavailPage(0);
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Đến:</span>
              <input
                type="datetime-local"
                className="form-control"
                style={{ width: '200px' }}
                value={unavailEnd}
                onChange={(e) => {
                  setUnavailEnd(e.target.value);
                  setUnavailPage(0);
                }}
              />
            </div>

            {(unavailKeyword || unavailStart || unavailEnd) && (
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setUnavailKeyword('');
                  setUnavailStart('');
                  setUnavailEnd('');
                  setUnavailPage(0);
                }}
                style={{ color: 'var(--danger)' }}
              >
                Xóa lọc
              </button>
            )}
          </div>

          {/* Unavailabilities Listing */}
          {isUnavailLoading ? (
            <div className="grid-cols-3">
              <div className="skeleton" style={{ height: '180px' }} />
              <div className="skeleton" style={{ height: '180px' }} />
              <div className="skeleton" style={{ height: '180px' }} />
            </div>
          ) : unavailList.length === 0 ? (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              Không có lịch phòng không khả dụng nào được tìm thấy.
            </div>
          ) : (
            <>
              <div className="grid-cols-3">
                {unavailList.map((un: any) => {
                  const now = new Date();
                  const startD = new Date(un.start);
                  const endD = new Date(un.end);
                  let badgeText = 'Đang diễn ra';
                  let badgeClass = 'badge-pending';

                  if (unavailDeletedFilter) {
                    badgeText = 'Đã xóa';
                    badgeClass = 'badge-cancelled';
                  } else if (now < startD) {
                    badgeText = 'Sắp diễn ra';
                    badgeClass = 'badge-approved';
                  } else if (now > endD) {
                    badgeText = 'Đã kết thúc';
                    badgeClass = 'badge-cancelled';
                  }

                  return (
                    <div
                      key={un.unId}
                      className="glass-card"
                      style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '180px', borderLeft: unavailDeletedFilter ? '4px solid var(--text-tertiary)' : '4px solid var(--danger)' }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                            {un.room?.roomName || 'Phòng họp'}
                          </h4>
                          <span className={`badge ${badgeClass}`} style={{ fontSize: '0.65rem' }}>
                            {badgeText}
                          </span>
                        </div>

                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                          Tòa nhà: {un.room?.building?.buildingName || 'Tòa A'}
                        </p>

                        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <strong>Lý do:</strong> {un.reason}
                        </p>

                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span>⏰ <strong>Từ:</strong> {new Date(un.start).toLocaleString('vi-VN')}</span>
                          <span>⏰ <strong>Đến:</strong> {new Date(un.end).toLocaleString('vi-VN')}</span>
                        </div>
                      </div>

                      {canManageUnavailability && !unavailDeletedFilter && (
                        <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleEditUnavailClick(un)}
                            className="btn btn-ghost"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Edit3 size={12} /> Sửa
                          </button>
                          <button
                            onClick={() => handleDeleteUnavail(un.unId, un.room?.roomName)}
                            className="btn btn-ghost"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Trash2 size={12} /> Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Unavailability Pagination */}
              {unavailTotalPages >= 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                  <button
                    className="btn btn-secondary"
                    disabled={unavailPage === 0}
                    onClick={() => setUnavailPage((p) => Math.max(0, p - 1))}
                    style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                  >
                    Trước
                  </button>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Trang {unavailPage + 1} / {unavailTotalPages}
                  </span>
                  <button
                    className="btn btn-secondary"
                    disabled={unavailPage >= unavailTotalPages - 1}
                    onClick={() => setUnavailPage((p) => Math.min(unavailTotalPages - 1, p + 1))}
                    style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                  >
                    Sau
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* CREATE & EDIT MODAL */}
      {(activeModal === 'create' || activeModal === 'edit') && (
        <div className="modal-overlay">
          <form onSubmit={handleRoomSubmit(onSaveRoom)} className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                {activeModal === 'create' ? 'Tạo phòng họp mới' : 'Chỉnh sửa phòng họp'}
              </h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px', minWidth: 'auto' }} onClick={() => setActiveModal(null)}>
                <XCircle size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="grid-cols-2" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="room-name">Tên phòng họp *</label>
                  <input
                    id="room-name"
                    className="form-control"
                    placeholder="Phòng VIP / Meeting Room A"
                    {...roomRegister('roomName')}
                  />
                  {roomErrors.roomName && <span className="form-error">{roomErrors.roomName.message}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="room-building">Thuộc Tòa Nhà *</label>
                  <select
                    id="room-building"
                    className="form-control"
                    {...roomRegister('buildingId')}
                  >
                    {buildings?.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.buildingName}</option>
                    ))}
                  </select>
                  {roomErrors.buildingId && <span className="form-error">{roomErrors.buildingId.message}</span>}
                </div>
              </div>

              <div className="grid-cols-2" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="room-capacity">Sức chứa (người) *</label>
                  <input
                    id="room-capacity"
                    type="number"
                    className="form-control"
                    placeholder="12"
                    min={1}
                    onKeyDown={preventNegativeNumber}
                    onInput={normalizeNegativeNumber}
                    {...roomRegister('capacity')}
                  />
                  {roomErrors.capacity && <span className="form-error">{roomErrors.capacity.message}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="room-floor">Ở Tầng số *</label>
                  <input
                    id="room-floor"
                    min={1}
                    type="number"
                    onKeyDown={preventNegativeNumber}
                    onInput={normalizeNegativeNumber}
                    className="form-control"
                    placeholder="2"
                    {...roomRegister('floorNumber')}
                  />
                  {roomErrors.floorNumber && <span className="form-error">{roomErrors.floorNumber.message}</span>}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="room-desc">Mô tả đặc điểm phòng họp</label>
                <textarea
                  id="room-desc"
                  className="form-control"
                  style={{ minHeight: '60px', resize: 'vertical' }}
                  placeholder="Bàn tròn rộng, tivi trình chiếu 75 inch..."
                  {...roomRegister('description')}
                />
              </div>

              {/* Equipment allocations list */}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span className="form-label">Thiết bị có sẵn trong phòng</span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: '0.75rem', padding: '4px 8px', color: 'var(--accent)' }}
                    onClick={handleAddEquipmentRow}
                    disabled={equipmentsList && fields.length >= equipmentsList.length}
                  >
                    <ListPlus size={14} /> Thêm thiết bị
                  </button>
                </div>

                {/* Existing equipment from server (edit mode only) */}
                {activeModal === 'edit' && selectedRoom?.equipments && selectedRoom.equipments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>Hiện có:</span>
                    {selectedRoom.equipments.map((eq: any) => (
                      <div key={eq.roomEquipmentId || eq.equipmentId} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
                        <span style={{ flexGrow: 1, fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                          {eq.equipmentName || eq.name}
                        </span>
                        <input
                          type="number"
                          min={1}
                          onKeyDown={preventNegativeNumber}
                          onInput={normalizeNegativeNumber}
                          defaultValue={eq.quantity || eq.usingQuantity || 1}
                          className="form-control"
                          style={{ width: '75px' }}
                          onBlur={(e) => {
                            const newQty = Number(e.target.value);
                            if (newQty > 0 && eq.roomEquipmentId && newQty !== (eq.quantity || eq.usingQuantity)) {
                              updateRoomEquipQtyMutation.mutate({
                                roomId: selectedRoom.id,
                                reId: eq.roomEquipmentId,
                                quantity: newQty
                              });
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ color: 'var(--danger)', padding: '5px', minWidth: 'auto' }}
                          title="Xóa thiết bị khỏi phòng"
                          onClick={() => {
                            if (!eq.roomEquipmentId) {
                              showToast('Không tìm thấy ID thiết bị phòng', 'error');
                              return;
                            }
                            if (window.confirm(`Xóa "${eq.equipmentName || eq.name}" khỏi phòng này?`)) {
                              deleteRoomEquipMutation.mutate({ roomId: selectedRoom.id, reId: eq.roomEquipmentId });
                              setSelectedRoom((prev: any) => ({
                                ...prev,
                                equipments: prev.equipments.filter((e: any) => e.roomEquipmentId !== eq.roomEquipmentId)
                              }));
                            }
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* New equipment rows to add */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {fields.map((field, index) => (
                    <div key={field.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <select
                        className="form-control"
                        style={{ flexGrow: 1 }}
                        {...roomRegister(`equipments.${index}.equipmentId` as const)}
                      >
                        <option value="">-- Chọn thiết bị --</option>
                        {getAvailableEquipments(index).map((eq: any) => (
                          <option key={eq.equipmentId} value={eq.equipmentId}>{eq.equipmentName}</option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min={0}
                        onKeyDown={preventNegativeNumber}
                        onInput={normalizeNegativeNumber}
                        className="form-control"
                        style={{ width: '80px' }}
                        placeholder="SL"
                        {...roomRegister(`equipments.${index}.quantity` as const)}
                      />

                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ color: 'var(--danger)', padding: '6px', minWidth: 'auto' }}
                        onClick={() => remove(index)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Hủy</button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={createRoomMutation.isPending || updateRoomMutation.isPending}
              >
                {createRoomMutation.isPending || updateRoomMutation.isPending ? 'Đang lưu...' : 'Lưu Thay Đổi'}
              </button>
            </div>
          </form>
        </div>
      )}



      {/* DIRECT BOOKING MODAL */}
      {activeModal === 'book' && selectedRoom && (
        <div className="modal-overlay">
          <form onSubmit={handleBookingSubmit(onSaveBooking)} className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                Đăng ký phòng họp: <strong>{selectedRoom.roomName}</strong>
              </h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px', minWidth: 'auto' }} onClick={() => setActiveModal(null)}>
                <XCircle size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input type="hidden" {...bookingRegister('roomId')} value={selectedRoom.id} />

              <div className="form-group">
                <label className="form-label" htmlFor="book-title">Tiêu đề cuộc họp *</label>
                <input
                  id="book-title"
                  className="form-control"
                  placeholder="Họp tổng kết tuần / Kick-off dự án..."
                  {...bookingRegister('title')}
                />
                {bookingErrors.title && <span className="form-error">{bookingErrors.title.message}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="book-desc">Mô tả nội dung cuộc họp</label>
                <textarea
                  id="book-desc"
                  className="form-control"
                  style={{ minHeight: '50px', resize: 'vertical' }}
                  placeholder="Thảo luận kế hoạch phát triển quý tiếp theo..."
                  {...bookingRegister('description')}
                />
              </div>

              <div className="grid-cols-2" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Phòng họp được chọn</label>
                  <input
                    className="form-control"
                    value={`${selectedRoom.roomName} (Tầng ${selectedRoom.floorNumber})`}
                    disabled
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="book-attendees">Số người tham dự họp *</label>
                  <input
                    id="book-attendees"
                    type="number"
                    onKeyDown={preventNegativeNumber}
                    onInput={normalizeNegativeNumber}
                    className="form-control"
                    placeholder="8"
                    {...bookingRegister('attendee')}
                  />
                  {bookingErrors.attendee && <span className="form-error">{bookingErrors.attendee.message}</span>}
                </div>
              </div>

              <div className="grid-cols-2" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="book-start">Thời gian bắt đầu *</label>
                  <input
                    id="book-start"
                    type="datetime-local"
                    className="form-control"
                    {...bookingRegister('start')}
                  />
                  {bookingErrors.start && <span className="form-error">{bookingErrors.start.message}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="book-end">Thời gian kết thúc *</label>
                  <input
                    id="book-end"
                    type="datetime-local"
                    className="form-control"
                    {...bookingRegister('end')}
                  />
                  {bookingErrors.end && <span className="form-error">{bookingErrors.end.message}</span>}
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
                    {...bookingRegister('receiversInput')}
                  />
                </div>
              </div>

              {/* Booking equipments additional allocation */}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span className="form-label">Thiết bị họp bổ sung cần chuẩn bị</span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: '0.75rem', padding: '4px 8px', color: 'var(--accent)' }}
                    onClick={handleAddBookingEquipmentRow}
                    disabled={equipmentsList && bookingFields.length >= equipmentsList.length}
                  >
                    <ListPlus size={14} /> Thêm thiết bị
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
                  {bookingFields.map((field, index) => (
                    <div key={field.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <select
                        className="form-control"
                        style={{ flexGrow: 1 }}
                        {...bookingRegister(`equipments.${index}.equipmentId` as const)}
                      >
                        <option value="">-- Chọn thiết bị --</option>
                        {getAvailableBookingEquipments(index).map((eq: any) => (
                          <option key={eq.equipmentId} value={eq.equipmentId}>
                            {eq.equipmentName}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        className="form-control"
                        style={{ width: '80px' }}
                        placeholder="SL"
                        onKeyDown={preventNegativeNumber}
                        onInput={normalizeNegativeNumber}
                        {...bookingRegister(`equipments.${index}.quantity` as const)}
                      />

                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ color: 'var(--danger)', padding: '6px', minWidth: 'auto' }}
                        onClick={() => bookingRemove(index)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Hủy</button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={createBookingFromRoomMutation.isPending}
              >
                {createBookingFromRoomMutation.isPending ? 'Đang gửi yêu cầu...' : 'Gửi Đăng Ký'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CREATE & EDIT EQUIPMENT MODAL */}
      {(activeModal === 'create-equip' || activeModal === 'edit-equip') && (
        <div className="modal-overlay">
          <form onSubmit={handleEquipSubmit(onSaveEquip)} className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                {activeModal === 'create-equip' ? 'Thêm thiết bị mới' : 'Chỉnh sửa thiết bị'}
              </h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px', minWidth: 'auto' }} onClick={() => setActiveModal(null)}>
                <XCircle size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="equip-name">Tên thiết bị *</label>
                <input
                  id="equip-name"
                  className="form-control"
                  placeholder="Tivi Samsung 75 inch, Bảng di động..."
                  {...equipRegister('equipmentName')}
                />
                {equipErrors.equipmentName && <span className="form-error">{equipErrors.equipmentName.message}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="equip-desc">Mô tả đặc điểm thiết bị</label>
                <textarea
                  id="equip-desc"
                  className="form-control"
                  style={{ minHeight: '60px', resize: 'vertical' }}
                  placeholder="Nhập mô tả tại đây..."
                  {...equipRegister('description')}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="equip-quantity">Tổng số lượng sở hữu *</label>
                <input
                  id="equip-quantity"
                  type="number"
                  onKeyDown={preventNegativeNumber}
                  onInput={normalizeNegativeNumber}
                  className="form-control"
                  placeholder="10"
                  min={1}
                  {...equipRegister('availableQuantity')}
                />
                {equipErrors.availableQuantity && <span className="form-error">{equipErrors.availableQuantity.message}</span>}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Hủy</button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={createEquipMutation.isPending || updateEquipMutation.isPending}
              >
                {createEquipMutation.isPending || updateEquipMutation.isPending ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CREATE & EDIT ROOM UNAVAILABILITY MODAL */}
      {(activeModal === 'create-unavail' || activeModal === 'edit-unavail') && (
        <div className="modal-overlay">
          <form onSubmit={handleUnavailSubmit(onSaveUnavail)} className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                {activeModal === 'create-unavail' ? 'Thêm phòng họp không khả dụng' : 'Chỉnh sửa phòng họp không khả dụng'}
              </h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px', minWidth: 'auto' }} onClick={() => setActiveModal(null)}>
                <XCircle size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {activeModal === 'create-unavail' ? (
                <div className="form-group">
                  <label className="form-label" htmlFor="unavail-room">Chọn phòng họp *</label>
                  <select
                    id="unavail-room"
                    className="form-control"
                    {...unavailRegister('roomId')}
                  >
                    <option value="">-- Chọn phòng họp --</option>
                    {allRoomsData?.map((r: any) => (
                      <option key={r.id} value={r.id}>{r.roomName} ({r.building?.buildingName})</option>
                    ))}
                  </select>
                  {unavailErrors.roomId && <span className="form-error">{unavailErrors.roomId.message}</span>}
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Phòng họp</label>
                  <input
                    className="form-control"
                    value={selectedUnavail?.room?.roomName || ''}
                    disabled
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="unavail-reason">Lý do không khả dụng (bảo trì, sự kiện...) *</label>
                <textarea
                  id="unavail-reason"
                  className="form-control"
                  style={{ minHeight: '60px', resize: 'vertical' }}
                  placeholder="Nhập lý do bận, ví dụ: Bảo trì đường mạng, Họp hội đồng thành phố..."
                  {...unavailRegister('reason')}
                />
                {unavailErrors.reason && <span className="form-error">{unavailErrors.reason.message}</span>}
              </div>

              <div className="grid-cols-2" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="unavail-start">Thời gian bắt đầu *</label>
                  <input
                    id="unavail-start"
                    type="datetime-local"
                    className="form-control"
                    {...unavailRegister('start')}
                  />
                  {unavailErrors.start && <span className="form-error">{unavailErrors.start.message}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="unavail-end">Thời gian kết thúc *</label>
                  <input
                    id="unavail-end"
                    type="datetime-local"
                    className="form-control"
                    {...unavailRegister('end')}
                  />
                  {unavailErrors.end && <span className="form-error">{unavailErrors.end.message}</span>}
                </div>
              </div>

              {/* CHECK OVERLAP BUTTON */}
              {activeModal === 'create-unavail' && watchedUnavailRoomId && watchedUnavailStart && watchedUnavailEnd && (
                <div style={{ marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCheckOverlap}
                    disabled={isOverlappingLoading}
                    style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '8px 16px', fontSize: '0.85rem' }}
                  >
                    🔍 Kiểm tra lịch trùng
                  </button>
                </div>
              )}

              {/* OVERLAPPING BOOKINGS SECTION */}
              {activeModal === 'create-unavail' && watchedUnavailRoomId && watchedUnavailStart && watchedUnavailEnd && hasCheckedOverlap && (
                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem', marginTop: '1rem' }}>
                  <span className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                    Lịch họp bị ảnh hưởng trong khoảng thời gian này
                  </span>

                  {isOverlappingLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                      <div className="spinner" style={{ width: '14px', height: '14px', border: '2px solid var(--border-light)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      Đang kiểm tra lịch trùng...
                    </div>
                  ) : !overlappingBookings || overlappingBookings.length === 0 ? (
                    <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', color: 'var(--success)', fontSize: '0.8rem' }}>
                      ✓ Không có lịch họp nào bị trùng.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--danger)', fontSize: '0.78rem', fontWeight: 600 }}>
                        ⚠ Cảnh báo: Có {overlappingBookings.length} lịch họp đang hoạt động sẽ tự động bị HỦY và gửi thông báo tới người tham gia:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '150px', overflowY: 'auto', paddingRight: '4px' }}>
                        {overlappingBookings.map((b: any) => (
                          <div key={b.bookingId} style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', fontSize: '0.8rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                              <span>{b.title}</span>
                              <span style={{ color: 'var(--danger)' }}>#{b.bookingId}</span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                              Người đặt: {b.userBooked} | {new Date(b.startTime).toLocaleString('vi-VN')} – {new Date(b.endTime).toLocaleString('vi-VN')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Hủy</button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={createUnavailMutation.isPending || updateUnavailMutation.isPending}
              >
                {createUnavailMutation.isPending || updateUnavailMutation.isPending ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
