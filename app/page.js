'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import AdminUsersPanel from './components/AdminUsersPanel';
import AdminEvalCreatePanel from './components/AdminEvalCreatePanel';
import AdminEvalReviewPanel from './components/AdminEvalReviewPanel';
import HomePanel from './components/HomePanel';
import AnnouncementsPanel from './components/AnnouncementsPanel';
import ClipIcon from './components/ClipIcon';
import LawSearchPanel from './components/LawSearchPanel';
import SettingsModal from './components/SettingsModal';

const VIEW_TITLES = {
  home: '홈',
  announcements: '공지사항',
  checklist: '체크리스트',
  yearly: '연도별 기록',
  lawsearch: '법령검색',
  templates: '양식함',
  adminUsers: '회원 관리',
  evalCreate: '평가생성',
  evalReview: '평가검토',
};

const VIEW_ICONS = {
  home: '🏠',
  announcements: '📢',
  checklist: '📋',
  yearly: '📅',
  lawsearch: '⚖️',
  templates: '📁',
  adminUsers: '🛡️',
  evalCreate: '🏗️',
  evalReview: '📝',
};

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
  // 주기(일일/주간/월간 등)와 상관없이, 연도 단위로만 초기화돼요.
  // 즉 한 번 완료 체크하면 그 해가 끝날 때까지 계속 완료 상태로 유지되고,
  // 새해가 되면 다시 미완료로 시작해요.
  return `${d.getFullYear()}`;
}

function cycleLabel(period) {
  const y = new Date().getFullYear();
  const map = {
    daily: `${y}년 일일 점검`,
    weekly: `${y}년 주간 점검`,
    monthly: `${y}년 월간 점검`,
    quarterly: `${y}년 분기 점검`,
    semiannual: `${y}년 반기 점검`,
    annual: `${y}년 연간 점검`,
  };
  return map[period] || `${y}년 점검`;
}

function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function weeksInYear(year) {
  const key = getCycleKey('weekly', new Date(year, 11, 31));
  return parseInt(key.split('W')[1], 10) || 52;
}

function totalCyclesInYear(period, year) {
  if (period === 'daily') return isLeapYear(year) ? 366 : 365;
  if (period === 'weekly') return weeksInYear(year);
  if (period === 'monthly') return 12;
  if (period === 'quarterly') return 4;
  if (period === 'semiannual') return 2;
  if (period === 'annual') return 1;
  return 1;
}

function completedCyclesInYear(doneSet, year) {
  if (!doneSet) return 0;
  const prefix = String(year);
  let count = 0;
  doneSet.forEach(k => { if (k.startsWith(prefix)) count++; });
  return count;
}

function isImageFile(name) {
  return /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(name || '');
}

function isPdfFile(name) {
  return /\.pdf$/i.test(name || '');
}

function DashboardInner() {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [settingsMsg, setSettingsMsg] = useState(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [items, setItems] = useState([]);
  const [doneMap, setDoneMap] = useState({}); // itemId -> Set of cycleKeys done
  const [fileMap, setFileMap] = useState({}); // itemId -> { cycleKey: {path, name} }
  const [expandedItem, setExpandedItem] = useState(null); // item.id currently expanded
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItemText, setEditingItemText] = useState('');
  const [expandedYearlyItem, setExpandedYearlyItem] = useState(null); // item.id currently expanded in yearly view
  const [uploading, setUploading] = useState(null); // item.id currently uploading
  const [signedUrls, setSignedUrls] = useState({}); // path -> signed url
  const [active, setActive] = useState('daily');
  const [view, setView] = useState(() => searchParams.get('view') || 'home');
  const [openAnnouncementId, setOpenAnnouncementId] = useState(() => searchParams.get('id') || null);
  const isInternalNav = useRef(false);

  // 브라우저 뒤로가기/앞으로가기로 URL이 바뀌면 화면 상태를 맞춰줘요
  useEffect(() => {
    if (isInternalNav.current) {
      isInternalNav.current = false;
      return;
    }
    const urlView = searchParams.get('view') || 'home';
    const urlId = searchParams.get('id');
    setView(urlView);
    setOpenAnnouncementId(urlView === 'announcements' ? urlId : null);
  }, [searchParams]);
  const [homeExpanded, setHomeExpanded] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearlyPeriod, setYearlyPeriod] = useState('daily');
  const [newItemText, setNewItemText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templateCategory, setTemplateCategory] = useState('일반');
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [templateUploading, setTemplateUploading] = useState(false);
  const [templateSignedUrls, setTemplateSignedUrls] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUserEmail(user.email);

    const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single();
    setDisplayName(profile?.full_name || '');
    const adminFlag = profile?.role === 'admin';
    setIsAdmin(adminFlag);
    if (!adminFlag) {
      setView(v => {
        if (v === 'checklist' || v === 'yearly') {
          const params = new URLSearchParams();
          params.set('view', 'lawsearch');
          isInternalNav.current = true;
          router.replace(`${pathname}?${params.toString()}`);
          return 'lawsearch';
        }
        return v;
      });
    }

    let { data: itemRows, error: itemErr } = await supabase
      .from('checklist_items')
      .select('*')
      .order('sort_order', { ascending: true })
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
      .select('item_id, cycle_key, file_url, file_name');

    if (logErr) { setError('기록을 불러오지 못했습니다: ' + logErr.message); setLoading(false); return; }

    const map = {};
    const fmap = {};
    (logRows || []).forEach(r => {
      if (!map[r.item_id]) map[r.item_id] = new Set();
      map[r.item_id].add(r.cycle_key);
      if (r.file_url) {
        if (!fmap[r.item_id]) fmap[r.item_id] = {};
        fmap[r.item_id][r.cycle_key] = { path: r.file_url, name: r.file_name };
      }
    });

    setItems(itemRows || []);
    setDoneMap(map);
    setFileMap(fmap);

    const { data: templateRows } = await supabase
      .from('templates')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    setTemplates(templateRows || []);

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

  const uploadEvidence = async (item, file) => {
    if (!file) return;
    const cycleKey0 = getCycleKey(item.period);
    if (fileMap[item.id]?.[cycleKey0]) {
      if (!confirm('이미 첨부된 파일이 있어요. 새 파일로 교체할까요? (기존 파일은 사라져요)')) return;
    }
    setUploading(item.id);
    const cycleKey = getCycleKey(item.period);
    const { data: { user } } = await supabase.auth.getUser();
    const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1] : 'dat';
    const path = `${user.id}/${item.id}/${Date.now()}.${ext}`;

    // 네트워크 응답을 기다리지 않고, 방금 고른 파일을 브라우저에서 바로 미리보기로 보여줌
    const localPreviewUrl = URL.createObjectURL(file);
    setSignedUrls(prev => ({ ...prev, [path]: localPreviewUrl }));
    setFileMap(prev => ({
      ...prev,
      [item.id]: { ...(prev[item.id] || {}), [cycleKey]: { path, name: file.name } },
    }));

    const rollback = (msg) => {
      setError(msg);
      setFileMap(prev => {
        const next = { ...prev };
        if (next[item.id]) { next[item.id] = { ...next[item.id] }; delete next[item.id][cycleKey]; }
        return next;
      });
      setUploading(null);
    };

    const { error: upErr } = await supabase.storage.from('evidence').upload(path, file);
    if (upErr) { rollback('파일 업로드 실패: ' + upErr.message); return; }

    const isDone = doneMap[item.id]?.has(cycleKey);
    if (isDone) {
      const { error: updErr, data: updData } = await supabase.from('checklist_log')
        .update({ file_url: path, file_name: file.name })
        .eq('item_id', item.id).eq('cycle_key', cycleKey)
        .select();
      if (updErr) { rollback('파일 정보 저장 실패: ' + updErr.message); return; }
      if (!updData || updData.length === 0) {
        rollback('파일 정보 저장 실패: 권한 문제로 기록이 갱신되지 않았어요. Supabase에서 checklist_log 수정 권한(UPDATE 정책)을 확인해주세요.');
        return;
      }
    } else {
      const { error: insErr } = await supabase.from('checklist_log')
        .insert({ item_id: item.id, cycle_key: cycleKey, user_id: user.id, file_url: path, file_name: file.name });
      if (insErr) { rollback('파일 정보 저장 실패: ' + insErr.message); return; }
      setDoneMap(prev => {
        const next = { ...prev };
        next[item.id] = new Set(next[item.id] || []);
        next[item.id].add(cycleKey);
        return next;
      });
    }

    setUploading(null);
  };

  const removeEvidence = async (item) => {
    const cycleKey = getCycleKey(item.period);
    const current = fileMap[item.id]?.[cycleKey];
    if (!current) return;
    await supabase.storage.from('evidence').remove([current.path]);
    await supabase.from('checklist_log')
      .update({ file_url: null, file_name: null })
      .eq('item_id', item.id).eq('cycle_key', cycleKey);
    setFileMap(prev => {
      const next = { ...prev };
      if (next[item.id]) {
        next[item.id] = { ...next[item.id] };
        delete next[item.id][cycleKey];
      }
      return next;
    });
  };

  const getSignedUrl = async (path) => {
    if (signedUrls[path]) return signedUrls[path];
    const { data, error: sErr } = await supabase.storage.from('evidence').createSignedUrl(path, 3600);
    if (sErr || !data) return null;
    setSignedUrls(prev => ({ ...prev, [path]: data.signedUrl }));
    return data.signedUrl;
  };

  const uploadTemplate = async (file) => {
    if (!file) return;
    setTemplateUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1] : 'dat';
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage.from('templates').upload(path, file);
    if (upErr) { setError('양식 업로드 실패: ' + upErr.message); setTemplateUploading(false); return; }

    const maxOrder = templates.length > 0 ? Math.max(...templates.map(t => t.sort_order ?? 0)) + 1 : 0;
    const { data, error: insErr } = await supabase
      .from('templates')
      .insert({ user_id: user.id, name: file.name, file_url: path, file_name: file.name, sort_order: maxOrder, category: templateCategory })
      .select();
    if (insErr) { setError('양식 정보 저장 실패: ' + insErr.message); setTemplateUploading(false); return; }

    setTemplates(prev => [...prev, ...(data || [])]);
    setTemplateUploading(false);
  };

  const deleteTemplate = async (tpl) => {
    if (!confirm(`"${tpl.file_name}" 양식을 삭제할까요?`)) return;
    await supabase.storage.from('templates').remove([tpl.file_url]);
    await supabase.from('templates').delete().eq('id', tpl.id);
    setTemplates(prev => prev.filter(t => t.id !== tpl.id));
  };

  const moveTemplate = async (tpl, direction, list) => {
    const group = [...(list || templates)].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || new Date(b.created_at) - new Date(a.created_at));
    const idx = group.findIndex(t => t.id === tpl.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= group.length) return;

    const a = group[idx];
    const b = group[swapIdx];
    const tmpOrder = a.sort_order ?? 0;
    const newAOrder = b.sort_order ?? 0;
    const newBOrder = tmpOrder;

    setTemplates(prev => prev.map(p => {
      if (p.id === a.id) return { ...p, sort_order: newAOrder };
      if (p.id === b.id) return { ...p, sort_order: newBOrder };
      return p;
    }));

    await Promise.all([
      supabase.from('templates').update({ sort_order: newAOrder }).eq('id', a.id),
      supabase.from('templates').update({ sort_order: newBOrder }).eq('id', b.id),
    ]);
  };

  const getTemplateSignedUrl = async (path) => {
    if (templateSignedUrls[path]) return templateSignedUrls[path];
    const { data, error: sErr } = await supabase.storage.from('templates').createSignedUrl(path, 3600);
    if (sErr || !data) return null;
    setTemplateSignedUrls(prev => ({ ...prev, [path]: data.signedUrl }));
    return data.signedUrl;
  };

  const downloadTemplate = async (tpl) => {
    const url = await getTemplateSignedUrl(tpl.file_url);
    if (!url) { setError('파일을 여는 데 실패했어요.'); return; }
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = tpl.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      setError('다운로드 중 오류가 발생했어요: ' + e.message);
    }
  };

  const addItem = async () => {
    const text = newItemText.trim();
    if (!text) return;
    const { data: { user } } = await supabase.auth.getUser();
    const sameperiod = items.filter(i => i.period === active);
    const nextOrder = sameperiod.length > 0
      ? Math.max(...sameperiod.map(i => i.sort_order ?? 0)) + 1
      : 0;
    const { data, error: insErr } = await supabase
      .from('checklist_items')
      .insert({ period: active, name: text, user_id: user.id, sort_order: nextOrder })
      .select();
    if (!insErr && data) {
      setItems(prev => [...prev, ...data]);
      setNewItemText('');
    }
  };

  const removeItem = async (id, name) => {
    if (!confirm(`"${name}" 항목을 삭제할까요? 완료 기록과 첨부파일도 함께 삭제되며 되돌릴 수 없습니다.`)) return;
    await supabase.from('checklist_items').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const startEditItem = (item) => {
    setEditingItemId(item.id);
    setEditingItemText(item.name);
  };

  const cancelEditItem = () => {
    setEditingItemId(null);
    setEditingItemText('');
  };

  const saveEditItem = async () => {
    const text = editingItemText.trim();
    if (!text) return;
    const { error: updErr } = await supabase
      .from('checklist_items')
      .update({ name: text })
      .eq('id', editingItemId);
    if (updErr) { alert('수정 실패: ' + updErr.message); return; }
    setItems(prev => prev.map(i => i.id === editingItemId ? { ...i, name: text } : i));
    setEditingItemId(null);
    setEditingItemText('');
  };

  const moveItem = async (item, direction) => {
    const group = items
      .filter(i => i.period === item.period)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || new Date(a.created_at) - new Date(b.created_at));
    const idx = group.findIndex(i => i.id === item.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= group.length) return;

    // 그룹 전체 순서를 0,1,2... 로 정리한 뒤 두 항목만 맞바꿔요.
    const normalized = group.map((it, i) => ({ id: it.id, sort_order: i }));
    const tmp = normalized[idx].sort_order;
    normalized[idx].sort_order = normalized[swapIdx].sort_order;
    normalized[swapIdx].sort_order = tmp;

    setItems(prev => prev.map(p => {
      const found = normalized.find(n => n.id === p.id);
      return found ? { ...p, sort_order: found.sort_order } : p;
    }));

    await Promise.all(normalized.map(n =>
      supabase.from('checklist_items').update({ sort_order: n.sort_order }).eq('id', n.id)
    ));
  };

  const handleLogout = async () => {
    if (!confirm('정말 로그아웃 하시겠습니까?')) return;
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const navigate = (targetView, opts = {}) => {
    isInternalNav.current = true;
    setView(targetView);
    setOpenAnnouncementId(targetView === 'announcements' ? (opts.id || null) : null);
    const params = new URLSearchParams();
    params.set('view', targetView);
    if (opts.id) params.set('id', opts.id);
    const url = `${pathname}?${params.toString()}`;
    if (opts.replace) router.replace(url); else router.push(url);
  };

  const goToAdminOnlyView = async (targetView, opts = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
      alert('관리자 권한이 해제되어 더 이상 접근할 수 없어요. 화면을 새로고침할게요.');
      window.location.reload();
      return;
    }
    navigate(targetView, opts);
  };

  const ADMIN_ONLY_VIEWS = ['checklist', 'yearly', 'adminUsers', 'evalCreate', 'evalReview'];
  const goTo = (targetView, payload) => {
    const opts = targetView === 'announcements' ? { id: payload } : {};
    if (ADMIN_ONLY_VIEWS.includes(targetView)) {
      goToAdminOnlyView(targetView, opts);
    } else {
      navigate(targetView, opts);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSettingsMsg(null);
    if (newPassword.length < 6) {
      setSettingsMsg({ type: 'error', text: '비밀번호는 6자 이상이어야 해요.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setSettingsMsg({ type: 'error', text: '비밀번호가 서로 일치하지 않아요.' });
      return;
    }
    setSettingsBusy(true);
    const { error: pwErr } = await supabase.auth.updateUser({ password: newPassword });
    setSettingsBusy(false);
    if (pwErr) {
      setSettingsMsg({ type: 'error', text: '변경 실패: ' + pwErr.message });
      return;
    }
    setSettingsMsg({ type: 'success', text: '비밀번호가 변경되었어요.' });
    setNewPassword('');
    setConfirmPassword('');
  };

  if (loading) return <div className="app-shell"><div className="main-content"><div className="content-inner"><div className="empty">불러오는 중...</div></div></div></div>;

  const periodItems = items
    .filter(i => i.period === active)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || new Date(a.created_at) - new Date(b.created_at));
  const cycleKey = getCycleKey(active);
  const doneCount = periodItems.filter(i => doneMap[i.id]?.has(cycleKey)).length;
  const total = periodItems.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  const thisYear = new Date().getFullYear();
  const yearsFromData = new Set([thisYear]);
  Object.values(doneMap).forEach(set => {
    set.forEach(k => { const y = parseInt(k.slice(0, 4), 10); if (!isNaN(y)) yearsFromData.add(y); });
  });
  const availableYears = Array.from(yearsFromData).sort((a, b) => b - a);

  return (
    <div className="app-shell">
      <div className="topbar-global">
        <div className="topbar-global-brand" style={{cursor:'pointer'}} onClick={() => navigate('home')}>
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
          <span className="topbar-global-email">{displayName || userEmail}</span>
          <button
            className="topbar-global-logout"
            style={{padding:'7px 12px', fontSize:15}}
            onClick={() => { setShowSettings(true); setSettingsMsg(null); }}
            title="개인 설정"
          >
            ⚙️
          </button>
          <button className="topbar-global-logout" onClick={handleLogout}>로그아웃</button>
        </div>
      </div>

      {showSettings && (
        <SettingsModal userEmail={userEmail} onClose={() => setShowSettings(false)} />
      )}

      <div className="app-body">
      <aside className="sidebar">
        <nav>
          <div
            className={"sidebar-nav-item" + (view === 'home' ? " active" : "")}
            style={{justifyContent:'space-between'}}
            onClick={() => navigate('home')}
          >
            <span><span style={{marginRight:10}}>🏠</span>홈</span>
            {isAdmin && (
              <span
                onClick={e => { e.stopPropagation(); setHomeExpanded(v => !v); }}
                style={{fontSize:11, opacity:0.8, padding:'2px 4px'}}
              >
                {homeExpanded ? '▲' : '▼'}
              </span>
            )}
          </div>
          {isAdmin && homeExpanded && (
            <div
              className={"sidebar-nav-item" + (view === 'announcements' ? " active" : "")}
              style={{paddingLeft:34, fontSize:14}}
              onClick={() => goToAdminOnlyView('announcements')}
            >
              <span>📢</span> 공지사항
            </div>
          )}
          {isAdmin && (
            <>
              <div className={"sidebar-nav-item" + (view === 'checklist' ? " active" : "")} onClick={() => goToAdminOnlyView('checklist')}>
                <span>📋</span> 체크리스트
              </div>
              <div className={"sidebar-nav-item" + (view === 'yearly' ? " active" : "")} onClick={() => goToAdminOnlyView('yearly')}>
                <span>📅</span> 연도별 기록
              </div>
            </>
          )}
          <div className={"sidebar-nav-item" + (view === 'lawsearch' ? " active" : "")} onClick={() => navigate('lawsearch')}>
            <span>⚖️</span> 법령검색
          </div>
          <div className={"sidebar-nav-item" + (view === 'templates' ? " active" : "")} onClick={() => navigate('templates')}>
            <span>📁</span> 양식함
          </div>
          {isAdmin && (
            <>
              <div className={"sidebar-nav-item" + (view === 'evalCreate' ? " active" : "")} onClick={() => goToAdminOnlyView('evalCreate')}>
                <span>🏗️</span> 평가생성
              </div>
              <div className={"sidebar-nav-item" + (view === 'evalReview' ? " active" : "")} onClick={() => goToAdminOnlyView('evalReview')}>
                <span>📝</span> 평가검토
              </div>
            </>
          )}
        </nav>
        {isAdmin && (
          <div className="sidebar-footer-menu">
            <div className={"sidebar-nav-item" + (view === 'adminUsers' ? " active" : "")} onClick={() => goToAdminOnlyView('adminUsers')}>
              <span>🛡️</span> 회원 관리
            </div>
          </div>
        )}
      </aside>

      <main className="main-content">
        <div className="content-inner">
      <div className="masthead">
        <div>
          <h1>{VIEW_TITLES[view] || '안전보건 통합관리시스템'}</h1>
        </div>
      </div>
      <div className="stripe"></div>

      {error && <div className="disclaimer">{error}</div>}

      {view === 'home' && (
        <HomePanel displayName={displayName} userEmail={userEmail} isAdmin={isAdmin} goTo={goTo} />
      )}

      {view === 'announcements' && (
        <AnnouncementsPanel isAdmin={isAdmin} openAnnouncementId={openAnnouncementId} />
      )}

      {view === 'checklist' && isAdmin && (
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

            <div className="panel-scroll">
            {periodItems.map((item, idx) => {
              const isDone = !!doneMap[item.id]?.has(cycleKey);
              const evidence = fileMap[item.id]?.[cycleKey];
              const isOpen = expandedItem === item.id;
              return (
                <div key={item.id}>
                  <div className="item">
                    <div className={"check" + (isDone ? " done" : "")} onClick={() => toggleItem(item)}></div>
                    {editingItemId === item.id ? (
                      <div className="item-body" style={{display:'flex', gap:8, alignItems:'center'}}>
                        <input
                          value={editingItemText}
                          onChange={e => setEditingItemText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEditItem(); if (e.key === 'Escape') cancelEditItem(); }}
                          autoFocus
                          style={{flex:1, padding:'8px 10px', border:'1px solid var(--line)', borderRadius:4, fontSize:14}}
                        />
                        <button className="add-btn" style={{fontSize:12, padding:'6px 12px'}} onClick={saveEditItem}>저장</button>
                        <button className="icon-btn" onClick={cancelEditItem}>취소</button>
                      </div>
                    ) : (
                      <div className="item-body" style={{cursor:'pointer'}} onClick={async () => {
                        if (isOpen) { setExpandedItem(null); return; }
                        setExpandedItem(item.id);
                        if (evidence) await getSignedUrl(evidence.path);
                      }}>
                        <div className={"item-name" + (isDone ? " done" : "")}>{item.name}</div>
                        <div className="item-meta">
                          {isDone ? <span className="badge ok">완료</span> : <span className="badge warn">미완료</span>}
                          {evidence && <span style={{marginLeft:6}}><ClipIcon /> {evidence.name}</span>}
                        </div>
                      </div>
                    )}
                    <div className="item-actions">
                      <button className="icon-btn" onClick={() => moveItem(item, 'up')} disabled={idx === 0} title="위로" style={idx === 0 ? {opacity:0.3, cursor:'default'} : {}}>▲</button>
                      <button className="icon-btn" onClick={() => moveItem(item, 'down')} disabled={idx === periodItems.length - 1} title="아래로" style={idx === periodItems.length - 1 ? {opacity:0.3, cursor:'default'} : {}}>▼</button>
                      <button className="icon-btn" onClick={() => startEditItem(item)} title="수정">✏️</button>
                      <button className="icon-btn" onClick={() => removeItem(item.id, item.name)} title="삭제">✕</button>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{
                      background:'#fbfaf6', border:'1px solid var(--line)', borderRadius:4,
                      padding:'14px 16px', margin:'2px 0 10px', fontSize:13, lineHeight:1.7,
                    }}>
                      {evidence ? (
                        <>
                          <div style={{marginBottom:8}}>
                            <ClipIcon /> <b>{evidence.name}</b>
                          </div>
                          {signedUrls[evidence.path] ? (
                            <>
                              {isImageFile(evidence.name) && (
                                <img
                                  src={signedUrls[evidence.path]}
                                  alt={evidence.name}
                                  style={{maxWidth:'100%', maxHeight:480, borderRadius:4, border:'1px solid var(--line)', display:'block', marginBottom:8}}
                                />
                              )}
                              {isPdfFile(evidence.name) && (
                                <iframe
                                  src={signedUrls[evidence.path]}
                                  title={evidence.name}
                                  style={{width:'100%', height:520, border:'1px solid var(--line)', borderRadius:4, marginBottom:8}}
                                />
                              )}
                              <a href={signedUrls[evidence.path]} target="_blank" rel="noopener noreferrer" style={{color:'var(--safety)'}}>
                                {isImageFile(evidence.name) || isPdfFile(evidence.name) ? '새 탭에서 크게 보기 ↗' : '파일 열어서 보기 ↗'}
                              </a>
                            </>
                          ) : (
                            <span style={{color:'var(--muted)'}}>미리보기 불러오는 중...</span>
                          )}
                          <div style={{marginTop:10, display:'flex', gap:10}}>
                            <label className="add-btn" style={{cursor:'pointer', display:'inline-block', fontSize:12}}>
                              {uploading === item.id ? '업로드 중...' : '파일 교체'}
                              <input type="file" accept="application/pdf,image/*" style={{display:'none'}}
                                onChange={e => e.target.files[0] && uploadEvidence(item, e.target.files[0])} />
                            </label>
                            <button className="icon-btn" onClick={() => removeEvidence(item)}>첨부 삭제</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{marginBottom:8, color:'var(--muted)'}}>
                            이번 주기({cycleLabel(item.period)}) 완료 증빙자료가 아직 없어요.
                          </div>
                          <label className="add-btn" style={{cursor:'pointer', display:'inline-block', fontSize:12}}>
                            {uploading === item.id ? '업로드 중...' : 'PDF·사진 첨부하기'}
                            <input type="file" accept="application/pdf,image/*" style={{display:'none'}}
                              onChange={e => e.target.files[0] && uploadEvidence(item, e.target.files[0])} />
                          </label>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            </div>

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

      {view === 'yearly' && isAdmin && (
        <>
          <div className="tabs">
            {availableYears.map(y => (
              <div key={y} className={"tab" + (selectedYear === y ? " active" : "")} onClick={() => setSelectedYear(y)}>
                {y}년{y === thisYear ? ' (현재)' : ''}
              </div>
            ))}
          </div>

          <div className="tabs" style={{marginTop:8}}>
            {PERIODS.map(p => {
              const pItems = items.filter(i => i.period === p.key);
              if (pItems.length === 0) return null;
              return (
                <div key={p.key} className={"tab" + (yearlyPeriod === p.key ? " active" : "")} onClick={() => { setYearlyPeriod(p.key); setExpandedYearlyItem(null); }}>
                  {p.label}
                  <span className="count">{pItems.length}</span>
                </div>
              );
            })}
          </div>

          <div className="panel">
          {PERIODS.filter(p => p.key === yearlyPeriod).map((p, pIdx) => {
            const pItems = items.filter(i => i.period === p.key);
            if (pItems.length === 0) return (
              <div key={p.key} className="empty">이 주기에는 아직 항목이 없어요.</div>
            );
            return (
              <div key={p.key} style={{
                marginTop: pIdx === 0 ? 4 : 14,
                background:'var(--panel)', border:'1px solid var(--line)', borderRadius:6,
                padding:'16px 18px',
              }}>
                <div style={{
                  fontSize:16, fontWeight:800, margin:'0 0 10px', color:'var(--safety)',
                  display:'flex', alignItems:'center', gap:8,
                }}>
                  <span style={{width:5, height:16, background:'var(--safety)', borderRadius:2, display:'inline-block'}}></span>
                  {p.label} 항목
                </div>
                {pItems.map(item => {
                  const done = !!doneMap[item.id]?.has(String(selectedYear));
                  const yearFiles = Object.entries(fileMap[item.id] || {})
                    .filter(([ck]) => ck === String(selectedYear))
                    .sort((a, b) => a[0].localeCompare(b[0]));
                  const isOpen = expandedYearlyItem === item.id;
                  return (
                    <div key={item.id}>
                      <div className="item" style={{cursor: yearFiles.length ? 'pointer' : 'default'}}
                        onClick={async () => {
                          if (!yearFiles.length) return;
                          if (isOpen) { setExpandedYearlyItem(null); return; }
                          setExpandedYearlyItem(item.id);
                          await Promise.all(yearFiles.map(([, f]) => getSignedUrl(f.path)));
                        }}>
                        <div className="item-body">
                          <div className="item-name">{item.name}</div>
                          <div className="item-meta">
                            {done ? <span className="badge ok">완료</span> : <span className="badge warn">미완료</span>}
                            {' '}{selectedYear}년
                            {yearFiles.length > 0 && <span style={{marginLeft:6}}><ClipIcon /> 첨부 {yearFiles.length}건 {isOpen ? '▲' : '▼'}</span>}
                          </div>
                        </div>
                      </div>
                      {isOpen && yearFiles.length > 0 && (
                        <div style={{
                          background:'#fbfaf6', border:'1px solid var(--line)', borderRadius:4,
                          padding:'12px 16px', margin:'2px 0 10px', fontSize:12.5, lineHeight:1.8,
                        }}>
                          {yearFiles.map(([ck, f]) => (
                            <div key={ck} style={{display:'flex', justifyContent:'space-between', gap:10}}>
                              <span><ClipIcon /> {f.name} <span style={{color:'var(--muted)'}}>({ck})</span></span>
                              {signedUrls[f.path] ? (
                                <a href={signedUrls[f.path]} target="_blank" rel="noopener noreferrer" style={{color:'var(--safety)', flexShrink:0}}>
                                  보기 ↗
                                </a>
                              ) : (
                                <span style={{color:'var(--muted)'}}>불러오는 중...</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          </div>
        </>
      )}

      {view === 'lawsearch' && <LawSearchPanel />}

      {view === 'templates' && (() => {
        const defaultCategories = ['일반', '현장서류', '중대재해처벌법'];
        const usedCategories = [...new Set(templates.map(t => t.category || '일반'))];
        const allCategories = [...new Set([...defaultCategories, ...usedCategories])];
        const sortedTemplates = [...templates].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || new Date(b.created_at) - new Date(a.created_at));
        const filteredTemplates = sortedTemplates.filter(t => (t.category || '일반') === templateCategory);

        return (
        <>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10}}>
            <div className="tabs" style={{margin:0}}>
              {allCategories.map(cat => (
                <div key={cat} className={"tab" + (templateCategory === cat ? " active" : "")} onClick={() => setTemplateCategory(cat)}>
                  {cat}<span className="count">{templates.filter(t => (t.category || '일반') === cat).length}</span>
                </div>
              ))}
              {showNewCategoryInput ? (
                <div style={{display:'flex', gap:6, alignItems:'center', marginLeft:4}}>
                  <input
                    placeholder="새 카테고리명"
                    value={newCategoryInput}
                    onChange={e => setNewCategoryInput(e.target.value)}
                    autoFocus
                    style={{padding:'8px 10px', border:'1px solid var(--line)', borderRadius:4, fontSize:13, width:120}}
                  />
                  <button className="icon-btn" onClick={() => {
                    if (newCategoryInput.trim()) { setTemplateCategory(newCategoryInput.trim()); }
                    setShowNewCategoryInput(false); setNewCategoryInput('');
                  }}>확인</button>
                  <button className="icon-btn" onClick={() => { setShowNewCategoryInput(false); setNewCategoryInput(''); }}>취소</button>
                </div>
              ) : (
                <div className="tab" onClick={() => setShowNewCategoryInput(true)}>+ 새 카테고리</div>
              )}
            </div>

            <label className="add-btn" style={{cursor:'pointer', display:'inline-block'}}>
              {templateUploading ? '업로드 중...' : `+ "${templateCategory}"에 양식 올리기`}
              <input type="file" style={{display:'none'}}
                onChange={e => e.target.files[0] && uploadTemplate(e.target.files[0])} />
            </label>
          </div>

          <div className="panel panel-scroll">
          {filteredTemplates.length === 0 && <div className="empty">이 카테고리에는 아직 올린 양식이 없어요.</div>}

          {filteredTemplates.map((tpl, idx) => (
            <div className="item" key={tpl.id}>
              <div className="item-body">
                <div className="item-name">📄 {tpl.file_name}</div>
                <div className="item-meta">{new Date(tpl.created_at).toLocaleDateString('ko-KR')} 업로드</div>
              </div>
              <div className="item-actions">
                <button className="icon-btn" onClick={() => moveTemplate(tpl, 'up', filteredTemplates)} disabled={idx === 0} title="위로" style={idx === 0 ? {opacity:0.3, cursor:'default'} : {}}>▲</button>
                <button className="icon-btn" onClick={() => moveTemplate(tpl, 'down', filteredTemplates)} disabled={idx === filteredTemplates.length - 1} title="아래로" style={idx === filteredTemplates.length - 1 ? {opacity:0.3, cursor:'default'} : {}}>▼</button>
                <button
                  className="icon-btn"
                  onClick={() => downloadTemplate(tpl)}
                  title="다운로드"
                  style={{fontSize:13, fontWeight:700, padding:'6px 12px', color:'var(--safety)'}}
                >
                  다운로드
                </button>
                <button className="icon-btn" onClick={() => deleteTemplate(tpl)} title="삭제">✕</button>
              </div>
            </div>
          ))}
          </div>
        </>
        );
      })()}

      {view === 'adminUsers' && isAdmin && <AdminUsersPanel />}
      {view === 'evalCreate' && isAdmin && <AdminEvalCreatePanel />}
      {view === 'evalReview' && isAdmin && <AdminEvalReviewPanel />}

        </div>
      </main>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="app-shell"><div className="main-content"><div className="content-inner"><div className="empty">불러오는 중...</div></div></div></div>}>
      <DashboardInner />
    </Suspense>
  );
}
