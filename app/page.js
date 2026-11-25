'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { parseBudgetFile } from '../lib/parseBudget';
import { parseActivityClipboard } from '../lib/parseActivity';
import PrintReport from './PrintReport';

/* ───────── 기본값 ───────── */
const THIS_YEAR = new Date().getFullYear();
const YEARS = [THIS_YEAR - 2, THIS_YEAR - 1, THIS_YEAR];

const emptyData = () => ({
  system: {
    roles: {
      ceo: { name: '', title: '' }, // 안전보건관리책임자
      teamLead: { name: '', title: '' }, // 안전보건관리팀장
      safetyMgr: { name: '', title: '' }, // 안전관리자
      healthMgr: { name: '', title: '' }, // 보건관리자
    },
    supervisors: [], // {dept, name, eduDate}
    committee: '운영',
    note: '',
  },
  accident: { workers: 0, injured: 0, deaths: 0, disease: 0 },
  activity: { items: [] }, // {kind:'result'|'plan', title, detail, status}
  invest: { items: [], monthly: [], details: [], source: null }, // 엑셀 불러오기 시 monthly·details·source 채워짐
  prevent: { items: [] }, // {title, status:'조치필요'|'조치완료', due}
  contractor: { applicable: false, deaths: 0, note: '도급 협력업체 없음' },
  meta: { company: '', ceoName: '', dept: '안전보건관리팀', writer: '' },
});

const DEMO = {
  system: {
    roles: {
      ceo: { name: '홍길동', title: '대표이사' },
      teamLead: { name: '김안전', title: '안전보건관리팀장' },
      safetyMgr: { name: '이관리', title: '안전보건관리팀 과장' },
      healthMgr: { name: '박보건', title: '안전보건관리팀 대리' },
    },
    supervisors: [
      { dept: '네트워크사업본부', name: '최감독', eduDate: '2026-11-12' },
      { dept: '보안사업본부', name: '정감독', eduDate: '2026-11-12' },
      { dept: '클라우드사업본부', name: '한감독', eduDate: '' },
    ],
    committee: '운영',
    note: '본부별 관리감독자 지정 완료',
  },
  accident: { workers: 440, injured: 2, deaths: 0, disease: 0 },
  activity: {
    items: [
      { kind: 'result', title: '정기 위험성평가', detail: '전 부서', status: '완료' },
      { kind: 'result', title: '관리감독자 정기교육', detail: '8시간', status: '완료' },
      { kind: 'result', title: '비상대응훈련', detail: '반기 1회', status: '진행중' },
      { kind: 'result', title: '산업안전보건위원회', detail: '분기 1회', status: '완료' },
      { kind: 'plan', area: '안전보건 법규준수', title: '정기 안전보건교육 (상/하반기)', detail: '전 근로자', quarters: [true, true, true, true], status: '진행중' },
      { kind: 'plan', area: '안전보건 경영시스템 구축', title: '위험성평가 - 정기평가', detail: '1회 (년 1회)', quarters: [false, true, false, false], months: '6월', status: '완료' },
      { kind: 'plan', area: '안전보건 경영시스템 구축', title: '산업안전보건위원회 개최', detail: '4회 (분기 1회)', quarters: [true, true, true, true], status: '진행중' },
      { kind: 'plan', area: '안전보건 경영시스템 구축', title: '내년도 교육 필요성 파악', detail: '1회', quarters: [false, false, false, true], months: '12월', status: '예정' },
    ],
  },
  invest: {
    items: [
      { name: '교육', budget: 12000000, executed: 9000000 },
      { name: '보호구', budget: 8000000, executed: 7600000 },
      { name: '건강관리', budget: 15000000, executed: 6000000 },
      { name: '시설개선', budget: 20000000, executed: 4000000 },
      { name: '평가·인증', budget: 5000000, executed: 5000000 },
    ],
    monthly: [250000, 0, 0, 195000, 2028290, 1988000, 3401360, 3010360, 4069380, 3522250, 693000, 0],
    details: [
      { group: '교육', name: '직무교육 (관리감독자)', budget: 550000, executed: 693000 },
      { group: '보호구', name: '안전화', budget: 1000000, executed: 900000 },
    ],
    source: { file: '예시 파일.xlsx', sheet: '안전보건예산 내역', at: '2026-11-24' },
  },
  prevent: {
    items: [
      { title: '사다리 작업 2인 1조 의무화', status: '조치완료', due: '2026-06-30' },
      { title: '이동 중 교통사고 예방교육', status: '조치필요', due: '2026-12-31' },
    ],
  },
  contractor: { applicable: false, deaths: 0, note: '도급 협력업체 없음' },
  meta: { company: '㈜예시회사', ceoName: '홍길동', dept: '안전보건관리팀', writer: '정안전' },
};

const merge = (d) => {
  const base = emptyData();
  const out = { ...base };
  Object.keys(base).forEach((k) => (out[k] = { ...base[k], ...(d?.[k] || {}) }));
  // 예전 형식(책임자 이름만, 인원수 숫자)으로 저장된 1호 데이터를 새 형식으로 옮겨요
  const sys = out.system;
  const old = d?.system || {};
  sys.roles = { ...base.system.roles, ...(old.roles || {}) };
  if (!old.roles && old.ceo) sys.roles.ceo = { name: old.ceo, title: old.ceoTitle || '' };
  if (!Array.isArray(sys.supervisors)) sys.supervisors = [];
  ['ceo', 'ceoTitle', 'safetyMgr', 'healthMgr'].forEach((k) => delete sys[k]);
  return out;
};

/* ───────── 유틸 ───────── */
const won = (n) => (Number(n) || 0).toLocaleString('ko-KR');
const man = (n) => (n >= 10000 ? `${Math.round(n / 10000).toLocaleString('ko-KR')}만` : `${Math.round(n)}`);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const ROLES = [
  ['ceo', '안전보건관리책임자'],
  ['teamLead', '안전보건관리팀장'],
  ['safetyMgr', '안전관리자'],
  ['healthMgr', '보건관리자'],
];
const STATUS_COLOR = { 완료: 'green', 조치완료: 'green', 진행중: 'blue', 예정: 'gray', 지연: 'orange', 조치필요: 'orange', 미실시: 'red' };

function dday() {
  const due = new Date(`${THIS_YEAR + (new Date().getMonth() > 3 ? 1 : 0)}-04-30T23:59:59+09:00`);
  const diff = Math.ceil((due - new Date()) / 86400000);
  return { due, diff };
}

/* ───────── 작은 컴포넌트 ───────── */
function Gauge({ value, color, label }) {
  const v = Math.max(0, Math.min(100, value));
  const r = 70;
  const len = Math.PI * r;
  return (
    <div className="gauge">
      <svg width="180" height="100" viewBox="0 0 180 100" aria-hidden="true">
        <path d="M20 90 A70 70 0 0 1 160 90" fill="none" stroke="var(--track)" strokeWidth="22" />
        <path
          d="M20 90 A70 70 0 0 1 160 90"
          fill="none"
          stroke={color}
          strokeWidth="22"
          strokeDasharray={`${(len * v) / 100} ${len}`}
        />
      </svg>
      <div className="gauge-v">{v}%</div>
      <div className="gauge-l">{label}</div>
    </div>
  );
}

function Card({ no, title, onEdit, right, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      <div className="card-head">
        <div className="card-title">
          {title}
          {no && <span className="card-no">{no}</span>}
        </div>
        {right}
        {onEdit && (
          <button className="card-link" onClick={onEdit}>
            수정
          </button>
        )}
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}

function Stat({ label, value, unit }) {
  return (
    <div className="stat">
      <p className="stat-l">{label}</p>
      <p className="stat-v">
        {value}
        {unit && <small>{unit}</small>}
      </p>
    </div>
  );
}

function Modal({ title, onClose, onSave, saving, children, wide }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`}>
        <div className="modal-head">
          {title}
          <button className="x-btn" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {onSave && (
          <div className="modal-foot">
            <button className="btn" onClick={onClose}>
              취소
            </button>
            <button className="btn primary" onClick={onSave} disabled={saving}>
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Quarters({ q = [] }) {
  return (
    <span className="qdots" aria-label={`${[0, 1, 2, 3].filter((k) => q[k]).map((k) => k + 1).join(', ')}분기`}>
      {[0, 1, 2, 3].map((k) => (
        <i key={k} className={q[k] ? 'on' : ''} />
      ))}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

/* 목록 편집기 */
function ListEditor({ rows, setRows, cols, blank }) {
  const tpl = cols.map((c) => c.w || '1fr').join(' ') + ' 28px';
  const set = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div>
      <div className="list-row" style={{ gridTemplateColumns: tpl, fontSize: 12, color: 'var(--muted)' }}>
        {cols.map((c) => (
          <span key={c.key}>{c.label}</span>
        ))}
        <span />
      </div>
      {rows.map((r, i) => (
        <div className="list-row" key={i} style={{ gridTemplateColumns: tpl }}>
          {cols.map((c) =>
            c.options ? (
              <select key={c.key} className="input" value={r[c.key] ?? ''} onChange={(e) => set(i, c.key, e.target.value)}>
                {c.options.map((o) => (
                  <option key={o.value ?? o} value={o.value ?? o}>
                    {o.label ?? o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                key={c.key}
                className="input"
                type={c.type || 'text'}
                value={r[c.key] ?? ''}
                onChange={(e) => set(i, c.key, c.type === 'number' ? Number(e.target.value) : e.target.value)}
              />
            )
          )}
          <button className="x-btn" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="삭제">
            ×
          </button>
        </div>
      ))}
      <button className="btn sm" onClick={() => setRows([...rows, { ...blank }])}>
        + 항목 추가
      </button>
    </div>
  );
}

/* ───────── 로그인 화면 ───────── */
function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    setBusy(true);
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) setErr('이메일 또는 비밀번호를 확인해 주세요.');
    } else {
      if (!name.trim()) {
        setErr('이름을 입력해 주세요.');
        setBusy(false);
        return;
      }
      const { error } = await supabase.auth.signUp({ email, password: pw, options: { data: { name } } });
      if (error) setErr(error.message.includes('Password') ? '비밀번호는 6자 이상이어야 해요.' : '가입에 실패했어요. 다시 시도해 주세요.');
      else setMsg('가입 신청이 완료됐어요. 관리자 승인 후 이용할 수 있어요.');
    }
    setBusy(false);
  };

  return (
    <div className="auth">
      <form className="card" onSubmit={submit}>
        <h1>안전보건공시 대시보드</h1>
        <p>{mode === 'login' ? '로그인해 주세요' : '가입 후 관리자 승인을 받아야 해요'}</p>
        {mode === 'signup' && (
          <Field label="이름">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        )}
        <Field label="이메일">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="비밀번호">
          <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        </Field>
        {err && <div className="err">{err}</div>}
        {msg && <div className="ok-msg">{msg}</div>}
        <button className="btn primary" style={{ width: '100%', padding: 11 }} disabled={busy}>
          {busy ? '처리 중…' : mode === 'login' ? '로그인' : '가입 신청'}
        </button>
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button type="button" className="link-btn" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? '처음이신가요? 가입 신청' : '이미 계정이 있어요'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ───────── 메인 ───────── */
export default function Page() {
  const demo = !supabase;
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(demo);

  useEffect(() => {
    if (demo) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [demo]);

  useEffect(() => {
    if (demo || !session) return setProfile(null);
    setProfile(undefined);
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => setProfile(error ? { _error: error.message } : data || { _missing: true }));
  }, [session, demo]);

  if (!ready) return <div className="auth"><p style={{ color: 'var(--sub)' }}>불러오는 중…</p></div>;
  if (demo) return <Dashboard demo isAdmin profile={{ name: '미리보기' }} />;
  if (!session) return <AuthScreen />;
  if (profile === undefined || profile === null)
    return <div className="auth"><p style={{ color: 'var(--sub)' }}>불러오는 중…</p></div>;
  if (profile._error || profile._missing)
    return (
      <div className="auth">
        <div className="card">
          <h1>사용자 정보를 찾지 못했어요</h1>
          <p>
            {profile._error
              ? `Supabase 연결 오류: ${profile._error}`
              : '가입은 됐지만 사용자 정보가 만들어지지 않았어요. 관리자에게 문의해 주세요.'}
          </p>
          <button className="btn" onClick={() => supabase.auth.signOut()}>
            로그아웃
          </button>
        </div>
      </div>
    );
  if (!profile.approved)
    return (
      <div className="auth">
        <div className="card">
          <h1>승인 대기 중</h1>
          <p>관리자가 가입을 승인하면 대시보드를 볼 수 있어요.</p>
          <button className="btn" onClick={() => supabase.auth.signOut()}>
            로그아웃
          </button>
        </div>
      </div>
    );
  return <Dashboard isAdmin={profile.role === 'admin'} profile={profile} />;
}

function Dashboard({ demo, isAdmin, profile }) {
  const [year, setYear] = useState(THIS_YEAR);
  const [rec, setRec] = useState(null); // {data, ceo_confirmed, ceo_confirmed_at}
  const [edit, setEdit] = useState(null); // 편집 중인 섹션 키
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actTab, setActTab] = useState('result');
  const [hover, setHover] = useState(null);
  const [hoverM, setHoverM] = useState(null);
  const [importMsg, setImportMsg] = useState(null);
  const [showUsers, setShowUsers] = useState(false);
  const [showSup, setShowSup] = useState(false);
  const [showActs, setShowActs] = useState(false);
  const [pasteRes, setPasteRes] = useState(null);
  const [pasteKind, setPasteKind] = useState('plan');

  useEffect(() => {
    setRec(null);
    if (demo) {
      setRec({ data: merge(DEMO), ceo_confirmed: false, ceo_confirmed_at: null });
      return;
    }
    supabase
      .from('disclosures')
      .select('*')
      .eq('year', year)
      .maybeSingle()
      .then(({ data }) => setRec(data ? { ...data, data: merge(data.data) } : { data: emptyData(), ceo_confirmed: false, ceo_confirmed_at: null }));
  }, [year, demo]);

  const d = rec?.data;

  const save = async (patch) => {
    setSaving(true);
    const next = { ...rec, ...patch };
    if (!demo) {
      const { error } = await supabase.from('disclosures').upsert({
        year,
        data: next.data,
        ceo_confirmed: next.ceo_confirmed,
        ceo_confirmed_at: next.ceo_confirmed_at,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        alert('저장하지 못했어요: ' + error.message);
        setSaving(false);
        return;
      }
    }
    setRec(next);
    setSaving(false);
    setEdit(null);
  };

  const open = (key) => {
    setEdit(key);
    setDraft(key === 'ceo' ? { ceo_confirmed: rec.ceo_confirmed, ceo_confirmed_at: rec.ceo_confirmed_at || '', meta: { ...d.meta } } : structuredClone(d[key]));
  };
  const saveDraft = () =>
    edit === 'ceo'
      ? save({ ceo_confirmed: draft.ceo_confirmed, ceo_confirmed_at: draft.ceo_confirmed ? draft.ceo_confirmed_at || null : null, data: { ...d, meta: draft.meta } })
      : save({ data: { ...d, [edit]: draft } });

  /* 계산 */
  const inv = useMemo(() => {
    if (!d) return null;
    const budget = d.invest.items.reduce((s, i) => s + (Number(i.budget) || 0), 0);
    const executed = d.invest.items.reduce((s, i) => s + (Number(i.executed) || 0), 0);
    return { budget, executed, rest: budget - executed, rate: pct(executed, budget) };
  }, [d]);

  if (!d) return null;

  const prevDone = d.prevent.items.filter((i) => i.status === '조치완료').length;
  const prevTodo = d.prevent.items.length - prevDone;
  const accRate = d.accident.workers > 0 ? ((d.accident.injured / d.accident.workers) * 100).toFixed(2) : '0.00';
  const allActs = d.activity.items.map((x, idx) => ({ ...x, idx }));
  const DONE_LIKE = ['완료', '진행중', '지연', '미실시'];
  const acts = allActs.filter((i) =>
    actTab === 'plan' ? i.kind === 'plan' : i.kind === 'result' || (i.kind === 'plan' && DONE_LIKE.includes(i.status))
  );
  const plans = allActs.filter((i) => i.kind === 'plan');
  const planDone = plans.filter((i) => i.status === '완료').length;
  const planIng = plans.filter((i) => i.status === '진행중').length;
  const setActStatus = (idx, status) =>
    save({ data: { ...d, activity: { ...d.activity, items: d.activity.items.map((x, j) => (j === idx ? { ...x, status } : x)) } } });
  const onActPaste = (e) => {
    e.preventDefault();
    try {
      const r = parseActivityClipboard(e.clipboardData.getData('text/html'), e.clipboardData.getData('text/plain'));
      setPasteRes({ items: r.items.map((x) => ({ ...x, kind: pasteKind })) });
    } catch (err) {
      setPasteRes({ error: err.message });
    }
  };
  const applyPaste = (replace) => {
    // 같은 구분·내용의 항목이 이미 있으면 대시보드에서 바꿔둔 상태(완료 등)를 그대로 이어받아요
    const prevStatus = new Map(draft.items.filter((x) => x.kind === pasteKind).map((x) => [`${x.area || ''}|${x.title}`, x.status]));
    const items = pasteRes.items.map((x) => ({
      ...x,
      kind: pasteKind,
      status: prevStatus.get(`${x.area || ''}|${x.title}`) || (pasteKind === 'result' ? '완료' : x.status),
    }));
    setDraft({ ...draft, items: replace ? [...draft.items.filter((x) => x.kind !== pasteKind), ...items] : [...draft.items, ...items] });
    setPasteRes(null);
  };
  const { diff } = dday();
  const edit_ = (k) => (isAdmin ? () => open(k) : undefined);
  const barColors = ['var(--teal)', 'var(--yellow)', 'var(--coral)', 'var(--blue)'];
  const maxMonth = Math.max(0, ...(d.invest.monthly || []));
  const sup = d.system.supervisors || [];
  const exportPdf = () => {
    const prevTitle = document.title;
    document.title = `${year}년 안전보건 현황 공시자료${d.meta?.company ? '_' + d.meta.company : ''}`;
    const restore = () => {
      document.title = prevTitle;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
  };
  const supDone = sup.filter((x) => x.eduDate).length;
  const over = (d.invest.details || []).filter((x) => x.executed > x.budget).sort((a, b) => b.executed - b.budget - (a.executed - a.budget));
  const importExcel = async (file) => {
    if (!file) return;
    setImportMsg({ busy: true, text: '엑셀을 읽는 중…' });
    try {
      const r = await parseBudgetFile(file);
      setDraft({
        ...draft,
        items: r.items,
        monthly: r.monthly,
        details: r.details,
        source: { file: file.name, sheet: r.sheetName, at: new Date().toISOString().slice(0, 10) },
      });
      setImportMsg({
        ok: true,
        text: `「${r.sheetName}」 시트에서 구분 ${r.items.length}개, 세부 항목 ${r.details.length}개를 읽었어요. 확인하고 저장을 눌러 주세요.`,
        warnings: r.warnings,
      });
    } catch (e) {
      setImportMsg({ ok: false, text: e.message || '엑셀을 읽지 못했어요.' });
    }
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <div className="brand">
            안전보건공시
            <small>산업안전보건법 제10조의2</small>
          </div>
          <div className="spacer" />
          <div className="seg">
            {YEARS.map((y) => (
              <button key={y} className={y === year ? 'on' : ''} onClick={() => setYear(y)}>
                {y}년
              </button>
            ))}
          </div>
          <span className="user">{profile?.name}</span>
          {isAdmin && !demo && (
            <button className="link-btn" onClick={() => setShowUsers(true)}>
              사용자 승인
            </button>
          )}
          {!demo && (
            <button className="link-btn" onClick={() => supabase.auth.signOut()}>
              로그아웃
            </button>
          )}
        </div>
      </header>

      <main className="wrap">
        {demo && <div className="banner">미리보기 화면이에요. 표시된 숫자는 예시 데이터이고, Supabase를 연결하면 실제 입력값으로 바뀌어요.</div>}

        <div className="summary">
          <h1>{year}년 안전보건 현황</h1>
          <span className={`chip ${rec.ceo_confirmed ? 'ok' : 'warn'}`}>
            {rec.ceo_confirmed ? `대표자 확인 완료${rec.ceo_confirmed_at ? ' · ' + rec.ceo_confirmed_at : ''}` : '대표자 확인 전'}
          </span>
          {year === THIS_YEAR && <span className="chip dday">공시기한 {THIS_YEAR + 1}.04.30 · D-{diff}</span>}
          {isAdmin && (
            <button className="link-btn" onClick={() => open('ceo')}>
              기본정보·대표자 확인
            </button>
          )}
          <button className="btn sm pdf-btn" onClick={exportPdf}>
            PDF 내보내기
          </button>
        </div>

        <div className="grid">
          {/* 1호 체제 */}
          <Card no="1호" title="안전보건관리체제" onEdit={edit_('system')}>
            <h3 className="sec-title">안전보건 조직</h3>
            <div className="stats c2">
              {ROLES.map(([k, label]) => (
                <div className="stat" key={k}>
                  <p className="stat-l">{label}</p>
                  <p className="stat-v">{d.system.roles[k]?.name || '-'}</p>
                  {d.system.roles[k]?.title && <p className="stat-s">{d.system.roles[k].title}</p>}
                </div>
              ))}
            </div>
            <div className="sec-gap">
              <h3 className="sec-title">관리감독자</h3>
              <button className="stat stat-btn" onClick={() => setShowSup(true)}>
                <div>
                  <p className="stat-l">선임 인원</p>
                  <p className="stat-v">
                    {sup.length}
                    <small>명</small>
                    <span className="stat-extra">교육 완료 {supDone}명</span>
                  </p>
                </div>
                <span className="card-link">명단 보기 ›</span>
              </button>
              <div className="kv" style={{ marginTop: 10 }}>
                <span>산업안전보건위원회</span>
                <span>{d.system.committee}</span>
              </div>
              {d.system.note && <div className="note">{d.system.note}</div>}
            </div>
          </Card>

          {/* 2호 재해 */}
          <Card no="2호" title="산업재해 발생 현황" className="span2" onEdit={edit_('accident')}>
            <div className="stats c3">
              <Stat label="상시근로자" value={won(d.accident.workers)} unit="명" />
              <Stat label="재해자" value={d.accident.injured} unit="명" />
              <Stat label="재해율" value={accRate} unit="%" />
              <Stat label="사망자" value={d.accident.deaths} unit="명" />
              <Stat label="업무상 질병자" value={d.accident.disease} unit="명" />
            </div>
            <div className="note">재해율 = 재해자 수 ÷ 상시근로자 수 × 100</div>
          </Card>

          {/* 3호 활동 */}
          <Card
            no="3호"
            title="안전보건 활동"
            onEdit={edit_('activity')}
            right={
              <div className="seg sm" style={{ marginLeft: 'auto', marginRight: isAdmin ? 12 : 0 }}>
                <button className={actTab === 'result' ? 'on' : ''} onClick={() => setActTab('result')}>
                  실적
                </button>
                <button className={actTab === 'plan' ? 'on' : ''} onClick={() => setActTab('plan')}>
                  계획
                </button>
              </div>
            }
          >
            {plans.length > 0 && (
              <div className="progress-box">
                <div className="progress-top">
                  <span>
                    계획 <b>{plans.length}</b>건 · 완료 <b>{planDone}</b> · 진행중 <b>{planIng}</b>
                  </span>
                  <b>{pct(planDone, plans.length)}%</b>
                </div>
                <div className="progress">
                  <div style={{ width: `${pct(planDone, plans.length)}%`, background: 'var(--green)' }} />
                  <div style={{ width: `${pct(planIng, plans.length)}%`, background: 'var(--blue)' }} />
                </div>
              </div>
            )}
            {acts.length === 0 ? (
              <div className="empty">{actTab === 'result' ? '완료·진행중인 활동이 없어요' : '등록된 계획이 없어요'}</div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>항목</th>
                    <th className="c">{acts.some((a) => a.quarters) ? '1 2 3 4분기' : '내용'}</th>
                    <th className="r">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {acts.slice(0, 7).map((a) => (
                    <tr key={a.idx}>
                      <td className="ellip" title={a.title}>
                        {a.title}
                      </td>
                      <td className="c" style={{ color: 'var(--sub)', whiteSpace: 'nowrap' }}>
                        {a.quarters ? <Quarters q={a.quarters} /> : a.detail}
                      </td>
                      <td className="r">
                        <span className={`pill ${STATUS_COLOR[a.status] || 'gray'}`}>{a.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {allActs.length > 0 && (
              <button className="more-btn" onClick={() => setShowActs(true)}>
                전체 보기 ({allActs.length}건){isAdmin ? ' · 상태 변경' : ''} ›
              </button>
            )}
          </Card>

          {/* 4호 투자 */}
          <Card no="4호" title="안전보건 투자" className="span2" onEdit={edit_('invest')}>
            <div className="split">
              <div>
                <Gauge value={inv.rate} color="var(--coral)" label="집행률" />
                <div className="stats c2">
                  <Stat label="편성액" value={won(inv.budget)} unit="원" />
                  <Stat label="집행액" value={won(inv.executed)} unit="원" />
                  <div className="stat" style={{ gridColumn: 'span 2' }}>
                    <p className="stat-l">남은 금액</p>
                    <p className="stat-v">
                      {won(inv.rest)}
                      <small>원</small>
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="sec-title">항목별 집행률</h3>
                {d.invest.items.length === 0 ? (
                  <div className="empty">투자 항목을 입력하면 차트가 나와요</div>
                ) : (
                  <div className="chart">
                    <div className="chart-grid">
                      {[100, 80, 60, 40, 20, 0].map((g) => (
                        <div key={g} style={{ top: `${100 - g}%` }}>
                          <span>{g}%</span>
                        </div>
                      ))}
                    </div>
                    {d.invest.items.map((it, i) => {
                      const r = Math.min(100, pct(it.executed, it.budget));
                      return (
                        <div className="bar-col" key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                          <div className="bar-bg" />
                          <div className="bar" style={{ height: `${r}%`, background: barColors[i % barColors.length] }}>
                            {hover === i && (
                              <div className="tip">
                                <b>{it.name}</b>
                                편성액 {won(it.budget)}원<br />
                                집행액 {won(it.executed)}원<br />
                                집행률 {pct(it.executed, it.budget)}%
                              </div>
                            )}
                          </div>
                          <span className="bar-x">{it.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            {(d.invest.monthly?.some((m) => m > 0) || over.length > 0) && (
              <div className="sec-gap split">
                <div>
                  <h3 className="sec-title">월별 집행액</h3>
                  <div className="chart months">
                    <div className="chart-grid">
                      {[1, 0.5, 0].map((g) => (
                        <div key={g} style={{ top: `${100 - g * 100}%` }}>
                          <span>{man(maxMonth * g)}</span>
                        </div>
                      ))}
                    </div>
                    {Array.from({ length: 12 }, (_, i) => {
                      const v = d.invest.monthly?.[i] || 0;
                      return (
                        <div className="bar-col" key={i} onMouseEnter={() => setHoverM(i)} onMouseLeave={() => setHoverM(null)}>
                          <div className="bar-bg" />
                          <div className="bar" style={{ height: `${maxMonth ? (v / maxMonth) * 100 : 0}%`, background: 'var(--blue)' }}>
                            {hoverM === i && (
                              <div className="tip">
                                <b>{i + 1}월</b>
                                집행액 {won(v)}원
                              </div>
                            )}
                          </div>
                          <span className="bar-x">{i + 1}월</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <h3 className="sec-title">예산 초과 항목</h3>
                  {over.length === 0 ? (
                    <div className="empty">예산을 넘은 항목이 없어요</div>
                  ) : (
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>항목</th>
                          <th className="r">초과액</th>
                          <th className="r">집행률</th>
                        </tr>
                      </thead>
                      <tbody>
                        {over.map((o, i) => (
                          <tr key={i}>
                            <td>{o.name}</td>
                            <td className="r" style={{ color: 'var(--sub)' }}>
                              +{won(o.executed - o.budget)}원
                            </td>
                            <td className="r">
                              <span className="pill red">{pct(o.executed, o.budget)}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
            {d.invest.source && (
              <div className="source">
                엑셀에서 불러옴 · {d.invest.source.file} · {d.invest.source.sheet} 시트 · {d.invest.source.at}
              </div>
            )}
          </Card>

          {/* 5호 재발방지 */}
          <Card no="5호" title="재발방지 대책·이행" className="span2" onEdit={edit_('prevent')}>
            <div className="split">
              <div>
                <Gauge value={pct(prevDone, d.prevent.items.length)} color="var(--yellow)" label="이행 완료" />
                <div className="stats c2">
                  <Stat label="조치필요" value={prevTodo} unit="건" />
                  <Stat label="조치완료" value={prevDone} unit="건" />
                </div>
              </div>
              <div>
                <h3 className="sec-title">대책 목록</h3>
                {d.prevent.items.length === 0 ? (
                  <div className="empty">등록된 대책이 없어요</div>
                ) : (
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>대책</th>
                        <th className="c">이행기한</th>
                        <th className="r">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.prevent.items.map((p, i) => (
                        <tr key={i}>
                          <td>{p.title}</td>
                          <td className="c" style={{ color: 'var(--sub)' }}>
                            {p.due || '-'}
                          </td>
                          <td className="r">
                            <span className={`pill ${STATUS_COLOR[p.status] || 'gray'}`}>{p.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </Card>

          {/* 6호 */}
          <Card no="6호" title="관계수급인 사망 현황" onEdit={edit_('contractor')}>
            {d.contractor.applicable ? (
              <div className="stats c2">
                <Stat label="사망자" value={d.contractor.deaths} unit="명" />
              </div>
            ) : (
              <div className="kv">
                <span>해당 여부</span>
                <span>해당 없음</span>
              </div>
            )}
            {d.contractor.note && <div className="note">{d.contractor.note}</div>}
          </Card>
        </div>
      </main>

      <PrintReport year={year} d={d} rec={rec} />

      {/* ───── 편집 모달 ───── */}
      {edit === 'invest' && (
        <Modal title="안전보건 투자 수정" onClose={() => { setEdit(null); setImportMsg(null); }} onSave={async () => { await saveDraft(); setImportMsg(null); }} saving={saving}>
          <div className="import-box">
            <div>
              <b>엑셀 불러오기</b>
              <p>안전보건예산 관리 엑셀을 그대로 고르면 「안전보건예산 내역」 시트를 읽어 아래 표와 월별 추이를 채워요.</p>
            </div>
            <label className="btn primary">
              파일 선택
              <input type="file" accept=".xlsx" hidden onChange={(e) => { importExcel(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
          {importMsg && (
            <div className={importMsg.ok === false ? 'err' : importMsg.ok ? 'ok-msg' : 'note'} style={{ marginBottom: 12 }}>
              {importMsg.text}
              {importMsg.warnings?.map((w, i) => (
                <div key={i} style={{ color: '#a26300' }}>· {w}</div>
              ))}
            </div>
          )}
          <ListEditor
            rows={draft.items}
            setRows={(items) => setDraft({ ...draft, items })}
            blank={{ name: '', budget: 0, executed: 0 }}
            cols={[
              { key: 'name', label: '항목', w: '1.2fr' },
              { key: 'budget', label: '편성액(원)', type: 'number' },
              { key: 'executed', label: '집행액(원)', type: 'number' },
            ]}
          />
        </Modal>
      )}

      {edit === 'activity' && (
        <Modal title="안전보건 활동 수정" onClose={() => { setEdit(null); setPasteRes(null); }} onSave={saveDraft} saving={saving}>
          <div className="import-box" style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <b>한글 표 붙여넣기</b>
                <p>한글 문서에서 추진계획 표를 머리글까지 블록 지정해 복사(Ctrl + C)한 다음, 아래 칸을 누르고 붙여넣기(Ctrl + V) 하세요.</p>
              </div>
              <select className="input" style={{ width: 110 }} value={pasteKind} onChange={(e) => setPasteKind(e.target.value)}>
                <option value="plan">계획으로</option>
                <option value="result">실적으로</option>
              </select>
            </div>
            <textarea className="input paste-area" rows={2} placeholder="여기를 누르고 Ctrl + V" onPaste={onActPaste} value="" onChange={() => {}} />
            {pasteRes?.error && <div className="err">{pasteRes.error}</div>}
            {pasteRes?.items && (
              <div style={{ marginTop: 10 }}>
                <div className="ok-msg">항목 {pasteRes.items.length}개를 읽었어요. 앞의 몇 개를 확인해 주세요.</div>
                <table className="tbl" style={{ fontSize: 12 }}>
                  <tbody>
                    {pasteRes.items.slice(0, 5).map((x, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--sub)' }}>{x.area}</td>
                        <td>{x.title}</td>
                        <td className="c">
                          <Quarters q={x.quarters} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                  <button className="btn sm" onClick={() => applyPaste(false)}>
                    기존 목록에 추가
                  </button>
                  <button className="btn sm primary" onClick={() => applyPaste(true)}>
                    {pasteKind === 'plan' ? '계획' : '실적'} 목록 바꾸기
                  </button>
                </div>
              </div>
            )}
          </div>
          <ListEditor
            rows={draft.items}
            setRows={(items) => setDraft({ ...draft, items })}
            blank={{ kind: 'result', title: '', detail: '', status: '완료' }}
            cols={[
              { key: 'kind', label: '구분', w: '90px', options: [{ value: 'result', label: '실적' }, { value: 'plan', label: '계획' }] },
              { key: 'title', label: '항목', w: '1.4fr' },
              { key: 'detail', label: '내용' },
              { key: 'status', label: '상태', w: '100px', options: ['완료', '진행중', '예정', '지연', '미실시'] },
            ]}
          />
        </Modal>
      )}

      {edit === 'system' && (
        <Modal title="안전보건관리체제 수정" onClose={() => setEdit(null)} onSave={saveDraft} saving={saving}>
          <h3 className="sec-title">안전보건 조직</h3>
          {ROLES.map(([k, label]) => (
            <div className="row c2" key={k}>
              <Field label={`${label} 성함`}>
                <input
                  className="input"
                  value={draft.roles[k]?.name || ''}
                  onChange={(e) => setDraft({ ...draft, roles: { ...draft.roles, [k]: { ...draft.roles[k], name: e.target.value } } })}
                />
              </Field>
              <Field label="직위·소속">
                <input
                  className="input"
                  value={draft.roles[k]?.title || ''}
                  onChange={(e) => setDraft({ ...draft, roles: { ...draft.roles, [k]: { ...draft.roles[k], title: e.target.value } } })}
                />
              </Field>
            </div>
          ))}
          <h3 className="sec-title" style={{ marginTop: 8 }}>
            관리감독자 명단 <span style={{ fontWeight: 400, color: 'var(--sub)', fontSize: 13 }}>{draft.supervisors.length}명</span>
          </h3>
          <ListEditor
            rows={draft.supervisors}
            setRows={(supervisors) => setDraft({ ...draft, supervisors })}
            blank={{ dept: '', name: '', eduDate: '' }}
            cols={[
              { key: 'dept', label: '소속', w: '1.4fr' },
              { key: 'name', label: '성함' },
              { key: 'eduDate', label: '교육완료일자', type: 'date' },
            ]}
          />
          <div style={{ height: 14 }} />
          <Field label="산업안전보건위원회">
            <select className="input" value={draft.committee} onChange={(e) => setDraft({ ...draft, committee: e.target.value })}>
              <option>운영</option>
              <option>미운영</option>
              <option>해당 없음</option>
            </select>
          </Field>
          <Field label="비고">
            <textarea className="input" rows={3} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </Field>
        </Modal>
      )}

      {edit === 'prevent' && (
        <Modal title="재발방지 대책 수정" onClose={() => setEdit(null)} onSave={saveDraft} saving={saving}>
          <ListEditor
            rows={draft.items}
            setRows={(items) => setDraft({ ...draft, items })}
            blank={{ title: '', status: '조치필요', due: '' }}
            cols={[
              { key: 'title', label: '대책', w: '1.6fr' },
              { key: 'due', label: '이행기한', type: 'date' },
              { key: 'status', label: '상태', w: '110px', options: ['조치필요', '조치완료'] },
            ]}
          />
        </Modal>
      )}

      {edit === 'accident' && (
        <Modal title="산업재해 발생 현황 수정" onClose={() => setEdit(null)} onSave={saveDraft} saving={saving}>
          <div className="row c2">
            {[
              ['workers', '상시근로자(명)'],
              ['injured', '재해자(명)'],
              ['deaths', '사망자(명)'],
              ['disease', '업무상 질병자(명)'],
            ].map(([k, l]) => (
              <Field key={k} label={l}>
                <input className="input" type="number" value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })} />
              </Field>
            ))}
          </div>
          <div className="note">재해율은 재해자 수 ÷ 상시근로자 수 × 100으로 자동 계산돼요.</div>
        </Modal>
      )}

      {edit === 'contractor' && (
        <Modal title="관계수급인 사망 현황 수정" onClose={() => setEdit(null)} onSave={saveDraft} saving={saving}>
          <Field label="해당 여부">
            <select
              className="input"
              value={draft.applicable ? 'y' : 'n'}
              onChange={(e) => setDraft({ ...draft, applicable: e.target.value === 'y' })}
            >
              <option value="n">해당 없음</option>
              <option value="y">해당 있음</option>
            </select>
          </Field>
          {draft.applicable && (
            <Field label="사망자(명)">
              <input className="input" type="number" value={draft.deaths} onChange={(e) => setDraft({ ...draft, deaths: Number(e.target.value) })} />
            </Field>
          )}
          <Field label="비고">
            <input className="input" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </Field>
        </Modal>
      )}

      {edit === 'ceo' && (
        <Modal title="공시 기본정보 · 대표자 확인" onClose={() => setEdit(null)} onSave={saveDraft} saving={saving}>
          <div className="row c2">
            {[
              ['company', '회사명'],
              ['ceoName', '대표자 성명'],
              ['dept', '작성부서'],
              ['writer', '작성자'],
            ].map(([k, l]) => (
              <Field key={k} label={l}>
                <input className="input" value={draft.meta?.[k] || ''} onChange={(e) => setDraft({ ...draft, meta: { ...draft.meta, [k]: e.target.value } })} />
              </Field>
            ))}
          </div>
          <Field label="대표자 확인 여부">
            <select
              className="input"
              value={draft.ceo_confirmed ? 'y' : 'n'}
              onChange={(e) => setDraft({ ...draft, ceo_confirmed: e.target.value === 'y' })}
            >
              <option value="n">확인 전</option>
              <option value="y">확인 완료</option>
            </select>
          </Field>
          {draft.ceo_confirmed && (
            <Field label="확인일">
              <input className="input" type="date" value={draft.ceo_confirmed_at} onChange={(e) => setDraft({ ...draft, ceo_confirmed_at: e.target.value })} />
            </Field>
          )}
        </Modal>
      )}

      {showSup && (
        <Modal title={`관리감독자 명단 · ${sup.length}명`} onClose={() => setShowSup(false)}>
          {sup.length === 0 ? (
            <div className="empty">등록된 관리감독자가 없어요{isAdmin ? '. 1호 카드의 수정에서 추가할 수 있어요.' : ''}</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>No</th>
                  <th>소속</th>
                  <th>성함</th>
                  <th className="r">교육완료일자</th>
                </tr>
              </thead>
              <tbody>
                {sup.map((x, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--muted)' }}>{i + 1}</td>
                    <td>{x.dept || '-'}</td>
                    <td>{x.name || '-'}</td>
                    <td className="r">{x.eduDate ? x.eduDate : <span className="pill orange">미이수</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}

      {showActs && (
        <Modal title={`안전보건 활동 전체 · ${allActs.length}건`} wide onClose={() => setShowActs(false)}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 54 }}>구분</th>
                <th>내용</th>
                <th>목표</th>
                <th className="c" style={{ width: 92 }}>1 2 3 4분기</th>
                <th className="r" style={{ width: 96 }}>상태</th>
              </tr>
            </thead>
            <tbody>
              {allActs.map((a, i) => (
                <tr key={a.idx}>
                  <td style={{ color: 'var(--sub)', fontSize: 12 }}>
                    {a.kind === 'plan' ? '계획' : '실적'}
                  </td>
                  <td>
                    {a.area && a.area !== allActs[i - 1]?.area && <div className="area-tag">{a.area}</div>}
                    {a.title}
                    {a.months && <span style={{ color: 'var(--muted)', fontSize: 12 }}> ({a.months})</span>}
                  </td>
                  <td style={{ color: 'var(--sub)', fontSize: 12.5 }}>{a.detail}</td>
                  <td className="c">{a.quarters ? <Quarters q={a.quarters} /> : '-'}</td>
                  <td className="r">
                    {isAdmin ? (
                      <select
                        className={`input status-sel ${STATUS_COLOR[a.status] || 'gray'}`}
                        value={a.status}
                        disabled={saving}
                        onChange={(e) => setActStatus(a.idx, e.target.value)}
                      >
                        {['예정', '진행중', '완료', '지연', '미실시'].map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`pill ${STATUS_COLOR[a.status] || 'gray'}`}>{a.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}

      {showUsers && <UsersModal onClose={() => setShowUsers(false)} />}
    </>
  );
}

/* ───────── 사용자 승인 ───────── */
function UsersModal({ onClose }) {
  const [users, setUsers] = useState([]);
  const load = () =>
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setUsers(data || []));
  useEffect(() => {
    load();
  }, []);
  const update = async (id, patch) => {
    const { error } = await supabase.from('profiles').update(patch).eq('id', id);
    if (error) alert('변경하지 못했어요: ' + error.message);
    load();
  };
  return (
    <Modal title="사용자 승인" onClose={onClose}>
      {users.length === 0 ? (
        <div className="empty">사용자가 없어요</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>이름</th>
              <th>이메일</th>
              <th className="c">권한</th>
              <th className="r">승인</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td style={{ color: 'var(--sub)' }}>{u.email}</td>
                <td className="c">
                  <select className="input" style={{ width: 96, padding: '5px 8px' }} value={u.role} onChange={(e) => update(u.id, { role: e.target.value })}>
                    <option value="viewer">조회</option>
                    <option value="admin">관리자</option>
                  </select>
                </td>
                <td className="r">
                  {u.approved ? (
                    <button className="btn sm danger" onClick={() => update(u.id, { approved: false })}>
                      승인 취소
                    </button>
                  ) : (
                    <button className="btn sm primary" onClick={() => update(u.id, { approved: true })}>
                      승인
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
