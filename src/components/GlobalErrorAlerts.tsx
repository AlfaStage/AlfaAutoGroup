'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from '@/components/ui/use-toast'
import Link from 'next/link'

export function GlobalErrorAlerts() {
  const [errorGroups, setErrorGroups] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSessionPopupOpen, setIsSessionPopupOpen] = useState(false)
  const [resolving, setResolving] = useState<string | null>(null)

  const fetchErrors = async () => {
    try {
      const res = await fetch('/api/groups/errors')
      const data = await res.json()
      if (res.ok) {
        setErrorGroups(data.errorGroups || [])
        // Checar se algum dos erros é de sessão inativa
        const hasSessionError = data.errorGroups?.some((g: any) =>
          g.errors?.some((e: any) => e.errorMessage?.includes('no active session found'))
        )
        if (hasSessionError) {
          setIsSessionPopupOpen(true)
        } else {
          setIsSessionPopupOpen(false)
        }
      }
    } catch (e) {
      console.error('Falha ao buscar erros', e)
    }
  }

  useEffect(() => {
    fetchErrors()
    const interval = setInterval(fetchErrors, 15000)
    return () => clearInterval(interval)
  }, [])

  const handleResolve = async (groupId: string) => {
    setResolving(groupId)
    try {
      const res = await fetch('/api/groups/errors/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId }),
      })
      if (res.ok) {
        toast.success('Mensagens aprovadas e reagendadas com sucesso!')
        await fetchErrors()
      } else {
        toast.error('Erro ao tentar reagendar mensagens.')
      }
    } catch (e) {
      toast.error('Falha na comunicação com o servidor.')
    } finally {
      setResolving(null)
    }
  }

  if (errorGroups.length === 0) return null

  return (
    <>
      {/* Toast flutuante */}
      {/* No celular sobe acima da barra de navegacao inferior, para nao cobri-la */}
      <div className="fixed right-4 z-50 flex flex-col gap-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-4">
        <div className="bg-red-950/90 border border-red-800 text-red-100 p-4 rounded-lg shadow-lg flex items-center justify-between w-80 backdrop-blur">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-400" />
            <div className="text-sm font-medium">
              {errorGroups.length} grupo(s) com disparos parados por erro.
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="text-xs bg-red-900/60 hover:bg-red-800 text-white border border-red-700"
            onClick={() => setIsModalOpen(true)}
          >
            Ver
          </Button>
        </div>
      </div>

      {/* Popup Obrigatório: Sessão Desconectada */}
      <Dialog open={isSessionPopupOpen} onOpenChange={setIsSessionPopupOpen}>
        <DialogContent className="sm:max-w-md border-red-500/50">
          <DialogHeader>
            <div className="text-red-500 mb-2 flex justify-center">
              <AlertTriangle className="w-12 h-12" />
            </div>
            <DialogTitle className="text-center text-xl font-bold">
              WhatsApp Desconectado!
            </DialogTitle>
            <DialogDescription className="text-center">
              Detectamos o erro <strong>&quot;no active session found&quot;</strong>. Seu aparelho desconectou da Evolution API e nenhuma mensagem será enviada até que você reconecte.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsSessionPopupOpen(false)}>
              Entendi, vou reconectar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setIsSessionPopupOpen(false)
                setIsModalOpen(true)
              }}
            >
              Gerenciar Atrasos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Gerenciamento de Erros Padronizado */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden flex flex-col max-h-[85dvh]">
          <DialogHeader className="p-6 pb-4 border-b border-border/50 shrink-0">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Gerenciador de Falhas e Atrasos
            </DialogTitle>
            <DialogDescription>
              Quando uma mensagem falha, o envio para aquele grupo é congelado para manter a ordem. Resolva o problema e reative os disparos.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 p-6 space-y-4">
            <div className="space-y-4">
              {errorGroups.map(({ group, errors }) => (
                <div key={group.id} className="border border-border/50 bg-muted/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3 border-b border-border/40 pb-2 flex-wrap gap-2">
                    <div className="font-semibold">{group.name}</div>
                    <div className="flex items-center gap-2">
                      <Link href={`/${group.slug}?tab=schedules`}>
                        <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                          Ver Grupo
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        onClick={() => handleResolve(group.id)}
                        disabled={resolving === group.id}
                      >
                        {resolving === group.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Reativar / Aprovar
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {errors.map((err: any) => (
                      <div key={err.id} className="bg-red-500/10 border border-red-500/20 p-3 rounded-md">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-red-400">ERRO</span>
                          <span className="text-xs text-muted-foreground">
                            Agendado para: {new Date(err.scheduledAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm font-mono text-red-300 break-words mb-2">
                          {err.errorMessage}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          Mensagem: {err.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 pt-4 border-t border-border/50 shrink-0 bg-background/80 backdrop-blur">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
