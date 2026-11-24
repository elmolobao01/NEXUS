import { NextResponse } from 'next/server';
import { master, PLATFORM, OPERATION, COOKIE, signature, sameOrigin } from '@/lib/auth/master-context';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const reply = (data,status=200) => NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request) {
  try { const ctx=await master(request.cookies); return ctx ? reply({context:ctx.organizationId===OPERATION?'operation':'platform'}) : reply({message:'Acesso MASTER necessário.'},403); } catch {return reply({message:'Contexto indisponível.'},503);}
}
export async function POST(request) {
  try {
    if (!sameOrigin(request)) return reply({message:'Origem inválida.'},403);
    const ctx=await master(request.cookies);
    if (!ctx) return reply({message:'Acesso MASTER necessário.'},403);
    const {context}=await request.json();
    if (!['platform','operation'].includes(context)) return reply({message:'Contexto inválido.'},400);
    const target=context==='operation'?OPERATION:PLATFORM;
    if (target!==ctx.organizationId) {
      const audit=await fetch(`${ctx.base}/rest/v1/nexus_master_context_audit`,{method:'POST',headers:ctx.headers,body:JSON.stringify({actor_user_id:ctx.user.id,from_organization_id:ctx.organizationId,to_organization_id:target,action:'CONTEXT_SWITCH'}),cache:'no-store'});
      if (!audit.ok) return reply({message:'Auditoria indisponível. Contexto não alterado.'},503);
    }
    const res=reply({context});
    res.cookies.set(COOKIE,target===OPERATION?signature(ctx.token,ctx.user.id,target,ctx.service):'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',...(target===PLATFORM?{maxAge:0}:{})});
    return res;
  } catch {return reply({message:'Não foi possível trocar o contexto.'},503);}
}
