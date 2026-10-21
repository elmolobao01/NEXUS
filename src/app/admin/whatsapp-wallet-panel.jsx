"use client";
import {useEffect,useState} from "react";
export default function WhatsappWalletPanel(){
 const [data,setData]=useState(null),[error,setError]=useState("");
 useEffect(()=>{let live=true;fetch("/api/admin/infraestrutura/whatsapp",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Falha ao consultar");return d;}).then(d=>{if(live)setData(d);}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[]);
 return <section className="root-panel infra-table-panel"><header className="root-panel-header"><div><span>WHATSAPP BUSINESS</span><h3>Franquias e saldos por organização</h3></div></header>
 <p>Franquias: Básico 1.000 mensagens (R$ 49,90/mês) • Standard 2.000 mensagens (R$ 99,90/mês). Recargas: 500/R$ 29,90 • 1.000/R$ 59,90 • 2.000/R$ 109,90.</p>
 <p>O envio automático e a compra de créditos permanecem desativados até integração com pagamento, validação de contrato e processamento seguro.</p>
 {error&&<p role="alert">{error}. Verifique se a migração foi aplicada.</p>}
 {!data&&!error&&<p>Consultando carteiras…</p>}
 {data&&<div className="root-table-wrap"><table className="root-table infra-table"><thead><tr><th>Organização</th><th>Plano</th><th>Ciclo</th><th>Franquia disponível</th><th>Avulsas</th><th>Eventos recebidos*</th></tr></thead><tbody>{data.wallets.map(w=><tr key={w.organization_id}><td>{w.organization_id}</td><td>{w.plan_code}</td><td>{w.cycle_start} a {w.cycle_end}</td><td>{w.included_remaining}</td><td>{w.prepaid_remaining}</td><td>{w.received_events_sample}</td></tr>)}</tbody></table>{!data.wallets.length&&<p>Nenhuma carteira provisionada. Não são criadas franquias sem contrato confirmado.</p>}</div>}
 <small>*Contagem parcial dos últimos 1.000 eventos; não equivale a mensagens enviadas ou faturáveis.</small></section>;
}
