import AppShell from '@/components/AppShell'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import DocsContent from './DocsContent'

export const metadata = {
  title: 'Documentação — AlfaAltoGrup'
}

export default async function DocumentacaoPage() {
  const session = await getServerSession()
  if (!session) redirect('/login')

  return (
    <AppShell titulo="Documentação" subtitulo="Formato JSON dos agendamentos, ações disponíveis e regras de execução">
      <DocsContent />
    </AppShell>
  )
}
