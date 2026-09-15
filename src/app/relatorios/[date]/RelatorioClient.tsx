'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  CheckCircle2, AlertCircle, SkipForward, MousePointerClick, UserPlus, UserMinus,
  MessageSquare, Settings2, Loader2, ChevronRight, BarChart3, Bell, Send
} from 'lucide-react'

type Relatorio = any

/** Barra proporcional, para comparar volumes sem precisar de biblioteca. */
function Barra({ valor, maximo, cor = 'bg-primary' }: { valor: number; maximo: number; cor?: string }) {
  const pct = maximo > 0 ? Math.round((valor / maximo) * 100) : 0
  return (
    <div className="h-2 rounded-full bg-muted/40 overflow-hidden min-w-[60px]">
      <div className={`h-full rounded-full ${cor} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function Kpi({
  icone, rotulo, valor, cor, sufixo
}: {
  icone: React.ReactNode
  rotulo: string
  valor: number | string
  cor?: string
  sufixo?: string
}) {
  return (
    <Card className="border-border/40 bg-card/40">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icone}
          <p className="text-xs uppercase tracking-wide">{rotulo}</p>
        </div>
        <p className={`text-2xl font-bold ${cor || ''}`}>
          {typeof valor === 'number' ? valor.toLocaleString('pt-BR') : valor}
          {sufixo && <span className="text-sm font-normal text-muted-foreground ml-1">{sufixo}</span>}
        </p>
      </CardContent>
    </Card>
  )
}

export default function RelatorioClient({ data }: { data: string }) {
  const router = useRouter()
  const [rel, setRel] = useState<Relatorio | null>(null)
  // Filtro por tag: reaproveita o agrupamento que voce ja montou
  const [tags, setTags] = useState<any[]>([])
  const [tagFiltro, setTagFiltro] = useState<string>('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const res = await fetch(`/api/reports/${data}`)
      const d = await res.json()
      if (!res.ok) { setErro(d.error || 'Falha ao carregar o relatório.'); return }
      setRel(d)
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setCarregando(false)
    }
  }, [data])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    fetch('/api/tags')
      .then(r => (r.ok ? r.json() : []))
      .then(d => setTags(Array.isArray(d) ? d : []))
      .catch(() => { /* sem tags o relatorio segue igual */ })
  }, [])

  const dataBonita = new Date(`${data}T12:00:00-03:00`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  })

  const tagEscolhida = tags.find((t: any) => t.id === tagFiltro)
  const idsDaTag = tagEscolhida
    ? new Set(tagEscolhida.grupos.map((g: any) => g.id))
    : null

  const gruposVisiveis = (rel?.porGrupo || [])
    .filter((g: any) => !idsDaTag || idsDaTag.has(g.id))

  const maxGrupo = Math.max(1, ...gruposVisiveis.map((g: any) => g.enviados))
  const maxInstancia = Math.max(1, ...(rel?.porInstancia || []).map((i: any) => i.enviados))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold capitalize">{dataBonita}</h2>
          <p className="text-xs text-muted-foreground">Fuso de São Paulo</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={data}
            onChange={e => e.target.value && router.push(`/relatorios/${e.target.value}`)}
            className="w-[170px]"
          />
          <Button variant="outline" size="sm" onClick={carregar} disabled={carregando}>
            {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Atualizar'}
          </Button>
        </div>
      </div>

      <ConfiguracaoAlertas />

      {erro && (
        <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{erro}</div>
      )}

      {carregando && !rel && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {rel && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi icone={<CheckCircle2 className="w-4 h-4" />} rotulo="Enviados" valor={rel.totais.enviados} cor="text-green-500" />
            <Kpi icone={<AlertCircle className="w-4 h-4" />} rotulo="Falhas" valor={rel.totais.falhados} cor={rel.totais.falhados ? 'text-red-500' : ''} />
            <Kpi icone={<MousePointerClick className="w-4 h-4" />} rotulo="Cliques" valor={rel.totais.cliques} cor="text-primary" />
            <Kpi icone={<UserPlus className="w-4 h-4" />} rotulo="Novos membros" valor={rel.totais.novosMembros} cor="text-primary" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi icone={<MessageSquare className="w-4 h-4" />} rotulo="Mensagens" valor={rel.totais.mensagens} />
            <Kpi icone={<Settings2 className="w-4 h-4" />} rotulo="Ações de grupo" valor={rel.totais.acoesDeGrupo} />
            <Kpi icone={<SkipForward className="w-4 h-4" />} rotulo="Pulados" valor={rel.totais.pulados} cor="text-amber-500" />
            <Kpi icone={<UserMinus className="w-4 h-4" />} rotulo="Saíram" valor={rel.totais.saidas} />
          </div>

          {/* ------------------------------------------------ instâncias */}
          <Card className="border-border/40 bg-card/40">
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Por instância
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {rel.porInstancia.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma atividade no dia.</p>
              )}
              <div className="space-y-3">
                {rel.porInstancia.map((i: any) => (
                  <div key={i.instancia} className="grid grid-cols-[1fr_auto] sm:grid-cols-[200px_1fr_auto] gap-3 items-center">
                    <span className="text-sm font-medium truncate">{i.instancia}</span>
                    <div className="hidden sm:block"><Barra valor={i.enviados} maximo={maxInstancia} /></div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      <span className="text-green-500 font-semibold">{i.enviados}</span> enviados
                      {i.falhados > 0 && <> · <span className="text-red-500 font-semibold">{i.falhados}</span> falhas</>}
                      {' '}· {i.grupos} grupos
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ----------------------------------------------------- grupos */}
          <Card className="border-border/40 bg-card/40">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Por grupo</CardTitle>
                  <CardDescription>
                    {gruposVisiveis.length} grupo(s) com atividade
                    {tagEscolhida ? ` na tag ${tagEscolhida.name}` : ''}
                  </CardDescription>
                </div>
                {tags.length > 0 && (
                  <Select value={tagFiltro || 'todas'} onValueChange={v => setTagFiltro(v === 'todas' ? '' : v)}>
                    <SelectTrigger className="w-[190px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as tags</SelectItem>
                      {tags.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {gruposVisiveis.map((g: any) => (
                  <div key={g.id || g.nome} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/20">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{g.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {g.instancia} · {g.membros} membros
                      </p>
                    </div>
                    <div className="hidden sm:block w-32"><Barra valor={g.enviados} maximo={maxGrupo} /></div>
                    <div className="text-xs whitespace-nowrap text-right w-28">
                      <span className="text-green-500 font-semibold">{g.enviados}</span>
                      {g.falhados > 0 && <span className="text-red-500 font-semibold"> · {g.falhados}✕</span>}
                      {g.pulados > 0 && <span className="text-amber-500"> · {g.pulados}⏭</span>}
                    </div>
                    {g.slug && (
                      <Link href={`/${g.slug}`}>
                        <Button variant="ghost" size="icon"><ChevronRight className="w-4 h-4" /></Button>
                      </Link>
                    )}
                  </div>
                ))}
                {gruposVisiveis.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nada aconteceu neste dia.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ------------------------------------------------- por tipo */}
            <Card className="border-border/40 bg-card/40">
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-base">Por tipo de ação</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2">
                {rel.porTipo.map((t: any) => (
                  <div key={t.tipo} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{
                      ({ text: 'texto', media: 'mídia', button: 'botões', poll: 'enquete',
                        permission: 'permissão', profile: 'editar grupo' } as any)[t.tipo] || t.tipo
                    }</span>
                    <span className="text-xs text-muted-foreground">
                      <span className="text-green-500 font-semibold">{t.enviados}</span>
                      {t.falhados > 0 && <span className="text-red-500"> · {t.falhados} falhas</span>}
                    </span>
                  </div>
                ))}
                {rel.porTipo.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
              </CardContent>
            </Card>

            {/* --------------------------------------------- crescimento */}
            <Card className="border-border/40 bg-card/40">
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="w-4 h-4" /> Movimento de membros
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2 max-h-[260px] overflow-y-auto">
                {rel.crescimento.map((c: any) => (
                  <div key={c.grupo} className="flex items-center justify-between text-sm gap-3">
                    <span className="truncate">{c.grupo}</span>
                    <span className={`text-xs font-semibold whitespace-nowrap ${
                      (c.novos || 0) > 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {(c.novos || 0) > 0 ? '+' : ''}{c.novos} <span className="text-muted-foreground font-normal">({c.agora})</span>
                    </span>
                  </div>
                ))}
                {rel.crescimento.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Sem variação registrada. A contagem compara com o dia anterior — leva
                    um dia para começar a aparecer.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ----------------------------------------------------- links */}
          <Card className="border-border/40 bg-card/40">
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <MousePointerClick className="w-4 h-4" /> Cliques em links
              </CardTitle>
              <CardDescription>{rel.totais.cliques} clique(s) em {rel.totais.linksClicados} link(s)</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-2">
              {rel.links.map((l: any) => (
                <div key={l.code} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{l.label || l.url}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      /l/{l.code}{l.grupo ? ` · ${l.grupo}` : ''}
                    </p>
                  </div>
                  <span className="text-primary font-bold whitespace-nowrap">{l.cliques}</span>
                </div>
              ))}
              {rel.links.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum clique registrado no dia.</p>
              )}
            </CardContent>
          </Card>

          {/* -------------------------------------------------- enquetes */}
          {rel.enquetes.length > 0 && (
            <Card className="border-border/40 bg-card/40">
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-base">Enquetes do dia</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {rel.enquetes.map((e: any) => {
                  const opcoes = e.resultados?.options || e.resultados?.Options || null
                  const totalVotos = Array.isArray(opcoes)
                    ? opcoes.reduce((s: number, o: any) => s + (o.votes ?? o.count ?? 0), 0)
                    : 0
                  return (
                    <div key={e.id} className="space-y-2">
                      <div>
                        <p className="text-sm font-medium">{e.pergunta}</p>
                        <p className="text-xs text-muted-foreground">{e.grupo}</p>
                      </div>
                      {Array.isArray(opcoes) ? (
                        <div className="space-y-1.5">
                          {opcoes.map((o: any, i: number) => {
                            const v = o.votes ?? o.count ?? 0
                            return (
                              <div key={i} className="grid grid-cols-[1fr_auto] sm:grid-cols-[140px_1fr_auto] gap-2 items-center text-xs">
                                <span className="truncate">{o.name || o.option || `Opção ${i + 1}`}</span>
                                <div className="hidden sm:block"><Barra valor={v} maximo={Math.max(1, totalVotos)} /></div>
                                <span className="text-muted-foreground whitespace-nowrap">{v} voto(s)</span>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Resultados indisponíveis — a enquete precisa ter sido enviada com o
                          id da mensagem registrado.
                        </p>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* ---------------------------------------------------- falhas */}
          {rel.falhas.length > 0 && (
            <Card className="border-red-500/30 bg-red-500/5">
              <CardHeader className="border-b border-red-500/20 pb-4">
                <CardTitle className="text-base flex items-center gap-2 text-red-500">
                  <AlertCircle className="w-4 h-4" /> Falhas do dia ({rel.falhas.length})
                </CardTitle>
                <CardDescription>
                  Cada grupo com falha fica com a fila parada até que o erro seja resolvido.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-2">
                {rel.falhas.map((f: any) => (
                  <div key={f.id} className="flex items-start justify-between gap-3 text-sm p-2 rounded-lg bg-background/40">
                    <div className="min-w-0">
                      <p className="truncate">{f.grupo} <span className="text-muted-foreground">· {f.tipo}</span></p>
                      <p className="text-xs text-red-500 break-words">{f.erro}</p>
                    </div>
                    {f.slug && (
                      <Link href={`/${f.slug}`} className="flex-shrink-0">
                        <Button variant="outline" size="sm">Resolver</Button>
                      </Link>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// -------------------------------------------------- configuração de alertas

function ConfiguracaoAlertas() {
  const [config, setConfig] = useState<any>(null)
  const [grupos, setGrupos] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState('')

  const carregar = useCallback(async () => {
    const [rc, rg] = await Promise.all([fetch('/api/settings'), fetch('/api/groups')])
    if (rc.ok) setConfig(await rc.json())
    if (rg.ok) {
      const d = await rg.json()
      setGrupos(Array.isArray(d) ? d : (d.data || []))
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const gravar = async (mudanca: Record<string, unknown>) => {
    setSalvando(true)
    setAviso('')
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mudanca)
      })
      if (!res.ok) {
        const d = await res.json()
        setAviso(d.error || 'Falha ao salvar.')
        return
      }
      await carregar()
      setAviso('Salvo.')
      setTimeout(() => setAviso(''), 2000)
    } finally {
      setSalvando(false)
    }
  }

  if (!config) return null

  return (
    <Card className="border-border/40 bg-card/40">
      <CardHeader className="border-b border-border/40 pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="w-4 h-4" /> Alertas e relatório automático
        </CardTitle>
        <CardDescription>
          Onde o sistema avisa sobre falhas e envia o resumo diário às 23:59.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="space-y-2">
          <Label>Grupo que recebe os avisos</Label>
          <Select
            value={config.alertGroupId || 'nenhum'}
            onValueChange={v => gravar({ alertGroupId: v === 'nenhum' ? '' : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Escolha um grupo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nenhum">Nenhum (desligado)</SelectItem>
              {grupos.map((g: any) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!config.alertGroupId && (
            <p className="text-xs text-amber-500">
              Sem grupo escolhido, nenhum alerta nem relatório é enviado.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary focus:ring-primary"
              checked={config.alertsEnabled}
              disabled={salvando}
              onChange={e => gravar({ alertsEnabled: e.target.checked })}
            />
            Avisar quando um agendamento falhar
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary focus:ring-primary"
              checked={config.dailyReportEnabled}
              disabled={salvando}
              onChange={e => gravar({ dailyReportEnabled: e.target.checked })}
            />
            Enviar o relatório diário às 23:59
          </label>
        </div>

        {aviso && <p className="text-xs text-muted-foreground flex items-center gap-1"><Send className="w-3 h-3" /> {aviso}</p>}
      </CardContent>
    </Card>
  )
}
