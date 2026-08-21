'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../lib/supabase/client';
import ClipIcon from './ClipIcon';

export default function TemplatesLibrary({ note }) {
  const supabase = createClient();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('일반');
  const [signedUrls, setSignedUrls] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('templates')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    setTemplates(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const getSignedUrl = async (path) => {
    if (signedUrls[path]) return signedUrls[path];
    const { data, error } = await supabase.storage.from('templates').createSignedUrl(path, 3600);
    if (error || !data) return null;
    setSignedUrls(prev => ({ ...prev, [path]: data.signedUrl }));
    return data.signedUrl;
  };

  const downloadTemplate = async (tpl) => {
    const url = await getSignedUrl(tpl.file_url);
    if (!url) { alert('파일을 여는 데 실패했어요.'); return; }
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = tpl.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      alert('다운로드 중 오류가 발생했어요: ' + e.message);
    }
  };

  if (loading) return <div className="empty">불러오는 중...</div>;

  const defaultCategories = ['일반', '현장서류', '중대재해처벌법'];
  const usedCategories = [...new Set(templates.map(t => t.category || '일반'))];
  const allCategories = [...new Set([...defaultCategories, ...usedCategories])];
  const filteredTemplates = templates.filter(t => (t.category || '일반') === category);

  return (
    <>
      {note && (
        <div style={{marginBottom:14, background:'var(--safety-dim)', border:'1.5px solid var(--safety)', borderRadius:4, padding:'12px 16px', color:'var(--safety)', fontWeight:700, fontSize:13.5}}>
          {note}
        </div>
      )}

      <div className="tabs">
        {allCategories.map(cat => (
          <div key={cat} className={"tab" + (category === cat ? " active" : "")} onClick={() => setCategory(cat)}>
            {cat}<span className="count">{templates.filter(t => (t.category || '일반') === cat).length}</span>
          </div>
        ))}
      </div>

      <div className="panel panel-scroll">
        {filteredTemplates.length === 0 && <div className="empty">이 카테고리에는 아직 올라온 양식이 없어요.</div>}
        {filteredTemplates.map(tpl => (
          <div className="item" key={tpl.id}>
            <div className="item-body">
              <div className="item-name">📄 {tpl.file_name}</div>
              <div className="item-meta">{new Date(tpl.created_at).toLocaleDateString('ko-KR')} 업로드</div>
            </div>
            <div className="item-actions">
              <button
                className="icon-btn"
                onClick={() => downloadTemplate(tpl)}
                style={{fontSize:13, fontWeight:700, padding:'6px 12px', color:'var(--safety)', display:'flex', alignItems:'center', gap:5}}
              >
                <ClipIcon size={13} /> 다운로드
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
