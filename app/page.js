'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';

const PERIODS = [
  { key: 'daily', label: '일일', unit: '매일' },
  { key: 'weekly', label: '주간', unit: '매주' },
  { key: 'monthly', label: '월간', unit: '매월' },
  { key: 'quarterly', label: '분기', unit: '분기마다' },
  { key: 'semiannual', label: '반기', unit: '반기마다' },
  { key: 'annual', label: '연간', unit: '매년' },
];

const DEFAULT_ITEMS = [
  { period: 'daily', name: '작업 전 안전점검회의(TBM) 실시 및 일지 작성' },
  { period: 'daily', name: '당일 작업 위험성평가 확인 및 근로자 공유' },
  { period: 'daily', name: '개인보호구(PPE) 지급·착용 상태 확인' },
  { period: 'daily', name: '작업장 정리정돈 및 이상유무 점검' },
  { period: 'weekly', name: '안전보건관리(감독)자 현장 순회점검 실시' },
  { period: 'weekly', name: '유해·위험요인 개선조치 이행 확인' },
  { period: 'weekly', name: '중장비·설비 점검일지 확인' },
  { period: 'monthly', name: '정기 안전보건교육 실시(관리감독자·근로자)' },
  { period: 'monthly', name: '소방시설·화재예방 점검' },
  { period: 'monthly', name: '안전보건관리규정 준수 여부 점검' },
  { period: 'quarterly', name: '산업안전보건위원회(또는 노사협의체) 개최' },
  { period: 'quarterly', name: 'MSDS(물질안전보건자료) 비치·갱신 확인' },
  { period: 'semiannual', name: '중대재해처벌법 안전보건관리체계 이행 점검(유해위험요인 확인·개선 절차)' },
  { period: 'semiannual', name: '도급·용역·위탁 시 수급업체 안전보건 확보조치 점검' },
  { period: 'semiannual', name: '안전·보건 관계 법령상 의무이행 점검(인력·예산 편성 포함)' },
  { period: 'annual', name: '안전보건관리계획 수립 및 예산 편성' },
  { period: 'annual', name: '경영책임자 안전보건 목표·경영방침 수립' },
  { period: 'annual', name: '근로자 일반건강진단 실시' },
  { period: 'annual', name: '비상대응(재해대응)계획 수립 및 점검' },
];

const LAW_INDEX = {
  '산업안전보건법': [
    { no: '제5조', title: '사업주 등의 의무' },
    { no: '제14조', title: '이사회 보고 및 승인 등' },
    {
      no: '제15조', title: '안전보건관리책임자',
      text: `① 사업주는 사업장을 실질적으로 총괄하여 관리하는 사람에게 해당 사업장의 다음 각 호의 업무를 총괄하여 관리하도록 하여야 한다.
1. 사업장의 산업재해 예방계획의 수립에 관한 사항
2. 제25조 및 제26조에 따른 안전보건관리규정의 작성 및 변경에 관한 사항
3. 제29조에 따른 안전보건교육에 관한 사항
4. 작업환경측정 등 작업환경의 점검 및 개선에 관한 사항
5. 제129조부터 제132조까지에 따른 근로자의 건강진단 등 건강관리에 관한 사항

② 제1항 각 호의 업무를 총괄하여 관리하는 사람(이하 "안전보건관리책임자"라 한다)은 제17조에 따른 안전관리자와 제18조에 따른 보건관리자를 지휘·감독한다.
③ 안전보건관리책임자를 두어야 하는 사업의 종류와 사업장의 상시근로자 수, 그 밖에 필요한 사항은 대통령령으로 정한다.`,
      lastChecked: '2026-07-23',
    },
    { no: '제16조', title: '관리감독자' },
    { no: '제17조', title: '안전관리자' },
    { no: '제18조', title: '보건관리자' },
    { no: '제19조', title: '안전보건관리담당자' },
    { no: '제24조', title: '산업안전보건위원회' },
    { no: '제25조', title: '안전보건관리규정의 작성' },
    {
      no: '제29조', title: '근로자에 대한 안전보건교육',
      text: `① 사업주는 소속 근로자에게 고용노동부령으로 정하는 바에 따라 정기적으로 안전보건교육을 하여야 한다.
② 사업주는 근로자를 채용할 때와 작업내용을 변경할 때에는 그 근로자에게 고용노동부령으로 정하는 바에 따라 해당 작업에 필요한 안전보건교육을 하여야 한다. 다만, 제31조제1항에 따른 안전보건교육을 이수한 건설 일용근로자를 채용하는 경우에는 그러하지 아니하다.
③ 사업주는 근로자를 유해하거나 위험한 작업에 채용하거나 그 작업으로 작업내용을 변경할 때에는 제2항에 따른 안전보건교육 외에 고용노동부령으로 정하는 바에 따라 유해하거나 위험한 작업에 필요한 안전보건교육을 추가로 하여야 한다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제36조', title: '위험성평가의 실시',
      text: `① 사업주는 건설물, 기계·기구·설비, 원재료, 가스, 증기, 분진, 근로자의 작업행동 또는 그 밖의 업무로 인한 유해·위험 요인을 찾아내어 부상 및 질병으로 이어질 수 있는 위험성의 크기가 허용 가능한 범위인지를 평가하여야 하고, 그 결과에 따라 이 법과 이 법에 따른 명령에 따른 조치를 하여야 하며, 근로자에 대한 위험 또는 건강장해를 방지하기 위하여 필요한 경우에는 추가적인 조치를 하여야 한다.
② 사업주는 제1항에 따른 평가 시 고용노동부장관이 정하여 고시하는 바에 따라 해당 작업장의 근로자를 참여시켜야 한다.
③ 사업주는 제1항에 따른 평가의 결과와 조치사항을 고용노동부령으로 정하는 바에 따라 기록하여 보존하여야 한다.`,
      lastChecked: '2026-07-23',
    },
    { no: '제37조', title: '안전보건표지의 설치·부착' },
    { no: '제41조', title: '고객의 폭언등으로 인한 건강장해 예방조치' },
    { no: '제57조', title: '산업재해 발생 은폐 금지 및 보고 등' },
    { no: '제63조', title: '도급인의 안전조치 및 보건조치' },
    { no: '제64조', title: '도급에 따른 산업재해 예방조치' },
    { no: '제72조', title: '건설공사 등의 산업안전보건관리비 계상 등' },
    { no: '제129조', title: '일반건강진단' },
    { no: '제130조', title: '특수건강진단 등' },
  ],
  '중대재해 처벌 등에 관한 법률': [
    { no: '제2조', title: '정의' },
    { no: '제3조', title: '적용범위' },
    {
      no: '제4조', title: '사업주와 경영책임자등의 안전 및 보건 확보의무',
      text: `① 사업주 또는 경영책임자등은 사업주나 법인 또는 기관이 실질적으로 지배·운영·관리하는 사업 또는 사업장에서 종사자의 안전·보건상 유해 또는 위험을 방지하기 위하여 그 사업 또는 사업장의 특성 및 규모 등을 고려하여 다음 각 호에 따른 조치를 하여야 한다.
1. 재해예방에 필요한 인력 및 예산 등 안전보건관리체계의 구축 및 그 이행에 관한 조치
2. 재해 발생 시 재발방지 대책의 수립 및 그 이행에 관한 조치
3. 중앙행정기관·지방자치단체가 관계 법령에 따라 개선, 시정 등을 명한 사항의 이행에 관한 조치
4. 안전·보건 관계 법령에 따른 의무이행에 필요한 관리상의 조치

② 제1항제1호·제4호의 조치에 관한 구체적인 사항은 대통령령으로 정한다.`,
      lastChecked: '2026-07-23',
    },
    { no: '제5조', title: '도급, 용역, 위탁 등 관계에서의 안전 및 보건 확보의무' },
    {
      no: '제6조', title: '중대산업재해 사업주와 경영책임자등의 처벌',
      text: `① 제4조 또는 제5조를 위반하여 제2조제2호가목의 중대산업재해에 이르게 한 사업주 또는 경영책임자등은 1년 이상의 징역 또는 10억원 이하의 벌금에 처한다. 이 경우 징역과 벌금을 병과할 수 있다.
② 제4조 또는 제5조를 위반하여 제2조제2호나목 또는 다목의 중대산업재해에 이르게 한 사업주 또는 경영책임자등은 7년 이하의 징역 또는 1억원 이하의 벌금에 처한다.
③ 제1항 또는 제2항의 죄로 형을 선고받고 그 형이 확정된 후 5년 이내에 다시 제1항 또는 제2항의 죄를 저지른 자는 각 항에서 정한 형의 2분의 1까지 가중한다.`,
      lastChecked: '2026-07-23',
    },
    { no: '제7조', title: '중대산업재해의 양벌규정' },
    { no: '제8조', title: '안전보건교육의 수강' },
    { no: '제9조', title: '중대시민재해 사업주와 경영책임자등의 안전 및 보건 확보의무' },
    { no: '제10조', title: '중대시민재해 사업주와 경영책임자등의 처벌' },
  ],
};

function lawSearchUrl(lawName, articleNo) {
  const q = `${lawName} ${articleNo}`;
  return `https://www.law.go.kr/LSW/lsSc.do?menuId=1&subMenuId=15&query=${encodeURIComponent(q)}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function getCycleKey(period, d = new Date()) {
  const y = d.getFullYear();
  if (period === 'daily') return `${y}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (period === 'weekly') {
    const onejan = new Date(y, 0, 1);
    const dayOfYear = Math.floor((d - onejan) / 86400000) + 1;
    const week = Math.ceil((dayOfYear + onejan.getDay()) / 7);
    return `${y}-W${pad(week)}`;
  }
  if (period === 'monthly') return `${y}-${pad(d.getMonth() + 1)}`;
  if (period === 'quarterly') return `${y}-Q${Math.floor(d.getMonth() / 3) + 1}`;
  if (period === 'semiannual') return `${y}-${d.getMonth() < 6 ? '상반기' : '하반기'}`;
  if (period === 'annual') return `${y}`;
  return `${y}`;
}

function cycleLabel(period) {
  const now = new Date();
  const key = getCycleKey(period, now);
  const map = {
    daily: `오늘 (${key})`,
    weekly: `이번 주 (${key})`,
    monthly: `이번 달 (${key})`,
    quarterly: `이번 분기 (${key})`,
    semiannual: `이번 ${now.getMonth() < 6 ? '상반기' : '하반기'} (${now.getFullYear()})`,
    annual: `올해 (${key})`,
  };
  return map[period] || key;
}

export default function Dashboard() {
  const supabase = createClient();
  const router = useRouter();

  const [userEmail, setUserEmail] = useState('');
  const [items, setItems] = useState([]);
  const [doneMap, setDoneMap] = useState({}); // itemId -> Set of cycleKeys done
  const [active, setActive] = useState('daily');
  const [view, setView] = useState('checklist'); // 'checklist' | 'lawsearch'
  const [expandedArticle, setExpandedArticle] = useState(null); // "lawName|articleNo"
  const [newItemText, setNewItemText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUserEmail(user.email);

    let { data: itemRows, error: itemErr } = await supabase
      .from('checklist_items')
      .select('*')
      .order('created_at', { ascending: true });

    if (itemErr) { setError('항목을 불러오지 못했습니다: ' + itemErr.message); setLoading(false); return; }

    // 첫 로그인이면 기본 항목을 심어줌
    if (itemRows.length === 0) {
      const seed = DEFAULT_ITEMS.map(i => ({ ...i, user_id: user.id }));
      const { data: inserted, error: seedErr } = await supabase.from('checklist_items').insert(seed).select();
      if (!seedErr) itemRows = inserted;
    }

    const { data: logRows, error: logErr } = await supabase
      .from('checklist_log')
      .select('item_id, cycle_key');

    if (logErr) { setError('기록을 불러오지 못했습니다: ' + logErr.message); setLoading(false); return; }

    const map = {};
    (logRows || []).forEach(r => {
      if (!map[r.item_id]) map[r.item_id] = new Set();
      map[r.item_id].add(r.cycle_key);
    });

    setItems(itemRows || []);
    setDoneMap(map);
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleItem = async (item) => {
    const cycleKey = getCycleKey(item.period);
    const isDone = doneMap[item.id]?.has(cycleKey);
    const { data: { user } } = await supabase.auth.getUser();

    if (isDone) {
      await supabase.from('checklist_log').delete().eq('item_id', item.id).eq('cycle_key', cycleKey);
      setDoneMap(prev => {
        const next = { ...prev };
        next[item.id] = new Set(next[item.id]);
        next[item.id].delete(cycleKey);
        return next;
      });
    } else {
      await supabase.from('checklist_log').insert({ item_id: item.id, cycle_key: cycleKey, user_id: user.id });
      setDoneMap(prev => {
        const next = { ...prev };
        next[item.id] = new Set(next[item.id] || []);
        next[item.id].add(cycleKey);
        return next;
      });
    }
  };

  const addItem = async () => {
    const text = newItemText.trim();
    if (!text) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error: insErr } = await supabase
      .from('checklist_items')
      .insert({ period: active, name: text, user_id: user.id })
      .select();
    if (!insErr && data) {
      setItems(prev => [...prev, ...data]);
      setNewItemText('');
    }
  };

  const removeItem = async (id) => {
    await supabase.from('checklist_items').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  if (loading) return <div className="wrap"><div className="empty">불러오는 중...</div></div>;

  const periodItems = items.filter(i => i.period === active);
  const cycleKey = getCycleKey(active);
  const doneCount = periodItems.filter(i => doneMap[i.id]?.has(cycleKey)).length;
  const total = periodItems.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="wrap">
      <div className="topbar">
        <span>{userEmail}</span>
        <button className="logout-btn" onClick={handleLogout}>로그아웃</button>
      </div>
      <div className="tag">SAFETY &amp; HEALTH COMPLIANCE</div>
      <div className="masthead">
        <div>
          <h1>안전보건서류 주기별 체크리스트</h1>
          <div className="sub">산업안전보건법 · 중대재해처벌법 대응 — 일일/주간/월간/분기/반기/연간 이행 관리</div>
        </div>
      </div>
      <div className="stripe"></div>

      {error && <div className="disclaimer">{error}</div>}

      <div className="disclaimer">
        ⚠ 아래 항목은 업종·사업장 규모에 따라 실제 의무사항과 다를 수 있는 <b>일반 참고용 체크리스트</b>입니다.
        사업장 특성에 맞춰 항목을 직접 추가·수정해서 사용하세요.
      </div>

      <div className="tabs" style={{marginBottom:8}}>
        <div className={"tab" + (view === 'checklist' ? " active" : "")} onClick={() => setView('checklist')}>
          체크리스트
        </div>
        <div className={"tab" + (view === 'lawsearch' ? " active" : "")} onClick={() => setView('lawsearch')}>
          법령검색
        </div>
      </div>

      {view === 'checklist' && (
        <>
          <div className="tabs">
            {PERIODS.map(p => {
              const pItems = items.filter(i => i.period === p.key);
              const ck = getCycleKey(p.key);
              const done = pItems.filter(i => doneMap[i.id]?.has(ck)).length;
              return (
                <div key={p.key} className={"tab" + (active === p.key ? " active" : "")} onClick={() => setActive(p.key)}>
                  {p.label}
                  <span className="count">{done}/{pItems.length}</span>
                </div>
              );
            })}
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>{PERIODS.find(p => p.key === active).label} 점검 항목</h2>
              <div className="cycle-label">{cycleLabel(active)} 기준</div>
            </div>
            <div className="progress-row">
              <div className="progress-bar"><div className="progress-fill" style={{ width: pct + '%' }}></div></div>
              <div className="progress-text">{doneCount}/{total} 완료</div>
            </div>

            {periodItems.length === 0 && <div className="empty">항목이 없습니다. 아래에서 추가해보세요.</div>}

            {periodItems.map(item => {
              const isDone = !!doneMap[item.id]?.has(cycleKey);
              return (
                <div className="item" key={item.id}>
                  <div className={"check" + (isDone ? " done" : "")} onClick={() => toggleItem(item)}></div>
                  <div className="item-body">
                    <div className={"item-name" + (isDone ? " done" : "")}>{item.name}</div>
                    <div className="item-meta">
                      {isDone ? <span className="badge ok">완료</span> : <span className="badge warn">미완료</span>}
                      {PERIODS.find(p => p.key === item.period).unit} 점검
                    </div>
                  </div>
                  <div className="item-actions">
                    <button className="icon-btn" onClick={() => removeItem(item.id)} title="삭제">✕</button>
                  </div>
                </div>
              );
            })}

            <div className="add-row">
              <input
                placeholder={`${PERIODS.find(p => p.key === active).label} 항목 추가...`}
                value={newItemText}
                onChange={e => setNewItemText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
              />
              <button className="add-btn" onClick={addItem}>추가</button>
            </div>
          </div>
        </>
      )}

      {view === 'lawsearch' && (
        <div className="panel">
          <div className="panel-head">
            <h2>관련 법령 조문</h2>
            <div className="cycle-label">조문을 클릭하면 바로 아래에 원문이 펼쳐져요</div>
          </div>
          {Object.entries(LAW_INDEX).map(([lawName, articles]) => (
            <div key={lawName} style={{marginBottom: 18}}>
              <div style={{fontSize:13.5, fontWeight:800, margin:'14px 0 4px', color:'var(--ink)'}}>{lawName}</div>
              {articles.map(a => {
                const key = `${lawName}|${a.no}`;
                const isOpen = expandedArticle === key;
                return (
                  <div key={a.no}>
                    <div
                      className="item"
                      style={{cursor:'pointer'}}
                      onClick={() => setExpandedArticle(isOpen ? null : key)}
                    >
                      <div className="item-body">
                        <div className="item-name">{a.no} ({a.title})</div>
                        {!a.text && <div className="item-meta">원문 준비 중 — 클릭 시 law.go.kr에서 확인</div>}
                        {a.text && <div className="item-meta">{isOpen ? '접기' : '펼쳐서 원문 보기'}</div>}
                      </div>
                      <div className="item-actions">
                        <span className="icon-btn">{isOpen ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{
                        background:'#fbfaf6', border:'1px solid var(--line)', borderRadius:4,
                        padding:'14px 16px', margin:'2px 0 10px', fontSize:13, lineHeight:1.75,
                        whiteSpace:'pre-wrap', color:'#2a2f3a',
                      }}>
                        {a.text ? (
                          <>
                            {a.text}
                            <div style={{marginTop:12, fontSize:11.5, color:'var(--muted)'}}>
                              확인일: {a.lastChecked} · 개정 여부는{' '}
                              <a href={lawSearchUrl(lawName, a.no)} target="_blank" rel="noopener noreferrer" style={{color:'var(--safety)'}}>
                                law.go.kr 최신 원문
                              </a>
                              에서 다시 확인하세요.
                            </div>
                          </>
                        ) : (
                          <>
                            아직 이 조문의 원문은 앱에 넣어두지 않았어요.{' '}
                            <a href={lawSearchUrl(lawName, a.no)} target="_blank" rel="noopener noreferrer" style={{color:'var(--safety)'}}>
                              law.go.kr에서 바로 확인하기 ↗
                            </a>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="footer-note" style={{marginTop:6}}>
            원문은 특정 시점 기준 스냅샷이에요. 법이 개정될 수 있으니 중요한 판단은 law.go.kr 최신본으로 다시 확인하세요.
          </div>
        </div>
      )}

      <div className="footer-note">
        모든 데이터는 내 계정으로 클라우드에 저장되어 어느 기기에서 로그인해도 동일하게 보입니다.
      </div>
    </div>
  );
}
