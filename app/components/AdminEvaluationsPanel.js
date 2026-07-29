'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../lib/supabase/client';

export default function AdminEvaluationsPanel() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [templates, setTemplates] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [evaluations, setEvaluations] = useState([]);

  const [newTitle, setNewTitle] = useState('');
  const [newLegalBasis, setNewLegalBasis] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const [criterionDraft, setCriterionDraft] = useState({});

  const [assignTemplateId, setAssignTemplateId] = useState('');
  const [assignVendorId, setAssignVendorId] = useState('');
  const [assignStart, setAssignStart] = useState('');
  const [assignEnd, setAssignEnd] = useState('');

  const [reviewEval, setReviewEval] = useState(null);
  const [reviewRows, setReviewRows] = useState([]);
  const [signedUrls, setSignedUrls] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: tpls } = await supabase
      .from('eval_templates')
      .select('*, eval_criteria(*)')
      .order('created_at', { ascending: false });
    setTemplates((tpls || []).map(t => ({
      ...t,
      eval_criteria: (t.eval_criteria || []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    })));

    const { data: vs } = await supabase
      .from('profiles')
      .select('id, email, company_name')
      .eq('role', 'vendor')
      .eq('approved', true);
    setVendors(vs || []);

    const { data: evs } = await supabase
      .from('evaluations')
      .select('*, eval_templates(title), profiles!evaluations_vendor_id_fkey(email, company_name)')
      .order('created_at', { ascending: false });
    setEvaluations(evs || []);

    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const createTemplate = async () => {
    if (!newTitle.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error: err } = await supabase
      .from('eval_templates')
      .insert({ admin_id: user.id, title: newTitle.trim(), legal_basis: newLegalBasis, notes: newNotes })
      .select('*, eval_criteria(*)');
    if (err) { setError(err.message); return; }
    setTemplates(prev => [{ ...data[0], eval_criteria: [] }, ...prev]);
    setNewTitle(''); setNewLegalBasis(''); setNewNotes('');
  };

  const deleteTemplate = async (id) => {
    if (!confirm('이 평가 템플릿을 삭제할까요? 배정된 평가가 있으면 함께 영향을 받을 수 있어요.')) return;
    await supabase.from('eval_templates').delete().eq('id', id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const addCriterion = async (templateId) => {
    const draft = criterionDraft[templateId];
    if (!draft?.content?.trim()) return;
    const template = templates.find(t => t.id === templateId);
    const nextOrder = (template?.eval_criteria?.length || 0);
    const { data, error: err } = await supabase
      .from('eval_criteria')
      .insert({
        template_id: templateId,
        sort_order: nextOrder,
        content: draft.content.trim(),
        criteria_text: draft.criteria_text || '',
        max_score: Number(draft.max_score) || 10,
      })
      .select();
    if (err) { setError(err.message); return; }
    setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, eval_criteria: [...t.eval_criteria, data[0]] } : t));
    setCriterionDraft(prev => ({ ...prev, [templateId]: { content: '', criteria_text: '', max_score: 10 } }));
  };

  const removeCriterion = async (templateId, criterionId) => {
    await supabase.from('eval_criteria').delete().eq('id', criterionId);
    setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, eval_criteria: t.eval_criteria.filter(c => c.id !== criterionId) } : t));
  };

  const createEvaluation = async () => {
    if (!assignTemplateId || !assignVendorId) { setError('평가 템플릿과 협력업체를 선택해주세요.'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error: err } = await supabase
      .from('evaluations')
      .insert({
        template_id: assignTemplateId,
        admin_id: user.id,
        vendor_id: assignVendorId,
        period_start: assignStart || null,
        period_end: assignEnd || null,
      })
      .select('*, eval_templates(title), profiles!evaluations_vendor_id_fkey(email, company_name)');
    if (err) { setError(err.message); return; }
    setEvaluations(prev => [data[0], ...prev]);
    setAssignTemplateId(''); setAssignVendorId(''); setAssignStart(''); setAssignEnd('');
  };

  const openReview = async (evaluation) => {
    setReviewEval(evaluation);
    const template = templates.find(t => t.id === evaluation.template_id);
    const criteria = template?.eval_criteria || [];

    const { data: responses } = await supabase
      .from('eval_responses')
      .select('*')
      .eq('evaluation_id', evaluation.id);

    const rows = criteria.map(c => {
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
        evaluation_id: reviewEval.id,
        criterion_id: row.criterion.id,
        review_score: row.response.review_score === '' ? null : Number(row.response.review_score),
        review_comment: row.response.review_comment || '',
        file_url: row.response.file_url || null,
        file_name: row.response.file_name || null,
      };
      await supabase.from('eval_responses').upsert(payload, { onConflict: 'evaluation_id,criterion_id' });
    }
    await supabase.from('evaluations').update({ status: 'reviewed' }).eq('id', reviewEval.id);
    setEvaluations(prev => prev.map(e => e.id === reviewEval.id ? { ...e, status: 'reviewed' } : e));
    setReviewEval(null);
    alert('검토 결과가 저장되었어요.');
  };

  if (loading) return <div className="empty">불러오는 중...</div>;

  const statusLabel = { pending: '대기중', submitted: '제출완료', reviewed: '검토완료' };

  return (
    <>
      {error && <div className="disclaimer">{error}</div>}

      {reviewEval && (
        <div style={{position:'fixed', inset:0, background:'rgba(28,34,48,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20}}
          onClick={() => setReviewEval(null)}>
          <div className="panel" style={{maxWidth:760, width:'100%', maxHeight:'85vh', overflowY:'auto'}} onClick={e => e.stopPropagation()}>
            <div className="panel-head">
              <h2>{reviewEval.eval_templates?.title} — {reviewEval.profiles?.company_name || reviewEval.profiles?.email}</h2>
              <div className="cycle-label">{statusLabel[reviewEval.status]}</div>
            </div>
            {reviewRows.map((row, idx) => (
              <div key={row.criterion.id} style={{borderTop:'1px solid #eee6d3', padding:'14px 4px'}}>
                <div style={{fontWeight:700, fontSize:14, marginBottom:4}}>{row.criterion.content} <span style={{color:'var(--muted)', fontWeight:500, fontSize:12}}>(배점 {row.criterion.max_score})</span></div>
                <div style={{fontSize:12.5, color:'var(--muted)', whiteSpace:'pre-wrap', marginBottom:8}}>{row.criterion.criteria_text}</div>
                {row.response.file_url ? (
                  <ResponseFileLink path={row.response.file_url} name={row.response.file_name} getSignedUrl={getSignedUrl} />
                ) : (
                  <div style={{fontSize:12.5, color:'var(--muted)', marginBottom:8}}>협력업체가 아직 증빙자료를 첨부하지 않았어요.</div>
                )}
                <div style={{display:'flex', gap:10, marginTop:8}}>
                  <input
                    type="number" placeholder="점수" min={0} max={row.criterion.max_score}
                    value={row.response.review_score}
                    onChange={e => saveReviewRow(idx, 'review_score', e.target.value)}
                    style={{width:90, padding:'8px 10px', border:'1px solid var(--line)', borderRadius:4, fontSize:13}}
                  />
                  <input
                    type="text" placeholder="검토의견"
                    value={row.response.review_comment}
                    onChange={e => saveReviewRow(idx, 'review_comment', e.target.value)}
                    style={{flex:1, padding:'8px 10px', border:'1px solid var(--line)', borderRadius:4, fontSize:13}}
                  />
                </div>
              </div>
            ))}
            <div style={{display:'flex', gap:10, marginTop:16}}>
              <button className="add-btn" onClick={submitReview}>검토 결과 저장</button>
              <button className="icon-btn" onClick={() => setReviewEval(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      <div className="panel" style={{marginBottom:20}}>
        <div className="panel-head"><h2>평가 템플릿</h2></div>
        <div className="add-row" style={{flexDirection:'column', alignItems:'stretch', gap:8}}>
          <input placeholder="평가명 (예: 2026년 협력업체 안전보건수준평가)" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
          <input placeholder="평가근거 (예: 산업안전보건법 제61조)" value={newLegalBasis} onChange={e => setNewLegalBasis(e.target.value)} />
          <input placeholder="평가제출 유의사항" value={newNotes} onChange={e => setNewNotes(e.target.value)} />
          <button className="add-btn" onClick={createTemplate} style={{alignSelf:'flex-start'}}>+ 템플릿 만들기</button>
        </div>

        {templates.map(t => (
          <div key={t.id} style={{marginTop:18, borderTop:'1px solid #eee6d3', paddingTop:14}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div style={{fontWeight:800, fontSize:15}}>{t.title}</div>
              <button className="icon-btn" onClick={() => deleteTemplate(t.id)}>템플릿 삭제</button>
            </div>
            {t.legal_basis && <div style={{fontSize:12, color:'var(--muted)', marginTop:2}}>근거: {t.legal_basis}</div>}

            {t.eval_criteria.map(c => (
              <div className="item" key={c.id}>
                <div className="item-body">
                  <div className="item-name">{c.content} <span style={{color:'var(--muted)', fontWeight:500, fontSize:12}}>(배점 {c.max_score})</span></div>
                  <div className="item-meta">{c.criteria_text}</div>
                </div>
                <div className="item-actions">
                  <button className="icon-btn" onClick={() => removeCriterion(t.id, c.id)}>✕</button>
                </div>
              </div>
            ))}

            <div className="add-row" style={{marginTop:10}}>
              <input
                placeholder="평가내용"
                value={criterionDraft[t.id]?.content || ''}
                onChange={e => setCriterionDraft(prev => ({ ...prev, [t.id]: { ...prev[t.id], content: e.target.value } }))}
                style={{flex:2}}
              />
              <input
                placeholder="평가기준 설명"
                value={criterionDraft[t.id]?.criteria_text || ''}
                onChange={e => setCriterionDraft(prev => ({ ...prev, [t.id]: { ...prev[t.id], criteria_text: e.target.value } }))}
                style={{flex:2}}
              />
              <input
                type="number" placeholder="배점"
                value={criterionDraft[t.id]?.max_score ?? ''}
                onChange={e => setCriterionDraft(prev => ({ ...prev, [t.id]: { ...prev[t.id], max_score: e.target.value } }))}
                style={{width:80}}
              />
              <button className="add-btn" onClick={() => addCriterion(t.id)}>추가</button>
            </div>
          </div>
        ))}
      </div>

      <div className="panel" style={{marginBottom:20}}>
        <div className="panel-head"><h2>평가 배정</h2></div>
        <div className="add-row" style={{flexWrap:'wrap'}}>
          <select value={assignTemplateId} onChange={e => setAssignTemplateId(e.target.value)} style={{padding:'9px 11px', border:'1px solid var(--line)', borderRadius:4}}>
            <option value="">평가 템플릿 선택</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <select value={assignVendorId} onChange={e => setAssignVendorId(e.target.value)} style={{padding:'9px 11px', border:'1px solid var(--line)', borderRadius:4}}>
            <option value="">협력업체 선택</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.company_name || v.email}</option>)}
          </select>
          <input type="date" value={assignStart} onChange={e => setAssignStart(e.target.value)} />
          <input type="date" value={assignEnd} onChange={e => setAssignEnd(e.target.value)} />
          <button className="add-btn" onClick={createEvaluation}>평가 배정하기</button>
        </div>
        {vendors.length === 0 && <div className="empty">아직 승인된 협력업체 계정이 없어요. "회원 관리"에서 회원가입을 "협력업체"로 승인해주세요.</div>}
      </div>

      <div className="panel">
        <div className="panel-head"><h2>배정된 평가 목록</h2></div>
        {evaluations.length === 0 && <div className="empty">아직 배정된 평가가 없어요.</div>}
        {evaluations.map(ev => (
          <div className="item" key={ev.id}>
            <div className="item-body">
              <div className="item-name">{ev.eval_templates?.title} — {ev.profiles?.company_name || ev.profiles?.email}</div>
              <div className="item-meta">
                {ev.period_start} ~ {ev.period_end}
                <span className={"badge " + (ev.status === 'reviewed' ? 'ok' : 'warn')} style={{marginLeft:8}}>{statusLabel[ev.status]}</span>
              </div>
            </div>
            <div className="item-actions">
              <button className="add-btn" style={{fontSize:12, padding:'6px 12px'}} onClick={() => openReview(ev)}>보기 / 검토</button>
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
