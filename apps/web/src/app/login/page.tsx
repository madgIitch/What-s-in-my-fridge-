import Link from "next/link";
import { login } from "../(auth)/actions";
import { safeReturnTo } from "@/lib/supabase/redirects";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const returnTo = safeReturnTo(typeof params.returnTo === "string" ? params.returnTo : null);
  const hasError = typeof params.error === "string";
  const hasStatus = typeof params.status === "string";

  return <main style={{ maxWidth: 440, margin: "8vh auto", padding: 24 }}>
    <p className="eyebrow">TU NEVERA, TU CUENTA</p>
    <h1>Acceso</h1>
    <p>{hasError ? "No hemos podido iniciar sesión. Revisa los datos o recupera tu contraseña." : hasStatus ? "La operación se completó correctamente." : "Entra para continuar donde lo dejaste."}</p>
    <form action={login} style={{ display: "grid", gap: 14 }}>
      <input type="hidden" name="returnTo" value={returnTo} />
      <label>Email<input name="email" type="email" autoComplete="email" required style={{ display: "block", width: "100%", padding: 12 }} /></label>
      <label>Contraseña<input name="password" type="password" autoComplete="current-password" minLength={8} required style={{ display: "block", width: "100%", padding: 12 }} /></label>
      <button type="submit" style={{ padding: 13, background: "var(--green)", color: "white", border: 0, borderRadius: 10 }}>Entrar</button>
    </form>
    <p><Link href="/forgot-password">He olvidado mi contraseña</Link></p>
    <p>¿Primera vez? <Link href="/signup">Crear cuenta</Link></p>
  </main>;
}
