'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../lib/supabase/client';

export default function AnnouncementsPanel({ isAdmin, openAnnouncementId }) {
  const supabase = createClient();

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('list'); // 'list' | 'write' | 'detail'
  const [selected, setSelected] = useState(null);

  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newPinned, setNewPinned] = useState(false);
  const [newFile, setNewFile] = useState(null); // 새로 선택한 파일 (업로드 전)
  const [existingFile, setExistingFile] = useState(null); // 수정 중 기존 첨부파일 {file_url, file_name}
  const [removeExistingFile, setRemoveExistingFile] = useState(false);
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [signedUrl, setSignedUrl] = useState(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    setAnnouncements(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (openAnnouncementId && announcements.length > 0) {
      const target = announcements.find(a => a.id === openAnnouncementId);
      if (target) {
        setSelected(target);
        setMode('detail');
      }
    }
  }, [openAnnouncementId, announcements]);

  useEffect(() => {
    if (mode === 'detail' && selected?.file_url) {
      supabase.storage.from('announcement-files').createSignedUrl(selected.file_url, 3600)
        .then(({ data }) => setSignedUrl(data?.signedUrl || null));
    } else {
      setSignedUrl(null);
    }
  }, [mode, selected, supabase]);

  const saveAnnouncement = async () => {
    if (!newTitle.trim()) return;
    const confirmMsg = editingId ? '수정하시겠습니까?' : '등록하시겠습니까?';
    if (!confirm(confirmMsg)) return;
    setPosting(true);

    const { data: { user } } = await supabase.auth.getUser();

    // 파일 처리: 새 파일이 있으면 업로드, 기존 파일 제거 요청이면 지움
    let file_url = editingId ? (removeExistingFile ? null : existingFile?.file_url || null) : null;
    let file_name = editingId ? (removeExistingFile ? null : existingFile?.file_name || null) : null;

    if (newFile) {
      const extMatch = newFile.name.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1] : 'dat';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('announcement-files').upload(path, newFile);
      if (upErr) { setPosting(false); alert('파일 업로드 실패: ' + upErr.message); return; }
      // 기존 파일이 있었고 새 파일로 교체하는 거면 예전 파일 삭제
      if (editingId && existingFile?.file_url) {
        await supabase.storage.from('announcement-files').remove([existingFile.file_url]);
      }
      file_url = path;
      file_name = newFile.name;
    } else if (editingId && removeExistingFile && existingFile?.file_url) {
      await supabase.storage.from('announcement-files').remove([existingFile.file_url]);
    }

    if (editingId) {
      const { data, error } = await supabase
        .from('announcements')
        .update({ title: newTitle.trim(), content: newContent.trim(), file_url, file_name, pinned: newPinned })
        .eq('id', editingId)
        .select();
      setPosting(false);
      if (error) { alert('수정 실패: ' + error.message); return; }
      setAnnouncements(prev => {
        const updated = prev.map(a => a.id === editingId ? data[0] : a);
        return [...updated].sort((x, y) => {
          if (x.pinned !== y.pinned) return x.pinned ? -1 : 1;
          return new Date(y.created_at) - new Date(x.created_at);
        });
      });
      setSelected(data[0]);
      resetForm();
      setMode('detail');
    } else {
      const { data, error } = await supabase
        .from('announcements')
        .insert({ admin_id: user.id, title: newTitle.trim(), content: newContent.trim(), file_url, file_name, pinned: newPinned })
        .select();
      setPosting(false);
      if (error) { alert('등록 실패: ' + error.message); return; }
      setAnnouncements(prev => {
        const updated = [data[0], ...prev];
        return updated.sort((x, y) => {
          if (x.pinned !== y.pinned) return x.pinned ? -1 : 1;
          return new Date(y.created_at) - new Date(x.created_at);
        });
      });
      resetForm();
      setPage(1);
      setMode('list');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setNewTitle(''); setNewContent(''); setNewPinned(false);
    setNewFile(null); setExistingFile(null); setRemoveExistingFile(false);
  };

  const startEdit = (a) => {
    setEditingId(a.id);
    setNewTitle(a.title);
    setNewContent(a.content || '');
    setNewPinned(!!a.pinned);
    setExistingFile(a.file_url ? { file_url: a.file_url, file_name: a.file_name } : null);
    setNewFile(null);
    setRemoveExistingFile(false);
    setMode('write');
  };

  const cancelWrite = () => {
    const goBackTo = selected ? 'detail' : 'list';
    resetForm();
    setMode(goBackTo);
  };

  const togglePin = async (a) => {
    const nextPinned = !a.pinned;
    const { data, error } = await supabase
      .from('announcements')
      .update({ pinned: nextPinned })
      .eq('id', a.id)
      .select();
    if (error) { alert('고정 설정 실패: ' + error.message); return; }
    setAnnouncements(prev => {
      const updated = prev.map(x => x.id === a.id ? data[0] : x);
      return [...updated].sort((x, y) => {
        if (x.pinned !== y.pinned) return x.pinned ? -1 : 1;
        return new Date(y.created_at) - new Date(x.created_at);
      });
    });
    setSelected(data[0]);
  };

  const deleteAnnouncement = async (id) => {
    if (!confirm('이 공지사항을 삭제할까요?')) return;
    const target = announcements.find(a => a.id === id);
    if (target?.file_url) {
      await supabase.storage.from('announcement-files').remove([target.file_url]);
    }
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

        <label style={{display:'flex', alignItems:'center', gap:8, marginBottom:14, fontSize:13.5, cursor:'pointer'}}>
          <input
            type="checkbox"
            checked={newPinned}
            onChange={e => setNewPinned(e.target.checked)}
          />
          📌 상단 고정
        </label>

        <div style={{marginBottom:18, padding:'12px 14px', background:'#fbfaf6', border:'1px solid var(--line)', borderRadius:4}}>
          <div style={{fontSize:12, fontWeight:700, color:'var(--muted)', marginBottom:8}}>첨부파일 (선택)</div>

          {existingFile && !removeExistingFile && !newFile && (
            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:8}}>
              <span style={{fontSize:13}}>📎 {existingFile.file_name}</span>
              <button className="icon-btn" onClick={() => setRemoveExistingFile(true)}>제거</button>
            </div>
          )}
          {removeExistingFile && (
            <div style={{fontSize:12.5, color:'var(--muted)', marginBottom:8}}>기존 파일이 제거될 예정이에요.</div>
          )}
          {newFile && (
            <div style={{fontSize:13, marginBottom:8}}>📎 {newFile.name} <span style={{color:'var(--safety)'}}>(새 파일)</span></div>
          )}

          <label className="add-btn" style={{cursor:'pointer', display:'inline-block', fontSize:12}}>
            {existingFile || newFile ? '파일 교체' : '+ 파일 첨부'}
            <input
              type="file"
              style={{display:'none'}}
              onChange={e => { if (e.target.files[0]) { setNewFile(e.target.files[0]); setRemoveExistingFile(false); } }}
            />
          </label>
        </div>

        <div style={{display:'flex', justifyContent:'flex-end', gap:10}}>
          <button
            onClick={saveAnnouncement}
            disabled={posting}
            style={{
              padding:'11px 26px', background:'var(--ink)', color:'#fff',
              border:'2px solid var(--ink)', borderRadius:4, fontSize:14, fontWeight:700, cursor:'pointer',
            }}
          >
            {posting ? '저장 중...' : (editingId ? '수정 완료' : '등록하기')}
          </button>
          <button
            onClick={cancelWrite}
            style={{
              padding:'11px 26px', background:'#fff', color:'var(--ink)',
              border:'2px solid var(--ink)', borderRadius:4, fontSize:14, fontWeight:700, cursor:'pointer',
            }}
          >
            취소
          </button>
        </div>
      </div>
    );
  }

  // 상세보기 화면
  if (mode === 'detail' && selected) {
    return (
      <>
        <button
          onClick={() => { setMode('list'); setSelected(null); }}
          style={{
            marginBottom:14, padding:'10px 18px', background:'var(--ink)', color:'#fff', border:'none',
            borderRadius:6, fontSize:14, fontWeight:700, cursor:'pointer',
          }}
        >
          ← 목록으로
        </button>

        <div className="panel">
          <div style={{borderBottom:'2px solid var(--ink)', paddingBottom:14, marginBottom:16}}>
            <div style={{fontSize:19, fontWeight:800, marginBottom:8}}>
              {selected.pinned && <span style={{color:'var(--safety)', marginRight:6}}>📌 고정</span>}
              {selected.title}
            </div>
            <div style={{fontSize:12, color:'var(--muted)'}}>{new Date(selected.created_at).toLocaleDateString('ko-KR')}</div>
          </div>
          <div style={{fontSize:14.5, lineHeight:1.8, whiteSpace:'pre-wrap', minHeight:120}}>
            {selected.content || <span style={{color:'var(--muted)'}}>내용이 없어요.</span>}
          </div>

          {selected.file_url && (
            <div style={{marginTop:20, padding:'12px 14px', background:'#fbfaf6', border:'1px solid var(--line)', borderRadius:4}}>
              <span style={{fontSize:13.5}}>📎 {selected.file_name}</span>{' '}
              {signedUrl ? (
                <a href={signedUrl} target="_blank" rel="noopener noreferrer" style={{color:'var(--safety)', fontSize:13.5}}>
                  열어서 보기 ↗
                </a>
              ) : (
                <span style={{fontSize:12.5, color:'var(--muted)'}}>링크 불러오는 중...</span>
              )}
            </div>
          )}

          {isAdmin && (
            <div style={{marginTop:28, display:'flex', justifyContent:'flex-end', gap:10}}>
              <button
                onClick={() => togglePin(selected)}
                style={{
                  padding:'11px 22px', background: selected.pinned ? 'var(--safety)' : '#fff',
                  color: selected.pinned ? '#fff' : 'var(--ink)',
                  border:'2px solid ' + (selected.pinned ? 'var(--safety)' : 'var(--ink)'), borderRadius:6, fontSize:13.5, fontWeight:700, cursor:'pointer',
                }}
              >
                {selected.pinned ? '📌 고정 해제' : '📌 상단 고정'}
              </button>
              <button
                onClick={() => startEdit(selected)}
                style={{
                  padding:'11px 22px', background:'#fff', color:'var(--ink)',
                  border:'2px solid var(--ink)', borderRadius:6, fontSize:13.5, fontWeight:700, cursor:'pointer',
                }}
              >
                수정
              </button>
              <button
                onClick={() => deleteAnnouncement(selected.id)}
                style={{
                  padding:'11px 22px', background:'var(--warn)', color:'#fff',
                  border:'none', borderRadius:6, fontSize:13.5, fontWeight:700, cursor:'pointer',
                }}
              >
                삭제
              </button>
            </div>
          )}
        </div>
      </>
    );
  }

  // 목록 화면 (기본)
  const pinnedItems = announcements.filter(a => a.pinned);
  const regularItems = announcements.filter(a => !a.pinned);
  const totalPages = Math.max(1, Math.ceil(regularItems.length / PAGE_SIZE));
  const pageItems = regularItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      {isAdmin && (
        <div style={{display:'flex', justifyContent:'flex-end', marginBottom:14}}>
          <button className="add-btn" onClick={() => { resetForm(); setMode('write'); }}>+ 글쓰기</button>
        </div>
      )}

      <div className="panel">
        {announcements.length === 0 && <div className="empty">등록된 공지사항이 없어요.</div>}

        {pinnedItems.map(a => (
          <div
            className="item"
            key={a.id}
            style={{cursor:'pointer', background:'#fdecc8'}}
            onClick={() => { setSelected(a); setMode('detail'); }}
          >
            <div style={{
              width:32, flexShrink:0, textAlign:'center', fontSize:15,
              alignSelf:'center',
            }}>
              📌
            </div>
            <div className="item-body">
              <div className="item-name">{a.title} {a.file_url && <span style={{fontSize:12}}>📎</span>}</div>
              <div className="item-meta">{new Date(a.created_at).toLocaleDateString('ko-KR')}</div>
            </div>
          </div>
        ))}

        {pageItems.map((a, idx) => (
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
              {regularItems.length - ((page - 1) * PAGE_SIZE + idx)}
            </div>
            <div className="item-body">
              <div className="item-name">{a.title} {a.file_url && <span style={{fontSize:12}}>📎</span>}</div>
              <div className="item-meta">{new Date(a.created_at).toLocaleDateString('ko-KR')}</div>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{display:'flex', justifyContent:'center', gap:6, marginTop:16}}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{
                width:32, height:32, borderRadius:6, border:'1px solid var(--line)',
                background: p === page ? 'var(--ink)' : '#fff',
                color: p === page ? '#fff' : 'var(--ink)',
                fontWeight:700, fontSize:13, cursor:'pointer',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
