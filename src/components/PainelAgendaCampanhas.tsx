'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  CalendarClock,
  PauseCircle,
  PlayCircle,
  Clock,
  Megaphone,
  MousePointerClick,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

export default function PainelAgendaCampanhas({
  tags = [],
  instances = [],
  onChanged
}: {
  tags?: any[]
  instances?: any[]
  onChanged?: () => void
}) {
  const [dados, setDados] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)
  const [tagFiltro, setTagFiltro] = useState('todas')
  const [instFiltro, setInstFiltro] = useState('todas')
  const [campFiltro, setCampFiltro] = useState('todas')
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [executandoAcao, setExecutandoAcao] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const params = new URLSearchParams()
      if (tagFiltro !== 'todas') params.set('tagId', tagFiltro)
      if (instFiltro !== 'todas') params.set('instanceName', instFiltro)
      if (campFiltro !== 'todas') params.set('campaign', campFiltro)
      if (statusFiltro !== 'todos') params.set('status', statusFiltro)

      const res = await fetch(`/api/schedules/queue?${params.toString()}`)
      if (res.ok) setDados(await res.json())
    } finally {
      setCarregando(false)
    }
  }, [tagFiltro, instFiltro, campFiltro, statusFiltro])

  useEffect(() => {
    carregar()
  }, [carregar])

  const controlarFila = async (action: 'pause' | 'resume' | 'delay', minutes?: number) => {
    const escopo =
      campFiltro !== 'todas'
        ? `da campanha "${campFiltro}"`
        : tagFiltro !== 'todas'
          ? 'da tag selecionada'
          : instFiltro !== 'todas'
            ? `da instância "${instFiltro}"`
            : 'de TODOS os grupos'

    const msgConfirm =
      action === 'pause'
        ? `Pausar todos os agendamentos pendentes ${escopo}?`
        : action === 'resume'
          ? `Retomar os agendamentos pausados ${escopo} (com espaçamento automático seguro)?`
          : `Adiar em +${minutes} minutos os agendamentos pendentes ${escopo}?`

    if (!window.confirm(msgConfirm)) return

    setExecutandoAcao(`${action}-${minutes || ''}`)
    setAviso(null)
    try {
      const payload: any = { action }
      if (minutes) payload.minutes = minutes
      if (tagFiltro !== 'todas') payload.tagId = tagFiltro
      if (instFiltro !== 'todas') payload.instanceName = instFiltro
      if (campFiltro !== 'todas') payload.campaign = campFiltro

      const res = await fetch('/api/schedules/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const d = await res.json()
      if (res.ok) {
        setAviso(`Ação concluída: ${d.affected || 0} agendamento(s) atualizado(s).`)
        await carregar()
        if (onChanged) onChanged()
      }
    } finally {
      setExecutandoAcao(null)
    }
  }

  const r = dados?.resumoFila || {}
  const campanhas = dados?.campanhas || []
  const timeline = dados?.timeline || []

  return (
    <div className="space-y-4">
      {/* KPIs da Fila */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/40 bg-card/40">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Na Fila (Pendentes)</p>
            <p className="text-2xl font-bold text-primary mt-1">{r.pendentes || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-amber-400">Pausados</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{r.pausados || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-emerald-400">Enviados (Janela)</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{r.enviadosRecentes || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-red-400">Com Falha</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{r.errosPendentes || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Controles de Emergência */}
      <Card className="border-border/40 bg-card/40">
        <CardHeader className="border-b border-border/40 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-primary" /> Controle Global de Fila &amp; Emergência
              </CardTitle>
              <CardDescription>
                Filtre por Tag, Instância ou Campanha e pause, retome ou adie a fila inteira em 1 clique.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={carregar} disabled={carregando} className="gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <Select value={tagFiltro} onValueChange={setTagFiltro}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Tags</SelectItem>
                {tags.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={instFiltro} onValueChange={setInstFiltro}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por Instância" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Instâncias</SelectItem>
                {instances.map((i: any) => {
                  const name = i.name || i.instance?.instanceName
                  if (!name) return null
                  return (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            <Select value={campFiltro} onValueChange={setCampFiltro}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por Campanha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Campanhas</SelectItem>
                {campanhas.map((c: any) => (
                  <SelectItem key={c.nome} value={c.nome}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="deactivated">Pausados</SelectItem>
                <SelectItem value="sent">Enviados</SelectItem>
                <SelectItem value="error">Com Erro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
              disabled={!!executandoAcao}
              onClick={() => controlarFila('pause')}
            >
              {executandoAcao === 'pause-' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PauseCircle className="w-3.5 h-3.5" />}
              Pausar Pendentes
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
              disabled={!!executandoAcao}
              onClick={() => controlarFila('resume')}
            >
              {executandoAcao === 'resume-' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
              Retomar Pausados
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!!executandoAcao}
              onClick={() => controlarFila('delay', 30)}
            >
              <Clock className="w-3.5 h-3.5" /> Adiar +30 min
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!!executandoAcao}
              onClick={() => controlarFila('delay', 60)}
            >
              <Clock className="w-3.5 h-3.5" /> Adiar +1 hora
            </Button>
          </div>

          {aviso && (
            <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-3 py-2">
              {aviso}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Campanhas Ativas */}
      {campanhas.length > 0 && (
        <Card className="border-border/40 bg-card/40">
          <CardHeader className="border-b border-border/40 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary" /> Performance por Campanha
            </CardTitle>
            <CardDescription>
              Consolida envios, alcance e cliques de todos os agendamentos rotulados com o mesmo nome de campanha.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {campanhas.map((c: any) => (
              <div
                key={c.nome}
                className="p-3.5 rounded-xl border border-border/50 bg-muted/15 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.grupos} grupo(s) · {c.membrosAlcancados.toLocaleString('pt-BR')} membros
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    <MousePointerClick className="w-3 h-3 text-primary" /> {c.cliques} ({c.ctr}%)
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2 text-xs pt-1">
                  <span className="text-emerald-400 font-medium">{c.enviados} enviados</span>
                  <span className="text-primary font-medium">{c.pendentes} na fila</span>
                  {c.pausados > 0 && <span className="text-amber-400">{c.pausados} pausados</span>}
                  {c.falhados > 0 && <span className="text-red-400">{c.falhados} erros</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Linha do Tempo Global */}
      <Card className="border-border/40 bg-card/40">
        <CardHeader className="border-b border-border/40 pb-3">
          <CardTitle className="text-base">Linha do Tempo de Disparos ({timeline.length})</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-2 max-h-[460px] overflow-y-auto">
          {timeline.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum agendamento encontrado para os filtros selecionados.
            </p>
          )}

          {timeline.map((item: any) => {
            const dt = new Date(item.adjustedAt).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-border/40 bg-muted/15 text-sm"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{dt}</span>
                    <span className="font-medium truncate">{item.grupo?.nome || 'Grupo'}</span>
                    {item.grupo?.tag && (
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                        style={{
                          borderColor: item.grupo.tag.cor || undefined,
                          color: item.grupo.tag.cor || undefined
                        }}
                      >
                        {item.grupo.tag.nome}
                      </Badge>
                    )}
                    {item.campaign && (
                      <Badge variant="secondary" className="text-[10px]">
                        📣 {item.campaign}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {item.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{item.resumo}</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.cliques > 0 && (
                    <span className="text-xs text-primary font-semibold flex items-center gap-1">
                      <MousePointerClick className="w-3 h-3" /> {item.cliques}
                    </span>
                  )}
                  {item.status === 'sent' && (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Enviado
                    </Badge>
                  )}
                  {(item.status === 'pending' || item.status === 'processing') && (
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                      Na Fila
                    </Badge>
                  )}
                  {item.status === 'deactivated' && (
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                      Pausado
                    </Badge>
                  )}
                  {item.status === 'error' && (
                    <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-[10px] gap-1">
                      <AlertCircle className="w-3 h-3" /> Erro
                    </Badge>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
