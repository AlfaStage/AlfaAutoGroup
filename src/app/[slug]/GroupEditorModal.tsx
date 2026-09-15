'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { Upload, Loader2, ImageIcon } from 'lucide-react'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string
  instanceName?: string | null
  evolutionGroupId?: string | null
  currentName: string
  currentDescription: string
  currentPicture?: string | null
  onDone?: () => void
}

export default function GroupEditorModal({
  open, onOpenChange, groupId, instanceName, evolutionGroupId,
  currentName, currentDescription, currentPicture, onDone
}: Props) {
  const [name, setName] = useState(currentName)
  const [description, setDescription] = useState(currentDescription || '')
  const [pictureUrl, setPictureUrl] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro' | 'info'; texto: string } | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setName(currentName)
    setDescription(currentDescription || '')
    setPictureUrl(null)
    setPreview(null)
    setFeedback(null)
  }, [open, currentName, currentDescription])

  const fotoAtual = currentPicture
    || (instanceName && evolutionGroupId
      ? `/api/instances/${instanceName}/avatar?jid=${evolutionGroupId}`
      : null)

  const escolherArquivo = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setFeedback({ tipo: 'erro', texto: 'Selecione um arquivo de imagem.' })
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setFeedback({ tipo: 'erro', texto: 'A imagem precisa ter no máximo 8 MB.' })
      return
    }

    setPreview(URL.createObjectURL(file))
    setUploading(true)
    setFeedback(null)

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok || !data.filename) {
        setFeedback({ tipo: 'erro', texto: data.error || 'Falha ao enviar a imagem.' })
        setPreview(null)
        return
      }
      // Caminho relativo: o servidor lê o arquivo do disco na hora de aplicar.
      setPictureUrl(`/api/uploads/${data.filename}`)
    } catch (e) {
      setFeedback({ tipo: 'erro', texto: 'Erro de conexão ao enviar a imagem.' })
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }

  const mudouNome = name.trim() !== currentName
  const mudouDesc = description !== (currentDescription || '')
  const temAlgo = mudouNome || mudouDesc || Boolean(pictureUrl)

  const salvar = async () => {
    if (!temAlgo) {
      setFeedback({ tipo: 'info', texto: 'Nada foi alterado.' })
      return
    }

    setSaving(true)
    setFeedback(null)

    const payload: Record<string, string> = {}
    if (mudouNome) payload.name = name.trim()
    if (mudouDesc) payload.description = description
    if (pictureUrl) payload.picture = pictureUrl

    try {
      const res = await fetch(`/api/groups/${groupId}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      if (!res.ok) {
        setFeedback({ tipo: 'erro', texto: data.error || 'Falha ao aplicar.' })
        return
      }

      if (data.status === 'skipped') {
        setFeedback({ tipo: 'info', texto: data.message })
      } else {
        setFeedback({ tipo: 'ok', texto: data.message || 'Alterado com sucesso.' })
        onDone?.()
        setTimeout(() => window.location.reload(), 1200)
      }
    } catch (e) {
      setFeedback({ tipo: 'erro', texto: 'Erro de conexão.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar grupo</DialogTitle>
          <DialogDescription>
            Nome, descrição e foto num lugar só. Só o que você preencher é alterado.
            Para agendar a troca, use "Novo agendamento" na aba Agenda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Foto */}
          <div className="space-y-2">
            <Label>Foto do grupo</Label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted/40 border border-border/50 flex items-center justify-center flex-shrink-0">
                {preview || fotoAtual ? (
                  <img
                    src={preview || fotoAtual || ''}
                    alt="Foto do grupo"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
                  />
                ) : (
                  <ImageIcon className="w-7 h-7 text-muted-foreground" />
                )}
              </div>

              <div className="space-y-2 min-w-0">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) escolherArquivo(f)
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando…</>
                    : <><Upload className="w-4 h-4 mr-2" /> Escolher do computador</>}
                </Button>
                <p className="text-xs text-muted-foreground">
                  JPG ou PNG, até 8 MB. O WhatsApp recorta em quadrado.
                </p>
              </div>
            </div>
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="grupo-nome">Nome</Label>
            <Input
              id="grupo-nome"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do grupo"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="grupo-desc">Descrição</Label>
            <Textarea
              id="grupo-desc"
              value={description}
              rows={4}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição exibida no grupo"
            />
          </div>

          {feedback && (
            <div className={
              'text-sm rounded-lg p-3 border '
              + (feedback.tipo === 'ok' ? 'border-green-500/40 text-green-500 bg-green-500/5'
                : feedback.tipo === 'erro' ? 'border-red-500/40 text-red-500 bg-red-500/5'
                : 'border-border/60 text-muted-foreground bg-muted/20')
            }>
              {feedback.texto}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Fechar
          </Button>
          <Button onClick={salvar} disabled={saving || uploading || !temAlgo}>
            {saving
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando…</>
              : 'Aplicar agora'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
