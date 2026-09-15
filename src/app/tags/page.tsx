import AppShell from '@/components/AppShell'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import TagsClient from './TagsClient'

export const metadata = {
  title: 'Tags e lotação — AlfaAltoGrup'
}

export default async function TagsPage() {
  const session = await getServerSession()
  if (!session) redirect('/login')

  return (
    <AppShell titulo="Tags e lotação" subtitulo="Agrupe por cidade, unidade ou serviço — e nunca fique sem grupo com vaga">
      <div className="max-w-5xl mx-auto"><TagsClient /></div>
    </AppShell>
  )
}
