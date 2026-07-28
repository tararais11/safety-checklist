'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

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
      <div className="topbar-global">
        <div className="topbar-global-brand">
          <span>안전보건</span>&nbsp;<span className="accent">통합관리시스템</span>
        </div>
        <div className="topbar-global-right">
          <button className="topbar-global-logout" onClick={handleLogout}>로그아웃</button>
        </div>
      </div>

      <div className="app-body">
        <aside className="sidebar">
          <nav>
            <div className="sidebar-nav-item" onClick={() => router.push('/')}>
              <span>🏠</span> 메인 화면
            </div>
            <div className={"sidebar-nav-item" + (active === 'users' ? " active" : "")} onClick={() => router.push('/admin')}>
              <span>🛡️</span> 회원 관리
            </div>
            <div className={"sidebar-nav-item" + (active === 'evaluations' ? " active" : "")} onClick={() => router.push('/admin/evaluations')}>
              <span>🏗️</span> 협력업체 평가
            </div>
          </nav>
        </aside>

        <main className="main-content">
          <div className="content-inner">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
