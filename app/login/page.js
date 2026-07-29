'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [companyName, setCompanyName] = useState('');
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
        setLoading(false);
      } else {
        // 로딩 상태를 유지한 채로 페이지 이동 (버튼이 즉시 원상복구되지 않도록)
        router.push('/');
        router.refresh();
      }
    } else {
      if (password.length < 6) {
        setMsg({ type: 'error', text: '비밀번호는 6자 이상이어야 합니다.' });
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { company_name: companyName || null, full_name: fullName || null, position: position || null } },
      });
      if (error) {
        setMsg({ type: 'error', text: '회원가입 실패: ' + error.message });
      } else {
        setMsg({ type: 'success', text: '가입 신청이 접수되었어요. 관리자 승인 후 로그인할 수 있습니다.' });
        setMode('login');
      }
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      {loading && mode === 'login' && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(28,34,48,0.55)',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          zIndex:200, color:'#fff', gap:14,
        }}>
          <div style={{
            width:40, height:40, border:'4px solid rgba(255,255,255,0.25)', borderTopColor:'#ff8a4c',
            borderRadius:'50%', animation:'auth-spin 0.8s linear infinite',
          }}></div>
          <div style={{fontSize:14.5, fontWeight:700}}>로그인 중입니다...</div>
        </div>
      )}
      <style>{`@keyframes auth-spin { to { transform: rotate(360deg); } }`}</style>
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
          {mode === 'signup' && (
            <div className="auth-field">
              <label>이름</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="예: 홍길동" />
            </div>
          )}
          {mode === 'signup' && (
            <div className="auth-field">
              <label>직책</label>
              <select
                value={position}
                onChange={e => setPosition(e.target.value)}
                required
                style={{width:'100%', padding:'10px 12px', border:'1px solid var(--line)', borderRadius:4, fontSize:14, background:'#fbfaf6'}}
              >
                <option value="">직책을 선택해주세요</option>
                <option value="현장소장">현장소장</option>
                <option value="안전보건관리책임자">안전보건관리책임자</option>
                <option value="안전관리자">안전관리자</option>
                <option value="관리감독자">관리감독자</option>
                <option value="안전보건관리담당자">안전보건관리담당자</option>
              </select>
            </div>
          )}
          {mode === 'signup' && (
            <div className="auth-field">
              <label>회사명 (협력업체로 가입하시는 경우 입력)</label>
              <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="예: 주식회사 오피스넷" />
            </div>
          )}
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? '처리 중...' : (mode === 'login' ? '로그인' : '회원가입')}
          </button>
        </form>

        {msg && <div className={"auth-msg " + msg.type}>{msg.text}</div>}
      </div>
    </div>
  );
}
