import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiClient } from '../api/client';
import { AuthLayout } from '../layouts/AuthLayout';
import { KeyRound, Mail, User as UserIcon, Phone, Eye, EyeOff, Building, Calendar } from 'lucide-react';

// Form validation schemas
const loginSchema = z.object({
  username: z.string().min(1, 'Vui lòng nhập tên đăng nhập'),
  password: z.string().min(8, 'Mật khẩu phải chứa ít nhất 8 ký tự'),
});

const signUpSchema = z.object({
  username: z.string().min(3, 'Tên đăng nhập từ 3 đến 50 ký tự').max(50, 'Tên đăng nhập từ 3 đến 50 ký tự'),
  email: z.string().email('Email không đúng định dạng'),
  fullName: z.string().min(1, 'Vui lòng nhập họ và tên'),
  phone: z.string().regex(/^(03|05|07|08|09)\d{8}$/, 'Số điện thoại gồm 10 chữ số hợp lệ'),
  password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, 'Mật khẩu phải chứa chữ hoa, chữ thường, số và ký tự đặc biệt'),
  passwordConfirm: z.string(),
  role: z.string(),
}).refine((data) => data.password === data.passwordConfirm, {
  message: "Mật khẩu xác nhận không trùng khớp",
  path: ["passwordConfirm"],
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Email không đúng định dạng'),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type SignUpFormValues = z.infer<typeof signUpSchema>;
type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const Auth: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'forgot'>('login');
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [isRegisteredSuccessfully, setIsRegisteredSuccessfully] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleResendEmail = async () => {
    if (!registeredEmail) return;
    setLoading(true);
    try {
      await apiClient.post('/auth/resend-verification', { email: registeredEmail });
      showToast('Đã gửi lại email kích hoạt thành công!', 'success');
      setCooldown(60);
    } catch (error: any) {
      const errMsg = error.response?.data?.message || 'Không thể gửi lại email kích hoạt';
      showToast(errMsg, 'error');
      const match = errMsg.match(/\d+/);
      if (match) {
        setCooldown(parseInt(match[0], 10));
      }
    } finally {
      setLoading(false);
    }
  };

  // Login form hooks
  const {
    register: loginRegister,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  // SignUp form hooks
  const {
    register: signUpRegister,
    handleSubmit: handleSignUpSubmit,
    formState: { errors: signUpErrors }
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { role: 'REGISTER' }
  });

  // Forgot password form hooks
  const {
    register: forgotRegister,
    handleSubmit: handleForgotSubmit,
    formState: { errors: forgotErrors }
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  // Handle Login submission
  const onLogin = async (data: LoginFormValues) => {
    setLoading(true);
    try {
      const response = await apiClient.post('/auth/login', data);
      // Result structure: response.data.data (containing accessToken & refreshToken)
      const authResult = response.data?.data;
      if (authResult?.accessToken) {
        login(authResult.accessToken, authResult.refreshToken || '');
        showToast('Đăng nhập thành công', 'success');
        navigate('/');
      } else {
        showToast('Có lỗi xảy ra, vui lòng thử lại', 'error');
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.message || 'Tên đăng nhập hoặc mật khẩu không chính xác';
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Registration submission
  const onSignUp = async (data: SignUpFormValues) => {
    setLoading(true);
    try {
      await apiClient.post('/auth/sign-up', data);
      showToast('Đăng ký tài khoản thành công! Vui lòng kiểm tra email để kích hoạt.', 'success');
      setRegisteredEmail(data.email);
      setIsRegisteredSuccessfully(true);
      setCooldown(60);
    } catch (error: any) {
      const errMsg = error.response?.data?.message || 'Đăng ký không thành công. Tên đăng nhập hoặc Email có thể đã tồn tại.';
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password submission
  const onForgotPassword = async (data: ForgotPasswordFormValues) => {
    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email: data.email });
      showToast('Đã gửi liên kết khôi phục mật khẩu vào Email của bạn', 'success');
      setActiveTab('login');
    } catch (error: any) {
      const errMsg = error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại';
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <style>{`
        @keyframes slideFromLeft {
          0% {
            opacity: 0;
            transform: translateX(-100vw);
          }
          60% {
            transform: translateX(30px);
          }
          80% {
            transform: translateX(-10px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideFromRight {
          0% {
            opacity: 0;
            transform: translateX(100vw);
          }
          60% {
            transform: translateX(-30px);
          }
          80% {
            transform: translateX(10px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .auth-container {
          display: flex;
          width: 100%;
          max-width: 900px;
          min-height: 580px;
          background: var(--glass-bg);
          backdrop-filter: blur(16px) saturate(180%);
          -webkit-backdrop-filter: blur(16px) saturate(180%);
          border-radius: var(--radius-xl);
          border: 1px solid var(--glass-border);
          box-shadow: var(--shadow-lg);
          overflow: hidden;
        }

        [data-theme="dark"] .auth-container {
          background: rgba(18, 24, 38, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        .auth-left-panel {
          flex: 1;
          background: linear-gradient(135deg, rgba(124, 58, 237, 0.05) 0%, rgba(59, 130, 246, 0.02) 100%);
          border-right: 1px solid var(--border-light);
          padding: 3rem 2.5rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          animation: slideFromLeft 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
          opacity: 0;
        }

        [data-theme="dark"] .auth-left-panel {
          background: linear-gradient(135deg, rgba(30, 27, 75, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%);
          border-right: 1px solid rgba(255, 255, 255, 0.06);
        }

        .auth-right-panel {
          flex: 1.1;
          padding: 3rem 2.5rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          background: transparent;
          animation: slideFromRight 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
          opacity: 0;
        }

        .branding-decor {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at 30% 20%, rgba(124, 58, 237, 0.12) 0%, transparent 50%),
                      radial-gradient(circle at 70% 80%, rgba(59, 130, 246, 0.1) 0%, transparent 50%);
          pointer-events: none;
        }

        .feature-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }

        .feature-icon-wrapper {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--accent-light);
          color: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
          border: 1px solid var(--accent-border);
        }

        @media (max-width: 768px) {
          .auth-left-panel {
            display: none !important;
          }
          .auth-container {
            max-width: 440px;
            min-height: auto;
            background: var(--glass-bg);
            border-radius: var(--radius-lg);
          }
          [data-theme="dark"] .auth-container {
            background: rgba(15, 23, 42, 0.65);
          }
          .auth-right-panel {
            padding: 2.5rem 1.75rem;
            animation: slideFromRight 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
          }
        }
      `}</style>

      <div className="auth-container">
        {/* LEFT PANEL: Branding Banner */}
        <div className="auth-left-panel">
          <div className="branding-decor" />
          
          {/* Logo & App title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', zIndex: 2 }}>
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
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }} className="text-gradient">ScheduleMeeting</h2>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>MEETING SPACE MANAGER</span>
            </div>
          </div>

          {/* Marketing text / Features list */}
          <div style={{ zIndex: 2, margin: '2rem 0' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem', lineHeight: 1.3 }}>
              Hệ thống quản lý phòng họp thông minh thế hệ mới
            </h3>
            
            <div className="feature-item">
              <div className="feature-icon-wrapper">
                <Calendar size={16} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Lịch biểu trực quan</h4>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Theo dõi lịch trống, thông tin phòng họp thời gian thực dễ dàng.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon-wrapper">
                <KeyRound size={16} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Đặt phòng nhanh chóng</h4>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Đăng ký phòng họp và yêu cầu thiết bị bổ sung chỉ trong vài giây.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon-wrapper">
                <Mail size={16} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Thông báo tức thời</h4>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Nhận thông báo xác nhận duyệt hoặc hủy phòng qua Email & Hệ thống.</p>
              </div>
            </div>
          </div>

          {/* Footer copyright */}
          <div style={{ zIndex: 2, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            © {new Date().getFullYear()} ScheduleMeeting. All rights reserved.
          </div>
        </div>

        {/* RIGHT PANEL: Auth form */}
        <div className="auth-right-panel">
          {isRegisteredSuccessfully ? (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}>
                <Mail size={28} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', fontWeight: 700, margin: 0 }}>Kích Hoạt Tài Khoản</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  Một liên kết kích hoạt tài khoản đã được gửi đến địa chỉ email:
                </p>
                <p style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.9rem', marginTop: '0.25rem', wordBreak: 'break-all' }}>
                  {registeredEmail}
                </p>
              </div>

              <div style={{ width: '100%', borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textAlign: 'left', margin: 0 }}>
                  Không nhận được email kích hoạt? Bạn có thể gửi lại yêu cầu sau khi hết thời gian chờ bên dưới.
                </p>

                <button
                  type="button"
                  onClick={handleResendEmail}
                  disabled={loading || cooldown > 0}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.75rem', fontWeight: 600 }}
                >
                  {loading ? 'Đang gửi...' : cooldown > 0 ? `Gửi lại sau (${cooldown}s)` : 'Gửi lại Email kích hoạt'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsRegisteredSuccessfully(false);
                    setActiveTab('login');
                  }}
                  className="btn btn-ghost"
                  style={{ width: '100%', color: 'var(--text-secondary)' }}
                >
                  Quay lại đăng nhập
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Card Header Title */}
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.6rem', color: 'var(--text-primary)', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
                  {activeTab === 'login' && 'Chào Mừng Trở Lại'}
                  {activeTab === 'register' && 'Đăng Ký Tài Khoản'}
                  {activeTab === 'forgot' && 'Quên Mật Khẩu?'}
                </h2>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', marginTop: '0.4rem', marginInline: 0 }}>
                  {activeTab === 'login' && 'Đăng nhập vào hệ thống ScheduleMeeting'}
                  {activeTab === 'register' && 'Tạo tài khoản và bắt đầu đặt phòng ngay'}
                  {activeTab === 'forgot' && 'Nhập Email của bạn để nhận link thiết lập lại mật khẩu'}
                </p>
              </div>

              {/* Tab Headers */}
              {activeTab !== 'forgot' && (
                <div
                  style={{
                    display: 'flex',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.25rem',
                    border: '1px solid var(--border-light)'
                  }}
                >
                  <button
                    className="btn btn-ghost"
                    onClick={() => setActiveTab('login')}
                    style={{
                      flex: 1,
                      fontSize: '0.8rem',
                      padding: '0.5rem',
                      borderRadius: 'calc(var(--radius-md) - 2px)',
                      backgroundColor: activeTab === 'login' ? 'var(--accent)' : 'transparent',
                      color: activeTab === 'login' ? '#ffffff' : 'var(--text-secondary)',
                      fontWeight: activeTab === 'login' ? 600 : 500
                    }}
                  >
                    Đăng nhập
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setActiveTab('register')}
                    style={{
                      flex: 1,
                      fontSize: '0.8rem',
                      padding: '0.5rem',
                      borderRadius: 'calc(var(--radius-md) - 2px)',
                      backgroundColor: activeTab === 'register' ? 'var(--accent)' : 'transparent',
                      color: activeTab === 'register' ? '#ffffff' : 'var(--text-secondary)',
                      fontWeight: activeTab === 'register' ? 600 : 500
                    }}
                  >
                    Đăng ký
                  </button>
                </div>
              )}

              {/* LOGIN FORM */}
              {activeTab === 'login' && (
                <form onSubmit={handleLoginSubmit(onLogin)} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--text-secondary)' }} htmlFor="login-username">Tên đăng nhập</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                        <UserIcon size={16} />
                      </span>
                      <input
                        id="login-username"
                        className="form-control"
                        style={{ width: '100%', paddingLeft: '2.5rem' }}
                        placeholder="Nhập username"
                        {...loginRegister('username')}
                      />
                    </div>
                    {loginErrors.username && <span className="form-error">{loginErrors.username.message}</span>}
                  </div>

                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label" style={{ color: 'var(--text-secondary)' }} htmlFor="login-password">Mật khẩu</label>
                      <button
                        type="button"
                        onClick={() => setActiveTab('forgot')}
                        style={{ border: 'none', background: 'none', color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}
                      >
                        Quên mật khẩu?
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                        <KeyRound size={16} />
                      </span>
                      <input
                        id="login-password"
                        type={showLoginPassword ? 'text' : 'password'}
                        className="form-control"
                        style={{ width: '100%', paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                        placeholder="••••••••"
                        {...loginRegister('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                        title={showLoginPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {loginErrors.password && <span className="form-error">{loginErrors.password.message}</span>}
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                    style={{ width: '100%', padding: '0.75rem', fontWeight: 600, marginTop: '0.5rem' }}
                  >
                    {loading ? 'Đang xác thực...' : 'Đăng Nhập'}
                  </button>
                </form>
              )}

              {/* REGISTRATION FORM */}
              {activeTab === 'register' && (
                <form onSubmit={handleSignUpSubmit(onSignUp)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--text-secondary)' }} htmlFor="signup-username">Tên đăng nhập</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                        <UserIcon size={16} />
                      </span>
                      <input
                        id="signup-username"
                        className="form-control"
                        style={{ width: '100%', paddingLeft: '2.5rem' }}
                        placeholder="Nhập username"
                        {...signUpRegister('username')}
                      />
                    </div>
                    {signUpErrors.username && <span className="form-error">{signUpErrors.username.message}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--text-secondary)' }} htmlFor="signup-fullname">Họ và tên</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                        <UserIcon size={16} />
                      </span>
                      <input
                        id="signup-fullname"
                        className="form-control"
                        style={{ width: '100%', paddingLeft: '2.5rem' }}
                        placeholder="Nguyễn Văn A"
                        {...signUpRegister('fullName')}
                      />
                    </div>
                    {signUpErrors.fullName && <span className="form-error">{signUpErrors.fullName.message}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--text-secondary)' }} htmlFor="signup-email">Email</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                        <Mail size={16} />
                      </span>
                      <input
                        id="signup-email"
                        type="email"
                        className="form-control"
                        style={{ width: '100%', paddingLeft: '2.5rem' }}
                        placeholder="example@gmail.com"
                        {...signUpRegister('email')}
                      />
                    </div>
                    {signUpErrors.email && <span className="form-error">{signUpErrors.email.message}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--text-secondary)' }} htmlFor="signup-phone">Số điện thoại</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                        <Phone size={16} />
                      </span>
                      <input
                        id="signup-phone"
                        className="form-control"
                        style={{ width: '100%', paddingLeft: '2.5rem' }}
                        placeholder="0912345678"
                        {...signUpRegister('phone')}
                      />
                    </div>
                    {signUpErrors.phone && <span className="form-error">{signUpErrors.phone.message}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--text-secondary)' }} htmlFor="signup-password">Mật khẩu</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                        <KeyRound size={16} />
                      </span>
                      <input
                        id="signup-password"
                        type={showSignupPassword ? 'text' : 'password'}
                        className="form-control"
                        style={{ width: '100%', paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                        placeholder="••••••••"
                        {...signUpRegister('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPassword(!showSignupPassword)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                        title={showSignupPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showSignupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {signUpErrors.password && <span className="form-error">{signUpErrors.password.message}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--text-secondary)' }} htmlFor="signup-confirm">Xác nhận mật khẩu</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                        <KeyRound size={16} />
                      </span>
                      <input
                        id="signup-confirm"
                        type={showConfirmPassword ? 'text' : 'password'}
                        className="form-control"
                        style={{ width: '100%', paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                        placeholder="••••••••"
                        {...signUpRegister('passwordConfirm')}
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
                    {signUpErrors.passwordConfirm && <span className="form-error">{signUpErrors.passwordConfirm.message}</span>}
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                    style={{ width: '100%', padding: '0.75rem', fontWeight: 600, marginTop: '0.5rem', flexShrink: 0 }}
                  >
                    {loading ? 'Đang tạo tài khoản...' : 'Đăng Ký'}
                  </button>
                </form>
              )}

              {/* FORGOT PASSWORD FORM */}
              {activeTab === 'forgot' && (
                <form onSubmit={handleForgotSubmit(onForgotPassword)} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--text-secondary)' }} htmlFor="forgot-email">Địa chỉ Email đăng ký</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                        <Mail size={16} />
                      </span>
                      <input
                        id="forgot-email"
                        type="email"
                        className="form-control"
                        style={{ width: '100%', paddingLeft: '2.5rem' }}
                        placeholder="example@gmail.com"
                        {...forgotRegister('email')}
                      />
                    </div>
                    {forgotErrors.email && <span className="form-error">{forgotErrors.email.message}</span>}
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                    style={{ width: '100%', padding: '0.75rem', fontWeight: 600, marginTop: '0.5rem' }}
                  >
                    {loading ? 'Đang gửi email...' : 'Gửi Yêu Cầu'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setActiveTab('login')}
                    style={{ width: '100%', color: 'var(--text-secondary)' }}
                  >
                    Quay lại đăng nhập
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </AuthLayout>
  );
};