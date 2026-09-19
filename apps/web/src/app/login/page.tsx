import Link from "next/link";
import { login } from "../(auth)/actions";
import { AuthShell } from "../(auth)/auth-shell";
import { safeReturnTo } from "@/lib/supabase/redirects";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const returnTo = safeReturnTo(typeof params.returnTo === "string" ? params.returnTo : null);
  const hasError = typeof params.error === "string";
  const hasStatus = typeof params.status === "string";

  const message = hasError ? "No hemos podido iniciar sesión. Revisa los datos o recupera tu contraseña." : hasStatus ? "La operación se completó correctamente." : undefined;
  return <AuthShell eyebrow="TU NEVERA, TU CUENTA" title="Qué bien verte." description="Entra para continuar donde lo dejaste." message={message} footer={<><Link href="/forgot-password">He olvidado mi contraseña</Link><span>¿Primera vez? <Link href="/signup">Crear cuenta</Link></span></>}>
    <form action={login} className="auth-form">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label>Email<input name="email" type="email" autoComplete="email" placeholder="tu@email.com" required /></label>
      <label>Contraseña<input name="password" type="password" autoComplete="current-password" placeholder="8 caracteres o más" minLength={8} required /></label>
      <button type="submit">Entrar <span aria-hidden="true">→</span></button>
    </form>
  </AuthShell>;
}
