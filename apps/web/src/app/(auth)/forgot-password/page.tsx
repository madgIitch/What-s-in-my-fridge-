import Link from "next/link";
import { requestPasswordReset } from "../actions";
import { AuthShell } from "../auth-shell";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  return <AuthShell eyebrow="RECUPERA EL ACCESO" title="Volvamos a entrar." description="Te enviaremos instrucciones sin confirmar si el email está registrado." message={status ? "Si existe una cuenta compatible, recibirás un enlace de recuperación." : undefined} footer={<Link href="/login">Volver al acceso</Link>}>
    <form action={requestPasswordReset} className="auth-form">
      <label>Email<input name="email" type="email" autoComplete="email" placeholder="tu@email.com" required /></label>
      <button type="submit">Enviar instrucciones <span aria-hidden="true">→</span></button>
    </form>
  </AuthShell>;
}
