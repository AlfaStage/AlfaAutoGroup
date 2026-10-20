'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { InserirVariavel } from '@/components/InserirVariavel'
import {
  Sparkles,
  Power,
  Send,
  Trash2,
  Edit3,
  RefreshCw,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  Upload,
  FlaskConical,
  Tag as TagIcon,
  Users
} from 'lucide-react'

type WelcomeButtonItem = {
  type: 'reply' | 'url'
  displayText: string
  id?: string
  url?: string
  track?: boolean
}

export function PainelBoasVindas({
  groups = [],
  tags = []
}: {
  groups?: any[]
  tags?: any[]
}) {
  const [dados, setDados] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [testandoId, setTestandoId] = useState<string | null>(null)
  const [fazendoUpload, setFazendoUpload] = useState(false)

  // Estado do formulário de criação/edição de regra
  const [escopo, setEscopo] = useState<'tag' | 'group'>('tag')
  const [targetGroupId, setTargetGroupId] = useState<string>('')
  const [targetTagId, setTargetTagId] = useState<string>('')
  const [type, setType] = useState<'text' | 'media' | 'button' | 'poll'>('text')
  const [enabled, setEnabled] = useState<boolean>(false)
  const [trackLinks, setTrackLinks] = useState<boolean>(true)
  const [delayMinSec, setDelayMinSec] = useState<number>(45)
  const [delayMaxSec, setDelayMaxSec] = useState<number>(150)
  const [cooldownDays, setCooldownDays] = useState<number>(30)
  const [senderInstance, setSenderInstance] = useState<string>('padrao')

  // Campos de conteúdo conforme tipo
  const [text, setText] = useState<string>(
    '{Olá|Oi|Seja muito bem-vindo(a)} {primeiro_nome}! 👋\n\nVocê acabou de entrar no grupo *{grupo}* ({tag}).\nConfira nossa condição especial de boas-vindas:'
  )
  const [mediaUrl, setMediaUrl] = useState<string>('')
  const [mediatype, setMediatype] = useState<string>('image')
  const [fileName, setFileName] = useState<string>('')
  const [caption, setCaption] = useState<string>(
    '{Olá|Oi} {primeiro_nome}! Seja bem-vindo(a) ao *{grupo}*!'
  )
  const [btnTitle, setBtnTitle] = useState<string>('Bem-vindo(a) ao {grupo}!')
  const [btnDesc, setBtnDesc] = useState<string>(
    '{Olá|Oi} {primeiro_nome}, preparamos um presente exclusivo para novos membros da {cidade}:'
  )
  const [btnFooter, setBtnFooter] = useState<string>('Oferta exclusiva de boas-vindas')
  const [buttonsList, setButtonsList] = useState<WelcomeButtonItem[]>([
    { type: 'url', displayText: 'Resgatar Promoção', url: 'https://', track: true }
  ])
  const [pollName, setPollName] = useState<string>(
    'Olá {primeiro_nome}! O que você mais busca no {grupo}?'
  )
  const [pollOptions, setPollOptions] = useState<string>('Promoções, Novidades, Atendimento VIP')

  // Destino para o teste seguro entre instâncias
  const [instanciaDestinoTeste, setInstanciaDestinoTeste] = useState<string>('')
  const [telefoneTesteManual, setTelefoneTesteManual] = useState<string>('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const res = await fetch('/api/welcome')
      if (res.ok) {
        const json = await res.json()
        setDados(json)
        if (!instanciaDestinoTeste && json.instancias?.length > 0) {
          setInstanciaDestinoTeste(json.instancias[0].name)
        }
      }
    } catch (e) {
      console.error('Erro ao carregar boas-vindas:', e)
    } finally {
      setCarregando(false)
    }
  }, [instanciaDestinoTeste])

  useEffect(() => {
    carregar()
  }, [carregar])

  const handleUploadArquivo = async (file: File) => {
    setFazendoUpload(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok && data.url) {
        setMediaUrl(data.url)
        if (data.mediatype) setMediatype(data.mediatype)
        if (data.filename) setFileName(data.filename)
      } else {
        alert(data.error || 'Erro ao enviar arquivo')
      }
    } catch {
      alert('Falha no upload do arquivo')
    } finally {
      setFazendoUpload(false)
    }
  }

  const montarContent = () => {
    if (type === 'text') {
      return { text, trackLinks }
    }
    if (type === 'media') {
      return {
        media: mediaUrl,
        mediatype,
        caption,
        fileName: fileName || 'arquivo',
        trackLinks
      }
    }
    if (type === 'button') {
      const contentObj: any = {
        title: btnTitle,
        description: btnDesc,
        footer: btnFooter,
        buttons: buttonsList.map((b, idx) => ({
          type: b.type,
          displayText: b.displayText,
          id: b.id || `btn_${idx + 1}`,
          ...(b.type === 'url' ? { url: b.url, track: b.track !== false } : {})
        }))
      }
      const hasCTA = buttonsList.some(b => b.type !== 'reply')
      if (!hasCTA && mediaUrl) {
        if (mediatype === 'video') contentObj.videoUrl = mediaUrl
        else contentObj.imageUrl = mediaUrl
      }
      return contentObj
    }
    const opts = pollOptions
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    return {
      name: pollName,
      selectableCount: 1,
      values: opts.length >= 2 ? opts : ['Sim', 'Não']
    }
  }

  const salvarRegra = async () => {
    if (escopo === 'tag' && !targetTagId) {
      alert('Selecione uma Tag para vincular a regra de boas-vindas.')
      return
    }
    if (escopo === 'group' && !targetGroupId) {
      alert('Selecione um Grupo para vincular a regra de boas-vindas.')
      return
    }

    setSalvando(true)
    try {
      const payload = {
        action: 'upsert',
        ...(escopo === 'tag' ? { tagId: targetTagId } : { groupId: targetGroupId }),
        type,
        content: montarContent(),
        enabled,
        trackLinks,
        delayMinSec: Number(delayMinSec) || 45,
        delayMaxSec: Number(delayMaxSec) || 150,
        cooldownDays: Number(cooldownDays) || 30,
        senderInstance: senderInstance === 'padrao' ? null : senderInstance
      }

      const res = await fetch('/api/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok) {
        alert(json.error || 'Erro ao salvar regra de boas-vindas')
        return
      }
      await carregar()
      alert('Regra de boas-vindas salva com sucesso!')
    } catch {
      alert('Erro de conexão ao salvar regra')
    } finally {
      setSalvando(false)
    }
  }

  const editarRegra = (regra: any) => {
    if (regra.tagId) {
      setEscopo('tag')
      setTargetTagId(regra.tagId)
      setTargetGroupId('')
    } else {
      setEscopo('group')
      setTargetGroupId(regra.groupId || '')
      setTargetTagId('')
    }
    setType(regra.type || 'text')
    setEnabled(Boolean(regra.enabled))
    setDelayMinSec(regra.delayMinSec ?? 45)
    setDelayMaxSec(regra.delayMaxSec ?? 150)
    setCooldownDays(regra.cooldownDays ?? 30)
    setSenderInstance(regra.senderInstance || 'padrao')

    const c = regra.content || {}
    if (regra.type === 'text') {
      setText(c.text || '')
    } else if (regra.type === 'media') {
      setMediaUrl(c.media || '')
      setMediatype(c.mediatype || 'image')
      setCaption(c.caption || '')
      setFileName(c.fileName || '')
    } else if (regra.type === 'button') {
      setBtnTitle(c.title || '')
      setBtnDesc(c.description || '')
      setBtnFooter(c.footer || '')
      setMediaUrl(c.imageUrl || c.videoUrl || '')
      setMediatype(c.videoUrl ? 'video' : 'image')
      if (Array.isArray(c.buttons) && c.buttons.length > 0) {
        setButtonsList(c.buttons)
      }
    } else if (regra.type === 'poll') {
      setPollName(c.name || '')
      setPollOptions(Array.isArray(c.values) ? c.values.join(', ') : '')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const alternarStatusRegra = async (regra: any) => {
    try {
      const res = await fetch('/api/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle',
          id: regra.id,
          enabled: !regra.enabled
        })
      })
      if (res.ok) await carregar()
    } catch {
      alert('Erro ao alterar status da regra')
    }
  }

  const excluirRegra = async (regra: any) => {
    if (!confirm('Deseja realmente excluir esta regra de boas-vindas e limpar sua fila?')) return
    try {
      const res = await fetch('/api/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: regra.id })
      })
      if (res.ok) await carregar()
    } catch {
      alert('Erro ao excluir regra')
    }
  }

  const dispararTesteEntreInstancias = async (regra: any) => {
    if (!instanciaDestinoTeste && !telefoneTesteManual.trim()) {
      alert('Selecione uma instância conectada de destino ou informe um número de teste.')
      return
    }
    setTestandoId(regra.id)
    try {
      const payload: any = {
        action: 'test',
        ruleId: regra.id,
        targetName: 'Teste Entre Instâncias'
      }
      if (telefoneTesteManual.trim()) {
        payload.targetPhoneOrJid = telefoneTesteManual.trim()
      } else {
        payload.targetInstanceName = instanciaDestinoTeste
      }

      const res = await fetch('/api/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        alert(json.error || 'Falha no envio de teste')
      } else {
        alert(
          `Teste enviado com sucesso!\nRemetente: ${json.senderInstance}\nDestino: ${json.recipient}`
        )
      }
      await carregar()
    } catch {
      alert('Erro ao executar disparo de teste')
    } finally {
      setTestandoId(null)
    }
  }

  const controlarFila = async (subAction: 'cancel_pending' | 'retry_errors') => {
    try {
      const res = await fetch('/api/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'queue_control', subAction })
      })
      const json = await res.json()
      if (res.ok) {
        alert(`Ação concluída (${json.afetados || 0} registro(s) atualizado(s)).`)
        await carregar()
      }
    } catch {
      alert('Erro ao controlar fila de boas-vindas')
    }
  }

  const resumo = dados?.resumo || {
    regrasAtivas: 0,
    regrasTotais: 0,
    pendentesFila: 0,
    enviadosHoje: 0,
    enviadosTotal: 0,
    errosTotal: 0
  }
  const regras: any[] = dados?.regras || []
  const fila: any[] = dados?.fila || []
  const instancias: any[] = dados?.instancias || []

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border/40 bg-card/40">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Regras Ativas</p>
            <p className="text-2xl font-bold text-emerald-400">
              {resumo.regrasAtivas}{' '}
              <span className="text-sm font-normal text-muted-foreground">
                / {resumo.regrasTotais}
              </span>
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/40">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Na Fila (Delay Anti-Ban)
            </p>
            <p className="text-2xl font-bold text-amber-400">{resumo.pendentesFila}</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/40">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Enviados Hoje / Total
            </p>
            <p className="text-2xl font-bold text-primary">
              {resumo.enviadosHoje}{' '}
              <span className="text-sm font-normal text-muted-foreground">
                / {resumo.enviadosTotal}
              </span>
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/40">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Falhas</p>
            <p className="text-2xl font-bold text-red-400">{resumo.errosTotal}</p>
          </CardContent>
        </Card>
      </div>

      {/* Configurador de Regra + Modo de Teste Entre Instâncias */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/40 bg-card/40">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Configurar Automação de Boas-Vindas (PV)
            </CardTitle>
            <CardDescription>
              Quando um novo membro entrar no grupo, ele receberá esta mensagem no privado com delay humanizado.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            {/* Escopo: Tag ou Grupo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Aplicar Regra por</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={escopo === 'tag' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => setEscopo('tag')}
                  >
                    <TagIcon className="w-4 h-4" /> Por Tag (Herança)
                  </Button>
                  <Button
                    type="button"
                    variant={escopo === 'group' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => setEscopo('group')}
                  >
                    <Users className="w-4 h-4" /> Por Grupo
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{escopo === 'tag' ? 'Selecione a Tag' : 'Selecione o Grupo'}</Label>
                {escopo === 'tag' ? (
                  <Select value={targetTagId} onValueChange={setTargetTagId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha uma Tag..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tags.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.groups?.length || 0} grupos)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um Grupo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g: any) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name} ({g.instanceName})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Formato da Mensagem & Instância Remetente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Formato da Mensagem</Label>
                <Select value={type} onValueChange={(v: any) => setType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto (c/ Variáveis &amp; Spintax)</SelectItem>
                    <SelectItem value="media">Mídia (Imagem, Vídeo, Áudio, PDF)</SelectItem>
                    <SelectItem value="button">Botões Interativos / CTA</SelectItem>
                    <SelectItem value="poll">Enquete Interativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Instância Remetente (Proteção de Chip)</Label>
                <Select value={senderInstance} onValueChange={setSenderInstance}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="padrao">Mesma instância do grupo</SelectItem>
                    {instancias.map((inst: any) => (
                      <SelectItem key={inst.name} value={inst.name}>
                        {inst.name} {inst.phone ? `(${inst.phone})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Conteúdo Dinâmico conforme Formato */}
            {type === 'text' && (
              <div className="space-y-2">
                <Label>Mensagem de Boas-Vindas</Label>
                <Textarea
                  rows={4}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Digite a mensagem que será enviada no privado..."
                />
                <InserirVariavel onInsert={v => setText(prev => `${prev}${v}`)} />
              </div>
            )}

            {type === 'media' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Tipo de Mídia</Label>
                    <Select value={mediatype} onValueChange={setMediatype}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">Imagem</SelectItem>
                        <SelectItem value="video">Vídeo</SelectItem>
                        <SelectItem value="audio">Áudio</SelectItem>
                        <SelectItem value="document">Documento / PDF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>URL da Mídia ou Upload</Label>
                    <div className="flex gap-2">
                      <Input
                        value={mediaUrl}
                        onChange={e => setMediaUrl(e.target.value)}
                        placeholder="https://... ou envie um arquivo"
                      />
                      <label className="cursor-pointer inline-flex items-center px-3 py-2 rounded-md border border-border bg-muted/40 hover:bg-muted text-xs font-medium shrink-0">
                        <Upload className="w-3.5 h-3.5 mr-1.5" />
                        {fazendoUpload ? 'Enviando...' : 'Upload'}
                        <input
                          type="file"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0]
                            if (f) handleUploadArquivo(f)
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Legenda (Caption)</Label>
                  <Textarea
                    rows={3}
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                  />
                  <InserirVariavel onInsert={v => setCaption(prev => `${prev}${v}`)} />
                </div>
              </div>
            )}

            {type === 'button' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Título</Label>
                    <Input value={btnTitle} onChange={e => setBtnTitle(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Rodapé (Footer)</Label>
                    <Input value={btnFooter} onChange={e => setBtnFooter(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Texto Principal (Descrição)</Label>
                  <Textarea
                    rows={3}
                    value={btnDesc}
                    onChange={e => setBtnDesc(e.target.value)}
                  />
                  <InserirVariavel onInsert={v => setBtnDesc(prev => `${prev}${v}`)} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Botões</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setButtonsList(prev => [
                          ...prev,
                          { type: 'url', displayText: 'Acessar Link', url: 'https://', track: true }
                        ])
                      }
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Botão
                    </Button>
                  </div>
                  {buttonsList.map((btn, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2.5 rounded-lg border border-border/50 bg-muted/20"
                    >
                      <div className="sm:col-span-3">
                        <Select
                          value={btn.type}
                          onValueChange={(v: 'reply' | 'url') => {
                            const next = [...buttonsList]
                            next[idx] = { ...next[idx], type: v }
                            setButtonsList(next)
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="url">Link (URL)</SelectItem>
                            <SelectItem value="reply">Resposta Rápida</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-4">
                        <Input
                          className="h-8 text-xs"
                          placeholder="Texto do botão"
                          value={btn.displayText}
                          onChange={e => {
                            const next = [...buttonsList]
                            next[idx] = { ...next[idx], displayText: e.target.value }
                            setButtonsList(next)
                          }}
                        />
                      </div>
                      <div className="sm:col-span-4">
                        {btn.type === 'url' ? (
                          <Input
                            className="h-8 text-xs"
                            placeholder="https://..."
                            value={btn.url || ''}
                            onChange={e => {
                              const next = [...buttonsList]
                              next[idx] = { ...next[idx], url: e.target.value }
                              setButtonsList(next)
                            }}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground px-2">Botão de resposta</span>
                        )}
                      </div>
                      <div className="sm:col-span-1 flex justify-end">
                        {buttonsList.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-400"
                            onClick={() =>
                              setButtonsList(prev => prev.filter((_, i) => i !== idx))
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {type === 'poll' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Pergunta da Enquete</Label>
                  <Input value={pollName} onChange={e => setPollName(e.target.value)} />
                  <InserirVariavel onInsert={v => setPollName(prev => `${prev}${v}`)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Opções (separadas por vírgula)</Label>
                  <Input value={pollOptions} onChange={e => setPollOptions(e.target.value)} />
                </div>
              </div>
            )}

            {/* Parâmetros Anti-Ban */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/40">
              <div className="space-y-1">
                <Label className="text-xs">Delay Mínimo (segundos)</Label>
                <Input
                  type="number"
                  min={10}
                  value={delayMinSec}
                  onChange={e => setDelayMinSec(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Delay Máximo (segundos)</Label>
                <Input
                  type="number"
                  min={15}
                  value={delayMaxSec}
                  onChange={e => setDelayMaxSec(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cooldown Anti-Repetição (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  value={cooldownDays}
                  onChange={e => setCooldownDays(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trackLinks}
                    onChange={e => setTrackLinks(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span>Encurtar links c/ ?grupid= curto e UTMs</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={e => setEnabled(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="font-medium text-amber-300">
                    Ativar imediatamente nos grupos (desmarque para apenas testar antes)
                  </span>
                </label>
              </div>

              <Button onClick={salvarRegra} disabled={salvando} className="gap-2">
                <Sparkles className="w-4 h-4" />
                {salvando ? 'Salvando...' : 'Salvar Regra de Boas-Vindas'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card Lateral: Laboratório de Teste Seguro Entre Instâncias */}
        <Card className="border-emerald-500/30 bg-emerald-950/10">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-base flex items-center gap-2 text-emerald-400">
              <FlaskConical className="w-5 h-5" /> Teste Seguro (Entre Instâncias)
            </CardTitle>
            <CardDescription className="text-xs">
              Valide suas mensagens, mídias e botões enviando de uma instância para outra (ou grupo de teste) sem disparar em grupos finais de clientes.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Instância que Receberá o Teste</Label>
              <Select
                value={instanciaDestinoTeste}
                onValueChange={setInstanciaDestinoTeste}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha a instância destino..." />
                </SelectTrigger>
                <SelectContent>
                  {instancias.map((inst: any) => (
                    <SelectItem key={inst.name} value={inst.name}>
                      {inst.name} ({inst.phone || 'conectada'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Ou Número / JID de Grupo de Teste (opcional)
              </Label>
              <Input
                placeholder="Ex: 556299947676 (grupos finais são bloqueados)"
                value={telefoneTesteManual}
                onChange={e => setTelefoneTesteManual(e.target.value)}
              />
            </div>

            <div className="p-3 rounded-lg border border-border/50 bg-background/40 space-y-1.5 text-muted-foreground">
              <div className="flex items-center gap-1.5 text-foreground font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Travas Ativas:
              </div>
              <p>• Grupos finais de clientes são bloqueados no modo de teste.</p>
              <p>• Admins, donos de grupo e Whitelist da Equipe nunca recebem disparo automático.</p>
              <p>• Você pode testar regras mesmo com elas Desativadas (Off).</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Regras Cadastradas */}
      <Card className="border-border/40 bg-card/40">
        <CardHeader className="border-b border-border/40 pb-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Regras Configuradas (Por Tag e Por Grupo)</CardTitle>
            <CardDescription>
              Ative, desative ou dispare um teste seguro entre instâncias em qualquer regra abaixo.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={carregar} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </Button>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          {carregando && <p className="text-sm text-muted-foreground">Carregando regras...</p>}
          {!carregando && regras.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border/50 rounded-lg">
              Nenhuma regra de boas-vindas cadastrada ainda. Crie uma acima para testar!
            </div>
          )}

          {regras.map(r => (
            <div
              key={r.id}
              className="p-4 rounded-xl border border-border/50 bg-muted/20 flex flex-wrap items-center justify-between gap-4"
            >
              <div className="space-y-1 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={r.enabled ? 'default' : 'secondary'}>
                    {r.enabled ? 'ATIVA' : 'DESATIVADA (MODO SEGURO)'}
                  </Badge>
                  <Badge variant="outline">
                    {r.escopo === 'tag' ? `Tag: ${r.tag?.name || r.tagId}` : `Grupo: ${r.grupo?.name || r.groupId}`}
                  </Badge>
                  <Badge variant="outline" className="uppercase">
                    {r.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Delay: {r.delayMinSec}s–{r.delayMaxSec}s • Cooldown: {r.cooldownDays}d • Chip:{' '}
                    {r.senderInstance || 'Padrão do grupo'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {r.content?.text ||
                    r.content?.caption ||
                    r.content?.description ||
                    r.content?.name ||
                    JSON.stringify(r.content)}
                </p>
                <div className="flex items-center gap-3 text-xs pt-1">
                  <span className="text-emerald-400">Enviados: {r.stats?.sent || 0}</span>
                  <span className="text-amber-400">Na fila: {r.stats?.pending || 0}</span>
                  <span className="text-red-400">Falhas: {r.stats?.error || 0}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                  disabled={testandoId === r.id}
                  onClick={() => dispararTesteEntreInstancias(r)}
                >
                  <Send className="w-3.5 h-3.5" />
                  {testandoId === r.id ? 'Testando...' : 'Testar Entre Instâncias'}
                </Button>
                <Button
                  size="sm"
                  variant={r.enabled ? 'secondary' : 'default'}
                  className="gap-1.5"
                  onClick={() => alternarStatusRegra(r)}
                >
                  <Power className="w-3.5 h-3.5" />
                  {r.enabled ? 'Desativar' : 'Ativar'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => editarRegra(r)}>
                  <Edit3 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-400"
                  onClick={() => excluirRegra(r)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Fila e Histórico de Disparos */}
      <Card className="border-border/40 bg-card/40">
        <CardHeader className="border-b border-border/40 pb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" /> Fila &amp; Histórico de Boas-Vindas
            </CardTitle>
            <CardDescription>
              Últimos disparos automáticos e testes entre instâncias.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {resumo.pendentesFila > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => controlarFila('cancel_pending')}
              >
                Cancelar Pendentes ({resumo.pendentesFila})
              </Button>
            )}
            {resumo.errosTotal > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => controlarFila('retry_errors')}
              >
                Retentar Erros ({resumo.errosTotal})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-2">
          {fila.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum disparo registrado ainda.
            </p>
          )}
          {fila.slice(0, 30).map(item => (
            <div
              key={item.id}
              className="p-3 rounded-lg border border-border/40 bg-muted/10 flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                {item.status === 'sent' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {item.status === 'pending' && <Clock className="w-4 h-4 text-amber-400" />}
                {item.status === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
                {item.status === 'skipped' && <AlertTriangle className="w-4 h-4 text-muted-foreground" />}
                <span className="font-medium">{item.displayName || item.phone}</span>
                <span className="text-muted-foreground">({item.phone})</span>
                {item.isTest && (
                  <Badge variant="outline" className="text-emerald-400 border-emerald-500/40">
                    TESTE ENTRE INSTÂNCIAS
                  </Badge>
                )}
                <span className="text-muted-foreground">• Grupo: {item.grupoNome}</span>
                {item.instancia && (
                  <span className="text-muted-foreground">• Chip: {item.instancia}</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                {item.errorMessage && (
                  <span className="text-red-400 max-w-xs truncate">{item.errorMessage}</span>
                )}
                <span>
                  {new Date(item.sentAt || item.scheduledAt).toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
