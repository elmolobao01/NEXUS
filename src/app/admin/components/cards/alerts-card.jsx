export default function AlertsCard({ alertas }) {
  return (
    <article className="root2-panel">
      <header className="root2-panel-header">
        <div>
          <span>MONITORAMENTO</span>
          <h3>Alertas prioritários</h3>
        </div>
        <button type="button" className="root2-text-button">
          Ver todos
        </button>
      </header>

      <div className="root2-alert-list">
        {alertas.map((alerta) => (
          <article key={alerta.titulo}>
            <span className={`root2-alert-dot ${alerta.nivel}`} />
            <div>
              <strong>{alerta.titulo}</strong>
              <small>{alerta.descricao}</small>
            </div>
          </article>
        ))}
      </div>
    </article>
  );
}
