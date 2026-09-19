import { updatePassword } from "../actions";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main style={{ maxWidth: 440, margin: "8vh auto", padding: 24 }}>
    <h1>Nueva contraseña</h1>
    {error && <p role="alert">No se pudo actualizar. Solicita un enlace nuevo si la sesión ha caducado.</p>}
    <form action={updatePassword} style={{ display: "grid", gap: 14 }}>
      <label>Contraseña nueva<input name="password" type="password" autoComplete="new-password" minLength={8} required style={{ display: "block", width: "100%", padding: 12 }} /></label>
      <button type="submit" style={{ padding: 13, background: "var(--green)", color: "white", border: 0, borderRadius: 10 }}>Guardar contraseña</button>
    </form>
  </main>;
}
