'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../lib/supabase/client';

export default function AnnouncementsPanel({ isAdmin }) {
  const supabase = createClient();

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    setAnnouncements(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

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

  if (loading) return <div className="empty">불러오는 중...</div>;

  return (
    <>
      {isAdmin && (
        <div className="panel" style={{marginBottom:20}}>
          <div className="panel-head"><h2>새 공지 작성</h2></div>
          <input
            placeholder="제목"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            style={{width:'100%', marginBottom:8, padding:'10px 12px', border:'1px solid var(--line)', borderRadius:4, fontSize:14}}
          />
          <textarea
            placeholder="내용 (선택)"
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            rows={4}
            style={{width:'100%', marginBottom:10, padding:'10px 12px', border:'1px solid var(--line)', borderRadius:4, fontSize:14, fontFamily:'inherit', resize:'vertical'}}
          />
          <button className="add-btn" onClick={postAnnouncement} disabled={posting}>
            {posting ? '등록 중...' : '+ 공지 등록'}
          </button>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h2>공지사항 목록</h2>
          <div className="cycle-label">{announcements.length}건</div>
        </div>
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
    </>
  );
}
