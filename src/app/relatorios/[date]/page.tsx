import AppShell from '@/components/AppShell'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import RelatorioClient from './RelatorioClient'

export const metadata = {
  title: 'Relatório — AlfaAltoGrup'
}

export default async function RelatorioPage({ params }: { params: Promise<{ date: string }> }) {
  const session = await getServerSession()
  if (!session) redirect('/login')

  const { date } = await params

  return (
    <AppShell titulo="Relatório diário" subtitulo="Envios, falhas, cliques, enquetes e crescimento — por grupo e por instância">
      <div className="max-w-6xl mx-auto"><RelatorioClient data={date} /></div>
    </AppShell>
  )
}
