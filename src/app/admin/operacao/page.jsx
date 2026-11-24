import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {master,OPERATION} from '@/lib/auth/master-context';
import MasterContextSelector from '../master-context-selector';
import ChatbotSettings from '../../portal/chatbot-settings';
export const dynamic='force-dynamic';
export default async function OperationPage(){
 const ctx=await master(await cookies());
 if(!ctx || ctx.organizationId!==OPERATION)redirect('/admin');
 return <main className="root2-main" style={{padding:24}}><header className="root2-topbar"><h1>PLENIUM — Operação institucional</h1><MasterContextSelector/></header><ChatbotSettings canEdit institutional /></main>;
}
