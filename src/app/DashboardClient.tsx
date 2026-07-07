'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCcw, Plus, QrCode, Users, CalendarDays, Activity } from 'lucide-react'

export default function DashboardClient({ initialGroups }: { initialGroups: any[] }) {
  const [groups, setGroups] = useState(initialGroups)
  
  // Instance state
  const [instances, setInstances] = useState<any[]>([])
  const [selectedInstance, setSelectedInstance] = useState<string>('')
  const [connectionState, setConnectionState] = useState<string>('unknown')
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [qrCodeBase64, setQrCodeBase64] = useState<string>('')
  
  const [isInstanceModalOpen, setIsInstanceModalOpen] = useState(false)
  const [newInstance, setNewInstance] = useState({ instanceName: '', proxyHost: '', proxyPort: '', proxyProtocol: 'http', proxyUsername: '', proxyPassword: '' })
  const [newGroup, setNewGroup] = useState({ name: '', slug: '', description: '', participants: '', instanceName: '' })

  // Fetch instances on mount
  useEffect(() => {
    fetch('/api/instances')
      .then(res => res.json())
      .then(resData => {
        const data = Array.isArray(resData) ? resData : (resData.data || []);
        if (Array.isArray(data)) {
          setInstances(data)
          const saved = localStorage.getItem('selectedInstance')
          if (saved && data.find((i: any) => (i.instance?.instanceName || i.name) === saved)) {
            setSelectedInstance(saved)
          } else if (data.length > 0) {
            setSelectedInstance(data[0].instance?.instanceName || data[0].name || '')
          }
        }
      })
      .catch(console.error)
  }, [])

  // Poll connection state when an instance is selected
  useEffect(() => {
    if (!selectedInstance) return;
    
    localStorage.setItem('selectedInstance', selectedInstance);
    setNewGroup(prev => ({...prev, instanceName: selectedInstance}))

    const checkStatus = async () => {
      try {
        const selectedObj = instances.find(i => (i.instance?.instanceName || i.name) === selectedInstance)
        const token = selectedObj?.token || ''
        
        const res = await fetch(`/api/instances/${selectedInstance}/status`, {
          headers: { 'x-instance-token': token }
        })
        if (res.ok) {
          const data = await res.json()
          console.log("Status API Response:", data)
          
          let state = data.instance?.state || data.instance?.status || data.state || data.status || data.data?.state || 'unknown';
          if (typeof state === 'string') state = state.toLowerCase();

          // Se LoggedIn for falso, significa que não leu o QR Code ainda
          if (data.data?.LoggedIn === false) {
            state = 'close';
          } else if (state === 'close' || state === 'disconnected' || data.error || data.status === 'disconnected') {
            state = 'close';
          } else if (data.data?.Connected && state === 'unknown') {
            state = 'open';
          }
          
          setConnectionState(state)
        } else {
          setConnectionState('close')
        }
      } catch(e) {
        setConnectionState('error')
      }
    }

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [selectedInstance, instances])

  const handleOpenQrCode = async () => {
    if (!selectedInstance) return;
    try {
      setQrCodeBase64('');
      const selectedObj = instances.find(i => (i.instance?.instanceName || i.name) === selectedInstance)
      const token = selectedObj?.token || ''
      
      console.log("Solicitando QR Code para a instância:", selectedInstance)
      const res = await fetch(`/api/instances/${selectedInstance}/connect`, {
        headers: { 'x-instance-token': token }
      })
      
      if (res.ok) {
        const data = await res.json()
        console.log("QR Code API Response (Success):", data)
        const base64Str = data.base64 || data.qrcode?.base64 || data.data?.base64 || data.data?.qrcode?.base64 || data.data?.qrcode || data.qrcode || '';
        if (base64Str) {
          setQrCodeBase64(base64Str)
          setIsQrModalOpen(true)
        } else {
          alert("O QR Code não foi retornado pela API. Verifique o console para mais detalhes.")
        }
      } else {
        const errText = await res.text()
        console.error("QR Code API Error:", res.status, errText)
        alert("Erro ao buscar QR Code. Status: " + res.status)
      }
    } catch(e) {
      console.error("Erro interno ao buscar QR Code:", e)
      alert("Erro interno ao buscar QR Code.")
    }
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGroup)
      })
      if (res.ok) {
        const created = await res.json()
        setGroups([...groups, { ...created, _count: { members: 0, schedules: 0 } }])
        setIsModalOpen(false)
        setNewGroup({ name: '', slug: '', description: '', participants: '', instanceName: selectedInstance })
        alert("Grupo criado com sucesso!")
      } else {
        const err = await res.json()
        console.error("Erro ao criar grupo (API):", err)
        alert("Erro ao criar grupo: " + (err.error || err.details || "Desconhecido"))
      }
    } catch (err) {
      console.error(err)
      alert("Erro fatal ao criar grupo.")
    }
  }

  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/instances/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newInstance)
      })
      if (res.ok) {
        console.log("Instância criada com sucesso!")
        setIsInstanceModalOpen(false)
        setNewInstance({ instanceName: '', proxyHost: '', proxyPort: '', proxyProtocol: 'http', proxyUsername: '', proxyPassword: '' })
        window.location.reload()
      } else {
        const err = await res.json()
        console.error("Erro da Evolution API ao criar instância:", err)
        alert("Erro ao criar instância. Abra o console (F12) para ver os detalhes completos.")
      }
    } catch (err) {
      console.error("Falha na rede ao criar instância:", err)
      alert("Falha na rede ao tentar criar a instância.")
    }
  }

  const handleSyncGroups = async () => {
    if (!selectedInstance) return;
    try {
      const selectedObj = instances.find(i => (i.instance?.instanceName || i.name) === selectedInstance)
      const token = selectedObj?.token || ''
      const res = await fetch(`/api/instances/${selectedInstance}/sync-groups`, {
        method: 'POST',
        headers: { 'x-instance-token': token }
      });
      if (res.ok) {
        alert("Grupos sincronizados com sucesso!");
        window.location.reload();
      } else {
        alert("Erro ao sincronizar grupos.");
      }
    } catch(e) {
      alert("Erro ao sincronizar grupos.");
      console.error(e)
    }
  }

  const filteredGroups = selectedInstance ? groups.filter(g => g.instanceName === selectedInstance) : []
  const totalGroups = filteredGroups.length
  const totalMembers = filteredGroups.reduce((acc, g) => acc + (g._count?.members || 0), 0)
  const totalSchedules = filteredGroups.reduce((acc, g) => acc + (g._count?.schedules || 0), 0)

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Top Control Bar */}
      <Card className="border-border/40 shadow-sm bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Label className="font-semibold text-muted-foreground">Instância:</Label>
            <div className="flex gap-2">
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Selecione a instância..." />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((inst, i) => {
                    const name = inst.instance?.instanceName || inst.name;
                    return <SelectItem key={i} value={name}>{name}</SelectItem>
                  })}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => setIsInstanceModalOpen(true)} title="Nova Instância">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {selectedInstance && (
            <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-border/50 pt-4 md:pt-0 md:pl-4 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] ${connectionState === 'open' ? 'bg-green-500 text-green-500' : (connectionState === 'connecting' ? 'bg-yellow-400 text-yellow-400' : 'bg-red-500 text-red-500')}`} />
                <span className="text-sm font-medium">
                  {connectionState === 'open' ? 'Conectado' : (connectionState === 'connecting' ? 'Conectando...' : 'Desconectado')}
                </span>
              </div>
              
              {connectionState !== 'open' && (
                <Button variant="outline" size="sm" onClick={handleOpenQrCode} className="ml-auto md:ml-0">
                  <QrCode className="w-4 h-4 mr-2" />
                  QR Code
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/40 shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total de Grupos</p>
              <p className="text-3xl font-bold mt-1">{totalGroups}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-full">
              <Activity className="w-6 h-6 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40 shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Membros Gerenciados</p>
              <p className="text-3xl font-bold mt-1">{totalMembers}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-full">
              <Users className="w-6 h-6 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40 shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Agendamentos</p>
              <p className="text-3xl font-bold mt-1">{totalSchedules}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-full">
              <CalendarDays className="w-6 h-6 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Groups Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight">Meus Grupos</h2>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="secondary" onClick={handleSyncGroups} className="flex-1 sm:flex-none">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Sincronizar
            </Button>
            <Button onClick={() => setIsModalOpen(true)} className="flex-1 sm:flex-none">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map(g => (
            <Link href={`/${g.slug}`} key={g.id}>
              <Card className="group h-full border-border/40 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 bg-card/40 cursor-pointer">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  {g.picture ? (
                    <img src={g.picture} alt={g.name} className="w-12 h-12 rounded-lg object-cover ring-1 ring-border" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-lg ring-1 ring-border/50">
                      {g.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 overflow-hidden">
                    <CardTitle className="text-base truncate group-hover:text-primary transition-colors">{g.name}</CardTitle>
                    <CardDescription className="truncate text-xs">{g.description || 'Sem descrição'}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground bg-muted/30 p-2 rounded-md">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      {g._count.members}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {g._count.schedules}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {filteredGroups.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/10 rounded-lg border border-dashed border-border/50">
              <p>Nenhum grupo cadastrado nesta instância.</p>
              <Button variant="link" onClick={() => setIsModalOpen(true)}>Clique aqui para adicionar seu primeiro grupo</Button>
            </div>
          )}
        </div>
      </div>

      {/* Add Group Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px] w-[95vw] max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>Adicionar Grupo</DialogTitle>
            <DialogDescription>
              Insira os dados do grupo que deseja monitorar.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateGroup} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nome do Grupo</Label>
              <Input required placeholder="Ex: Comunidade VIP" value={newGroup.name} onChange={e => setNewGroup({...newGroup, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Slug (URL amigável)</Label>
              <Input required placeholder="comunidade-vip" value={newGroup.slug} onChange={e => setNewGroup({...newGroup, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})} />
            </div>
            <div className="space-y-2">
              <Label>Descrição (Opcional)</Label>
              <Input placeholder="Descrição breve..." value={newGroup.description} onChange={e => setNewGroup({...newGroup, description: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Participante (DDI + DDD + Num)</Label>
              <Input required placeholder="Ex: 5511999999999" value={newGroup.participants} onChange={e => setNewGroup({...newGroup, participants: e.target.value.replace(/\D/g, '')})} />
            </div>
            <div className="space-y-2">
              <Label>Nome da Instância</Label>
              <Input required readOnly className="bg-muted" value={newGroup.instanceName} onChange={e => setNewGroup({...newGroup, instanceName: e.target.value})} />
            </div>
            
            <DialogFooter className="pt-4 flex-col sm:flex-row gap-2">
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
              <Button type="submit" className="w-full sm:w-auto">Salvar Grupo</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
        <DialogContent className="sm:max-w-[400px] w-[95vw] max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-center">Conectar WhatsApp</DialogTitle>
            <DialogDescription className="text-center">
              Abra o WhatsApp, vá em "Aparelhos Conectados" e escaneie o código abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6">
            {qrCodeBase64 ? (
              <div className="bg-white p-4 rounded-xl shadow-lg">
                <img src={qrCodeBase64.startsWith('data:image') ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`} alt="QR Code" className="w-64 h-64" />
              </div>
            ) : (
              <div className="w-64 h-64 bg-muted animate-pulse rounded-xl flex items-center justify-center">
                <span className="text-muted-foreground text-sm">Gerando QR Code...</span>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row sm:justify-center gap-2">
            <Button variant="outline" onClick={() => { setQrCodeBase64(''); handleOpenQrCode(); }} className="w-full sm:w-auto">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
            <Button variant="secondary" onClick={() => setIsQrModalOpen(false)} className="w-full sm:w-auto">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Instance Dialog */}
      <Dialog open={isInstanceModalOpen} onOpenChange={setIsInstanceModalOpen}>
        <DialogContent className="sm:max-w-[425px] w-[95vw] max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>Nova Instância (Evolution API)</DialogTitle>
            <DialogDescription>
              Crie uma nova instância para conectar um número de WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateInstance} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nome da Instância</Label>
              <Input required placeholder="Ex: suporte_1" value={newInstance.instanceName} onChange={e => setNewInstance({...newInstance, instanceName: e.target.value})} />
            </div>
            
            <div className="p-4 border border-border/50 bg-muted/10 rounded-lg space-y-4">
              <Label className="text-sm font-semibold text-muted-foreground">Configuração de Proxy (Opcional)</Label>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs">Host</Label>
                  <Input placeholder="ip_ou_dominio" value={newInstance.proxyHost} onChange={e => setNewInstance({...newInstance, proxyHost: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Porta</Label>
                  <Input placeholder="80" type="number" value={newInstance.proxyPort} onChange={e => setNewInstance({...newInstance, proxyPort: e.target.value})} />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs">Protocolo</Label>
                <Select value={newInstance.proxyProtocol} onValueChange={v => setNewInstance({...newInstance, proxyProtocol: v})}>
                  <SelectTrigger><SelectValue placeholder="http" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="https">HTTPS</SelectItem>
                    <SelectItem value="socks5">SOCKS5</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs">Usuário</Label>
                  <Input placeholder="opcional" value={newInstance.proxyUsername} onChange={e => setNewInstance({...newInstance, proxyUsername: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Senha</Label>
                  <Input type="password" placeholder="opcional" value={newInstance.proxyPassword} onChange={e => setNewInstance({...newInstance, proxyPassword: e.target.value})} />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4 flex-col sm:flex-row gap-2">
              <Button type="button" variant="secondary" onClick={() => setIsInstanceModalOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
              <Button type="submit" className="w-full sm:w-auto">Criar Instância</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
