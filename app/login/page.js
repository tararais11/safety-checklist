'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import NetArt from '../components/NetArt';
import { LINE_ICONS } from '../components/LineIcons';

// ── 아래는 첫 화면에 보여 주는 문구 (표시용, 동작 없음) ──

// 'SAFETY SERVICES' 카드
const GUIDE = [
  { icon: 'checklist', title: '주기별 체크리스트', desc: '일일부터 연간까지 주기별 점검 항목을 체크하고, 완료 증빙자료(PDF · 사진)를 남깁니다.', who: '관리자' },
  { icon: 'eval', title: '협력업체 평가', desc: '관리자가 평가를 배정하면 협력업체가 증빙자료를 올려 제출하고, 관리자가 검토합니다.', who: '관리자 · 협력업체' },
  { icon: 'law', title: '법령검색', desc: '산업안전보건법과 시행규칙, 중대재해처벌법의 주요 조문을 바로 확인합니다.', who: '모든 사용자' },
  { icon: 'folder', title: '양식함', desc: '자주 쓰는 안전보건 서식을 분류별로 모아 두고 필요할 때 내려받습니다.', who: '모든 사용자' },
];

// '이용 절차' 단계 (key: 관리자가 처리하는 단계)
const STEPS = [
  { title: '회원가입 신청', desc: '이메일, 이름, 직책을 입력합니다. 협력업체는 회사명도 함께 입력합니다.' },
  { title: '관리자 승인', desc: '관리자가 가입 신청을 확인하고 사용 권한을 승인합니다.', key: true },
  { title: '로그인', desc: '승인된 계정으로 로그인합니다.' },
  { title: '업무 시작', desc: '권한에 맞는 메뉴에서 점검과 평가를 진행합니다.' },
];

// '자주 묻는 질문'
const FAQ = [
  { q: '가입하면 바로 이용할 수 있나요?', a: '가입 신청 후 관리자 승인이 필요합니다. 승인 전에 로그인하면 \'가입 승인 대기 중\' 화면이 보이며, 승인이 끝나면 다시 로그인해 주세요.' },
  { q: '협력업체도 가입할 수 있나요?', a: '네. 회원가입 화면의 회사명 칸에 회사명을 입력해 신청하면, 관리자가 확인한 뒤 협력업체로 승인합니다.' },
  { q: '비밀번호는 어떻게 바꾸나요?', a: '로그인한 뒤 화면 맨 위의 \'설정\'을 누르면 새 비밀번호로 바꿀 수 있습니다.' },
  { q: '점검 항목은 바꿀 수 있나요?', a: '관리자는 체크리스트에서 항목을 추가 · 수정 · 삭제하고 순서를 바꿀 수 있습니다. 기본 항목은 참고용이므로 사업장 상황에 맞게 조정해 주세요.' },
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

      <SiteHeader
        util={[
          { label: '로그인', href: '#login-box', on: mode === 'login', onClick: () => { setMode('login'); setMsg(null); } },
          { label: '회원가입', href: '#login-box', on: mode === 'signup', onClick: () => { setMode('signup'); setMsg(null); } },
        ]}
        groups={[
          { key: 'intro', label: '시스템 소개', href: '#intro' },
          { key: 'services', label: '주요 서비스', href: '#services' },
          { key: 'process', label: '이용 절차', href: '#process' },
          { key: 'faq', label: '자주 묻는 질문', href: '#faq' },
        ]}
        onBrandClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        right={<span className="today"><i>문의</i>안전보건관리팀</span>}
      />

      <section className="hero hero-login" id="intro">
        <div className="hero-photo"><img src="/img/hero-ict.jpg" alt="" /></div>
        <div className="wrap hero-split">
          <div className="hero-inner">
            <p className="chip">오파스넷 안전보건 통합관리시스템</p>
            <h1>정보통신 현장의 안전,<br />한 곳에서 관리합니다</h1>
            <p className="hero-en">SAFETY &amp; HEALTH MANAGEMENT SYSTEM</p>
            <p className="lead">주기별 점검과 증빙자료, 협력업체 평가, 법령과 양식까지 <br />안전보건 업무를 한 시스템에서 확인하고 기록합니다.</p>
            <div className="hero-btns">
              <a href="#login-box" className="btn btn-red" onClick={() => { setMode('login'); setMsg(null); }}>로그인</a>
              <a href="#login-box" className="btn btn-ghost" onClick={() => { setMode('signup'); setMsg(null); }}>회원가입 신청</a>
            </div>
          </div>

      <div className="auth-card login-card" id="login-box">
        <h2>{mode === 'login' ? '회원 로그인' : '회원가입 신청'}</h2>
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
      </section>

      <section className="section dark" id="services">
        <NetArt />
        <div className="wrap">
          <div className="sec-tit light">
            <h2>SAFETY SERVICES</h2>
            <p>정보통신 현장의 안전보건 업무를 한 시스템에서 처리합니다.<br />로그인하면 역할에 맞는 메뉴가 열립니다.</p>
          </div>
          <div className="svc-grid" style={{ '--n': GUIDE.length }}>
            {GUIDE.map(g => (
              <div className="svc" key={g.title}>
                <span className="svc-ico">{LINE_ICONS[g.icon]}</span>
                <h3>{g.title}</h3>
                <p>{g.desc}</p>
                <span className="svc-who">이용 대상 · {g.who}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section board" id="process">
        <div className="wrap">
          <div className="sec-tit">
            <h2>HOW TO START</h2>
            <p>가입 신청 후 관리자 승인을 거쳐 이용할 수 있습니다.</p>
          </div>
          <ol className="step-boxes">
            {STEPS.map((s, i) => (
              <li key={s.title} className={s.key ? 'key' : undefined}>
                <span className="step-no">STEP {String(i + 1).padStart(2, '0')}</span>
                <b>{s.title}</b>
                <span className="step-desc">{s.desc}</span>
                {s.key && <span className="step-tag">관리자 처리</span>}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="wrap">
          <div className="sec-tit">
            <h2>FAQ</h2>
            <p>이용 전에 자주 묻는 질문을 확인하세요.</p>
          </div>
          <div className="faq">
            {FAQ.map(f => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <div className="a">{f.a}</div>
              </details>
            ))}
          </div>
          <div className="link-boxes">
            <a href="#login-box" className="link-box" onClick={() => { setMode('signup'); setMsg(null); }}>
              <span className="quick-ico">{LINE_ICONS.eval}</span>
              <span className="quick-txt"><b>회원가입 신청</b><small>처음이면 가입을 신청하세요.</small></span>
              <span className="quick-go" aria-hidden="true">→</span>
            </a>
            <a href="#login-box" className="link-box" onClick={() => { setMode('login'); setMsg(null); }}>
              <span className="quick-ico">{LINE_ICONS.shield}</span>
              <span className="quick-txt"><b>로그인</b><small>승인된 계정으로 로그인하세요.</small></span>
              <span className="quick-go" aria-hidden="true">→</span>
            </a>
            <div className="link-box">
              <span className="quick-ico">{LINE_ICONS.notice}</span>
              <span className="quick-txt"><b>이용 문의</b><small>안전보건관리팀으로 문의하세요.</small></span>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
