import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import LinksClient from './LinksClient'

export const metadata = {
  title: 'Cliques em links — AlfaAltoGrup'
}

export default async function LinksPage() {
  const session = await getServerSession()
  if (!session) redirect('/login')

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
            <h1 className="text-lg font-bold leading-tight">Cliques em links</h1>
            <p className="text-xs text-muted-foreground">
              Links encurtados pelo painel e quantas vezes foram abertos
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <LinksClient />
      </div>
    </div>
  )
}
