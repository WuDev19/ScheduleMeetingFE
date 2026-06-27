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
  Activity, 
  XCircle,
  CheckCircle,
  ListPlus
} from 'lucide-react';

// Form validation schemas
const roomSchema = z.object({
  roomName: z.string().min(1, 'Vui lòng nhập tên phòng'),
  capacity: z.coerce.number().min(1, 'Sức chứa phải lớn hơn hoặc bằng 1'),
  floorNumber: z.coerce.number().min(0, 'Số tầng không hợp lệ'),
  description: z.string().optional(),
  buildingId: z.coerce.number().min(1, 'Vui lòng chọn tòa nhà'),
  equipments: z.array(z.object({
    equipmentId: z.coerce.number().min(1, 'Vui lòng chọn thiết bị'),
    quantity: z.coerce.number().min(1, 'Số lượng tối thiểu là 1')
  })).optional()
});

const overlapSchema = z.object({
  start: z.string().min(1, 'Vui lòng chọn thời gian bắt đầu'),
  end: z.string().min(1, 'Vui lòng chọn thời gian kết thúc')
});

type RoomFormValues = z.infer<typeof roomSchema>;
type OverlapFormValues = z.infer<typeof overlapSchema>;

export const Rooms: React.FC = () => {
  const { hasAuthority } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [keyword, setKeyword] = useState('');
  const [filterFloor, setFilterFloor] = useState<string>('');
  const [filterCapacity, setFilterCapacity] = useState<string>('');
  const [activeModal, setActiveModal] = useState<'create' | 'edit' | 'overlap' | 'assign' | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [alternativeRooms, setAlternativeRooms] = useState<any[]>([]);

  // 1. Fetch Rooms list
  const { data: roomsData, isLoading: isRoomsLoading } = useQuery({
    queryKey: ['rooms', 'list', keyword, filterFloor, filterCapacity],
    queryFn: async () => {
      let url = '/room/all?page=0&size=20';
      if (keyword) {
        url = `/room/search?keyword=${encodeURIComponent(keyword)}&page=0&size=20`;
      } else if (filterFloor || filterCapacity) {
        url = `/room/filter?page=0&size=20`;
        if (filterFloor) url += `&floorNumber=${filterFloor}`;
        if (filterCapacity) url += `&capacity=${filterCapacity}`;
      }
      const response = await apiClient.get(url);
      return response.data?.data?.content || [];
    }
  });

  // 2. Fetch Buildings for select menus
  const { data: buildings } = useQuery({
    queryKey: ['buildings', 'list'],
    queryFn: async () => {
      const response = await apiClient.get('/building/all?page=0&size=100');
      return response.data?.data?.content || [];
    }
  });

  // 3. Fetch Equipments for assignment
  const { data: equipmentsList } = useQuery({
    queryKey: ['equipments', 'list'],
    queryFn: async () => {
      const response = await apiClient.get('/equipment/all?page=0&size=100');
      return response.data?.data?.content || [];
    }
  });

  // React Hook Form for Room creation/updates
  const { 
    register: roomRegister, 
    handleSubmit: handleRoomSubmit, 
    reset: resetRoomForm, 
    control,
    formState: { errors: roomErrors } 
  } = useForm<RoomFormValues>({
    resolver: zodResolver(roomSchema) as any,
    defaultValues: { equipments: [] }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'equipments'
  });

  // React Hook Form for check overlap
  const {
    register: overlapRegister,
    handleSubmit: handleOverlapSubmit,
    formState: { errors: overlapErrors }
  } = useForm<OverlapFormValues>({
    resolver: zodResolver(overlapSchema)
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
      // API expects roomName, capacity, floorNumber, description
      await apiClient.patch(`/room/${id}`, {
        roomName: data.roomName,
        capacity: data.capacity,
        floorNumber: data.floorNumber,
        description: data.description
      });
      // If equipments are passed, assign them to room
      if (data.equipments && data.equipments.length > 0) {
        await apiClient.post(`/room/${id}/equipment`, data.equipments);
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
      await apiClient.delete(`/room/soft/${id}`); // soft delete
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

  // CHECK OVERLAP MUTATION
  const checkOverlapMutation = useMutation({
    mutationFn: async ({ roomId, data }: { roomId: number; data: OverlapFormValues }) => {
      // Backend expects start and end as OffsetDateTime (e.g. yyyy-MM-dd HH:mm:ssXXX)
      // Convert HTML datetime-local format to ISO standard string
      const startTime = new Date(data.start).toISOString();
      const endTime = new Date(data.end).toISOString();
      
      const response = await apiClient.get(`/room/not-overlap/${roomId}`, {
        data: { start: startTime, end: endTime } // get alternative non-overlapping rooms
      });
      return response.data?.data?.content || [];
    },
    onSuccess: (data) => {
      setAlternativeRooms(data);
      showToast('Đã tìm kiếm các phòng trống khác thành công', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi kiểm tra trùng lịch';
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
      equipments: room.equipments?.map((eq: any) => ({
        equipmentId: eq.id || eq.equipmentId,
        quantity: eq.quantity || eq.usingQuantity || 1
      })) || []
    });
    setActiveModal('edit');
  };

  const handleOverlapClick = (room: any) => {
    setSelectedRoom(room);
    setAlternativeRooms([]);
    setActiveModal('overlap');
  };

  const onSaveRoom = (data: RoomFormValues) => {
    if (activeModal === 'create') {
      createRoomMutation.mutate(data);
    } else if (activeModal === 'edit' && selectedRoom) {
      updateRoomMutation.mutate({ id: selectedRoom.id, data });
    }
  };

  const onCheckOverlap = (data: OverlapFormValues) => {
    if (selectedRoom) {
      checkOverlapMutation.mutate({ roomId: selectedRoom.id, data });
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa phòng họp "${name}"?`)) {
      deleteRoomMutation.mutate(id);
    }
  };

  const isAdmin = hasAuthority('ROOM:CREATE');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
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
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        <div style={{ width: '150px' }}>
          <select 
            className="form-control" 
            style={{ width: '100%', appearance: 'none' }}
            value={filterFloor}
            onChange={(e) => setFilterFloor(e.target.value)}
          >
            <option value="">-- Lọc tầng --</option>
            <option value="0">Tầng Trệt</option>
            <option value="1">Tầng 1</option>
            <option value="2">Tầng 2</option>
            <option value="3">Tầng 3</option>
            <option value="4">Tầng 4</option>
            <option value="5">Tầng 5</option>
          </select>
        </div>

        <div style={{ width: '180px' }}>
          <select 
            className="form-control" 
            style={{ width: '100%', appearance: 'none' }}
            value={filterCapacity}
            onChange={(e) => setFilterCapacity(e.target.value)}
          >
            <option value="">-- Sức chứa --</option>
            <option value="5">Tối thiểu 5 người</option>
            <option value="10">Tối thiểu 10 người</option>
            <option value="20">Tối thiểu 20 người</option>
            <option value="50">Tối thiểu 50 người</option>
          </select>
        </div>
      </div>

      {/* Grid listing */}
      {isRoomsLoading ? (
        <div className="grid-cols-3">
          <div className="skeleton" style={{ height: '220px' }} />
          <div className="skeleton" style={{ height: '220px' }} />
          <div className="skeleton" style={{ height: '220px' }} />
        </div>
      ) : roomsData?.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          Không tìm thấy phòng họp nào khớp với bộ lọc của bạn.
        </div>
      ) : (
        <div className="grid-cols-3">
          {roomsData?.map((room: any) => (
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
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  borderTop: '1px solid var(--border-light)', 
                  paddingTop: '0.75rem',
                  marginTop: '0.5rem'
                }}
              >
                <button 
                  onClick={() => handleOverlapClick(room)}
                  className="btn btn-ghost" 
                  style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', color: 'var(--accent)' }}
                >
                  <Activity size={14} /> Kiểm tra trống
                </button>

                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {isAdmin && (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE & EDIT MODAL */}
      {(activeModal === 'create' || activeModal === 'edit') && (
        <div className="modal-overlay">
          <form onSubmit={handleRoomSubmit(onSaveRoom)} className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                {activeModal === 'create' ? 'Thành lập phòng họp mới' : 'Chỉnh sửa phòng họp'}
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
                    {...roomRegister('capacity')}
                  />
                  {roomErrors.capacity && <span className="form-error">{roomErrors.capacity.message}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="room-floor">Ở Tầng số *</label>
                  <input 
                    id="room-floor"
                    type="number" 
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
                    onClick={() => append({ equipmentId: 1, quantity: 1 })}
                  >
                    <ListPlus size={14} /> Thêm thiết bị
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {fields.map((field, index) => (
                    <div key={field.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <select 
                        className="form-control" 
                        style={{ flexGrow: 1 }}
                        {...roomRegister(`equipments.${index}.equipmentId` as const)}
                      >
                        {equipmentsList?.map((eq: any) => (
                          <option key={eq.id} value={eq.id}>{eq.equipmentName}</option>
                        ))}
                      </select>
                      
                      <input 
                        type="number" 
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

      {/* CHECK OVERLAP ALTERNATIVE ROOMS MODAL */}
      {activeModal === 'overlap' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Tra cứu phòng trống song song</h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px', minWidth: 'auto' }} onClick={() => setActiveModal(null)}>
                <XCircle size={20} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '1rem' }}>
                Nếu phòng <strong>{selectedRoom?.roomName}</strong> bị bận trong khoảng thời gian này, hệ thống sẽ tự động lọc ra các phòng trống khác cho bạn.
              </p>

              <form onSubmit={handleOverlapSubmit(onCheckOverlap)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="overlap-start">Giờ Bắt Đầu</label>
                  <input 
                    id="overlap-start"
                    type="datetime-local" 
                    className="form-control" 
                    {...overlapRegister('start')}
                  />
                  {overlapErrors.start && <span className="form-error">{overlapErrors.start.message}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="overlap-end">Giờ Kết Thúc</label>
                  <input 
                    id="overlap-end"
                    type="datetime-local" 
                    className="form-control" 
                    {...overlapRegister('end')}
                  />
                  {overlapErrors.end && <span className="form-error">{overlapErrors.end.message}</span>}
                </div>

                <button type="submit" className="btn btn-primary" disabled={checkOverlapMutation.isPending}>
                  {checkOverlapMutation.isPending ? 'Đang truy vấn...' : 'Truy vấn phòng trống'}
                </button>
              </form>

              {/* Alternative Rooms results */}
              {checkOverlapMutation.isSuccess && (
                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                    Danh sách phòng khả dụng ({alternativeRooms.length})
                  </h4>

                  {alternativeRooms.length === 0 ? (
                    <div style={{ padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', textAlign: 'center' }}>
                      Không tìm thấy phòng nào trống trong khoảng thời gian đã chọn.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                      {alternativeRooms.map((r: any) => (
                        <div 
                          key={r.id}
                          style={{
                            padding: '0.75rem',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--bg-primary)',
                            border: '1px solid var(--border-light)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{r.roomName}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginLeft: '0.5rem' }}>(Tầng {r.floorNumber})</span>
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)' }}>
                            <CheckCircle size={12} style={{ display: 'inline', marginRight: '2px' }} /> Sẵn sàng
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
