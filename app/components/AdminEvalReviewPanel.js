'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../lib/supabase/client';

const statusLabel = { pending: '대기중', submitted: '제출완료', reviewed: '검토완료' };

const printTh = {
  border:'1px solid #4a4a4a', padding:'8px 9px', background:'#231f20', color:'#ffffff',
  textAlign:'center', fontSize:11.5, fontWeight:700, WebkitPrintColorAdjust:'exact', printColorAdjust:'exact',
};
const printTd = { border:'1px solid #c9c2ad', padding:'7px 9px', verticalAlign:'top', fontSize:11.5, textAlign:'left' };
const printTdCenter = { ...printTd, textAlign:'center' };

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

    let criteria;
    if (evaluation.criteria_snapshot && evaluation.criteria_snapshot.length > 0) {
      // 배정 시점에 고정해둔 항목 스냅샷 사용 (템플릿이 나중에 바뀌어도 영향 없음)
      criteria = [...evaluation.criteria_snapshot].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    } else {
      // 스냅샷이 없는 예전 평가는 기존 방식대로 템플릿에서 실시간 조회
      const { data } = await supabase
        .from('eval_criteria')
        .select('*')
        .eq('template_id', evaluation.template_id)
        .order('sort_order', { ascending: true });
      criteria = data;
    }

    const { data: responses } = await supabase
      .from('eval_responses')
      .select('*')
      .eq('evaluation_id', evaluation.id);

    const { data: evidenceFiles } = await supabase
      .from('eval_evidence_files')
      .select('*')
      .eq('evaluation_id', evaluation.id)
      .order('uploaded_at', { ascending: true });

    const rows = (criteria || []).map(c => {
      const resp = (responses || []).find(r => r.criterion_id === c.id);
      const files = (evidenceFiles || []).filter(f => f.criterion_id === c.id);
      return { criterion: c, response: resp || { criterion_id: c.id, evaluation_id: evaluation.id, review_score: '', review_comment: '' }, files };
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
    if (!confirm('검토 결과를 저장할까요? 저장하면 이 평가는 "검토완료" 상태가 돼요.')) return;
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
    fetch('/api/notify/evaluation-reviewed', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evaluationId: openEval.id }),
    }).catch(() => {});
    setEvaluations(prev => prev.map(e => e.id === openEval.id ? { ...e, status: 'reviewed' } : e));
    alert('검토 결과가 저장되었어요.');
    setOpenEval(null);
  };

  const cancelSubmission = async () => {
    if (!confirm('제출을 취소하고 협력업체가 다시 작성할 수 있게 되돌릴까요?')) return;
    await supabase.from('evaluations').update({ status: 'pending' }).eq('id', openEval.id);
    setEvaluations(prev => prev.map(e => e.id === openEval.id ? { ...e, status: 'pending' } : e));
    setOpenEval(prev => ({ ...prev, status: 'pending' }));
    alert('제출이 취소되어 협력업체가 다시 작성할 수 있어요.');
  };

  const deleteEvaluation = async (evaluation) => {
    const vendorLabel = evaluation.profiles?.company_name || evaluation.profiles?.email;
    if (!confirm(`"${vendorLabel}"의 "${evaluation.eval_templates?.title}" 평가를 완전히 삭제할까요?\n제출한 증빙자료, 검토점수, 의견이 모두 함께 삭제되며 되돌릴 수 없어요.`)) return;

    const { data: files } = await supabase
      .from('eval_evidence_files')
      .select('file_url')
      .eq('evaluation_id', evaluation.id);
    if (files && files.length > 0) {
      await supabase.storage.from('vendor-evidence').remove(files.map(f => f.file_url));
    }

    const { error: err } = await supabase.from('evaluations').delete().eq('id', evaluation.id);
    if (err) { setError('삭제 실패: ' + err.message); return; }

    setEvaluations(prev => prev.filter(e => e.id !== evaluation.id));
    if (openEval?.id === evaluation.id) setOpenEval(null);
  };

  if (loading) return <div className="empty">불러오는 중...</div>;

  if (openEval) {
    const scoreOf = r => (r.response.review_score === '' || r.response.review_score == null ? 0 : Number(r.response.review_score));
    const baseRows = reviewRows.filter(r => !r.criterion.is_bonus);
    const bonusRows = reviewRows.filter(r => r.criterion.is_bonus);
    const baseTotal = baseRows.reduce((sum, r) => sum + scoreOf(r), 0);
    const baseMaxTotal = baseRows.reduce((sum, r) => sum + (r.criterion.max_score || 0), 0);
    const bonusTotal = bonusRows.reduce((sum, r) => sum + scoreOf(r), 0);
    const finalTotal = baseTotal + bonusTotal;
    const vendorLabel = openEval.profiles?.company_name || openEval.profiles?.email;

    return (
      <>
        {error && <div className="disclaimer">{error}</div>}
        <div style={{display:'flex', gap:10, marginBottom:14, alignItems:'center', justifyContent:'space-between'}} className="no-print">
          <button
            onClick={() => setOpenEval(null)}
            style={{
              padding:'10px 18px', background:'var(--ink)', color:'#fff', border:'none',
              borderRadius:6, fontSize:14, fontWeight:700, cursor:'pointer',
            }}
          >
            ← 평가 목록으로
          </button>
          <div style={{display:'flex', gap:10}}>
            <button className="add-btn" style={{fontSize:12, padding:'6px 12px'}} onClick={() => window.print()}>🖨 PDF로 저장 / 인쇄</button>
            {openEval.status !== 'pending' && (
              <button className="icon-btn" style={{color:'var(--warn)'}} onClick={cancelSubmission}>제출취소 (다시 작성하게 하기)</button>
            )}
            <button className="icon-btn" style={{color:'var(--warn)'}} onClick={() => deleteEvaluation(openEval)}>평가 삭제</button>
          </div>
        </div>

        <div className="panel review-live-panel">
          <div className="panel-head">
            <h2>{openEval.eval_templates?.title} — {vendorLabel}</h2>
            <div className="cycle-label">{statusLabel[openEval.status]}</div>
          </div>
          {openEval.eval_templates?.legal_basis && (
            <div style={{fontSize:12.5, color:'var(--muted)', marginBottom:14}}>근거: {openEval.eval_templates.legal_basis}</div>
          )}

          {reviewRows.map((row, idx) => (
            <div key={row.criterion.id} style={{borderTop:'1px solid #eee6d3', padding:'16px 4px'}}>
              <div style={{fontWeight:700, fontSize:14.5, marginBottom:4}}>
                {row.criterion.content} <span style={{color:'var(--muted)', fontWeight:500, fontSize:12}}>({row.criterion.is_bonus ? '가점' : '배점'} {row.criterion.max_score})</span>
                {row.criterion.is_bonus && <span className="badge" style={{marginLeft:6, background:'var(--ok-bg)', color:'var(--ok)'}}>가점 항목</span>}
              </div>
              <div style={{fontSize:13, color:'var(--muted)', whiteSpace:'pre-wrap', marginBottom:10}}>{row.criterion.criteria_text}</div>
              {(row.files && row.files.length > 0) ? (
                <div style={{display:'flex', flexDirection:'column', gap:6, marginBottom:8}}>
                  {row.files.map(f => (
                    <ResponseFileLink key={f.id} path={f.file_url} name={f.file_name} getSignedUrl={getSignedUrl} />
                  ))}
                </div>
              ) : (
                <div style={{fontSize:12.5, color:'var(--warn)', fontWeight:700, marginBottom:8}}>⚠ 협력업체가 아직 증빙자료를 첨부하지 않았어요.</div>
              )}
              {row.response.vendor_comment && (
                <div style={{marginTop:8, background:'#fbfaf6', border:'1px solid var(--line)', borderRadius:4, padding:'8px 10px', fontSize:12.5}}>
                  <span style={{fontWeight:700, color:'var(--muted)', fontSize:11}}>협력업체 부연설명</span>
                  <div style={{whiteSpace:'pre-wrap', marginTop:2}}>{row.response.vendor_comment}</div>
                </div>
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

          <div style={{marginTop:8, borderTop:'2px solid var(--ink)', padding:'12px 4px'}}>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:13.5, color:'var(--muted)', marginBottom:4}}>
              <span>기본점수</span>
              <span>{baseTotal} / {baseMaxTotal}</span>
            </div>
            {bonusRows.length > 0 && (
              <div style={{display:'flex', justifyContent:'space-between', fontSize:13.5, color:'var(--ok)', marginBottom:4}}>
                <span>가점</span>
                <span>+{bonusTotal}</span>
              </div>
            )}
            <div style={{display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:16, marginTop:6}}>
              <span>최종점수</span>
              <span>{finalTotal}점</span>
            </div>
          </div>

          <div style={{marginTop:18}}>
            <button className="auth-submit" style={{width:'auto', padding:'11px 28px'}} onClick={submitReview}>검토 결과 저장</button>
          </div>
        </div>

        {/* 인쇄/PDF 저장 전용 리포트 — 화면에는 안 보이고 인쇄할 때만 나타나요 */}
        <div className="print-report">
          <div style={{borderBottom:'4px solid #b10208', paddingBottom:10, marginBottom:14}}>
            <div style={{fontSize:10, letterSpacing:'0.12em', color:'#b10208', fontWeight:700, marginBottom:4}}>SAFETY &amp; HEALTH EVALUATION REPORT</div>
            <h1 style={{fontSize:21, marginBottom:2, color:'#231f20'}}>{openEval.eval_templates?.title} 결과 안내</h1>
          </div>
          <div style={{fontSize:12, color:'#555', marginBottom:16}}>
            평가업체: <b style={{color:'#231f20'}}>{vendorLabel}</b> &nbsp;|&nbsp; 평가기간: {openEval.period_start} ~ {openEval.period_end} &nbsp;|&nbsp; 상태: <b style={{color:'#b10208'}}>{statusLabel[openEval.status]}</b>
          </div>

          <table style={{width:'100%', borderCollapse:'collapse', fontSize:11.5}}>
            <thead>
              <tr>
                <th style={printTh}>No</th>
                <th style={{...printTh, width:'22%'}}>평가내용</th>
                <th style={{...printTh, width:'32%'}}>평가기준</th>
                <th style={printTh}>배점</th>
                <th style={printTh}>검토점수</th>
                <th style={{...printTh, width:'20%'}}>검토의견</th>
              </tr>
            </thead>
            <tbody>
              {reviewRows.map((row, idx) => (
                <tr key={row.criterion.id}>
                  <td style={printTdCenter}>{idx + 1}</td>
                  <td style={printTd}>{row.criterion.content}{row.criterion.is_bonus ? ' (가점)' : ''}</td>
                  <td style={{...printTd, whiteSpace:'pre-wrap'}}>{row.criterion.criteria_text}</td>
                  <td style={{...printTd, textAlign:'center'}}>{row.criterion.max_score}</td>
                  <td style={{...printTd, textAlign:'center'}}>{row.response.review_score === '' || row.response.review_score == null ? '-' : row.response.review_score}</td>
                  <td style={printTd}>{row.response.review_comment}</td>
                </tr>
              ))}
              <tr>
                <td style={{...printTd, fontWeight:700}} colSpan={3}>기본점수 소계</td>
                <td style={{...printTd, fontWeight:700, textAlign:'center'}}>{baseMaxTotal}</td>
                <td style={{...printTd, fontWeight:700, textAlign:'center'}}>{baseTotal}</td>
                <td style={printTd}></td>
              </tr>
              {bonusRows.length > 0 && (
                <tr>
                  <td style={{...printTd, fontWeight:700}} colSpan={3}>가점 소계</td>
                  <td style={printTd}></td>
                  <td style={{...printTd, fontWeight:700, textAlign:'center', color:'#166534'}}>+{bonusTotal}</td>
                  <td style={printTd}></td>
                </tr>
              )}
              <tr>
                <td style={{...printTd, fontWeight:800, background:'#fdecc8', color:'#92400e'}} colSpan={4}>최종점수</td>
                <td style={{...printTd, fontWeight:800, textAlign:'center', background:'#fdecc8', color:'#92400e'}} colSpan={2}>{finalTotal}점</td>
              </tr>
            </tbody>
          </table>

          <div style={{fontSize:10.5, color:'#777', marginTop:20}}>출력일: {new Date().toLocaleDateString('ko-KR')}</div>
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
              <button className="icon-btn" style={{color:'var(--warn)'}} onClick={e => { e.stopPropagation(); deleteEvaluation(ev); }}>삭제</button>
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
