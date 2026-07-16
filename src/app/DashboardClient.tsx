'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCcw, Plus, QrCode, Users, CalendarDays, Activity, ClipboardPaste, CheckCircle2, AlertCircle, Clock, PowerOff, Upload, Trash2, Edit } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import { useRef } from 'react'

const ScrollDial = ({ max, value, onChange }: { max: number, value: number, onChange: (v: number) => void }) => {
  const [offset, setOffset] = useState(value * 40);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const currentOffset = useRef(value * 40);
  
  useEffect(() => {
    if (!isDragging) {
      setOffset(value * 40);
      currentOffset.current = value * 40;
    }
  }, [value, isDragging]);

  const clamp = (val: number) => Math.max(0, Math.min(max * 40, val));

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    startY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaY = startY.current - e.clientY;
    startY.current = e.clientY;
    currentOffset.current = clamp(currentOffset.current + deltaY);
    setOffset(currentOffset.current);
    
    const index = Math.round(currentOffset.current / 40);
    if (index !== value) onChange(index);
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    const index = Math.round(currentOffset.current / 40);
    const snappedOffset = index * 40;
    setOffset(snappedOffset);
    currentOffset.current = snappedOffset;
    if (index !== value) onChange(index);
  }
  
  const handleWheel = (e: React.WheelEvent) => {
    let delta = e.deltaY;
    if (Math.abs(delta) > 40) {
      delta = Math.sign(delta) * 40;
    }
    const newOffset = clamp(currentOffset.current + delta);
    currentOffset.current = newOffset;
    setOffset(newOffset);
    
    const index = Math.round(newOffset / 40);
    if (index !== value) onChange(index);
  }

  return (
    <div 
      className="h-[120px] w-16 border border-border/50 rounded-lg bg-card shadow-inner relative overflow-hidden select-none cursor-ns-resize"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      style={{ touchAction: 'none' }}
    >
      <div 
        className="absolute top-0 left-0 w-full"
        style={{ 
          transform: `translateY(${40 - offset}px)`,
          transition: isDragging ? 'none' : 'transform 0.15s ease-out'
        }}
      >
        {Array.from({length: max + 1}).map((_, i) => {
          const distance = Math.abs(offset - i * 40);
          const isCenter = distance < 20;
          return (
            <div 
              key={i} 
              className={`h-[40px] flex items-center justify-center text-lg transition-all ${isCenter ? 'text-primary font-bold scale-110' : 'text-muted-foreground scale-90 opacity-40 hover:opacity-80 hover:scale-100'}`}
              onClick={() => {
                if (!isDragging) {
                  currentOffset.current = i * 40;
                  setOffset(i * 40);
                  onChange(i);
                }
              }}
            >
              {i.toString().padStart(2, '0')}
            </div>
          )
        })}
      </div>
      <div className="absolute top-[40px] left-0 w-full h-[40px] border-y border-primary/20 pointer-events-none bg-primary/5" />
    </div>
  )
}

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

  // Mass Paste State
  const [isMassPasteModalOpen, setIsMassPasteModalOpen] = useState(false)
  const [massPasteText, setMassPasteText] = useState('')
  const [massPasteError, setMassPasteError] = useState('')
  const [selectedGroupsForPaste, setSelectedGroupsForPaste] = useState<string[]>([])
  const [isPasting, setIsPasting] = useState(false)
  const [searchTermPaste, setSearchTermPaste] = useState('')

  // Mass Create State
  const [isMassCreateModalOpen, setIsMassCreateModalOpen] = useState(false)
  const [selectedGroupsForCreate, setSelectedGroupsForCreate] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [searchTermCreate, setSearchTermCreate] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  
  const getEmptySchedule = () => ({ 
    type: 'text', 
    text: '', 
    mediaUrl: '', 
    mediatype: 'image',
    caption: '',
    fileName: '',
    title: '',
    description: '',
    footer: '',
    buttonsList: [{ type: 'reply', displayText: 'Sim', id: 'btn1' }] as any[],
    pollName: '',
    pollOptions: 'Opção 1, Opção 2',
    scheduledAt: '' 
  })
  
  const [newSchedules, setNewSchedules] = useState([getEmptySchedule()])

  const updateSchedule = (index: number, updates: any) => {
    setNewSchedules(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s))
  }

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

  const validatePastedJSON = (text: string) => {
    try {
      if (!text.trim()) return "Vazio"
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) return "O JSON deve ser um array."
      if (parsed.length === 0) return "Array vazio."
      
      for (const item of parsed) {
        if (!item.type || !item.content || !item.scheduledAt) {
          return "Cada item deve ter type, content e scheduledAt."
        }
      }
      return "" // Sucesso
    } catch (e) {
      return "JSON inválido."
    }
  }

  const handleMassPasteClick = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const err = validatePastedJSON(text)
      setMassPasteText(text)
      setMassPasteError(err || "")
      setSelectedGroupsForPaste([])
      setIsMassPasteModalOpen(true)
    } catch (err) {
      setMassPasteText('')
      setMassPasteError("Cole o código JSON aqui")
      setSelectedGroupsForPaste([])
      setIsMassPasteModalOpen(true)
    }
  }

  const handleMassPasteSubmit = async () => {
    if (massPasteError || selectedGroupsForPaste.length === 0) return
    setIsPasting(true)
    try {
      const schedulesToPaste = JSON.parse(massPasteText)
      let insertedCount = 0
      
      for (const sched of schedulesToPaste) {
        const payload = {
          groupIds: selectedGroupsForPaste,
          type: sched.type,
          content: sched.content,
          scheduledAt: sched.scheduledAt,
          status: 'pending'
        }
        const res = await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (res.ok) {
          insertedCount++
        }
      }
      
      alert(`${insertedCount} agendamento(s) colado(s) com sucesso em ${selectedGroupsForPaste.length} grupo(s)!`)
      setIsMassPasteModalOpen(false)
      window.location.reload()
    } catch (e) {
      alert("Erro ao colar agendamentos.")
    } finally {
      setIsPasting(false)
    }
  }

  const handleMassCreateClick = () => {
    setSelectedGroupsForCreate([])
    setNewSchedules([getEmptySchedule()])
    setIsMassCreateModalOpen(true)
  }

  const handlePasteIntoCreate = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text) return
      const parsed = JSON.parse(text)
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      
      const newItems = arr.map(item => {
        return {
          type: item.type || 'text',
          text: item.type === 'text' ? item.content?.text || '' : '',
          mediaUrl: (item.type === 'media' || item.type === 'button') ? (item.content?.media || item.content?.imageUrl || item.content?.videoUrl || '') : '',
          mediatype: item.type === 'media' ? (item.content?.mediatype || 'image') : (item.content?.videoUrl ? 'video' : 'image'),
          caption: item.content?.caption || '',
          fileName: item.content?.fileName || '',
          title: item.content?.title || '',
          description: item.content?.description || '',
          footer: item.content?.footer || '',
          buttonsList: item.content?.buttons && item.content.buttons.length > 0 ? item.content.buttons : [{ type: 'reply', displayText: 'Sim', id: 'btn1' }],
          pollName: item.content?.name || '',
          pollOptions: item.content?.values ? item.content.values.join(', ') : 'Opção 1, Opção 2',
          scheduledAt: item.scheduledAt ? new Date(item.scheduledAt).toISOString().slice(0, 16) : ''
        }
      })
      
      setNewSchedules(prev => {
        if (prev.length === 1 && prev[0].type === 'text' && !prev[0].text && !prev[0].scheduledAt) {
          return newItems
        }
        return [...prev, ...newItems]
      })
    } catch (e) {
      alert("Erro ao colar: O texto na área de transferência não é um JSON válido de agendamento.")
    }
  }

  const handleMassCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedGroupsForCreate.length === 0) {
      alert("Selecione pelo menos um grupo destino.")
      return
    }

    for (const schedule of newSchedules) {
      if (!schedule.scheduledAt) {
        alert("Preencha a Data e Hora para todas as mensagens.")
        return
      }
    }

    setIsCreating(true)
    
    try {
      let insertedCount = 0
      for (const groupId of selectedGroupsForCreate) {
        for (const schedule of newSchedules) {
          let content: any = {}
          
          if (schedule.type === 'text') {
            content = { text: schedule.text }
          } else if (schedule.type === 'media') {
            content = { 
              mediatype: schedule.mediatype, 
              media: schedule.mediaUrl, 
              caption: schedule.caption,
              fileName: schedule.fileName
            }
          } else if (schedule.type === 'button') {
            content = {
              title: schedule.title,
              description: schedule.description,
              footer: schedule.footer,
              buttons: schedule.buttonsList
            }
            const hasCTA = schedule.buttonsList.some((b: any) => b.type !== 'reply')
            if (!hasCTA && schedule.mediaUrl) {
              if (schedule.mediatype === 'video') {
                content.videoUrl = schedule.mediaUrl
              } else {
                content.imageUrl = schedule.mediaUrl
              }
            }
          } else if (schedule.type === 'poll') {
            const opts = schedule.pollOptions.split(',').map(o => o.trim()).filter(Boolean);
            content = {
              name: schedule.pollName,
              selectableCount: 1,
              values: opts
            }
          }

          const payload = {
            groupId: groupId,
            type: schedule.type,
            content,
            scheduledAt: new Date(schedule.scheduledAt).toISOString(),
            status: 'pending'
          }
          
          const res = await fetch('/api/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
          if (res.ok) {
            insertedCount++
          }
        }
      }
      
      alert(`${insertedCount} agendamento(s) criado(s) com sucesso em ${selectedGroupsForCreate.length} grupo(s)!`)
      setIsMassCreateModalOpen(false)
      window.location.reload()
    } catch (err) {
      console.error(err)
      alert("Erro ao criar agendamentos em massa.")
    } finally {
      setIsCreating(false)
    }
  }

  const filteredGroups = selectedInstance 
    ? groups.filter(g => g.instanceName === selectedInstance).sort((a, b) => a.name.localeCompare(b.name)) 
    : []
    
  const filteredGroupsForPaste = filteredGroups.filter(g => g.name.toLowerCase().includes(searchTermPaste.toLowerCase()))
  const filteredGroupsForCreate = filteredGroups.filter(g => g.name.toLowerCase().includes(searchTermCreate.toLowerCase()))
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
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            <Button variant="outline" onClick={handleMassPasteClick} className="flex-none text-primary border-primary hover:bg-primary/10">
              <ClipboardPaste className="w-4 h-4 mr-2" />
              Colar
            </Button>
            <Button onClick={handleMassCreateClick} className="flex-none">
              <Edit className="w-4 h-4 mr-2" />
              Criar em Massa
            </Button>
            <Button variant="secondary" onClick={handleSyncGroups} className="flex-none">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Sincronizar
            </Button>
            <Button variant="outline" onClick={() => setIsModalOpen(true)} className="flex-none">
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
                  <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground bg-muted/30 p-2 rounded-md mb-2">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      {g._count.members}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {g._count.schedules}
                    </div>
                  </div>
                  
                  {/* Status Badges */}
                  <div className="grid grid-cols-4 gap-1 text-[10px] text-center font-bold">
                    {(() => {
                      const sent = g.schedules?.filter((s: any) => s.status === 'sent').length || 0;
                      const pending = g.schedules?.filter((s: any) => s.status === 'pending').length || 0;
                      const error = g.schedules?.filter((s: any) => s.status === 'error').length || 0;
                      const deactivated = g.schedules?.filter((s: any) => s.status === 'deactivated').length || 0;
                      
                      return (
                        <>
                          <div className="bg-green-500/10 text-green-500 rounded p-1 flex flex-col items-center justify-center border border-green-500/20" title="Enviadas">
                            <CheckCircle2 className="w-3.5 h-3.5 mb-0.5" /> {sent}
                          </div>
                          <div className="bg-primary/10 text-primary rounded p-1 flex flex-col items-center justify-center border border-primary/20" title="Pendentes">
                            <Clock className="w-3.5 h-3.5 mb-0.5" /> {pending}
                          </div>
                          <div className="bg-red-500/10 text-red-500 rounded p-1 flex flex-col items-center justify-center border border-red-500/20" title="Falhas">
                            <AlertCircle className="w-3.5 h-3.5 mb-0.5" /> {error}
                          </div>
                          <div className="bg-muted text-muted-foreground rounded p-1 flex flex-col items-center justify-center border border-border" title="Desativadas">
                            <PowerOff className="w-3.5 h-3.5 mb-0.5" /> {deactivated}
                          </div>
                        </>
                      )
                    })()}
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

      {/* Mass Paste Dialog */}
      <Dialog open={isMassPasteModalOpen} onOpenChange={setIsMassPasteModalOpen}>
        <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>Colar Agendamentos em Massa</DialogTitle>
            <DialogDescription>
              Cole o JSON copiado de outro grupo e selecione os grupos de destino.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>JSON dos Agendamentos</Label>
              <Textarea 
                value={massPasteText} 
                onChange={e => {
                  setMassPasteText(e.target.value)
                  setMassPasteError(validatePastedJSON(e.target.value))
                }} 
                rows={4} 
                className={massPasteError ? "border-red-500" : ""}
                placeholder="[{...}]"
              />
              {massPasteError && <p className="text-xs text-red-500 font-medium">{massPasteError}</p>}
            </div>
            
            <div className="space-y-2">
              <Label>Buscar Grupo</Label>
              <Input placeholder="Filtrar por nome..." value={searchTermPaste} onChange={e => setSearchTermPaste(e.target.value)} />
            </div>
            
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <Label>Selecione os Grupos Destino</Label>
                <Button variant="ghost" size="sm" onClick={() => {
                  const currentIds = filteredGroupsForPaste.map(g => g.id);
                  const allSelected = currentIds.length > 0 && currentIds.every(id => selectedGroupsForPaste.includes(id));
                  if (allSelected) {
                    setSelectedGroupsForPaste(selectedGroupsForPaste.filter(id => !currentIds.includes(id)))
                  } else {
                    const newSelection = new Set([...selectedGroupsForPaste, ...currentIds]);
                    setSelectedGroupsForPaste(Array.from(newSelection))
                  }
                }}>
                  {filteredGroupsForPaste.length > 0 && filteredGroupsForPaste.every(g => selectedGroupsForPaste.includes(g.id)) ? 'Desmarcar Listados' : 'Selecionar Listados'}
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto p-2 border border-border/50 rounded-md bg-muted/10">
                {filteredGroupsForPaste.map(g => (
                  <label key={g.id} className="flex items-start space-x-3 p-3 hover:bg-muted/50 rounded cursor-pointer border border-border/40">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-primary focus:ring-primary mt-0.5"
                      checked={selectedGroupsForPaste.includes(g.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedGroupsForPaste([...selectedGroupsForPaste, g.id])
                        } else {
                          setSelectedGroupsForPaste(selectedGroupsForPaste.filter(id => id !== g.id))
                        }
                      }}
                    />
                    <span className="text-sm font-medium whitespace-normal break-words leading-tight flex-1">{g.name}</span>
                  </label>
                ))}
                {filteredGroupsForPaste.length === 0 && (
                  <div className="col-span-full text-center text-xs text-muted-foreground p-4">
                    Nenhum grupo encontrado nesta instância.
                  </div>
                )}
              </div>
            </div>
            
            <DialogFooter className="pt-4 flex-col sm:flex-row gap-2">
              <Button variant="secondary" onClick={() => setIsMassPasteModalOpen(false)} className="w-full sm:w-auto" disabled={isPasting}>Cancelar</Button>
              <Button 
                onClick={handleMassPasteSubmit} 
                className="w-full sm:w-auto" 
                disabled={!!massPasteError || selectedGroupsForPaste.length === 0 || isPasting}
              >
                {isPasting ? 'Agendando...' : `Agendar em ${selectedGroupsForPaste.length} grupo(s)`}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mass Create Dialog */}
      <Dialog open={isMassCreateModalOpen} onOpenChange={setIsMassCreateModalOpen}>
        <DialogContent className="sm:max-w-[550px] w-[95vw] max-h-[85vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>Criar Agendamento em Massa</DialogTitle>
            <DialogDescription>
              Crie uma mensagem nova e selecione em quais grupos deseja agendá-la.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMassCreateSubmit} className="space-y-4 pt-4">
            {newSchedules.map((schedule, index) => (
              <div key={index} className="space-y-4 border border-border/60 p-4 rounded-xl bg-card relative mb-6">
                {newSchedules.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" className="absolute top-2 right-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setNewSchedules(newSchedules.filter((_, i) => i !== index))}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                <div className="space-y-2 pr-8">
                  <Label>Tipo de Mensagem {index + 1}</Label>
                  <Select value={schedule.type} onValueChange={v => updateSchedule(index, { type: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto Simples</SelectItem>
                      <SelectItem value="media">Mídia (Imagem, Vídeo, Áudio, Doc)</SelectItem>
                      <SelectItem value="button">Botões (Interativo)</SelectItem>
                      <SelectItem value="poll">Enquete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {schedule.type === 'text' && (
                  <div className="space-y-2">
                    <Label>Mensagem</Label>
                    <Textarea required placeholder="Digite sua mensagem aqui..." value={schedule.text} onChange={e => updateSchedule(index, { text: e.target.value })} rows={5} className="resize-none" />
                  </div>
                )}

                {schedule.type === 'media' && (
                  <div 
                    className="space-y-4 border border-border/50 p-4 rounded-lg bg-muted/10 transition-colors"
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-primary/10', 'border-primary') }}
                    onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('bg-primary/10', 'border-primary') }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('bg-primary/10', 'border-primary');
                      const file = e.dataTransfer.files?.[0];
                      if(!file) return;
                      setIsUploading(true);
                      setUploadError('');
                      const fd = new FormData(); fd.append('file', file);
                      try {
                        const res = await fetch('/api/upload', {method:'POST', body:fd});
                        const data = await res.json();
                        if (res.ok && data.success) {
                          updateSchedule(index, { mediaUrl: data.url });
                        } else {
                          setUploadError(data.error || 'Erro no servidor ao realizar upload.');
                        }
                      } catch(err: any) {
                        setUploadError(err.message || 'Erro na conexão.');
                      } finally {
                        setIsUploading(false);
                      }
                    }}
                  >
                    <div className="space-y-2">
                      <Label>Tipo de Mídia</Label>
                      <Select value={schedule.mediatype} onValueChange={v => updateSchedule(index, { mediatype: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Tipo de mídia..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="image">Imagem</SelectItem>
                          <SelectItem value="video">Vídeo</SelectItem>
                          <SelectItem value="audio">Áudio</SelectItem>
                          <SelectItem value="document">Documento PDF/ZIP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>URL da Mídia ou Upload</Label>
                      <div className="flex gap-2">
                        <Input required placeholder="https://..." value={schedule.mediaUrl} onChange={e => updateSchedule(index, { mediaUrl: e.target.value })} />
                        <input type="file" id={`mediaUploadMass-${index}`} className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if(!file) return;
                          
                          setIsUploading(true);
                          setUploadError('');
                          
                          const fd = new FormData(); fd.append('file', file);
                          try {
                            const res = await fetch('/api/upload', {method:'POST', body:fd});
                            const data = await res.json();
                            if (res.ok && data.success) {
                              updateSchedule(index, { mediaUrl: data.url });
                            } else {
                              setUploadError(data.error || 'Erro interno no servidor ao realizar upload.');
                            }
                          } catch(err: any) {
                            setUploadError(err.message || 'Erro na conexão de upload');
                          } finally {
                            setIsUploading(false);
                          }
                        }}/>
                        <Button type="button" variant="secondary" onClick={() => document.getElementById(`mediaUploadMass-${index}`)?.click()} disabled={isUploading}>
                          {isUploading ? <span className="text-xs">⏳</span> : <Upload className="w-4 h-4" />}
                        </Button>
                      </div>
                      {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>Legenda (Opcional)</Label>
                      <Textarea placeholder="Legenda da mídia..." value={schedule.caption} onChange={e => updateSchedule(index, { caption: e.target.value })} rows={2} />
                    </div>

                    {schedule.mediatype === 'document' && (
                      <div className="space-y-2">
                        <Label>Nome do Arquivo (Obrigatório)</Label>
                        <Input required placeholder="relatorio_final.pdf" value={schedule.fileName} onChange={e => updateSchedule(index, { fileName: e.target.value })} />
                      </div>
                    )}
                  </div>
                )}

                {schedule.type === 'button' && (
                  <div className="space-y-4 border border-border/50 p-4 rounded-lg bg-muted/10">
                    <div className="space-y-2">
                      <Label>Título Principal</Label>
                      <Input required placeholder="Ex: Oferta Especial!" value={schedule.title} onChange={e => updateSchedule(index, { title: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea required placeholder="Detalhes da oferta..." value={schedule.description} onChange={e => updateSchedule(index, { description: e.target.value })} rows={2} />
                    </div>
                    <div className="space-y-2">
                      <Label>Rodapé (Opcional)</Label>
                      <Input placeholder="Válido até amanhã" value={schedule.footer} onChange={e => updateSchedule(index, { footer: e.target.value })} />
                    </div>
                    
                    {/* Midia Opcional */}
                    {!schedule.buttonsList.some((b:any)=>b.type!=='reply') && (
                      <div className="p-3 border border-border bg-background rounded-lg space-y-3">
                        <Label className="text-xs text-muted-foreground font-semibold">Anexar Mídia (Opcional)</Label>
                        <div className="flex gap-2">
                          <Select value={schedule.mediatype} onValueChange={v => updateSchedule(index, { mediatype: v })}>
                            <SelectTrigger className="w-[120px]">
                              <SelectValue placeholder="Mídia..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="image">Imagem</SelectItem>
                              <SelectItem value="video">Vídeo</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input placeholder="URL da Mídia" value={schedule.mediaUrl} onChange={e => updateSchedule(index, { mediaUrl: e.target.value })} />
                        </div>
                      </div>
                    )}

                    <div className="pt-2 space-y-3">
                      <Label className="font-semibold text-sm">Botões (Max 3)</Label>
                      {schedule.buttonsList.map((btn: any, btnIndex: number) => (
                        <div key={btnIndex} className="p-3 border border-border/50 bg-background rounded-lg space-y-3 relative group">
                          <div className="flex justify-between items-center">
                            <Select value={btn.type} onValueChange={v => {
                              const list = [...schedule.buttonsList];
                              list[btnIndex] = {...btn, type: v};
                              updateSchedule(index, { buttonsList: list });
                            }}>
                              <SelectTrigger className="w-[160px] h-8 border-none bg-transparent text-primary hover:bg-muted/50 font-medium focus:ring-0 px-2">
                                <SelectValue placeholder="Tipo..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="reply">Resposta Rápida</SelectItem>
                                <SelectItem value="url">Link Externo</SelectItem>
                                <SelectItem value="call">Ligar</SelectItem>
                                <SelectItem value="copy">Copiar Texto</SelectItem>
                              </SelectContent>
                            </Select>
                            {schedule.buttonsList.length > 1 && (
                              <button type="button" onClick={() => {
                                const list = schedule.buttonsList.filter((_,i) => i!==btnIndex);
                                updateSchedule(index, { buttonsList: list });
                              }} className="text-destructive opacity-50 hover:opacity-100 transition-opacity">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          
                          <Input required placeholder="Texto do botão (ex: Comprar)" value={btn.displayText||''} onChange={e => {
                            const list = [...schedule.buttonsList]; list[btnIndex] = {...btn, displayText: e.target.value}; updateSchedule(index, { buttonsList: list });
                          }} className="h-8" />
                          
                          {btn.type === 'reply' && <Input required placeholder="ID interno (ex: btn_comprar)" value={btn.id||''} onChange={e => {
                            const list = [...schedule.buttonsList]; list[btnIndex] = {...btn, id: e.target.value}; updateSchedule(index, { buttonsList: list });
                          }} className="h-8" />}
                          
                          {btn.type === 'url' && <Input required placeholder="https://..." value={btn.url||''} onChange={e => {
                            const list = [...schedule.buttonsList]; list[btnIndex] = {...btn, url: e.target.value}; updateSchedule(index, { buttonsList: list });
                          }} className="h-8" />}
                          
                          {btn.type === 'call' && <Input required placeholder="+5511999999999" value={btn.phoneNumber||''} onChange={e => {
                            const list = [...schedule.buttonsList]; list[btnIndex] = {...btn, phoneNumber: e.target.value}; updateSchedule(index, { buttonsList: list });
                          }} className="h-8" />}
                          
                          {btn.type === 'copy' && <Input required placeholder="Texto para copiar..." value={btn.copyCode||''} onChange={e => {
                            const list = [...schedule.buttonsList]; list[btnIndex] = {...btn, copyCode: e.target.value}; updateSchedule(index, { buttonsList: list });
                          }} className="h-8" />}
                        </div>
                      ))}
                      {schedule.buttonsList.length < 3 && (
                        <Button type="button" variant="secondary" size="sm" className="w-full border-dashed" onClick={() => {
                          updateSchedule(index, { buttonsList: [...schedule.buttonsList, {type:'reply', displayText:'', id:'btn'+Date.now()}] });
                        }}>+ Adicionar Botão</Button>
                      )}
                    </div>
                  </div>
                )}

                {schedule.type === 'poll' && (
                  <div className="space-y-4 border border-border/50 p-4 rounded-lg bg-muted/10">
                    <div className="space-y-2">
                      <Label>Pergunta da Enquete</Label>
                      <Input required placeholder="Ex: Qual o melhor horário?" value={schedule.pollName} onChange={e => updateSchedule(index, { pollName: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Opções (Separadas por vírgula)</Label>
                      <Input required placeholder="Manhã, Tarde, Noite" value={schedule.pollOptions} onChange={e => updateSchedule(index, { pollOptions: e.target.value })} />
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-border/50 flex flex-col">
                  <Label>Data e Hora do Envio</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !schedule.scheduledAt && "text-muted-foreground"
                        )}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {schedule.scheduledAt ? (
                          new Date(schedule.scheduledAt).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
                        ) : (
                          <span>Escolha uma data e horário</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[95vw] sm:w-auto p-0 max-h-[85vh] overflow-y-auto rounded-xl" align="center">
                      <Calendar
                        mode="single"
                        selected={schedule.scheduledAt ? new Date(schedule.scheduledAt) : undefined}
                        onSelect={(d) => {
                          if (d) {
                             const current = schedule.scheduledAt ? new Date(schedule.scheduledAt) : new Date();
                             d.setHours(current.getHours());
                             d.setMinutes(current.getMinutes());
                             const tzOffset = d.getTimezoneOffset() * 60000;
                             const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
                             updateSchedule(index, { scheduledAt: localISOTime });
                          }
                        }}
                      />
                      <div className="p-4 border-t border-border flex flex-col items-center justify-center gap-3 bg-muted/20">
                        <Label className="text-sm font-semibold w-full text-center text-muted-foreground">Selecione o Horário</Label>
                        <div className="flex items-center gap-4">
                          <ScrollDial 
                            max={23} 
                            value={schedule.scheduledAt ? parseInt(schedule.scheduledAt.split('T')[1]?.split(':')[0] || '12', 10) : 12}
                            onChange={(h) => {
                              let m = schedule.scheduledAt ? schedule.scheduledAt.split('T')[1]?.split(':')[1] : '00';
                              if (!m) m = '00';
                              
                              let localDate = schedule.scheduledAt ? schedule.scheduledAt.split('T')[0] : '';
                              if (!localDate) {
                                const today = new Date();
                                const tzOffset = today.getTimezoneOffset() * 60000;
                                localDate = new Date(today.getTime() - tzOffset).toISOString().split('T')[0];
                              }
                              
                              updateSchedule(index, { scheduledAt: `${localDate}T${h.toString().padStart(2, '0')}:${m}` });
                            }}
                          />
                          <span className="text-2xl font-bold text-muted-foreground/50">:</span>
                          <ScrollDial 
                            max={59} 
                            value={schedule.scheduledAt ? parseInt(schedule.scheduledAt.split('T')[1]?.split(':')[1] || '0', 10) : 0}
                            onChange={(m) => {
                              let h = schedule.scheduledAt ? schedule.scheduledAt.split('T')[1]?.split(':')[0] : '12';
                              if (!h) h = '12';
                              
                              let localDate = schedule.scheduledAt ? schedule.scheduledAt.split('T')[0] : '';
                              if (!localDate) {
                                const today = new Date();
                                const tzOffset = today.getTimezoneOffset() * 60000;
                                localDate = new Date(today.getTime() - tzOffset).toISOString().split('T')[0];
                              }
                              
                              updateSchedule(index, { scheduledAt: `${localDate}T${h}:${m.toString().padStart(2, '0')}` });
                            }}
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            ))}
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" className="w-full border-dashed flex-1" onClick={() => setNewSchedules([...newSchedules, getEmptySchedule()])}>
                <Plus className="w-4 h-4 mr-2" /> Adicionar Outra Mensagem
              </Button>
              <Button type="button" variant="outline" className="w-full border-dashed flex-1 text-primary hover:text-primary hover:bg-primary/10 border-primary/50" onClick={handlePasteIntoCreate}>
                <ClipboardPaste className="w-4 h-4 mr-2" /> Colar JSON (Área de Transf.)
              </Button>
            </div>

            <div className="space-y-2 pt-4 border-t border-border/50">
              <Label>Buscar Grupo</Label>
              <Input placeholder="Filtrar por nome..." value={searchTermCreate} onChange={e => setSearchTermCreate(e.target.value)} />
              
              <div className="flex items-center justify-between pt-2">
                <Label>Selecione os Grupos Destino</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => {
                  const currentIds = filteredGroupsForCreate.map(g => g.id);
                  const allSelected = currentIds.length > 0 && currentIds.every(id => selectedGroupsForCreate.includes(id));
                  if (allSelected) {
                    setSelectedGroupsForCreate(selectedGroupsForCreate.filter(id => !currentIds.includes(id)))
                  } else {
                    const newSelection = new Set([...selectedGroupsForCreate, ...currentIds]);
                    setSelectedGroupsForCreate(Array.from(newSelection))
                  }
                }}>
                  {filteredGroupsForCreate.length > 0 && filteredGroupsForCreate.every(g => selectedGroupsForCreate.includes(g.id)) ? 'Desmarcar Listados' : 'Selecionar Listados'}
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto p-2 border border-border/50 rounded-md bg-muted/10">
                {filteredGroupsForCreate.map(g => (
                  <label key={g.id} className="flex items-start space-x-3 p-3 hover:bg-muted/50 rounded cursor-pointer border border-border/40">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-primary focus:ring-primary mt-0.5"
                      checked={selectedGroupsForCreate.includes(g.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedGroupsForCreate([...selectedGroupsForCreate, g.id])
                        } else {
                          setSelectedGroupsForCreate(selectedGroupsForCreate.filter(id => id !== g.id))
                        }
                      }}
                    />
                    <span className="text-sm font-medium whitespace-normal break-words leading-tight flex-1">{g.name}</span>
                  </label>
                ))}
                {filteredGroupsForCreate.length === 0 && (
                  <div className="col-span-full text-center text-xs text-muted-foreground p-4">
                    Nenhum grupo encontrado nesta instância.
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-4 flex-col sm:flex-row gap-2">
              <Button type="button" variant="secondary" onClick={() => setIsMassCreateModalOpen(false)} className="w-full sm:w-auto" disabled={isCreating}>Cancelar</Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={selectedGroupsForCreate.length === 0 || isCreating}>
                {isCreating ? 'Agendando...' : `Criar ${newSchedules.length} agendamento(s) em ${selectedGroupsForCreate.length} grupo(s)`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
