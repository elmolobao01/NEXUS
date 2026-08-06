function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

export default function RecentClients({ clientes }) {
  return (
    <article className="root2-panel root2-client-card">
      <header className="root2-panel-header">
        <div>
          <span>CARTEIRA COMERCIAL</span>
          <h3>Últimos clientes</h3>
        </div>
        <button type="button" className="root2-text-button">
          Abrir clientes
        </button>
      </header>

      <div className="root2-table-wrap">
        <table className="root2-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Segmento</th>
              <th>Plano</th>
              <th>Mensalidade</th>
              <th>Entrada</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((cliente) => (
              <tr key={cliente.nome}>
                <td><strong>{cliente.nome}</strong></td>
                <td>{cliente.segmento}</td>
                <td>{cliente.plano}</td>
                <td>{formatarMoeda(cliente.valor)}</td>
                <td>{cliente.criadoEm}</td>
                <td>
                  <span className={`root2-status ${cliente.status.toLowerCase()}`}>
                    {cliente.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
