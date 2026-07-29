'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../lib/supabase/client';

export default function AdminEvalCreatePanel() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [templates, setTemplates] = useState([]);
  const [vendors, setVendors] = useState([]);

  const [newTitle, setNewTitle] = useState('');
  const [newLegalBasis, setNewLegalBasis] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const [criterionDraft, setCriterionDraft] = useState({});

  const [assignTemplateId, setAssignTemplateId] = useState('');
  const [assignVendorId, setAssignVendorId] = useState('');
  const [assignStart, setAssignStart] = useState('');
  const [assignEnd, setAssignEnd] = useState('');
  const [assignMsg, setAssignMsg] = useState(null);

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

    if (assignVendorId === '__all__') {
      if (vendors.length === 0) { setError('배정할 협력업체가 없어요.'); return; }
      if (!confirm(`협력업체 전체(${vendors.length}곳)에 이 평가를 배정할까요?`)) return;
      const rows = vendors.map(v => ({
        template_id: assignTemplateId,
        admin_id: user.id,
        vendor_id: v.id,
        period_start: assignStart || null,
        period_end: assignEnd || null,
      }));
      const { error: err } = await supabase.from('evaluations').insert(rows);
      if (err) { setError(err.message); return; }
      setAssignTemplateId(''); setAssignVendorId(''); setAssignStart(''); setAssignEnd('');
      setAssignMsg(`협력업체 ${vendors.length}곳 전체에 평가가 배정되었어요. "평가검토" 메뉴에서 확인할 수 있어요.`);
      setTimeout(() => setAssignMsg(null), 5000);
      return;
    }

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
    setAssignTemplateId(''); setAssignVendorId(''); setAssignStart(''); setAssignEnd('');
    setAssignMsg(`"${data[0].profiles?.company_name || data[0].profiles?.email}"에 평가가 배정되었어요. "평가검토" 메뉴에서 확인할 수 있어요.`);
    setTimeout(() => setAssignMsg(null), 5000);
  };

  if (loading) return <div className="empty">불러오는 중...</div>;

  return (
    <>
      {error && <div className="disclaimer">{error}</div>}

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
                  <div className="item-meta" style={{whiteSpace:'pre-wrap'}}>{c.criteria_text}</div>
                </div>
                <div className="item-actions">
                  <button className="icon-btn" onClick={() => removeCriterion(t.id, c.id)}>✕</button>
                </div>
              </div>
            ))}

            <div className="add-row" style={{marginTop:10, alignItems:'flex-start'}}>
              <input
                placeholder="평가내용"
                value={criterionDraft[t.id]?.content || ''}
                onChange={e => setCriterionDraft(prev => ({ ...prev, [t.id]: { ...prev[t.id], content: e.target.value } }))}
                style={{flex:2}}
              />
              <textarea
                placeholder="평가기준 설명 (줄바꿈 가능: 우수/보통/미흡 기준을 줄마다 나눠서 써보세요)"
                value={criterionDraft[t.id]?.criteria_text || ''}
                onChange={e => setCriterionDraft(prev => ({ ...prev, [t.id]: { ...prev[t.id], criteria_text: e.target.value } }))}
                rows={3}
                style={{flex:2, padding:'9px 11px', border:'1px solid var(--line)', borderRadius:3, fontSize:13.5, fontFamily:'inherit', background:'#fbfaf6', resize:'vertical'}}
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

      <div className="panel">
        <div className="panel-head"><h2>평가 배정</h2></div>
        <div className="add-row" style={{flexWrap:'wrap'}}>
          <select value={assignTemplateId} onChange={e => setAssignTemplateId(e.target.value)} style={{padding:'9px 11px', border:'1px solid var(--line)', borderRadius:4}}>
            <option value="">평가 템플릿 선택</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <select value={assignVendorId} onChange={e => setAssignVendorId(e.target.value)} style={{padding:'9px 11px', border:'1px solid var(--line)', borderRadius:4}}>
            <option value="">협력업체 선택</option>
            {vendors.length > 0 && <option value="__all__">🏢 전체 협력업체 ({vendors.length}곳)</option>}
            {vendors.map(v => <option key={v.id} value={v.id}>{v.company_name || v.email}</option>)}
          </select>
          <input type="date" value={assignStart} onChange={e => setAssignStart(e.target.value)} />
          <input type="date" value={assignEnd} onChange={e => setAssignEnd(e.target.value)} />
          <button className="add-btn" onClick={createEvaluation}>평가 배정하기</button>
        </div>
        {assignMsg && <div className="auth-msg success" style={{marginTop:12}}>{assignMsg}</div>}
        {vendors.length === 0 && <div className="empty">아직 승인된 협력업체 계정이 없어요. "회원 관리"에서 회원가입을 "협력업체"로 승인해주세요.</div>}
      </div>
    </>
  );
}
