import AppShell from '@/components/AppShell'
import PainelAgendaCampanhas from '@/components/PainelAgendaCampanhas'
import { prisma } from '@/lib/prisma'
import { listarInstanciasEvolution } from '@shared/welcome'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Agenda & Fila Global — AlfaAltoGrup'
}

export default async function AgendaPage() {
  const session = await getServerSession()
  if (!session) redirect('/login')

  const [tags, rawInstances] = await Promise.all([
    prisma.tag.findMany({
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' }
    }),
    listarInstanciasEvolution()
  ])

  const instances = rawInstances.map((i: any) => ({
    instanceName: i.name,
    status: i.connected ? 'open' : 'close',
    phone: i.phone
  }))

  return (
    <AppShell
      titulo="Agenda & Fila Global"
      subtitulo="Gerenciamento central de campanhas, fila de disparos e controle em lote"
    >
      <div className="max-w-7xl mx-auto">
        <PainelAgendaCampanhas tags={tags} instances={instances} />
      </div>
    </AppShell>
  )
}
