import Link from "next/link";
import { signup } from "../actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  return <main style={{ maxWidth: 440, margin: "8vh auto", padding: 24 }}>
    <p className="eyebrow">EMPIEZA SIN DESPERDICIO</p><h1>Crear cuenta</h1>
    {status && <p role="status">Si la dirección puede registrarse, recibirás un correo para continuar.</p>}
    <form action={signup} style={{ display: "grid", gap: 14 }}>
      <label>Nombre<input name="displayName" autoComplete="name" maxLength={80} style={{ display: "block", width: "100%", padding: 12 }} /></label>
      <label>Email<input name="email" type="email" autoComplete="email" required style={{ display: "block", width: "100%", padding: 12 }} /></label>
      <label>Contraseña<input name="password" type="password" autoComplete="new-password" minLength={8} required style={{ display: "block", width: "100%", padding: 12 }} /></label>
      <button type="submit" style={{ padding: 13, background: "var(--green)", color: "white", border: 0, borderRadius: 10 }}>Crear cuenta</button>
    </form>
    <p><Link href="/login">Ya tengo cuenta</Link></p>
  </main>;
}
