import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiClient } from '../api/client';
import { AuthLayout } from '../layouts/AuthLayout';
import { KeyRound, Mail, User as UserIcon, Phone, UserCheck, Eye, EyeOff } from 'lucide-react';

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
  role: z.string().default('REGISTER'),
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
      <div
        className="glass-card"
        style={{
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          padding: '2.5rem 2rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}
      >
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
              <h2 style={{ fontSize: '1.5rem', color: '#ffffff', fontWeight: 700, margin: 0 }}>Kích Hoạt Tài Khoản</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Một liên kết kích hoạt tài khoản đã được gửi đến địa chỉ email:
              </p>
              <p style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.9rem', marginTop: '0.25rem', wordBreak: 'break-all' }}>
                {registeredEmail}
              </p>
            </div>

            <div style={{ width: '100%', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                style={{ width: '100%', color: '#cbd5e1' }}
              >
                Quay lại đăng nhập
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Card Header Title */}
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.75rem', color: '#ffffff', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
                {activeTab === 'login' && 'Chào Mừng Trở Lại'}
                {activeTab === 'register' && 'Đăng Ký Tài Khoản'}
                {activeTab === 'forgot' && 'Quên Mật Khẩu?'}
              </h2>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginTop: '0.5rem', marginInline: 0 }}>
                {activeTab === 'login' && 'Hệ thống đăng ký và quản lý phòng họp thông minh'}
                {activeTab === 'register' && 'Tạo tài khoản và bắt đầu đặt phòng ngay'}
                {activeTab === 'forgot' && 'Nhập Email của bạn để nhận link thiết lập lại mật khẩu'}
              </p>
            </div>

            {/* Tab Headers */}
            {activeTab !== 'forgot' && (
              <div
                style={{
                  display: 'flex',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.25rem',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
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
                  <label className="form-label" style={{ color: '#cbd5e1' }} htmlFor="login-username">Tên đăng nhập</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                      <UserIcon size={16} />
                    </span>
                    <input
                      id="login-username"
                      className="form-control"
                      style={{ width: '100%', paddingLeft: '2.5rem', backgroundColor: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(255,255,255,0.1)', color: '#ffffff' }}
                      placeholder="Nhập username"
                      {...loginRegister('username')}
                    />
                  </div>
                  {loginErrors.username && <span className="form-error">{loginErrors.username.message}</span>}
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" style={{ color: '#cbd5e1' }} htmlFor="login-password">Mật khẩu</label>
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
                      style={{ width: '100%', paddingLeft: '2.5rem', paddingRight: '2.5rem', backgroundColor: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(255,255,255,0.1)', color: '#ffffff' }}
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
              <form onSubmit={handleSignUpSubmit(onSignUp)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '450px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#cbd5e1' }} htmlFor="signup-username">Tên đăng nhập</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                      <UserIcon size={16} />
                    </span>
                    <input
                      id="signup-username"
                      className="form-control"
                      style={{ width: '100%', paddingLeft: '2.5rem', backgroundColor: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(255,255,255,0.1)', color: '#ffffff' }}
                      placeholder="Nhập username"
                      {...signUpRegister('username')}
                    />
                  </div>
                  {signUpErrors.username && <span className="form-error">{signUpErrors.username.message}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: '#cbd5e1' }} htmlFor="signup-fullname">Họ và tên</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                      <UserIcon size={16} />
                    </span>
                    <input
                      id="signup-fullname"
                      className="form-control"
                      style={{ width: '100%', paddingLeft: '2.5rem', backgroundColor: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(255,255,255,0.1)', color: '#ffffff' }}
                      placeholder="Nguyễn Văn A"
                      {...signUpRegister('fullName')}
                    />
                  </div>
                  {signUpErrors.fullName && <span className="form-error">{signUpErrors.fullName.message}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: '#cbd5e1' }} htmlFor="signup-email">Email</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                      <Mail size={16} />
                    </span>
                    <input
                      id="signup-email"
                      type="email"
                      className="form-control"
                      style={{ width: '100%', paddingLeft: '2.5rem', backgroundColor: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(255,255,255,0.1)', color: '#ffffff' }}
                      placeholder="example@gmail.com"
                      {...signUpRegister('email')}
                    />
                  </div>
                  {signUpErrors.email && <span className="form-error">{signUpErrors.email.message}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: '#cbd5e1' }} htmlFor="signup-phone">Số điện thoại</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                      <Phone size={16} />
                    </span>
                    <input
                      id="signup-phone"
                      className="form-control"
                      style={{ width: '100%', paddingLeft: '2.5rem', backgroundColor: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(255,255,255,0.1)', color: '#ffffff' }}
                      placeholder="0912345678"
                      {...signUpRegister('phone')}
                    />
                  </div>
                  {signUpErrors.phone && <span className="form-error">{signUpErrors.phone.message}</span>}
                </div>



                <div className="form-group">
                  <label className="form-label" style={{ color: '#cbd5e1' }} htmlFor="signup-password">Mật khẩu</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                      <KeyRound size={16} />
                    </span>
                    <input
                      id="signup-password"
                      type={showSignupPassword ? 'text' : 'password'}
                      className="form-control"
                      style={{ width: '100%', paddingLeft: '2.5rem', paddingRight: '2.5rem', backgroundColor: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(255,255,255,0.1)', color: '#ffffff' }}
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
                  <label className="form-label" style={{ color: '#cbd5e1' }} htmlFor="signup-confirm">Xác nhận mật khẩu</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                      <KeyRound size={16} />
                    </span>
                    <input
                      id="signup-confirm"
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="form-control"
                      style={{ width: '100%', paddingLeft: '2.5rem', paddingRight: '2.5rem', backgroundColor: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(255,255,255,0.1)', color: '#ffffff' }}
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
                  {loading ? 'Đang tạo tài khoản...' : 'Đăng Ký Tài Khoản'}
                </button>
              </form>
            )}

            {/* FORGOT PASSWORD FORM */}
            {activeTab === 'forgot' && (
              <form onSubmit={handleForgotSubmit(onForgotPassword)} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#cbd5e1' }} htmlFor="forgot-email">Địa chỉ Email đăng ký</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                      <Mail size={16} />
                    </span>
                    <input
                      id="forgot-email"
                      type="email"
                      className="form-control"
                      style={{ width: '100%', paddingLeft: '2.5rem', backgroundColor: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(255,255,255,0.1)', color: '#ffffff' }}
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
                  style={{ width: '100%', color: '#cbd5e1' }}
                >
                  Quay lại đăng nhập
                </button>
              </form>
            )}
          </>)}
      </div>
    </AuthLayout>
  );
};
