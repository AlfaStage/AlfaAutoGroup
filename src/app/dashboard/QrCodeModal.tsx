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
import { RefreshCcw } from 'lucide-react'

export interface QrCodeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  qrCodeBase64: string
  onRefresh: () => void
}

export function QrCodeModal({
  open,
  onOpenChange,
  qrCodeBase64,
  onRefresh,
}: QrCodeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] w-[95vw] max-h-[85dvh] flex flex-col p-0 rounded-xl overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b border-border/40 shrink-0">
          <DialogTitle className="text-center">Conectar WhatsApp</DialogTitle>
          <DialogDescription className="text-center">
            Abra o WhatsApp, vá em &quot;Aparelhos Conectados&quot; e escaneie o código abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
          {qrCodeBase64 ? (
            <div className="bg-white p-4 rounded-xl shadow-lg">
              <img
                src={
                  qrCodeBase64.startsWith('data:image')
                    ? qrCodeBase64
                    : `data:image/png;base64,${qrCodeBase64}`
                }
                alt="QR Code WhatsApp"
                className="w-64 h-64"
              />
            </div>
          ) : (
            <div className="w-64 h-64 bg-muted animate-pulse rounded-xl flex items-center justify-center">
              <span className="text-muted-foreground text-sm">Gerando QR Code...</span>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-border/40 shrink-0 flex-col sm:flex-row sm:justify-center gap-2 bg-muted/10">
          <Button
            variant="outline"
            onClick={onRefresh}
            className="w-full sm:w-auto"
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default QrCodeModal
