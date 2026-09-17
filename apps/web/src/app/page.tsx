const pantry = [
  { name: "Tomates", detail: "6 unidades", state: "Frescos", tone: "good" },
  { name: "Leche", detail: "1 botella", state: "2 días", tone: "soon" },
  { name: "Espinacas", detail: "250 g", state: "Hoy", tone: "urgent" },
];

function FridgeMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span className="brand-eye left" />
      <span className="brand-eye right" />
      <span className="brand-smile" />
    </span>
  );
}

export default function Home() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Neverita, inicio">
          <FridgeMark />
          <span>neverita</span>
        </a>
        <button className="avatar" type="button" aria-label="Abrir perfil">P</button>
      </header>

      <section className="workspace" id="top">
        <div className="intro reveal-one">
          <p className="eyebrow">JUEVES · 17 SEPTIEMBRE</p>
          <h1>Buenos días, Paula.</h1>
          <p>Tu nevera está bastante bien. Hay una cosa que conviene usar hoy.</p>
        </div>

        <section className="freshness reveal-two" aria-labelledby="freshness-title">
          <div className="freshness-copy">
            <p className="section-kicker">ESTADO DE TU NEVERA</p>
            <h2 id="freshness-title">12 productos<br />esperando ideas.</h2>
            <a href="#inventory">Ver todo el inventario <span aria-hidden="true">→</span></a>
          </div>
          <div className="freshness-visual" aria-label="El 78 por ciento del inventario está fresco">
            <div className="dial"><strong>78%</strong><span>fresco</span></div>
          </div>
        </section>

        <section className="inventory reveal-three" id="inventory" aria-labelledby="inventory-title">
          <div className="section-heading">
            <div><p className="section-kicker">PRÓXIMOS A VENCER</p><h2 id="inventory-title">Úsalos primero</h2></div>
            <button type="button" className="text-action">Añadir producto <span aria-hidden="true">＋</span></button>
          </div>
          <div className="pantry-list">
            {pantry.map((item, index) => (
              <button className="pantry-row" type="button" key={item.name} style={{ "--delay": `${index * 70}ms` } as React.CSSProperties}>
                <span className={`produce produce-${index}`} aria-hidden="true" />
                <span className="item-copy"><strong>{item.name}</strong><small>{item.detail}</small></span>
                <span className={`status status-${item.tone}`}>{item.state}</span>
                <span className="chevron" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </section>
      </section>

      <nav className="bottom-nav" aria-label="Navegación principal">
        <a className="active" href="#top"><span aria-hidden="true">⌂</span>Inicio</a>
        <a href="#inventory"><span aria-hidden="true">◫</span>Inventario</a>
        <button type="button" className="scan" aria-label="Escanear ticket"><span aria-hidden="true">⌗</span></button>
        <a href="#recipes"><span aria-hidden="true">♨</span>Recetas</a>
        <a href="#calendar"><span aria-hidden="true">□</span>Plan</a>
      </nav>
    </main>
  );
}
