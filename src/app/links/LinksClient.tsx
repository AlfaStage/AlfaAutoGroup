'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MousePointerClick, Copy, Check, ExternalLink, Users } from 'lucide-react'

type LinkRastreado = {
  id: string
  code: string
  url: string
  label: string | null
  active: boolean
  createdAt: string
  grupo: { id: string; nome: string; membros: number } | null
  cliquesTotal: number
  cliquesNaJanela: number
  taxa: number | null
  ultimoClique: string | null
}

export default function LinksClient() {
  const [links, setLinks] = useState<LinkRastreado[]>([])
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

  useEffect(() => { carregar() }, [carregar])

  const copiar = async (code: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/l/${code}`)
      setCopiado(code)
      setTimeout(() => setCopiado(null), 1500)
    } catch { /* clipboard bloqueado */ }
  }

  const totalCliques = links.reduce((soma, l) => soma + l.cliquesNaJanela, 0)
  const comCliques = links.filter(l => l.cliquesNaJanela > 0).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/40 bg-card/40">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Links</p>
            <p className="text-2xl font-bold">{links.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/40">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Cliques no período</p>
            <p className="text-2xl font-bold text-primary">{totalCliques}</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/40">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Com ao menos 1 clique</p>
            <p className="text-2xl font-bold">{comCliques}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/40 bg-card/40">
        <CardHeader className="border-b border-border/40 pb-4 flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <MousePointerClick className="w-5 h-5" /> Links rastreados
            </CardTitle>
            <CardDescription>
              Criados quando você marca &quot;contar cliques&quot; num agendamento.
            </CardDescription>
          </div>
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
        </CardHeader>

        <CardContent className="pt-4 space-y-2">
          {carregando && <p className="text-sm text-muted-foreground">Carregando…</p>}

          {!carregando && links.length === 0 && (
            <div className="py-10 text-center text-muted-foreground border border-dashed border-border/50 rounded-lg bg-muted/10">
              <p>Nenhum link rastreado ainda.</p>
              <p className="text-xs mt-1">
                Marque &quot;contar cliques&quot; ao agendar uma mensagem com link.
              </p>
            </div>
          )}

          {links.map(l => (
            <div key={l.id} className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium truncate">
                    {l.label || l.url}
                  </p>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    {l.taxa !== null ? `${l.taxa}% do grupo` : 'cliques'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <code className="text-xs bg-muted/60 border border-border/50 rounded px-2 py-1 truncate">
                  /l/{l.code}
                </code>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {l.cliquesTotal !== l.cliquesNaJanela && (
                    <span className="text-xs text-muted-foreground">
                      {l.cliquesTotal} no total
                    </span>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => copiar(l.code)} title="Copiar link curto">
                    {copiado === l.code
                      ? <Check className="w-4 h-4 text-green-500" />
                      : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/40 bg-card/40">
        <CardContent className="pt-6 text-sm text-muted-foreground space-y-2">
          <p>
            <strong className="text-foreground">Um detalhe do WhatsApp:</strong> link
            encurtado não gera aquele cartão de pré-visualização com imagem e título.
            Se o visual do card importa mais que a métrica, deixe o link direto.
          </p>
          <p>
            Cada grupo recebe um código próprio para o mesmo endereço, então dá para
            comparar qual grupo respondeu melhor à mesma campanha.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
