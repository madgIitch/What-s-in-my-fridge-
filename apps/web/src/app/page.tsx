import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return <main className="welcome-shell">
    <header className="welcome-nav"><span className="welcome-brand">Neverita ♡</span><Link href="/login">Entrar</Link></header>
    <section className="welcome-hero">
      <div className="welcome-copy"><p className="welcome-kicker">TU NEVERA, EN ORDEN</p><h1>Todo lo que tienes.<br />Ideas para aprovecharlo.</h1><p>Guarda tus alimentos, descubre recetas y prepara tu próxima compra desde un solo lugar.</p><div className="welcome-actions"><Link href="/signup">Crear cuenta</Link><Link href="/login">Ya tengo cuenta</Link></div></div>
      <Image className="welcome-mascot" src="/neverito-nevera.png" alt="Neverito junto a una nevera llena de alimentos" width={500} height={500} priority />
    </section>
    <section className="welcome-features" aria-label="Qué puedes hacer"><p>♡ Organiza tu inventario</p><p>▣ Escanea tickets</p><p>♨ Cocina con lo que ya tienes</p></section>
  </main>;
}
