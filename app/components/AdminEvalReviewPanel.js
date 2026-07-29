'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../lib/supabase/client';

const statusLabel = { pending: '대기중', submitted: '제출완료', reviewed: '검토완료' };

export default function AdminEvalReviewPanel() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [evaluations, setEvaluations] = useState([]);
  const [openEval, setOpenEval] = useState(null);
  const [reviewRows, setReviewRows] = useState([]);
  const [signedUrls, setSignedUrls] = useState({});
  const [filter, setFilter] = useState('all'); // all | pending | submitted | reviewed

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: evs, error: err } = await supabase
      .from('evaluations')
      .select('*, eval_templates(title, legal_basis, notes), profiles!evaluations_vendor_id_fkey(email, company_name)')
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); setLoading(false); return; }
    setEvaluations(evs || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const openReview = async (evaluation) => {
    setOpenEval(evaluation);
    const { data: criteria } = await supabase
      .from('eval_criteria')
      .select('*')
      .eq('template_id', evaluation.template_id)
      .order('sort_order', { ascending: true });

    const { data: responses } = await supabase
      .from('eval_responses')
      .select('*')
      .eq('evaluation_id', evaluation.id);

    const rows = (criteria || []).map(c => {
      const resp = (responses || []).find(r => r.criterion_id === c.id);
      return { criterion: c, response: resp || { criterion_id: c.id, evaluation_id: evaluation.id, review_score: '', review_comment: '' } };
    });
    setReviewRows(rows);
  };

  const getSignedUrl = async (path) => {
    if (!path) return null;
    if (signedUrls[path]) return signedUrls[path];
    const { data } = await supabase.storage.from('vendor-evidence').createSignedUrl(path, 3600);
    if (!data) return null;
    setSignedUrls(prev => ({ ...prev, [path]: data.signedUrl }));
    return data.signedUrl;
  };

  const saveReviewRow = (idx, field, value) => {
    const rows = [...reviewRows];
    rows[idx] = { ...rows[idx], response: { ...rows[idx].response, [field]: value } };
    setReviewRows(rows);
  };

  const submitReview = async () => {
    for (const row of reviewRows) {
      const payload = {
        evaluation_id: openEval.id,
        criterion_id: row.criterion.id,
        review_score: row.response.review_score === '' ? null : Number(row.response.review_score),
        review_comment: row.response.review_comment || '',
        file_url: row.response.file_url || null,
        file_name: row.response.file_name || null,
      };
      await supabase.from('eval_responses').upsert(payload, { onConflict: 'evaluation_id,criterion_id' });
    }
    await supabase.from('evaluations').update({ status: 'reviewed' }).eq('id', openEval.id);
    setEvaluations(prev => prev.map(e => e.id === openEval.id ? { ...e, status: 'reviewed' } : e));
    setOpenEval(prev => ({ ...prev, status: 'reviewed' }));
    alert('검토 결과가 저장되었어요.');
  };

  if (loading) return <div className="empty">불러오는 중...</div>;

  if (openEval) {
    const total = reviewRows.reduce((sum, r) => sum + (r.response.review_score === '' || r.response.review_score == null ? 0 : Number(r.response.review_score)), 0);
    const maxTotal = reviewRows.reduce((sum, r) => sum + (r.criterion.max_score || 0), 0);

    return (
      <>
        {error && <div className="disclaimer">{error}</div>}
        <button className="icon-btn" style={{marginBottom:14}} onClick={() => setOpenEval(null)}>← 평가 목록으로</button>

        <div className="panel">
          <div className="panel-head">
            <h2>{openEval.eval_templates?.title} — {openEval.profiles?.company_name || openEval.profiles?.email}</h2>
            <div className="cycle-label">{statusLabel[openEval.status]}</div>
          </div>
          {openEval.eval_templates?.legal_basis && (
            <div style={{fontSize:12.5, color:'var(--muted)', marginBottom:14}}>근거: {openEval.eval_templates.legal_basis}</div>
          )}

          {reviewRows.map((row, idx) => (
            <div key={row.criterion.id} style={{borderTop:'1px solid #eee6d3', padding:'16px 4px'}}>
              <div style={{fontWeight:700, fontSize:14.5, marginBottom:4}}>{row.criterion.content} <span style={{color:'var(--muted)', fontWeight:500, fontSize:12}}>(배점 {row.criterion.max_score})</span></div>
              <div style={{fontSize:13, color:'var(--muted)', whiteSpace:'pre-wrap', marginBottom:10}}>{row.criterion.criteria_text}</div>
              {row.response.file_url ? (
                <ResponseFileLink path={row.response.file_url} name={row.response.file_name} getSignedUrl={getSignedUrl} />
              ) : (
                <div style={{fontSize:12.5, color:'var(--muted)', marginBottom:8}}>협력업체가 아직 증빙자료를 첨부하지 않았어요.</div>
              )}
              <div style={{display:'flex', gap:10, marginTop:10}}>
                <input
                  type="number" placeholder="점수" min={0} max={row.criterion.max_score}
                  value={row.response.review_score}
                  onChange={e => saveReviewRow(idx, 'review_score', e.target.value)}
                  style={{width:100, padding:'9px 11px', border:'1px solid var(--line)', borderRadius:4, fontSize:13.5}}
                />
                <input
                  type="text" placeholder="검토의견"
                  value={row.response.review_comment}
                  onChange={e => saveReviewRow(idx, 'review_comment', e.target.value)}
                  style={{flex:1, padding:'9px 11px', border:'1px solid var(--line)', borderRadius:4, fontSize:13.5}}
                />
              </div>
            </div>
          ))}

          <div style={{
            display:'flex', justifyContent:'space-between', alignItems:'center',
            borderTop:'2px solid var(--ink)', marginTop:8, padding:'12px 4px', fontWeight:800, fontSize:15,
          }}>
            <span>합계</span>
            <span>{total} / {maxTotal}</span>
          </div>

          <div style={{marginTop:18}}>
            <button className="auth-submit" style={{width:'auto', padding:'11px 28px'}} onClick={submitReview}>검토 결과 저장</button>
          </div>
        </div>
      </>
    );
  }

  const filtered = filter === 'all' ? evaluations : evaluations.filter(e => e.status === filter);

  return (
    <>
      {error && <div className="disclaimer">{error}</div>}

      <div className="tabs" style={{marginBottom:16}}>
        {['all', 'pending', 'submitted', 'reviewed'].map(f => (
          <div key={f} className={"tab" + (filter === f ? " active" : "")} onClick={() => setFilter(f)}>
            {f === 'all' ? '전체' : statusLabel[f]}
            <span className="count">{f === 'all' ? evaluations.length : evaluations.filter(e => e.status === f).length}</span>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-head"><h2>평가 목록</h2></div>
        {filtered.length === 0 && <div className="empty">해당하는 평가가 없어요.</div>}
        {filtered.map(ev => (
          <div className="item" key={ev.id} style={{cursor:'pointer'}} onClick={() => openReview(ev)}>
            <div className="item-body">
              <div className="item-name">{ev.eval_templates?.title} — {ev.profiles?.company_name || ev.profiles?.email}</div>
              <div className="item-meta">
                {ev.period_start} ~ {ev.period_end}
                <span className={"badge " + (ev.status === 'reviewed' ? 'ok' : 'warn')} style={{marginLeft:8}}>{statusLabel[ev.status]}</span>
              </div>
            </div>
            <div className="item-actions">
              <span className="icon-btn">보기 / 검토 →</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ResponseFileLink({ path, name, getSignedUrl }) {
  const [url, setUrl] = useState(null);
  useEffect(() => { getSignedUrl(path).then(setUrl); }, [path]);
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{color:'var(--safety)', fontSize:13}}>📎 {name} — 열어서 보기 ↗</a>
  ) : (
    <div style={{fontSize:12.5, color:'var(--muted)'}}>파일 링크 불러오는 중...</div>
  );
}
