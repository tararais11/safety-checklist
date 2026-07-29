import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function POST(request) {
  const { targetUserId } = await request.json();
  if (!targetUserId) {
    return NextResponse.json({ error: '삭제할 사용자 정보가 없어요.' }, { status: 400 });
  }

  // 1. 요청자가 로그인된 관리자인지 서버에서 다시 확인 (클라이언트 값을 믿지 않음)
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() { /* 라우트 핸들러에서는 세션 쓰기 불필요 */ },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  }

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') {
    return NextResponse.json({ error: '관리자만 사용할 수 있어요.' }, { status: 403 });
  }

  if (targetUserId === user.id) {
    return NextResponse.json({ error: '본인 계정은 이 기능으로 삭제할 수 없어요.' }, { status: 400 });
  }

  // 2. service_role 키로 실제 삭제 수행 (이 키는 서버에서만 사용, 브라우저에 노출 안 됨)
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { error: delErr } = await serviceClient.auth.admin.deleteUser(targetUserId);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
