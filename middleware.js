import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function middleware(request) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage = request.nextUrl.pathname.startsWith("/login");
  const isChangePasswordPage = request.nextUrl.pathname.startsWith("/change-password");

  // An admin created or reset this account with a temporary password: block
  // everything until they've chosen their own. app_metadata can only be set
  // by the server (service role), so users can't clear this flag themselves.
  if (user && user.app_metadata?.must_change_password === true && !isChangePasswordPage) {
    return NextResponse.redirect(new URL("/change-password", request.url));
  }

  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:png|jpg|jpeg|svg|gif|ico|webp)$).*)"], };
