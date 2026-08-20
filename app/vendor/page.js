'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import AnnouncementsPanel from '../components/AnnouncementsPanel';

const statusLabel = { pending: '작성중', submitted: '제출완료', reviewed: '검토완료' };

const printTh = {
  border:'1px solid #4a4a4a', padding:'8px 9px', background:'#231f20', color:'#ffffff',
  textAlign:'center', fontSize:11.5, fontWeight:700, WebkitPrintColorAdjust:'exact', printColorAdjust:'exact',
};
const printTd = { border:'1px solid #c9c2ad', padding:'7px 9px', verticalAlign:'top', fontSize:11.5, textAlign:'left' };
const printTdCenter = { ...printTd, textAlign:'center' };

export default function VendorPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [evaluations, setEvaluations] = useState([]);

  const [view, setView] = useState('home'); // 'home' | 'inprogress' | 'results' | 'announcements'
  const [openEval, setOpenEval] = useState(null);
  const [showSubmittedDetail, setShowSubmittedDetail] = useState(false);
  const [openAnnouncementId, setOpenAnnouncementId] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
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

    const { data: ann } = await supabase
      .from('announcements')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5);
    setAnnouncements(ann || []);

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

    const { data: evidenceFiles } = await supabase
      .from('eval_evidence_files')
      .select('*')
      .eq('evaluation_id', ev.id)
      .order('uploaded_at', { ascending: true });

    const merged = (criteria || []).map(c => {
      const resp = (responses || []).find(r => r.criterion_id === c.id);
      const files = (evidenceFiles || []).filter(f => f.criterion_id === c.id);
      return { criterion: c, response: resp || null, files };
    });
    setRows(merged);
  };

  const addEvidenceFile = async (criterion, file) => {
    if (!file) return;
    setUploadingId(criterion.id);
    const { data: { user } } = await supabase.auth.getUser();
    const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1] : 'dat';
    const path = `${user.id}/${openEval.id}/${criterion.id}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage.from('vendor-evidence').upload(path, file);
    if (upErr) { setError('업로드 실패: ' + upErr.message); setUploadingId(null); return; }

    const { data, error: dbErr } = await supabase
      .from('eval_evidence_files')
      .insert({
        evaluation_id: openEval.id,
        criterion_id: criterion.id,
        file_url: path,
        file_name: file.name,
      })
      .select();

    if (dbErr) { setError('저장 실패: ' + dbErr.message); setUploadingId(null); return; }

    setRows(prev => prev.map(r => r.criterion.id === criterion.id ? { ...r, files: [...(r.files || []), data[0]] } : r));
    setUploadingId(null);
  };

  const removeEvidenceFile = async (criterion, file) => {
    if (!confirm(`"${file.file_name}" 파일을 삭제할까요?`)) return;
    await supabase.storage.from('vendor-evidence').remove([file.file_url]);
    await supabase.from('eval_evidence_files').delete().eq('id', file.id);
    setRows(prev => prev.map(r => r.criterion.id === criterion.id ? { ...r, files: (r.files || []).filter(f => f.id !== file.id) } : r));
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
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    alert('현재까지 작성한 내용이 저장되었어요. 준비되면 "제출하기"를 눌러 관리자에게 보내주세요.');
  };

  const submitEvaluation = async () => {
    const missing = rows.filter(r => !(r.files && r.files.length > 0));
    if (missing.length > 0) {
      if (!confirm(`아직 ${missing.length}개 항목에 증빙자료가 없어요. 그래도 제출할까요?`)) return;
    } else {
      if (!confirm('평가를 제출할까요? 제출 후에는 내용을 수정할 수 없어요.')) return;
    }
    await supabase.from('evaluations').update({ status: 'submitted' }).eq('id', openEval.id);
    fetch('/api/notify/evaluation-submitted', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evaluationId: openEval.id }),
    }).catch(() => {});
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
        <div className="topbar-global-brand" style={{cursor:'pointer'}} onClick={() => { setView('home'); setOpenEval(null); }}>
          <img
            src="/logo.gif"
            alt="회사 로고"
            style={{height:38, marginRight:4}}
            onError={e => {
              if (!e.currentTarget.dataset.retried) {
                e.currentTarget.dataset.retried = '1';
                e.currentTarget.src = '/logo.gif?retry=' + Date.now();
              } else {
                e.currentTarget.style.display = 'none';
              }
            }}
          />
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
            <div className={"sidebar-nav-item" + (view === 'home' && !openEval ? " active" : "")} onClick={() => { setView('home'); setOpenEval(null); }}>
              <span>🏠</span> 홈
            </div>
            <div className={"sidebar-nav-item" + (view === 'announcements' && !openEval ? " active" : "")} onClick={() => { setOpenAnnouncementId(null); setView('announcements'); setOpenEval(null); }}>
              <span>📢</span> 공지사항
            </div>
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

                {openEval.eval_templates?.notes && <div className="disclaimer no-print">{openEval.eval_templates.notes}</div>}

                <div style={{display:'flex', gap:10, marginBottom:14, alignItems:'center', justifyContent:'space-between'}} className="no-print">
                  <button
                    onClick={() => setOpenEval(null)}
                    style={{
                      padding:'10px 18px', background:'var(--ink)', color:'#fff', border:'none',
                      borderRadius:6, fontSize:14, fontWeight:700, cursor:'pointer',
                    }}
                  >
                    ← 목록으로
                  </button>
                  {openEval.status === 'reviewed' && (
                    <button className="add-btn" style={{fontSize:12, padding:'6px 12px'}} onClick={() => window.print()}>
                      🖨 PDF로 저장 / 인쇄
                    </button>
                  )}
                </div>

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
                            onRemove={() => {}}
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
                      onUpload={file => addEvidenceFile(row.criterion, file)}
                      onRemove={file => removeEvidenceFile(row.criterion, file)}
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
                          boxShadow:'0 4px 14px rgba(177,2,8,0.35)',
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
                    <div style={{borderBottom:'4px solid #b10208', paddingBottom:10, marginBottom:14}}>
                      <div style={{fontSize:10, letterSpacing:'0.12em', color:'#b10208', fontWeight:700, marginBottom:4}}>SAFETY &amp; HEALTH EVALUATION REPORT</div>
                      <h1 style={{fontSize:21, marginBottom:2, color:'#231f20'}}>{openEval.eval_templates?.title}</h1>
                    </div>
                    <div style={{fontSize:12, color:'#555', marginBottom:16}}>
                      평가업체: <b style={{color:'#231f20'}}>{companyName || userEmail}</b> &nbsp;|&nbsp; 평가기간: {openEval.period_start} ~ {openEval.period_end} &nbsp;|&nbsp; 상태: <b style={{color:'#b10208'}}>{statusLabel[openEval.status]}</b>
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
                            <td style={printTdCenter}>{idx + 1}</td>
                            <td style={printTd}>{row.criterion.content}</td>
                            <td style={{...printTd, whiteSpace:'pre-wrap'}}>{row.criterion.criteria_text}</td>
                            <td style={{...printTd, textAlign:'center'}}>{row.criterion.max_score}</td>
                            <td style={{...printTd, textAlign:'center'}}>{row.response?.review_score ?? '-'}</td>
                            <td style={printTd}>{row.response?.review_comment}</td>
                          </tr>
                        ))}
                        <tr>
                          <td style={{...printTd, fontWeight:800, background:'#fdecc8', color:'#92400e'}} colSpan={3}>합계</td>
                          <td style={{...printTd, fontWeight:800, textAlign:'center', background:'#fdecc8', color:'#92400e'}}>{rows.reduce((sum, r) => sum + (r.criterion.max_score || 0), 0)}</td>
                          <td style={{...printTd, fontWeight:800, textAlign:'center', background:'#fdecc8', color:'#92400e'}}>{rows.reduce((sum, r) => sum + (r.response?.review_score == null ? 0 : Number(r.response.review_score)), 0)}</td>
                          <td style={{...printTd, background:'#fdecc8'}}></td>
                        </tr>
                      </tbody>
                    </table>
                    <div style={{fontSize:10.5, color:'#777', marginTop:20}}>출력일: {new Date().toLocaleDateString('ko-KR')}</div>
                  </div>
                )}
              </>
            ) : view === 'home' ? (
              <>
                <div className="masthead">
                  <div>
                    <h1>홈</h1>
                    <div className="sub">공지사항과 진행중인 평가를 확인하세요</div>
                  </div>
                </div>
                <div className="stripe"></div>

                <div className="home-grid">
                  <div className="panel">
                    <div className="panel-head">
                      <h2>공지사항</h2>
                      <span className="icon-btn" style={{cursor:'pointer'}} onClick={() => { setOpenAnnouncementId(null); setView('announcements'); }}>더보기 →</span>
                    </div>
                    {announcements.length === 0 && <div className="empty">등록된 공지사항이 없어요.</div>}
                    {announcements.map(a => (
                      <div className="item" key={a.id} style={{cursor:'pointer'}} onClick={() => { setOpenAnnouncementId(a.id); setView('announcements'); }}>
                        <div className="item-body">
                          <div className="item-name">{a.pinned && '📌 '}{a.title}</div>
                          <div className="item-meta">{new Date(a.created_at).toLocaleDateString('ko-KR')}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="panel">
                    <div className="panel-head">
                      <h2>진행중인 평가</h2>
                      <span className="icon-btn" style={{cursor:'pointer'}} onClick={() => setView('inprogress')}>더보기 →</span>
                    </div>
                    {inProgressEvals.length === 0 && <div className="empty">진행 중인 평가가 없어요.</div>}
                    {inProgressEvals.slice(0, 5).map(ev => (
                      <div className="item" key={ev.id} style={{cursor:'pointer'}} onClick={() => openEvaluation(ev)}>
                        <div className="item-body">
                          <div className="item-name">{ev.eval_templates?.title}</div>
                          <div style={{fontSize:13.5, fontWeight:700, color:'var(--ink)', marginTop:4}}>
                            📅 {ev.period_start} ~ <span style={{color:'var(--safety)'}}>{ev.period_end}</span>
                          </div>
                          <div className="item-meta" style={{marginTop:4}}>
                            <span className={"badge " + (ev.status === 'submitted' ? 'ok' : 'warn')}>{statusLabel[ev.status]}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : view === 'announcements' ? (
              <>
                <div className="masthead">
                  <div>
                    <h1>공지사항</h1>
                    <div className="sub">회사 공지사항을 확인하세요</div>
                  </div>
                </div>
                <div className="stripe"></div>
                <AnnouncementsPanel isAdmin={false} openAnnouncementId={openAnnouncementId} />
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
                        <div style={{fontSize:13.5, fontWeight:700, color:'var(--ink)', marginTop:4}}>
                          📅 {ev.period_start} ~ <span style={{color:'var(--safety)'}}>{ev.period_end}</span>
                        </div>
                        <div className="item-meta" style={{marginTop:4}}>
                          <span className={"badge " + (ev.status === 'reviewed' ? 'ok' : 'warn')}>{statusLabel[ev.status]}</span>
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

function EvalRow({ row, readOnly, uploading, onUpload, onRemove, onSaveComment, getSignedUrl }) {
  const [urls, setUrls] = useState({});
  const [comment, setComment] = useState(row.response?.vendor_comment || '');
  const [savedComment, setSavedComment] = useState(row.response?.vendor_comment || '');
  const files = row.files || [];

  useEffect(() => {
    files.forEach(f => {
      if (!urls[f.file_url]) {
        getSignedUrl(f.file_url).then(u => setUrls(prev => ({ ...prev, [f.file_url]: u })));
      }
    });
  }, [files.map(f => f.id).join(',')]);

  const reviewed = row.response?.review_score !== undefined && row.response?.review_score !== null;
  const commentChanged = comment !== savedComment;

  return (
    <div className="item" style={{flexDirection:'column', alignItems:'stretch'}}>
      <div className="item-body">
        <div className="item-name">{row.criterion.content} <span style={{color:'var(--muted)', fontWeight:500, fontSize:12}}>(배점 {row.criterion.max_score})</span></div>
        <div className="item-meta" style={{whiteSpace:'pre-wrap'}}>{row.criterion.criteria_text}</div>
      </div>
      <div style={{marginTop:8}}>
        {files.length > 0 ? (
          <div style={{display:'flex', flexDirection:'column', gap:6}}>
            {files.map(f => (
              <div key={f.id} style={{fontSize:13, display:'flex', alignItems:'center', gap:8}}>
                📎 {f.file_name}{' '}
                {urls[f.file_url] && <a href={urls[f.file_url]} target="_blank" rel="noopener noreferrer" style={{color:'var(--safety)'}}>보기 ↗</a>}
                {!readOnly && (
                  <button className="icon-btn" style={{fontSize:11, padding:'2px 8px'}} onClick={() => onRemove(f)}>삭제</button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{fontSize:12.5, color:'var(--muted)'}}>증빙자료 없음</div>
        )}
        {!readOnly && (
          <label className="add-btn" style={{cursor:'pointer', display:'inline-block', fontSize:12, marginTop:8}}>
            {uploading ? '업로드 중...' : '+ 증빙자료 첨부'}
            <input type="file" accept="application/pdf,image/*" style={{display:'none'}}
              onChange={e => { if (e.target.files[0]) { onUpload(e.target.files[0]); e.target.value = ''; } }} />
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
              onBlur={() => { if (comment !== savedComment) { onSaveComment(comment); setSavedComment(comment); } }}
              placeholder="예: 최근 3년간 재해 미발생으로 우수 기준 충족합니다."
              rows={2}
              style={{width:'100%', padding:'8px 10px', border:'1px solid var(--line)', borderRadius:4, fontSize:12.5, fontFamily:'inherit', background:'#fbfaf6', resize:'vertical'}}
            />
            {commentChanged ? (
              <div style={{fontSize:11, color:'var(--warn)', marginTop:4}}>다른 곳을 클릭하면 자동 저장돼요</div>
            ) : (
              savedComment && <div style={{fontSize:11, color:'var(--ok)', marginTop:4}}>✓ 저장됨</div>
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
