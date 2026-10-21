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
import { Textarea } from '@/components/ui/textarea'
import SeletorDeGrupos from '@/components/SeletorDeGrupos'

export interface MassPasteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filteredGroups: any[]
  selectedInstance: string
  massPasteText: string
  setMassPasteText: (text: string) => void
  massPasteError: string
  setMassPasteError: (err: string) => void
  validatePastedJSON: (text: string) => string
  selectedGroupsForPaste: string[]
  setSelectedGroupsForPaste: React.Dispatch<React.SetStateAction<string[]>>
  searchTermPaste: string
  setSearchTermPaste: (term: string) => void
  isPasting: boolean
  onSubmit: () => Promise<void>
}

export function MassPasteModal({
  open,
  onOpenChange,
  filteredGroups,
  selectedInstance,
  massPasteText,
  setMassPasteText,
  massPasteError,
  setMassPasteError,
  validatePastedJSON,
  selectedGroupsForPaste,
  setSelectedGroupsForPaste,
  searchTermPaste,
  setSearchTermPaste,
  isPasting,
  onSubmit,
}: MassPasteModalProps) {
  const groupsToDisplay = filteredGroups.filter((g) =>
    g.name.toLowerCase().includes(searchTermPaste.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[85dvh] flex flex-col p-0 rounded-xl overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b border-border/40 shrink-0">
          <DialogTitle>Colar Agendamentos em Massa</DialogTitle>
          <DialogDescription>
            Cole o JSON copiado de outro grupo e selecione os grupos de destino.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="space-y-2">
            <Label>JSON dos Agendamentos</Label>
            <Textarea
              value={massPasteText}
              onChange={(e) => {
                setMassPasteText(e.target.value)
                setMassPasteError(validatePastedJSON(e.target.value))
              }}
              rows={4}
              className={massPasteError ? 'border-red-500' : ''}
              placeholder="[{...}]"
            />
            {massPasteError && (
              <p className="text-xs text-red-500 font-medium">{massPasteError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Buscar Grupo</Label>
            <Input
              placeholder="Filtrar por nome..."
              value={searchTermPaste}
              onChange={(e) => setSearchTermPaste(e.target.value)}
            />
          </div>

          <div className="space-y-2 pt-2">
            <Label>Grupos de destino</Label>
            <SeletorDeGrupos
              grupos={groupsToDisplay}
              selecionados={selectedGroupsForPaste}
              onChange={setSelectedGroupsForPaste}
              instanceName={selectedInstance}
              altura="max-h-[250px]"
            />
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-border/40 shrink-0 flex-col sm:flex-row gap-2 bg-muted/10">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
            disabled={isPasting}
          >
            Cancelar
          </Button>
          <Button
            onClick={onSubmit}
            className="w-full sm:w-auto"
            disabled={
              !!massPasteError || selectedGroupsForPaste.length === 0 || isPasting
            }
          >
            {isPasting
              ? 'Agendando...'
              : `Agendar em ${selectedGroupsForPaste.length} grupo(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default MassPasteModal
