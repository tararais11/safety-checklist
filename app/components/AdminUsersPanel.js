'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../lib/supabase/client';

export default function AdminUsersPanel() {
  const supabase = createClient();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [roleChoices, setRoleChoices] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ full_name: '', company_name: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setCurrentUserId(user.id);

    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); setLoading(false); return; }
    setProfiles(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const approveUser = async (id, role) => {
    const { error: err } = await supabase.from('profiles').update({ approved: true, role }).eq('id', id);
    if (err) { setError(err.message); return; }
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, approved: true, role } : p));
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

  const demoteAdmin = async (id) => {
    if (!confirm('이 사용자의 관리자 권한을 해제할까요? 일반 사용자로 바뀌어요.')) return;
    const { error: err } = await supabase.from('profiles').update({ role: 'user' }).eq('id', id);
    if (err) { setError(err.message); return; }
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, role: 'user' } : p));
  };

  const deleteUserCompletely = async (id, email) => {
    if (!confirm(`"${email}" 계정을 완전히 삭제할까요?\n이 작업은 되돌릴 수 없고, 이 사용자의 모든 데이터(체크리스트, 첨부파일 등)도 함께 삭제돼요.`)) return;
    setError(null);
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: id }),
      });
      const result = await res.json();
      if (!res.ok) { setError('삭제 실패: ' + result.error); return; }
      setProfiles(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      setError('삭제 중 오류가 발생했어요: ' + e.message);
    }
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditDraft({ full_name: p.full_name || '', company_name: p.company_name || '' });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id) => {
    const { error: err } = await supabase
      .from('profiles')
      .update({ full_name: editDraft.full_name || null, company_name: editDraft.company_name || null })
      .eq('id', id);
    if (err) { setError(err.message); return; }
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, full_name: editDraft.full_name || null, company_name: editDraft.company_name || null } : p));
    setEditingId(null);
  };

  if (loading) return <div className="empty">불러오는 중...</div>;

  const pending = profiles.filter(p => !p.approved);
  const approved = profiles.filter(p => p.approved);

  return (
    <>
      {error && <div className="disclaimer">{error}</div>}

      <div className="panel" style={{marginBottom:20}}>
        <div className="panel-head">
          <h2>승인 대기 중</h2>
          <div className="cycle-label">{pending.length}명</div>
        </div>
        {pending.length === 0 && <div className="empty">대기 중인 가입 신청이 없어요.</div>}
        {pending.map(p => {
          const chosenRole = roleChoices[p.id] || (p.company_name ? 'vendor' : 'user');
          return (
            <div className="item" key={p.id}>
              <div className="item-body">
                <div className="item-name">{p.full_name ? `${p.full_name} (${p.email})` : p.email}</div>
                <div className="item-meta">
                  가입일: {new Date(p.created_at).toLocaleDateString('ko-KR')}
                  {p.company_name && <span style={{marginLeft:8}}>· 회사명: {p.company_name}</span>}
                </div>
              </div>
              <div className="item-actions">
                <select
                  value={chosenRole}
                  onChange={e => setRoleChoices(prev => ({ ...prev, [p.id]: e.target.value }))}
                  style={{padding:'6px 8px', border:'1px solid var(--line)', borderRadius:4, fontSize:12.5}}
                >
                  <option value="user">일반 사용자</option>
                  <option value="vendor">협력업체</option>
                </select>
                <button className="add-btn" style={{fontSize:12, padding:'6px 12px'}} onClick={() => approveUser(p.id, chosenRole)}>승인</button>
                <button className="icon-btn" style={{color:'var(--warn)'}} onClick={() => deleteUserCompletely(p.id, p.email)}>거절(삭제)</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>승인된 사용자</h2>
          <div className="cycle-label">{approved.length}명</div>
        </div>
        {approved.map(p => (
          <div className="item" key={p.id} style={{flexDirection: editingId === p.id ? 'column' : 'row', alignItems: editingId === p.id ? 'stretch' : 'center'}}>
            {editingId === p.id ? (
              <div style={{width:'100%'}}>
                <div style={{display:'flex', gap:10, marginBottom:8, flexWrap:'wrap'}}>
                  <input
                    placeholder="이름"
                    value={editDraft.full_name}
                    onChange={e => setEditDraft(prev => ({ ...prev, full_name: e.target.value }))}
                    style={{flex:1, minWidth:140, padding:'8px 10px', border:'1px solid var(--line)', borderRadius:4, fontSize:13}}
                  />
                  <input
                    placeholder="회사명 (협력업체인 경우)"
                    value={editDraft.company_name}
                    onChange={e => setEditDraft(prev => ({ ...prev, company_name: e.target.value }))}
                    style={{flex:1, minWidth:180, padding:'8px 10px', border:'1px solid var(--line)', borderRadius:4, fontSize:13}}
                  />
                </div>
                <div style={{display:'flex', gap:8}}>
                  <button className="add-btn" style={{fontSize:12, padding:'6px 12px'}} onClick={() => saveEdit(p.id)}>저장</button>
                  <button className="icon-btn" onClick={cancelEdit}>취소</button>
                </div>
              </div>
            ) : (
              <>
                <div className="item-body">
                  <div className="item-name">
                    {p.full_name ? `${p.full_name} (${p.email})` : p.email} {p.role === 'admin' && <span className="badge ok">관리자</span>} {p.role === 'vendor' && <span className="badge warn">협력업체</span>}
                    {p.company_name && <span style={{marginLeft:8, color:'var(--muted)', fontWeight:400}}>({p.company_name})</span>}
                  </div>
                  <div className="item-meta">가입일: {new Date(p.created_at).toLocaleDateString('ko-KR')}</div>
                </div>
                <div className="item-actions">
                  <button className="icon-btn" onClick={() => startEdit(p)}>이름/회사명 수정</button>
                  {p.role === 'admin' ? (
                    p.id !== currentUserId && (
                      <button className="icon-btn" onClick={() => demoteAdmin(p.id)}>관리자 해제</button>
                    )
                  ) : (
                    <>
                      <button className="icon-btn" onClick={() => makeAdmin(p.id)}>관리자로 지정</button>
                      <button className="icon-btn" onClick={() => revokeUser(p.id)}>승인 취소</button>
                      <button className="icon-btn" style={{color:'var(--warn)'}} onClick={() => deleteUserCompletely(p.id, p.email)}>완전 탈퇴</button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
