'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Info, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
          g.errors.some((e: any) => e.errorMessage?.includes('no active session found'))
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
        body: JSON.stringify({ groupId })
      })
      if (res.ok) {
        alert('Mensagens aprovadas e reagendadas com sucesso!')
        await fetchErrors()
      } else {
        alert('Erro ao tentar reagendar mensagens.')
      }
    } catch (e) {
      alert('Falha na comunicação com o servidor.')
    } finally {
      setResolving(null)
    }
  }

  if (errorGroups.length === 0) return null

  return (
    <>
      {/* Toast flutuante */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        <div className="bg-red-500 text-white p-4 rounded-lg shadow-lg flex items-center justify-between w-80">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div className="text-sm font-medium">
              {errorGroups.length} grupo(s) com disparos parados por erro.
            </div>
          </div>
          <Button 
            size="sm" 
            variant="secondary" 
            className="text-xs bg-white text-red-600 hover:bg-red-50"
            onClick={() => setIsModalOpen(true)}
          >
            Ver
          </Button>
        </div>
      </div>

      {/* Popup Obrigatório: Sessão Desconectada */}
      {isSessionPopupOpen && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-background border-red-500 border-2 rounded-xl p-6 max-w-md w-full shadow-2xl relative">
            <div className="text-red-500 mb-4 flex justify-center">
              <AlertTriangle className="w-16 h-16" />
            </div>
            <h2 className="text-xl font-bold text-center text-foreground mb-2">
              WhatsApp Desconectado!
            </h2>
            <p className="text-center text-muted-foreground mb-6">
              Detectamos o erro <strong>"no active session found"</strong>. Seu aparelho desconectou da Evolution API e nenhuma mensagem será enviada até que você reconecte.
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => setIsSessionPopupOpen(false)}>
                Entendi, vou reconectar
              </Button>
              <Button variant="destructive" onClick={() => {
                setIsSessionPopupOpen(false)
                setIsModalOpen(true)
              }}>
                Gerenciar Atrasos
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gerenciamento de Erros */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl flex flex-col max-w-3xl w-full max-h-[85vh] shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Gerenciador de Falhas e Atrasos
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Quando uma mensagem falha, o envio para aquele grupo é congelado para manter a ordem.
                Resolva o problema (ex: reconecte o WhatsApp) e clique em <strong>Reativar</strong>. 
                As mensagens pendentes serão empurradas para frente preservando os intervalos de tempo.
              </p>

              {errorGroups.map(({ group, errors }) => (
                <div key={group.id} className="border border-border/50 bg-muted/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3 border-b pb-2">
                    <div className="font-semibold">{group.name}</div>
                    <Button 
                      size="sm" 
                      onClick={() => handleResolve(group.id)}
                      disabled={resolving === group.id}
                    >
                      {resolving === group.id ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                      Reativar / Aprovar
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {errors.map((err: any) => (
                      <div key={err.id} className="bg-red-500/10 border border-red-500/20 p-3 rounded-md">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-red-500">ERRO</span>
                          <span className="text-xs text-muted-foreground">
                            Agendado para: {new Date(err.scheduledAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm font-mono text-red-600/80 break-words mb-2">
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
            
            <div className="p-4 border-t flex justify-end bg-muted/10 rounded-b-xl">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Fechar</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
