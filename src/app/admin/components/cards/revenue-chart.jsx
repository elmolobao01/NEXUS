function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

export default function RevenueChart({ dados }) {
  const maior = Math.max(...dados.map((item) => item.valor));

  return (
    <article className="root2-panel root2-revenue-card">
      <header className="root2-panel-header">
        <div>
          <span>RECEITA</span>
          <h3>Evolução do MRR</h3>
        </div>
        <select defaultValue="6" aria-label="Período da receita">
          <option value="6">Últimos 6 meses</option>
          <option value="12">Últimos 12 meses</option>
        </select>
      </header>

      <div className="root2-chart">
        {dados.map((item) => (
          <div className="root2-chart-column" key={item.mes}>
            <small>{formatarMoeda(item.valor)}</small>
            <span style={{ height: `${(item.valor / maior) * 100}%` }} />
            <strong>{item.mes}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}
