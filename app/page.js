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

      <div className="footer-note">
        모든 데이터는 내 계정으로 클라우드에 저장되어 어느 기기에서 로그인해도 동일하게 보입니다.
      </div>
    </div>
  );
}
