'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import SiteFooter from './SiteFooter';

export default function AdminShell({ active, children }) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="util-bar">
          <div className="site-container util-in">
            <button className="util-link" onClick={handleLogout}>로그아웃</button>
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
              <div className="gnb-item" onClick={() => router.push('/')}>메인 화면</div>
              <div className={"gnb-item" + (active === 'users' ? " active" : "")} onClick={() => router.push('/admin')}>회원 관리</div>
              <div className={"gnb-item" + (active === 'evaluations' ? " active" : "")} onClick={() => router.push('/admin/evaluations')}>협력업체 평가</div>
            </nav>
          </div>
        </div>
      </header>

      <div className="app-body">
        <main className="main-content">
          <div className="content-inner">
            {children}
          </div>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
