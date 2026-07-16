'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import { ArrowLeft, UserCircle2, Settings, MessageSquare, CalendarDays, Upload, Eye, EyeOff, Edit, Trash2, Power, PowerOff, Image as ImageIcon, Edit3, Copy, ClipboardPaste, CheckCircle2, AlertCircle, Send } from 'lucide-react'

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

export default function GroupClient({ initialGroup }: { initialGroup: any }) {
  const [schedules, setSchedules] = useState(initialGroup.schedules || [])
  
  // Novos estados para Copiar/Colar
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false)
  const [selectedForCopy, setSelectedForCopy] = useState<string[]>([])
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteError, setPasteError] = useState('')
  const [messages, setMessages] = useState(initialGroup.messages || [])
  const [activeTab, setActiveTab] = useState('details')
  const [contacts, setContacts] = useState<any[]>([])
  
  // Fetch contacts on mount to map names
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const res = await fetch(`/api/instances/${initialGroup.instanceName}/contacts`)
        if (res.ok) {
          const data = await res.json()
          setContacts(data.data || [])
        }
      } catch (e) {
        console.error("Erro ao buscar contatos", e)
      }
    }
    fetchContacts()
  }, [initialGroup.instanceName])
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [previewSchedule, setPreviewSchedule] = useState<any>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newSchedule, setNewSchedule] = useState({ 
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
  
  const scrollRef = useRef<HTMLDivElement>(null)

  // Polling for new messages
  useEffect(() => {
    if (activeTab !== 'messages') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/groups/${initialGroup.id}/messages`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (e) {}
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab, initialGroup.id]);

  const openNewModal = () => {
    setEditingId(null)
    setNewSchedule({ 
      type: 'text', text: '', mediaUrl: '', mediatype: 'image', caption: '', fileName: '',
      title: '', description: '', footer: '', buttonsList: [{ type: 'reply', displayText: 'Sim', id: 'btn1' }],
      pollName: '', pollOptions: 'Opção 1, Opção 2', scheduledAt: '' 
    })
    setIsModalOpen(true)
  }

  const openEditModal = (schedule: any) => {
    const content = JSON.parse(schedule.content)
    const dateObj = new Date(schedule.adjustedAt)
    const tzOffset = (dateObj.getTimezoneOffset() * 60000)
    const localISOTime = (new Date(dateObj.getTime() - tzOffset)).toISOString().slice(0, 16)

    setEditingId(schedule.id)
    setNewSchedule({
      type: schedule.type,
      text: content.text || '',
      mediaUrl: content.media || content.imageUrl || content.videoUrl || '',
      mediatype: content.mediatype || (content.videoUrl ? 'video' : 'image'),
      caption: content.caption || '',
      fileName: content.fileName || '',
      title: content.title || '',
      description: content.description || '',
      footer: content.footer || '',
      buttonsList: content.buttons || [{ type: 'reply', displayText: 'Sim', id: 'btn1' }],
      pollName: content.name || '',
      pollOptions: content.values ? content.values.join(', ') : '',
      scheduledAt: localISOTime
    })
    setIsModalOpen(true)
  }

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    let content: any = {}
    
    if (newSchedule.type === 'text') {
      content = { text: newSchedule.text }
    } else if (newSchedule.type === 'media') {
      content = { 
        mediatype: newSchedule.mediatype, 
        media: newSchedule.mediaUrl, 
        caption: newSchedule.caption,
        fileName: newSchedule.fileName
      }
    } else if (newSchedule.type === 'button') {
      content = {
        title: newSchedule.title,
        description: newSchedule.description,
        footer: newSchedule.footer,
        buttons: newSchedule.buttonsList
      }
      const hasCTA = newSchedule.buttonsList.some((b: any) => b.type !== 'reply')
      if (!hasCTA && newSchedule.mediaUrl) {
        if (newSchedule.mediatype === 'video') {
          content.videoUrl = newSchedule.mediaUrl
        } else {
          content.imageUrl = newSchedule.mediaUrl
        }
      }
    } else if (newSchedule.type === 'poll') {
      const opts = newSchedule.pollOptions.split(',').map(o => o.trim()).filter(Boolean);
      content = {
        name: newSchedule.pollName,
        selectableCount: 1,
        values: opts
      }
    }

    const payload = {
      groupId: initialGroup.id,
      type: newSchedule.type,
      content,
      scheduledAt: new Date(newSchedule.scheduledAt).toISOString(),
      ...(editingId ? { status: 'pending' } : {}) 
    }

    try {
      const url = editingId ? `/api/schedules/${editingId}` : '/api/schedules'
      const method = editingId ? 'PATCH' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const saved = await res.json()
        if (editingId) {
          setSchedules(schedules.map((s: any) => s.id === editingId ? saved : s).sort((a: any, b: any) => new Date(a.adjustedAt).getTime() - new Date(b.adjustedAt).getTime()))
        } else {
          setSchedules([...schedules, saved].sort((a: any, b: any) => new Date(a.adjustedAt).getTime() - new Date(b.adjustedAt).getTime()))
        }
        setIsModalOpen(false)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // --- LOGICA DE COPIAR E COLAR AGENDAMENTOS ---
  const handleOpenCopyModal = () => {
    setSelectedForCopy([])
    setIsCopyModalOpen(true)
  }

  const toggleSelectForCopy = (id: string) => {
    setSelectedForCopy(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const handleCopySelected = async () => {
    try {
      const selectedSchedules = schedules
        .filter((s: any) => selectedForCopy.includes(s.id))
        .map((s: any) => ({
          type: s.type,
          content: JSON.parse(s.content),
          scheduledAt: s.scheduledAt
        }))

      const jsonStr = JSON.stringify(selectedSchedules, null, 2)
      await navigator.clipboard.writeText(jsonStr)
      alert("Agendamentos copiados para a área de transferência!")
      setIsCopyModalOpen(false)
    } catch (err) {
      console.error(err)
      alert("Erro ao copiar. Tente novamente.")
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

  const handlePasteClick = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const err = validatePastedJSON(text)
      if (err) {
        setPasteText(text)
        setPasteError(err)
        setIsPasteModalOpen(true)
      } else {
        if (confirm(`Encontrado(s) ${JSON.parse(text).length} agendamento(s) na área de transferência. Deseja colar neste grupo?`)) {
          await processPaste(JSON.parse(text))
        }
      }
    } catch (err) {
      setPasteText('')
      setPasteError("Cole o código JSON aqui")
      setIsPasteModalOpen(true)
    }
  }

  const handlePasteTextChange = (e: any) => {
    const text = e.target.value
    setPasteText(text)
    setPasteError(validatePastedJSON(text))
  }

  const handlePasteSubmit = async () => {
    if (pasteError) return
    try {
      const parsed = JSON.parse(pasteText)
      await processPaste(parsed)
      setIsPasteModalOpen(false)
    } catch (e) {
      alert("Erro ao processar")
    }
  }

  const processPaste = async (schedulesToPaste: any[]) => {
    try {
      let inserted = []
      for (const sched of schedulesToPaste) {
        const payload = {
          groupId: initialGroup.id,
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
          inserted.push(await res.json())
        }
      }
      
      setSchedules([...schedules, ...inserted].sort((a: any, b: any) => new Date(a.adjustedAt).getTime() - new Date(b.adjustedAt).getTime()))
      alert(`${inserted.length} agendamento(s) colado(s) com sucesso!`)
    } catch (err) {
      console.error(err)
      alert("Erro ao colar agendamentos.")
    }
  }
  // --- FIM DA LÓGICA DE COPIAR E COLAR ---

  const handleDeactivate = async (id: string) => {
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'deactivated' })
      })
      if (res.ok) {
        setSchedules(schedules.map((s: any) => s.id === id ? { ...s, status: 'deactivated' } : s))
      }
    } catch (error) {
      console.error(error)
    }
  }

  const handleSendNow = async (id: string) => {
    try {
      const now = new Date();
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending', scheduledAt: now.toISOString() })
      })
      if (res.ok) {
        setSchedules(schedules.map((s: any) => s.id === id ? { ...s, status: 'pending', errorMessage: null, scheduledAt: now.toISOString(), adjustedAt: now.toISOString() } : s))
      }
    } catch (error) {
      console.error(error)
    }
  }
  
  const handleUpdateGroup = async (action: 'picture' | 'description') => {
    const value = prompt(`Nova ${action === 'picture' ? 'URL da foto (ou base64)' : 'descrição'}:`);
    if (!value) return;
    
    try {
      const res = await fetch(`/api/groups/${initialGroup.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, value })
      })
      if (res.ok) {
        alert("Atualizado com sucesso!");
        window.location.reload();
      } else {
        alert("Erro ao atualizar.");
      }
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Profile */}
      <div className="bg-card/30 border-b border-border/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted/50 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10">
                <img 
                  src={`/api/instances/${initialGroup.instanceName}/avatar?jid=${initialGroup.evolutionGroupId}`}
                  alt={initialGroup.name} 
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/20 absolute top-0 left-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.parentElement?.querySelector('.fallback-avatar');
                    if (fallback) fallback.classList.remove('hidden');
                  }}
                />
                <div className="fallback-avatar hidden w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold absolute top-0 left-0">
                  {initialGroup.name.substring(0, 2).toUpperCase()}
                </div>
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">{initialGroup.name}</h1>
                <p className="text-xs text-muted-foreground">{initialGroup.members?.length || 0} membros</p>
              </div>
            </div>
          </div>
          <div className="flex gap-1 sm:gap-2">
            <Button variant="outline" size="sm" onClick={() => handleUpdateGroup('picture')} className="px-2 sm:px-3" title="Alterar Foto">
              <ImageIcon className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Foto</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleUpdateGroup('description')} className="px-2 sm:px-3" title="Alterar Descrição">
              <Edit3 className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Desc.</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px] h-auto p-1 gap-1">
            <TabsTrigger value="details" className="text-[11px] sm:text-sm py-2 whitespace-normal h-auto leading-tight">Detalhes</TabsTrigger>
            <TabsTrigger value="schedules" className="text-[11px] sm:text-sm py-2 whitespace-normal h-auto leading-tight">Agenda</TabsTrigger>
            <TabsTrigger value="messages" className="text-[11px] sm:text-sm py-2 whitespace-normal h-auto leading-tight">Chat Ao Vivo</TabsTrigger>
          </TabsList>

          {/* Tab: Detalhes */}
          <TabsContent value="details" className="space-y-4 animate-in fade-in-50">
            <Card className="border-border/40 bg-card/40">
              <CardHeader>
                <CardTitle>Sobre o Grupo</CardTitle>
                <CardDescription>{initialGroup.description || 'Nenhuma descrição definida.'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Lista de Membros</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {initialGroup.members?.map((m: any) => {
                      const formattedPhone = m.phone.replace('@s.whatsapp.net', '').replace('@lid', '');
                      const isHidden = m.phone.includes('@lid');
                      const contactInfo = contacts.find(c => c.Jid === m.phone || c.id === m.phone);
                      
                      let displayName = contactInfo?.FullName || contactInfo?.PushName || '';
                      if (!displayName) {
                        displayName = isHidden ? `Oculto (${formattedPhone}@lid)` : `+${formattedPhone}`;
                      }
                      
                      return (
                        <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors">
                          <div className="relative w-10 h-10 flex-shrink-0">
                            <img 
                              src={`/api/instances/${initialGroup.instanceName}/avatar?jid=${m.phone}`}
                              alt="Avatar"
                              className="w-10 h-10 rounded-full object-cover ring-1 ring-primary/20 absolute top-0 left-0"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.parentElement?.querySelector('.fallback-member');
                                if (fallback) fallback.classList.remove('hidden');
                              }}
                            />
                            <div className="fallback-member hidden w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center absolute top-0 left-0">
                              {isHidden ? <EyeOff className="w-4 h-4" /> : <UserCircle2 className="w-5 h-5" />}
                            </div>
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium truncate" title={displayName}>
                              {displayName}
                            </p>
                            <p className={`text-xs ${m.role === 'admin' ? 'text-green-500 font-medium' : 'text-muted-foreground'}`}>
                              {m.role === 'admin' ? 'Administrador' : 'Membro'}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Agenda */}
          <TabsContent value="schedules" className="space-y-4 animate-in fade-in-50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Agendamentos</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleOpenCopyModal} title="Copiar Agendamentos pendentes">
                  <Copy className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Copiar</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handlePasteClick} title="Colar Agendamentos de outro grupo">
                  <ClipboardPaste className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Colar</span>
                </Button>
                <Button onClick={openNewModal} size="sm">
                  <CalendarDays className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Novo Agendamento</span>
                </Button>
              </div>
            </div>
            
            <div className="space-y-3" ref={scrollRef}>
              {schedules.map((s: any) => {
                const content = JSON.parse(s.content)
                const isSent = s.status === 'sent'
                const isDeactivated = s.status === 'deactivated'
                const isError = s.status === 'error'
                
                return (
                  <Card key={s.id} className={`border-l-4 ${isSent ? 'border-l-green-500 bg-muted/10' : isError ? 'border-l-red-500 bg-red-500/5' : isDeactivated ? 'border-l-muted bg-muted/5' : 'border-l-primary bg-card/40'} border-border/40 transition-all`}>
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {s.type}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {new Date(s.adjustedAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm font-medium">
                          {s.type === 'text' && (content.text?.substring(0, 100) + (content.text?.length > 100 ? '...' : ''))}
                          {s.type === 'media' && `[Mídia] ${content.caption || 'Sem legenda'}`}
                          {s.type === 'button' && `[Botões] ${content.title}`}
                          {s.type === 'poll' && `[Enquete] ${content.name}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 uppercase font-semibold">
                          Status: <span className={isSent ? 'text-green-500' : isError ? 'text-red-500' : isDeactivated ? 'text-muted-foreground' : 'text-primary'}>{s.status}</span>
                        </p>
                        {isError && s.errorMessage && (
                          <div className="mt-2 text-xs text-red-500 bg-red-500/10 p-2 rounded-md border border-red-500/20 max-w-full break-words">
                            <span className="font-bold">Falha:</span> {s.errorMessage}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {(isError || s.status === 'pending') && (
                          <Button variant="outline" size="sm" onClick={() => handleSendNow(s.id)} className="text-primary hover:text-primary hover:bg-primary/10">
                            <Send className="w-4 h-4 mr-2" /> Enviar Agora
                          </Button>
                        )}
                        <Button variant="secondary" size="sm" onClick={() => setPreviewSchedule(s)}>
                          <Eye className="w-4 h-4 mr-2" /> Pré-visualizar
                        </Button>
                        {s.status === 'pending' && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => openEditModal(s)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDeactivate(s.id)}>
                              <PowerOff className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {s.status === 'deactivated' && (
                          <Button variant="outline" size="sm" onClick={() => openEditModal(s)}>
                            <Power className="w-4 h-4 mr-2" /> Reativar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              {schedules.length === 0 && (
                <div className="py-12 text-center text-muted-foreground border border-dashed border-border/50 rounded-lg bg-muted/10">
                  Nenhum agendamento configurado.
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab: Chat */}
          <TabsContent value="messages" className="space-y-4 animate-in fade-in-50">
            <Card className="border-border/40 bg-card/40 h-[60vh] flex flex-col">
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" /> Chat Ao Vivo
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Nenhuma mensagem recente.
                  </div>
                ) : (
                  messages.map((m: any) => (
                    <div key={m.id} className={`flex flex-col max-w-[80%] rounded-2xl p-3 ${m.fromMe ? 'bg-primary text-primary-foreground self-end ml-auto rounded-tr-sm' : 'bg-muted/50 text-foreground self-start mr-auto rounded-tl-sm'}`}>
                      <div className={`text-xs font-semibold mb-1 ${m.fromMe ? 'text-primary-foreground/80' : 'text-primary'}`}>
                        {m.participant || (m.fromMe ? 'Você' : 'Membro')} • {new Date(m.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Schedule Form Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[85vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
            <DialogDescription>
              Configure a mensagem e o horário de envio automático.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSaveSchedule} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Tipo de Mensagem</Label>
              <Select value={newSchedule.type} onValueChange={v => setNewSchedule({...newSchedule, type: v})}>
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

            {newSchedule.type === 'text' && (
              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea required placeholder="Digite sua mensagem aqui..." value={newSchedule.text} onChange={e => setNewSchedule({...newSchedule, text: e.target.value})} rows={5} className="resize-none" />
              </div>
            )}

            {newSchedule.type === 'media' && (
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
                      setNewSchedule({...newSchedule, mediaUrl: data.url});
                    } else {
                      setUploadError(data.error || 'Erro interno no servidor ao realizar upload.');
                    }
                  } catch(err: any) {
                    setUploadError(err.message || 'Erro na conexão de upload');
                  } finally {
                    setIsUploading(false);
                  }
                }}
              >
                <div className="space-y-2">
                  <Label>Tipo de Mídia</Label>
                  <Select value={newSchedule.mediatype} onValueChange={v => setNewSchedule({...newSchedule, mediatype: v})}>
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
                    <Input required placeholder="https://..." value={newSchedule.mediaUrl} onChange={e => setNewSchedule({...newSchedule, mediaUrl: e.target.value})} />
                    <input type="file" id="mediaUpload" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if(!file) return;
                      
                      setIsUploading(true);
                      setUploadError('');
                      
                      const fd = new FormData(); fd.append('file', file);
                      try {
                        const res = await fetch('/api/upload', {method:'POST', body:fd});
                        const data = await res.json();
                        if (res.ok && data.success) {
                          setNewSchedule({...newSchedule, mediaUrl: data.url});
                        } else {
                          setUploadError(data.error || 'Erro interno no servidor ao realizar upload.');
                        }
                      } catch(err: any) {
                        setUploadError(err.message || 'Erro na conexão de upload');
                      } finally {
                        setIsUploading(false);
                      }
                    }}/>
                    <Button type="button" variant="secondary" onClick={() => document.getElementById('mediaUpload')?.click()} disabled={isUploading}>
                      {isUploading ? <span className="text-xs">⏳</span> : <Upload className="w-4 h-4" />}
                    </Button>
                  </div>
                  {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Legenda (Opcional)</Label>
                  <Textarea placeholder="Legenda da mídia..." value={newSchedule.caption} onChange={e => setNewSchedule({...newSchedule, caption: e.target.value})} rows={2} />
                </div>

                {newSchedule.mediatype === 'document' && (
                  <div className="space-y-2">
                    <Label>Nome do Arquivo (Obrigatório)</Label>
                    <Input required placeholder="relatorio_final.pdf" value={newSchedule.fileName} onChange={e => setNewSchedule({...newSchedule, fileName: e.target.value})} />
                  </div>
                )}
              </div>
            )}

            {newSchedule.type === 'button' && (
              <div className="space-y-4 border border-border/50 p-4 rounded-lg bg-muted/10">
                <div className="space-y-2">
                  <Label>Título Principal</Label>
                  <Input required placeholder="Ex: Oferta Especial!" value={newSchedule.title} onChange={e => setNewSchedule({...newSchedule, title: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea required placeholder="Detalhes da oferta..." value={newSchedule.description} onChange={e => setNewSchedule({...newSchedule, description: e.target.value})} rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Rodapé (Opcional)</Label>
                  <Input placeholder="Válido até amanhã" value={newSchedule.footer} onChange={e => setNewSchedule({...newSchedule, footer: e.target.value})} />
                </div>
                
                {/* Midia Opcional */}
                {!newSchedule.buttonsList.some((b:any)=>b.type!=='reply') && (
                  <div className="p-3 border border-border bg-background rounded-lg space-y-3">
                    <Label className="text-xs text-muted-foreground font-semibold">Anexar Mídia (Opcional)</Label>
                    <div className="flex gap-2">
                      <Select value={newSchedule.mediatype} onValueChange={v => setNewSchedule({...newSchedule, mediatype: v})}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Mídia..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="image">Imagem</SelectItem>
                          <SelectItem value="video">Vídeo</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input placeholder="URL da Mídia" value={newSchedule.mediaUrl} onChange={e => setNewSchedule({...newSchedule, mediaUrl: e.target.value})} />
                    </div>
                  </div>
                )}

                <div className="pt-2 space-y-3">
                  <Label className="font-semibold text-sm">Botões (Max 3)</Label>
                  {newSchedule.buttonsList.map((btn: any, index: number) => (
                    <div key={index} className="p-3 border border-border/50 bg-background rounded-lg space-y-3 relative group">
                      <div className="flex justify-between items-center">
                        <Select value={btn.type} onValueChange={v => {
                          const list = [...newSchedule.buttonsList];
                          list[index] = {...btn, type: v};
                          setNewSchedule({...newSchedule, buttonsList: list});
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
                        {newSchedule.buttonsList.length > 1 && (
                          <button type="button" onClick={() => {
                            const list = newSchedule.buttonsList.filter((_,i) => i!==index);
                            setNewSchedule({...newSchedule, buttonsList: list});
                          }} className="text-destructive opacity-50 hover:opacity-100 transition-opacity">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      
                      <Input required placeholder="Texto do botão (ex: Comprar)" value={btn.displayText||''} onChange={e => {
                        const list = [...newSchedule.buttonsList]; list[index] = {...btn, displayText: e.target.value}; setNewSchedule({...newSchedule, buttonsList: list});
                      }} className="h-8" />
                      
                      {btn.type === 'reply' && <Input required placeholder="ID interno (ex: btn_comprar)" value={btn.id||''} onChange={e => {
                        const list = [...newSchedule.buttonsList]; list[index] = {...btn, id: e.target.value}; setNewSchedule({...newSchedule, buttonsList: list});
                      }} className="h-8" />}
                      
                      {btn.type === 'url' && <Input required placeholder="https://..." value={btn.url||''} onChange={e => {
                        const list = [...newSchedule.buttonsList]; list[index] = {...btn, url: e.target.value}; setNewSchedule({...newSchedule, buttonsList: list});
                      }} className="h-8" />}
                      
                      {btn.type === 'call' && <Input required placeholder="+5511999999999" value={btn.phoneNumber||''} onChange={e => {
                        const list = [...newSchedule.buttonsList]; list[index] = {...btn, phoneNumber: e.target.value}; setNewSchedule({...newSchedule, buttonsList: list});
                      }} className="h-8" />}
                      
                      {btn.type === 'copy' && <Input required placeholder="Texto para copiar..." value={btn.copyCode||''} onChange={e => {
                        const list = [...newSchedule.buttonsList]; list[index] = {...btn, copyCode: e.target.value}; setNewSchedule({...newSchedule, buttonsList: list});
                      }} className="h-8" />}
                    </div>
                  ))}
                  {newSchedule.buttonsList.length < 3 && (
                    <Button type="button" variant="secondary" size="sm" className="w-full border-dashed" onClick={() => {
                      setNewSchedule({...newSchedule, buttonsList: [...newSchedule.buttonsList, {type:'reply', displayText:'', id:'btn'+Date.now()}]});
                    }}>+ Adicionar Botão</Button>
                  )}
                </div>
              </div>
            )}

            {newSchedule.type === 'poll' && (
              <div className="space-y-4 border border-border/50 p-4 rounded-lg bg-muted/10">
                <div className="space-y-2">
                  <Label>Pergunta da Enquete</Label>
                  <Input required placeholder="Ex: Qual o melhor horário?" value={newSchedule.pollName} onChange={e => setNewSchedule({...newSchedule, pollName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Opções (Separadas por vírgula)</Label>
                  <Input required placeholder="Manhã, Tarde, Noite" value={newSchedule.pollOptions} onChange={e => setNewSchedule({...newSchedule, pollOptions: e.target.value})} />
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
                      !newSchedule.scheduledAt && "text-muted-foreground"
                    )}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {newSchedule.scheduledAt ? (
                      new Date(newSchedule.scheduledAt).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
                    ) : (
                      <span>Escolha uma data e horário</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[95vw] sm:w-auto p-0 max-h-[85vh] overflow-y-auto rounded-xl" align="center">
                  <Calendar
                    mode="single"
                    selected={newSchedule.scheduledAt ? new Date(newSchedule.scheduledAt) : undefined}
                    onSelect={(d) => {
                      if (d) {
                         const current = newSchedule.scheduledAt ? new Date(newSchedule.scheduledAt) : new Date();
                         d.setHours(current.getHours());
                         d.setMinutes(current.getMinutes());
                         const tzOffset = d.getTimezoneOffset() * 60000;
                         const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
                         setNewSchedule({...newSchedule, scheduledAt: localISOTime});
                      }
                    }}
                  />
                  <div className="p-4 border-t border-border flex flex-col items-center justify-center gap-3 bg-muted/20">
                    <Label className="text-sm font-semibold w-full text-center text-muted-foreground">Selecione o Horário</Label>
                    <div className="flex items-center gap-4">
                      <ScrollDial 
                        max={23} 
                        value={newSchedule.scheduledAt ? parseInt(newSchedule.scheduledAt.split('T')[1]?.split(':')[0] || '12', 10) : 12}
                        onChange={(h) => {
                          let m = newSchedule.scheduledAt ? newSchedule.scheduledAt.split('T')[1]?.split(':')[1] : '00';
                          if (!m) m = '00';
                          
                          let localDate = newSchedule.scheduledAt ? newSchedule.scheduledAt.split('T')[0] : '';
                          if (!localDate) {
                            const today = new Date();
                            const tzOffset = today.getTimezoneOffset() * 60000;
                            localDate = new Date(today.getTime() - tzOffset).toISOString().split('T')[0];
                          }
                          
                          setNewSchedule({...newSchedule, scheduledAt: `${localDate}T${h.toString().padStart(2, '0')}:${m}`});
                        }}
                      />
                      <span className="text-2xl font-bold text-muted-foreground/50">:</span>
                      <ScrollDial 
                        max={59} 
                        value={newSchedule.scheduledAt ? parseInt(newSchedule.scheduledAt.split('T')[1]?.split(':')[1] || '0', 10) : 0}
                        onChange={(m) => {
                          let h = newSchedule.scheduledAt ? newSchedule.scheduledAt.split('T')[1]?.split(':')[0] : '12';
                          if (!h) h = '12';
                          
                          let localDate = newSchedule.scheduledAt ? newSchedule.scheduledAt.split('T')[0] : '';
                          if (!localDate) {
                            const today = new Date();
                            const tzOffset = today.getTimezoneOffset() * 60000;
                            localDate = new Date(today.getTime() - tzOffset).toISOString().split('T')[0];
                          }
                          
                          setNewSchedule({...newSchedule, scheduledAt: `${localDate}T${h}:${m.toString().padStart(2, '0')}`});
                        }}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <DialogFooter className="pt-4 flex-col sm:flex-row gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
              <Button type="submit" className="w-full sm:w-auto">Salvar Agendamento</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewSchedule} onOpenChange={() => setPreviewSchedule(null)}>
        <DialogContent className="sm:max-w-[400px] bg-[#efeae2] p-0 border-none rounded-xl overflow-hidden shadow-2xl">
          <div className="bg-[#008069] text-white p-4 flex items-center gap-3">
            <ArrowLeft className="w-5 h-5 cursor-pointer opacity-80 hover:opacity-100" onClick={() => setPreviewSchedule(null)} />
            <div>
              <div className="font-semibold">{initialGroup.name}</div>
              <div className="text-xs opacity-80">Você</div>
            </div>
          </div>
          <div className="p-4 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat opacity-90 h-[400px] overflow-y-auto flex flex-col">
            {previewSchedule && (() => {
              const s = previewSchedule;
              const c = JSON.parse(s.content);
              return (
                <div className="bg-[#d9fdd3] text-[#111b21] p-2 rounded-lg rounded-tr-none shadow-sm max-w-[90%] self-end relative pb-6 mb-4">
                  {s.type === 'text' && <p className="whitespace-pre-wrap text-sm m-0 leading-relaxed">{c.text}</p>}
                  {s.type === 'media' && (
                    <div>
                      <div className="w-full h-32 bg-black/10 rounded mb-2 flex items-center justify-center font-bold text-black/40 text-xs">
                        {c.mediatype?.toUpperCase()}
                      </div>
                      {c.caption && <p className="text-sm m-0 leading-relaxed">{c.caption}</p>}
                    </div>
                  )}
                  {s.type === 'button' && (
                    <div>
                      {c.imageUrl && <div className="w-full h-24 bg-cover bg-center rounded mb-2" style={{backgroundImage: `url(${c.imageUrl})`}} />}
                      {c.videoUrl && <div className="w-full h-24 bg-black/10 rounded mb-2 flex items-center justify-center font-bold text-black/40">VÍDEO</div>}
                      <b className="text-sm block leading-tight">{c.title}</b>
                      <p className="text-sm my-1 text-black/80">{c.description}</p>
                      {c.footer && <div className="text-xs text-black/50">{c.footer}</div>}
                      {c.buttons?.length > 0 && <hr className="border-black/10 my-2" />}
                      <div className="space-y-2">
                        {c.buttons?.map((b:any, i:number) => (
                          <div key={i} className={`text-[#00a884] text-center text-sm font-bold pt-2 ${i>0 ? 'border-t border-black/10' : ''}`}>
                            {b.displayText} {b.type !== 'reply' && '↗'}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {s.type === 'poll' && (
                    <div>
                      <b className="text-sm block mb-2">📊 {c.name}</b>
                      <div className="space-y-1">
                        {c.values?.map((v:any, i:number) => (
                          <div key={i} className="bg-white/50 border border-black/10 p-2 text-sm rounded-md shadow-sm">
                            ⚪ {v}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-1 right-2 text-[0.65rem] text-black/40 flex items-center gap-1">
                    {new Date(s.adjustedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    <span className="text-[#53bdeb] font-bold text-xs">✓✓</span>
                  </div>
                </div>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>
      {/* Copy Modal */}
      <Dialog open={isCopyModalOpen} onOpenChange={setIsCopyModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Copiar Agendamentos</DialogTitle>
            <DialogDescription>
              Selecione os agendamentos pendentes que deseja copiar para colar em outro grupo.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-2 mt-4 pr-2">
            {schedules.filter((s: any) => s.status === 'pending').map((s: any) => {
              const content = JSON.parse(s.content)
              return (
                <div key={s.id} className="flex items-center space-x-3 border p-3 rounded-md hover:bg-muted/30 transition-colors">
                  <input 
                    type="checkbox" 
                    id={`copy-${s.id}`}
                    checked={selectedForCopy.includes(s.id)}
                    onChange={() => toggleSelectForCopy(s.id)}
                    className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer"
                  />
                  <Label htmlFor={`copy-${s.id}`} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {s.type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.adjustedAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium">
                      {s.type === 'text' && (content.text?.substring(0, 60) + (content.text?.length > 60 ? '...' : ''))}
                      {s.type === 'media' && `[Mídia] ${content.caption || 'Sem legenda'}`}
                      {s.type === 'button' && `[Botões] ${content.title}`}
                      {s.type === 'poll' && `[Enquete] ${content.name}`}
                    </p>
                  </Label>
                </div>
              )
            })}
            {schedules.filter((s: any) => s.status === 'pending').length === 0 && (
              <p className="text-sm text-center text-muted-foreground py-4 border border-dashed rounded-lg bg-muted/10">Nenhum agendamento pendente para copiar.</p>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setIsCopyModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCopySelected} disabled={selectedForCopy.length === 0}>
              Copiar Selecionados ({selectedForCopy.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Paste Modal */}
      <Dialog open={isPasteModalOpen} onOpenChange={setIsPasteModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Colar Agendamentos</DialogTitle>
            <DialogDescription>
              Cole o código JSON gerado pelo botão Copiar de outro grupo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Textarea 
              value={pasteText}
              onChange={handlePasteTextChange}
              placeholder={'[\n  {\n    "type": "text",\n    "content": { ... },\n    "scheduledAt": "2026-..."\n  }\n]'}
              className="min-h-[200px] font-mono text-xs bg-muted/30"
            />
            {pasteError && pasteError !== "Vazio" && pasteError !== "Cole o código JSON aqui" ? (
              <div className="flex items-center text-red-500 text-sm font-medium">
                <AlertCircle className="w-4 h-4 mr-2" /> {pasteError}
              </div>
            ) : pasteError === "Cole o código JSON aqui" || pasteError === "Vazio" ? (
               <div className="flex items-center text-muted-foreground text-sm">
                 <AlertCircle className="w-4 h-4 mr-2" /> Aguardando código JSON...
               </div>
            ) : pasteText && !pasteError ? (
              <div className="flex items-center text-green-500 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4 mr-2" /> JSON Válido! Estrutura correta detectada.
              </div>
            ) : null}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setIsPasteModalOpen(false)}>Cancelar</Button>
            <Button onClick={handlePasteSubmit} disabled={!!pasteError}>
              Confirmar e Colar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
