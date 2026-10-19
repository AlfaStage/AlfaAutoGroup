'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  ShieldCheck,
  AlertTriangle,
  Users,
  UserX,
  MapPin,
  Loader2,
  Plus,
  Trash2,
  RefreshCw
} from 'lucide-react'

export default function PainelAuditoriaMembros({ tagId }: { tagId?: string }) {
  const [dados, setDados] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState<'duplicados' | 'equipe' | 'ddd'>('duplicados')
  const [filtroDup, setFiltroDup] = useState<'todos' | 'mesma_tag' | 'possivel_equipe'>('todos')
  const [novoTelefoneEquipe, setNovoTelefoneEquipe] = useState('')
  const [novoRotuloEquipe, setNovoRotuloEquipe] = useState('Equipe / Suporte')
  const [processandoPhone, setProcessandoPhone] = useState<string | null>(null)
  const [processandoLote, setProcessandoLote] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const qs = tagId ? `?tagId=${encodeURIComponent(tagId)}` : ''
      const res = await fetch(`/api/members/audit${qs}`)
      if (res.ok) {
        setDados(await res.json())
      }
    } finally {
      setCarregando(false)
    }
  }, [tagId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const protegerNaEquipe = async (phone: string, label = 'Equipe (Sem cargo de Admin)') => {
    setProcessandoPhone(phone)
    setMensagem(null)
    try {
      const res = await fetch('/api/members/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'whitelist_add', phone, label })
      })
      if (res.ok) {
        setMensagem({ tipo: 'ok', texto: `Número ${phone} protegido na lista de Equipe.` })
        await carregar()
      }
    } finally {
      setProcessandoPhone(null)
    }
  }

  const adicionarManualEquipe = async () => {
    const limpo = novoTelefoneEquipe.replace(/\D/g, '')
    if (limpo.length < 8) return
    await protegerNaEquipe(limpo, novoRotuloEquipe || 'Equipe')
    setNovoTelefoneEquipe('')
  }

  const removerDaEquipe = async (phone: string) => {
    setProcessandoPhone(phone)
    try {
      const res = await fetch('/api/members/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'whitelist_remove', phone })
      })
      if (res.ok) await carregar()
    } finally {
      setProcessandoPhone(null)
    }
  }

  const removerDuplicatasDeUmLead = async (item: any) => {
    const keepGroupId = item.sugestaoManterGroupId
    const removeGroupIds = (item.grupos || [])
      .map((g: any) => g.groupId)
      .filter((gid: string) => gid !== keepGroupId)

    if (removeGroupIds.length === 0) return

    setProcessandoPhone(item.phone)
    setMensagem(null)
    try {
      const res = await fetch('/api/members/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_duplicates',
          items: [{ phone: item.phone, removeGroupIds }]
        })
      })
      const d = await res.json()
      if (res.ok) {
        setMensagem({
          tipo: 'ok',
          texto: `Removido de ${d.removidos} grupo(s) antigo(s). Mantido apenas no grupo mais recente!`
        })
        await carregar()
      } else {
        setMensagem({ tipo: 'erro', texto: d.error || 'Falha ao remover duplicatas.' })
      }
    } finally {
      setProcessandoPhone(null)
    }
  }

  const limparLoteMesmaTagSeguro = async () => {
    if (!dados?.duplicados) return
    // Seleciona apenas duplicados da mesma tag que NÃO são suspeitos de equipe (possibleTeam === false)
    const seguros = dados.duplicados.filter((d: any) => d.mesmaTag && !d.possibleTeam).slice(0, 25)
    if (seguros.length === 0) {
      setMensagem({
        tipo: 'erro',
        texto: 'Nenhum duplicado de mesma tag elegível (números em 3+ grupos exigem revisão individual).'
      })
      return
    }

    if (
      !window.confirm(
        `Remover ${seguros.length} lead(s) duplicados dos grupos antigos da mesma tag (mantendo cada um no grupo mais recente)? Admins e possíveis membros de equipe estão protegidos.`
      )
    ) {
      return
    }

    setProcessandoLote(true)
    setMensagem(null)
    try {
      const items = seguros.map((item: any) => ({
        phone: item.phone,
        removeGroupIds: (item.grupos || [])
          .map((g: any) => g.groupId)
          .filter((gid: string) => gid !== item.sugestaoManterGroupId)
      }))
      const res = await fetch('/api/members/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_duplicates', items })
      })
      const d = await res.json()
      if (res.ok) {
        setMensagem({
          tipo: 'ok',
          texto: `Limpeza concluída: ${d.removidos} vaga(s) liberada(s) nos grupos antigos.`
        })
        await carregar()
      }
    } finally {
      setProcessandoLote(false)
    }
  }

  if (carregando && !dados) {
    return (
      <Card className="border-border/40 bg-card/40">
        <CardContent className="py-10 flex items-center justify-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Analisando membros, cargos e DDDs em todos os grupos…
        </CardContent>
      </Card>
    )
  }

  if (!dados) return null

  const k = dados.kpis || {}
  const listaDuplicados = (dados.duplicados || []).filter((d: any) => {
    if (filtroDup === 'mesma_tag') return d.mesmaTag
    if (filtroDup === 'possivel_equipe') return d.possibleTeam
    return true
  })

  return (
    <div className="space-y-4">
      {/* KPIs de Auditoria */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-border/40 bg-card/40">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Vagas Ocupadas</p>
            <p className="text-xl font-bold mt-1">{(k.totalVagasOcupadas || 0).toLocaleString('pt-BR')}</p>
            <p className="text-[11px] text-muted-foreground">em {k.totalGrupos || 0} grupos</p>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/40">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Leads Únicos Reais</p>
            <p className="text-xl font-bold text-primary mt-1">{(k.leadsUnicos || 0).toLocaleString('pt-BR')}</p>
            <p className="text-[11px] text-muted-foreground">sem repetir número</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Admins &amp; Equipe
            </p>
            <p className="text-xl font-bold text-emerald-400 mt-1">{k.equipeEAdmins || 0}</p>
            <p className="text-[11px] text-muted-foreground">100% imunes à remoção</p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-amber-400">Vagas Duplicadas</p>
            <p className="text-xl font-bold text-amber-400 mt-1">{k.vagasDuplicadas || 0}</p>
            <p className="text-[11px] text-muted-foreground">{k.leadsDuplicados || 0} leads em 2+ grupos</p>
          </CardContent>
        </Card>

        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-red-400">Mesma Tag (Crítico)</p>
            <p className="text-xl font-bold text-red-400 mt-1">{k.duplicadosMesmaTag || 0}</p>
            <p className="text-[11px] text-muted-foreground">repetidos na mesma fila</p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-blue-400">Possível Equipe</p>
            <p className="text-xl font-bold text-blue-400 mt-1">{k.possiveisMembrosEquipe || 0}</p>
            <p className="text-[11px] text-muted-foreground">em 3+ grupos s/ admin</p>
          </CardContent>
        </Card>
      </div>

      {mensagem && (
        <div
          className={`p-3 rounded-lg text-xs border flex items-center justify-between ${
            mensagem.tipo === 'ok'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          <span>{mensagem.texto}</span>
          <button onClick={() => setMensagem(null)} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      )}

      {/* Navegação de Abas da Auditoria */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={aba === 'duplicados' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAba('duplicados')}
            className="gap-1.5"
          >
            <Users className="w-4 h-4" /> Duplicados ({k.leadsDuplicados || 0})
          </Button>
          <Button
            variant={aba === 'equipe' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAba('equipe')}
            className="gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" /> Equipe Protegida ({(dados.teamWhitelist || []).length})
          </Button>
          <Button
            variant={aba === 'ddd' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAba('ddd')}
            className="gap-1.5"
          >
            <MapPin className="w-4 h-4" /> Mapa de DDDs ({(dados.mapaDDD || []).length})
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={carregar} disabled={carregando} className="gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} /> Atualizar Auditoria
        </Button>
      </div>

      {/* ABA 1: DUPLICADOS */}
      {aba === 'duplicados' && (
        <Card className="border-border/40 bg-card/40">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Auditoria de Membros Duplicados
                </CardTitle>
                <CardDescription>
                  Administradores e números na Lista da Equipe já estão ocultos e protegidos. Números em 3+ grupos sem cargo de admin recebem alerta de &quot;Possível Equipe&quot;.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={filtroDup === 'todos' ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setFiltroDup('todos')}
                >
                  Todos ({dados.duplicados?.length || 0})
                </Button>
                <Button
                  variant={filtroDup === 'mesma_tag' ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setFiltroDup('mesma_tag')}
                >
                  Mesma Tag ({k.duplicadosMesmaTag || 0})
                </Button>
                <Button
                  variant={filtroDup === 'possivel_equipe' ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setFiltroDup('possivel_equipe')}
                >
                  ⚠️ Possível Equipe ({k.possiveisMembrosEquipe || 0})
                </Button>
                {k.duplicadosMesmaTag > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    disabled={processandoLote}
                    onClick={limparLoteMesmaTagSeguro}
                  >
                    {processandoLote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                    Limpar Duplicados Seguros (Mesma Tag)
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-2.5 max-h-[520px] overflow-y-auto">
            {listaDuplicados.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border/50 rounded-lg">
                Nenhum membro duplicado encontrado para este filtro.
              </div>
            )}

            {listaDuplicados.map((item: any) => (
              <div
                key={item.phone}
                className={`p-3.5 rounded-xl border space-y-2.5 ${
                  item.possibleTeam
                    ? 'border-blue-500/40 bg-blue-500/5'
                    : item.mesmaTag
                      ? 'border-red-500/30 bg-red-500/5'
                      : 'border-border/50 bg-muted/15'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{item.phone}</span>
                      {item.displayName && (
                        <span className="text-xs text-muted-foreground">({item.displayName})</span>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        DDD {item.ddd} · {item.uf}
                      </Badge>
                      {item.mesmaTag && (
                        <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">
                          Mesma Tag: {(item.tagsDuplicadas || []).join(', ')}
                        </Badge>
                      )}
                      {item.possibleTeam && (
                        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-[10px] flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Possível Equipe ({item.totalGrupos} grupos s/ admin)
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                      disabled={processandoPhone === item.phone}
                      onClick={() => protegerNaEquipe(item.phone)}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> Proteger na Equipe
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 border-red-500/40 text-red-400 hover:bg-red-500/10"
                      disabled={processandoPhone === item.phone}
                      onClick={() => removerDuplicatasDeUmLead(item)}
                    >
                      {processandoPhone === item.phone ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserX className="w-3.5 h-3.5" />
                      )}
                      Deixar só no mais recente (-{item.totalGrupos - 1})
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(item.grupos || []).map((g: any) => {
                    const manter = g.groupId === item.sugestaoManterGroupId
                    return (
                      <span
                        key={g.groupId}
                        className={`text-[11px] px-2 py-0.5 rounded-md border flex items-center gap-1.5 ${
                          manter
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-medium'
                            : 'bg-muted/40 border-border/50 text-muted-foreground'
                        }`}
                      >
                        {g.tagCor && (
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: g.tagCor }}
                          />
                        )}
                        <span>{g.grupoNome}</span>
                        <span className="text-[10px] opacity-75">
                          ({manter ? 'Manter · atual' : 'Antigo'})
                        </span>
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ABA 2: WHITELIST DA EQUIPE */}
      {aba === 'equipe' && (
        <Card className="border-border/40 bg-card/40">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Lista Protegida da Equipe (Sem Cargo de Admin)
            </CardTitle>
            <CardDescription>
              Adicione aqui os números de suporte, comercial ou monitoramento que entram em vários grupos como membros comuns. Eles jamais serão listados ou removidos como duplicados.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Ex: 5511999998888"
                value={novoTelefoneEquipe}
                onChange={e => setNovoTelefoneEquipe(e.target.value)}
                className="w-full sm:w-60"
              />
              <Input
                placeholder="Função (ex: Suporte Comercial)"
                value={novoRotuloEquipe}
                onChange={e => setNovoRotuloEquipe(e.target.value)}
                className="w-full sm:w-64"
              />
              <Button onClick={adicionarManualEquipe} className="gap-1.5">
                <Plus className="w-4 h-4" /> Proteger Número
              </Button>
            </div>

            <div className="space-y-2">
              {(dados.teamWhitelist || []).length === 0 && (
                <p className="text-xs text-muted-foreground py-4">
                  Nenhum número cadastrado manualmente ainda. Observação: todos os números com cargo de Admin nos grupos já são protegidos automaticamente.
                </p>
              )}

              {(dados.teamWhitelist || []).map((w: any) => (
                <div
                  key={w.phone}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{w.phone}</span>
                      <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
                        {w.label || 'Equipe'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Presente em {w.gruposCount || 0} grupo(s)
                      {w.displayName ? ` · ${w.displayName}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removerDaEquipe(w.phone)}
                    disabled={processandoPhone === w.phone}
                    title="Remover da lista da equipe"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ABA 3: MAPA DE DDDS */}
      {aba === 'ddd' && (
        <Card className="border-border/40 bg-card/40">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" /> Distribuição Geográfica por DDD (Leads Únicos)
            </CardTitle>
            <CardDescription>
              Identifica de quais estados e regiões vêm os membros reais dos seus grupos (excluindo admins e equipe).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-2.5 max-h-[480px] overflow-y-auto">
            {(dados.mapaDDD || []).map((d: any) => (
              <div key={d.ddd} className="p-3 rounded-lg border border-border/40 bg-muted/15 space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono">
                      DDD {d.ddd}
                    </Badge>
                    <span className="font-medium">{d.uf}</span>
                    <span className="text-xs text-muted-foreground">— {d.regiao}</span>
                  </div>
                  <span className="text-xs font-semibold">
                    {d.unicos} leads ({d.percentual}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, Math.max(2, d.percentual))}%` }}
                  />
                </div>
                {Array.isArray(d.porTag) && d.porTag.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {d.porTag.slice(0, 6).map((pt: any) => (
                      <span
                        key={pt.tag}
                        className="text-[10px] bg-background/60 border border-border/40 px-2 py-0.5 rounded text-muted-foreground"
                      >
                        {pt.tag}: <strong>{pt.count}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
