'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import InserirVariavel from '@/components/InserirVariavel'
import {
  Sparkles,
  Send,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Plus,
  RefreshCw,
  FlaskConical,
  Upload,
  Power,
  Layers,
  ArrowUp,
  ArrowDown,
  Copy
} from 'lucide-react'

type WelcomeButtonDraft = {
  type: 'reply' | 'url' | 'copy' | 'call'
  displayText: string
  id?: string
  url?: string
  copyCode?: string
  phoneNumber?: string
}

type WelcomeBlockDraft = {
  uid: string
  type: 'text' | 'media' | 'button' | 'poll'
  text: string
  mediaUrl: string
  mediaType: 'image' | 'video' | 'audio' | 'document'
  mediaCaption: string
  fileName: string
  btnTitle: string
  btnDesc: string
  btnFooter: string
  btnImageUrl: string
  buttonsList: WelcomeButtonDraft[]
  pollName: string
  pollCount: number
  pollOptions: string[]
}

const MAX_BLOCKS = 8

function criarBlocoPadrao(partial?: Partial<WelcomeBlockDraft>): WelcomeBlockDraft {
  return {
    uid: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'text',
    text: 'Olá {primeiro_nome}! {saudacao_emoji}\n\nSeja muito bem-vindo(a) ao *{grupo}*!\nAqui está seu acesso exclusivo:',
    mediaUrl: '',
    mediaType: 'image',
    mediaCaption: '',
    fileName: '',
    btnTitle: 'Bem-vindo(a) ao {grupo}! 🎉',
    btnDesc: 'Olá {primeiro_nome}, aproveite sua oferta exclusiva de boas-vindas abaixo:',
    btnFooter: 'Equipe {tag}',
    btnImageUrl: '',
    buttonsList: [{ type: 'url', displayText: 'Acessar Oferta', url: 'https://' }],
    pollName: 'Olá {primeiro_nome}! Qual seu principal interesse no {grupo}?',
    pollCount: 1,
    pollOptions: ['Ofertas VIP', 'Conteúdos Exclusivos'],
    ...partial
  }
}

function hidratarBlocoDeApi(blkType: string, c: any): WelcomeBlockDraft {
  const safeType = (['text', 'media', 'button', 'poll'].includes(blkType) ? blkType : 'text') as
    | 'text'
    | 'media'
    | 'button'
    | 'poll'

  return criarBlocoPadrao({
    type: safeType,
    text: c?.text || '',
    mediaUrl: c?.media || '',
    mediaType: c?.mediatype || 'image',
    mediaCaption: c?.caption || '',
    fileName: c?.fileName || '',
    btnTitle: c?.title || '',
    btnDesc: c?.description || '',
    btnFooter: c?.footer || '',
    btnImageUrl: c?.imageUrl || '',
    buttonsList:
      Array.isArray(c?.buttons) && c.buttons.length > 0
        ? c.buttons.map((b: any) => ({
            type: b.type || 'url',
            displayText: b.displayText || '',
            id: b.id || '',
            url: b.url || '',
            copyCode: b.copyCode || '',
            phoneNumber: b.phoneNumber || ''
          }))
        : [{ type: 'url', displayText: 'Acessar', url: 'https://' }],
    pollName: c?.name || '',
    pollCount: Number(c?.selectableCount || 1),
    pollOptions:
      Array.isArray(c?.values) && c.values.length >= 2 ? c.values : ['Opção 1', 'Opção 2']
  })
}

function serializarBlocoParaApi(blk: WelcomeBlockDraft): { type: string; content: Record<string, any> } {
  if (blk.type === 'text') {
    return { type: 'text', content: { text: blk.text } }
  }
  if (blk.type === 'media') {
    return {
      type: 'media',
      content: {
        media: blk.mediaUrl,
        mediatype: blk.mediaType,
        caption: blk.mediaCaption,
        fileName: blk.fileName || 'boas-vindas'
      }
    }
  }
  if (blk.type === 'button') {
    return {
      type: 'button',
      content: {
        title: blk.btnTitle,
        description: blk.btnDesc,
        footer: blk.btnFooter,
        ...(blk.btnImageUrl ? { imageUrl: blk.btnImageUrl } : {}),
        buttons: blk.buttonsList.map((b, idx) => ({
          type: b.type,
          displayText: b.displayText,
          ...(b.type === 'reply' ? { id: b.id || `btn_${idx + 1}` } : {}),
          ...(b.type === 'url' ? { url: b.url || '' } : {}),
          ...(b.type === 'copy' ? { copyCode: b.copyCode || '' } : {}),
          ...(b.type === 'call' ? { phoneNumber: b.phoneNumber || '' } : {})
        }))
      }
    }
  }
  return {
    type: 'poll',
    content: {
      name: blk.pollName,
      selectableCount: Number(blk.pollCount) || 1,
      values: blk.pollOptions.map(o => o.trim()).filter(Boolean)
    }
  }
}

function resumirBloco(blk: { type: string; content: any }): string {
  const c = blk?.content || {}
  if (blk.type === 'text') return String(c.text || '').slice(0, 90)
  if (blk.type === 'media') return `[${String(c.mediatype || 'image').toUpperCase()}] ${c.caption || c.media || ''}`.slice(0, 90)
  if (blk.type === 'button') {
    const qtdBotoes = Array.isArray(c.buttons) ? c.buttons.length : 0
    return `${c.title ? `${c.title} — ` : ''}${c.description || ''} (${qtdBotoes} botão/botões)`.slice(0, 90)
  }
  if (blk.type === 'poll') return `[ENQUETE] ${c.name || ''}`.slice(0, 90)
  return ''
}

export default function PainelBoasVindas({
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
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // Estado do formulario de criacao / edicao de regra
  const [escopo, setEscopo] = useState<'tag' | 'group'>('group')
  const [groupId, setGroupId] = useState<string>('')
  const [tagId, setTagId] = useState<string>('')
  const [enabled, setEnabled] = useState<boolean>(false)
  const [trackLinks, setTrackLinks] = useState<boolean>(true)
  const [delayMinSec, setDelayMinSec] = useState<number>(45)
  const [delayMaxSec, setDelayMaxSec] = useState<number>(150)
  const [cooldownDays, setCooldownDays] = useState<number>(30)
  const [senderInstance, setSenderInstance] = useState<string>('padrao')

  // Lista de blocos de mensagem (1 bloco unico ou multiplos blocos em sequencia)
  const [blocks, setBlocks] = useState<WelcomeBlockDraft[]>(() => [criarBlocoPadrao()])

  // Estado do modal / barra de Teste Seguro
  const [regraParaTeste, setRegraParaTeste] = useState<any | null>(null)
  const [modoDestinoTeste, setModoDestinoTeste] = useState<'instancia' | 'numero'>('instancia')
  const [targetInstanceName, setTargetInstanceName] = useState<string>('')
  const [targetPhoneOrJid, setTargetPhoneOrJid] = useState<string>('')
  const [targetName, setTargetName] = useState<string>('Visitante VIP Teste')

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const res = await fetch('/api/welcome')
      if (res.ok) {
        const json = await res.json()
        setDados(json)
        if (!targetInstanceName && Array.isArray(json.instancias) && json.instancias.length > 0) {
          const conectada = json.instancias.find((i: any) => i.connected) || json.instancias[0]
          setTargetInstanceName(conectada.name)
        }
      }
    } finally {
      setCarregando(false)
    }
  }, [targetInstanceName])

  useEffect(() => {
    carregar()
  }, [carregar])

  const atualizarBloco = (uid: string, patch: Partial<WelcomeBlockDraft>) => {
    setBlocks(prev => prev.map(b => (b.uid === uid ? { ...b, ...patch } : b)))
  }

  const adicionarBloco = () => {
    if (blocks.length >= MAX_BLOCKS) {
      setAviso({ tipo: 'erro', texto: `O limite máximo é de ${MAX_BLOCKS} blocos por sequência.` })
      return
    }
    setBlocks(prev => [
      ...prev,
      criarBlocoPadrao({
        type: 'text',
        text: 'Caso tenha alguma dúvida sobre o *{grupo}*, basta responder aqui!'
      })
    ])
  }

  const duplicarBloco = (idx: number) => {
    if (blocks.length >= MAX_BLOCKS) {
      setAviso({ tipo: 'erro', texto: `O limite máximo é de ${MAX_BLOCKS} blocos por sequência.` })
      return
    }
    setBlocks(prev => {
      const orig = prev[idx]
      if (!orig) return prev
      const clone: WelcomeBlockDraft = {
        ...orig,
        uid: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        buttonsList: orig.buttonsList.map(b => ({ ...b })),
        pollOptions: [...orig.pollOptions]
      }
      const next = [...prev]
      next.splice(idx + 1, 0, clone)
      return next
    })
  }

  const removerBloco = (uid: string) => {
    setBlocks(prev => (prev.length <= 1 ? prev : prev.filter(b => b.uid !== uid)))
  }

  const moverBloco = (idx: number, direcao: -1 | 1) => {
    setBlocks(prev => {
      const targetIdx = idx + direcao
      if (targetIdx < 0 || targetIdx >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(idx, 1)
      next.splice(targetIdx, 0, item)
      return next
    })
  }

  const handleUploadArquivoBloco = async (
    uid: string,
    e: React.ChangeEvent<HTMLInputElement>,
    alvo: 'media' | 'button'
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingKey(`${uid}:${alvo}`)
    setAviso(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setAviso({ tipo: 'erro', texto: data.error || 'Falha no upload' })
        return
      }
      if (alvo === 'media') {
        atualizarBloco(uid, {
          mediaUrl: data.url || data.path,
          ...(data.mediatype ? { mediaType: data.mediatype } : {}),
          fileName: file.name
        })
      } else {
        atualizarBloco(uid, {
          btnImageUrl: data.url || data.path
        })
      }
      setAviso({ tipo: 'ok', texto: `Arquivo "${file.name}" enviado com sucesso!` })
    } catch {
      setAviso({ tipo: 'erro', texto: 'Erro de conexão ao enviar arquivo.' })
    } finally {
      setUploadingKey(null)
    }
  }

  const salvarRegra = async () => {
    setAviso(null)
    if (escopo === 'group' && !groupId) {
      setAviso({ tipo: 'erro', texto: 'Selecione o Grupo para configurar a regra.' })
      return
    }
    if (escopo === 'tag' && !tagId) {
      setAviso({ tipo: 'erro', texto: 'Selecione a Tag para configurar a regra.' })
      return
    }
    if (blocks.length === 0) {
      setAviso({ tipo: 'erro', texto: 'Adicione ao menos 1 bloco de mensagem.' })
      return
    }

    const serializedBlocks = blocks.map(serializarBlocoParaApi)
    const primary = serializedBlocks[0]

    setSalvando(true)
    try {
      const res = await fetch('/api/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          groupId: escopo === 'group' ? groupId : null,
          tagId: escopo === 'tag' ? tagId : null,
          type: primary.type,
          content: primary.content,
          blocks: serializedBlocks,
          enabled,
          trackLinks,
          delayMinSec,
          delayMaxSec,
          cooldownDays,
          senderInstance: senderInstance === 'padrao' ? null : senderInstance
        })
      })
      const json = await res.json()
      if (!res.ok) {
        setAviso({ tipo: 'erro', texto: json.error || 'Erro ao salvar regra de boas-vindas.' })
        return
      }
      setAviso({
        tipo: 'ok',
        texto: `Regra salva com sucesso (${serializedBlocks.length} ${serializedBlocks.length === 1 ? 'bloco' : 'blocos'})! ${json.linksCriados ? `${json.linksCriados} link(s) rastreável(is) gerado(s).` : ''}`
      })
      await carregar()
    } catch {
      setAviso({ tipo: 'erro', texto: 'Falha de comunicação ao salvar regra.' })
    } finally {
      setSalvando(false)
    }
  }

  const editarRegra = (r: any) => {
    setEscopo(r.escopo === 'tag' ? 'tag' : 'group')
    setGroupId(r.groupId || '')
    setTagId(r.tagId || '')
    setEnabled(Boolean(r.enabled))
    setDelayMinSec(Number(r.delayMinSec ?? 45))
    setDelayMaxSec(Number(r.delayMaxSec ?? 150))
    setCooldownDays(Number(r.cooldownDays ?? 30))
    setSenderInstance(r.senderInstance || 'padrao')

    const c = r.content || {}
    setTrackLinks(c.trackLinks !== false)

    const apiBlocks = Array.isArray(r.blocks) && r.blocks.length > 0
      ? r.blocks
      : Array.isArray(c.blocks) && c.blocks.length > 0
        ? c.blocks
        : [{ type: r.type || 'text', content: c }]

    setBlocks(
      apiBlocks.map((b: any) =>
        hidratarBlocoDeApi(b.type || r.type || 'text', b.content || b)
      )
    )

    setAviso({
      tipo: 'ok',
      texto: `Regra carregada no formulário (${apiBlocks.length} ${apiBlocks.length === 1 ? 'bloco' : 'blocos'}) para edição.`
    })
  }

  const alternarAtivacao = async (r: any, proximoEstado: boolean) => {
    setAviso(null)
    const res = await fetch('/api/welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'toggle',
        id: r.id,
        enabled: proximoEstado
      })
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok) {
      setAviso({
        tipo: 'ok',
        texto: proximoEstado
          ? 'Regra de boas-vindas ATIVADA!'
          : 'Regra de boas-vindas DESATIVADA (Modo Seguro).'
      })
      carregar()
    } else {
      setAviso({
        tipo: 'erro',
        texto: json.error || 'Não foi possível alterar o status da regra.'
      })
    }
  }

  const excluirRegra = async (id: string) => {
    setAviso(null)
    const res = await fetch('/api/welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id })
    })
    if (res.ok) {
      setAviso({ tipo: 'ok', texto: 'Regra removida com sucesso.' })
      if (regraParaTeste?.id === id) setRegraParaTeste(null)
      carregar()
    }
  }

  const dispararTesteSeguro = async () => {
    if (!regraParaTeste) return
    setTestandoId(regraParaTeste.id)
    setAviso(null)
    try {
      const payload: any = {
        action: 'test',
        ruleId: regraParaTeste.id,
        targetName
      }
      if (modoDestinoTeste === 'instancia') {
        payload.targetInstanceName = targetInstanceName
      } else {
        payload.targetPhoneOrJid = targetPhoneOrJid
      }

      const res = await fetch('/api/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok) {
        setAviso({
          tipo: 'erro',
          texto: `${json.error || 'Falha no teste'}${json.details ? ` — ${String(json.details).slice(0, 140)}` : ''}`
        })
      } else {
        const qtd = Number(json.blocksSent || 1)
        setAviso({
          tipo: 'ok',
          texto: `Teste enviado com sucesso (${qtd} ${qtd === 1 ? 'bloco' : 'blocos'}) pela instância "${json.senderInstance}" para "${json.recipient}"!`
        })
        await carregar()
      }
    } catch {
      setAviso({ tipo: 'erro', texto: 'Erro de conexão ao disparar teste.' })
    } finally {
      setTestandoId(null)
    }
  }

  const controlarFila = async (subAction: 'cancel_pending' | 'retry_errors') => {
    setAviso(null)
    const res = await fetch('/api/welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'queue_control', subAction })
    })
    const json = await res.json()
    if (res.ok) {
      setAviso({
        tipo: 'ok',
        texto: `Ação concluída na fila (${json.afetados || 0} registro(s) atualizado(s)).`
      })
      carregar()
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
  const regras = dados?.regras || []
  const fila = dados?.fila || []
  const instancias = dados?.instancias || []

  return (
    <div className="space-y-6">
      {/* Aviso de Modo de Teste Seguro */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              Proteção Anti-Disparo em Grupos Finais Ativa
            </p>
            <p className="text-amber-800/90 dark:text-amber-300/90">
              Novas regras nascem <strong>Desativadas (Modo Rascunho/Teste)</strong> por padrão. Você pode configurar{' '}
              <strong>1 mensagem única</strong> ou <strong>múltiplos blocos em sequência</strong> (cada bloco com seu formato) e validar com o{' '}
              <strong>Disparo de Teste entre Instâncias</strong>.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={carregar} disabled={carregando} className="shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${carregando ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Feedback */}
      {aviso && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm flex items-center justify-between ${
            aviso.tipo === 'ok'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
              : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}
        >
          <span>{aviso.texto}</span>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setAviso(null)}>
            Fechar
          </Button>
        </div>
      )}

      {/* KPIs Rapidos */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-3.5">
          <p className="text-xs text-muted-foreground">Regras Ativas / Total</p>
          <p className="text-xl font-bold mt-1">
            {resumo.regrasAtivas} <span className="text-sm font-normal text-muted-foreground">/ {resumo.regrasTotais}</span>
          </p>
        </Card>
        <Card className="p-3.5">
          <p className="text-xs text-muted-foreground">Pendentes na Fila</p>
          <p className="text-xl font-bold mt-1 text-amber-600">{resumo.pendentesFila}</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-xs text-muted-foreground">Boas-Vindas Hoje</p>
          <p className="text-xl font-bold mt-1 text-emerald-600">{resumo.enviadosHoje}</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-xs text-muted-foreground">Total Entregues</p>
          <p className="text-xl font-bold mt-1">{resumo.enviadosTotal}</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-xs text-muted-foreground">Erros na Fila</p>
          <p className="text-xl font-bold mt-1 text-destructive">{resumo.errosTotal}</p>
        </Card>
      </div>

      {/* Grid Principal: Construtor de Regra + Simulador/Lista */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna Esquerda: Construtor de Regra (7 cols) */}
        <Card className="lg:col-span-7">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Configurar Automação de Boas-Vindas (PV)
              </CardTitle>
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {blocks.length === 1 ? '1 Bloco de Mensagem' : `${blocks.length} Blocos em Sequência`}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Configure 1 mensagem única ou empilhe vários blocos enviados em sequência no privado quando um novo membro entrar no grupo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Escopo: Grupo vs Tag */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Escopo da Regra</Label>
                <Select value={escopo} onValueChange={(v: 'group' | 'tag') => setEscopo(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="group">Por Grupo Específico</SelectItem>
                    <SelectItem value="tag">Por Tag (Todos os grupos da Tag)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {escopo === 'group' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Selecione o Grupo</Label>
                  <Select value={groupId} onValueChange={setGroupId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um grupo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g: any) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name} ({g.instanceName})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs">Selecione a Tag</Label>
                  <Select value={tagId} onValueChange={setTagId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha uma Tag..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tags.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Instancia Remetente */}
            <div className="space-y-1.5">
              <Label className="text-xs">Instância Remetente</Label>
              <Select value={senderInstance} onValueChange={setSenderInstance}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="padrao">Automática (Mesma instância do grupo)</SelectItem>
                  {instancias.map((inst: any) => (
                    <SelectItem key={inst.name} value={inst.name}>
                      {inst.name} {inst.phone ? `(${inst.phone})` : ''} {inst.connected ? '🟢' : '🔴'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lista de Blocos de Mensagem */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Blocos da Sequência de Boas-Vindas ({blocks.length}/{MAX_BLOCKS})
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={adicionarBloco}
                  disabled={blocks.length >= MAX_BLOCKS}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Bloco de Mensagem
                </Button>
              </div>

              {blocks.map((blk, idx) => (
                <div
                  key={blk.uid}
                  className="rounded-xl border bg-muted/20 p-3.5 space-y-3 relative transition-all"
                >
                  {/* Cabecalho do Bloco */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="text-[11px]">
                        Bloco #{idx + 1}
                      </Badge>
                      <Select
                        value={blk.type}
                        onValueChange={(v: 'text' | 'media' | 'button' | 'poll') =>
                          atualizarBloco(blk.uid, { type: v })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs w-[230px] bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Texto (com Variáveis / Spintax)</SelectItem>
                          <SelectItem value="media">Mídia (Imagem, Vídeo, Áudio, PDF)</SelectItem>
                          <SelectItem value="button">Botões Interativos / CTA</SelectItem>
                          <SelectItem value="poll">Enquete Interativa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-1">
                      {blocks.length > 1 && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Subir bloco"
                            disabled={idx === 0}
                            onClick={() => moverBloco(idx, -1)}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Descer bloco"
                            disabled={idx === blocks.length - 1}
                            onClick={() => moverBloco(idx, 1)}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Duplicar bloco"
                        disabled={blocks.length >= MAX_BLOCKS}
                        onClick={() => duplicarBloco(idx)}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      {blocks.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          title="Remover bloco"
                          onClick={() => removerBloco(blk.uid)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Conteudo Especifico do Bloco */}
                  {blk.type === 'text' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Texto da Mensagem</Label>
                        <InserirVariavel
                          onInsert={token => atualizarBloco(blk.uid, { text: blk.text + token })}
                        />
                      </div>
                      <Textarea
                        rows={4}
                        value={blk.text}
                        onChange={e => atualizarBloco(blk.uid, { text: e.target.value })}
                        placeholder="Olá {primeiro_nome}! Seja bem-vindo ao {grupo}..."
                        className="bg-background"
                      />
                    </div>
                  )}

                  {blk.type === 'media' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Tipo de Mídia</Label>
                          <Select
                            value={blk.mediaType}
                            onValueChange={(v: any) => atualizarBloco(blk.uid, { mediaType: v })}
                          >
                            <SelectTrigger className="bg-background">
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
                          <Label className="text-xs">URL da Mídia ou Upload</Label>
                          <div className="flex gap-2">
                            <Input
                              value={blk.mediaUrl}
                              onChange={e => atualizarBloco(blk.uid, { mediaUrl: e.target.value })}
                              placeholder="https://... ou envie um arquivo"
                              className="bg-background"
                            />
                            <label className="cursor-pointer">
                              <input
                                type="file"
                                className="hidden"
                                onChange={e => handleUploadArquivoBloco(blk.uid, e, 'media')}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                asChild
                                disabled={uploadingKey === `${blk.uid}:media`}
                              >
                                <span>
                                  {uploadingKey === `${blk.uid}:media` ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Upload className="w-4 h-4" />
                                  )}
                                </span>
                              </Button>
                            </label>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Legenda (Caption)</Label>
                          <InserirVariavel
                            onInsert={token =>
                              atualizarBloco(blk.uid, { mediaCaption: blk.mediaCaption + token })
                            }
                          />
                        </div>
                        <Textarea
                          rows={3}
                          value={blk.mediaCaption}
                          onChange={e => atualizarBloco(blk.uid, { mediaCaption: e.target.value })}
                          placeholder="Olá {primeiro_nome}! Confira nossa promoção de boas-vindas..."
                          className="bg-background"
                        />
                      </div>
                    </div>
                  )}

                  {blk.type === 'button' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Título do Card</Label>
                          <Input
                            value={blk.btnTitle}
                            onChange={e => atualizarBloco(blk.uid, { btnTitle: e.target.value })}
                            placeholder="Bem-vindo(a) ao {grupo}!"
                            className="bg-background"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Rodapé (Opcional)</Label>
                          <Input
                            value={blk.btnFooter}
                            onChange={e => atualizarBloco(blk.uid, { btnFooter: e.target.value })}
                            placeholder="Equipe {tag}"
                            className="bg-background"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Texto Principal (Descrição)</Label>
                          <InserirVariavel
                            onInsert={token =>
                              atualizarBloco(blk.uid, { btnDesc: blk.btnDesc + token })
                            }
                          />
                        </div>
                        <Textarea
                          rows={3}
                          value={blk.btnDesc}
                          onChange={e => atualizarBloco(blk.uid, { btnDesc: e.target.value })}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Imagem de Cabeçalho (Opcional p/ botões reply)</Label>
                        <div className="flex gap-2">
                          <Input
                            value={blk.btnImageUrl}
                            onChange={e => atualizarBloco(blk.uid, { btnImageUrl: e.target.value })}
                            placeholder="URL da imagem ou upload"
                            className="bg-background"
                          />
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={e => handleUploadArquivoBloco(blk.uid, e, 'button')}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              asChild
                              disabled={uploadingKey === `${blk.uid}:button`}
                            >
                              <span>
                                {uploadingKey === `${blk.uid}:button` ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Upload className="w-4 h-4" />
                                )}
                              </span>
                            </Button>
                          </label>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Botões ({blk.buttonsList.length}/5)</Label>
                          {blk.buttonsList.length < 5 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() =>
                                atualizarBloco(blk.uid, {
                                  buttonsList: [
                                    ...blk.buttonsList,
                                    { type: 'url', displayText: 'Saiba Mais', url: 'https://' }
                                  ]
                                })
                              }
                            >
                              <Plus className="w-3 h-3 mr-1" /> Botão
                            </Button>
                          )}
                        </div>
                        {blk.buttonsList.map((btn, bIdx) => (
                          <div key={bIdx} className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-3">
                              <Select
                                value={btn.type}
                                onValueChange={(v: any) => {
                                  const clone = [...blk.buttonsList]
                                  clone[bIdx] = { ...clone[bIdx], type: v }
                                  atualizarBloco(blk.uid, { buttonsList: clone })
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs bg-background">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="url">Link (URL)</SelectItem>
                                  <SelectItem value="reply">Resposta Rápida</SelectItem>
                                  <SelectItem value="copy">Copiar Código</SelectItem>
                                  <SelectItem value="call">Ligar</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-4">
                              <Input
                                className="h-8 text-xs bg-background"
                                value={btn.displayText}
                                onChange={e => {
                                  const clone = [...blk.buttonsList]
                                  clone[bIdx] = { ...clone[bIdx], displayText: e.target.value }
                                  atualizarBloco(blk.uid, { buttonsList: clone })
                                }}
                                placeholder="Texto do botão"
                              />
                            </div>
                            <div className="col-span-4">
                              {btn.type === 'url' && (
                                <Input
                                  className="h-8 text-xs bg-background"
                                  value={btn.url || ''}
                                  onChange={e => {
                                    const clone = [...blk.buttonsList]
                                    clone[bIdx] = { ...clone[bIdx], url: e.target.value }
                                    atualizarBloco(blk.uid, { buttonsList: clone })
                                  }}
                                  placeholder="https://..."
                                />
                              )}
                              {btn.type === 'copy' && (
                                <Input
                                  className="h-8 text-xs bg-background"
                                  value={btn.copyCode || ''}
                                  onChange={e => {
                                    const clone = [...blk.buttonsList]
                                    clone[bIdx] = { ...clone[bIdx], copyCode: e.target.value }
                                    atualizarBloco(blk.uid, { buttonsList: clone })
                                  }}
                                  placeholder="CUPOM10"
                                />
                              )}
                              {btn.type === 'call' && (
                                <Input
                                  className="h-8 text-xs bg-background"
                                  value={btn.phoneNumber || ''}
                                  onChange={e => {
                                    const clone = [...blk.buttonsList]
                                    clone[bIdx] = { ...clone[bIdx], phoneNumber: e.target.value }
                                    atualizarBloco(blk.uid, { buttonsList: clone })
                                  }}
                                  placeholder="5511999999999"
                                />
                              )}
                              {btn.type === 'reply' && (
                                <Input
                                  className="h-8 text-xs bg-background"
                                  value={btn.id || `btn_${bIdx + 1}`}
                                  onChange={e => {
                                    const clone = [...blk.buttonsList]
                                    clone[bIdx] = { ...clone[bIdx], id: e.target.value }
                                    atualizarBloco(blk.uid, { buttonsList: clone })
                                  }}
                                  placeholder="ID resposta"
                                />
                              )}
                            </div>
                            <div className="col-span-1 flex justify-end">
                              {blk.buttonsList.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() =>
                                    atualizarBloco(blk.uid, {
                                      buttonsList: blk.buttonsList.filter((_, i) => i !== bIdx)
                                    })
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

                  {blk.type === 'poll' && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Pergunta da Enquete</Label>
                          <InserirVariavel
                            onInsert={token =>
                              atualizarBloco(blk.uid, { pollName: blk.pollName + token })
                            }
                          />
                        </div>
                        <Input
                          value={blk.pollName}
                          onChange={e => atualizarBloco(blk.uid, { pollName: e.target.value })}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Opções ({blk.pollOptions.length}/12)</Label>
                          {blk.pollOptions.length < 12 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() =>
                                atualizarBloco(blk.uid, {
                                  pollOptions: [
                                    ...blk.pollOptions,
                                    `Opção ${blk.pollOptions.length + 1}`
                                  ]
                                })
                              }
                            >
                              <Plus className="w-3 h-3 mr-1" /> Opção
                            </Button>
                          )}
                        </div>
                        {blk.pollOptions.map((opt, oIdx) => (
                          <div key={oIdx} className="flex gap-2">
                            <Input
                              className="h-8 text-xs bg-background"
                              value={opt}
                              onChange={e => {
                                const clone = [...blk.pollOptions]
                                clone[oIdx] = e.target.value
                                atualizarBloco(blk.uid, { pollOptions: clone })
                              }}
                            />
                            {blk.pollOptions.length > 2 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() =>
                                  atualizarBloco(blk.uid, {
                                    pollOptions: blk.pollOptions.filter((_, i) => i !== oIdx)
                                  })
                                }
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {blocks.length < MAX_BLOCKS && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed text-xs h-9"
                  onClick={adicionarBloco}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Adicionar Outro Bloco de Mensagem na Sequência ({blocks.length}/{MAX_BLOCKS})
                </Button>
              )}
            </div>

            {/* Configuracoes Anti-Ban e Rastreamento */}
            <div className="grid grid-cols-3 gap-3 pt-2 border-t">
              <div className="space-y-1">
                <Label className="text-xs">Delay Mín (seg)</Label>
                <Input
                  type="number"
                  min={10}
                  value={delayMinSec}
                  onChange={e => setDelayMinSec(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Delay Máx (seg)</Label>
                <Input
                  type="number"
                  min={15}
                  value={delayMaxSec}
                  onChange={e => setDelayMaxSec(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cooldown (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  value={cooldownDays}
                  onChange={e => setCooldownDays(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Switch checked={trackLinks} onCheckedChange={setTrackLinks} />
                <span className="text-xs">Rastrear cliques nos links (`/l/...?grupid=`) em todos os blocos</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={enabled} onCheckedChange={setEnabled} />
                <span className="text-xs font-medium">
                  {enabled ? 'Regra Ativa (Dispara ao entrar)' : 'Desativada (Apenas Teste)'}
                </span>
              </div>
            </div>

            <Button onClick={salvarRegra} disabled={salvando} className="w-full">
              {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Salvar Regra de Boas-Vindas ({blocks.length} {blocks.length === 1 ? 'Bloco' : 'Blocos'})
            </Button>
          </CardContent>
        </Card>

        {/* Coluna Direita: Simulador Entre Instancias & Regras Cadastradas (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Painel de Teste Seguro Entre Instancias */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-primary" />
                Simulador Seguro (Entre Instâncias / Grupo de Teste)
              </CardTitle>
              <CardDescription className="text-xs">
                Envie a sequência de boas-vindas de uma instância conectada para outra instância ou número de teste sem tocar em grupos finais.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Regra para Testar</Label>
                <Select
                  value={regraParaTeste?.id || ''}
                  onValueChange={id => {
                    const found = regras.find((r: any) => r.id === id)
                    setRegraParaTeste(found || null)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma regra salva..." />
                  </SelectTrigger>
                  <SelectContent>
                    {regras.map((r: any) => {
                      const qtdBlocos = Array.isArray(r.blocks) ? r.blocks.length : 1
                      return (
                        <SelectItem key={r.id} value={r.id}>
                          [{r.escopo === 'tag' ? `Tag: ${r.tag?.name}` : `Grupo: ${r.grupo?.name}`}] —{' '}
                          {qtdBlocos > 1
                            ? `${qtdBlocos} blocos (${r.blocks.map((b: any) => b.type.toUpperCase()).join(' → ')})`
                            : r.type.toUpperCase()}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={modoDestinoTeste === 'instancia' ? 'default' : 'outline'}
                  onClick={() => setModoDestinoTeste('instancia')}
                  className="text-xs"
                >
                  Para Outra Instância
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={modoDestinoTeste === 'numero' ? 'default' : 'outline'}
                  onClick={() => setModoDestinoTeste('numero')}
                  className="text-xs"
                >
                  Número / Grupo de Teste
                </Button>
              </div>

              {modoDestinoTeste === 'instancia' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Instância que Receberá a Mensagem</Label>
                  <Select value={targetInstanceName} onValueChange={setTargetInstanceName}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha a instância destino..." />
                    </SelectTrigger>
                    <SelectContent>
                      {instancias.map((inst: any) => (
                        <SelectItem key={inst.name} value={inst.name}>
                          {inst.name} ({inst.phone || 'sem número'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefone ou JID de Grupo de Teste</Label>
                  <Input
                    value={targetPhoneOrJid}
                    onChange={e => setTargetPhoneOrJid(e.target.value)}
                    placeholder="Ex: 5511999999999"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Nome Simulado p/ Variável {'{nome}'}</Label>
                <Input
                  value={targetName}
                  onChange={e => setTargetName(e.target.value)}
                  placeholder="Visitante VIP Teste"
                />
              </div>

              <Button
                className="w-full"
                onClick={dispararTesteSeguro}
                disabled={!regraParaTeste || Boolean(testandoId)}
              >
                {testandoId ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Disparar Teste Agora
              </Button>
            </CardContent>
          </Card>

          {/* Lista de Regras Cadastradas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Regras Configuradas ({regras.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 max-h-[460px] overflow-y-auto">
              {regras.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Nenhuma regra configurada ainda. Crie sua primeira regra ao lado!
                </p>
              ) : (
                regras.map((r: any) => {
                  const ruleBlocks: Array<{ type: string; content: any }> =
                    Array.isArray(r.blocks) && r.blocks.length > 0
                      ? r.blocks
                      : [{ type: r.type, content: r.content }]

                  return (
                    <div
                      key={r.id}
                      className="rounded-lg border p-3 space-y-2 bg-card hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant={r.escopo === 'tag' ? 'secondary' : 'outline'} className="text-[10px]">
                              {r.escopo === 'tag' ? 'TAG' : 'GRUPO'}
                            </Badge>
                            <span className="text-xs font-semibold">
                              {r.escopo === 'tag' ? r.tag?.name : r.grupo?.name}
                            </span>
                            {ruleBlocks.length > 1 ? (
                              <Badge variant="default" className="text-[10px] uppercase">
                                {ruleBlocks.length} BLOCOS:{' '}
                                {ruleBlocks.map(b => b.type).join(' → ')}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] uppercase">
                                {r.type}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Delay: {r.delayMinSec}s–{r.delayMaxSec}s • Cooldown: {r.cooldownDays}d • Entregues:{' '}
                            {r.stats?.sent || 0}
                          </p>
                        </div>

                        <Badge variant={r.enabled ? 'default' : 'secondary'} className="text-[10px]">
                          {r.enabled ? 'Ativa' : 'Em Teste / Off'}
                        </Badge>
                      </div>

                      {/* Previa dos blocos da regra */}
                      <div className="space-y-1 rounded bg-muted/40 p-2 text-[11px] text-muted-foreground">
                        {ruleBlocks.map((b, bIdx) => (
                          <div key={bIdx} className="truncate">
                            <span className="font-semibold text-foreground/80">
                              #{bIdx + 1} [{String(b.type).toUpperCase()}]:
                            </span>{' '}
                            {resumirBloco(b)}
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t">
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => editarRegra(r)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => setRegraParaTeste(r)}
                          >
                            <FlaskConical className="w-3 h-3 mr-1" /> Testar
                          </Button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant={r.enabled ? 'secondary' : 'default'}
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => alternarAtivacao(r, !r.enabled)}
                          >
                            <Power className="w-3 h-3 mr-1" />
                            {r.enabled ? 'Desativar' : 'Ativar'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => excluirRegra(r.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Fila e Historico Recente de Boas-Vindas */}
      <Card>
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Fila e Histórico de Disparos no Privado ({fila.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Acompanhe envios agendados, testes realizados e entregas concluídas.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {resumo.errosTotal > 0 && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => controlarFila('retry_errors')}>
                Retentar Erros ({resumo.errosTotal})
              </Button>
            )}
            {resumo.pendentesFila > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs text-destructive"
                onClick={() => controlarFila('cancel_pending')}
              >
                Cancelar Pendentes ({resumo.pendentesFila})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {fila.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              Nenhum disparo de boas-vindas registrado ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">Membro / Destino</th>
                    <th className="py-2 pr-3">Grupo Origem</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Agendado / Enviado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fila.slice(0, 30).map((d: any) => (
                    <tr key={d.id}>
                      <td className="py-2 pr-3 font-medium">
                        {d.displayName || d.phone}
                        <span className="block text-[10px] text-muted-foreground">{d.phone}</span>
                      </td>
                      <td className="py-2 pr-3">
                        {d.grupoNome}
                        {d.isTest && (
                          <Badge variant="outline" className="ml-1.5 text-[9px] border-primary/40 text-primary">
                            TESTE
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 pr-3 uppercase">{d.type}</td>
                      <td className="py-2 pr-3">
                        {d.status === 'sent' && (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Enviado
                          </span>
                        )}
                        {d.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                            <Clock className="w-3.5 h-3.5" /> Na Fila
                          </span>
                        )}
                        {d.status === 'error' && (
                          <span
                            className="inline-flex items-center gap-1 text-destructive font-medium"
                            title={d.errorMessage || ''}
                          >
                            <XCircle className="w-3.5 h-3.5" /> Erro
                          </span>
                        )}
                        {d.status === 'skipped' && (
                          <span className="text-muted-foreground">Ignorado ({d.errorMessage || 'Cancelado'})</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {new Date(d.sentAt || d.scheduledAt).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
