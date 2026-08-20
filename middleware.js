import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: {
        maxAge: undefined,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, maxAge: undefined, expires: undefined })
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith('/login');
  const isPendingPage = request.nextUrl.pathname.startsWith('/pending');
  const isAdminPage = request.nextUrl.pathname.startsWith('/admin');
  const isVendorPage = request.nextUrl.pathname.startsWith('/vendor');

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('approved, role')
      .eq('id', user.id)
      .single();

    const approved = profile?.approved === true;
    const isAdmin = profile?.role === 'admin';
    const isVendor = profile?.role === 'vendor';
    const homePath = isVendor ? '/vendor' : '/';

    if (isLoginPage) {
      const url = request.nextUrl.clone();
      url.pathname = homePath;
      return NextResponse.redirect(url);
    }

    // 승인 안 된 사용자는 /pending 외 다른 곳 접근 불가
    if (!approved && !isPendingPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/pending';
      return NextResponse.redirect(url);
    }

    // 승인된 사용자가 /pending에 들어오면 각자 홈으로
    if (approved && isPendingPage) {
      const url = request.nextUrl.clone();
      url.pathname = homePath;
      return NextResponse.redirect(url);
    }

    // 관리자가 아니면 /admin 접근 불가
    if (isAdminPage && !isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = homePath;
      return NextResponse.redirect(url);
    }

    // 협력업체가 아니면 /vendor 접근 불가
    if (isVendorPage && !isVendor) {
      const url = request.nextUrl.clone();
      url.pathname = homePath;
      return NextResponse.redirect(url);
    }

    // 협력업체는 일반 대시보드(/) 대신 /vendor로
    if (approved && isVendor && request.nextUrl.pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/vendor';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)'],
};
