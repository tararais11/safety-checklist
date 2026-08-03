'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../lib/supabase/client';

const statusLabel = { pending: '작성중', submitted: '제출완료', reviewed: '검토완료' };

export default function HomePanel({ displayName, userEmail, isAdmin, goTo }) {
  const supabase = createClient();

  const [announcements, setAnnouncements] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [posting, setPosting] = useState(false);

  const [inProgress, setInProgress] = useState([]);
  const [loadingEval, setLoadingEval] = useState(true);

  const loadAnnouncements = useCallback(async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    setAnnouncements(data || []);
  }, [supabase]);

  const loadInProgress = useCallback(async () => {
    if (!isAdmin) { setLoadingEval(false); return; }
    setLoadingEval(true);
    const { data } = await supabase
      .from('evaluations')
      .select('*, eval_templates(title), profiles!evaluations_vendor_id_fkey(email, company_name)')
      .in('status', ['pending', 'submitted'])
      .order('created_at', { ascending: false })
      .limit(20);
    setInProgress(data || []);
    setLoadingEval(false);
  }, [isAdmin, supabase]);

  useEffect(() => { loadAnnouncements(); loadInProgress(); }, [loadAnnouncements, loadInProgress]);

  const postAnnouncement = async () => {
    if (!newTitle.trim()) return;
    setPosting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('announcements')
      .insert({ admin_id: user.id, title: newTitle.trim(), content: newContent.trim() })
      .select();
    setPosting(false);
    if (error) { alert('등록 실패: ' + error.message); return; }
    setAnnouncements(prev => [data[0], ...prev]);
    setNewTitle(''); setNewContent('');
  };

  const deleteAnnouncement = async (id) => {
    if (!confirm('이 공지사항을 삭제할까요?')) return;
    await supabase.from('announcements').delete().eq('id', id);
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  return (
    <>
      <div style={{
        background:'var(--ink)', color:'#fff', borderRadius:10, padding:'24px 28px', marginBottom:20,
      }}>
        <div style={{fontSize:19, fontWeight:800}}>안녕하세요, {displayName || userEmail}님 </div>
        <div style={{fontSize:13, color:'#c7cbd6', marginTop:4}}>
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </div>
      </div>

      <div className="home-grid">

        {/* 공지사항 */}
        <div className="panel">
          <div className="panel-head"><h2>공지사항</h2></div>

          {isAdmin && (
            <div style={{marginBottom:16, paddingBottom:16, borderBottom:'1px solid #eee6d3'}}>
              <input
                placeholder="제목"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                style={{width:'100%', marginBottom:8, padding:'9px 11px', border:'1px solid var(--line)', borderRadius:4, fontSize:13.5}}
              />
              <textarea
                placeholder="내용 (선택)"
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                rows={2}
                style={{width:'100%', marginBottom:8, padding:'9px 11px', border:'1px solid var(--line)', borderRadius:4, fontSize:13.5, fontFamily:'inherit', resize:'vertical'}}
              />
              <button className="add-btn" onClick={postAnnouncement} disabled={posting}>
                {posting ? '등록 중...' : '+ 공지 등록'}
              </button>
            </div>
          )}

          {announcements.length === 0 && <div className="empty">등록된 공지사항이 없어요.</div>}
          {announcements.map(a => (
            <div className="item" key={a.id}>
              <div className="item-body">
                <div className="item-name">{a.title}</div>
                {a.content && <div className="item-meta" style={{whiteSpace:'pre-wrap'}}>{a.content}</div>}
                <div className="item-meta" style={{marginTop:2}}>{new Date(a.created_at).toLocaleDateString('ko-KR')}</div>
              </div>
              {isAdmin && (
                <div className="item-actions">
                  <button className="icon-btn" onClick={() => deleteAnnouncement(a.id)}>✕</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 진행중인 평가 */}
        <div className="panel">
          <div className="panel-head"><h2>진행중인 평가</h2></div>

          {!isAdmin && (
            <div className="empty">협력업체 평가 현황은 관리자만 볼 수 있어요.</div>
          )}

          {isAdmin && loadingEval && <div className="empty">불러오는 중...</div>}

          {isAdmin && !loadingEval && inProgress.length === 0 && (
            <div className="empty">진행 중인 평가가 없어요.</div>
          )}

          {isAdmin && inProgress.map(ev => (
            <div className="item" key={ev.id} style={{cursor:'pointer'}} onClick={() => goTo('evalReview')}>
              <div className="item-body">
                <div className="item-name">{ev.eval_templates?.title} — {ev.profiles?.company_name || ev.profiles?.email}</div>
                <div className="item-meta">
                  {ev.period_start} ~ {ev.period_end}
                  <span className={"badge " + (ev.status === 'submitted' ? 'ok' : 'warn')} style={{marginLeft:8}}>{statusLabel[ev.status]}</span>
                </div>
              </div>
              <div className="item-actions">
                <span className="icon-btn">보기 →</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </>
  );
}
