import AppShell from '@/components/AppShell'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import LinksClient from './LinksClient'

export const metadata = {
  title: 'Cliques em links — AlfaAltoGrup'
}

export default async function LinksPage() {
  const session = await getServerSession()
  if (!session) redirect('/login')

  return (
    <AppShell titulo="Cliques em links" subtitulo="Links encurtados pelo painel e quantas vezes foram abertos">
      <div className="max-w-5xl mx-auto"><LinksClient /></div>
    </AppShell>
  )
}
