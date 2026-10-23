import AppShell from '@/components/AppShell'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import AuditoriaClient from './AuditoriaClient'

export const metadata = {
  title: 'Auditoria de Membros & DDDs — AlfaAltoGrup'
}

export default async function AuditoriaPage() {
  const session = await getServerSession()
  if (!session) redirect('/login')

  const tags = await prisma.tag.findMany({
    select: { id: true, name: true, color: true },
    orderBy: { name: 'asc' }
  })

  return (
    <AppShell
      titulo="Auditoria de Membros & DDDs"
      subtitulo="Detecção de membros duplicados com proteção de equipe e distribuição geográfica por DDD/Estado"
    >
      <div className="max-w-7xl mx-auto">
        <AuditoriaClient tags={tags} />
      </div>
    </AppShell>
  )
}
