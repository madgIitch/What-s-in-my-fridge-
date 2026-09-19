import Link from "next/link";
import { requestPasswordReset } from "../actions";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  return <main style={{ maxWidth: 440, margin: "8vh auto", padding: 24 }}>
    <h1>Recuperar contraseña</h1>
    <p>{status ? "Si existe una cuenta compatible, recibirás un enlace de recuperación." : "Te enviaremos instrucciones sin confirmar si el email está registrado."}</p>
    <form action={requestPasswordReset} style={{ display: "grid", gap: 14 }}>
      <label>Email<input name="email" type="email" autoComplete="email" required style={{ display: "block", width: "100%", padding: 12 }} /></label>
      <button type="submit" style={{ padding: 13, background: "var(--green)", color: "white", border: 0, borderRadius: 10 }}>Enviar instrucciones</button>
    </form>
    <p><Link href="/login">Volver al acceso</Link></p>
  </main>;
}
