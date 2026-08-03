'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../lib/supabase/client';

export default function HomePanel({ displayName, userEmail, isAdmin, goTo }) {
  const supabase = createClient();
  const [pendingUsers, setPendingUsers] = useState(null);
  const [pendingReviews, setPendingReviews] = useState(null);

  const loadStats = useCallback(async () => {
    if (!isAdmin) return;
    const { count: uCount } = await supabase
      .from('profiles').select('*', { count: 'exact', head: true }).eq('approved', false);
    setPendingUsers(uCount ?? 0);

    const { count: eCount } = await supabase
      .from('evaluations').select('*', { count: 'exact', head: true }).eq('status', 'submitted');
    setPendingReviews(eCount ?? 0);
  }, [isAdmin, supabase]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const today = new Date();
  const dateStr = today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  const cards = [
    ...(isAdmin ? [
      { key: 'checklist', icon: '📋', title: '체크리스트', desc: '일일~연간 주기별 점검 관리' },
      { key: 'yearly', icon: '📅', title: '연도별 기록', desc: '지난 연도 이행 기록 확인' },
    ] : []),
    { key: 'lawsearch', icon: '⚖️', title: '법령검색', desc: '산업안전보건법·중대재해처벌법 조문' },
    { key: 'templates', icon: '📁', title: '양식함', desc: '빈 양식 파일 업로드·다운로드' },
    ...(isAdmin ? [
      { key: 'adminUsers', icon: '🛡️', title: '회원 관리', desc: '가입 승인, 권한 관리' },
      { key: 'evalCreate', icon: '🏗️', title: '평가생성', desc: '협력업체 평가 템플릿·배정' },
      { key: 'evalReview', icon: '📝', title: '평가검토', desc: '제출된 평가 검토·점수 입력' },
    ] : []),
  ];

  return (
    <>
      <div style={{
        background:'var(--ink)', color:'#fff', borderRadius:10, padding:'28px 30px', marginBottom:24,
        position:'relative', overflow:'hidden',
      }}>
        <div style={{position:'relative', zIndex:1}}>
          <div style={{fontSize:11, letterSpacing:'0.14em', color:'#f4dcc9', fontWeight:700, marginBottom:8, textTransform:'uppercase'}}>
            {dateStr}
          </div>
          <div style={{fontSize:23, fontWeight:800}}>
            안녕하세요, {displayName || userEmail}님 👋
          </div>
          <div style={{fontSize:13.5, color:'#c7cbd6', marginTop:6}}>
            오늘도 안전한 하루 보내세요.
          </div>
        </div>
      </div>

      {isAdmin && (
        <div style={{display:'flex', gap:14, marginBottom:24, flexWrap:'wrap'}}>
          <div
            className="panel"
            style={{flex:'1 1 200px', padding:'18px 20px', cursor:'pointer'}}
            onClick={() => goTo('adminUsers')}
          >
            <div style={{fontSize:12, color:'var(--muted)', fontWeight:700, marginBottom:6}}>승인 대기 중인 회원</div>
            <div style={{fontSize:28, fontWeight:800, color: pendingUsers > 0 ? 'var(--safety)' : 'var(--ink)'}}>
              {pendingUsers === null ? '-' : pendingUsers}<span style={{fontSize:14, fontWeight:600, marginLeft:4}}>명</span>
            </div>
          </div>
          <div
            className="panel"
            style={{flex:'1 1 200px', padding:'18px 20px', cursor:'pointer'}}
            onClick={() => goTo('evalReview')}
          >
            <div style={{fontSize:12, color:'var(--muted)', fontWeight:700, marginBottom:6}}>검토 대기 중인 평가</div>
            <div style={{fontSize:28, fontWeight:800, color: pendingReviews > 0 ? 'var(--safety)' : 'var(--ink)'}}>
              {pendingReviews === null ? '-' : pendingReviews}<span style={{fontSize:14, fontWeight:600, marginLeft:4}}>건</span>
            </div>
          </div>
        </div>
      )}

      <div style={{fontSize:13.5, fontWeight:800, color:'var(--muted)', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.05em'}}>
        바로가기
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:14}}>
        {cards.map(c => (
          <div
            key={c.key}
            className="panel"
            style={{padding:'20px', cursor:'pointer', transition:'box-shadow .15s'}}
            onClick={() => goTo(c.key)}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 18px rgba(28,34,48,0.12)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <div style={{fontSize:26, marginBottom:10}}>{c.icon}</div>
            <div style={{fontSize:15, fontWeight:800, marginBottom:4}}>{c.title}</div>
            <div style={{fontSize:12.5, color:'var(--muted)'}}>{c.desc}</div>
          </div>
        ))}
      </div>
    </>
  );
}
