'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // {type, text}
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg({ type: 'error', text: '로그인 실패: 이메일 또는 비밀번호를 확인해주세요.' });
      } else {
        router.push('/');
        router.refresh();
      }
    } else {
      if (password.length < 6) {
        setMsg({ type: 'error', text: '비밀번호는 6자 이상이어야 합니다.' });
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMsg({ type: 'error', text: '회원가입 실패: ' + error.message });
      } else {
        setMsg({ type: 'success', text: '가입 확인 이메일을 보냈습니다. 메일함을 확인해주세요. (Supabase 설정에서 이메일 확인을 껐다면 바로 로그인하세요.)' });
        setMode('login');
      }
    }
    setLoading(false);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <div className="auth-hero-decor"></div>
        <div className="auth-hero-decor2"></div>
        <div className="auth-hero-top">
          <div className="auth-hero-eyebrow">SAFETY &amp; HEALTH COMPLIANCE</div>
          <div className="auth-hero-title">
            안전은 기록될 때<br/>비로소 <span>지켜집니다</span>
          </div>
          <div className="auth-hero-sub">
            산업안전보건법·중대재해처벌법 대응 서류를 주기별로 관리하고,
            근거 법령과 이행 증빙을 한 곳에서 확인하세요.
          </div>
        </div>
        <div className="auth-hero-bottom">
          <div className="auth-hero-stat"><b>일일~연간</b><span>주기별 점검 관리</span></div>
          <div className="auth-hero-stat"><b>법령 원문</b><span>조문 바로 확인</span></div>
          <div className="auth-hero-stat"><b>이행 증빙</b><span>파일 첨부·보관</span></div>
        </div>
      </div>

      <div className="auth-panel">
      <div className="auth-card">
        <div className="auth-logo">안전보건 통합관리시스템</div>
        <div className="auth-sub">산업안전보건법 · 중대재해처벌법 대응 관리</div>

        <div className="auth-tabs">
          <div className={"auth-tab" + (mode === 'login' ? ' active' : '')} onClick={() => { setMode('login'); setMsg(null); }}>
            로그인
          </div>
          <div className={"auth-tab" + (mode === 'signup' ? ' active' : '')} onClick={() => { setMode('signup'); setMsg(null); }}>
            회원가입
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>이메일</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="auth-field">
            <label>비밀번호</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? '처리 중...' : (mode === 'login' ? '로그인' : '회원가입')}
          </button>
        </form>

        {msg && <div className={"auth-msg " + msg.type}>{msg.text}</div>}
      </div>
      </div>
    </div>
  );
}
