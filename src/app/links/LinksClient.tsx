'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MousePointerClick, Copy, Check, ExternalLink, Users, Clock, Share2 } from 'lucide-react'

type GrupoClique = {
  groupId: string | null
  nome: string
  slug: string | null
  membros: number
  tag: { id: string; nome: string; cor: string | null } | null
  cliques: number
  unicos: number
}

type LinkRastreado = {
  id: string
  code: string
  url: string
  label: string | null
  active: boolean
  createdAt: string
  grupo: {
    id: string
    nome: string
    slug?: string | null
    membros: number
    tag?: { id: string; nome: string; cor: string | null } | null
  } | null
  cliquesTotal: number
  cliquesNaJanela: number
  cliquesUnicos?: number
  porGrupo?: GrupoClique[]
  porHora?: number[]
  taxa: number | null
  ultimoClique: string | null
}

export default function LinksClient() {
  const [links, setLinks] = useState<LinkRastreado[]>([])
  const [grupos, setGrupos] = useState<any[]>([])
  const [grupoParaLink, setGrupoParaLink] = useState<string>('nenhum')
  const [dias, setDias] = useState('30')
  const [carregando, setCarregando] = useState(true)
  const [copiado, setCopiado] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const res = await fetch(`/api/links?days=${dias}`)
      if (res.ok) setLinks(await res.json())
    } finally {
      setCarregando(false)
    }
  }, [dias])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    fetch('/api/groups')
      .then(r => (r.ok ? r.json() : []))
      .then(d => setGrupos(Array.isArray(d) ? d : d.data || []))
      .catch(() => {})
  }, [])

  const montarUrlCurta = (code: string, groupIdPadrao?: string | null) => {
    const gid = grupoParaLink !== 'nenhum' ? grupoParaLink : groupIdPadrao || ''
    const base = `${window.location.origin}/l/${code}`
    return gid ? `${base}?grupid=${encodeURIComponent(gid)}` : base
  }

  const copiar = async (code: string, groupIdPadrao?: string | null) => {
    try {
      await navigator.clipboard.writeText(montarUrlCurta(code, groupIdPadrao))
      setCopiado(code)
      setTimeout(() => setCopiado(null), 1500)
    } catch {
      /* clipboard bloqueado */
    }
  }

  const totalCliques = links.reduce((soma, l) => soma + l.cliquesNaJanela, 0)
  const totalUnicos = links.reduce((soma, l) => soma + (l.cliquesUnicos ?? l.cliquesNaJanela), 0)
  const comCliques = links.filter(l => l.cliquesNaJanela > 0).length

  // Mapa de calor global de horários (0h - 23h)
  const horasGlobais = Array.from({ length: 24 }, (_, h) =>
    links.reduce((acc, l) => acc + (l.porHora?.[h] || 0), 0)
  )
  const maxHoraGlobal = Math.max(1, ...horasGlobais)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border/40 bg-card/40">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Links</p>
            <p className="text-2xl font-bold">{links.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/40">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Cliques Totais</p>
            <p className="text-2xl font-bold text-primary">{totalCliques}</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/40">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Cliques Únicos (s/ bots)</p>
            <p className="text-2xl font-bold text-emerald-400">{totalUnicos}</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/40">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Links Ativos c/ Clique</p>
            <p className="text-2xl font-bold">{comCliques}</p>
          </CardContent>
        </Card>
      </div>

      {/* Mapa de Calor Horário */}
      {totalCliques > 0 && (
        <Card className="border-border/40 bg-card/40">
          <CardHeader className="border-b border-border/40 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Horários de Maior Engajamento (Fuso de São Paulo)
            </CardTitle>
            <CardDescription>
              Distribuição dos cliques pelas 24 horas do dia para você descobrir a janela de ouro dos seus grupos.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-12 sm:grid-cols-24 gap-1 items-end h-24 pt-2">
              {horasGlobais.map((qtd, h) => {
                const pct = Math.round((qtd / maxHoraGlobal) * 100)
                return (
                  <div key={h} className="flex flex-col items-center gap-1 group">
                    <span className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      {qtd}
                    </span>
                    <div className="w-full h-14 bg-muted/30 rounded-sm flex items-end overflow-hidden">
                      <div
                        className="w-full bg-primary/80 group-hover:bg-primary rounded-sm transition-all"
                        style={{ height: `${qtd > 0 ? Math.max(12, pct) : 0}%` }}
                        title={`${String(h).padStart(2, '0')}h: ${qtd} clique(s)`}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground">
                      {String(h).padStart(2, '0')}h
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/40 bg-card/40">
        <CardHeader className="border-b border-border/40 pb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <MousePointerClick className="w-5 h-5" /> Links rastreados &amp; Atribuição por ?grupid=
            </CardTitle>
            <CardDescription>
              O sistema anexa <code>?grupid=[id]</code> automaticamente nos disparos e injeta UTMs no link de destino.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {grupos.length > 0 && (
              <Select value={grupoParaLink} onValueChange={setGrupoParaLink}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="grupid ao copiar link" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">grupid padrão do link</SelectItem>
                  {grupos.map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>
                      ?grupid= {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={dias} onValueChange={setDias}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Últimas 24h</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-2.5">
          {carregando && <p className="text-sm text-muted-foreground">Carregando…</p>}

          {!carregando && links.length === 0 && (
            <div className="py-10 text-center text-muted-foreground border border-dashed border-border/50 rounded-lg bg-muted/10">
              <p>Nenhum link rastreado ainda.</p>
              <p className="text-xs mt-1">
                Marque &quot;contar cliques&quot; ao agendar uma mensagem com link.
              </p>
            </div>
          )}

          {links.map(l => {
            const paramPreview =
              grupoParaLink !== 'nenhum'
                ? `?grupid=${grupoParaLink}`
                : l.grupo?.id
                  ? `?grupid=${l.grupo.id}`
                  : ''
            return (
              <div key={l.id} className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-2.5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium truncate">{l.label || l.url}</p>
                      {l.grupo?.tag && (
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          style={{
                            borderColor: l.grupo.tag.cor || undefined,
                            color: l.grupo.tag.cor || undefined
                          }}
                        >
                          {l.grupo.tag.nome}
                        </Badge>
                      )}
                    </div>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground truncate flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{l.url}</span>
                    </a>
                    {l.grupo && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" /> {l.grupo.nome} · {l.grupo.membros} membros
                      </p>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-2xl font-bold text-primary leading-none">{l.cliquesNaJanela}</p>
                    <p className="text-[11px] text-emerald-400 font-medium mt-0.5">
                      {l.cliquesUnicos ?? l.cliquesNaJanela} único(s)
                    </p>
                    {l.taxa !== null && (
                      <p className="text-[11px] text-muted-foreground">CTR {l.taxa}%</p>
                    )}
                  </div>
                </div>

                {/* Detalhamento por ?grupid= quando houver cliques */}
                {Array.isArray(l.porGrupo) && l.porGrupo.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {l.porGrupo.map((pg, idx) => (
                      <span
                        key={pg.groupId || idx}
                        className="text-[11px] px-2 py-0.5 rounded-md border border-border/50 bg-background/50 flex items-center gap-1.5"
                      >
                        <Share2 className="w-3 h-3 text-primary" />
                        <span>{pg.nome}</span>
                        {pg.tag && (
                          <span className="text-[10px] text-muted-foreground">({pg.tag.nome})</span>
                        )}
                        <strong className="text-primary">{pg.cliques}</strong>
                        <span className="text-[10px] text-muted-foreground">({pg.unicos} ún.)</span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-1">
                  <code className="text-xs bg-muted/60 border border-border/50 rounded px-2 py-1 truncate">
                    /l/{l.code}
                    {paramPreview}
                  </code>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {l.cliquesTotal !== l.cliquesNaJanela && (
                      <span className="text-xs text-muted-foreground">{l.cliquesTotal} no total</span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copiar(l.code, l.grupo?.id)}
                      title="Copiar link curto com ?grupid="
                    >
                      {copiado === l.code ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className="border-border/40 bg-card/40">
        <CardContent className="pt-6 text-sm text-muted-foreground space-y-2">
          <p>
            <strong className="text-foreground">Rastreamento por Grupo e Tag (<code>?grupid=</code>):</strong>{' '}
            você pode usar qualquer link <code>/l/[codigo]?grupid=[id_ou_slug_do_grupo]</code>. O sistema
            identifica automaticamente de qual grupo e tag veio o clique, filtra robôs de pré-visualização
            do WhatsApp e injeta <code>utm_source=whatsapp</code>, <code>utm_medium=grupo</code>,{' '}
            <code>utm_campaign=[tag]</code> e <code>utm_content=[grupo]</code> na URL final.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

