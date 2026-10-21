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
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

export interface PasteScheduleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pasteText: string
  onPasteTextChange: (text: string) => void
  pasteError: string
  onSubmit: () => Promise<void>
}

export function PasteScheduleModal({
  open,
  onOpenChange,
  pasteText,
  onPasteTextChange,
  pasteError,
  onSubmit,
}: PasteScheduleModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[85dvh] flex flex-col p-0 rounded-xl overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b border-border/40 shrink-0">
          <DialogTitle>Colar Agendamentos</DialogTitle>
          <DialogDescription>
            Cole o código JSON gerado pelo botão Copiar de outro grupo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <Textarea
            value={pasteText}
            onChange={(e) => onPasteTextChange(e.target.value)}
            placeholder={
              '[\n  {\n    "type": "text",\n    "content": { ... },\n    "scheduledAt": "2026-..."\n  }\n]'
            }
            className="min-h-[200px] font-mono text-xs bg-muted/30"
          />

          {pasteError &&
          pasteError !== 'Vazio' &&
          pasteError !== 'Cole o código JSON aqui' ? (
            <div className="flex items-center text-red-500 text-sm font-medium">
              <AlertCircle className="w-4 h-4 mr-2" /> {pasteError}
            </div>
          ) : pasteError === 'Cole o código JSON aqui' || pasteError === 'Vazio' ? (
            <div className="flex items-center text-muted-foreground text-sm">
              <AlertCircle className="w-4 h-4 mr-2" /> Aguardando código JSON...
            </div>
          ) : pasteText && !pasteError ? (
            <div className="flex items-center text-green-500 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 mr-2" /> JSON Válido! Estrutura correta
              detectada.
            </div>
          ) : null}
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
            onClick={onSubmit}
            disabled={!!pasteError}
            className="w-full sm:w-auto"
          >
            Confirmar e Colar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default PasteScheduleModal
