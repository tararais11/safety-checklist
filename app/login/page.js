'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import SiteFooter from '../components/SiteFooter';

// 첫 화면 '주요 기능' 카드에 들어가는 표시용 문구와 아이콘
const FEATURES = [
  {
    title: '주기별 체크리스트',
    desc: '일일부터 연간까지 주기별 점검 항목을 체크하고, 완료 증빙자료를 함께 남깁니다.',
    meta: '체크리스트 · 연도별 기록',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="M9 12l2 2 4-4" /><path d="M9 17h6" />
      </svg>
    ),
  },
  {
    title: '협력업체 평가',
    desc: '평가를 만들어 협력업체에 보내고, 제출된 결과와 증빙자료를 검토합니다.',
    meta: '평가생성 · 평가검토',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 4.5a3 3 0 0 1 0 6" /><path d="M18 14c2 .8 3 2.8 3 6" />
      </svg>
    ),
  },
  {
    title: '법령검색',
    desc: '산업안전보건법 등 관련 법령의 주요 조문을 바로 찾아 확인합니다.',
    meta: '법령 조문 바로 보기',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v18" /><path d="M7 21h10" /><path d="M5 7h14" /><path d="M5 7L2 13a3 3 0 0 0 6 0L5 7z" /><path d="M19 7l-3 6a3 3 0 0 0 6 0l-3-6z" />
      </svg>
    ),
  },
  {
    title: '양식함',
    desc: '자주 쓰는 안전보건 서식을 분류별로 모아 두고 필요할 때 내려받습니다.',
    meta: '일반 · 현장서류 · 중대재해처벌법',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M8 13h8" />
      </svg>
    ),
  },
];

// 첫 화면 '이용 절차' 단계 (표시용)
const STEPS = [
  { no: '01', title: '회원가입 신청', desc: <>이메일, 이름, 직책을 입력합니다. <br />협력업체는 회사명도 함께 입력합니다.</> },
  { no: '02', title: '관리자 승인', desc: <>관리자가 가입 신청을 확인하고 <br />사용 권한을 승인합니다.</> },
  { no: '03', title: '로그인', desc: <>승인된 계정으로 <br />로그인합니다.</> },
  { no: '04', title: '업무 시작', desc: <>권한에 맞는 메뉴에서 <br />점검과 평가를 진행합니다.</> },
];

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // {type, text}
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg({ type: 'error', text: '로그인 실패: 이메일 또는 비밀번호를 확인해주세요.' });
        setLoading(false);
      } else {
        // 로딩 상태를 유지한 채로 페이지 이동 (버튼이 즉시 원상복구되지 않도록)
        router.push('/');
        router.refresh();
      }
    } else {
      if (password.length < 6) {
        setMsg({ type: 'error', text: '비밀번호는 6자 이상이어야 합니다.' });
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { company_name: companyName || null, full_name: fullName || null, position: position || null } },
      });
      if (error) {
        setMsg({ type: 'error', text: '회원가입 실패: ' + error.message });
      } else {
        setMsg({ type: 'success', text: '가입 신청이 접수되었어요. 관리자 승인 후 로그인할 수 있습니다.' });
        setMode('login');
      }
      setLoading(false);
    }
  };

  return (
    <div className="landing">
      {loading && mode === 'login' && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(28,34,48,0.55)',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          zIndex:200, color:'#fff', gap:14,
        }}>
          <div style={{
            width:40, height:40, border:'4px solid rgba(255,255,255,0.25)', borderTopColor:'#e8555a',
            borderRadius:'50%', animation:'auth-spin 0.8s linear infinite',
          }}></div>
          <div style={{fontSize:14.5, fontWeight:700}}>로그인 중입니다...</div>
        </div>
      )}
      <style>{`@keyframes auth-spin { to { transform: rotate(360deg); } }`}</style>

      <header className="site-header">
        <div className="util-bar">
          <div className="site-container util-in">
            <a href="#login-box" className={"util-link" + (mode === 'login' ? ' on' : '')} onClick={() => { setMode('login'); setMsg(null); }}>로그인</a>
            <a href="#login-box" className={"util-link" + (mode === 'signup' ? ' on' : '')} onClick={() => { setMode('signup'); setMsg(null); }}>회원가입</a>
          </div>
        </div>
        <div className="gnb">
          <div className="site-container gnb-in">
            <div className="topbar-global-brand">
              <img
                src="/logo.gif"
                alt="회사 로고"
                className="brand-logo"
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
            <nav className="gnb-menu">
              <a className="gnb-item" href="#intro">시스템 소개</a>
              <a className="gnb-item" href="#features">주요 기능</a>
              <a className="gnb-item" href="#process">이용 절차</a>
            </nav>
          </div>
        </div>
      </header>

      <section className="hero" id="intro">
        <div className="site-container hero-in">
          <div className="hero-copy">
            <div className="hero-eyebrow">산업안전보건법 · 중대재해처벌법 대응</div>
            <h1>안전보건 업무,<br /><em>한 곳에서 관리하세요.</em></h1>
            <p>주기별 점검과 증빙자료, 협력업체 평가, 법령과 양식까지 <br />현장의 안전보건 업무를 한 시스템에서 확인하고 기록합니다.</p>
            <div className="hero-note">처음 이용하시면 회원가입 신청 후 관리자 승인을 받아 주세요.</div>
          </div>

      <div className="auth-card login-card" id="login-box">
        <div className="auth-tabs">
          <div className={"auth-tab" + (mode === 'login' ? ' active' : '')} onClick={() => { setMode('login'); setMsg(null); }}>
            로그인
          </div>
          <div className={"auth-tab" + (mode === 'signup' ? ' active' : '')} onClick={() => { setMode('signup'); setMsg(null); }}>
            회원가입
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>이메일</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="auth-field">
            <label>비밀번호</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          {mode === 'signup' && (
            <div className="auth-field">
              <label>이름</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="예: 홍길동" />
            </div>
          )}
          {mode === 'signup' && (
            <div className="auth-field">
              <label>직책</label>
              <select
                value={position}
                onChange={e => setPosition(e.target.value)}
                required
              >
                <option value="">직책을 선택해주세요</option>
                <option value="현장소장">현장소장</option>
                <option value="안전보건관리책임자">안전보건관리책임자</option>
                <option value="안전관리자">안전관리자</option>
                <option value="관리감독자">관리감독자</option>
                <option value="안전보건관리담당자">안전보건관리담당자</option>
              </select>
            </div>
          )}
          {mode === 'signup' && (
            <div className="auth-field">
              <label>회사명 (협력업체로 가입하시는 경우 입력)</label>
              <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="예: 주식회사 오피스넷" />
            </div>
          )}
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? '처리 중...' : (mode === 'login' ? '로그인' : '회원가입')}
          </button>
        </form>

        {msg && <div className={"auth-msg " + msg.type}>{msg.text}</div>}
        {mode === 'signup' && <div className="auth-help">가입 신청 후 관리자 승인이 끝나면 로그인할 수 있어요.</div>}
      </div>
        </div>

        <div className="hero-stats">
          <div className="site-container hero-stats-in">
            <div className="hero-stat"><span>점검 주기</span><b>일일 ~ 연간 6단계</b></div>
            <div className="hero-stat"><span>증빙자료</span><b>PDF · 사진 첨부</b></div>
            <div className="hero-stat"><span>협력업체</span><b>평가 생성 · 제출 · 검토</b></div>
            <div className="hero-stat"><span>참고 자료</span><b>법령검색 · 양식함</b></div>
          </div>
        </div>
      </section>

      <section className="landing-sec" id="features">
        <div className="site-container">
          <div className="sec-eyebrow">주요 기능</div>
          <h2 className="sec-title">현장의 안전보건 업무를<br />한 시스템에서 처리합니다</h2>
          <div className="feature-grid">
            {FEATURES.map(f => (
              <article className="feature" key={f.title}>
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                <div className="feature-meta">{f.meta}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-sec gray" id="process">
        <div className="site-container">
          <div className="sec-eyebrow">이용 절차</div>
          <h2 className="sec-title">가입 신청 후 관리자 승인을 거쳐<br />이용할 수 있습니다</h2>
          <div className="steps">
            {STEPS.map(s => (
              <div className="step" key={s.no}>
                <div className="step-no">{s.no}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
