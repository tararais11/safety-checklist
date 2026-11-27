'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../lib/supabase/client';
import NetArt from './NetArt';
import { LINE_ICONS } from './LineIcons';

// ── 화면 모양 전용: 홈의 바로가기 상자와 업무 카드 문구 (이동은 기존 goTo 함수 사용) ──
const ADMIN_LINKS = [
  { key: 'announcements', icon: 'notice', title: '공지사항', desc: '회사 소식' },
  { key: 'checklist', icon: 'checklist', title: '체크리스트', desc: '주기별 점검' },
  { key: 'evalReview', icon: 'eval', title: '평가검토', desc: '제출된 평가' },
  { key: 'lawsearch', icon: 'law', title: '법령검색', desc: '법령 조문' },
  { key: 'templates', icon: 'folder', title: '양식함', desc: '서식 내려받기' },
];
const USER_LINKS = [
  { key: 'announcements', icon: 'notice', title: '공지사항', desc: '회사 소식' },
  { key: 'lawsearch', icon: 'law', title: '법령검색', desc: '법령 조문' },
  { key: 'templates', icon: 'folder', title: '양식함', desc: '서식 내려받기' },
];

const ADMIN_CARDS = [
  { key: 'checklist', icon: 'checklist', title: '주기별 체크리스트', desc: '일일부터 연간까지 점검 항목을 체크하고, 완료 증빙자료(PDF · 사진)를 남깁니다.' },
  { key: 'yearly', icon: 'result', title: '연도별 기록', desc: '연도별로 점검 완료 여부와 첨부한 증빙자료를 한눈에 확인합니다.' },
  { key: 'evalCreate', icon: 'eval', title: '협력업체 평가', desc: '평가 양식을 만들어 배정하고, 제출된 결과와 증빙자료를 검토합니다.' },
  { key: 'lawsearch', icon: 'law', title: '자료실', desc: '관련 법령의 주요 조문을 찾아보고, 자주 쓰는 서식을 내려받습니다.' },
];
const USER_CARDS = [
  { key: 'lawsearch', icon: 'law', title: '법령검색', desc: '산업안전보건법 등 관련 법령의 주요 조문을 바로 찾아 확인합니다.' },
  { key: 'templates', icon: 'folder', title: '양식함', desc: '자주 쓰는 안전보건 서식을 분류별로 모아 두고 필요할 때 내려받습니다.' },
  { key: 'announcements', icon: 'notice', title: '공지사항', desc: '회사 공지와 안전보건 소식을 확인합니다.' },
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
        <div className="hero-photo"><img src="/img/hero-ict.jpg" alt="" /></div>
        <div className="hero-inner">
          <p className="chip">오파스넷 안전보건 통합관리시스템</p>
          <h1>안녕하세요, {displayName || userEmail}님</h1>
          <p className="hero-en">SAFE NETWORK, SAFE WORKPLACE</p>
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
      </section>

      <div className="quick">
        <div className="wrap quick-grid" style={{ '--n': links.length }}>
          {links.map(l => (
            <a key={l.key} href="#" className="quick-box" onClick={open(l.key)}>
              <span className="quick-ico">{LINE_ICONS[l.icon]}</span>
              <span className="quick-txt"><b>{l.title}</b><small>{l.desc}</small></span>
              <span className="quick-go" aria-hidden="true">→</span>
            </a>
          ))}
        </div>
      </div>

      <section className="section board">
        <div className="wrap">
          <div className="sec-tit">
            <h2>TODAY&apos;S TASKS</h2>
            <p>지금 확인할 공지와 평가, 가입 승인 요청입니다.</p>
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

      <section className="section dark">
        <NetArt />
        <div className="wrap">
          <div className="sec-tit light">
            <h2>SAFETY SERVICES</h2>
            <p>필요한 업무를 골라 바로 이동하세요.</p>
          </div>
          <div className="svc-grid" style={{ '--n': cards.length }}>
            {cards.map(c => (
              <a key={c.key} href="#" className="svc" onClick={open(c.key)}>
                <span className="svc-ico">{LINE_ICONS[c.icon]}</span>
                <h3>{c.title}</h3>
                <p>{c.desc}</p>
                <span className="svc-go" aria-hidden="true">→</span>
              </a>
            ))}
          </div>
          <p className="safety-note">위험하다고 느끼면 먼저 멈추고, 관리감독자 또는 안전보건관리팀에 바로 알려주세요.</p>
        </div>
      </section>
    </>
  );
}
