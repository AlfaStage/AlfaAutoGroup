import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import RelatorioClient from './RelatorioClient'

export const metadata = {
  title: 'Relatório — AlfaAltoGrup'
}

export default async function RelatorioPage({ params }: { params: Promise<{ date: string }> }) {
  const session = await getServerSession()
  if (!session) redirect('/login')

  const { date } = await params

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card/30 border-b border-border/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold leading-tight">Relatório diário</h1>
            <p className="text-xs text-muted-foreground">
              Envios, falhas, cliques, enquetes e crescimento — por grupo e por instância
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <RelatorioClient data={date} />
      </div>
    </div>
  )
}
