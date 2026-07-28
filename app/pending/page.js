'use client';

export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export default function PendingPage() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{textAlign:'center'}}>
        <div className="auth-logo">가입 승인 대기 중</div>
        <div className="auth-sub" style={{marginBottom:20}}>
          회원가입이 완료되었습니다. 관리자 승인 후 이용하실 수 있어요.
        </div>
        <div style={{
          background:'var(--warn-bg)', color:'var(--warn)', borderRadius:6,
          padding:'14px 16px', fontSize:13, lineHeight:1.7, marginBottom:20,
        }}>
          승인이 완료되면 다시 로그인해주세요. 승인 여부는 관리자에게 별도로 문의해주셔도 됩니다.
        </div>
        <button className="auth-submit" onClick={handleLogout}>로그아웃</button>
      </div>
    </div>
  );
}
