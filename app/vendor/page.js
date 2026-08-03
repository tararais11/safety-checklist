'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

const statusLabel = { pending: '작성중', submitted: '제출완료', reviewed: '검토완료' };

const printTh = { border:'1px solid #888', padding:'6px 8px', background:'#eee', textAlign:'left', fontSize:11.5 };
const printTd = { border:'1px solid #999', padding:'6px 8px', verticalAlign:'top', fontSize:11.5 };

export default function VendorPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [evaluations, setEvaluations] = useState([]);

  const [view, setView] = useState('inprogress'); // 'inprogress' | 'results'
  const [openEval, setOpenEval] = useState(null);
  const [showSubmittedDetail, setShowSubmittedDetail] = useState(false);
  const [rows, setRows] = useState([]);
  const [signedUrls, setSignedUrls] = useState({});
  const [uploadingId, setUploadingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUserEmail(user.email);

    const { data: me } = await supabase.from('profiles').select('company_name, full_name').eq('id', user.id).single();
    setCompanyName(me?.company_name || '');
    setFullName(me?.full_name || '');

    const { data: evs, error: err } = await supabase
      .from('evaluations')
      .select('*, eval_templates(title, legal_basis, notes)')
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); setLoading(false); return; }
    setEvaluations(evs || []);
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => { load(); }, [load]);

  const handleLogout = async () => {
    if (!confirm('정말 로그아웃 하시겠습니까?')) return;
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const openEvaluation = async (ev) => {
    setOpenEval(ev);
    setShowSubmittedDetail(false);

    let criteria;
    if (ev.criteria_snapshot && ev.criteria_snapshot.length > 0) {
      criteria = [...ev.criteria_snapshot].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    } else {
      const { data } = await supabase
        .from('eval_criteria')
        .select('*')
        .eq('template_id', ev.template_id)
        .order('sort_order', { ascending: true });
      criteria = data;
    }

    const { data: responses } = await supabase
      .from('eval_responses')
      .select('*')
      .eq('evaluation_id', ev.id);

    const merged = (criteria || []).map(c => {
      const resp = (responses || []).find(r => r.criterion_id === c.id);
      return { criterion: c, response: resp || null };
    });
    setRows(merged);
  };

  const uploadEvidence = async (criterion, file) => {
    if (!file) return;
    const existing = rows.find(r => r.criterion.id === criterion.id);
    if (existing?.response?.file_url) {
      if (!confirm('이미 첨부된 증빙자료가 있어요. 새 파일로 교체할까요? (기존 파일은 사라져요)')) return;
    }
    setUploadingId(criterion.id);
    const { data: { user } } = await supabase.auth.getUser();
    const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1] : 'dat';
    const path = `${user.id}/${openEval.id}/${criterion.id}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage.from('vendor-evidence').upload(path, file);
    if (upErr) { setError('업로드 실패: ' + upErr.message); setUploadingId(null); return; }

    const { data, error: dbErr } = await supabase
      .from('eval_responses')
      .upsert({
        evaluation_id: openEval.id,
        criterion_id: criterion.id,
        file_url: path,
        file_name: file.name,
      }, { onConflict: 'evaluation_id,criterion_id' })
      .select();

    if (dbErr) { setError('저장 실패: ' + dbErr.message); setUploadingId(null); return; }

    setRows(prev => prev.map(r => r.criterion.id === criterion.id ? { ...r, response: data[0] } : r));
    setUploadingId(null);
  };

  const saveVendorComment = async (criterion, comment) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error: dbErr } = await supabase
      .from('eval_responses')
      .upsert({
        evaluation_id: openEval.id,
        criterion_id: criterion.id,
        vendor_comment: comment,
      }, { onConflict: 'evaluation_id,criterion_id' })
      .select();
    if (dbErr) { setError('의견 저장 실패: ' + dbErr.message); return; }
    setRows(prev => prev.map(r => r.criterion.id === criterion.id ? { ...r, response: { ...(r.response || {}), ...data[0] } } : r));
  };

  const getSignedUrl = async (path) => {
    if (signedUrls[path]) return signedUrls[path];
    const { data } = await supabase.storage.from('vendor-evidence').createSignedUrl(path, 3600);
    if (!data) return null;
    setSignedUrls(prev => ({ ...prev, [path]: data.signedUrl }));
    return data.signedUrl;
  };

  const saveDraft = () => {
    alert('현재까지 작성한 내용이 저장되었어요. 준비되면 "제출하기"를 눌러 관리자에게 보내주세요.');
  };

  const submitEvaluation = async () => {
    const missing = rows.filter(r => !r.response?.file_url);
    if (missing.length > 0) {
      if (!confirm(`아직 ${missing.length}개 항목에 증빙자료가 없어요. 그래도 제출할까요?`)) return;
    } else {
      if (!confirm('평가를 제출할까요? 제출 후에는 내용을 수정할 수 없어요.')) return;
    }
    await supabase.from('evaluations').update({ status: 'submitted' }).eq('id', openEval.id);
    setEvaluations(prev => prev.map(e => e.id === openEval.id ? { ...e, status: 'submitted' } : e));
    setOpenEval(prev => ({ ...prev, status: 'submitted' }));
    alert('제출이 완료되었어요.');
  };

  if (loading) return <div className="app-shell"><div className="main-content"><div className="content-inner"><div className="empty">불러오는 중...</div></div></div></div>;

  const inProgressEvals = evaluations.filter(e => e.status !== 'reviewed');
  const resultEvals = evaluations.filter(e => e.status === 'reviewed');
  const listToShow = view === 'inprogress' ? inProgressEvals : resultEvals;

  return (
    <div className="app-shell">
      <div className="topbar-global">
        <div className="topbar-global-brand">
          <img src="/logo.gif" alt="회사 로고" style={{height:38, marginRight:4}} />
          <span>안전보건</span>&nbsp;<span className="accent">통합관리시스템</span>
        </div>
        <div className="topbar-global-right">
          <span className="topbar-global-email">
            {fullName && companyName ? `${fullName}-${companyName}` : (fullName || companyName || userEmail)}
          </span>
          <button className="topbar-global-logout" onClick={handleLogout}>로그아웃</button>
        </div>
      </div>

      <div className="app-body">
        <aside className="sidebar">
          <nav>
            <div className={"sidebar-nav-item" + (view === 'inprogress' && !openEval ? " active" : "")} onClick={() => { setView('inprogress'); setOpenEval(null); }}>
              <span>📝</span> 평가진행
            </div>
            <div className={"sidebar-nav-item" + (view === 'results' && !openEval ? " active" : "")} onClick={() => { setView('results'); setOpenEval(null); }}>
              <span>📊</span> 평가결과
            </div>
          </nav>
        </aside>

        <main className="main-content">
          <div className="content-inner">
            {error && <div className="disclaimer">{error}</div>}

            {openEval ? (
              <>
                <div className="masthead">
                  <div>
                    <h1>{openEval.eval_templates?.title}</h1>
                    <div className="sub">{openEval.eval_templates?.legal_basis}</div>
                  </div>
                </div>
                <div className="stripe"></div>

                {openEval.eval_templates?.notes && <div className="disclaimer">{openEval.eval_templates.notes}</div>}

                <button className="icon-btn" style={{marginBottom:14}} onClick={() => setOpenEval(null)}>← 목록으로</button>
                {openEval.status === 'reviewed' && (
                  <button className="add-btn" style={{fontSize:12, padding:'6px 12px', marginLeft:10, marginBottom:14}} onClick={() => window.print()}>
                    🖨 PDF로 저장 / 인쇄
                  </button>
                )}

                {openEval.status === 'submitted' ? (
                  <div className="panel">
                    <div style={{textAlign:'center', padding:'36px 20px 28px'}}>
                      <div style={{fontSize:38, marginBottom:10}}>✅</div>
                      <div style={{fontSize:17, fontWeight:800, marginBottom:8}}>제출이 완료되었어요</div>
                      <div style={{fontSize:13.5, color:'var(--muted)', marginBottom:20, lineHeight:1.7}}>
                        관리자 검토를 기다리고 있어요. 제출한 내용은 더 이상 수정할 수 없어요.<br/>
                        검토가 완료되면 "평가결과"에서 점수와 의견을 확인할 수 있어요.
                      </div>
                      <button className="icon-btn" onClick={() => setShowSubmittedDetail(v => !v)}>
                        {showSubmittedDetail ? '제출한 내용 접기 ▲' : '제출한 내용 확인하기 ▼'}
                      </button>
                    </div>
                    {showSubmittedDetail && (
                      <div style={{borderTop:'1px solid #eee6d3', paddingTop:10}}>
                        {rows.map(row => (
                          <EvalRow
                            key={row.criterion.id}
                            row={row}
                            readOnly={true}
                            uploading={false}
                            onUpload={() => {}}
                            onSaveComment={() => {}}
                            getSignedUrl={getSignedUrl}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                <div className="panel review-live-panel">
                  <div className="panel-head">
                    <h2>평가 항목</h2>
                    <div className="cycle-label">{statusLabel[openEval.status]}</div>
                  </div>
                  {rows.map(row => (
                    <EvalRow
                      key={row.criterion.id}
                      row={row}
                      readOnly={openEval.status === 'reviewed'}
                      uploading={uploadingId === row.criterion.id}
                      onUpload={file => uploadEvidence(row.criterion, file)}
                      onSaveComment={comment => saveVendorComment(row.criterion, comment)}
                      getSignedUrl={getSignedUrl}
                    />
                  ))}
                  {openEval.status === 'reviewed' && (
                    <div style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      borderTop:'2px solid var(--ink)', marginTop:8, padding:'10px 4px', fontWeight:800, fontSize:14,
                    }}>
                      <span>합계</span>
                      <span>
                        {rows.reduce((sum, r) => sum + (r.response?.review_score == null ? 0 : Number(r.response.review_score)), 0)}
                        {' '}/{' '}
                        {rows.reduce((sum, r) => sum + (r.criterion.max_score || 0), 0)}
                      </span>
                    </div>
                  )}
                  {openEval.status === 'pending' && (
                    <div style={{marginTop:20, display:'flex', justifyContent:'flex-end', gap:12}}>
                      <button
                        onClick={saveDraft}
                        style={{
                          padding:'12px 22px', background:'#fff', color:'var(--ink)',
                          border:'2px solid var(--ink)', borderRadius:6, fontSize:14, fontWeight:700, cursor:'pointer',
                        }}
                      >
                        저장하기
                      </button>
                      <button
                        onClick={submitEvaluation}
                        style={{
                          padding:'12px 32px', background:'var(--safety)', color:'#fff',
                          border:'none', borderRadius:6, fontSize:16, fontWeight:800, cursor:'pointer',
                          boxShadow:'0 4px 14px rgba(194,65,12,0.35)',
                        }}
                      >
                        제출하기
                      </button>
                    </div>
                  )}
                </div>
                )}

                {openEval.status === 'reviewed' && (
                  <div className="print-report">
                    <h1 style={{fontSize:20, marginBottom:2}}>{openEval.eval_templates?.title}</h1>
                    <div style={{fontSize:12, color:'#555', marginBottom:16}}>
                      평가업체: {companyName || userEmail} &nbsp;|&nbsp; 평가기간: {openEval.period_start} ~ {openEval.period_end} &nbsp;|&nbsp; 상태: {statusLabel[openEval.status]}
                    </div>
                    {openEval.eval_templates?.legal_basis && (
                      <div style={{fontSize:12, marginBottom:12}}><b>평가근거:</b> {openEval.eval_templates.legal_basis}</div>
                    )}
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
                        {rows.map((row, idx) => (
                          <tr key={row.criterion.id}>
                            <td style={printTd}>{idx + 1}</td>
                            <td style={printTd}>{row.criterion.content}</td>
                            <td style={{...printTd, whiteSpace:'pre-wrap'}}>{row.criterion.criteria_text}</td>
                            <td style={{...printTd, textAlign:'center'}}>{row.criterion.max_score}</td>
                            <td style={{...printTd, textAlign:'center'}}>{row.response?.review_score ?? '-'}</td>
                            <td style={printTd}>{row.response?.review_comment}</td>
                          </tr>
                        ))}
                        <tr>
                          <td style={{...printTd, fontWeight:700}} colSpan={3}>합계</td>
                          <td style={{...printTd, fontWeight:700, textAlign:'center'}}>{rows.reduce((sum, r) => sum + (r.criterion.max_score || 0), 0)}</td>
                          <td style={{...printTd, fontWeight:700, textAlign:'center'}}>{rows.reduce((sum, r) => sum + (r.response?.review_score == null ? 0 : Number(r.response.review_score)), 0)}</td>
                          <td style={printTd}></td>
                        </tr>
                      </tbody>
                    </table>
                    <div style={{fontSize:10.5, color:'#777', marginTop:20}}>출력일: {new Date().toLocaleDateString('ko-KR')}</div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="masthead">
                  <div>
                    <h1>{view === 'inprogress' ? '평가진행' : '평가결과'}</h1>
                    <div className="sub">
                      {view === 'inprogress' ? '배정된 평가에 증빙자료를 제출하세요' : '검토가 완료된 평가 결과를 확인하세요'}
                    </div>
                  </div>
                </div>
                <div className="stripe"></div>

                <div className="panel">
                  <div className="panel-head">
                    <h2>{view === 'inprogress' ? '진행 중인 평가' : '완료된 평가'}</h2>
                    <div className="cycle-label">{listToShow.length}건</div>
                  </div>
                  {listToShow.length === 0 && (
                    <div className="empty">
                      {view === 'inprogress' ? '진행 중인 평가가 없어요.' : '아직 완료된 평가가 없어요.'}
                    </div>
                  )}
                  {listToShow.map(ev => (
                    <div className="item" key={ev.id} style={{cursor:'pointer'}} onClick={() => openEvaluation(ev)}>
                      <div className="item-body">
                        <div className="item-name">{ev.eval_templates?.title}</div>
                        <div className="item-meta">
                          {ev.period_start} ~ {ev.period_end}
                          <span className={"badge " + (ev.status === 'reviewed' ? 'ok' : 'warn')} style={{marginLeft:8}}>{statusLabel[ev.status]}</span>
                        </div>
                      </div>
                      <div className="item-actions">
                        <span className="icon-btn">열기 →</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function EvalRow({ row, readOnly, uploading, onUpload, onSaveComment, getSignedUrl }) {
  const [url, setUrl] = useState(null);
  const [comment, setComment] = useState(row.response?.vendor_comment || '');
  const [savedComment, setSavedComment] = useState(row.response?.vendor_comment || '');
  const path = row.response?.file_url;

  useEffect(() => {
    if (path) getSignedUrl(path).then(setUrl);
  }, [path]);

  const reviewed = row.response?.review_score !== undefined && row.response?.review_score !== null;
  const commentChanged = comment !== savedComment;

  return (
    <div className="item" style={{flexDirection:'column', alignItems:'stretch'}}>
      <div className="item-body">
        <div className="item-name">{row.criterion.content} <span style={{color:'var(--muted)', fontWeight:500, fontSize:12}}>(배점 {row.criterion.max_score})</span></div>
        <div className="item-meta" style={{whiteSpace:'pre-wrap'}}>{row.criterion.criteria_text}</div>
      </div>
      <div style={{marginTop:8}}>
        {path ? (
          <div style={{fontSize:13}}>
            📎 {row.response.file_name}{' '}
            {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{color:'var(--safety)'}}>보기 ↗</a>}
          </div>
        ) : (
          <div style={{fontSize:12.5, color:'var(--muted)'}}>증빙자료 없음</div>
        )}
        {!readOnly && (
          <label className="add-btn" style={{cursor:'pointer', display:'inline-block', fontSize:12, marginTop:8}}>
            {uploading ? '업로드 중...' : (path ? '파일 교체' : '증빙자료 첨부')}
            <input type="file" accept="application/pdf,image/*" style={{display:'none'}}
              onChange={e => e.target.files[0] && onUpload(e.target.files[0])} />
          </label>
        )}
      </div>

      <div style={{marginTop:10}}>
        <div style={{fontSize:11.5, fontWeight:700, color:'var(--muted)', marginBottom:4}}>첨부자료에 대한 부연설명 (선택)</div>
        {readOnly ? (
          savedComment ? <div style={{fontSize:12.5, whiteSpace:'pre-wrap'}}>{savedComment}</div> : <div style={{fontSize:12.5, color:'var(--muted)'}}>작성된 설명이 없어요.</div>
        ) : (
          <>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="예: 최근 3년간 재해 미발생으로 우수 기준 충족합니다."
              rows={2}
              style={{width:'100%', padding:'8px 10px', border:'1px solid var(--line)', borderRadius:4, fontSize:12.5, fontFamily:'inherit', background:'#fbfaf6', resize:'vertical'}}
            />
            {commentChanged && (
              <button
                className="icon-btn"
                style={{marginTop:4}}
                onClick={() => { onSaveComment(comment); setSavedComment(comment); }}
              >
                의견 저장
              </button>
            )}
          </>
        )}
      </div>

      {reviewed && (
        <div style={{marginTop:10, background:'#fbfaf6', border:'1px solid var(--line)', borderRadius:4, padding:'10px 12px', fontSize:12.5}}>
          <b>검토점수: {row.response.review_score} / {row.criterion.max_score}</b>
          {row.response.review_comment && <div style={{marginTop:4, color:'var(--muted)'}}>{row.response.review_comment}</div>}
        </div>
      )}
    </div>
  );
}
