import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.generated";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isPrivate = request.nextUrl.pathname.startsWith("/app") || request.nextUrl.pathname.startsWith("/private-check");
  if (!url || !publishableKey) {
    if (!isPrivate) return response;
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const supabase = createServerClient<Database>(url, publishableKey, {
    auth: { flowType: "pkce" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (isPrivate && (!user || user.app_metadata.disabled === true)) {
    if (user) await supabase.auth.signOut();
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", request.nextUrl.pathname + request.nextUrl.search);
    if (user?.app_metadata.disabled === true) loginUrl.searchParams.set("error", "account_disabled");
    return NextResponse.redirect(loginUrl);
  }
  return response;
}

export const config = { matcher: ["/app/:path*", "/private-check/:path*"] };
