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
import { Label } from '@/components/ui/label'

export interface CopyScheduleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedules: any[]
  selectedForCopy: string[]
  toggleSelectForCopy: (id: string) => void
  onCopy: () => Promise<void>
}

export function CopyScheduleModal({
  open,
  onOpenChange,
  schedules,
  selectedForCopy,
  toggleSelectForCopy,
  onCopy,
}: CopyScheduleModalProps) {
  const pendingSchedules = schedules.filter((s: any) => s.status === 'pending')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[85dvh] flex flex-col p-0 rounded-xl overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b border-border/40 shrink-0">
          <DialogTitle>Copiar Agendamentos</DialogTitle>
          <DialogDescription>
            Selecione os agendamentos pendentes que deseja copiar para colar em outro grupo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-2">
          {pendingSchedules.map((s: any) => {
            let content: any = {}
            try {
              content = typeof s.content === 'string' ? JSON.parse(s.content) : s.content || {}
            } catch (e) {
              content = {}
            }

            return (
              <div
                key={s.id}
                className="flex items-center space-x-3 border border-border/50 p-3 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <input
                  type="checkbox"
                  id={`copy-${s.id}`}
                  checked={selectedForCopy.includes(s.id)}
                  onChange={() => toggleSelectForCopy(s.id)}
                  className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer"
                />
                <Label htmlFor={`copy-${s.id}`} className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {s.type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.adjustedAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-sm font-medium">
                    {s.type === 'text' &&
                      (content.text?.substring(0, 60) +
                        (content.text?.length > 60 ? '...' : ''))}
                    {s.type === 'media' &&
                      `[Mídia] ${content.caption || 'Sem legenda'}`}
                    {s.type === 'button' && `[Botões] ${content.title}`}
                    {s.type === 'poll' && `[Enquete] ${content.name}`}
                  </p>
                </Label>
              </div>
            )
          })}
          {pendingSchedules.length === 0 && (
            <p className="text-sm text-center text-muted-foreground py-6 border border-dashed rounded-lg bg-muted/10">
              Nenhum agendamento pendente para copiar.
            </p>
          )}
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
          <Button
            onClick={onCopy}
            disabled={selectedForCopy.length === 0}
            className="w-full sm:w-auto"
          >
            Copiar Selecionados ({selectedForCopy.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CopyScheduleModal
