'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/use-toast'
import AppShell from '@/components/AppShell'
import GroupEditorModal from './GroupEditorModal'
import ScheduleSummary from './ScheduleSummary'
import { validateButtons } from '@/lib/schedule-types'
import {
  UserCircle2,
  Lock,
  Unlock,
  ShieldCheck,
  UserPlus,
  Loader2,
  Megaphone,
  MousePointerClick,
  Tag as TagIcon,
  CalendarDays,
  Eye,
  EyeOff,
  Edit,
  Power,
  PowerOff,
  Edit3,
  Copy,
  ClipboardPaste,
  AlertCircle,
  Send,
  MessageSquare,
} from 'lucide-react'

// Modais extraídos
import { ScheduleModal } from './ScheduleModal'
import { WhatsAppPreviewModal } from './WhatsAppPreviewModal'
import { CopyScheduleModal } from './CopyScheduleModal'
import { PasteScheduleModal } from './PasteScheduleModal'

export default function GroupClient({ initialGroup }: { initialGroup: any }) {
  const [schedules, setSchedules] = useState(initialGroup.schedules || [])

  // Estados para Copiar/Colar
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false)
  const [selectedForCopy, setSelectedForCopy] = useState<string[]>([])
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteError, setPasteError] = useState('')
  const [activeTab, setActiveTab] = useState('schedules')
  const [contacts, setContacts] = useState<any[]>([])

  // Filtros da Agenda
  const [hideDeactivated, setHideDeactivated] = useState(true)
  const [dateFilter, setDateFilter] = useState('all')
  const [customDateStart, setCustomDateStart] = useState('')
  const [customDateEnd, setCustomDateEnd] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)

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
        console.error('Erro ao buscar contatos', e)
      }
    }
    fetchContacts()
  }, [initialGroup.instanceName])

  // Modals state
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
    mentionAll: false,
    trackLinks: false,
    permissions: {} as Record<string, string>,
    profileName: '',
    profileDescription: '',
    profilePicture: '',
    campaign: '',
    scheduledAt: '',
  })

  // Permissões diretas
  const [perms, setPerms] = useState({
    isAnnounce: initialGroup.isAnnounce,
    isLocked: initialGroup.isLocked,
    adminOnlyAdd: initialGroup.adminOnlyAdd,
    isApprovalRequired: initialGroup.isApprovalRequired,
  })
  const [savingPerm, setSavingPerm] = useState<string | null>(null)

  const applyPermission = async (key: keyof typeof perms, action: string) => {
    setSavingPerm(key)
    try {
      const res = await fetch(`/api/groups/${initialGroup.id}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (res.ok && data.group) {
        setPerms(data.group)
        toast({
          title: 'Permissão alterada',
          description: 'Configuração atualizada no WhatsApp com sucesso.',
          variant: 'success',
        })
      } else {
        toast({
          title: 'Erro de permissão',
          description: data.error || 'Não foi possível alterar a permissão.',
          variant: 'destructive',
        })
      }
    } catch (e) {
      toast({
        title: 'Erro de conexão',
        description: 'Erro de conexão ao alterar a permissão.',
        variant: 'destructive',
      })
    } finally {
      setSavingPerm(null)
    }
  }

  const erroBotoes =
    newSchedule.type === 'button' ? validateButtons(newSchedule.buttonsList) : ''

  const totalDesativados = schedules.filter((s: any) => s.status === 'deactivated').length
  const temErro = schedules.some((s: any) => s.status === 'error')
  const pendentesTravados = temErro
    ? schedules.filter((s: any) => s.status === 'pending').length
    : 0

  const openNewModal = () => {
    setEditingId(null)
    setNewSchedule({
      type: 'text',
      text: '',
      mediaUrl: '',
      mediatype: 'image',
      caption: '',
      fileName: '',
      title: '',
      description: '',
      footer: '',
      buttonsList: [{ type: 'reply', displayText: 'Sim', id: 'btn1' }],
      pollName: '',
      pollOptions: 'Opção 1, Opção 2',
      mentionAll: false,
      trackLinks: false,
      permissions: {},
      profileName: '',
      profileDescription: '',
      profilePicture: '',
      campaign: '',
      scheduledAt: '',
    })
    setUploadError('')
    setIsModalOpen(true)
  }

  const openEditModal = (sched: any) => {
    setEditingId(sched.id)
    const content = JSON.parse(sched.content)

    setNewSchedule({
      type: sched.type,
      text: sched.type === 'text' ? content.text || '' : '',
      mediaUrl:
        sched.type === 'media' || sched.type === 'button'
          ? content.media || content.imageUrl || content.videoUrl || ''
          : '',
      mediatype:
        sched.type === 'media'
          ? content.mediatype || 'image'
          : content.videoUrl
            ? 'video'
            : 'image',
      caption: content.caption || '',
      fileName: content.fileName || '',
      title: content.title || '',
      description: content.description || '',
      footer: content.footer || '',
      buttonsList:
        content.buttons && content.buttons.length > 0
          ? content.buttons
          : [{ type: 'reply', displayText: 'Sim', id: 'btn1' }],
      pollName: content.name || '',
      pollOptions: content.values ? content.values.join(', ') : 'Opção 1, Opção 2',
      mentionAll: Boolean(content.mentionAll),
      trackLinks: Boolean(content.trackLinks),
      permissions:
        sched.type === 'permission' && content.actions
          ? Object.fromEntries(
              content.actions.map((act: string) => [act.split('_')[0], act])
            )
          : {},
      profileName: content.name || '',
      profileDescription: content.description || '',
      profilePicture: content.picture || '',
      campaign: sched.campaign || '',
      scheduledAt: new Date(sched.scheduledAt).toISOString().slice(0, 16),
    })
    setUploadError('')
    setIsModalOpen(true)
  }

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newSchedule.type === 'button') {
      const problema = validateButtons(newSchedule.buttonsList)
      if (problema) {
        toast({
          title: 'Configuração inválida',
          description: problema,
          variant: 'destructive',
        })
        return
      }
    }

    let content: any = {}

    if (newSchedule.type === 'text') {
      content = { text: newSchedule.text }
    } else if (newSchedule.type === 'media') {
      content = {
        mediatype: newSchedule.mediatype,
        media: newSchedule.mediaUrl,
        caption: newSchedule.caption,
        fileName: newSchedule.fileName,
      }
    } else if (newSchedule.type === 'button') {
      content = {
        title: newSchedule.title,
        description: newSchedule.description,
        footer: newSchedule.footer,
        buttons: newSchedule.buttonsList,
      }
      const hasCTA = newSchedule.buttonsList.some((b: any) => b.type !== 'reply')
      if (!hasCTA && newSchedule.mediaUrl) {
        if (newSchedule.mediatype === 'video') {
          content.videoUrl = newSchedule.mediaUrl
        } else {
          content.imageUrl = newSchedule.mediaUrl
        }
      }
    } else if (newSchedule.type === 'permission') {
      content = { actions: Object.values(newSchedule.permissions).filter(Boolean) }
    } else if (newSchedule.type === 'profile') {
      content = {}
      if (newSchedule.profileName.trim()) content.name = newSchedule.profileName.trim()
      if (newSchedule.profileDescription.trim())
        content.description = newSchedule.profileDescription
      if (newSchedule.profilePicture.trim())
        content.picture = newSchedule.profilePicture.trim()
    } else if (newSchedule.type === 'poll') {
      const opts = newSchedule.pollOptions
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
      content = {
        name: newSchedule.pollName,
        selectableCount: 1,
        values: opts,
      }
    }

    if (
      ['text', 'media', 'button', 'poll'].includes(newSchedule.type) &&
      newSchedule.mentionAll
    ) {
      content.mentionAll = true
    }

    if (
      ['text', 'media'].includes(newSchedule.type) &&
      newSchedule.trackLinks
    ) {
      content.trackLinks = true
    }

    const payload = {
      groupId: initialGroup.id,
      type: newSchedule.type,
      content,
      campaign: newSchedule.campaign ? newSchedule.campaign.trim() : null,
      scheduledAt: new Date(newSchedule.scheduledAt).toISOString(),
      ...(editingId ? { status: 'pending' } : {}),
    }

    try {
      const url = editingId ? `/api/schedules/${editingId}` : '/api/schedules'
      const method = editingId ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const saved = await res.json()
        if (editingId) {
          setSchedules(
            schedules
              .map((s: any) => (s.id === editingId ? saved : s))
              .sort(
                (a: any, b: any) =>
                  new Date(a.adjustedAt).getTime() - new Date(b.adjustedAt).getTime()
              )
          )
        } else {
          setSchedules(
            [...schedules, saved].sort(
              (a: any, b: any) =>
                new Date(a.adjustedAt).getTime() - new Date(b.adjustedAt).getTime()
            )
          )
        }
        setIsModalOpen(false)
        toast({
          title: editingId ? 'Agendamento atualizado' : 'Agendamento criado',
          description: 'Salvo com sucesso na fila!',
          variant: 'success',
        })
      }
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o agendamento.',
        variant: 'destructive',
      })
    }
  }

  // --- COPIAR E COLAR AGENDAMENTOS ---
  const handleOpenCopyModal = () => {
    setSelectedForCopy([])
    setIsCopyModalOpen(true)
  }

  const toggleSelectForCopy = (id: string) => {
    setSelectedForCopy((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleCopySelected = async () => {
    try {
      const selectedSchedules = schedules
        .filter((s: any) => selectedForCopy.includes(s.id))
        .map((s: any) => ({
          type: s.type,
          content: JSON.parse(s.content),
          scheduledAt: s.scheduledAt,
        }))

      const jsonStr = JSON.stringify(selectedSchedules, null, 2)
      await navigator.clipboard.writeText(jsonStr)
      toast({
        title: 'Copiado',
        description: 'Agendamentos copiados para a área de transferência!',
        variant: 'success',
      })
      setIsCopyModalOpen(false)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao copiar',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const validatePastedJSON = (text: string) => {
    try {
      if (!text.trim()) return 'Vazio'
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) return 'O JSON deve ser um array.'
      if (parsed.length === 0) return 'Array vazio.'

      for (const item of parsed) {
        if (!item.type || !item.content || !item.scheduledAt) {
          return 'Cada item deve ter type, content e scheduledAt.'
        }
      }
      return ''
    } catch (e) {
      return 'JSON inválido.'
    }
  }

  const handlePasteClick = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const err = validatePastedJSON(text)
      setPasteText(text)
      setPasteError(err || '')
      setIsPasteModalOpen(true)
    } catch (err) {
      setPasteText('')
      setPasteError('Cole o código JSON aqui')
      setIsPasteModalOpen(true)
    }
  }

  const handlePasteSubmit = async () => {
    if (pasteError) return
    try {
      const parsed = JSON.parse(pasteText)
      await processPaste(parsed)
      setIsPasteModalOpen(false)
    } catch (e) {
      toast({
        title: 'Erro ao processar',
        description: 'Verifique a estrutura do JSON fornecido.',
        variant: 'destructive',
      })
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
          status: 'pending',
        }
        const res = await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          inserted.push(await res.json())
        }
      }

      setSchedules(
        [...schedules, ...inserted].sort(
          (a: any, b: any) =>
            new Date(a.adjustedAt).getTime() - new Date(b.adjustedAt).getTime()
        )
      )
      toast({
        title: 'Sucesso',
        description: `${inserted.length} agendamento(s) colado(s) com sucesso!`,
        variant: 'success',
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao colar',
        description: 'Não foi possível colar os agendamentos.',
        variant: 'destructive',
      })
    }
  }

  const handleDeactivate = async (id: string) => {
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'deactivated' }),
      })
      if (res.ok) {
        setSchedules(
          schedules.map((s: any) =>
            s.id === id ? { ...s, status: 'deactivated' } : s
          )
        )
        toast({
          title: 'Desativado',
          description: 'Agendamento desativado com sucesso.',
        })
      }
    } catch (error) {
      console.error(error)
    }
  }

  const handleSendNow = async (id: string) => {
    try {
      const now = new Date()
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending', scheduledAt: now.toISOString() }),
      })
      if (res.ok) {
        setSchedules(
          schedules.map((s: any) =>
            s.id === id
              ? {
                  ...s,
                  status: 'pending',
                  errorMessage: null,
                  scheduledAt: now.toISOString(),
                  adjustedAt: now.toISOString(),
                }
              : s
          )
        )
        toast({
          title: 'Disparo solicitado',
          description: 'Agendamento reprogramado para envio imediato.',
          variant: 'success',
        })
      }
    } catch (error) {
      console.error(error)
    }
  }

  const [editorAberto, setEditorAberto] = useState(false)

  return (
    <AppShell
      titulo={initialGroup.name}
      subtitulo={`${initialGroup.members?.length || 0} membros`}
      voltarPara="/"
    >
      <GroupEditorModal
        open={editorAberto}
        onOpenChange={setEditorAberto}
        groupId={initialGroup.id}
        instanceName={initialGroup.instanceName}
        evolutionGroupId={initialGroup.evolutionGroupId}
        currentName={initialGroup.name}
        currentDescription={initialGroup.description || ''}
        currentPicture={initialGroup.picture}
      />

      {/* Hero Profile Card (In-flow, eliminando conflito de cabeçalhos sticky) */}
      <Card className="border-border/40 bg-card/40 mb-6 shadow-sm">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative w-12 h-12 shrink-0">
              <img
                src={
                  initialGroup.picture ||
                  `/api/instances/${initialGroup.instanceName}/avatar?jid=${initialGroup.evolutionGroupId}`
                }
                alt={initialGroup.name}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/20"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const fallback = e.currentTarget.parentElement?.querySelector(
                    '.fallback-avatar'
                  )
                  if (fallback) fallback.classList.remove('hidden')
                }}
              />
              <div className="fallback-avatar hidden w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                {initialGroup.name.substring(0, 2).toUpperCase()}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold leading-tight truncate max-w-[240px] sm:max-w-md">
                {initialGroup.name}
              </h2>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <p className="text-xs text-muted-foreground">
                  {initialGroup.members?.length || 0} membros
                </p>
                {(initialGroup.tags || []).map((v: any) => (
                  <Link key={v.tag.id} href="/tags" title="Ver tags e lotação">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 hover:opacity-80 font-medium"
                      style={{
                        borderColor: `${v.tag.color}40`,
                        backgroundColor: `${v.tag.color}15`,
                        color: v.tag.color,
                      }}
                    >
                      <TagIcon className="w-2.5 h-2.5" />
                      {v.tag.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditorAberto(true)}
            className="px-3"
            title="Editar nome, descrição e foto"
          >
            <Edit3 className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Editar grupo</span>
          </Button>
        </CardContent>
      </Card>

      <div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px] h-auto p-1 gap-1">
            <TabsTrigger
              value="details"
              className="text-[11px] sm:text-sm py-2 whitespace-normal h-auto leading-tight"
            >
              Detalhes
            </TabsTrigger>
            <TabsTrigger
              value="schedules"
              className="text-[11px] sm:text-sm py-2 whitespace-normal h-auto leading-tight"
            >
              Agenda
            </TabsTrigger>
            <TabsTrigger
              value="permissions"
              className="text-[11px] sm:text-sm py-2 whitespace-normal h-auto leading-tight"
            >
              Permissões
            </TabsTrigger>
          </TabsList>

          {/* Tab: Detalhes */}
          <TabsContent value="details" className="space-y-4 animate-in fade-in-50">
            <Card className="border-border/40 bg-card/40">
              <CardHeader>
                <CardTitle>Sobre o Grupo</CardTitle>
                <CardDescription>
                  {initialGroup.description || 'Nenhuma descrição definida.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Lista de Membros</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {initialGroup.members?.map((m: any) => {
                      const formattedPhone = m.phone || ''
                      const isHidden = !formattedPhone || formattedPhone === 'desconhecido'
                      const contactInfo = contacts.find(
                        (c) =>
                          c.Jid?.startsWith(formattedPhone) ||
                          c.id?.startsWith(formattedPhone)
                      )

                      const contactName =
                        m.displayName ||
                        contactInfo?.FullName ||
                        contactInfo?.PushName ||
                        ''
                      const displayName =
                        contactName ||
                        (isHidden ? 'Número oculto' : `+${formattedPhone}`)

                      return (
                        <div
                          key={m.id}
                          className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors"
                        >
                          <div className="relative w-10 h-10 flex-shrink-0">
                            <img
                              src={`/api/instances/${initialGroup.instanceName}/avatar?jid=${m.phone}`}
                              alt="Avatar"
                              className="w-10 h-10 rounded-full object-cover ring-1 ring-primary/20 absolute top-0 left-0"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                                const fallback =
                                  e.currentTarget.parentElement?.querySelector(
                                    '.fallback-member'
                                  )
                                if (fallback) fallback.classList.remove('hidden')
                              }}
                            />
                            <div className="fallback-member hidden w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center absolute top-0 left-0">
                              {isHidden ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <UserCircle2 className="w-5 h-5" />
                              )}
                            </div>
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <p
                              className="text-sm font-medium truncate"
                              title={displayName}
                            >
                              {displayName}
                            </p>
                            <p
                              className={`text-xs ${
                                m.role === 'admin'
                                  ? 'text-green-500 font-medium'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {m.isSuperAdmin
                                ? 'Dono'
                                : m.role === 'admin'
                                  ? 'Administrador'
                                  : 'Membro'}
                              {contactName && !isHidden
                                ? ` · +${formattedPhone}`
                                : ''}
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
          <TabsContent
            value="schedules"
            className="space-y-4 animate-in fade-in-50"
          >
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Agendamentos</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenCopyModal}
                  title="Copiar Agendamentos pendentes"
                >
                  <Copy className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Copiar</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePasteClick}
                  title="Colar Agendamentos de outro grupo"
                >
                  <ClipboardPaste className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Colar</span>
                </Button>
                <Button onClick={openNewModal} size="sm">
                  <CalendarDays className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Novo Agendamento</span>
                </Button>
              </div>
            </div>

            {/* Filtros da Agenda */}
            <Card className="border-border/50 bg-card/60 shadow-sm p-4">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4 justify-between">
                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Período:</Label>
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                      <SelectTrigger className="w-[180px] h-8 text-xs">
                        <SelectValue placeholder="Filtrar por data..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as Datas</SelectItem>
                        <SelectItem value="next24">Próximas 24h</SelectItem>
                        <SelectItem value="next48">Próximos 2 dias</SelectItem>
                        <SelectItem value="next7">Próximos 7 dias</SelectItem>
                        <SelectItem value="next30">Próximo 1 mês</SelectItem>
                        <SelectItem value="last24">Últimas 24h</SelectItem>
                        <SelectItem value="last7">Última semana</SelectItem>
                        <SelectItem value="custom">Intervalo Específico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {dateFilter === 'custom' && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        className="h-8 text-xs w-[130px]"
                        value={customDateStart}
                        onChange={(e) => setCustomDateStart(e.target.value)}
                        title="Data Inicial"
                      />
                      <span className="text-muted-foreground text-xs">até</span>
                      <Input
                        type="date"
                        className="h-8 text-xs w-[130px]"
                        value={customDateEnd}
                        onChange={(e) => setCustomDateEnd(e.target.value)}
                        title="Data Final"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  {totalDesativados > 0 ? (
                    <Button
                      variant={hideDeactivated ? 'outline' : 'secondary'}
                      size="sm"
                      onClick={() => setHideDeactivated(!hideDeactivated)}
                      className="w-full md:w-auto"
                    >
                      {hideDeactivated ? (
                        <>
                          <Eye className="w-4 h-4 mr-2" /> Mostrar{' '}
                          {totalDesativados} desativado(s)
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-4 h-4 mr-2" /> Ocultar desativados
                        </>
                      )}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Nenhum agendamento desativado
                    </span>
                  )}
                </div>
              </div>
            </Card>

            {temErro && pendentesTravados > 0 && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-red-500">
                    Fila deste grupo está parada
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Há agendamento com erro neste grupo, e o sistema segura todos os{' '}
                    {pendentesTravados} agendamento(s) pendentes até que ele seja
                    resolvido. Use <strong>Desativar</strong> no agendamento com erro,
                    ou corrija e reenvie, para destravar os demais.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3" ref={scrollRef}>
              {schedules
                .filter((s: any) => {
                  if (hideDeactivated && s.status === 'deactivated') return false

                  if (dateFilter !== 'all') {
                    const sDate = new Date(s.adjustedAt).getTime()
                    const now = new Date().getTime()
                    const ONE_DAY = 24 * 60 * 60 * 1000

                    if (
                      dateFilter === 'next24' &&
                      (sDate < now || sDate > now + ONE_DAY)
                    )
                      return false
                    if (
                      dateFilter === 'next48' &&
                      (sDate < now || sDate > now + 2 * ONE_DAY)
                    )
                      return false
                    if (
                      dateFilter === 'next7' &&
                      (sDate < now || sDate > now + 7 * ONE_DAY)
                    )
                      return false
                    if (
                      dateFilter === 'next30' &&
                      (sDate < now || sDate > now + 30 * ONE_DAY)
                    )
                      return false
                    if (
                      dateFilter === 'last24' &&
                      (sDate > now || sDate < now - ONE_DAY)
                    )
                      return false
                    if (
                      dateFilter === 'last7' &&
                      (sDate > now || sDate < now - 7 * ONE_DAY)
                    )
                      return false

                    if (dateFilter === 'custom') {
                      if (
                        customDateStart &&
                        sDate < new Date(customDateStart + 'T00:00:00').getTime()
                      )
                        return false
                      if (
                        customDateEnd &&
                        sDate > new Date(customDateEnd + 'T23:59:59').getTime()
                      )
                        return false
                    }
                  }

                  return true
                })
                .map((s: any) => {
                  const content = JSON.parse(s.content)
                  const isSent = s.status === 'sent'
                  const isDeactivated = s.status === 'deactivated'
                  const isError = s.status === 'error'
                  const isSkipped = s.status === 'skipped'

                  return (
                    <Card
                      key={s.id}
                      className={`border-l-4 ${
                        isSent
                          ? 'border-l-green-500 bg-muted/10'
                          : isError
                            ? 'border-l-red-500 bg-red-500/5'
                            : isSkipped
                              ? 'border-l-amber-500 bg-amber-500/5'
                              : isDeactivated
                                ? 'border-l-muted bg-muted/5'
                                : 'border-l-primary bg-card/40'
                      } border-border/40 transition-all`}
                    >
                      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              {(
                                {
                                  text: 'texto',
                                  media: 'mídia',
                                  button: 'botões',
                                  poll: 'enquete',
                                  permission: 'permissão',
                                  profile: 'editar grupo',
                                } as Record<string, string>
                              )[s.type] || s.type}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {new Date(s.adjustedAt).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <p className="text-sm font-medium">
                            {s.type === 'text' &&
                              (content.text?.substring(0, 100) +
                                (content.text?.length > 100 ? '...' : ''))}
                            {s.type === 'media' &&
                              `[Mídia] ${content.caption || 'Sem legenda'}`}
                            {s.type === 'button' && `[Botões] ${content.title}`}
                            {s.type === 'poll' && `[Enquete] ${content.name}`}
                            {s.type === 'permission' &&
                              'Mudança de permissões'}
                            {s.type === 'profile' && 'Edição do grupo'}
                          </p>

                          {(s.links || []).length > 0 &&
                            (() => {
                              const totalCliques = s.links.reduce(
                                (soma: number, l: any) =>
                                  soma + (l._count?.clicks || 0),
                                0
                              )
                              return (
                                <Link
                                  href="/links"
                                  className="inline-block mt-1"
                                >
                                  <span
                                    className={`text-xs flex items-center gap-1 hover:underline ${
                                      totalCliques > 0
                                        ? 'text-primary font-medium'
                                        : 'text-muted-foreground'
                                    }`}
                                  >
                                    <MousePointerClick className="w-3 h-3" />
                                    {totalCliques} clique(s) em{' '}
                                    {s.links.length} link(s)
                                  </span>
                                </Link>
                              )
                            })()}

                          {content.mentionAll &&
                            ['text', 'media', 'button', 'poll'].includes(
                              s.type
                            ) && (
                              <p className="text-xs text-primary mt-1 flex items-center gap-1">
                                <Megaphone className="w-3 h-3" /> Marca todos os
                                membros
                              </p>
                            )}

                          {(s.type === 'permission' ||
                            s.type === 'profile') && (
                            <ScheduleSummary
                              type={s.type}
                              content={content}
                              appliedInfo={s.appliedInfo}
                              status={s.status}
                              estadoAtual={{
                                name: initialGroup.name,
                                topic: initialGroup.topic || '',
                                isAnnounce: initialGroup.isAnnounce,
                                isLocked: initialGroup.isLocked,
                                isApprovalRequired:
                                  initialGroup.isApprovalRequired,
                                adminOnlyAdd: initialGroup.adminOnlyAdd,
                              }}
                            />
                          )}

                          {s.status === 'skipped' && s.skipReason && (
                            <div className="mt-2 text-xs text-amber-500 bg-amber-500/10 p-2 rounded-md border border-amber-500/20 break-words">
                              <span className="font-bold">Nada a fazer:</span>{' '}
                              {s.skipReason}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-1 uppercase font-semibold">
                            Status:{' '}
                            <span
                              className={
                                isSent
                                  ? 'text-green-500'
                                  : isError
                                    ? 'text-red-500'
                                    : isSkipped
                                      ? 'text-amber-500'
                                      : isDeactivated
                                        ? 'text-muted-foreground'
                                        : 'text-primary'
                              }
                            >
                              {s.status}
                            </span>
                          </p>
                          {isError && s.errorMessage && (
                            <div className="mt-2 text-xs text-red-500 bg-red-500/10 p-2 rounded-md border border-red-500/20 max-w-full break-words">
                              <span className="font-bold">Falha:</span>{' '}
                              {s.errorMessage}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {(isError || s.status === 'pending') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendNow(s.id)}
                              className="text-primary hover:text-primary hover:bg-primary/10"
                              title="Tentar reenviar imediatamente"
                            >
                              <Send className="w-4 h-4 mr-2" /> Enviar Agora
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setPreviewSchedule(s)}
                          >
                            <Eye className="w-4 h-4 mr-2" /> Pré-visualizar
                          </Button>
                          {(s.status === 'pending' || isError) && (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => openEditModal(s)}
                                title="Editar agendamento"
                              >
                                <Edit className="w-4 h-4 sm:mr-2" />
                                <span className="hidden sm:inline">Editar</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeactivate(s.id)}
                                title="Desativar agendamento"
                              >
                                <PowerOff className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {s.status === 'deactivated' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditModal(s)}
                            >
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

          {/* Tab: Permissões do grupo */}
          <TabsContent
            value="permissions"
            className="space-y-4 animate-in fade-in-50"
          >
            <Card className="border-border/40 bg-card/40">
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" /> Permissões do grupo
                </CardTitle>
                <CardDescription>
                  Alterações são aplicadas direto no WhatsApp via Evolution API.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-3">
                {[
                  {
                    key: 'isAnnounce' as const,
                    icon: <MessageSquare className="w-4 h-4" />,
                    title: 'Somente administradores falam',
                    on: 'Só admins podem enviar mensagens',
                    off: 'Todos os membros podem enviar mensagens',
                    actionOn: 'announcement',
                    actionOff: 'not_announcement',
                  },
                  {
                    key: 'isLocked' as const,
                    icon: <Lock className="w-4 h-4" />,
                    title: 'Somente administradores editam o grupo',
                    on: 'Só admins mudam nome, foto e descrição',
                    off: 'Todos podem mudar nome, foto e descrição',
                    actionOn: 'locked',
                    actionOff: 'unlocked',
                  },
                  {
                    key: 'adminOnlyAdd' as const,
                    icon: <UserPlus className="w-4 h-4" />,
                    title: 'Somente administradores adicionam membros',
                    on: 'Só admins adicionam participantes',
                    off: 'Todos podem adicionar participantes',
                    actionOn: 'admin_add',
                    actionOff: 'all_member_add',
                  },
                  {
                    key: 'isApprovalRequired' as const,
                    icon: <Unlock className="w-4 h-4" />,
                    title: 'Aprovar novos participantes',
                    on: 'Entrada pelo link precisa de aprovação',
                    off: 'Entrada pelo link é liberada',
                    actionOn: 'approval_on',
                    actionOff: 'approval_off',
                  },
                ].map((item) => {
                  const active = perms[item.key]
                  const saving = savingPerm === item.key
                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border/50 bg-muted/20"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`mt-0.5 ${
                            active ? 'text-primary' : 'text-muted-foreground'
                          }`}
                        >
                          {item.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {active ? item.on : item.off}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                        <Switch
                          checked={active}
                          disabled={saving}
                          onCheckedChange={() =>
                            applyPermission(
                              item.key,
                              active ? item.actionOff : item.actionOn
                            )
                          }
                        />
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modais extraídos */}
      <ScheduleModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        editingId={editingId}
        newSchedule={newSchedule}
        setNewSchedule={setNewSchedule}
        isUploading={isUploading}
        setIsUploading={setIsUploading}
        uploadError={uploadError}
        setUploadError={setUploadError}
        erroBotoes={erroBotoes}
        onSubmit={handleSaveSchedule}
      />

      <WhatsAppPreviewModal
        open={!!previewSchedule}
        onOpenChange={(open) => !open && setPreviewSchedule(null)}
        previewSchedule={previewSchedule}
        groupName={initialGroup.name}
      />

      <CopyScheduleModal
        open={isCopyModalOpen}
        onOpenChange={setIsCopyModalOpen}
        schedules={schedules}
        selectedForCopy={selectedForCopy}
        toggleSelectForCopy={toggleSelectForCopy}
        onCopy={handleCopySelected}
      />

      <PasteScheduleModal
        open={isPasteModalOpen}
        onOpenChange={setIsPasteModalOpen}
        pasteText={pasteText}
        onPasteTextChange={(text) => {
          setPasteText(text)
          setPasteError(validatePastedJSON(text))
        }}
        pasteError={pasteError}
        onSubmit={handlePasteSubmit}
      />
    </AppShell>
  )
}
