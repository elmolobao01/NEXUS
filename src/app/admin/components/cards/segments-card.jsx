function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

export default function SegmentsCard({ segmentos }) {
  const totalClientes = segmentos.reduce((total, item) => total + item.clientes, 0);

  return (
    <article className="root2-panel">
      <header className="root2-panel-header">
        <div>
          <span>PORTFÓLIOS</span>
          <h3>Receita por segmento</h3>
        </div>
      </header>

      <div className="root2-segment-list">
        {segmentos.map((segmento) => (
          <article key={segmento.nome}>
            <span className={`root2-segment-dot ${segmento.cor}`} />
            <div>
              <strong>{segmento.nome}</strong>
              <small>
                {segmento.clientes} clientes · {formatarMoeda(segmento.receita)}
              </small>
            </div>
            <b>{Math.round((segmento.clientes / totalClientes) * 100)}%</b>
          </article>
        ))}
      </div>
    </article>
  );
}
