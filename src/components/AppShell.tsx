'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  Users, Tag as TagIcon, BarChart3, MousePointerClick, KeyRound, BookOpen,
  Menu, Download, FileCode2, ChevronLeft
} from 'lucide-react'

/**
 * Casca da aplicacao: uma barra no topo e, no celular, uma barra fixa embaixo.
 *
 * A navegacao inferior existe porque o app roda instalado como PWA — no
 * celular o polegar alcanca a base da tela, nao o topo. E as areas seguras
 * (notch e barra de gestos do iOS) sao respeitadas para o conteudo nao ficar
 * embaixo delas.
 */

type Destino = {
  href: string
  rotulo: string
  icone: React.ReactNode
  /** Aparece na barra inferior do celular. */
  principal?: boolean
}

const DESTINOS: Destino[] = [
  { href: '/', rotulo: 'Grupos', icone: <Users className="w-[18px] h-[18px]" />, principal: true },
  { href: '/tags', rotulo: 'Tags', icone: <TagIcon className="w-[18px] h-[18px]" />, principal: true },
  { href: '/relatorios', rotulo: 'Relatórios', icone: <BarChart3 className="w-[18px] h-[18px]" />, principal: true },
  { href: '/links', rotulo: 'Cliques', icone: <MousePointerClick className="w-[18px] h-[18px]" />, principal: true },
  { href: '/chaves', rotulo: 'Chaves', icone: <KeyRound className="w-[18px] h-[18px]" /> },
  { href: '/documentacao', rotulo: 'Documentação', icone: <BookOpen className="w-[18px] h-[18px]" /> },
  { href: '/api-docs', rotulo: 'Referência da API', icone: <FileCode2 className="w-[18px] h-[18px]" /> }
]

const PRINCIPAIS = DESTINOS.filter(d => d.principal)
const SECUNDARIOS = DESTINOS.filter(d => !d.principal)

function estaAtivo(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname.startsWith(href)
}

/** Botao de instalar, que so aparece quando o navegador oferece. */
function BotaoInstalar({ compacto }: { compacto?: boolean }) {
  const [evento, setEvento] = useState<any>(null)

  useEffect(() => {
    const aoOferecer = (e: any) => {
      e.preventDefault()
      setEvento(e)
    }
    window.addEventListener('beforeinstallprompt', aoOferecer)
    window.addEventListener('appinstalled', () => setEvento(null))
    return () => window.removeEventListener('beforeinstallprompt', aoOferecer)
  }, [])

  if (!evento) return null

  const instalar = async () => {
    evento.prompt()
    await evento.userChoice
    setEvento(null)
  }

  return (
    <Button
      variant="outline"
      size={compacto ? 'icon' : 'sm'}
      onClick={instalar}
      title="Instalar aplicativo"
    >
      <Download className="w-4 h-4" />
      {!compacto && <span className="ml-2">Instalar</span>}
    </Button>
  )
}

export default function AppShell({
  titulo,
  subtitulo,
  voltarPara,
  acoes,
  children
}: {
  titulo: string
  subtitulo?: string
  /** Quando presente, mostra a seta de voltar no lugar do menu. */
  voltarPara?: string
  /** Ações específicas da página, à direita do cabeçalho. */
  acoes?: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [menuAberto, setMenuAberto] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* ----------------------------------------------------- topo */}
      <header
        className="sticky top-0 z-30 border-b border-border/40 bg-background/85 backdrop-blur-md"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="container mx-auto px-4">
          <div className="h-14 flex items-center gap-3">
            {voltarPara ? (
              <Link href={voltarPara} className="lg:hidden">
                <Button variant="ghost" size="icon" className="rounded-full -ml-2">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              </Link>
            ) : (
              <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full -ml-2 lg:hidden">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px]">
                  <SheetHeader>
                    <SheetTitle className="text-left">AlfaAltoGrup</SheetTitle>
                  </SheetHeader>
                  <nav className="mt-6 space-y-1">
                    {DESTINOS.map(d => (
                      <Link
                        key={d.href}
                        href={d.href}
                        onClick={() => setMenuAberto(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                          estaAtivo(pathname, d.href)
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                        }`}
                      >
                        {d.icone}
                        {d.rotulo}
                      </Link>
                    ))}
                  </nav>
                  <div className="mt-6 pt-6 border-t border-border/40">
                    <BotaoInstalar />
                  </div>
                </SheetContent>
              </Sheet>
            )}

            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold leading-tight truncate">{titulo}</h1>
              {subtitulo && (
                <p className="text-xs text-muted-foreground truncate hidden sm:block">{subtitulo}</p>
              )}
            </div>

            {/* Navegação no desktop */}
            <nav className="hidden lg:flex items-center gap-1">
              {DESTINOS.map(d => (
                <Link key={d.href} href={d.href}>
                  <Button
                    variant={estaAtivo(pathname, d.href) ? 'secondary' : 'ghost'}
                    size="sm"
                    className={estaAtivo(pathname, d.href) ? 'font-medium' : 'text-muted-foreground'}
                  >
                    {d.icone}
                    <span className="ml-2">{d.rotulo}</span>
                  </Button>
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="hidden lg:block"><BotaoInstalar compacto /></span>
              {acoes}
            </div>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------- conteúdo */}
      <main className="container mx-auto px-4 py-6 pb-28 lg:pb-10">
        {children}
      </main>

      {/* ------------------------------------- navegação inferior (celular) */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border/40 bg-background/95 backdrop-blur-md"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-5">
          {PRINCIPAIS.map(d => {
            const ativo = estaAtivo(pathname, d.href)
            return (
              <Link
                key={d.href}
                href={d.href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
                  ativo ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <span className={ativo ? 'scale-110 transition-transform' : ''}>{d.icone}</span>
                <span className="text-[10px] leading-none">{d.rotulo}</span>
              </Link>
            )
          })}

          <Sheet>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-muted-foreground">
                <Menu className="w-[18px] h-[18px]" />
                <span className="text-[10px] leading-none">Mais</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader>
                <SheetTitle className="text-left">Mais</SheetTitle>
              </SheetHeader>
              <nav
                className="mt-4 space-y-1 pb-4"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              >
                {SECUNDARIOS.map(d => (
                  <Link
                    key={d.href}
                    href={d.href}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm ${
                      estaAtivo(pathname, d.href)
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    {d.icone}
                    {d.rotulo}
                  </Link>
                ))}
                <div className="pt-3"><BotaoInstalar /></div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </div>
  )
}
