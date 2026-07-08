import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiClient } from '../api/client';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Search,
  Mail,
  Phone,
  Lock,
  Unlock,
  Trash2,
  Plus,
  Edit3,
  XCircle,
  Building,
  Eye,
  EyeOff
} from 'lucide-react';

// Create Form Schema
const createUserSchema = z.object({
  username: z.string().min(3, 'Tên đăng nhập tối thiểu 3 kí tự').max(50, 'Tối đa 50 kí tự'),
  email: z.string().email('Email không hợp lệ'),
  password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, 'Mật khẩu tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt'),
  fullName: z.string().min(1, 'Họ và tên không được để trống'),
  phone: z.string().regex(/^(03|05|07|08|09)\d{8}$/, 'Số điện thoại gồm 10 chữ số hợp lệ'),
  role: z.string().min(1, 'Vui lòng chọn vai trò'),
  departmentId: z.coerce.number().min(1, 'Vui lòng chọn phòng ban')
});

// Update Form Schema
const updateUserSchema = z.object({
  fullName: z.string().min(1, 'Họ và tên không được để trống'),
  phone: z.string().refine((val) => val === '' || /^(03|05|07|08|09)\d{8}$/.test(val), {
    message: 'Số điện thoại gồm 10 chữ số hợp lệ',
  }),
  newPassword: z.string().optional().or(z.literal('')),
  departmentId: z.coerce.number().min(1, 'Vui lòng chọn phòng ban')
});

// Department Form Schema
const departmentSchema = z.object({
  departmentName: z.string().min(1, 'Tên phòng ban không được để trống').max(100, 'Tối đa 100 ký tự'),
  departmentCode: z.string().min(1, 'Mã phòng ban không được để trống').max(20, 'Tối đa 20 ký tự'),
  description: z.string().optional().or(z.literal(''))
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;
type UpdateUserFormValues = z.infer<typeof updateUserSchema>;
type DepartmentFormValues = z.infer<typeof departmentSchema>;

export const Users: React.FC = () => {
  const { hasAuthority, hasRole } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();



  const [activeTab, setActiveTab] = useState<'users' | 'departments'>('users');
  const [keyword, setKeyword] = useState('');
  const [activeModal, setActiveModal] = useState<'create' | 'edit' | 'create-dept' | 'edit-dept' | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedDept, setSelectedDept] = useState<any>(null);

  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const handleCloseModal = () => {
    setActiveModal(null);
    setSelectedUser(null);
    setSelectedDept(null);
  };

  const [deptKeyword, setDeptKeyword] = useState('');
  const [deptPage, setDeptPage] = useState(0);
  const [deptPageSize] = useState(6);

  // 1. Query Departments (for dropdown selection)
  const { data: departments } = useQuery({
    queryKey: ['departments', 'list-all'],
    queryFn: async () => {
      const response = await apiClient.get('/department/all?page=0&size=100');
      return response.data?.data?.content || [];
    }
  });

  // Query Departments with pagination and keyword search for the Departments tab list
  const { data: deptData, isLoading: isDeptLoading } = useQuery({
    queryKey: ['departments', 'search', deptKeyword, deptPage],
    queryFn: async () => {
      const response = await apiClient.get(`/department/all?keyword=${encodeURIComponent(deptKeyword)}&page=${deptPage}&size=${deptPageSize}`);
      return response.data?.data;
    }
  });

  const deptList = deptData?.content || [];
  const deptTotalPages = deptData?.totalPages || 0;

  // 2. Query Users
  const { data: usersList, isLoading: isUsersLoading } = useQuery({
    queryKey: ['users', 'search', keyword],
    queryFn: async () => {
      const response = await apiClient.get(`/user/search?keyword=${encodeURIComponent(keyword)}&page=0&size=50`);
      return response.data?.data?.content || [];
    }
  });

  // Forms hooks
  const {
    register: createRegister,
    handleSubmit: handleCreateSubmit,
    reset: resetCreateForm,
    formState: { errors: createErrors }
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema) as any
  });

  const {
    register: updateRegister,
    handleSubmit: handleUpdateSubmit,
    reset: resetUpdateForm,
    formState: { errors: updateErrors }
  } = useForm<UpdateUserFormValues>({
    resolver: zodResolver(updateUserSchema) as any,
    values: selectedUser ? {
      fullName: selectedUser.fullName || '',
      phone: selectedUser.phone || '',
      departmentId: selectedUser.department?.id || 0,
      newPassword: ''
    } : undefined
  });

  const {
    register: createDeptRegister,
    handleSubmit: handleCreateDeptSubmit,
    reset: resetCreateDept,
    formState: { errors: createDeptErrors }
  } = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema) as any
  });

  const {
    register: updateDeptRegister,
    handleSubmit: handleUpdateDeptSubmit,
    reset: resetUpdateDept,
    formState: { errors: updateDeptErrors }
  } = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema) as any,
    values: selectedDept ? {
      departmentName: selectedDept.name || '',
      departmentCode: selectedDept.code || '',
      description: selectedDept.description || ''
    } : undefined
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: CreateUserFormValues) => {
      await apiClient.post('/user', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast('Tạo tài khoản nhân viên thành công', 'success');
      setActiveModal(null);
      resetCreateForm();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể tạo tài khoản';
      showToast(msg, 'error');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateUserFormValues) => {
      if (!selectedUser?.id) return;
      // ✅ Backend đã sửa thành @RequestBody nên gửi JSON object
      await apiClient.patch(`/user/${selectedUser.id}`, {
        fullName: data.fullName,
        phone: data.phone,
        departmentId: data.departmentId,
        ...(data.newPassword && { newPassword: data.newPassword })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast('Cập nhật tài khoản thành công', 'success');
      setActiveModal(null);
      resetUpdateForm();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể cập nhật tài khoản';
      showToast(msg, 'error');
    }
  });



  const createDeptMutation = useMutation({
    mutationFn: async (data: DepartmentFormValues) => {
      await apiClient.post('/department', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      showToast('Tạo phòng ban thành công', 'success');
      setActiveModal(null);
      resetCreateDept();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể tạo phòng ban';
      showToast(msg, 'error');
    }
  });

  const updateDeptMutation = useMutation({
    mutationFn: async (data: DepartmentFormValues) => {
      if (!selectedDept?.id) return;
      await apiClient.patch(`/department/${selectedDept.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      showToast('Cập nhật phòng ban thành công', 'success');
      setActiveModal(null);
      resetUpdateDept();
      setSelectedDept(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể cập nhật phòng ban';
      showToast(msg, 'error');
    }
  });

  const deleteDeptMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/department/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      showToast('Đã xóa phòng ban thành công', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể xóa phòng ban. Có thể có nhân viên đang thuộc phòng này.';
      showToast(msg, 'error');
    }
  });

  const importDeptMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      await apiClient.post('/department/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      showToast('Nhập dữ liệu phòng ban từ Excel thành công!', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Lỗi khi nhập tệp Excel';
      showToast(msg, 'error');
    }
  });

  const lockMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.patch(`/user/lock/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast('Đã tạm khóa tài khoản', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể khóa tài khoản';
      showToast(msg, 'error');
    }
  });

  const unlockMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.patch(`/user/unlock/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast('Đã khôi phục tài khoản hoạt động', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể mở khóa tài khoản';
      showToast(msg, 'error');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/user/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast('Đã xóa vĩnh viễn tài khoản thành công', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể xóa vĩnh viễn tài khoản';
      showToast(msg, 'error');
    }
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/user/${id}/avatar`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast('Đã xóa ảnh đại diện thành công', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể xóa ảnh đại diện';
      showToast(msg, 'error');
    }
  });

  // Event handlers
  const handleLock = (id: number) => {
    if (window.confirm('Bạn có chắc chắn muốn khóa tài khoản này?')) {
      lockMutation.mutate(id);
    }
  };

  const handleUnlock = (id: number) => {
    if (window.confirm('Bạn có chắc chắn muốn khôi phục tài khoản này?')) {
      unlockMutation.mutate(id);
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm('CẢNH BÁO: Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản này? Hành động này không thể hoàn tác!')) {
      deleteMutation.mutate(id);
    }
  };

  const handleDeleteAvatar = (id: number) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa ảnh đại diện của tài khoản này?')) {
      deleteAvatarMutation.mutate(id);
    }
  };

  const openEditModal = (user: any) => {
    setSelectedUser(user);
    resetUpdateForm({
      fullName: user.fullName,
      phone: user.phone,
      departmentId: user.department?.id || 0,
      newPassword: ''
    });
    setActiveModal('edit');
  };

  const handleDeleteDept = (id: number) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa phòng ban này?')) {
      deleteDeptMutation.mutate(id);
    }
  };

  const openEditDeptModal = (dept: any) => {
    setSelectedDept(dept);
    resetUpdateDept({
      departmentName: dept.name,
      departmentCode: dept.code,
      description: dept.description || ''
    });
    setActiveModal('edit-dept');
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importDeptMutation.mutate(file);
      e.target.value = '';
    }
  };

  const isAdmin = hasAuthority('USER:CREATE');
  const canUpdate = hasAuthority('USER:UPDATE');
  const canLock = hasAuthority('USER:LOCK');
  const canUnlock = hasAuthority('USER:UNLOCK');
  const canDelete = hasAuthority('USER:DELETE');

  if (!hasRole('ADMIN')) {
    return <Navigate to="/" replace />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Quản lý Nhân Viên & Phòng Ban</h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Quản lý tài khoản thành viên và thiết lập sơ đồ phòng ban công ty</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {activeTab === 'users' && isAdmin && (
            <button
              className="btn btn-primary"
              onClick={() => {
                resetCreateForm();
                setActiveModal('create');
              }}
            >
              <Plus size={16} /> Thêm nhân viên
            </button>
          )}

          {activeTab === 'departments' && isAdmin && (
            <>
              <label
                className="btn btn-secondary"
                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 12px' }}
                title="Nhập danh sách phòng ban từ tệp Excel"
              >
                <Building size={14} /> Nhập Excel
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  style={{ display: 'none' }}
                  onChange={handleImportExcel}
                />
              </label>
              <button
                className="btn btn-primary"
                onClick={() => {
                  resetCreateDept();
                  setActiveModal('create-dept');
                }}
              >
                <Plus size={16} /> Thêm phòng ban
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '2px' }}>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '8px 16px',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: 'none',
            background: 'none',
            color: activeTab === 'users' ? 'var(--accent)' : 'var(--text-tertiary)',
            borderBottom: activeTab === 'users' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          Danh sách Nhân viên
        </button>
        <button
          onClick={() => setActiveTab('departments')}
          style={{
            padding: '8px 16px',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: 'none',
            background: 'none',
            color: activeTab === 'departments' ? 'var(--accent)' : 'var(--text-tertiary)',
            borderBottom: activeTab === 'departments' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          Danh sách Phòng ban
        </button>
      </div>

      {activeTab === 'users' && (
        <>
          {/* Filter and View toolbar */}
          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem' }}>
            <div style={{ position: 'relative', flexGrow: 1, maxWidth: '400px' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                <Search size={16} />
              </span>
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: '36px', fontSize: '0.85rem' }}
                placeholder="Tìm kiếm theo tên, tài khoản hoặc email..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
          </div>

          {/* Users Grid */}
          {isUsersLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
              <div className="skeleton" style={{ height: '180px', borderRadius: 'var(--radius-lg)' }} />
              <div className="skeleton" style={{ height: '180px', borderRadius: 'var(--radius-lg)' }} />
              <div className="skeleton" style={{ height: '180px', borderRadius: 'var(--radius-lg)' }} />
            </div>
          ) : usersList?.length === 0 ? (
            <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              Không tìm thấy tài khoản nhân viên nào khớp với từ khóa tìm kiếm.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
              {usersList.map((item: any) => (
                <div
                  key={item.id}
                  className="glass-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    borderLeft: `4px solid ${item.isActive ? 'var(--success)' : 'var(--danger)'}`,
                    position: 'relative'
                  }}
                >
                  {/* User basic info */}
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                      <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '1.25rem',
                        border: '2px solid var(--border-light)',
                        overflow: 'hidden'
                      }}>
                        {item.avatarUrl ? (
                          <img src={item.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          item.fullName?.substring(0, 2).toUpperCase() || 'US'
                        )}
                      </div>
                      {item.avatarUrl && canUpdate && (
                        <button
                          onClick={() => handleDeleteAvatar(item.id)}
                          style={{
                            position: 'absolute',
                            top: '-4px',
                            right: '-4px',
                            backgroundColor: 'var(--danger)',
                            color: '#fff',
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid var(--bg-secondary)',
                            cursor: 'pointer'
                          }}
                          title="Xóa ảnh đại diện"
                        >
                          <XCircle size={10} />
                        </button>
                      )}
                    </div>

                    <div style={{ minWidth: 0, flexGrow: 1 }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {item.fullName}
                      </h4>
                      <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                        @{item.username}
                      </p>
                      {item.department && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 600, marginTop: '4px', backgroundColor: 'var(--accent-light)', padding: '2px 6px', borderRadius: '4px' }}>
                          <Building size={10} /> {item.department.name}
                        </span>
                      )}
                    </div>

                    <span className={`badge badge-${item.isActive ? 'approved' : 'rejected'}`} style={{ alignSelf: 'flex-start' }}>
                      {item.isActive ? 'Hoạt động' : 'Tạm khóa'}
                    </span>
                  </div>

                  {/* User contact detail fields */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Mail size={14} style={{ color: 'var(--text-tertiary)' }} />
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.email}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Phone size={14} style={{ color: 'var(--text-tertiary)' }} />
                      <span>{item.phone || '(Chưa cập nhật SĐT)'}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {(canUpdate || canLock || canUnlock || canDelete) && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
                      {canUpdate && (
                        <button
                          className="btn btn-ghost"
                          style={{ flexGrow: 1, padding: '6px', fontSize: '0.78rem', gap: '4px' }}
                          onClick={() => openEditModal(item)}
                        >
                          <Edit3 size={14} /> Sửa
                        </button>
                      )}
                      {item.isActive ? (
                        canLock && (
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '6px', minWidth: 'auto', color: 'var(--warning)' }}
                            onClick={() => handleLock(item.id)}
                            title="Khóa tài khoản"
                          >
                            <Lock size={14} />
                          </button>
                        )
                      ) : (
                        canUnlock && (
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '6px', minWidth: 'auto', color: 'var(--success)' }}
                            onClick={() => handleUnlock(item.id)}
                            title="Khôi phục tài khoản"
                          >
                            <Unlock size={14} />
                          </button>
                        )
                      )}
                      {canDelete && (
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '6px', minWidth: 'auto', color: 'var(--danger)' }}
                          onClick={() => handleDelete(item.id)}
                          title="Xóa vĩnh viễn"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'departments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Search toolbar */}
          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem' }}>
            <div style={{ position: 'relative', flexGrow: 1, maxWidth: '400px' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                <Search size={16} />
              </span>
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: '36px', fontSize: '0.85rem' }}
                placeholder="Tìm kiếm theo tên hoặc mã phòng ban..."
                value={deptKeyword}
                onChange={(e) => {
                  setDeptKeyword(e.target.value);
                  setDeptPage(0);
                }}
              />
            </div>
          </div>

          {isDeptLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              <div className="skeleton" style={{ height: '150px', borderRadius: 'var(--radius-lg)' }} />
              <div className="skeleton" style={{ height: '150px', borderRadius: 'var(--radius-lg)' }} />
              <div className="skeleton" style={{ height: '150px', borderRadius: 'var(--radius-lg)' }} />
            </div>
          ) : deptList.length === 0 ? (
            <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              {deptKeyword ? 'Không tìm thấy phòng ban nào khớp với từ khóa tìm kiếm.' : 'Chưa có phòng ban nào trong hệ thống. Hãy bấm nút "Thêm phòng ban" hoặc nhập từ Excel để bắt đầu.'}
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {deptList.map((dept: any) => (
                  <div
                    key={dept.id}
                    className="glass-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      borderLeft: '4px solid var(--accent)',
                      padding: '1.25rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', backgroundColor: 'var(--accent-light)', padding: '2px 6px', borderRadius: '4px' }}>
                          {dept.code}
                        </span>
                      </div>
                      <h3 style={{ margin: '8px 0 4px', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {dept.name}
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-tertiary)', minHeight: '40px' }}>
                        {dept.description || '(Không có mô tả)'}
                      </p>
                    </div>

                    {isAdmin && (
                      <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
                        <button
                          className="btn btn-ghost"
                          style={{ flexGrow: 1, padding: '6px', fontSize: '0.78rem', gap: '4px' }}
                          onClick={() => openEditDeptModal(dept)}
                        >
                          <Edit3 size={14} /> Sửa
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '6px', minWidth: 'auto', color: 'var(--danger)' }}
                          onClick={() => handleDeleteDept(dept.id)}
                          title="Xóa phòng ban"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {deptTotalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
                  <button
                    className="btn btn-secondary"
                    disabled={deptPage === 0}
                    onClick={() => setDeptPage((prev) => Math.max(0, prev - 1))}
                    style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                  >
                    Trước
                  </button>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Trang {deptPage + 1} / {deptTotalPages}
                  </span>
                  <button
                    className="btn btn-secondary"
                    disabled={deptPage >= deptTotalPages - 1}
                    onClick={() => setDeptPage((prev) => Math.min(deptTotalPages - 1, prev + 1))}
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

      {/* CREATE USER MODAL */}
      {activeModal === 'create' && (
        <div className="modal-overlay">
          <form onSubmit={handleCreateSubmit((data: any) => createMutation.mutate(data))} className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Tạo tài khoản nhân viên</h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px', minWidth: 'auto' }} onClick={() => setActiveModal(null)}>
                <XCircle size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="user-username">Tên đăng nhập *</label>
                  <input
                    id="user-username"
                    className="form-control"
                    placeholder="VD: nguyenvanan"
                    {...createRegister('username')}
                  />
                  {createErrors.username && <span className="form-error">{createErrors.username.message}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="user-email">Địa chỉ Email *</label>
                  <input
                    id="user-email"
                    type="email"
                    className="form-control"
                    placeholder="VD: an.nv@company.com"
                    {...createRegister('email')}
                  />
                  {createErrors.email && <span className="form-error">{createErrors.email.message}</span>}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="user-pass">Mật khẩu ban đầu *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="user-pass"
                    type={showCreatePassword ? 'text' : 'password'}
                    className="form-control"
                    style={{ width: '100%', paddingRight: '2.5rem' }}
                    placeholder="Nhập mật khẩu an toàn..."
                    {...createRegister('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                    title={showCreatePassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showCreatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {createErrors.password && <span className="form-error">{createErrors.password.message}</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="user-fullname">Họ và tên *</label>
                  <input
                    id="user-fullname"
                    className="form-control"
                    placeholder="VD: Nguyễn Văn An"
                    {...createRegister('fullName')}
                  />
                  {createErrors.fullName && <span className="form-error">{createErrors.fullName.message}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="user-phone">Số điện thoại *</label>
                  <input
                    id="user-phone"
                    className="form-control"
                    placeholder="VD: 0912345678"
                    {...createRegister('phone')}
                  />
                  {createErrors.phone && <span className="form-error">{createErrors.phone.message}</span>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="user-role">Vai trò *</label>
                  <select id="user-role" className="form-control" {...createRegister('role')}>
                    <option value="">-- Chọn vai trò --</option>
                    <option value="REGISTER">Nhân viên (REGISTER)</option>
                    <option value="APPROVER">Quản lý duyệt phòng (APPROVER)</option>
                    <option value="ADMIN">Quản trị viên (ADMIN)</option>
                  </select>
                  {createErrors.role && <span className="form-error">{createErrors.role.message}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="user-dept">Phòng ban *</label>
                  <select id="user-dept" className="form-control" {...createRegister('departmentId')}>
                    <option value="">-- Chọn phòng ban --</option>
                    {departments?.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  {createErrors.departmentId && <span className="form-error">{createErrors.departmentId.message}</span>}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Đang tạo...' : 'Tạo tài khoản'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT USER PROFILE MODAL */}
      {activeModal === 'edit' && selectedUser && (
        <div className="modal-overlay">
          <form onSubmit={handleUpdateSubmit((data: any) => updateMutation.mutate(data))} className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Cập nhật tài khoản: @{selectedUser.username}</h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px', minWidth: 'auto' }} onClick={() => setActiveModal(null)}>
                <XCircle size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-fullname">Họ và tên *</label>
                <input
                  id="edit-fullname"
                  className="form-control"
                  {...updateRegister('fullName')}
                />
                {updateErrors.fullName && <span className="form-error">{updateErrors.fullName.message}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-phone">Số điện thoại *</label>
                <input
                  id="edit-phone"
                  className="form-control"
                  {...updateRegister('phone')}
                />
                {updateErrors.phone && <span className="form-error">{updateErrors.phone.message}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-dept">Phòng ban *</label>
                <select id="edit-dept" className="form-control" {...updateRegister('departmentId')}>
                  <option value="">-- Chọn phòng ban --</option>
                  {departments?.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                {updateErrors.departmentId && <span className="form-error">{updateErrors.departmentId.message}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-pass">Mật khẩu mới (Để trống nếu không muốn đổi)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="edit-pass"
                    type={showEditPassword ? 'text' : 'password'}
                    className="form-control"
                    style={{ width: '100%', paddingRight: '2.5rem' }}
                    placeholder="Nhập mật khẩu mới..."
                    {...updateRegister('newPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                    title={showEditPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {updateErrors.newPassword && <span className="form-error">{updateErrors.newPassword.message}</span>}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CREATE DEPARTMENT MODAL */}
      {activeModal === 'create-dept' && (
        <div className="modal-overlay">
          <form onSubmit={handleCreateDeptSubmit((data) => createDeptMutation.mutate(data))} className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Tạo phòng ban mới</h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px', minWidth: 'auto' }} onClick={() => setActiveModal(null)}>
                <XCircle size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="dept-name">Tên phòng ban *</label>
                <input
                  id="dept-name"
                  className="form-control"
                  placeholder="VD: Phòng Phát Triển Phần Mềm"
                  {...createDeptRegister('departmentName')}
                />
                {createDeptErrors.departmentName && <span className="form-error">{createDeptErrors.departmentName.message}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="dept-code">Mã phòng ban *</label>
                <input
                  id="dept-code"
                  className="form-control"
                  placeholder="VD: IT-DEV"
                  {...createDeptRegister('departmentCode')}
                />
                {createDeptErrors.departmentCode && <span className="form-error">{createDeptErrors.departmentCode.message}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="dept-desc">Mô tả chi tiết</label>
                <textarea
                  id="dept-desc"
                  className="form-control"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  placeholder="Nhập mô tả hoạt động hoặc nhiệm vụ..."
                  {...createDeptRegister('description')}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={createDeptMutation.isPending}>
                {createDeptMutation.isPending ? 'Đang tạo...' : 'Tạo phòng ban'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT DEPARTMENT MODAL */}
      {activeModal === 'edit-dept' && selectedDept && (
        <div className="modal-overlay">
          <form onSubmit={handleUpdateDeptSubmit((data) => updateDeptMutation.mutate(data))} className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Cập nhật phòng ban: {selectedDept.departmentCode}</h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px', minWidth: 'auto' }} onClick={handleCloseModal}>
                <XCircle size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-dept-name">Tên phòng ban *</label>
                <input
                  id="edit-dept-name"
                  className="form-control"
                  {...updateDeptRegister('departmentName')}
                />
                {updateDeptErrors.departmentName && <span className="form-error">{updateDeptErrors.departmentName.message}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-dept-code">Mã phòng ban *</label>
                <input
                  id="edit-dept-code"
                  className="form-control"
                  {...updateDeptRegister('departmentCode')}
                />
                {updateDeptErrors.departmentCode && <span className="form-error">{updateDeptErrors.departmentCode.message}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-dept-desc">Mô tả chi tiết</label>
                <textarea
                  id="edit-dept-desc"
                  className="form-control"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  {...updateDeptRegister('description')}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={updateDeptMutation.isPending}>
                {updateDeptMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
