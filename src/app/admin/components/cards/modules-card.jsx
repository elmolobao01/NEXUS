export default function ModulesCard({ modulos }) {
  return (
    <article className="root2-panel">
      <header className="root2-panel-header">
        <div>
          <span>CATÁLOGO COMERCIAL</span>
          <h3>Módulos mais vendidos</h3>
        </div>
      </header>

      <div className="root2-module-list">
        {modulos.map((modulo) => (
          <article key={modulo.nome}>
            <div>
              <strong>{modulo.nome}</strong>
              <small>{modulo.vendas} contratos</small>
            </div>
            <div className="root2-progress">
              <span style={{ width: `${modulo.percentual}%` }} />
            </div>
          </article>
        ))}
      </div>
    </article>
  );
}
