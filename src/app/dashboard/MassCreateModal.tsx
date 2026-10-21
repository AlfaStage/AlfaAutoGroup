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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { ScrollDial } from '@/components/ScrollDial'
import SeletorDeGrupos from '@/components/SeletorDeGrupos'
import InserirVariavel from '@/components/InserirVariavel'
import {
  Plus,
  Trash2,
  Upload,
  CalendarDays,
  ClipboardPaste,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MassCreateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filteredGroups: any[]
  selectedInstance: string
  selectedGroupsForCreate: string[]
  setSelectedGroupsForCreate: React.Dispatch<React.SetStateAction<string[]>>
  campanhaMassa: string
  setCampanhaMassa: (val: string) => void
  newSchedules: any[]
  setNewSchedules: React.Dispatch<React.SetStateAction<any[]>>
  updateSchedule: (index: number, updates: any) => void
  getEmptySchedule: () => any
  isCreating: boolean
  isUploading: boolean
  setIsUploading: (val: boolean) => void
  uploadError: string
  setUploadError: (val: string) => void
  onSubmit: (e: React.FormEvent) => Promise<void>
  onPasteIntoCreate: () => Promise<void>
}

export function MassCreateModal({
  open,
  onOpenChange,
  filteredGroups,
  selectedInstance,
  selectedGroupsForCreate,
  setSelectedGroupsForCreate,
  campanhaMassa,
  setCampanhaMassa,
  newSchedules,
  setNewSchedules,
  updateSchedule,
  getEmptySchedule,
  isCreating,
  isUploading,
  setIsUploading,
  uploadError,
  setUploadError,
  onSubmit,
  onPasteIntoCreate,
}: MassCreateModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] w-[95vw] max-h-[85dvh] flex flex-col p-0 rounded-xl overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b border-border/40 shrink-0">
          <DialogTitle>Criar Agendamento em Massa</DialogTitle>
          <DialogDescription>
            Crie uma mensagem nova e selecione em quais grupos deseja agendá-la.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="space-y-1.5">
              <Label>
                Nome da Campanha (Opcional — agrupa métricas e permite pausar/adiar em lote)
              </Label>
              <Input
                placeholder="Ex: Black Friday, Oferta Relâmpago, Aquecimento..."
                value={campanhaMassa}
                onChange={(e) => setCampanhaMassa(e.target.value)}
              />
            </div>

            {newSchedules.map((schedule, index) => (
              <div
                key={index}
                className="space-y-4 border border-border/60 p-4 rounded-xl bg-card relative mb-6"
              >
                {newSchedules.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() =>
                      setNewSchedules(newSchedules.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                <div className="space-y-2 pr-8">
                  <Label>Tipo de Mensagem {index + 1}</Label>
                  <Select
                    value={schedule.type}
                    onValueChange={(v) => updateSchedule(index, { type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto Simples</SelectItem>
                      <SelectItem value="media">
                        Mídia (Imagem, Vídeo, Áudio, Doc)
                      </SelectItem>
                      <SelectItem value="button">Botões (Interativo)</SelectItem>
                      <SelectItem value="poll">Enquete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <InserirVariavel
                  compact
                  onInsert={(token) => {
                    if (schedule.type === 'text') {
                      updateSchedule(index, { text: (schedule.text || '') + token })
                    } else if (schedule.type === 'media') {
                      updateSchedule(index, {
                        caption: (schedule.caption || '') + token,
                      })
                    } else if (schedule.type === 'button') {
                      updateSchedule(index, {
                        description: (schedule.description || '') + token,
                      })
                    } else if (schedule.type === 'poll') {
                      updateSchedule(index, {
                        pollName: (schedule.pollName || '') + token,
                      })
                    }
                  }}
                />

                {schedule.type === 'text' && (
                  <div className="space-y-2">
                    <Label>Mensagem</Label>
                    <Textarea
                      required
                      placeholder="Digite sua mensagem aqui..."
                      value={schedule.text}
                      onChange={(e) =>
                        updateSchedule(index, { text: e.target.value })
                      }
                      rows={5}
                      className="resize-none"
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-4 pt-1">
                  {(schedule.type === 'text' || schedule.type === 'media') && (
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                        checked={schedule.trackLinks !== false}
                        onChange={(e) =>
                          updateSchedule(index, { trackLinks: e.target.checked })
                        }
                      />
                      <span>Rastrear cliques nos links (/l/ + ?grupid=)</span>
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                      checked={Boolean(schedule.mentionAll)}
                      onChange={(e) =>
                        updateSchedule(index, { mentionAll: e.target.checked })
                      }
                    />
                    <span>Marcar todos do grupo (mentionAll)</span>
                  </label>
                </div>

                {schedule.type === 'media' && (
                  <div
                    className="space-y-4 border border-border/50 p-4 rounded-lg bg-muted/10 transition-colors"
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.add(
                        'bg-primary/10',
                        'border-primary'
                      )
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.remove(
                        'bg-primary/10',
                        'border-primary'
                      )
                    }}
                    onDrop={async (e) => {
                      e.preventDefault()
                      e.currentTarget.classList.remove(
                        'bg-primary/10',
                        'border-primary'
                      )
                      const file = e.dataTransfer.files?.[0]
                      if (!file) return
                      setIsUploading(true)
                      setUploadError('')
                      const fd = new FormData()
                      fd.append('file', file)
                      try {
                        const res = await fetch('/api/upload', {
                          method: 'POST',
                          body: fd,
                        })
                        const data = await res.json()
                        if (res.ok && data.success) {
                          updateSchedule(index, { mediaUrl: data.url })
                        } else {
                          setUploadError(
                            data.error || 'Erro no servidor ao realizar upload.'
                          )
                        }
                      } catch (err: any) {
                        setUploadError(err.message || 'Erro na conexão.')
                      } finally {
                        setIsUploading(false)
                      }
                    }}
                  >
                    <div className="space-y-2">
                      <Label>Tipo de Mídia</Label>
                      <Select
                        value={schedule.mediatype}
                        onValueChange={(v) =>
                          updateSchedule(index, { mediatype: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Tipo de mídia..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="image">Imagem</SelectItem>
                          <SelectItem value="video">Vídeo</SelectItem>
                          <SelectItem value="audio">Áudio</SelectItem>
                          <SelectItem value="document">Documento PDF/ZIP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>URL da Mídia ou Upload</Label>
                      <div className="flex gap-2">
                        <Input
                          required
                          placeholder="https://..."
                          value={schedule.mediaUrl}
                          onChange={(e) =>
                            updateSchedule(index, { mediaUrl: e.target.value })
                          }
                        />
                        <input
                          type="file"
                          id={`mediaUploadMass-${index}`}
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return

                            setIsUploading(true)
                            setUploadError('')

                            const fd = new FormData()
                            fd.append('file', file)
                            try {
                              const res = await fetch('/api/upload', {
                                method: 'POST',
                                body: fd,
                              })
                              const data = await res.json()
                              if (res.ok && data.success) {
                                updateSchedule(index, { mediaUrl: data.url })
                              } else {
                                setUploadError(
                                  data.error ||
                                    'Erro interno no servidor ao realizar upload.'
                                )
                              }
                            } catch (err: any) {
                              setUploadError(
                                err.message || 'Erro na conexão de upload'
                              )
                            } finally {
                              setIsUploading(false)
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            document
                              .getElementById(`mediaUploadMass-${index}`)
                              ?.click()
                          }
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <span className="text-xs">⏳</span>
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      {uploadError && (
                        <p className="text-xs text-red-500 mt-1">{uploadError}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Legenda (Opcional)</Label>
                      <Textarea
                        placeholder="Legenda da mídia..."
                        value={schedule.caption}
                        onChange={(e) =>
                          updateSchedule(index, { caption: e.target.value })
                        }
                        rows={2}
                      />
                    </div>

                    {schedule.mediatype === 'document' && (
                      <div className="space-y-2">
                        <Label>Nome do Arquivo (Obrigatório)</Label>
                        <Input
                          required
                          placeholder="relatorio_final.pdf"
                          value={schedule.fileName}
                          onChange={(e) =>
                            updateSchedule(index, { fileName: e.target.value })
                          }
                        />
                      </div>
                    )}
                  </div>
                )}

                {schedule.type === 'button' && (
                  <div className="space-y-4 border border-border/50 p-4 rounded-lg bg-muted/10">
                    <div className="space-y-2">
                      <Label>Título Principal</Label>
                      <Input
                        required
                        placeholder="Ex: Oferta Especial!"
                        value={schedule.title}
                        onChange={(e) =>
                          updateSchedule(index, { title: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea
                        required
                        placeholder="Detalhes da oferta..."
                        value={schedule.description}
                        onChange={(e) =>
                          updateSchedule(index, { description: e.target.value })
                        }
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Rodapé (Opcional)</Label>
                      <Input
                        placeholder="Válido até amanhã"
                        value={schedule.footer}
                        onChange={(e) =>
                          updateSchedule(index, { footer: e.target.value })
                        }
                      />
                    </div>

                    {!schedule.buttonsList.some((b: any) => b.type !== 'reply') && (
                      <div className="p-3 border border-border bg-background rounded-lg space-y-3">
                        <Label className="text-xs text-muted-foreground font-semibold">
                          Anexar Mídia (Opcional)
                        </Label>
                        <div className="flex gap-2">
                          <Select
                            value={schedule.mediatype}
                            onValueChange={(v) =>
                              updateSchedule(index, { mediatype: v })
                            }
                          >
                            <SelectTrigger className="w-[120px]">
                              <SelectValue placeholder="Mídia..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="image">Imagem</SelectItem>
                              <SelectItem value="video">Vídeo</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="URL da Mídia"
                            value={schedule.mediaUrl}
                            onChange={(e) =>
                              updateSchedule(index, { mediaUrl: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    )}

                    <div className="pt-2 space-y-3">
                      <Label className="font-semibold text-sm">
                        Botões (Max 3)
                      </Label>
                      {schedule.buttonsList.map((btn: any, btnIndex: number) => (
                        <div
                          key={btnIndex}
                          className="p-3 border border-border/50 bg-background rounded-lg space-y-3 relative group"
                        >
                          <div className="flex justify-between items-center">
                            <Select
                              value={btn.type}
                              onValueChange={(v) => {
                                const list = [...schedule.buttonsList]
                                list[btnIndex] = { ...btn, type: v }
                                updateSchedule(index, { buttonsList: list })
                              }}
                            >
                              <SelectTrigger className="w-[160px] h-8 border-none bg-transparent text-primary hover:bg-muted/50 font-medium focus:ring-0 px-2">
                                <SelectValue placeholder="Tipo..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="reply">Resposta Rápida</SelectItem>
                                <SelectItem value="url">Link Externo</SelectItem>
                                <SelectItem value="call">Ligar</SelectItem>
                                <SelectItem value="copy">Copiar Texto</SelectItem>
                              </SelectContent>
                            </Select>
                            {schedule.buttonsList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const list = schedule.buttonsList.filter(
                                    (_: any, i: number) => i !== btnIndex
                                  )
                                  updateSchedule(index, { buttonsList: list })
                                }}
                                className="text-destructive opacity-50 hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          <Input
                            required
                            placeholder="Texto do botão (ex: Comprar)"
                            value={btn.displayText || ''}
                            onChange={(e) => {
                              const list = [...schedule.buttonsList]
                              list[btnIndex] = {
                                ...btn,
                                displayText: e.target.value,
                              }
                              updateSchedule(index, { buttonsList: list })
                            }}
                            className="h-8"
                          />

                          {btn.type === 'reply' && (
                            <Input
                              required
                              placeholder="ID interno (ex: btn_comprar)"
                              value={btn.id || ''}
                              onChange={(e) => {
                                const list = [...schedule.buttonsList]
                                list[btnIndex] = { ...btn, id: e.target.value }
                                updateSchedule(index, { buttonsList: list })
                              }}
                              className="h-8"
                            />
                          )}

                          {btn.type === 'url' && (
                            <Input
                              required
                              placeholder="https://..."
                              value={btn.url || ''}
                              onChange={(e) => {
                                const list = [...schedule.buttonsList]
                                list[btnIndex] = { ...btn, url: e.target.value }
                                updateSchedule(index, { buttonsList: list })
                              }}
                              className="h-8"
                            />
                          )}

                          {btn.type === 'call' && (
                            <Input
                              required
                              placeholder="+5511999999999"
                              value={btn.phoneNumber || ''}
                              onChange={(e) => {
                                const list = [...schedule.buttonsList]
                                list[btnIndex] = {
                                  ...btn,
                                  phoneNumber: e.target.value,
                                }
                                updateSchedule(index, { buttonsList: list })
                              }}
                              className="h-8"
                            />
                          )}

                          {btn.type === 'copy' && (
                            <Input
                              required
                              placeholder="Texto para copiar..."
                              value={btn.copyCode || ''}
                              onChange={(e) => {
                                const list = [...schedule.buttonsList]
                                list[btnIndex] = {
                                  ...btn,
                                  copyCode: e.target.value,
                                }
                                updateSchedule(index, { buttonsList: list })
                              }}
                              className="h-8"
                            />
                          )}
                        </div>
                      ))}
                      {schedule.buttonsList.length < 3 && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="w-full border-dashed"
                          onClick={() => {
                            updateSchedule(index, {
                              buttonsList: [
                                ...schedule.buttonsList,
                                {
                                  type: 'reply',
                                  displayText: '',
                                  id: 'btn' + Date.now(),
                                },
                              ],
                            })
                          }}
                        >
                          + Adicionar Botão
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {schedule.type === 'poll' && (
                  <div className="space-y-4 border border-border/50 p-4 rounded-lg bg-muted/10">
                    <div className="space-y-2">
                      <Label>Pergunta da Enquete</Label>
                      <Input
                        required
                        placeholder="Ex: Qual o melhor horário?"
                        value={schedule.pollName}
                        onChange={(e) =>
                          updateSchedule(index, { pollName: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Opções (Separadas por vírgula)</Label>
                      <Input
                        required
                        placeholder="Manhã, Tarde, Noite"
                        value={schedule.pollOptions}
                        onChange={(e) =>
                          updateSchedule(index, { pollOptions: e.target.value })
                        }
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-border/50 flex flex-col">
                  <Label>Data e Hora do Envio</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={'outline'}
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !schedule.scheduledAt && 'text-muted-foreground'
                        )}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {schedule.scheduledAt ? (
                          new Date(schedule.scheduledAt).toLocaleString(
                            'pt-BR',
                            { dateStyle: 'long', timeStyle: 'short' }
                          )
                        ) : (
                          <span>Escolha uma data e horário</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[95vw] sm:w-auto p-0 max-h-[85vh] overflow-y-auto rounded-xl"
                      align="center"
                    >
                      <Calendar
                        mode="single"
                        selected={
                          schedule.scheduledAt
                            ? new Date(schedule.scheduledAt)
                            : undefined
                        }
                        onSelect={(d) => {
                          if (d) {
                            const current = schedule.scheduledAt
                              ? new Date(schedule.scheduledAt)
                              : new Date()
                            d.setHours(current.getHours())
                            d.setMinutes(current.getMinutes())
                            const tzOffset = d.getTimezoneOffset() * 60000
                            const localISOTime = new Date(
                              d.getTime() - tzOffset
                            )
                              .toISOString()
                              .slice(0, 16)
                            updateSchedule(index, { scheduledAt: localISOTime })
                          }
                        }}
                      />
                      <div className="p-4 border-t border-border flex flex-col items-center justify-center gap-3 bg-muted/20">
                        <Label className="text-sm font-semibold w-full text-center text-muted-foreground">
                          Selecione o Horário
                        </Label>
                        <div className="flex items-center gap-4">
                          <ScrollDial
                            max={23}
                            value={
                              schedule.scheduledAt
                                ? parseInt(
                                    schedule.scheduledAt
                                      .split('T')[1]
                                      ?.split(':')[0] || '12',
                                    10
                                  )
                                : 12
                            }
                            onChange={(h) => {
                              let m = schedule.scheduledAt
                                ? schedule.scheduledAt
                                    .split('T')[1]
                                    ?.split(':')[1]
                                : '00'
                              if (!m) m = '00'

                              let localDate = schedule.scheduledAt
                                ? schedule.scheduledAt.split('T')[0]
                                : ''
                              if (!localDate) {
                                const today = new Date()
                                const tzOffset = today.getTimezoneOffset() * 60000
                                localDate = new Date(
                                  today.getTime() - tzOffset
                                )
                                  .toISOString()
                                  .split('T')[0]
                              }

                              updateSchedule(index, {
                                scheduledAt: `${localDate}T${h
                                  .toString()
                                  .padStart(2, '0')}:${m}`,
                              })
                            }}
                          />
                          <span className="text-2xl font-bold text-muted-foreground/50">
                            :
                          </span>
                          <ScrollDial
                            max={59}
                            value={
                              schedule.scheduledAt
                                ? parseInt(
                                    schedule.scheduledAt
                                      .split('T')[1]
                                      ?.split(':')[1] || '0',
                                    10
                                  )
                                : 0
                            }
                            onChange={(m) => {
                              let h = schedule.scheduledAt
                                ? schedule.scheduledAt
                                    .split('T')[1]
                                    ?.split(':')[0]
                                : '12'
                              if (!h) h = '12'

                              let localDate = schedule.scheduledAt
                                ? schedule.scheduledAt.split('T')[0]
                                : ''
                              if (!localDate) {
                                const today = new Date()
                                const tzOffset = today.getTimezoneOffset() * 60000
                                localDate = new Date(
                                  today.getTime() - tzOffset
                                )
                                  .toISOString()
                                  .split('T')[0]
                              }

                              updateSchedule(index, {
                                scheduledAt: `${localDate}T${h}:${m
                                  .toString()
                                  .padStart(2, '0')}`,
                              })
                            }}
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            ))}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full border-dashed flex-1"
                onClick={() =>
                  setNewSchedules([...newSchedules, getEmptySchedule()])
                }
              >
                <Plus className="w-4 h-4 mr-2" /> Adicionar Outra Mensagem
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full border-dashed flex-1 text-primary hover:text-primary hover:bg-primary/10 border-primary/50"
                onClick={onPasteIntoCreate}
              >
                <ClipboardPaste className="w-4 h-4 mr-2" /> Colar JSON (Área de
                Transf.)
              </Button>
            </div>

            <div className="space-y-2 pt-2">
              <Label>Grupos de destino</Label>
              <SeletorDeGrupos
                grupos={filteredGroups}
                selecionados={selectedGroupsForCreate}
                onChange={setSelectedGroupsForCreate}
                instanceName={selectedInstance}
                altura="max-h-[250px]"
              />
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border/40 shrink-0 flex-col sm:flex-row gap-2 bg-muted/10">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={selectedGroupsForCreate.length === 0 || isCreating}
            >
              {isCreating
                ? 'Agendando...'
                : `Criar ${newSchedules.length} agendamento(s) em ${selectedGroupsForCreate.length} grupo(s)`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default MassCreateModal
