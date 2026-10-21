'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip'
import {
  Users,
  Tag as TagIcon,
  BarChart3,
  MousePointerClick,
  KeyRound,
  BookOpen,
  Menu,
  Download,
  FileCode2,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type Destino = {
  href: string
  rotulo: string
  icone: React.ReactNode
  principal?: boolean
}

const DESTINOS: Destino[] = [
  { href: '/', rotulo: 'Grupos', icone: <Users className="w-[18px] h-[18px]" />, principal: true },
  { href: '/tags', rotulo: 'Tags', icone: <TagIcon className="w-[18px] h-[18px]" />, principal: true },
  { href: '/relatorios', rotulo: 'Relatórios', icone: <BarChart3 className="w-[18px] h-[18px]" />, principal: true },
  { href: '/links', rotulo: 'Cliques', icone: <MousePointerClick className="w-[18px] h-[18px]" />, principal: true },
  { href: '/chaves', rotulo: 'Chaves', icone: <KeyRound className="w-[18px] h-[18px]" /> },
  { href: '/documentacao', rotulo: 'Documentação', icone: <BookOpen className="w-[18px] h-[18px]" /> },
  { href: '/api-docs', rotulo: 'Referência API', icone: <FileCode2 className="w-[18px] h-[18px]" /> },
]

const PRINCIPAIS = DESTINOS.filter((d) => d.principal)
const SECUNDARIOS = DESTINOS.filter((d) => !d.principal)

function estaAtivo(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname.startsWith(href)
}

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
      className={compacto ? 'h-8 w-8' : 'w-full justify-start'}
    >
      <Download className="w-4 h-4" />
      {!compacto && <span className="ml-2">Instalar App</span>}
    </Button>
  )
}

export interface AppShellProps {
  titulo: string
  subtitulo?: string
  voltarPara?: string
  acoes?: React.ReactNode
  children: React.ReactNode
}

export function AppShell({
  titulo,
  subtitulo,
  voltarPara,
  acoes,
  children,
}: AppShellProps) {
  const pathname = usePathname()
  const [mobileMenuAberto, setMobileMenuAberto] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mounted, setMounted] = useState(false)

  // SSR-safe state synchronization to prevent React 19 hydration mismatch
  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('alfa_sidebar_open')
    if (saved !== null) {
      setSidebarOpen(saved === 'true')
    }
  }, [])

  const toggleSidebar = () => {
    const next = !sidebarOpen
    setSidebarOpen(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem('alfa_sidebar_open', String(next))
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background flex">
        {/* ========================================= Desktop Sidebar */}
        <aside
          className={cn(
            'hidden lg:flex flex-col border-r border-border/40 bg-card/60 backdrop-blur-md sticky top-0 h-screen transition-all duration-300 z-40',
            sidebarOpen ? 'w-64' : 'w-16'
          )}
        >
          {/* Header da Sidebar */}
          <div className="h-14 border-b border-border/40 flex items-center justify-between px-3">
            {sidebarOpen ? (
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-sm tracking-tight text-foreground truncate block">
                    AlfaAltoGrup
                  </span>
                  <span className="text-[10px] text-muted-foreground block -mt-0.5">
                    Painel Operacional
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-8 h-8 mx-auto rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
              title={sidebarOpen ? 'Recolher menu' : 'Expandir menu'}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeftOpen className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Navegação da Sidebar */}
          <nav className="flex-1 overflow-y-auto p-2 space-y-1">
            {DESTINOS.map((d) => {
              const ativo = estaAtivo(pathname, d.href)

              if (!sidebarOpen) {
                return (
                  <Tooltip key={d.href}>
                    <TooltipTrigger asChild>
                      <Link href={d.href} className="block">
                        <Button
                          variant={ativo ? 'secondary' : 'ghost'}
                          size="icon"
                          className={cn(
                            'w-full h-10 rounded-lg justify-center',
                            ativo && 'bg-primary/10 text-primary hover:bg-primary/15'
                          )}
                        >
                          {d.icone}
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{d.rotulo}</TooltipContent>
                  </Tooltip>
                )
              }

              return (
                <Link key={d.href} href={d.href} className="block">
                  <Button
                    variant={ativo ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'w-full justify-start gap-3 rounded-lg text-sm font-normal transition-colors',
                      ativo &&
                        'bg-primary/10 text-primary font-semibold hover:bg-primary/15 hover:text-primary'
                    )}
                  >
                    {d.icone}
                    <span className="truncate">{d.rotulo}</span>
                  </Button>
                </Link>
              )
            })}
          </nav>

          {/* Footer da Sidebar */}
          <div className="p-3 border-t border-border/40 space-y-2">
            <BotaoInstalar compacto={!sidebarOpen} />
          </div>
        </aside>

        {/* ========================================= Main Layout Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar Contextual */}
          <header
            className="sticky top-0 z-30 border-b border-border/40 bg-background/85 backdrop-blur-md"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            <div className="container mx-auto px-4">
              <div className="h-14 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Botão Voltar (Desktop & Mobile) */}
                  {voltarPara ? (
                    <>
                      {/* Desktop Voltar com texto */}
                      <Link href={voltarPara} className="hidden lg:inline-flex">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          <span>Voltar</span>
                        </Button>
                      </Link>
                      {/* Mobile Voltar em ícone */}
                      <Link href={voltarPara} className="lg:hidden">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full -ml-2"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </Button>
                      </Link>
                    </>
                  ) : (
                    /* Mobile Drawer Trigger quando não há voltar */
                    <Sheet
                      open={mobileMenuAberto}
                      onOpenChange={setMobileMenuAberto}
                    >
                      <SheetTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full -ml-2 lg:hidden"
                        >
                          <Menu className="w-5 h-5" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="left" className="w-[280px]">
                        <SheetHeader>
                          <SheetTitle className="text-left flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-primary" />
                            AlfaAltoGrup
                          </SheetTitle>
                        </SheetHeader>
                        <nav className="mt-6 space-y-1">
                          {DESTINOS.map((d) => (
                            <Link
                              key={d.href}
                              href={d.href}
                              onClick={() => setMobileMenuAberto(false)}
                              className={cn(
                                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                                estaAtivo(pathname, d.href)
                                  ? 'bg-primary/10 text-primary font-medium'
                                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                              )}
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

                  {/* Título e Subtítulo */}
                  <div className="min-w-0 flex-1">
                    <h1 className="text-base font-bold leading-tight truncate max-w-[200px] sm:max-w-md lg:max-w-xl">
                      {titulo}
                    </h1>
                    {subtitulo && (
                      <p className="text-xs text-muted-foreground truncate hidden sm:block">
                        {subtitulo}
                      </p>
                    )}
                  </div>
                </div>

                {/* Ações contextuais */}
                {acoes && (
                  <div className="flex items-center gap-2 shrink-0">{acoes}</div>
                )}
              </div>
            </div>
          </header>

          {/* Conteúdo da Página */}
          <main className="container mx-auto px-4 py-6 pb-28 lg:pb-10 flex-1">
            {children}
          </main>
        </div>

        {/* ========================================= Mobile Bottom Navigation */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border/40 bg-background/95 backdrop-blur-md"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="grid grid-cols-5 h-14">
            {PRINCIPAIS.map((d) => {
              const ativo = estaAtivo(pathname, d.href)
              return (
                <Link
                  key={d.href}
                  href={d.href}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 py-1 transition-colors',
                    ativo ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  <span className={ativo ? 'scale-110 transition-transform' : ''}>
                    {d.icone}
                  </span>
                  <span className="text-[10px] leading-none font-medium">
                    {d.rotulo}
                  </span>
                </Link>
              )
            })}

            {/* Menu "Mais" em gaveta inferior */}
            <Sheet>
              <SheetTrigger asChild>
                <button className="flex flex-col items-center justify-center gap-0.5 py-1 text-muted-foreground hover:text-foreground">
                  <Menu className="w-[18px] h-[18px]" />
                  <span className="text-[10px] leading-none font-medium">Mais</span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh]">
                <SheetHeader>
                  <SheetTitle className="text-left">Mais Opções</SheetTitle>
                </SheetHeader>
                <nav
                  className="mt-4 space-y-1 pb-4"
                  style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                >
                  {SECUNDARIOS.map((d) => (
                    <Link
                      key={d.href}
                      href={d.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors',
                        estaAtivo(pathname, d.href)
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                      )}
                    >
                      {d.icone}
                      {d.rotulo}
                    </Link>
                  ))}
                  <div className="pt-3">
                    <BotaoInstalar />
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>
    </TooltipProvider>
  )
}

export default AppShell
