import Link from "next/link";
import { signup } from "../actions";
import { AuthShell } from "../auth-shell";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  return <AuthShell eyebrow="EMPIEZA SIN DESPERDICIO" title="Haz sitio a las ideas." description="Crea tu cuenta y convierte lo que ya tienes en algo rico." message={status ? "Si la dirección puede registrarse, recibirás un correo para continuar." : undefined} footer={<Link href="/login">Ya tengo cuenta</Link>}>
    <form action={signup} className="auth-form">
      <label>Nombre<input name="displayName" autoComplete="name" placeholder="¿Cómo te llamamos?" maxLength={80} /></label>
      <label>Email<input name="email" type="email" autoComplete="email" placeholder="tu@email.com" required /></label>
      <label>Contraseña<input name="password" type="password" autoComplete="new-password" placeholder="8 caracteres o más" minLength={8} required /></label>
      <button type="submit">Crear cuenta <span aria-hidden="true">→</span></button>
    </form>
  </AuthShell>;
}
