'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../lib/supabase/client';
import PlanArt from './PlanArt';

// ── 화면 모양 전용: 홈 첫 화면의 바로가기와 업무 카드 문구 (이동은 기존 goTo 함수 사용) ──
const ICONS = {
  checklist: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="M9 12l2 2 4-4" /><path d="M9 17h6" />
    </svg>
  ),
  eval: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 4.5a3 3 0 0 1 0 6" /><path d="M18 14c2 .8 3 2.8 3 6" />
    </svg>
  ),
  law: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18" /><path d="M7 21h10" /><path d="M5 7h14" /><path d="M5 7L2 13a3 3 0 0 0 6 0L5 7z" /><path d="M19 7l-3 6a3 3 0 0 0 6 0l-3-6z" />
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M8 13h8" />
    </svg>
  ),
  notice: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z" /><path d="M16 9a4 4 0 0 1 0 6" /><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  ),
};

const ADMIN_LINKS = [
  { key: 'announcements', dt: '회사 소식', dd: '공지사항' },
  { key: 'checklist', dt: '주기별 점검', dd: '체크리스트' },
  { key: 'evalReview', dt: '제출된 평가', dd: '평가검토' },
  { key: 'lawsearch', dt: '법령 조문', dd: '법령검색' },
  { key: 'templates', dt: '서식 내려받기', dd: '양식함' },
];
const USER_LINKS = [
  { key: 'announcements', dt: '회사 소식', dd: '공지사항' },
  { key: 'lawsearch', dt: '법령 조문', dd: '법령검색' },
  { key: 'templates', dt: '서식 내려받기', dd: '양식함' },
];

const ADMIN_CARDS = [
  { key: 'checklist', icon: 'checklist', title: '주기별 체크리스트', desc: '일일부터 연간까지 점검 항목을 체크하고 완료 증빙자료를 남깁니다.', list: ['일일 · 주간 · 월간 · 분기 · 반기 · 연간', '항목 추가 · 수정 · 순서 변경', 'PDF · 사진 증빙 첨부'], go: '체크리스트 바로가기' },
  { key: 'evalCreate', icon: 'eval', title: '협력업체 평가', desc: '평가 양식을 만들어 협력업체에 배정하고, 제출된 결과와 증빙자료를 검토합니다.', list: ['평가 양식 만들기 · 배정', '제출 현황 확인', '검토 완료 처리'], go: '평가 바로가기' },
  { key: 'lawsearch', icon: 'law', title: '자료실', desc: '관련 법령의 주요 조문을 찾아보고, 자주 쓰는 서식을 분류별로 내려받습니다.', list: ['산업안전보건법 · 중대재해처벌법 조문', '양식 올리기 · 내려받기'], go: '법령검색 바로가기' },
];
const USER_CARDS = [
  { key: 'lawsearch', icon: 'law', title: '법령검색', desc: '산업안전보건법 등 관련 법령의 주요 조문을 바로 찾아 확인합니다.', list: ['산업안전보건법', '중대재해처벌법'], go: '법령검색 바로가기' },
  { key: 'templates', icon: 'folder', title: '양식함', desc: '자주 쓰는 안전보건 서식을 분류별로 모아 두고 필요할 때 내려받습니다.', list: ['일반 · 현장서류 · 중대재해처벌법', '양식 올리기 · 내려받기'], go: '양식함 바로가기' },
  { key: 'announcements', icon: 'notice', title: '공지사항', desc: '회사 공지와 안전보건 소식을 확인합니다.', list: ['중요 공지는 맨 위에 고정', '첨부파일 내려받기'], go: '공지사항 보기' },
];

const statusLabel = { pending: '작성중', submitted: '제출완료', reviewed: '검토완료' };

export default function HomePanel({ displayName, userEmail, isAdmin, goTo }) {
  const supabase = createClient();

  const [announcements, setAnnouncements] = useState([]);

  const [inProgress, setInProgress] = useState([]);
  const [loadingEval, setLoadingEval] = useState(true);

  const [pendingUsers, setPendingUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [approvingId, setApprovingId] = useState(null);

  const loadAnnouncements = useCallback(async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5);
    setAnnouncements(data || []);
  }, [supabase]);

  const loadInProgress = useCallback(async () => {
    setLoadingEval(true);
    const { data } = await supabase
      .from('evaluations')
      .select('*, eval_templates(title), profiles!evaluations_vendor_id_fkey(email, company_name)')
      .in('status', ['pending', 'submitted'])
      .order('created_at', { ascending: false })
      .limit(5);
    setInProgress(data || []);
    setLoadingEval(false);
  }, [supabase]);

  const loadPendingUsers = useCallback(async () => {
    if (!isAdmin) { setLoadingUsers(false); return; }
    setLoadingUsers(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('approved', false)
      .order('created_at', { ascending: false })
      .limit(5);
    setPendingUsers(data || []);
    setLoadingUsers(false);
  }, [isAdmin, supabase]);

  useEffect(() => { loadAnnouncements(); loadInProgress(); loadPendingUsers(); }, [loadAnnouncements, loadInProgress, loadPendingUsers]);

  const quickApprove = async (id, companyName) => {
    setApprovingId(id);
    const role = companyName ? 'vendor' : 'user';
    const { error } = await supabase.from('profiles').update({ approved: true, role }).eq('id', id);
    setApprovingId(null);
    if (error) { alert('승인 실패: ' + error.message); return; }
    setPendingUsers(prev => prev.filter(p => p.id !== id));
  };

  const links = isAdmin ? ADMIN_LINKS : USER_LINKS;
  const cards = isAdmin ? ADMIN_CARDS : USER_CARDS;
  const open = (key) => (e) => { e.preventDefault(); goTo(key); };

  return (
    <>
      <section className="hero">
        <div className="hero-photo"><img src="/img/hero-site.jpg" alt="" /></div>
        <PlanArt className="plan-hero" />
        <div className="wrap">
          <div className="hero-inner">
            <p className="label">안전보건 통합관리시스템</p>
            <h1>안녕하세요, {displayName || userEmail}님<br /><em>오늘도 안전한 현장을 함께 만들어요.</em></h1>
            <p className="lead">
              {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}{' '}<br />
              공지사항과 진행 중인 평가를 확인하고, 필요한 업무로 바로 이동하세요.
            </p>
            <div className="hero-btns">
              {isAdmin ? (
                <>
                  <a href="#" className="btn btn-red" onClick={open('checklist')}>체크리스트 바로가기</a>
                  <a href="#" className="btn btn-ghost" onClick={open('evalReview')}>제출된 평가 검토</a>
                </>
              ) : (
                <>
                  <a href="#" className="btn btn-red" onClick={open('lawsearch')}>법령검색</a>
                  <a href="#" className="btn btn-ghost" onClick={open('templates')}>양식함</a>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="facts">
          <div className="wrap">
            <div className="facts-list" style={{ '--n': links.length }}>
              {links.map(l => (
                <a key={l.key} href="#" className="f" onClick={open(l.key)}>
                  <span className="dt">{l.dt}</span>
                  <span className="dd">{l.dd}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="label">알림</p>
            <h2>지금 확인할 일</h2>
          </div>
      <div className="home-grid">

        {/* 공지사항 */}
        <div className="panel">
          <div className="panel-head">
            <h2>공지사항</h2>
            <span className="icon-btn" style={{cursor:'pointer'}} onClick={() => goTo('announcements')}>더보기 →</span>
          </div>

          {announcements.length === 0 && <div className="empty">등록된 공지사항이 없어요.</div>}
          {announcements.map(a => (
            <div className="item" key={a.id} style={{cursor:'pointer'}} onClick={() => goTo('announcements', a.id)}>
              <div className="item-body">
                <div className="item-name">{a.pinned && '📌 '}{a.title}</div>
                <div className="item-meta">{new Date(a.created_at).toLocaleDateString('ko-KR')}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 진행중인 평가 */}
        <div className="panel">
          <div className="panel-head">
            <h2>진행중인 평가</h2>
            {isAdmin && <span className="icon-btn" style={{cursor:'pointer'}} onClick={() => goTo('evalReview')}>더보기 →</span>}
          </div>

          {loadingEval && <div className="empty">불러오는 중...</div>}

          {!loadingEval && inProgress.length === 0 && (
            <div className="empty">진행 중인 평가가 없어요.</div>
          )}

          {inProgress.map(ev => (
            <div
              className="item"
              key={ev.id}
              style={isAdmin ? {cursor:'pointer'} : {}}
              onClick={() => isAdmin && goTo('evalReview')}
            >
              <div className="item-body">
                <div className="item-name">{ev.eval_templates?.title} — {ev.profiles?.company_name || ev.profiles?.email}</div>
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

        {/* 가입 승인 요청 */}
        <div className="panel">
          <div className="panel-head">
            <h2>가입 승인 요청</h2>
            {isAdmin && <span className="icon-btn" style={{cursor:'pointer'}} onClick={() => goTo('adminUsers')}>더보기 →</span>}
          </div>

          {!isAdmin && (
            <div className="empty">가입 승인 요청은 관리자만 볼 수 있어요.</div>
          )}

          {isAdmin && loadingUsers && <div className="empty">불러오는 중...</div>}

          {isAdmin && !loadingUsers && pendingUsers.length === 0 && (
            <div className="empty">대기 중인 가입 신청이 없어요.</div>
          )}

          {isAdmin && pendingUsers.map(p => (
            <div className="item" key={p.id}>
              <div className="item-body">
                <div className="item-name">{p.full_name ? `${p.full_name} (${p.email})` : p.email}</div>
                <div className="item-meta">
                  {new Date(p.created_at).toLocaleDateString('ko-KR')}
                  {p.company_name && <span style={{marginLeft:8}}>· {p.company_name}</span>}
                  {p.position && <span style={{marginLeft:8}}>· {p.position}</span>}
                </div>
              </div>
              <div className="item-actions">
                <button className="add-btn" style={{fontSize:12, padding:'6px 12px'}} onClick={() => quickApprove(p.id, p.company_name)} disabled={approvingId === p.id}>
                  {approvingId === p.id ? '승인 중...' : '승인'}
                </button>
                <button className="icon-btn" onClick={() => goTo('adminUsers')}>자세히</button>
              </div>
            </div>
          ))}
        </div>

      </div>
        </div>
      </section>

      <section className="section soft">
        <div className="wrap">
          <div className="sec-head">
            <p className="label">주요 업무</p>
            <h2>필요한 업무로 바로 이동하세요</h2>
            <p>자주 쓰는 업무를 모았습니다. 카드를 누르면 해당 화면으로 이동합니다.</p>
          </div>
          <div className="cards">
            {cards.map(c => (
              <a key={c.key} href="#" className="card" onClick={open(c.key)}>
                <div className="icon">{ICONS[c.icon]}</div>
                <h3>{c.title}</h3>
                <div>
                  <p>{c.desc}</p>
                  <ul style={{ marginTop: 14 }}>{c.list.map(t => <li key={t}>{t}</li>)}</ul>
                </div>
                <div className="go">{c.go} →</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="wrap cta-row">
          <div>
            <p className="label">안전 수칙</p>
            <h2>위험하다고 느끼면 먼저 멈추고 알려주세요.</h2>
            <p className="cta-sub">관리감독자 또는 안전보건관리팀에 바로 알리면 함께 조치합니다.</p>
          </div>
          <div className="cta-btns">
            <a href="#" className="btn btn-white" onClick={open('announcements')}>공지사항 보기</a>
          </div>
        </div>
      </section>
    </>
  );
}
