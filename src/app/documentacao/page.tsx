import AppShell from '@/components/AppShell'
import DocsContent from './DocsContent'

export const metadata = {
  title: 'Documentação — AlfaAltoGrup'
}

export default function DocumentacaoPage() {
  return (
    <AppShell titulo="Documentação" subtitulo="Formato JSON dos agendamentos, ações disponíveis e regras de execução">
      <DocsContent />
    </AppShell>
  )
}
