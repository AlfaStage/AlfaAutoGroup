'use client'

import { useState, useEffect } from 'react'
import BulkEditModal from './BulkEditModal'
import PainelAuditoriaMembros from '@/components/PainelAuditoriaMembros'
import PainelAgendaCampanhas from '@/components/PainelAgendaCampanhas'
import { PainelBoasVindas } from '@/components/PainelBoasVindas'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'
import {
  RefreshCcw,
  Plus,
  QrCode,
  Users,
  ClipboardPaste,
  Edit,
  CheckSquare,
  Square,
  PencilRuler,
  Tag as TagIcon,
  Search,
  MoreHorizontal,
  ShieldCheck,
  CalendarClock,
  Sparkles,
} from 'lucide-react'

// Submódulos SRP do Dashboard
import { InstanceStatusBar } from '@/app/dashboard/InstanceStatusBar'
import { DashboardKpis } from '@/app/dashboard/DashboardKpis'
import { GroupCardGrid } from '@/app/dashboard/GroupCardGrid'
import { NewInstanceModal } from '@/app/dashboard/NewInstanceModal'
import { QrCodeModal } from '@/app/dashboard/QrCodeModal'
import { NewGroupModal } from '@/app/dashboard/NewGroupModal'
import { MassCreateModal } from '@/app/dashboard/MassCreateModal'
import { MassPasteModal } from '@/app/dashboard/MassPasteModal'

export default function DashboardClient({ initialGroups }: { initialGroups: any[] }) {
  const [groups, setGroups] = useState(initialGroups)

  // Instance state
  const [instances, setInstances] = useState<any[]>([])
  const [selectedInstance, setSelectedInstance] = useState<string>('')
  const [connectionState, setConnectionState] = useState<string>('unknown')

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [buscaGrupos, setBuscaGrupos] = useState('')
  const [tagFiltro, setTagFiltro] = useState<string>('todas')
  const [modoSelecao, setModoSelecao] = useState(false)
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [bulkAberto, setBulkAberto] = useState(false)
  const [tagsDoPainel, setTagsDoPainel] = useState<any[]>([])
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [qrCodeBase64, setQrCodeBase64] = useState<string>('')

  const [isInstanceModalOpen, setIsInstanceModalOpen] = useState(false)
  const [newInstance, setNewInstance] = useState({
    instanceName: '',
    proxyHost: '',
    proxyPort: '',
    proxyProtocol: 'http',
    proxyUsername: '',
    proxyPassword: '',
  })
  const [newGroup, setNewGroup] = useState({
    name: '',
    slug: '',
    description: '',
    participants: '',
    instanceName: '',
  })

  // Mass Paste State
  const [isMassPasteModalOpen, setIsMassPasteModalOpen] = useState(false)
  const [massPasteText, setMassPasteText] = useState('')
  const [massPasteError, setMassPasteError] = useState('')
  const [selectedGroupsForPaste, setSelectedGroupsForPaste] = useState<string[]>([])
  const [isPasting, setIsPasting] = useState(false)
  const [searchTermPaste, setSearchTermPaste] = useState('')

  // Mass Create State
  const [visaoAtiva, setVisaoAtiva] = useState<string>('grupos')
  const [isMassCreateModalOpen, setIsMassCreateModalOpen] = useState(false)
  const [selectedGroupsForCreate, setSelectedGroupsForCreate] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [campanhaMassa, setCampanhaMassa] = useState('')

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
    trackLinks: true,
    mentionAll: false,
    scheduledAt: '',
  })

  const [newSchedules, setNewSchedules] = useState([getEmptySchedule()])

  const updateSchedule = (index: number, updates: any) => {
    setNewSchedules((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...updates } : s))
    )
  }

  useEffect(() => {
    fetch('/api/tags')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setTagsDoPainel(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  // Fetch instances on mount
  useEffect(() => {
    fetch('/api/instances')
      .then((res) => res.json())
      .then((resData) => {
        const data = Array.isArray(resData) ? resData : resData.data || []
        if (Array.isArray(data)) {
          setInstances(data)
          const saved = localStorage.getItem('selectedInstance')
          if (
            saved &&
            data.find((i: any) => (i.instance?.instanceName || i.name) === saved)
          ) {
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
    if (!selectedInstance) return

    localStorage.setItem('selectedInstance', selectedInstance)
    setNewGroup((prev) => ({ ...prev, instanceName: selectedInstance }))

    const checkStatus = async () => {
      try {
        const selectedObj = instances.find(
          (i) => (i.instance?.instanceName || i.name) === selectedInstance
        )
        const token = selectedObj?.token || ''

        const res = await fetch(`/api/instances/${selectedInstance}/status`, {
          headers: { 'x-instance-token': token },
        })
        if (res.ok) {
          const data = await res.json()
          let state =
            data.instance?.state ||
            data.instance?.status ||
            data.state ||
            data.status ||
            data.data?.state ||
            'unknown'
          if (typeof state === 'string') state = state.toLowerCase()

          if (data.data?.LoggedIn === false) {
            state = 'close'
          } else if (
            state === 'close' ||
            state === 'disconnected' ||
            data.error ||
            data.status === 'disconnected'
          ) {
            state = 'close'
          } else if (data.data?.Connected && state === 'unknown') {
            state = 'open'
          }

          setConnectionState(state)
        } else {
          setConnectionState('close')
        }
      } catch (e) {
        setConnectionState('error')
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 30000)
    return () => clearInterval(interval)
  }, [selectedInstance, instances])

  const handleOpenQrCode = async () => {
    if (!selectedInstance) return
    try {
      setQrCodeBase64('')
      const selectedObj = instances.find(
        (i) => (i.instance?.instanceName || i.name) === selectedInstance
      )
      const token = selectedObj?.token || ''

      const res = await fetch(`/api/instances/${selectedInstance}/connect`, {
        headers: { 'x-instance-token': token },
      })

      if (res.ok) {
        const data = await res.json()
        const base64Str =
          data.base64 ||
          data.qrcode?.base64 ||
          data.data?.base64 ||
          data.data?.qrcode?.base64 ||
          data.data?.qrcode ||
          data.qrcode ||
          ''
        if (base64Str) {
          setQrCodeBase64(base64Str)
          setIsQrModalOpen(true)
        } else {
          toast({
            title: 'QR Code indisponível',
            description: 'O QR Code não foi retornado pela API. Verifique o console.',
            variant: 'destructive',
          })
        }
      } else {
        toast({
          title: 'Erro ao buscar QR Code',
          description: `Status retornado: ${res.status}`,
          variant: 'destructive',
        })
      }
    } catch (e) {
      toast({
        title: 'Erro interno',
        description: 'Erro interno ao buscar QR Code.',
        variant: 'destructive',
      })
    }
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGroup),
      })
      if (res.ok) {
        const created = await res.json()
        setGroups([...groups, { ...created, _count: { members: 0, schedules: 0 } }])
        setIsModalOpen(false)
        setNewGroup({
          name: '',
          slug: '',
          description: '',
          participants: '',
          instanceName: selectedInstance,
        })
        toast({
          title: 'Grupo criado',
          description: 'Grupo criado com sucesso!',
          variant: 'success',
        })
      } else {
        const err = await res.json()
        toast({
          title: 'Erro ao criar grupo',
          description: err.error || err.details || 'Desconhecido',
          variant: 'destructive',
        })
      }
    } catch (err) {
      toast({
        title: 'Erro fatal',
        description: 'Erro fatal ao criar grupo.',
        variant: 'destructive',
      })
    }
  }

  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/instances/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newInstance),
      })
      if (res.ok) {
        setIsInstanceModalOpen(false)
        setNewInstance({
          instanceName: '',
          proxyHost: '',
          proxyPort: '',
          proxyProtocol: 'http',
          proxyUsername: '',
          proxyPassword: '',
        })
        window.location.reload()
      } else {
        toast({
          title: 'Erro ao criar instância',
          description: 'Abra o console (F12) para ver os detalhes completos.',
          variant: 'destructive',
        })
      }
    } catch (err) {
      toast({
        title: 'Falha na rede',
        description: 'Falha na rede ao tentar criar a instância.',
        variant: 'destructive',
      })
    }
  }

  const handleSyncGroups = async () => {
    if (!selectedInstance) return
    try {
      const selectedObj = instances.find(
        (i) => (i.instance?.instanceName || i.name) === selectedInstance
      )
      const token = selectedObj?.token || ''
      const res = await fetch(`/api/instances/${selectedInstance}/sync-groups`, {
        method: 'POST',
        headers: { 'x-instance-token': token },
      })
      if (res.ok) {
        toast({
          title: 'Sincronizado',
          description: 'Grupos sincronizados com sucesso!',
          variant: 'success',
        })
        window.location.reload()
      } else {
        toast({
          title: 'Erro de sincronização',
          description: 'Não foi possível sincronizar os grupos.',
          variant: 'destructive',
        })
      }
    } catch (e) {
      toast({
        title: 'Erro de sincronização',
        description: 'Erro ao sincronizar grupos.',
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

  const handleMassPasteClick = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const err = validatePastedJSON(text)
      setMassPasteText(text)
      setMassPasteError(err || '')
      setSelectedGroupsForPaste([])
      setIsMassPasteModalOpen(true)
    } catch (err) {
      setMassPasteText('')
      setMassPasteError('Cole o código JSON aqui')
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
          status: 'pending',
        }
        const res = await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          insertedCount++
        }
      }

      toast({
        title: 'Agendamentos colados',
        description: `${insertedCount} agendamento(s) colado(s) com sucesso em ${selectedGroupsForPaste.length} grupo(s)!`,
        variant: 'success',
      })
      setIsMassPasteModalOpen(false)
      window.location.reload()
    } catch (e) {
      toast({
        title: 'Erro ao colar',
        description: 'Erro ao colar agendamentos.',
        variant: 'destructive',
      })
    } finally {
      setIsPasting(false)
    }
  }

  const handleMassCreateClick = () => {
    setSelectedGroupsForCreate([])
    setNewSchedules([getEmptySchedule()])
    setCampanhaMassa('')
    setIsMassCreateModalOpen(true)
  }

  const handlePasteIntoCreate = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text) return
      const parsed = JSON.parse(text)
      const arr = Array.isArray(parsed) ? parsed : [parsed]

      const newItems = arr.map((item) => ({
        type: item.type || 'text',
        text: item.type === 'text' ? item.content?.text || '' : '',
        mediaUrl:
          item.type === 'media' || item.type === 'button'
            ? item.content?.media || item.content?.imageUrl || item.content?.videoUrl || ''
            : '',
        mediatype:
          item.type === 'media'
            ? item.content?.mediatype || 'image'
            : item.content?.videoUrl
              ? 'video'
              : 'image',
        caption: item.content?.caption || '',
        fileName: item.content?.fileName || '',
        title: item.content?.title || '',
        description: item.content?.description || '',
        footer: item.content?.footer || '',
        buttonsList:
          item.content?.buttons && item.content.buttons.length > 0
            ? item.content.buttons
            : [{ type: 'reply', displayText: 'Sim', id: 'btn1' }],
        pollName: item.content?.name || '',
        pollOptions: item.content?.values
          ? item.content.values.join(', ')
          : 'Opção 1, Opção 2',
        trackLinks: item.content?.trackLinks !== false,
        mentionAll: Boolean(item.content?.mentionAll),
        scheduledAt: item.scheduledAt
          ? new Date(item.scheduledAt).toISOString().slice(0, 16)
          : '',
      }))

      setNewSchedules((prev) => {
        if (
          prev.length === 1 &&
          prev[0].type === 'text' &&
          !prev[0].text &&
          !prev[0].scheduledAt
        ) {
          return newItems
        }
        return [...prev, ...newItems]
      })
    } catch (e) {
      toast({
        title: 'JSON inválido',
        description: 'O texto na área de transferência não é um JSON válido de agendamento.',
        variant: 'destructive',
      })
    }
  }

  const handleMassCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedGroupsForCreate.length === 0) {
      toast({
        title: 'Atenção',
        description: 'Selecione pelo menos um grupo destino.',
        variant: 'warning',
      })
      return
    }

    for (const schedule of newSchedules) {
      if (!schedule.scheduledAt) {
        toast({
          title: 'Atenção',
          description: 'Preencha a Data e Hora para todas as mensagens.',
          variant: 'warning',
        })
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
            content = {
              text: schedule.text,
              trackLinks: Boolean(schedule.trackLinks),
              mentionAll: Boolean(schedule.mentionAll),
            }
          } else if (schedule.type === 'media') {
            content = {
              mediatype: schedule.mediatype,
              media: schedule.mediaUrl,
              caption: schedule.caption,
              fileName: schedule.fileName,
              trackLinks: Boolean(schedule.trackLinks),
              mentionAll: Boolean(schedule.mentionAll),
            }
          } else if (schedule.type === 'button') {
            content = {
              title: schedule.title,
              description: schedule.description,
              footer: schedule.footer,
              buttons: schedule.buttonsList,
              mentionAll: Boolean(schedule.mentionAll),
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
            const opts = schedule.pollOptions
              .split(',')
              .map((o: string) => o.trim())
              .filter(Boolean)
            content = {
              name: schedule.pollName,
              selectableCount: 1,
              values: opts,
              mentionAll: Boolean(schedule.mentionAll),
            }
          }

          const payload = {
            groupId: groupId,
            type: schedule.type,
            content,
            campaign: campanhaMassa ? campanhaMassa.trim() : null,
            scheduledAt: new Date(schedule.scheduledAt).toISOString(),
            status: 'pending',
          }

          const res = await fetch('/api/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (res.ok) {
            insertedCount++
          }
        }
      }

      toast({
        title: 'Sucesso',
        description: `${insertedCount} agendamento(s) criado(s) com sucesso em ${selectedGroupsForCreate.length} grupo(s)!`,
        variant: 'success',
      })
      setIsMassCreateModalOpen(false)
      window.location.reload()
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Erro ao criar agendamentos em massa.',
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
    }
  }

  const gruposDaInstancia = selectedInstance
    ? groups
        .filter((g) => g.instanceName === selectedInstance)
        .sort((a, b) => a.name.localeCompare(b.name))
    : []

  const termoBusca = buscaGrupos.trim().toLowerCase()
  const filteredGroups = gruposDaInstancia.filter((g) => {
    const matchesBusca =
      !termoBusca ||
      g.name.toLowerCase().includes(termoBusca) ||
      (g.description || '').toLowerCase().includes(termoBusca)
    const matchesTag =
      tagFiltro === 'todas'
        ? true
        : tagFiltro === 'sem_tag'
          ? !g.tags || g.tags.length === 0
          : Array.isArray(g.tags) &&
            g.tags.some(
              (gt: any) =>
                gt.tagId === tagFiltro ||
                gt.tag?.id === tagFiltro ||
                gt.tag?.slug === tagFiltro
            )
    return matchesBusca && matchesTag
  })

  const totalSent = filteredGroups.reduce(
    (acc, g) => acc + (g.schedules?.filter((s: any) => s.status === 'sent').length || 0),
    0
  )
  const totalPending = filteredGroups.reduce(
    (acc, g) =>
      acc + (g.schedules?.filter((s: any) => s.status === 'pending').length || 0),
    0
  )
  const totalError = filteredGroups.reduce(
    (acc, g) =>
      acc + (g.schedules?.filter((s: any) => s.status === 'error').length || 0),
    0
  )
  const totalDeactivated = filteredGroups.reduce(
    (acc, g) =>
      acc +
      (g.schedules?.filter((s: any) => s.status === 'deactivated').length || 0),
    0
  )

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* 1. Barra de status da conexão e seleção da instância */}
      <InstanceStatusBar
        connectionState={connectionState}
        selectedInstance={selectedInstance}
        setSelectedInstance={setSelectedInstance}
        instances={instances}
        onOpenQrCode={handleOpenQrCode}
        onOpenNewInstance={() => setIsInstanceModalOpen(true)}
      />

      {/* 2. Métricas do dia (KPIs) */}
      <DashboardKpis
        totalSent={totalSent}
        totalPending={totalPending}
        totalError={totalError}
        totalDeactivated={totalDeactivated}
      />

      {/* 3. Seletor de Visão Principal padronizado com Tabs */}
      <Tabs value={visaoAtiva} onValueChange={setVisaoAtiva} className="w-full space-y-4">
        <TabsList className="bg-muted/40 p-1 border border-border/40 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="grupos" className="gap-1.5">
            <Users className="w-4 h-4" /> Meus Grupos ({gruposDaInstancia.length})
          </TabsTrigger>
          <TabsTrigger value="agenda" className="gap-1.5">
            <CalendarClock className="w-4 h-4" /> Agenda &amp; Fila Global ({totalPending})
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Auditoria de Membros &amp; DDDs
          </TabsTrigger>
          <TabsTrigger value="boas_vindas" className="gap-1.5">
            <Sparkles className="w-4 h-4" /> Boas-Vindas (PV)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="mt-4">
          <PainelAgendaCampanhas
            tags={tagsDoPainel}
            instances={instances}
            onChanged={() => window.location.reload()}
          />
        </TabsContent>

        <TabsContent value="boas_vindas" className="mt-4">
          <PainelBoasVindas groups={groups} tags={tagsDoPainel} />
        </TabsContent>

        <TabsContent value="auditoria" className="mt-4">
          <PainelAuditoriaMembros
            tagId={
              tagFiltro !== 'todas' && tagFiltro !== 'sem_tag' ? tagFiltro : undefined
            }
          />
        </TabsContent>

        <TabsContent value="grupos" className="space-y-4 mt-4">
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Meus grupos</h2>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {termoBusca
                  ? `${filteredGroups.length} de ${gruposDaInstancia.length}`
                  : `${gruposDaInstancia.length} grupo(s)`}
              </span>
            </div>

            {/* Busca e filtro por tags */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar grupo pelo nome ou descrição…"
                  value={buscaGrupos}
                  onChange={(e) => setBuscaGrupos(e.target.value)}
                  className="pl-9"
                />
              </div>

              {tagsDoPainel.length > 0 && (
                <Select value={tagFiltro} onValueChange={setTagFiltro}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <TagIcon className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Todas as tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as tags</SelectItem>
                    <SelectItem value="sem_tag">Sem tag</SelectItem>
                    {tagsDoPainel.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: t.color || '#6366f1' }}
                          />
                          {t.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={handleSyncGroups}
                  className="flex-1 sm:flex-none"
                >
                  <RefreshCcw className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Sincronizar</span>
                </Button>

                <Button
                  onClick={() => setIsModalOpen(true)}
                  className="flex-1 sm:flex-none"
                >
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Novo grupo</span>
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" title="Mais ações">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    <DropdownMenuLabel>Em vários grupos</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => {
                        setModoSelecao(!modoSelecao)
                        setSelecionados([])
                      }}
                    >
                      <PencilRuler className="w-4 h-4 mr-2" />
                      {modoSelecao
                        ? 'Cancelar seleção'
                        : 'Editar nome, foto e descrição'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleMassCreateClick}>
                      <Edit className="w-4 h-4 mr-2" />
                      Agendar em massa
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleMassPasteClick}>
                      <ClipboardPaste className="w-4 h-4 mr-2" />
                      Colar agendamentos (JSON)
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Instância</DropdownMenuLabel>
                    <DropdownMenuItem onClick={handleOpenQrCode}>
                      <QrCode className="w-4 h-4 mr-2" />
                      QR Code de conexão
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsInstanceModalOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Nova instância
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {modoSelecao && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-primary/40 bg-primary/5">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setSelecionados(
                      selecionados.length === filteredGroups.length
                        ? []
                        : filteredGroups.map((g: any) => g.id)
                    )
                  }
                >
                  {selecionados.length === filteredGroups.length &&
                  filteredGroups.length > 0 ? (
                    <CheckSquare className="w-4 h-4 mr-2" />
                  ) : (
                    <Square className="w-4 h-4 mr-2" />
                  )}
                  {selecionados.length === filteredGroups.length &&
                  filteredGroups.length > 0
                    ? 'Desmarcar todos'
                    : 'Marcar todos'}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selecionados.length} grupo(s) selecionado(s)
                </span>

                {tagsDoPainel.map((t) => {
                  const idsAqui = t.grupos
                    .map((g: any) => g.id)
                    .filter((id: string) => filteredGroups.some((fg: any) => fg.id === id))
                  if (idsAqui.length === 0) return null
                  const todosJa = idsAqui.every((id: string) =>
                    selecionados.includes(id)
                  )
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setSelecionados(
                          todosJa
                            ? selecionados.filter((id) => !idsAqui.includes(id))
                            : Array.from(new Set([...selecionados, ...idsAqui]))
                        )
                      }
                      className={`text-xs px-2 py-1 rounded-lg border flex items-center gap-1.5 ${
                        todosJa
                          ? 'border-transparent text-white'
                          : 'border-border/60 bg-muted/20 hover:bg-muted/40'
                      }`}
                      style={todosJa ? { backgroundColor: t.color } : undefined}
                      title={`Marcar os ${idsAqui.length} grupo(s) da tag ${t.name}`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: todosJa
                            ? 'rgba(255,255,255,.85)'
                            : t.color,
                        }}
                      />
                      {t.name}
                      <span className="opacity-70">{idsAqui.length}</span>
                    </button>
                  )
                })}
              </div>
              <Button
                disabled={selecionados.length === 0}
                onClick={() => setBulkAberto(true)}
              >
                <PencilRuler className="w-4 h-4 mr-2" />
                Editar selecionados
              </Button>
            </div>
          )}

          {/* Grid de Cards dos Grupos */}
          <GroupCardGrid
            filteredGroups={filteredGroups}
            modoSelecao={modoSelecao}
            selecionados={selecionados}
            setSelecionados={setSelecionados}
            onOpenNewGroup={() => setIsModalOpen(true)}
          />
        </TabsContent>
      </Tabs>

      {/* 4. Modais padronizados com Header, Body e Footer fixos */}
      <MassPasteModal
        open={isMassPasteModalOpen}
        onOpenChange={setIsMassPasteModalOpen}
        filteredGroups={filteredGroups}
        selectedInstance={selectedInstance}
        massPasteText={massPasteText}
        setMassPasteText={setMassPasteText}
        massPasteError={massPasteError}
        setMassPasteError={setMassPasteError}
        validatePastedJSON={validatePastedJSON}
        selectedGroupsForPaste={selectedGroupsForPaste}
        setSelectedGroupsForPaste={setSelectedGroupsForPaste}
        searchTermPaste={searchTermPaste}
        setSearchTermPaste={setSearchTermPaste}
        isPasting={isPasting}
        onSubmit={handleMassPasteSubmit}
      />

      <MassCreateModal
        open={isMassCreateModalOpen}
        onOpenChange={setIsMassCreateModalOpen}
        filteredGroups={filteredGroups}
        selectedInstance={selectedInstance}
        selectedGroupsForCreate={selectedGroupsForCreate}
        setSelectedGroupsForCreate={setSelectedGroupsForCreate}
        campanhaMassa={campanhaMassa}
        setCampanhaMassa={setCampanhaMassa}
        newSchedules={newSchedules}
        setNewSchedules={setNewSchedules}
        updateSchedule={updateSchedule}
        getEmptySchedule={getEmptySchedule}
        isCreating={isCreating}
        isUploading={isUploading}
        setIsUploading={setIsUploading}
        uploadError={uploadError}
        setUploadError={setUploadError}
        onSubmit={handleMassCreateSubmit}
        onPasteIntoCreate={handlePasteIntoCreate}
      />

      <NewGroupModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        newGroup={newGroup}
        setNewGroup={setNewGroup}
        onSubmit={handleCreateGroup}
      />

      <QrCodeModal
        open={isQrModalOpen}
        onOpenChange={setIsQrModalOpen}
        qrCodeBase64={qrCodeBase64}
        onRefresh={() => {
          setQrCodeBase64('')
          handleOpenQrCode()
        }}
      />

      <NewInstanceModal
        open={isInstanceModalOpen}
        onOpenChange={setIsInstanceModalOpen}
        newInstance={newInstance}
        setNewInstance={setNewInstance}
        onSubmit={handleCreateInstance}
      />

      {/* Bulk Edit Modal */}
      <BulkEditModal
        open={bulkAberto}
        onOpenChange={setBulkAberto}
        groupIds={selecionados}
        onDone={() => {
          setModoSelecao(false)
          setSelecionados([])
          window.location.reload()
        }}
      />
    </div>
  )
}
