'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../lib/supabase/client';

const statusLabel = { pending: '작성중', submitted: '제출완료', reviewed: '검토완료' };

export default function HomePanel({ displayName, userEmail, isAdmin, goTo }) {
  const supabase = createClient();

  const [announcements, setAnnouncements] = useState([]);

  const [inProgress, setInProgress] = useState([]);
  const [loadingEval, setLoadingEval] = useState(true);

  const [pendingUsers, setPendingUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [approvingId, setApprovingId] = useState(null);

  const loadAnnouncements = useCallback(async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    setAnnouncements(data || []);
  }, [supabase]);

  const loadInProgress = useCallback(async () => {
    setLoadingEval(true);
    const { data } = await supabase
      .from('evaluations')
      .select('*, eval_templates(title), profiles!evaluations_vendor_id_fkey(email, company_name)')
      .in('status', ['pending', 'submitted'])
      .order('created_at', { ascending: false })
      .limit(5);
    setInProgress(data || []);
    setLoadingEval(false);
  }, [supabase]);

  const loadPendingUsers = useCallback(async () => {
    if (!isAdmin) { setLoadingUsers(false); return; }
    setLoadingUsers(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('approved', false)
      .order('created_at', { ascending: false })
      .limit(5);
    setPendingUsers(data || []);
    setLoadingUsers(false);
  }, [isAdmin, supabase]);

  useEffect(() => { loadAnnouncements(); loadInProgress(); loadPendingUsers(); }, [loadAnnouncements, loadInProgress, loadPendingUsers]);

  const quickApprove = async (id, companyName) => {
    setApprovingId(id);
    const role = companyName ? 'vendor' : 'user';
    const { error } = await supabase.from('profiles').update({ approved: true, role }).eq('id', id);
    setApprovingId(null);
    if (error) { alert('승인 실패: ' + error.message); return; }
    setPendingUsers(prev => prev.filter(p => p.id !== id));
  };

  return (
    <>
      <div style={{
        background:'var(--ink)', color:'#fff', borderRadius:10, padding:'24px 28px', marginBottom:20,
      }}>
        <div style={{fontSize:19, fontWeight:800}}>안녕하세요, {displayName || userEmail}님 👋</div>
        <div style={{fontSize:13, color:'#c7cbd6', marginTop:4}}>
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </div>
      </div>

      <div className="home-grid">

        {/* 공지사항 */}
        <div className="panel">
          <div className="panel-head">
            <h2>공지사항</h2>
            <span className="icon-btn" style={{cursor:'pointer'}} onClick={() => goTo('announcements')}>더보기 →</span>
          </div>

          {announcements.length === 0 && <div className="empty">등록된 공지사항이 없어요.</div>}
          {announcements.map(a => (
            <div className="item" key={a.id} style={{cursor:'pointer'}} onClick={() => goTo('announcements')}>
              <div className="item-body">
                <div className="item-name">{a.title}</div>
                <div className="item-meta">{new Date(a.created_at).toLocaleDateString('ko-KR')}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 진행중인 평가 */}
        <div className="panel">
          <div className="panel-head">
            <h2>진행중인 평가</h2>
            {isAdmin && <span className="icon-btn" style={{cursor:'pointer'}} onClick={() => goTo('evalReview')}>더보기 →</span>}
          </div>

          {loadingEval && <div className="empty">불러오는 중...</div>}

          {!loadingEval && inProgress.length === 0 && (
            <div className="empty">진행 중인 평가가 없어요.</div>
          )}

          {inProgress.map(ev => (
            <div
              className="item"
              key={ev.id}
              style={isAdmin ? {cursor:'pointer'} : {}}
              onClick={() => isAdmin && goTo('evalReview')}
            >
              <div className="item-body">
                <div className="item-name">{ev.eval_templates?.title} — {ev.profiles?.company_name || ev.profiles?.email}</div>
                <div style={{fontSize:13.5, fontWeight:700, color:'var(--ink)', marginTop:4}}>
                  📅 {ev.period_start} ~ <span style={{color:'var(--safety)'}}>{ev.period_end}</span>
                </div>
                <div className="item-meta" style={{marginTop:4}}>
                  <span className={"badge " + (ev.status === 'submitted' ? 'ok' : 'warn')}>{statusLabel[ev.status]}</span>
                </div>
              </div>
              {isAdmin && (
                <div className="item-actions">
                  <span className="icon-btn">보기 →</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 가입 승인 요청 */}
        <div className="panel">
          <div className="panel-head">
            <h2>가입 승인 요청</h2>
            {isAdmin && <span className="icon-btn" style={{cursor:'pointer'}} onClick={() => goTo('adminUsers')}>더보기 →</span>}
          </div>

          {!isAdmin && (
            <div className="empty">가입 승인 요청은 관리자만 볼 수 있어요.</div>
          )}

          {isAdmin && loadingUsers && <div className="empty">불러오는 중...</div>}

          {isAdmin && !loadingUsers && pendingUsers.length === 0 && (
            <div className="empty">대기 중인 가입 신청이 없어요.</div>
          )}

          {isAdmin && pendingUsers.map(p => (
            <div className="item" key={p.id}>
              <div className="item-body">
                <div className="item-name">{p.full_name ? `${p.full_name} (${p.email})` : p.email}</div>
                <div className="item-meta">
                  {new Date(p.created_at).toLocaleDateString('ko-KR')}
                  {p.company_name && <span style={{marginLeft:8}}>· {p.company_name}</span>}
                  {p.position && <span style={{marginLeft:8}}>· {p.position}</span>}
                </div>
              </div>
              <div className="item-actions">
                <button className="add-btn" style={{fontSize:12, padding:'6px 12px'}} onClick={() => quickApprove(p.id, p.company_name)} disabled={approvingId === p.id}>
                  {approvingId === p.id ? '승인 중...' : '승인'}
                </button>
                <button className="icon-btn" onClick={() => goTo('adminUsers')}>자세히</button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </>
  );
}
