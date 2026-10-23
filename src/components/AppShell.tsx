'use client'

import { ReactNode, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  LayoutGrid,
  Tags,
  BarChart3,
  Link2,
  KeyRound,
  BookOpen,
  LogOut,
  Menu,
  MessageSquare,
  CalendarClock,
  Sparkles,
  ShieldCheck,
  ArrowLeft
} from 'lucide-react'

type Destino = {
  href: string
  rotulo: string
  icone: typeof LayoutGrid
  /** Se aparece na barra inferior do celular (max 4; o resto vai no "Mais") */
  principal?: boolean
  externo?: boolean
}

const DESTINOS: Destino[] = [
  { href: '/', rotulo: 'Grupos', icone: LayoutGrid, principal: true },
  { href: '/agenda', rotulo: 'Agenda & Fila', icone: CalendarClock, principal: true },
  { href: '/boas-vindas', rotulo: 'Boas-Vindas (PV)', icone: Sparkles, principal: true },
  { href: '/auditoria', rotulo: 'Auditoria & DDDs', icone: ShieldCheck },
  { href: '/tags', rotulo: 'Tags', icone: Tags, principal: true },
  { href: '/relatorios', rotulo: 'Relatórios', icone: BarChart3 },
  { href: '/links', rotulo: 'Links', icone: Link2 },
  { href: '/chaves', rotulo: 'Chaves de API', icone: KeyRound },
  { href: '/api-docs', rotulo: 'Documentação', icone: BookOpen }
]

const PRINCIPAIS = DESTINOS.filter(d => d.principal)

function estaAtivo(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

export default function AppShell({
  titulo,
  subtitulo,
  voltarPara,
  acoes,
  children
}: {
  titulo?: string
  subtitulo?: string
  voltarPara?: string
  acoes?: ReactNode
  children: ReactNode
}) {
  const pathname = usePathname() || '/'
  const [gavetaAberta, setGavetaAberta] = useState(false)

  return (
    <div className="min-h-screen bg-background flex">
      {/* Barra lateral — só em telas grandes */}
      <aside className="hidden lg:flex lg:flex-col w-60 shrink-0 border-r bg-card/60 sticky top-0 h-screen">
        <div className="h-16 px-5 flex items-center gap-2.5 border-b">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="leading-tight">
            <p className="font-semibold text-sm tracking-tight">AlfaAltoGrup</p>
            <p className="text-[11px] text-muted-foreground">Painel WhatsApp</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {DESTINOS.map(d => {
            const Icone = d.icone
            const ativo = estaAtivo(pathname, d.href)
            return (
              <Link
                key={d.href}
                href={d.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  ativo
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                }`}
              >
                <Icone className="w-4 h-4 shrink-0" />
                <span className="truncate">{d.rotulo}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            onClick={() => signOut()}
          >
            <LogOut className="w-4 h-4 mr-2.5" />
            Sair da conta
          </Button>
        </div>
      </aside>

      {/* Coluna principal */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topo enxuto */}
        <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b">
          <div className="px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden -ml-1.5 shrink-0"
                onClick={() => setGavetaAberta(true)}
                aria-label="Abrir menu"
              >
                <Menu className="w-5 h-5" />
              </Button>
              {voltarPara && (
                <Button variant="ghost" size="icon" asChild className="shrink-0">
                  <Link href={voltarPara} aria-label="Voltar">
                    <ArrowLeft className="w-4 h-4" />
                  </Link>
                </Button>
              )}
              <div className="min-w-0">
                <h1 className="font-semibold text-base sm:text-lg leading-tight truncate">
                  {titulo || 'AlfaAltoGrup'}
                </h1>
                {subtitulo && (
                  <p className="text-xs text-muted-foreground truncate hidden sm:block">
                    {subtitulo}
                  </p>
                )}
              </div>
            </div>

            {acoes && <div className="flex items-center gap-2 shrink-0">{acoes}</div>}
          </div>
        </header>

        {/* Conteúdo — espaço extra embaixo no celular por causa da barra fixa */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 sm:py-6 pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Barra inferior — só no celular/tablet */}
      <nav
        aria-label="Navegação principal"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur-md border-t pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5 h-16">
          {PRINCIPAIS.map(d => {
            const Icone = d.icone
            const ativo = estaAtivo(pathname, d.href)
            return (
              <Link
                key={d.href}
                href={d.href}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                  ativo ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icone className={`w-5 h-5 ${ativo ? 'stroke-[2.25]' : ''}`} />
                <span className="truncate max-w-[68px]">{d.rotulo}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setGavetaAberta(true)}
            className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground"
          >
            <Menu className="w-5 h-5" />
            <span>Mais</span>
          </button>
        </div>
      </nav>

      {/* Gaveta mobile com todos os destinos */}
      <Sheet open={gavetaAberta} onOpenChange={setGavetaAberta}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col">
          <SheetHeader className="p-5 border-b text-left">
            <SheetTitle className="flex items-center gap-2.5 text-base">
              <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
              AlfaAltoGrup
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 p-3 space-y-1 overflow-y-auto">
            {DESTINOS.map(d => {
              const Icone = d.icone
              const ativo = estaAtivo(pathname, d.href)
              return (
                <Link
                  key={d.href}
                  href={d.href}
                  onClick={() => setGavetaAberta(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium ${
                    ativo
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <Icone className="w-4 h-4 shrink-0" />
                  <span>{d.rotulo}</span>
                </Link>
              )
            })}
          </div>
          <div className="p-3 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive"
              onClick={() => signOut()}
            >
              <LogOut className="w-4 h-4 mr-2.5" />
              Sair da conta
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
