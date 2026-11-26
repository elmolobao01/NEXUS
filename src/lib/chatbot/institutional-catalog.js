// Server-side, read-only commercial catalog. Never accepts an organization from message text.
export const INSTITUTIONAL_ORG = '11de735a-4dfb-4b8d-b817-bda83d6df03a';
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const niches = [ ['website', /\b(site|sites|website|websites|landing page)\b/], ['saude', /\b(saude|clinica|clinicas|consultorio|consultorios)\b/], ['hotelaria', /\b(hotelaria|hotel|hoteis|pousada|pousadas|hostel)\b/], ['restaurante', /\b(restaurante|restaurantes|pizzaria|hamburgueria|lanchonete)\b/], ['delivery', /\b(delivery|entregas)\b/], ['educacao', /\b(educacao|escola|escolas|creche)\b/], ['juridico', /\b(juridico|advocacia|advogado)\b/], ['imobiliario', /\b(imobiliario|imobiliaria|corretor)\b/], ['varejo', /\b(varejo|loja fisica)\b/], ['pet', /\b(pet|petshop|pet shop)\b/], ['profissao', /\b(profissao|autonomo|autonoma)\b/], ['ecommerce', /\b(e commerce|ecommerce|loja virtual)\b/], ['ia', /\b(ia|inteligencia artificial|inteligencia e ia)\b/], ['chatbot', /\b(chatbot|chat bot)\b/] ];
const priceIntent = /\b(preco|precos|valor|valores|custa|custam|mensalidade|mensalidades|quanto|planos|plano|desconto|descontos|recarga|recargas)\b/;
const money = n => Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const validPrice = n => n !== null && n !== undefined && n !== '' && Number.isFinite(Number(n)) && Number(n)>=0;
export async function institutionalCatalogReply({organizationId,planCode,config,message,base,headers,fetchImpl=fetch}) {
  if (organizationId!==INSTITUTIONAL_ORG || planCode!=='CHATBOT_AI' || !config?.active || typeof message!=='string' || message.length>1000) return null;
  const q=norm(message);
  // A standalone segment name is an explicit catalog selection (including follow-up).
  const standalone = niches.some(([,pattern]) => { const m=q.match(pattern); return m?.[0]===q; });
  if (!priceIntent.test(q) && !standalone) return null;
  const answer=reply=>({type:'catalog',reply});
  const matches=niches.filter(([,pattern])=>pattern.test(q));
  if (/\b(desconto|descontos|recarga|recargas|anual|implantacao|agregado|agregada|combo)\b/.test(q)) return answer('Essa condição comercial depende da modalidade contratada. Confirme os valores e condições com contato@pleniumgestao.com.br.');
  if(matches.length!==1) return answer('Qual produto da PLENIUM você deseja consultar? Informe o segmento ou o nome do produto para verificarmos os planos e valores.');
  try {
    const url=new URL(`${base.replace(/\/$/,'')}/rest/v1/nexus_products`);
    url.search=new URLSearchParams({select:'id,code,name,segment,monthly_price,standalone,active',active:'eq.true',standalone:'eq.true',order:'name.asc,id.asc',limit:'501'}).toString();
    const res=await fetchImpl(url.toString(),{headers,cache:'no-store',method:'GET'});
    if(!res.ok) throw Error('catalog_unavailable');
    const rows=await res.json();
    if(!Array.isArray(rows)||rows.length>500) throw Error('catalog_incomplete');
    const [key,pattern]=matches[0];
    const requestedPlan=q.match(/\b(core|eco|integra|basico|standard|profissional)\b/)?.[1];
    const products=rows.filter(r=>r.active===true && r.standalone===true && validPrice(r.monthly_price) && Number(r.monthly_price)>0 && (pattern.test(norm(r.name)) || pattern.test(norm(r.segment)) || (key==='ecommerce' && /ecommerce/.test(norm(r.code))) || (key==='chatbot' && /^CHATBOT_(AI|BASIC)$/.test(r.code))) && (!requestedPlan || norm(r.name).split(' ').includes(requestedPlan)));
    if(!products.length || products.length>8) return answer('Não encontrei uma oferta mensal inequívoca no catálogo para essa consulta. Nossa equipe comercial pode confirmar em contato@pleniumgestao.com.br.');
    return answer('Valores mensais cadastrados no catálogo PLENIUM:\n'+products.map(r=>`${String(r.name).replace(/[\r\n]/g,' ').slice(0,120)}: ${money(r.monthly_price)}/mês`).join('\n')+'\nCondições de contratação e personalização sujeitas à confirmação comercial.');
  } catch { return answer('O catálogo comercial está temporariamente indisponível. Para confirmar valores atualizados, entre em contato: contato@pleniumgestao.com.br.'); }
}
