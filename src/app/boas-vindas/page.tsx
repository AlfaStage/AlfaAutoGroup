import AppShell from '@/components/AppShell'
import PainelBoasVindas from '@/components/PainelBoasVindas'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Boas-Vindas (PV) — AlfaAltoGrup'
}

export default async function BoasVindasPage() {
  const session = await getServerSession()
  if (!session) redirect('/login')

  const [groups, tags] = await Promise.all([
    prisma.group.findMany({
      select: { id: true, name: true, slug: true, instanceName: true },
      orderBy: { name: 'asc' }
    }),
    prisma.tag.findMany({
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' }
    })
  ])

  return (
    <AppShell
      titulo="Boas-Vindas no Privado (PV)"
      subtitulo="Automação de mensagens em bloco único ou múltiplos blocos em sequência para novos membros"
    >
      <div className="max-w-7xl mx-auto">
        <PainelBoasVindas groups={groups} tags={tags} />
      </div>
    </AppShell>
  )
}
