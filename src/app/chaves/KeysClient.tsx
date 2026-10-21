'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from '@/components/ui/use-toast'
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
  const [chaveParaRevogar, setChaveParaRevogar] = useState<{ id: string; name: string } | null>(null)

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
      toast.success('Chave de API gerada com sucesso!', 'Chave Gerada')
      setNome('')
      setSenha('')
      carregar()
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setCriando(false)
    }
  }

  const executarRevogacao = async () => {
    if (!chaveParaRevogar) return
    const { id, name } = chaveParaRevogar
    setChaveParaRevogar(null)
    try {
      const res = await fetch(`/api/keys/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success(`Chave "${name}" revogada com sucesso.`)
        carregar()
      } else {
        toast.error('Não foi possível revogar a chave.')
      }
    } catch {
      toast.error('Erro de conexão ao revogar chave.')
    }
  }

  const copiar = async () => {
    if (!chaveNova) return
    try {
      await navigator.clipboard.writeText(chaveNova)
      setCopiado(true)
      toast.info('Chave copiada para a área de transferência.')
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* clipboard bloqueado */ }
  }

  const ativas = chaves.filter(c => !c.revokedAt)
  const revogadas = chaves.filter(c => c.revokedAt)

  return (
    <div className="space-y-6">
      {chaveNova && (
        <Alert variant="success" className="border-emerald-500/40 bg-emerald-950/20">
          <KeyRound className="h-4 w-4 text-emerald-400" />
          <div className="flex-1 space-y-2">
            <AlertTitle className="text-base font-semibold text-emerald-300">
              Chave de API criada
            </AlertTitle>
            <AlertDescription className="text-xs text-amber-400/90 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Copie agora. Ela não será exibida novamente — armazenamos apenas o hash criptográfico.
            </AlertDescription>
            <div className="flex items-center gap-2 pt-1">
              <code className="flex-1 text-xs bg-zinc-900 border border-zinc-700/60 rounded-lg p-3 font-mono break-all text-zinc-100 select-all">
                {chaveNova}
              </code>
              <Button variant="outline" size="icon" onClick={copiar} title="Copiar">
                {copiado ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </Alert>
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
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setChaveParaRevogar({ id: c.id, name: c.name })}
                title="Revogar"
                className="text-red-400 hover:text-red-300 hover:bg-red-950/30"
              >
                <Trash2 className="w-4 h-4" />
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

      {/* Confirmação de Revogação de Chave */}
      <AlertDialog open={!!chaveParaRevogar} onOpenChange={(open) => !open && setChaveParaRevogar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar Chave de API</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente revogar a chave &quot;{chaveParaRevogar?.name}&quot;? Serviços externos e integrações que utilizam esta chave perderão o acesso imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setChaveParaRevogar(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={executarRevogacao}
            >
              Revogar Chave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
