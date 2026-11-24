'use client';
import {useEffect,useState} from 'react';
export default function MasterContextSelector(){
 const [context,setContext]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{fetch('/api/admin/master-context',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>setContext(d?.context||null)).catch(()=>{});},[]);
 async function change(target){setBusy(true);setError('');try{const r=await fetch('/api/admin/master-context',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({context:target})});const d=await r.json();if(!r.ok)throw Error(d.message);window.location.assign(target==='operation'?'/admin/operacao':'/admin');}catch(e){setError(e.message);setBusy(false);}}
 if(!context)return null;
 return <div><label>Ambiente <select value={context} disabled={busy} onChange={e=>change(e.target.value)}><option value="platform">Administração global</option><option value="operation">Operação PLENIUM</option></select></label>{context==='operation'&&<button disabled={busy} onClick={()=>change('operation')}>Abrir operação</button>}{error&&<p role="alert">{error}</p>}</div>;
}
