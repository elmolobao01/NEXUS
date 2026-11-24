import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import { master, OPERATION } from '@/lib/auth/master-context';
import MasterContextSelector from '../master-context-selector';
import ChatbotSettings from '../../portal/chatbot-settings';
import '../globals.css';

export const dynamic = 'force-dynamic';
export default async function OperationPage() {
  const ctx = await master(await cookies());
  if (!ctx || ctx.organizationId !== OPERATION) redirect('/admin');
  return (
    <main className="client-shell">
      <aside className="client-sidebar">
        <div className="client-brand">
          <Image src="/branding/plenium-symbol.png" width={48} height={48} alt="PLENIUM" />
          <div><strong>PLENIUM</strong><span>Ecossistema de Soluções</span></div>
        </div>
        <div className="client-identity"><small>Operação institucional</small><strong>PLENIUM</strong><span>Ambiente próprio</span></div>
        <nav className="client-navigation" aria-label="Operação institucional">
          <a className="client-nav active" href="/admin/operacao" aria-current="page"><span />Meu Chatbot</a>
        </nav>
        <div className="client-user"><span className="user-avatar">PL</span><div><strong>MASTER</strong><small>Operação institucional</small></div></div>
      </aside>
      <section className="client-workspace">
        <header className="client-topbar">
          <div><h1>Operação institucional</h1><p>Gerencie o atendimento da PLENIUM.</p></div>
          <div className="client-top-actions"><MasterContextSelector /></div>
        </header>
        <ChatbotSettings canEdit institutional />
      </section>
    </main>
  );
}
