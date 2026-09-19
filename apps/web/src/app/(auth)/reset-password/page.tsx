import { updatePassword } from "../actions";
import { AuthShell } from "../auth-shell";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthShell eyebrow="ÚLTIMO PASO" title="Nueva contraseña." description="Usa al menos ocho caracteres que no reutilices en otros servicios." message={error ? "No se pudo actualizar. Solicita un enlace nuevo si la sesión ha caducado." : undefined}>
    <form action={updatePassword} className="auth-form">
      <label>Contraseña nueva<input name="password" type="password" autoComplete="new-password" placeholder="8 caracteres o más" minLength={8} required /></label>
      <button type="submit">Guardar contraseña <span aria-hidden="true">→</span></button>
    </form>
  </AuthShell>;
}
