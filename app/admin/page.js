'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export default function AdminPage() {
  const supabase = createClient();
  const router = useRouter();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (me?.role !== 'admin') { setIsAdmin(false); setLoading(false); return; }
    setIsAdmin(true);

    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); setLoading(false); return; }
    setProfiles(data || []);
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => { load(); }, [load]);

  const approveUser = async (id) => {
    const { error: err } = await supabase.from('profiles').update({ approved: true }).eq('id', id);
    if (err) { setError(err.message); return; }
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, approved: true } : p));
  };

  const revokeUser = async (id) => {
    if (!confirm('이 사용자의 승인을 취소할까요? 다시 로그인할 수 없게 돼요.')) return;
    const { error: err } = await supabase.from('profiles').update({ approved: false }).eq('id', id);
    if (err) { setError(err.message); return; }
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, approved: false } : p));
  };

  const makeAdmin = async (id) => {
    if (!confirm('이 사용자를 관리자로 지정할까요?')) return;
    const { error: err } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', id);
    if (err) { setError(err.message); return; }
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, role: 'admin' } : p));
  };

  if (loading) return <div className="wrap"><div className="empty">불러오는 중...</div></div>;

  if (!isAdmin) {
    return (
      <div className="wrap">
        <div className="disclaimer">관리자만 접근할 수 있는 페이지예요.</div>
      </div>
    );
  }

  const pending = profiles.filter(p => !p.approved);
  const approved = profiles.filter(p => p.approved);

  return (
    <div className="wrap">
      <div className="masthead">
        <div>
          <h1>관리자 페이지</h1>
          <div className="sub">회원가입 승인 및 사용자 관리</div>
        </div>
      </div>
      <div className="stripe"></div>

      {error && <div className="disclaimer">{error}</div>}

      <div className="panel" style={{marginBottom:20}}>
        <div className="panel-head">
          <h2>승인 대기 중</h2>
          <div className="cycle-label">{pending.length}명</div>
        </div>
        {pending.length === 0 && <div className="empty">대기 중인 가입 신청이 없어요.</div>}
        {pending.map(p => (
          <div className="item" key={p.id}>
            <div className="item-body">
              <div className="item-name">{p.email}</div>
              <div className="item-meta">가입일: {new Date(p.created_at).toLocaleDateString('ko-KR')}</div>
            </div>
            <div className="item-actions">
              <button className="add-btn" style={{fontSize:12, padding:'6px 12px'}} onClick={() => approveUser(p.id)}>승인</button>
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>승인된 사용자</h2>
          <div className="cycle-label">{approved.length}명</div>
        </div>
        {approved.map(p => (
          <div className="item" key={p.id}>
            <div className="item-body">
              <div className="item-name">
                {p.email} {p.role === 'admin' && <span className="badge ok">관리자</span>}
              </div>
              <div className="item-meta">가입일: {new Date(p.created_at).toLocaleDateString('ko-KR')}</div>
            </div>
            <div className="item-actions">
              {p.role !== 'admin' && (
                <>
                  <button className="icon-btn" onClick={() => makeAdmin(p.id)}>관리자로 지정</button>
                  <button className="icon-btn" onClick={() => revokeUser(p.id)}>승인 취소</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
