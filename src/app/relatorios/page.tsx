import { redirect } from 'next/navigation'

/** Sem data na URL, cai no relatório de hoje (fuso de São Paulo). */
export default function RelatoriosIndex() {
  const hoje = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())

  redirect(`/relatorios/${hoje}`)
}
