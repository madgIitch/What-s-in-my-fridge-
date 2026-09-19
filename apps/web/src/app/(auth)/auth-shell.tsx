import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({ eyebrow, title, description, message, children, footer }: {
  eyebrow: string;
  title: string;
  description: string;
  message?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return <main className="auth-shell">
    <div className="auth-brand-row">
      <Link className="auth-brand" href="/" aria-label="Neverita, inicio">
        <span className="brand-mark" aria-hidden="true"><span className="brand-eye left" /><span className="brand-eye right" /><span className="brand-smile" /></span>
        <span>neverita</span>
      </Link>
      <span className="auth-brand-note">Tu despensa, al día.</span>
    </div>
    <section className="auth-workspace">
      <header className="auth-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      {message && <div className="auth-message" role="status">{message}</div>}
      {children}
      {footer && <div className="auth-footer">{footer}</div>}
    </section>
    <p className="auth-aside">Menos desperdicio.<br />Más cenas resueltas.</p>
  </main>;
}
