'use client'

import React from 'react'
import Link from 'next/link'
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
import InserirVariavel from '@/components/InserirVariavel'
import { PERMISSION_GROUPS } from '@/lib/schedule-types'
import { CalendarDays, Loader2, Trash2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ScheduleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingId: string | null
  newSchedule: any
  setNewSchedule: React.Dispatch<React.SetStateAction<any>>
  isUploading: boolean
  setIsUploading: (val: boolean) => void
  uploadError: string
  setUploadError: (val: string) => void
  erroBotoes: string
  onSubmit: (e: React.FormEvent) => Promise<void>
}

export function ScheduleModal({
  open,
  onOpenChange,
  editingId,
  newSchedule,
  setNewSchedule,
  isUploading,
  setIsUploading,
  uploadError,
  setUploadError,
  erroBotoes,
  onSubmit,
}: ScheduleModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] w-[95vw] max-h-[85dvh] flex flex-col p-0 rounded-xl overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b border-border/40 shrink-0">
          <DialogTitle>
            {editingId ? 'Editar Agendamento' : 'Novo Agendamento'}
          </DialogTitle>
          <DialogDescription>
            Escolha a ação, configure os campos e o horário de execução.{' '}
            <Link
              href="/documentacao"
              target="_blank"
              className="underline hover:text-foreground"
            >
              Ver documentação do JSON
            </Link>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="space-y-2">
              <Label>Tipo de ação</Label>
              <Select
                value={newSchedule.type}
                onValueChange={(v) =>
                  setNewSchedule({ ...newSchedule, type: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Enviar texto</SelectItem>
                  <SelectItem value="media">
                    Enviar mídia (imagem, vídeo, áudio, doc)
                  </SelectItem>
                  <SelectItem value="button">
                    Enviar botões (interativo)
                  </SelectItem>
                  <SelectItem value="poll">Enviar enquete</SelectItem>
                  <SelectItem value="permission">
                    Trocar permissão do grupo
                  </SelectItem>
                  <SelectItem value="profile">
                    Editar grupo (nome, descrição, foto)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newSchedule.type === 'permission' && (
              <div className="space-y-4 border border-border/50 p-4 rounded-lg bg-muted/10">
                <p className="text-xs text-muted-foreground">
                  Escolha só as permissões que quer mudar. Na hora marcada o
                  sistema confere como o grupo está: o que já estiver assim não é
                  reaplicado.
                </p>

                {PERMISSION_GROUPS.map((par) => (
                  <div key={par.key} className="space-y-2">
                    <Label className="text-sm">{par.label}</Label>
                    <Select
                      value={newSchedule.permissions?.[par.key] || 'nao_mexer'}
                      onValueChange={(v) => {
                        const copia = { ...(newSchedule.permissions || {}) }
                        if (v === 'nao_mexer') delete copia[par.key]
                        else copia[par.key] = v
                        setNewSchedule({ ...newSchedule, permissions: copia })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nao_mexer">Não mexer</SelectItem>
                        {par.options.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}

                {(!newSchedule.permissions ||
                  Object.keys(newSchedule.permissions).length === 0) && (
                  <p className="text-xs text-amber-500">
                    Escolha ao menos uma permissão.
                  </p>
                )}
              </div>
            )}

            {newSchedule.type === 'profile' && (
              <div className="space-y-4 border border-border/50 p-4 rounded-lg bg-muted/10">
                <p className="text-xs text-muted-foreground">
                  Deixe em branco o que não quer mudar. Só os campos preenchidos
                  são alterados no grupo.
                </p>

                <div className="space-y-2">
                  <Label>Novo nome</Label>
                  <Input
                    maxLength={100}
                    placeholder="Deixe vazio para não mudar"
                    value={newSchedule.profileName || ''}
                    onChange={(e) =>
                      setNewSchedule({
                        ...newSchedule,
                        profileName: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nova descrição</Label>
                  <Textarea
                    rows={3}
                    placeholder="Deixe vazio para não mudar"
                    value={newSchedule.profileDescription || ''}
                    onChange={(e) =>
                      setNewSchedule({
                        ...newSchedule,
                        profileDescription: e.target.value,
                      })
                    }
                    className="resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nova foto</Label>
                  <Input
                    placeholder="Cole uma URL, ou envie um arquivo abaixo"
                    value={newSchedule.profilePicture || ''}
                    onChange={(e) =>
                      setNewSchedule({
                        ...newSchedule,
                        profilePicture: e.target.value,
                      })
                    }
                  />
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      id="agenda-foto"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setIsUploading(true)
                        setUploadError('')
                        try {
                          const form = new FormData()
                          form.append('file', file)
                          const res = await fetch('/api/upload', {
                            method: 'POST',
                            body: form,
                          })
                          const data = await res.json()
                          if (res.ok && data.filename) {
                            setNewSchedule((prev: any) => ({
                              ...prev,
                              profilePicture: '/api/uploads/' + data.filename,
                            }))
                          } else {
                            setUploadError(
                              data.error || 'Falha ao enviar a imagem.'
                            )
                          }
                        } catch (err) {
                          setUploadError(
                            'Erro de conexão ao enviar a imagem.'
                          )
                        } finally {
                          setIsUploading(false)
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploading}
                      onClick={() =>
                        document.getElementById('agenda-foto')?.click()
                      }
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />{' '}
                          Enviando…
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" /> Enviar do
                          computador
                        </>
                      )}
                    </Button>
                    {newSchedule.profilePicture && (
                      <img
                        src={newSchedule.profilePicture}
                        alt="Prévia"
                        className="w-10 h-10 rounded-lg object-cover border border-border/50"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    )}
                  </div>
                  {uploadError && (
                    <p className="text-xs text-red-500">{uploadError}</p>
                  )}
                </div>
              </div>
            )}

            {['text', 'media', 'button', 'poll', 'profile'].includes(
              newSchedule.type
            ) && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>
                    Nome da Campanha (Opcional — para métricas e filtro global)
                  </Label>
                  <Input
                    placeholder="Ex: Black Friday, Oferta VIP, Lançamento..."
                    value={newSchedule.campaign || ''}
                    onChange={(e) =>
                      setNewSchedule({
                        ...newSchedule,
                        campaign: e.target.value,
                      })
                    }
                  />
                </div>
                <InserirVariavel
                  compact
                  onInsert={(token) => {
                    if (newSchedule.type === 'text') {
                      setNewSchedule((prev: any) => ({
                        ...prev,
                        text: (prev.text || '') + token,
                      }))
                    } else if (newSchedule.type === 'media') {
                      setNewSchedule((prev: any) => ({
                        ...prev,
                        caption: (prev.caption || '') + token,
                      }))
                    } else if (newSchedule.type === 'button') {
                      setNewSchedule((prev: any) => ({
                        ...prev,
                        description: (prev.description || '') + token,
                      }))
                    } else if (newSchedule.type === 'poll') {
                      setNewSchedule((prev: any) => ({
                        ...prev,
                        pollName: (prev.pollName || '') + token,
                      }))
                    } else if (newSchedule.type === 'profile') {
                      setNewSchedule((prev: any) => ({
                        ...prev,
                        profileDescription:
                          (prev.profileDescription || '') + token,
                      }))
                    }
                  }}
                />
              </div>
            )}

            {newSchedule.type === 'text' && (
              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea
                  required
                  placeholder="Digite sua mensagem aqui..."
                  value={newSchedule.text || ''}
                  onChange={(e) =>
                    setNewSchedule({ ...newSchedule, text: e.target.value })
                  }
                  rows={5}
                  className="resize-none"
                />
              </div>
            )}

            {newSchedule.type === 'media' && (
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
                      setNewSchedule((prev: any) => ({
                        ...prev,
                        mediaUrl: data.url,
                      }))
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
                    value={newSchedule.mediatype || 'image'}
                    onValueChange={(v) =>
                      setNewSchedule({ ...newSchedule, mediatype: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo de mídia..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Imagem</SelectItem>
                      <SelectItem value="video">Vídeo</SelectItem>
                      <SelectItem value="audio">Áudio</SelectItem>
                      <SelectItem value="document">
                        Documento PDF/ZIP
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>URL da Mídia ou Upload</Label>
                  <div className="flex gap-2">
                    <Input
                      required
                      placeholder="https://..."
                      value={newSchedule.mediaUrl || ''}
                      onChange={(e) =>
                        setNewSchedule({
                          ...newSchedule,
                          mediaUrl: e.target.value,
                        })
                      }
                    />
                    <input
                      type="file"
                      id="mediaUploadSingle"
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
                            setNewSchedule((prev: any) => ({
                              ...prev,
                              mediaUrl: data.url,
                            }))
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
                        document.getElementById('mediaUploadSingle')?.click()
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
                    value={newSchedule.caption || ''}
                    onChange={(e) =>
                      setNewSchedule({
                        ...newSchedule,
                        caption: e.target.value,
                      })
                    }
                    rows={2}
                  />
                </div>

                {newSchedule.mediatype === 'document' && (
                  <div className="space-y-2">
                    <Label>Nome do Arquivo (Obrigatório)</Label>
                    <Input
                      required
                      placeholder="relatorio_final.pdf"
                      value={newSchedule.fileName || ''}
                      onChange={(e) =>
                        setNewSchedule({
                          ...newSchedule,
                          fileName: e.target.value,
                        })
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {newSchedule.type === 'button' && (
              <div className="space-y-4 border border-border/50 p-4 rounded-lg bg-muted/10">
                <div className="space-y-2">
                  <Label>Título Principal</Label>
                  <Input
                    required
                    placeholder="Ex: Oferta Especial!"
                    value={newSchedule.title || ''}
                    onChange={(e) =>
                      setNewSchedule({ ...newSchedule, title: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    required
                    placeholder="Detalhes da oferta..."
                    value={newSchedule.description || ''}
                    onChange={(e) =>
                      setNewSchedule({
                        ...newSchedule,
                        description: e.target.value,
                      })
                    }
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rodapé (Opcional)</Label>
                  <Input
                    placeholder="Válido até amanhã"
                    value={newSchedule.footer || ''}
                    onChange={(e) =>
                      setNewSchedule({
                        ...newSchedule,
                        footer: e.target.value,
                      })
                    }
                  />
                </div>

                {!newSchedule.buttonsList?.some(
                  (b: any) => b.type !== 'reply'
                ) && (
                  <div className="p-3 border border-border bg-background rounded-lg space-y-3">
                    <Label className="text-xs text-muted-foreground font-semibold">
                      Anexar Mídia (Opcional)
                    </Label>
                    <div className="flex gap-2">
                      <Select
                        value={newSchedule.mediatype || 'image'}
                        onValueChange={(v) =>
                          setNewSchedule({ ...newSchedule, mediatype: v })
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
                        value={newSchedule.mediaUrl || ''}
                        onChange={(e) =>
                          setNewSchedule({
                            ...newSchedule,
                            mediaUrl: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2 space-y-3">
                  <Label className="font-semibold text-sm">Botões (Max 3)</Label>
                  {(newSchedule.buttonsList || []).map(
                    (btn: any, index: number) => (
                      <div
                        key={index}
                        className="p-3 border border-border/50 bg-background rounded-lg space-y-3 relative group"
                      >
                        <div className="flex justify-between items-center">
                          <Select
                            value={btn.type || 'reply'}
                            onValueChange={(v) => {
                              const list = [...newSchedule.buttonsList]
                              list[index] = { ...btn, type: v }
                              setNewSchedule({
                                ...newSchedule,
                                buttonsList: list,
                              })
                            }}
                          >
                            <SelectTrigger className="w-[160px] h-8 border-none bg-transparent text-primary hover:bg-muted/50 font-medium focus:ring-0 px-2">
                              <SelectValue placeholder="Tipo..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="reply">
                                Resposta Rápida
                              </SelectItem>
                              <SelectItem value="url">Link Externo</SelectItem>
                              <SelectItem value="call">Ligar</SelectItem>
                              <SelectItem value="copy">Copiar Texto</SelectItem>
                            </SelectContent>
                          </Select>
                          {newSchedule.buttonsList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const list = newSchedule.buttonsList.filter(
                                  (_: any, i: number) => i !== index
                                )
                                setNewSchedule({
                                  ...newSchedule,
                                  buttonsList: list,
                                })
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
                            const list = [...newSchedule.buttonsList]
                            list[index] = {
                              ...btn,
                              displayText: e.target.value,
                            }
                            setNewSchedule({
                              ...newSchedule,
                              buttonsList: list,
                            })
                          }}
                          className="h-8"
                        />

                        {btn.type === 'reply' && (
                          <Input
                            required
                            placeholder="ID interno (ex: btn_comprar)"
                            value={btn.id || ''}
                            onChange={(e) => {
                              const list = [...newSchedule.buttonsList]
                              list[index] = { ...btn, id: e.target.value }
                              setNewSchedule({
                                ...newSchedule,
                                buttonsList: list,
                              })
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
                              const list = [...newSchedule.buttonsList]
                              list[index] = { ...btn, url: e.target.value }
                              setNewSchedule({
                                ...newSchedule,
                                buttonsList: list,
                              })
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
                              const list = [...newSchedule.buttonsList]
                              list[index] = {
                                ...btn,
                                phoneNumber: e.target.value,
                              }
                              setNewSchedule({
                                ...newSchedule,
                                buttonsList: list,
                              })
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
                              const list = [...newSchedule.buttonsList]
                              list[index] = {
                                ...btn,
                                copyCode: e.target.value,
                              }
                              setNewSchedule({
                                ...newSchedule,
                                buttonsList: list,
                              })
                            }}
                            className="h-8"
                          />
                        )}
                      </div>
                    )
                  )}
                  {newSchedule.buttonsList?.length < 3 && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-full border-dashed"
                      onClick={() => {
                        setNewSchedule({
                          ...newSchedule,
                          buttonsList: [
                            ...(newSchedule.buttonsList || []),
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

            {newSchedule.type === 'poll' && (
              <div className="space-y-4 border border-border/50 p-4 rounded-lg bg-muted/10">
                <div className="space-y-2">
                  <Label>Pergunta da Enquete</Label>
                  <Input
                    required
                    placeholder="Ex: Qual o melhor horário?"
                    value={newSchedule.pollName || ''}
                    onChange={(e) =>
                      setNewSchedule({
                        ...newSchedule,
                        pollName: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Opções (Separadas por vírgula)</Label>
                  <Input
                    required
                    placeholder="Manhã, Tarde, Noite"
                    value={newSchedule.pollOptions || ''}
                    onChange={(e) =>
                      setNewSchedule({
                        ...newSchedule,
                        pollOptions: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            )}

            {['text', 'media'].includes(newSchedule.type) && (
              <label className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/10 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
                  checked={newSchedule.trackLinks}
                  onChange={(e) =>
                    setNewSchedule({
                      ...newSchedule,
                      trackLinks: e.target.checked,
                    })
                  }
                />
                <span className="text-sm">
                  Contar cliques nos links
                  <span className="block text-xs text-muted-foreground">
                    Cada link do texto vira um endereço curto que redireciona
                    para o destino real e registra o clique.
                  </span>
                </span>
              </label>
            )}

            {['text', 'media', 'button', 'poll'].includes(newSchedule.type) && (
              <label className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/10 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
                  checked={Boolean(newSchedule.mentionAll)}
                  onChange={(e) =>
                    setNewSchedule({
                      ...newSchedule,
                      mentionAll: e.target.checked,
                    })
                  }
                />
                <span className="text-sm">
                  Marcar todos os membros
                  <span className="block text-xs text-muted-foreground">
                    Notifica todo mundo sem escrever @ de ninguém — a menção
                    fica invisível na mensagem.
                  </span>
                </span>
              </label>
            )}

            <div className="space-y-2 pt-2 border-t border-border/50 flex flex-col">
              <Label>Data e Hora do Envio</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !newSchedule.scheduledAt && 'text-muted-foreground'
                    )}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {newSchedule.scheduledAt ? (
                      new Date(newSchedule.scheduledAt).toLocaleString(
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
                      newSchedule.scheduledAt
                        ? new Date(newSchedule.scheduledAt)
                        : undefined
                    }
                    onSelect={(d) => {
                      if (d) {
                        const current = newSchedule.scheduledAt
                          ? new Date(newSchedule.scheduledAt)
                          : new Date()
                        d.setHours(current.getHours())
                        d.setMinutes(current.getMinutes())
                        const tzOffset = d.getTimezoneOffset() * 60000
                        const localISOTime = new Date(d.getTime() - tzOffset)
                          .toISOString()
                          .slice(0, 16)
                        setNewSchedule({
                          ...newSchedule,
                          scheduledAt: localISOTime,
                        })
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
                          newSchedule.scheduledAt
                            ? parseInt(
                                newSchedule.scheduledAt
                                  .split('T')[1]
                                  ?.split(':')[0] || '12',
                                10
                              )
                            : 12
                        }
                        onChange={(h) => {
                          let m = newSchedule.scheduledAt
                            ? newSchedule.scheduledAt
                                .split('T')[1]
                                ?.split(':')[1]
                            : '00'
                          if (!m) m = '00'

                          let localDate = newSchedule.scheduledAt
                            ? newSchedule.scheduledAt.split('T')[0]
                            : ''
                          if (!localDate) {
                            const today = new Date()
                            const tzOffset =
                              today.getTimezoneOffset() * 60000
                            localDate = new Date(today.getTime() - tzOffset)
                              .toISOString()
                              .split('T')[0]
                          }

                          setNewSchedule({
                            ...newSchedule,
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
                          newSchedule.scheduledAt
                            ? parseInt(
                                newSchedule.scheduledAt
                                  .split('T')[1]
                                  ?.split(':')[1] || '0',
                                10
                              )
                            : 0
                        }
                        onChange={(m) => {
                          let h = newSchedule.scheduledAt
                            ? newSchedule.scheduledAt
                                .split('T')[1]
                                ?.split(':')[0]
                            : '12'
                          if (!h) h = '12'

                          let localDate = newSchedule.scheduledAt
                            ? newSchedule.scheduledAt.split('T')[0]
                            : ''
                          if (!localDate) {
                            const today = new Date()
                            const tzOffset =
                              today.getTimezoneOffset() * 60000
                            localDate = new Date(today.getTime() - tzOffset)
                              .toISOString()
                              .split('T')[0]
                          }

                          setNewSchedule({
                            ...newSchedule,
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
              type="submit"
              className="w-full sm:w-auto"
              disabled={Boolean(erroBotoes)}
            >
              Salvar Agendamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default ScheduleModal
