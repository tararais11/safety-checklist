'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import SiteFooter from './SiteFooter';
import SiteHeader, { TodayBadge } from './SiteHeader';

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
      <SiteHeader
        util={[{ label: '로그아웃', onClick: handleLogout }]}
        groups={[
          { key: 'main', label: '메인 화면', onClick: () => router.push('/'), items: [{ key: 'main', label: '메인 화면', onClick: () => router.push('/') }] },
          { key: 'users', label: '회원 관리', active: active === 'users', onClick: () => router.push('/admin'), items: [{ key: 'users', label: '회원 관리', active: active === 'users', onClick: () => router.push('/admin') }] },
          { key: 'evaluations', label: '협력업체 평가', active: active === 'evaluations', onClick: () => router.push('/admin/evaluations'), items: [{ key: 'evaluations', label: '협력업체 평가', active: active === 'evaluations', onClick: () => router.push('/admin/evaluations') }] },
        ]}
        onBrandClick={() => router.push('/')}
        right={<TodayBadge />}
      />

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
