'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { Upload, Loader2, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupIds: string[]
  onDone?: () => void
}

type LinhaPrevia = {
  groupId: string
  nomeAtual: string
  nomeNovo: string | null
  mudaNome: boolean
  mudaDescricao: boolean
  mudaFoto: boolean
  quando: string
}

function paraInputLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    + `T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function BulkEditModal({ open, onOpenChange, groupIds, onDone }: Props) {
  const [nameTemplate, setNameTemplate] = useState('')
  const [usarDescricao, setUsarDescricao] = useState(false)
  const [description, setDescription] = useState('')
  const [picture, setPicture] = useState('')
  const [spacing, setSpacing] = useState('45')
  const [startAt, setStartAt] = useState(() => paraInputLocal(new Date(Date.now() + 2 * 60_000)))

  const [previa, setPrevia] = useState<LinhaPrevia[] | null>(null)
  const [comMudanca, setComMudanca] = useState(0)
  const [carregandoPrevia, setCarregandoPrevia] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setPrevia(null)
    setErro('')
    setSucesso('')
  }, [open])

  const corpo = () => ({
    groupIds,
    nameTemplate: nameTemplate.trim() || undefined,
    description: usarDescricao ? description : undefined,
    picture: picture.trim() || undefined,
    spacingSeconds: Number(spacing) || 45,
    startAt: new Date(startAt).toISOString()
  })

  const verPrevia = async () => {
    setCarregandoPrevia(true)
    setErro('')
    setSucesso('')
    try {
      const res = await fetch('/api/bulk/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...corpo(), dryRun: true })
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Falha ao gerar a prévia.'); setPrevia(null); return }
      setPrevia(data.previa)
      setComMudanca(data.totalComMudanca)
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setCarregandoPrevia(false)
    }
  }

  const aplicar = async () => {
    setSalvando(true)
    setErro('')
    try {
      const res = await fetch('/api/bulk/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo())
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Falha ao agendar o lote.'); return }

      setSucesso(
        `${data.agendados} alteração(ões) agendada(s). `
        + `Começa às ${new Date(data.primeiro).toLocaleTimeString('pt-BR')} `
        + `e termina às ${new Date(data.ultimo).toLocaleTimeString('pt-BR')}.`
      )
      setPrevia(null)
      onDone?.()
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setSalvando(false)
    }
  }

  const enviarFoto = async (file: File) => {
    if (!file.type.startsWith('image/')) { setErro('Selecione um arquivo de imagem.'); return }
    if (file.size > 8 * 1024 * 1024) { setErro('A imagem precisa ter no máximo 8 MB.'); return }

    setUploading(true)
    setErro('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (res.ok && data.filename) setPicture(`/api/uploads/${data.filename}`)
      else setErro(data.error || 'Falha ao enviar a imagem.')
    } catch {
      setErro('Erro de conexão ao enviar a imagem.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar {groupIds.length} grupo(s) em massa</DialogTitle>
          <DialogDescription>
            As alterações são agendadas uma a uma, espaçadas no tempo. Deixe em
            branco o que não quer mudar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="bulk-nome">Template do nome</Label>
            <Input
              id="bulk-nome"
              maxLength={100}
              placeholder="Ex.: 🎈 Ice Laser VIP [{n}/{total}]"
              value={nameTemplate}
              onChange={e => { setNameTemplate(e.target.value); setPrevia(null) }}
            />
            <p className="text-xs text-muted-foreground">
              Variáveis: <code className="bg-muted/50 px-1 rounded">{'{n}'}</code> posição ·{' '}
              <code className="bg-muted/50 px-1 rounded">{'{nn}'}</code> com zero à esquerda ·{' '}
              <code className="bg-muted/50 px-1 rounded">{'{total}'}</code> quantidade ·{' '}
              <code className="bg-muted/50 px-1 rounded">{'{nome}'}</code> nome atual.
              Sem variável de número, todos ficam com o mesmo nome.
            </p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-primary focus:ring-primary"
                checked={usarDescricao}
                onChange={e => { setUsarDescricao(e.target.checked); setPrevia(null) }}
              />
              <span className="text-sm font-medium">Trocar a descrição</span>
            </label>
            {usarDescricao && (
              <Textarea
                rows={3}
                placeholder="Descrição aplicada a todos os grupos selecionados"
                value={description}
                onChange={e => { setDescription(e.target.value); setPrevia(null) }}
                className="resize-none"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Foto (aplicada a todos)</Label>
            <div className="flex items-center gap-3">
              <Input
                placeholder="Cole uma URL, ou envie um arquivo"
                value={picture}
                onChange={e => { setPicture(e.target.value); setPrevia(null) }}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) enviarFoto(f) }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="flex-shrink-0"
              >
                {uploading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Upload className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-inicio">Começar em</Label>
              <Input
                id="bulk-inicio"
                type="datetime-local"
                value={startAt}
                onChange={e => { setStartAt(e.target.value); setPrevia(null) }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-espaco">Intervalo entre grupos (segundos)</Label>
              <Input
                id="bulk-espaco"
                type="number"
                min={10}
                value={spacing}
                onChange={e => { setSpacing(e.target.value); setPrevia(null) }}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo 10s. Intervalos curtos em muitos grupos aumentam o risco de bloqueio.
              </p>
            </div>
          </div>

          {erro && (
            <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {sucesso && (
            <div className="text-sm text-green-500 bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{sucesso}</span>
            </div>
          )}

          {previa && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Prévia</Label>
                <span className="text-xs text-muted-foreground">
                  {comMudanca} de {previa.length} grupo(s) mudam
                </span>
              </div>
              <div className="max-h-[260px] overflow-y-auto rounded-lg border border-border/50 divide-y divide-border/30">
                {previa.map(l => {
                  const muda = l.mudaNome || l.mudaDescricao || l.mudaFoto
                  return (
                    <div
                      key={l.groupId}
                      className={`p-3 text-xs ${muda ? '' : 'opacity-50'}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={l.mudaNome ? 'line-through text-muted-foreground' : ''}>
                          {l.nomeAtual}
                        </span>
                        {l.mudaNome && l.nomeNovo && (
                          <>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <span className="font-medium">{l.nomeNovo}</span>
                          </>
                        )}
                        {!muda && (
                          <span className="text-[10px] uppercase tracking-wide text-amber-500 border border-amber-500/40 rounded px-1.5 py-0.5">
                            nada muda
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-1">
                        {new Date(l.quando).toLocaleString('pt-BR')}
                        {l.mudaDescricao ? ' · descrição' : ''}
                        {l.mudaFoto ? ' · foto' : ''}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={salvando}>
            Fechar
          </Button>
          <Button variant="outline" onClick={verPrevia} disabled={carregandoPrevia || salvando}>
            {carregandoPrevia
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando…</>
              : 'Ver prévia'}
          </Button>
          <Button onClick={aplicar} disabled={salvando || !previa || comMudanca === 0}>
            {salvando
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Agendando…</>
              : `Agendar ${comMudanca || ''} alteração(ões)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
