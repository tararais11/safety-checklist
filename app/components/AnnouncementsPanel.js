'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../lib/supabase/client';

export default function AnnouncementsPanel({ isAdmin }) {
  const supabase = createClient();

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('list'); // 'list' | 'write' | 'detail'
  const [selected, setSelected] = useState(null);

  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState(null);

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

  const saveAnnouncement = async () => {
    if (!newTitle.trim()) return;
    setPosting(true);
    if (editingId) {
      const { data, error } = await supabase
        .from('announcements')
        .update({ title: newTitle.trim(), content: newContent.trim() })
        .eq('id', editingId)
        .select();
      setPosting(false);
      if (error) { alert('수정 실패: ' + error.message); return; }
      setAnnouncements(prev => prev.map(a => a.id === editingId ? data[0] : a));
      setSelected(data[0]);
      setEditingId(null);
      setNewTitle(''); setNewContent('');
      setMode('detail');
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('announcements')
        .insert({ admin_id: user.id, title: newTitle.trim(), content: newContent.trim() })
        .select();
      setPosting(false);
      if (error) { alert('등록 실패: ' + error.message); return; }
      setAnnouncements(prev => [data[0], ...prev]);
      setNewTitle(''); setNewContent('');
      setMode('list');
    }
  };

  const startEdit = (a) => {
    setEditingId(a.id);
    setNewTitle(a.title);
    setNewContent(a.content || '');
    setMode('write');
  };

  const cancelWrite = () => {
    setEditingId(null);
    setNewTitle(''); setNewContent('');
    setMode(selected ? 'detail' : 'list');
  };

  const deleteAnnouncement = async (id) => {
    if (!confirm('이 공지사항을 삭제할까요?')) return;
    await supabase.from('announcements').delete().eq('id', id);
    setAnnouncements(prev => prev.filter(a => a.id !== id));
    setMode('list');
    setSelected(null);
  };

  if (loading) return <div className="empty">불러오는 중...</div>;

  // 글쓰기 / 수정 화면
  if (mode === 'write') {
    return (
      <div className="panel">
        <div className="panel-head"><h2>{editingId ? '공지사항 수정' : '공지사항 작성'}</h2></div>
        <input
          placeholder="제목"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          style={{width:'100%', marginBottom:10, padding:'11px 12px', border:'1px solid var(--line)', borderRadius:4, fontSize:14.5}}
        />
        <textarea
          placeholder="내용을 입력하세요"
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          rows={10}
          style={{width:'100%', marginBottom:14, padding:'12px', border:'1px solid var(--line)', borderRadius:4, fontSize:14, fontFamily:'inherit', resize:'vertical', lineHeight:1.6}}
        />
        <div style={{display:'flex', gap:10}}>
          <button className="auth-submit" style={{width:'auto', padding:'11px 26px'}} onClick={saveAnnouncement} disabled={posting}>
            {posting ? '저장 중...' : (editingId ? '수정 완료' : '등록하기')}
          </button>
          <button className="icon-btn" onClick={cancelWrite}>취소</button>
        </div>
      </div>
    );
  }

  // 상세보기 화면
  if (mode === 'detail' && selected) {
    return (
      <div className="panel">
        <button
          onClick={() => { setMode('list'); setSelected(null); }}
          style={{
            marginBottom:14, padding:'10px 18px', background:'var(--ink)', color:'#fff', border:'none',
            borderRadius:6, fontSize:14, fontWeight:700, cursor:'pointer',
          }}
        >
          ← 목록으로
        </button>
        <div style={{borderBottom:'2px solid var(--ink)', paddingBottom:14, marginBottom:16}}>
          <div style={{fontSize:19, fontWeight:800, marginBottom:8}}>{selected.title}</div>
          <div style={{fontSize:12, color:'var(--muted)'}}>{new Date(selected.created_at).toLocaleDateString('ko-KR')}</div>
        </div>
        <div style={{fontSize:14.5, lineHeight:1.8, whiteSpace:'pre-wrap', minHeight:120}}>
          {selected.content || <span style={{color:'var(--muted)'}}>내용이 없어요.</span>}
        </div>
        {isAdmin && (
          <div style={{marginTop:24, display:'flex', gap:10}}>
            <button className="icon-btn" onClick={() => startEdit(selected)}>수정</button>
            <button className="icon-btn" style={{color:'var(--warn)'}} onClick={() => deleteAnnouncement(selected.id)}>삭제</button>
          </div>
        )}
      </div>
    );
  }

  // 목록 화면 (기본)
  return (
    <div className="panel">
      {isAdmin && (
        <div className="panel-head" style={{justifyContent:'flex-end'}}>
          <button className="add-btn" onClick={() => { setEditingId(null); setNewTitle(''); setNewContent(''); setMode('write'); }}>+ 글쓰기</button>
        </div>
      )}

      {announcements.length === 0 && <div className="empty">등록된 공지사항이 없어요.</div>}

      {announcements.map((a, idx) => (
        <div
          className="item"
          key={a.id}
          style={{cursor:'pointer'}}
          onClick={() => { setSelected(a); setMode('detail'); }}
        >
          <div style={{
            width:32, flexShrink:0, textAlign:'center', color:'var(--muted)', fontSize:13, fontWeight:700,
            alignSelf:'center',
          }}>
            {announcements.length - idx}
          </div>
          <div className="item-body">
            <div className="item-name">{a.title}</div>
            <div className="item-meta">{new Date(a.created_at).toLocaleDateString('ko-KR')}</div>
          </div>
          <div className="item-actions">
            <span className="icon-btn">보기 →</span>
          </div>
        </div>
      ))}
    </div>
  );
}
