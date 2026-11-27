'use client';

export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import SiteHeader from '../components/SiteHeader';
import PageHead from '../components/PageHead';
import SiteFooter from '../components/SiteFooter';

export default function PendingPage() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="app-shell">
      <SiteHeader util={[{ label: '로그아웃', onClick: handleLogout }]} />
      <div className="app-body">
        <main className="main-content">
          <div className="content-inner">
            <PageHead
              crumbs={['회원가입', '승인 대기']}
              title="가입 승인 대기 중"
              lead="회원가입이 완료되었습니다. 관리자 승인 후 이용하실 수 있어요."
            />
            <div className="auth-card" style={{marginLeft:'auto', marginRight:'auto', textAlign:'center'}}>
              <div style={{
                background:'var(--warn-bg)', color:'var(--warn)', borderRadius:10,
                padding:'16px 18px', fontSize:15, lineHeight:1.7, marginBottom:20,
              }}>
                승인이 완료되면 다시 로그인해주세요.<br />
                승인 여부는 관리자에게 별도로 문의해주셔도 됩니다.
              </div>
              <button className="auth-submit" onClick={handleLogout}>로그아웃</button>
            </div>
          </div>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
