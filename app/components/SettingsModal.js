'use client';

import { useState } from 'react';
import { createClient } from '../../lib/supabase/client';

export default function SettingsModal({ userEmail, onClose }) {
  const supabase = createClient();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (newPassword.length < 6) {
      setMsg({ type: 'error', text: '비밀번호는 6자 이상이어야 해요.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg({ type: 'error', text: '비밀번호가 서로 일치하지 않아요.' });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) {
      setMsg({ type: 'error', text: '변경 실패: ' + error.message });
      return;
    }
    setMsg({ type: 'success', text: '비밀번호가 변경되었어요.' });
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div
      style={{
        position:'fixed', inset:0, background:'rgba(28,34,48,0.45)',
        display:'flex', alignItems:'center', justifyContent:'center', zIndex:100,
      }}
      onClick={onClose}
    >
      <div
        className="auth-card"
        style={{maxWidth:380, margin:0, boxShadow:'0 20px 50px rgba(0,0,0,0.3)'}}
        onClick={e => e.stopPropagation()}
      >
        <div className="auth-logo" style={{textAlign:'left'}}>개인 설정</div>
        <div className="auth-sub" style={{textAlign:'left'}}>{userEmail}</div>

        <form onSubmit={handleChangePassword}>
          <div className="auth-field">
            <label>새 비밀번호</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} />
          </div>
          <div className="auth-field">
            <label>새 비밀번호 확인</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} />
          </div>
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>

        {msg && <div className={"auth-msg " + msg.type}>{msg.text}</div>}

        <button
          onClick={onClose}
          style={{width:'100%', marginTop:14, padding:9, background:'none', border:'1px solid var(--line)', borderRadius:5, color:'var(--muted)', fontSize:13, fontWeight:600, cursor:'pointer'}}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
