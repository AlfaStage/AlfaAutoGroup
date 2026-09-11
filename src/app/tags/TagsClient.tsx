'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import {
  Tag as TagIcon, Plus, Users, Link2, Copy, Check, Loader2, Trash2, Settings2,
  ArrowUp, ArrowDown, AlertCircle, Sparkles
} from 'lucide-react'

type Grupo = {
  id: string
  name: string
  slug: string
  participantCount: number
  instanceName: string | null
  isFull: boolean
  inviteLink: string | null
  picture: string | null
  position: number
}

type Tag = {
  id: string
  name: string
  slug: string
  color: string
  description: string | null
  autoCreate: boolean
  capacity: number
  namePattern: string | null
  cloneSchedules: boolean
  instanceName: string | null
  inviteCode: string | null
  grupos: Grupo[]
  totalGrupos: number
  totalMembros: number
  grupoAtivo: { id: string; nome: string; membros: number } | null
  lotada: boolean
}

const CORES = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#8b5cf6', '#84cc16']

export default function TagsClient() {
  const [tags, setTags] = useState<Tag[]>([])
  const [grupos, setGrupos] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState<string | null>(null)

  const [novaAberta, setNovaAberta] = useState(false)
  const [editando, setEditando] = useState<Tag | null>(null)
  const [gerenciandoGrupos, setGerenciandoGrupos] = useState<Tag | null>(null)

  const carregar = useCallback(async () => {
    try {
      const [rt, rg] = await Promise.all([fetch('/api/tags'), fetch('/api/groups')])
      if (rt.ok) setTags(await rt.json())
      if (rg.ok) {
        const d = await rg.json()
        setGrupos(Array.isArray(d) ? d : (d.data || []))
      }
    } catch {
      setErro('Falha ao carregar.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const copiar = async (texto: string, chave: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(chave)
      setTimeout(() => setCopiado(null), 1500)
    } catch { /* clipboard bloqueado */ }
  }

  const remover = async (tag: Tag) => {
    if (!confirm(`Remover a tag "${tag.name}"? Os grupos continuam existindo.`)) return
    await fetch(`/api/tags/${tag.id}`, { method: 'DELETE' })
    carregar()
  }

  const totalMembros = tags.reduce((s, t) => s + t.totalMembros, 0)
  const lotadas = tags.filter(t => t.lotada).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border/40 bg-card/40">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Tags</p>
            <p className="text-2xl font-bold">{tags.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/40">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Grupos marcados</p>
            <p className="text-2xl font-bold">{tags.reduce((s, t) => s + t.totalGrupos, 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/40">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Membros</p>
            <p className="text-2xl font-bold text-primary">{totalMembros.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
        <Card className={`border-border/40 bg-card/40 ${lotadas ? 'border-amber-500/40' : ''}`}>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Sem vaga</p>
            <p className={`text-2xl font-bold ${lotadas ? 'text-amber-500' : ''}`}>{lotadas}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Suas tags</h2>
        <Button onClick={() => setNovaAberta(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nova tag
        </Button>
      </div>

      {erro && (
        <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{erro}</div>
      )}

      {carregando && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!carregando && tags.length === 0 && (
        <div className="py-12 text-center text-muted-foreground border border-dashed border-border/50 rounded-xl bg-muted/10">
          <TagIcon className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>Nenhuma tag ainda.</p>
          <p className="text-xs mt-1">
            Crie uma para agrupar grupos por cidade, unidade ou serviço.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {tags.map(tag => {
          const ocupacao = tag.grupoAtivo
            ? Math.min(100, Math.round((tag.grupoAtivo.membros / tag.capacity) * 100))
            : 100

          return (
            <Card key={tag.id} className="border-border/40 bg-card/40 overflow-hidden">
              <div className="h-1" style={{ backgroundColor: tag.color }} />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                      {tag.autoCreate && (
                        <span className="text-[10px] uppercase tracking-wide text-primary border border-primary/40 rounded px-1.5 py-0.5 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> auto
                        </span>
                      )}
                    </CardTitle>
                    {tag.description && (
                      <CardDescription className="mt-1">{tag.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => setGerenciandoGrupos(tag)} title="Grupos da tag">
                      <Users className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditando(tag)} title="Configurar">
                      <Settings2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remover(tag)} title="Remover">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Grupos</p>
                    <p className="font-semibold">{tag.totalGrupos}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Membros</p>
                    <p className="font-semibold">{tag.totalMembros.toLocaleString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Capacidade</p>
                    <p className="font-semibold">{tag.capacity.toLocaleString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Recebendo gente</p>
                    <p className={`font-semibold truncate ${tag.lotada ? 'text-amber-500' : ''}`}>
                      {tag.grupoAtivo ? tag.grupoAtivo.nome : 'nenhum com vaga'}
                    </p>
                  </div>
                </div>

                {tag.grupoAtivo && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Ocupação do grupo ativo</span>
                      <span>{tag.grupoAtivo.membros} / {tag.capacity}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          ocupacao > 90 ? 'bg-amber-500' : 'bg-primary'
                        }`}
                        style={{ width: `${ocupacao}%` }}
                      />
                    </div>
                  </div>
                )}

                {tag.lotada && !tag.autoCreate && (
                  <div className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      Todos os grupos desta tag estão cheios e a criação automática está
                      desligada. Quem clicar no link vai para o último grupo mesmo assim.
                    </span>
                  </div>
                )}

                {tag.inviteCode && (
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <code className="flex-1 text-xs bg-muted/60 border border-border/50 rounded px-2 py-1.5 truncate">
                      {typeof window !== 'undefined' ? window.location.origin : ''}/g/{tag.inviteCode}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copiar(`${window.location.origin}/g/${tag.inviteCode}`, tag.id)}
                      title="Copiar link de entrada"
                    >
                      {copiado === tag.id
                        ? <Check className="w-4 h-4 text-green-500" />
                        : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                )}

                {tag.grupos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tag.grupos.map((g, i) => (
                      <span
                        key={g.id}
                        className={`text-xs px-2 py-1 rounded-lg border flex items-center gap-1.5 ${
                          g.isFull
                            ? 'border-amber-500/40 bg-amber-500/5 text-amber-500'
                            : tag.grupoAtivo?.id === g.id
                              ? 'border-primary/50 bg-primary/10 text-primary'
                              : 'border-border/50 bg-muted/20 text-muted-foreground'
                        }`}
                        title={`${g.participantCount} membros`}
                      >
                        <span className="opacity-60">{i + 1}.</span>
                        <span className="truncate max-w-[180px]">{g.name}</span>
                        <span className="opacity-70">{g.participantCount}</span>
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <TagFormModal
        open={novaAberta || Boolean(editando)}
        tag={editando}
        onOpenChange={(v) => { if (!v) { setNovaAberta(false); setEditando(null) } }}
        onSaved={() => { setNovaAberta(false); setEditando(null); carregar() }}
      />

      <GruposDaTagModal
        tag={gerenciandoGrupos}
        todosGrupos={grupos}
        onOpenChange={(v) => { if (!v) setGerenciandoGrupos(null) }}
        onSaved={() => { setGerenciandoGrupos(null); carregar() }}
      />
    </div>
  )
}

// ------------------------------------------------------------ formulário

function TagFormModal({
  open, tag, onOpenChange, onSaved
}: {
  open: boolean
  tag: Tag | null
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(CORES[0])
  const [autoCreate, setAutoCreate] = useState(false)
  const [capacity, setCapacity] = useState('950')
  const [namePattern, setNamePattern] = useState('')
  const [cloneSchedules, setCloneSchedules] = useState(true)
  const [instanceName, setInstanceName] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!open) return
    setErro('')
    setName(tag?.name || '')
    setDescription(tag?.description || '')
    setColor(tag?.color || CORES[0])
    setAutoCreate(Boolean(tag?.autoCreate))
    setCapacity(String(tag?.capacity ?? 950))
    setNamePattern(tag?.namePattern || '')
    setCloneSchedules(tag?.cloneSchedules !== false)
    setInstanceName(tag?.instanceName || '')
  }, [open, tag])

  const salvar = async () => {
    setSalvando(true)
    setErro('')
    try {
      const corpo = {
        name, description, color, autoCreate,
        capacity: Number(capacity) || 950,
        namePattern: namePattern || undefined,
        cloneSchedules,
        instanceName: instanceName || undefined
      }
      const res = await fetch(tag ? `/api/tags/${tag.id}` : '/api/tags', {
        method: tag ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo)
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.error || 'Falha ao salvar.'); return }
      onSaved()
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tag ? `Configurar "${tag.name}"` : 'Nova tag'}</DialogTitle>
          <DialogDescription>
            Tags agrupam grupos parecidos e controlam a fila de entrada de pessoas novas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="tag-nome">Nome</Label>
            <Input
              id="tag-nome"
              placeholder="Ex.: Salvador, Unidade Centro, Depilação"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tag-desc">Descrição</Label>
            <Textarea
              id="tag-desc"
              rows={2}
              placeholder="Para que serve esta tag"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {CORES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${
                    color === c ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/10 p-4 space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
                checked={autoCreate}
                onChange={e => setAutoCreate(e.target.checked)}
              />
              <span className="text-sm">
                Criar o próximo grupo automaticamente
                <span className="block text-xs text-muted-foreground">
                  Quando todos os grupos da tag encherem, o sistema cria mais um e o
                  link de entrada passa a apontar para ele.
                </span>
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tag-cap">Capacidade por grupo</Label>
                <Input
                  id="tag-cap"
                  type="number"
                  min={2}
                  value={capacity}
                  onChange={e => setCapacity(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  O WhatsApp permite até 1024. Deixe uma folga.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tag-inst">Instância</Label>
                <Input
                  id="tag-inst"
                  placeholder="Ex.: IceLaser-0800"
                  value={instanceName}
                  onChange={e => setInstanceName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Vazio = usa a do último grupo da tag.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tag-padrao">Padrão do nome dos grupos novos</Label>
              <Input
                id="tag-padrao"
                placeholder="Ex.: Salvador {n}"
                value={namePattern}
                onChange={e => setNamePattern(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                <code className="bg-muted/50 px-1 rounded">{'{n}'}</code> vira a posição do
                grupo na tag. Vazio = &quot;{name || 'Nome da tag'} {'{n}'}&quot;.
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
                checked={cloneSchedules}
                onChange={e => setCloneSchedules(e.target.checked)}
              />
              <span className="text-sm">
                Copiar os agendamentos pendentes
                <span className="block text-xs text-muted-foreground">
                  O grupo novo nasce com a mesma programação do anterior.
                </span>
              </span>
            </label>
          </div>

          {erro && (
            <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{erro}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={salvando}>Fechar</Button>
          <Button onClick={salvar} disabled={salvando || !name.trim()}>
            {salvando
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando…</>
              : tag ? 'Salvar' : 'Criar tag'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// -------------------------------------------------- grupos vinculados

function GruposDaTagModal({
  tag, todosGrupos, onOpenChange, onSaved
}: {
  tag: Tag | null
  todosGrupos: any[]
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const [ordem, setOrdem] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!tag) return
    setOrdem(tag.grupos.map(g => g.id))
  }, [tag])

  if (!tag) return null

  const porId = new Map(todosGrupos.map((g: any) => [g.id, g]))
  const disponiveis = todosGrupos.filter((g: any) => !ordem.includes(g.id))

  const mover = (i: number, delta: number) => {
    const j = i + delta
    if (j < 0 || j >= ordem.length) return
    const copia = [...ordem]
    const [item] = copia.splice(i, 1)
    copia.splice(j, 0, item)
    setOrdem(copia)
  }

  const salvar = async () => {
    setSalvando(true)
    try {
      await fetch(`/api/tags/${tag.id}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupIds: ordem })
      })
      onSaved()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={Boolean(tag)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Grupos de &quot;{tag.name}&quot;</DialogTitle>
          <DialogDescription>
            A ordem define a fila: quem entra pelo link vai para o primeiro grupo
            com vaga.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label>Na tag ({ordem.length})</Label>
            {ordem.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum grupo ainda.</p>
            )}
            <div className="space-y-2">
              {ordem.map((id, i) => {
                const g = porId.get(id) || tag.grupos.find(x => x.id === id)
                if (!g) return null
                return (
                  <div key={id} className="flex items-center gap-2 p-2 rounded-lg border border-border/50 bg-muted/20">
                    <span className="text-xs text-muted-foreground w-5 text-center">{i + 1}</span>
                    <span className="flex-1 text-sm truncate">{g.name}</span>
                    <span className="text-xs text-muted-foreground">{g.participantCount ?? 0}</span>
                    <Button variant="ghost" size="icon" onClick={() => mover(i, -1)} disabled={i === 0}>
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => mover(i, 1)} disabled={i === ordem.length - 1}>
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setOrdem(ordem.filter(x => x !== id))}>
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Adicionar ({disponiveis.length} disponíveis)</Label>
            <div className="max-h-[220px] overflow-y-auto space-y-1 rounded-lg border border-border/50 p-2">
              {disponiveis.map((g: any) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setOrdem([...ordem, g.id])}
                  className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted/40 flex items-center justify-between gap-2"
                >
                  <span className="truncate">{g.name}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {g.participantCount ?? 0} · {g.instanceName}
                  </span>
                </button>
              ))}
              {disponiveis.length === 0 && (
                <p className="text-xs text-muted-foreground p-2">Todos os grupos já estão nesta tag.</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={salvando}>Fechar</Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando…</>
              : 'Salvar ordem'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
