import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useToast } from '../context/ToastContext';
import { AuthLayout } from '../layouts/AuthLayout';
import { CheckCircle, XCircle, Loader2, Mail, Send, ArrowRight } from 'lucide-react';

export const Verify: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const token = searchParams.get('token');
  const email = searchParams.get('email'); // present if verifying new email update

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Resend verification states
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const verifyToken = async () => {
    if (!token) {
      setStatus('error');
      setErrorMsg('Đường dẫn xác thực không hợp lệ hoặc thiếu mã xác thực (token).');
      return;
    }

    try {
      if (email) {
        // Verification for new email update: /auth/verify/new-email?token=...&email=...
        await apiClient.get(`/auth/verify/new-email?token=${token}&email=${encodeURIComponent(email)}`);
        showToast('Xác thực địa chỉ Email mới thành công!', 'success');
      } else {
        // Verification for signup registration: /auth/verify?token=...
        await apiClient.get(`/auth/verify?token=${token}`);
        showToast('Xác thực tài khoản thành công!', 'success');
      }
      setStatus('success');
    } catch (error: any) {
      const errMsg = error.response?.data?.message || 'Mã xác thực đã hết hạn hoặc không tồn tại trong hệ thống.';
      setErrorMsg(errMsg);
      setStatus('error');
      showToast(errMsg, 'error');
    }
  };

  useEffect(() => {
    verifyToken();
  }, [token, email]);

  // Handle resend verification email
  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;

    setResendLoading(true);
    try {
      await apiClient.post('/auth/resend-verification', { email: resendEmail });
      showToast('Đã gửi lại link xác thực tài khoản vào hòm thư!', 'success');
      setCooldown(60); // start 60s cooldown
    } catch (error: any) {
      const errMsg = error.response?.data?.message || 'Gửi lại link xác thực thất bại';
      showToast(errMsg, 'error');
      // If error contains cooldown info, try to extract seconds
      const secondsMatch = errMsg.match(/\d+/);
      if (secondsMatch) {
        setCooldown(parseInt(secondsMatch[0], 10));
      }
    } finally {
      setResendLoading(false);
    }
  };

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  return (
    <AuthLayout>
      <div 
        className="glass-card" 
        style={{
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          padding: '2.5rem 2rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem'
        }}
      >
        {status === 'loading' && (
          <>
            <Loader2 className="pulse-skeleton" size={48} style={{ color: 'var(--accent)', animation: 'spin 2s linear infinite' }} />
            <div>
              <h3 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 600 }}>Đang xác thực thông tin...</h3>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Hệ thống đang kết nối và kiểm tra mã token của bạn.
              </p>
            </div>
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle size={56} style={{ color: 'var(--success)' }} />
            <div>
              <h2 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700 }}>Xác Thực Thành Công!</h2>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                {email 
                  ? `Địa chỉ email mới của bạn (${email}) đã được kích hoạt thành công.`
                  : 'Tài khoản của bạn đã được kích hoạt. Hãy đăng nhập để bắt đầu trải nghiệm.'
                }
              </p>
            </div>
            <button 
              onClick={() => navigate('/login')} 
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              Đi tới Đăng nhập <ArrowRight size={16} />
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={56} style={{ color: 'var(--danger)' }} />
            <div>
              <h2 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700 }}>Xác Thực Thất Bại!</h2>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                {errorMsg}
              </p>
            </div>

            {/* Resend Verification panel */}
            {!email && (
              <div 
                style={{ 
                  width: '100%', 
                  borderTop: '1px solid rgba(255,255,255,0.08)', 
                  paddingTop: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  textAlign: 'left'
                }}
              >
                <h4 style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}>Yêu cầu gửi lại link kích hoạt</h4>
                
                <form onSubmit={handleResend} style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                  <div style={{ position: 'relative', flexGrow: 1 }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                      <Mail size={14} />
                    </span>
                    <input 
                      type="email" 
                      className="form-control" 
                      style={{ 
                        width: '100%', 
                        paddingLeft: '2.25rem', 
                        fontSize: '0.8rem',
                        backgroundColor: 'rgba(30, 41, 59, 0.4)', 
                        borderColor: 'rgba(255,255,255,0.1)', 
                        color: '#ffffff'
                      }}
                      placeholder="email_dang_ky@company.com"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      required
                      disabled={cooldown > 0}
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', flexShrink: 0 }}
                    disabled={resendLoading || cooldown > 0}
                  >
                    {resendLoading ? '...' : cooldown > 0 ? `${cooldown}s` : <Send size={14} />}
                  </button>
                </form>
              </div>
            )}

            <button 
              onClick={() => navigate('/login')} 
              className="btn btn-ghost"
              style={{ width: '100%', color: '#cbd5e1' }}
            >
              Quay lại Đăng nhập
            </button>
          </>
        )}
      </div>
    </AuthLayout>
  );
};
