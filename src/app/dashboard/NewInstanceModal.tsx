'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface NewInstanceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  newInstance: {
    instanceName: string
    proxyHost: string
    proxyPort: string
    proxyProtocol: string
    proxyUsername: string
    proxyPassword: string
  }
  setNewInstance: React.Dispatch<
    React.SetStateAction<{
      instanceName: string
      proxyHost: string
      proxyPort: string
      proxyProtocol: string
      proxyUsername: string
      proxyPassword: string
    }>
  >
  onSubmit: (e: React.FormEvent) => Promise<void>
}

export function NewInstanceModal({
  open,
  onOpenChange,
  newInstance,
  setNewInstance,
  onSubmit,
}: NewInstanceModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] w-[95vw] max-h-[85dvh] flex flex-col p-0 rounded-xl overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b border-border/40 shrink-0">
          <DialogTitle>Nova Instância (Evolution API)</DialogTitle>
          <DialogDescription>
            Crie uma nova instância para conectar um número de WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="space-y-2">
              <Label>Nome da Instância</Label>
              <Input
                required
                placeholder="Ex: suporte_1"
                value={newInstance.instanceName}
                onChange={(e) =>
                  setNewInstance((prev) => ({ ...prev, instanceName: e.target.value }))
                }
              />
            </div>

            <div className="p-4 border border-border/50 bg-muted/10 rounded-lg space-y-4">
              <Label className="text-sm font-semibold text-muted-foreground">
                Configuração de Proxy (Opcional)
              </Label>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs">Host</Label>
                  <Input
                    placeholder="ip_ou_dominio"
                    value={newInstance.proxyHost}
                    onChange={(e) =>
                      setNewInstance((prev) => ({ ...prev, proxyHost: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Porta</Label>
                  <Input
                    placeholder="80"
                    type="number"
                    value={newInstance.proxyPort}
                    onChange={(e) =>
                      setNewInstance((prev) => ({ ...prev, proxyPort: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Protocolo</Label>
                <Select
                  value={newInstance.proxyProtocol}
                  onValueChange={(v) =>
                    setNewInstance((prev) => ({ ...prev, proxyProtocol: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="http" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="https">HTTPS</SelectItem>
                    <SelectItem value="socks5">SOCKS5</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs">Usuário</Label>
                  <Input
                    placeholder="opcional"
                    value={newInstance.proxyUsername}
                    onChange={(e) =>
                      setNewInstance((prev) => ({
                        ...prev,
                        proxyUsername: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Senha</Label>
                  <Input
                    type="password"
                    placeholder="opcional"
                    value={newInstance.proxyPassword}
                    onChange={(e) =>
                      setNewInstance((prev) => ({
                        ...prev,
                        proxyPassword: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border/40 shrink-0 flex-col sm:flex-row gap-2 bg-muted/10">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button type="submit" className="w-full sm:w-auto">
              Criar Instância
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default NewInstanceModal
