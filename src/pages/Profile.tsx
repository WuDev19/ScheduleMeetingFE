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
  Building,
  Trash2,
  Eye,
  EyeOff,
  Lock
} from 'lucide-react';

// Zod schemas
const profileSchema = z.object({
  fullName: z.string().min(1, 'Họ và tên không được để trống'),
  phone: z.string().refine((val) => val === '' || /^(03|05|07|08|09)\d{8}$/.test(val), {
    message: 'Số điện thoại gồm 10 chữ số hợp lệ',
  }),
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
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [emailInput, setEmailInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

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
      // ✅ Backend đã sửa thành @RequestBody nên gửi JSON object
      await apiClient.patch(`/user/${user.id}`, {
        fullName: data.fullName,
        phone: data.phone
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
    mutationFn: async (data: PasswordFormValues) => {
      if (!userDetail?.id) {
        throw new Error('Không thể lấy thông tin người dùng. Vui lòng tải lại trang.');
      }

      // ✅ Backend đã sửa thành @RequestBody nên gửi JSON object
      const response = await apiClient.patch(`/user/${userDetail.id}`, {
        newPassword: data.newPassword
      });
      return response.data;
    },
    onSuccess: () => {
      showToast('Mật khẩu đã được cập nhật thành công', 'success');
      resetPassForm();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Không thể cập nhật mật khẩu';
      showToast(message, 'error');
    }
  });

  // LOCK SELF MUTATION
  const lockSelfMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      await apiClient.patch(`/user/lock/${user.id}`);
    },
    onSuccess: () => {
      showToast('Tài khoản của bạn đã được khóa thành công. Đang đăng xuất...', 'success');
      setTimeout(() => {
        logout();
      }, 1500);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể khóa tài khoản';
      showToast(msg, 'error');
    }
  });

  const handleSelfLock = () => {
    if (window.confirm('Bạn có chắc chắn muốn TẠM KHÓA tài khoản của mình? Bạn sẽ bị đăng xuất ngay lập tức và phải liên hệ Admin để mở khóa lại.')) {
      lockSelfMutation.mutate();
    }
  };

  // UPLOAD AVATAR WORKFLOW
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setIsUploading(true);
    try {
      // Step 1: Request signature
      const signatureResponse = await apiClient.post(`/user/${user.id}/avatar/upload-signature`);
      const { signature, cloud_name, api_key, timestamp, public_id, overwrite } = signatureResponse.data?.data || {};

      if (!signature || !cloud_name || !api_key || !timestamp || !public_id) {
        throw new Error('Không nhận được thông tin chữ ký hợp lệ từ máy chủ');
      }

      // Step 2: Upload directly to Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', api_key);
      formData.append('timestamp', timestamp.toString());
      formData.append('signature', signature);
      formData.append('public_id', public_id);
      formData.append('overwrite', overwrite ? 'true' : 'false');

      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`;
      const uploadResponse = await fetch(cloudinaryUrl, {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error?.message || 'Không thể tải ảnh lên Cloudinary');
      }

      const uploadResult = await uploadResponse.json();
      const realImageUrl = uploadResult.secure_url;

      // Step 3: Update avatar url in backend
      await apiClient.patch(`/user/${user.id}/avatar/upload`, {
        avtUrlId: public_id,
        avtUrl: realImageUrl
      });

      queryClient.invalidateQueries({ queryKey: ['user', 'detail'] });
      showToast('Cập nhật ảnh đại diện thành công', 'success');
    } catch (err: any) {
      showToast(err.message || 'Lỗi tải ảnh đại diện lên', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // DELETE AVATAR MUTATION
  const deleteAvatarMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      await apiClient.delete(`/user/${user.id}/avatar`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'detail'] });
      showToast('Đã xóa ảnh đại diện thành công', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể xóa ảnh đại diện';
      showToast(msg, 'error');
    }
  });

  const handleDeleteAvatar = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa ảnh đại diện?')) {
      deleteAvatarMutation.mutate();
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
              <div
                onClick={() => userDetail?.avatarUrl && setIsLightboxOpen(true)}
                style={{
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
                  overflow: 'hidden',
                  cursor: userDetail?.avatarUrl ? 'pointer' : 'default'
                }}
                title={userDetail?.avatarUrl ? "Xem ảnh chi tiết" : undefined}
              >
                {userDetail?.avatarUrl ? (
                  <img src={userDetail.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  userDetail?.fullName?.substring(0, 2).toUpperCase() || 'US'
                )}
              </div>
              {userDetail?.avatarUrl && (
                <button
                  type="button"
                  onClick={handleDeleteAvatar}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    backgroundColor: 'var(--danger)',
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
                  title="Xóa ảnh đại diện"
                >
                  <Trash2 size={14} />
                </button>
              )}
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
                <div style={{ position: 'relative' }}>
                  <input
                    id="pass-old"
                    type={showOldPassword ? 'text' : 'password'}
                    className="form-control"
                    style={{ width: '100%', paddingRight: '2.5rem' }}
                    placeholder="••••••••"
                    {...passRegister('oldPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                    title={showOldPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {passErrors.oldPassword && <span className="form-error">{passErrors.oldPassword.message}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pass-new">Mật khẩu mới *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="pass-new"
                    type={showNewPassword ? 'text' : 'password'}
                    className="form-control"
                    style={{ width: '100%', paddingRight: '2.5rem' }}
                    placeholder="••••••••"
                    {...passRegister('newPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                    title={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {passErrors.newPassword && <span className="form-error">{passErrors.newPassword.message}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pass-confirm">Xác nhận mật khẩu mới *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="pass-confirm"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="form-control"
                    style={{ width: '100%', paddingRight: '2.5rem' }}
                    placeholder="••••••••"
                    {...passRegister('confirmPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                    title={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {passErrors.confirmPassword && <span className="form-error">{passErrors.confirmPassword.message}</span>}
              </div>

              <button type="submit" className="btn btn-secondary" style={{ width: '100%' }} disabled={changePasswordMutation.isPending}>
                <Key size={16} /> Xác nhận đổi mật khẩu
              </button>
            </form>
          </section>

          {/* Vô hiệu hóa tài khoản */}
          <section className="glass-card" style={{ borderLeft: '4px solid var(--danger)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--danger)' }}>Tạm khóa tài khoản</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem' }}>
              Tạm thời vô hiệu hóa tài khoản hoạt động. Bạn sẽ bị đăng xuất ngay lập tức và cần liên hệ Quản trị viên để mở khóa lại.
            </p>
            <button
              type="button"
              className="btn"
              style={{ width: '100%', backgroundColor: 'var(--danger)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: 'none', padding: '0.6rem', borderRadius: 'var(--radius)' }}
              onClick={handleSelfLock}
              disabled={lockSelfMutation.isPending}
            >
              <Lock size={16} /> {lockSelfMutation.isPending ? 'Đang khóa...' : 'Khóa tài khoản cá nhân'}
            </button>
          </section>
        </div>
      </div>
      {isLightboxOpen && userDetail?.avatarUrl && (
        <div
          className="modal-overlay"
          onClick={() => setIsLightboxOpen(false)}
          style={{
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)'
          }}
        >
          <div
            style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={userDetail.avatarUrl}
              alt="Avatar Full Detail"
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-2xl)',
                border: '4px solid rgba(255, 255, 255, 0.15)',
                objectFit: 'contain'
              }}
            />
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="btn btn-ghost"
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                color: '#fff',
                padding: '4px',
                fontSize: '1.2rem',
                minWidth: 'auto'
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
