import AppShell from '@/components/AppShell'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import KeysClient from './KeysClient'

export const metadata = {
  title: 'Chaves de API — AlfaAltoGrup'
}

export default async function ChavesPage() {
  const session = await getServerSession()
  if (!session) redirect('/login')

  return (
    <AppShell titulo="Chaves de API" subtitulo="Acesso externo à API REST e ao servidor MCP">
      <div className="max-w-3xl mx-auto"><KeysClient /></div>
    </AppShell>
  )
}
