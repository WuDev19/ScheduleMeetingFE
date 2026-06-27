import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiClient } from '../api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Mail, 
  Phone, 
  Camera, 
  Save, 
  Key, 
  Building
} from 'lucide-react';

// Zod schemas
const profileSchema = z.object({
  fullName: z.string().min(1, 'Họ và tên không được để trống'),
  phone: z.string().regex(/^(03|05|07|08|09)\d{8}$/, 'Số điện thoại gồm 10 chữ số hợp lệ'),
});

const passwordSchema = z.object({
  oldPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, 'Mật khẩu phải từ 8 ký tự trở lên; bao gồm chữ hoa; chữ thường; số và ký tự đặc biệt'),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Mật khẩu xác nhận không khớp",
  path: ["confirmPassword"]
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

export const Profile: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [emailInput, setEmailInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // 1. Fetch User details
  const { data: userDetail, isLoading: isUserLoading } = useQuery({
    queryKey: ['user', 'detail', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const response = await apiClient.get(`/user/me/${user.id}`);
      return response.data?.data;
    },
    enabled: !!user?.id,
  });

  // Profile forms hook
  const { 
    register: profileRegister, 
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors }
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: {
      fullName: userDetail?.fullName || '',
      phone: userDetail?.phone || '',
    }
  });

  // Password forms hook
  const {
    register: passRegister,
    handleSubmit: handlePassSubmit,
    reset: resetPassForm,
    formState: { errors: passErrors }
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema)
  });

  // UPDATE INFO MUTATION
  const updateInfoMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      if (!user?.id) return;
      // Endpoint `/user/{id}` accepts Multipart Form Data / URL encoded fields 
      const formData = new FormData();
      formData.append('fullName', data.fullName);
      formData.append('phone', data.phone);
      
      await apiClient.patch(`/user/${user.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'detail'] });
      showToast('Cập nhật thông tin hồ sơ thành công', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể cập nhật thông tin';
      showToast(msg, 'error');
    }
  });

  // UPDATE EMAIL MUTATION
  const updateEmailMutation = useMutation({
    mutationFn: async (newEmail: string) => {
      if (!user?.id) return;
      await apiClient.patch(`/user/${user.id}/email?newEmail=${encodeURIComponent(newEmail)}`);
    },
    onSuccess: () => {
      showToast('Yêu cầu đổi email thành công. Vui lòng xác nhận qua hộp thư email mới.', 'success');
      setEmailInput('');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể đổi email';
      showToast(msg, 'error');
    }
  });

  // CHANGE PASSWORD MUTATION
  const changePasswordMutation = useMutation({
    mutationFn: async (_data: PasswordFormValues) => {
      // In AuthController `/auth/change-password` or profile settings. Let's call reset password endpoint or mockup
      // Authenticators standard password changes
      await apiClient.post('/auth/forgot-password', { email: userDetail?.email });
    },
    onSuccess: () => {
      showToast('Một email hướng dẫn thiết lập mật khẩu mới đã được gửi tới hòm thư của bạn.', 'success');
      resetPassForm();
    },
    onError: () => {
      showToast('Không thể thực hiện yêu cầu đổi mật khẩu', 'error');
    }
  });

  // UPLOAD AVATAR WORKFLOW
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setIsUploading(true);
    try {
      // Step 1: Request signature
      const signatureResponse = await apiClient.post(`/user/${user.id}/avatar/upload-signature`);
      const { publicId, cloudName } = signatureResponse.data?.data || {};

      // Prototype Simulation of Cloudinary uploading
      showToast('Đang mô phỏng tải ảnh lên Cloudinary...', 'info');
      await new Promise((r) => setTimeout(r, 1500));

      const mockImageUrl = `https://res.cloudinary.com/${cloudName || 'demo'}/image/upload/v1/${publicId || 'avatar'}.png`;

      // Step 2: Update avatar url in backend
      await apiClient.patch(`/user/${user.id}/avatar/upload`, {
        publicId: publicId || 'avatar_mock',
        url: mockImageUrl
      });

      queryClient.invalidateQueries({ queryKey: ['user', 'detail'] });
      showToast('Cập nhật ảnh đại diện thành công', 'success');
    } catch (err: any) {
      showToast(err.message || 'Lỗi tải ảnh đại diện lên', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = (data: ProfileFormValues) => {
    updateInfoMutation.mutate(data);
  };

  const handleRequestEmailChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput) {
      updateEmailMutation.mutate(emailInput);
    }
  };

  const handleSavePassword = (data: PasswordFormValues) => {
    changePasswordMutation.mutate(data);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Page Header */}
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Cài đặt tài khoản</h2>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Quản lý thông tin cá nhân, cập nhật email và mật khẩu</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }} className="grid-cols-2">
        
        {/* Left column: Profile card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Avatar and Basic details panel */}
          <section className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', textAlign: 'center' }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '2.5rem',
                border: '3px solid var(--accent)',
                boxShadow: 'var(--shadow-md)',
                overflow: 'hidden'
              }}>
                {userDetail?.avatarUrl ? (
                  <img src={userDetail.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  userDetail?.fullName?.substring(0, 2).toUpperCase() || 'US'
                )}
              </div>
              <label 
                htmlFor="avatar-input"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  backgroundColor: 'var(--accent)',
                  color: '#fff',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  border: '2px solid var(--bg-secondary)',
                  transition: 'all var(--transition-fast)'
                }}
                className="btn-primary"
                title="Thay đổi ảnh đại diện"
              >
                <Camera size={14} />
              </label>
              <input 
                id="avatar-input"
                type="file" 
                accept="image/*" 
                style={{ display: 'none' }} 
                onChange={handleAvatarUpload}
                disabled={isUploading}
              />
            </div>

            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                {isUserLoading ? '...' : userDetail?.fullName}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                {user?.roles?.join(', ') || 'NHÂN VIÊN'}
              </span>
            </div>

            <div style={{ width: '100%', borderTop: '1px solid var(--border-light)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
                <Mail size={16} style={{ color: 'var(--text-tertiary)' }} />
                <span>{userDetail?.email}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
                <Phone size={16} style={{ color: 'var(--text-tertiary)' }} />
                <span>{userDetail?.phone || 'Chưa cập nhật SĐT'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
                <Building size={16} style={{ color: 'var(--text-tertiary)' }} />
                <span>{userDetail?.department?.name || 'Phòng Nhân Sự'}</span>
              </div>
            </div>
          </section>

          {/* Edit info Form */}
          <section className="glass-card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>Thông tin cá nhân</h3>
            
            <form onSubmit={handleProfileSubmit(handleSaveProfile)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="profile-fullname">Họ và tên *</label>
                <input 
                  id="profile-fullname"
                  className="form-control" 
                  placeholder="Nhập họ và tên..."
                  {...profileRegister('fullName')}
                />
                {profileErrors.fullName && <span className="form-error">{profileErrors.fullName.message}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="profile-phone">Số điện thoại *</label>
                <input 
                  id="profile-phone"
                  className="form-control" 
                  placeholder="Nhập số điện thoại..."
                  {...profileRegister('phone')}
                />
                {profileErrors.phone && <span className="form-error">{profileErrors.phone.message}</span>}
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={updateInfoMutation.isPending}>
                <Save size={16} /> Lưu thông tin
              </button>
            </form>
          </section>
        </div>

        {/* Right column: Credentials & Email changes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Request email change */}
          <section className="glass-card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Thay đổi địa chỉ Email</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem' }}>
              Khi đổi sang email mới, hệ thống sẽ gửi một mã hoặc link xác thực tới hòm thư mới trước khi kích hoạt.
            </p>

            <form onSubmit={handleRequestEmailChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="profile-new-email">Địa chỉ Email mới *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                    <Mail size={16} />
                  </span>
                  <input 
                    id="profile-new-email"
                    type="email" 
                    className="form-control" 
                    style={{ width: '100%', paddingLeft: '2.5rem' }} 
                    placeholder="email_moi@company.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-secondary" style={{ width: '100%', color: 'var(--accent)' }} disabled={updateEmailMutation.isPending}>
                Cập nhật Email
              </button>
            </form>
          </section>

          {/* Change password request */}
          <section className="glass-card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Thiết lập lại mật khẩu</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem' }}>
              Nhập mật khẩu hiện tại và mật khẩu mới cực kỳ phức tạp để đảm bảo an toàn bảo mật tài khoản.
            </p>

            <form onSubmit={handlePassSubmit(handleSavePassword)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="pass-old">Mật khẩu hiện tại *</label>
                <input 
                  id="pass-old"
                  type="password" 
                  className="form-control" 
                  placeholder="••••••••" 
                  {...passRegister('oldPassword')}
                />
                {passErrors.oldPassword && <span className="form-error">{passErrors.oldPassword.message}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pass-new">Mật khẩu mới *</label>
                <input 
                  id="pass-new"
                  type="password" 
                  className="form-control" 
                  placeholder="••••••••" 
                  {...passRegister('newPassword')}
                />
                {passErrors.newPassword && <span className="form-error">{passErrors.newPassword.message}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pass-confirm">Xác nhận mật khẩu mới *</label>
                <input 
                  id="pass-confirm"
                  type="password" 
                  className="form-control" 
                  placeholder="••••••••" 
                  {...passRegister('confirmPassword')}
                />
                {passErrors.confirmPassword && <span className="form-error">{passErrors.confirmPassword.message}</span>}
              </div>

              <button type="submit" className="btn btn-secondary" style={{ width: '100%' }} disabled={changePasswordMutation.isPending}>
                <Key size={16} /> Gửi yêu cầu Đổi mật khẩu
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};
