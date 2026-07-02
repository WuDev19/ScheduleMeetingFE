import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { apiClient } from '../api/client';
import { useToast } from '../context/ToastContext';
import {
  Building,
  Plus,
  Search,
  Trash2,
  Edit3,
  ChevronLeft,
  ChevronRight,
  X,
  MapPin
} from 'lucide-react';

const buildingSchema = z.object({
  buildingName: z.string().min(1, 'Vui lòng nhập tên tòa nhà'),
  buildingAddress: z.string().min(1, 'Vui lòng nhập địa chỉ tòa nhà'),
});

type BuildingFormValues = z.infer<typeof buildingSchema>;

export const Buildings: React.FC = () => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Search & Pagination States
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);

  // Modal States
  const [activeModal, setActiveModal] = useState<'create' | 'edit' | 'delete' | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);

  // Forms Hook
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors }
  } = useForm<BuildingFormValues>({
    resolver: zodResolver(buildingSchema),
    defaultValues: {
      buildingName: '',
      buildingAddress: ''
    }
  });

  // Fetch Buildings list
  const { data: buildingData, isLoading } = useQuery({
    queryKey: ['buildings', 'search-list', keyword, page],
    queryFn: async () => {
      let response;
      if (keyword.trim() !== '') {
        response = await apiClient.get(
          `/building/search?keyword=${encodeURIComponent(keyword)}&page=${page}&size=${pageSize}`
        );
      } else {
        response = await apiClient.get(`/building/all?page=${page}&size=${pageSize}`);
      }
      return response.data?.data;
    }
  });

  const buildingList = buildingData?.content || [];
  const totalPages = buildingData?.totalPages || 0;

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: BuildingFormValues) => {
      await apiClient.post('/building', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
      showToast('Tạo tòa nhà thành công', 'success');
      setActiveModal(null);
      reset();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể tạo tòa nhà';
      showToast(msg, 'error');
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: BuildingFormValues) => {
      if (!selectedBuilding?.id) return;
      await apiClient.patch(`/building/${selectedBuilding.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
      showToast('Cập nhật tòa nhà thành công', 'success');
      setActiveModal(null);
      setSelectedBuilding(null);
      reset();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể cập nhật tòa nhà';
      showToast(msg, 'error');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/building/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
      showToast('Xóa tòa nhà thành công', 'success');
      setActiveModal(null);
      setSelectedBuilding(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể xóa tòa nhà. Có thể có phòng thuộc tòa nhà này.';
      showToast(msg, 'error');
    }
  });

  const handleEditClick = (building: any) => {
    setSelectedBuilding(building);
    setValue('buildingName', building.buildingName);
    setValue('buildingAddress', building.buildingAddress);
    setActiveModal('edit');
  };

  const handleDeleteClick = (building: any) => {
    setSelectedBuilding(building);
    setActiveModal('delete');
  };

  const handleCreateClick = () => {
    reset({ buildingName: '', buildingAddress: '' });
    setActiveModal('create');
  };

  const onSubmit = (data: BuildingFormValues) => {
    if (activeModal === 'create') {
      createMutation.mutate(data);
    } else if (activeModal === 'edit') {
      updateMutation.mutate(data);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Quản Lý Tòa Nhà</h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>Xem và quản lý thông tin các tòa nhà thuộc hệ thống</p>
        </div>
        <button
          onClick={handleCreateClick}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '38px' }}
        >
          <Plus size={16} /> Thêm tòa nhà mới
        </button>
      </div>

      {/* Search Toolbar */}
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem' }}>
        <div style={{ position: 'relative', flexGrow: 1, maxWidth: '400px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
            <Search size={16} />
          </span>
          <input
            type="text"
            className="form-control"
            style={{ width: '100%', paddingLeft: '2.5rem' }}
            placeholder="Tìm theo tên tòa nhà..."
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(0);
            }}
          />
        </div>
      </div>

      {/* Table section */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <div className="spinner" style={{ width: '24px', height: '24px', margin: '0 auto 10px auto', border: '3px solid var(--border-light)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            Đang tải dữ liệu tòa nhà...
          </div>
        ) : buildingList.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-tertiary)' }}>
            Không tìm thấy tòa nhà nào.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left', backgroundColor: 'rgba(0,0,0,0.01)' }}>
                  <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>Mã</th>
                  <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>Tên Tòa Nhà</th>
                  <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>Địa Chỉ</th>
                  <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-tertiary)', textAlign: 'right' }}>Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {buildingList.map((b: any) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--border-light)' }} className="table-row-hover">
                    <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 600 }}>#{b.id}</td>
                    <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Building size={16} />
                        {b.buildingName}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <MapPin size={14} style={{ color: 'var(--text-tertiary)' }} />
                        {b.buildingAddress}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleEditClick(b)}
                          className="btn btn-ghost"
                          style={{ padding: '6px 10px', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Edit3 size={12} /> Sửa
                        </button>
                        <button
                          onClick={() => handleDeleteClick(b)}
                          className="btn btn-ghost"
                          style={{ padding: '6px 10px', fontSize: '0.75rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Trash2 size={12} /> Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button
            disabled={page === 0}
            onClick={() => setPage(prev => prev - 1)}
            className="btn btn-ghost"
            style={{ padding: '6px 12px' }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Trang {page + 1} / {totalPages}
          </span>
          <button
            disabled={page === totalPages - 1}
            onClick={() => setPage(prev => prev + 1)}
            className="btn btn-ghost"
            style={{ padding: '6px 12px' }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Create & Edit Modal */}
      {(activeModal === 'create' || activeModal === 'edit') && (
        <div className="modal-overlay">
          <form onSubmit={handleSubmit(onSubmit)} className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{activeModal === 'create' ? 'Thêm Tòa Nhà Mới' : 'Cập Nhật Tòa Nhà'}</h3>
              <button type="button" className="btn-close" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label className="form-label" htmlFor="buildingName">Tên tòa nhà *</label>
                <input
                  id="buildingName"
                  type="text"
                  className="form-control"
                  placeholder="Ví dụ: Tòa nhà A"
                  {...register('buildingName')}
                />
                {errors.buildingName && <span className="form-error">{errors.buildingName.message}</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label className="form-label" htmlFor="buildingAddress">Địa chỉ *</label>
                <input
                  id="buildingAddress"
                  type="text"
                  className="form-control"
                  placeholder="Ví dụ: Khu Công nghệ cao Hòa Lạc"
                  {...register('buildingAddress')}
                />
                {errors.buildingAddress && <span className="form-error">{errors.buildingAddress.message}</span>}
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setActiveModal(null)}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? 'Đang lưu...' : 'Lưu lại'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {activeModal === 'delete' && selectedBuilding && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, color: 'var(--danger)' }}>Xác Nhận Xóa</h3>
              <button type="button" className="btn-close" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              Bạn có chắc chắn muốn xóa tòa nhà <strong>{selectedBuilding.buildingName}</strong>? Hành động này không thể hoàn tác và chỉ có thể thực hiện nếu không có phòng họp nào đang thuộc tòa nhà này.
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setActiveModal(null)}>Hủy</button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ border: 'none' }}
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(selectedBuilding.id)}
              >
                {deleteMutation.isPending ? 'Đang xóa...' : 'Đồng ý xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
