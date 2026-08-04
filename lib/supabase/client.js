import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: {
        // maxAge를 설정하지 않으면 "세션 쿠키"가 되어, 브라우저를 완전히 종료할 때 삭제돼요.
        maxAge: undefined,
      },
    }
  );
}
