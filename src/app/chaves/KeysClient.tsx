'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { KeyRound, Copy, Check, Trash2, Loader2, AlertTriangle, Plug } from 'lucide-react'

type Chave = {
  id: string
  name: string
  prefix: string
  scopes: string
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

export default function KeysClient() {
  const [chaves, setChaves] = useState<Chave[]>([])
  const [carregando, setCarregando] = useState(true)

  const [nome, setNome] = useState('')
  const [senha, setSenha] = useState('')
  const [escopo, setEscopo] = useState('read,write')
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState('')

  // A chave em texto só existe aqui, uma vez, logo após a criação.
  const [chaveNova, setChaveNova] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const res = await fetch('/api/keys')
      if (res.ok) setChaves(await res.json())
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const criar = async (e: React.FormEvent) => {
    e.preventDefault()
    setCriando(true)
    setErro('')
    setChaveNova(null)

    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nome, password: senha, scopes: escopo })
      })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.error || 'Não foi possível criar a chave.')
        return
      }

      setChaveNova(data.key)
      setNome('')
      setSenha('')
      carregar()
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setCriando(false)
    }
  }

  const revogar = async (id: string, nomeChave: string) => {
    if (!confirm(`Revogar a chave "${nomeChave}"? Quem estiver usando perde o acesso na hora.`)) return
    await fetch(`/api/keys/${id}`, { method: 'DELETE' })
    carregar()
  }

  const copiar = async () => {
    if (!chaveNova) return
    try {
      await navigator.clipboard.writeText(chaveNova)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* clipboard bloqueado */ }
  }

  const ativas = chaves.filter(c => !c.revokedAt)
  const revogadas = chaves.filter(c => c.revokedAt)

  return (
    <div className="space-y-6">
      {chaveNova && (
        <Card className="border-green-500/40 bg-green-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-green-500" /> Chave criada
            </CardTitle>
            <CardDescription className="flex items-start gap-2 text-amber-500">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              Copie agora. Ela não vai aparecer de novo — guardamos apenas o hash.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted/60 border border-border/50 rounded-lg p-3 break-all">
                {chaveNova}
              </code>
              <Button variant="outline" size="icon" onClick={copiar} title="Copiar">
                {copiado ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/40 bg-card/40">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="w-5 h-5" /> Nova chave
          </CardTitle>
          <CardDescription>
            A senha da sua conta é exigida como confirmação.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={criar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chave-nome">Nome da chave</Label>
              <Input
                id="chave-nome"
                required
                placeholder="Ex.: integração n8n, assistente MCP"
                value={nome}
                onChange={e => setNome(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="chave-escopo">Permissão</Label>
              <Select value={escopo} onValueChange={setEscopo}>
                <SelectTrigger id="chave-escopo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read,write">Leitura e escrita</SelectItem>
                  <SelectItem value="read">Somente leitura</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chave-senha">Sua senha</Label>
              <Input
                id="chave-senha"
                type="password"
                required
                autoComplete="current-password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
              />
            </div>

            {erro && (
              <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                {erro}
              </p>
            )}

            <Button type="submit" disabled={criando}>
              {criando
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando…</>
                : <><KeyRound className="w-4 h-4 mr-2" /> Gerar chave</>}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/40 bg-card/40">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="text-base">Chaves ativas</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-2">
          {carregando && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!carregando && ativas.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma chave ativa.</p>
          )}

          {ativas.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/50 bg-muted/20">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  <code>{c.prefix}…</code> · {c.scopes === 'read' ? 'somente leitura' : 'leitura e escrita'}
                  {' · '}
                  {c.lastUsedAt
                    ? `usada em ${new Date(c.lastUsedAt).toLocaleString('pt-BR')}`
                    : 'nunca usada'}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => revogar(c.id, c.name)} title="Revogar">
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          ))}

          {revogadas.length > 0 && (
            <div className="pt-4 space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Revogadas</p>
              {revogadas.map(c => (
                <div key={c.id} className="p-3 rounded-xl border border-border/30 bg-muted/10 opacity-60">
                  <p className="text-sm truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <code>{c.prefix}…</code> · revogada em {new Date(c.revokedAt!).toLocaleString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/40 bg-card/40">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Plug className="w-4 h-4" /> Como usar
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3 text-sm">
          <p className="text-muted-foreground">
            Mande a chave no header <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded">Authorization</code> de
            qualquer rota da API:
          </p>
          <pre className="text-xs bg-muted/40 border border-border/50 rounded-lg p-3 overflow-x-auto">
            <code>{`curl -H "Authorization: Bearer aag_..." \\
  https://seu-dominio/api/instances`}</code>
          </pre>
          <p className="text-muted-foreground">
            O servidor MCP usa a mesma chave, em{' '}
            <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded">/api/mcp</code>.{' '}
            <a href="/documentacao#api" className="underline">Ver documentação completa</a>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
