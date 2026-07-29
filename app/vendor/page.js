'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

const statusLabel = { pending: '작성중', submitted: '제출완료', reviewed: '검토완료' };

export default function VendorPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [evaluations, setEvaluations] = useState([]);

  const [view, setView] = useState('inprogress'); // 'inprogress' | 'results'
  const [openEval, setOpenEval] = useState(null);
  const [rows, setRows] = useState([]);
  const [signedUrls, setSignedUrls] = useState({});
  const [uploadingId, setUploadingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUserEmail(user.email);

    const { data: me } = await supabase.from('profiles').select('company_name').eq('id', user.id).single();
    setCompanyName(me?.company_name || '');

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
    const { data: criteria } = await supabase
      .from('eval_criteria')
      .select('*')
      .eq('template_id', ev.template_id)
      .order('sort_order', { ascending: true });

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

  const getSignedUrl = async (path) => {
    if (signedUrls[path]) return signedUrls[path];
    const { data } = await supabase.storage.from('vendor-evidence').createSignedUrl(path, 3600);
    if (!data) return null;
    setSignedUrls(prev => ({ ...prev, [path]: data.signedUrl }));
    return data.signedUrl;
  };

  const submitEvaluation = async () => {
    const missing = rows.filter(r => !r.response?.file_url);
    if (missing.length > 0 && !confirm(`아직 ${missing.length}개 항목에 증빙자료가 없어요. 그래도 제출할까요?`)) return;
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
          <span>안전보건</span>&nbsp;<span className="accent">통합관리시스템</span>
        </div>
        <div className="topbar-global-right">
          <span className="topbar-global-email">{companyName || userEmail}</span>
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

                <div className="panel">
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
                  {openEval.status !== 'reviewed' && (
                    <div style={{marginTop:16}}>
                      <button className="auth-submit" style={{width:'auto', padding:'11px 24px'}} onClick={submitEvaluation}>
                        제출하기
                      </button>
                    </div>
                  )}
                </div>
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

function EvalRow({ row, readOnly, uploading, onUpload, getSignedUrl }) {
  const [url, setUrl] = useState(null);
  const path = row.response?.file_url;

  useEffect(() => {
    if (path) getSignedUrl(path).then(setUrl);
  }, [path]);

  const reviewed = row.response?.review_score !== undefined && row.response?.review_score !== null;

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
      {reviewed && (
        <div style={{marginTop:10, background:'#fbfaf6', border:'1px solid var(--line)', borderRadius:4, padding:'10px 12px', fontSize:12.5}}>
          <b>검토점수: {row.response.review_score} / {row.criterion.max_score}</b>
          {row.response.review_comment && <div style={{marginTop:4, color:'var(--muted)'}}>{row.response.review_comment}</div>}
        </div>
      )}
    </div>
  );
}
