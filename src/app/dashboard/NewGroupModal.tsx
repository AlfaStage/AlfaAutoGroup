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

export interface NewGroupModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  newGroup: {
    name: string
    slug: string
    description: string
    participants: string
    instanceName: string
  }
  setNewGroup: React.Dispatch<
    React.SetStateAction<{
      name: string
      slug: string
      description: string
      participants: string
      instanceName: string
    }>
  >
  onSubmit: (e: React.FormEvent) => Promise<void>
}

export function NewGroupModal({
  open,
  onOpenChange,
  newGroup,
  setNewGroup,
  onSubmit,
}: NewGroupModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] w-[95vw] max-h-[85dvh] flex flex-col p-0 rounded-xl overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b border-border/40 shrink-0">
          <DialogTitle>Adicionar Grupo</DialogTitle>
          <DialogDescription>
            Insira os dados do grupo que deseja monitorar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="space-y-2">
              <Label>Nome do Grupo</Label>
              <Input
                required
                placeholder="Ex: Comunidade VIP"
                value={newGroup.name}
                onChange={(e) =>
                  setNewGroup((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Slug (URL amigável)</Label>
              <Input
                required
                placeholder="comunidade-vip"
                value={newGroup.slug}
                onChange={(e) =>
                  setNewGroup((prev) => ({
                    ...prev,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição (Opcional)</Label>
              <Input
                placeholder="Descrição breve..."
                value={newGroup.description}
                onChange={(e) =>
                  setNewGroup((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Participante (DDI + DDD + Num)</Label>
              <Input
                required
                placeholder="Ex: 5511999999999"
                value={newGroup.participants}
                onChange={(e) =>
                  setNewGroup((prev) => ({
                    ...prev,
                    participants: e.target.value.replace(/\D/g, ''),
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Nome da Instância</Label>
              <Input
                required
                readOnly
                className="bg-muted"
                value={newGroup.instanceName}
                onChange={(e) =>
                  setNewGroup((prev) => ({ ...prev, instanceName: e.target.value }))
                }
              />
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
              Salvar Grupo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default NewGroupModal
