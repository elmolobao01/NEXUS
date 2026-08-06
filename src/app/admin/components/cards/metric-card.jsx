export default function MetricCard({ metrica }) {
  return (
    <article className="root2-metric-card">
      <div className="root2-metric-top">
        <span className="root2-metric-icon" aria-hidden="true">
          {metrica.icone}
        </span>
        <span className={`root2-metric-state ${metrica.tipo}`}>
          {metrica.tipo === "positivo"
            ? "Crescimento"
            : metrica.tipo === "atencao"
              ? "Atenção"
              : "Estável"}
        </span>
      </div>
      <p>{metrica.titulo}</p>
      <strong>{metrica.valor}</strong>
      <small>{metrica.complemento}</small>
    </article>
  );
}
