'use client'

import { ArrowRight, Image as ImageIcon, Megaphone } from 'lucide-react'

/**
 * Resumo visual dos agendamentos que mudam o grupo (permission e profile).
 *
 * Antes de executar, mostra o que vai mudar comparando com o estado atual.
 * Depois de executar, mostra o antes e o depois reais, gravados em appliedInfo.
 * A foto nao guarda a versao antiga — so registra que foi trocada.
 */

type EstadoGrupo = {
  name?: string
  topic?: string
  isAnnounce?: boolean
  isLocked?: boolean
  isApprovalRequired?: boolean
  adminOnlyAdd?: boolean
}

const CAMPOS_PERMISSAO: {
  campo: keyof EstadoGrupo
  titulo: string
  quandoTrue: string
  quandoFalse: string
}[] = [
  { campo: 'isAnnounce', titulo: 'Quem pode falar', quandoTrue: 'Somente administradores', quandoFalse: 'Todos os membros' },
  { campo: 'isLocked', titulo: 'Quem edita o grupo', quandoTrue: 'Somente administradores', quandoFalse: 'Todos os membros' },
  { campo: 'adminOnlyAdd', titulo: 'Quem adiciona membros', quandoTrue: 'Somente administradores', quandoFalse: 'Todos os membros' },
  { campo: 'isApprovalRequired', titulo: 'Aprovar quem entra', quandoTrue: 'Exigir aprovação', quandoFalse: 'Entrada liberada' }
]

/** Qual estado cada acao produz, no formato do estado do grupo. */
const EFEITO: Record<string, [keyof EstadoGrupo, boolean]> = {
  announcement: ['isAnnounce', true],
  not_announcement: ['isAnnounce', false],
  locked: ['isLocked', true],
  unlocked: ['isLocked', false],
  approval_on: ['isApprovalRequired', true],
  approval_off: ['isApprovalRequired', false],
  admin_add: ['adminOnlyAdd', true],
  all_member_add: ['adminOnlyAdd', false]
}

function textoDe(campo: keyof EstadoGrupo, valor: boolean | undefined) {
  const def = CAMPOS_PERMISSAO.find(c => c.campo === campo)
  if (!def) return String(valor)
  return valor ? def.quandoTrue : def.quandoFalse
}

function Linha({
  titulo, antes, depois, semMudanca
}: {
  titulo: string
  antes?: string | null
  depois: string
  semMudanca?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className="text-muted-foreground">{titulo}:</span>
      {antes != null && antes !== '' && (
        <>
          <span className="line-through text-muted-foreground/70 break-all">{antes}</span>
          <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        </>
      )}
      {antes === '' && (
        <>
          <span className="italic text-muted-foreground/70">vazio</span>
          <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        </>
      )}
      <span className={semMudanca ? 'text-muted-foreground' : 'font-medium text-foreground break-all'}>
        {depois || <span className="italic text-muted-foreground/70">vazio</span>}
      </span>
      {semMudanca && (
        <span className="text-[10px] uppercase tracking-wide text-amber-500 border border-amber-500/40 rounded px-1.5 py-0.5">
          já estava assim
        </span>
      )}
    </div>
  )
}

export default function ScheduleSummary({
  type, content, appliedInfo, status, estadoAtual
}: {
  type: string
  content: any
  appliedInfo?: string | null
  status: string
  estadoAtual?: EstadoGrupo
}) {
  const executado = status === 'sent' || status === 'skipped'

  let info: any = null
  if (appliedInfo) {
    try { info = typeof appliedInfo === 'string' ? JSON.parse(appliedInfo) : appliedInfo } catch { /* ignora */ }
  }

  const before: EstadoGrupo | null = info?.before || null
  const after: EstadoGrupo | null = info?.after || null

  // ------------------------------------------------------------ permissão
  if (type === 'permission') {
    const acoes: string[] = Array.isArray(content?.actions)
      ? content.actions
      : content?.action ? [content.action] : []

    // Última ação de cada campo vence, igual ao executor.
    const alvos = new Map<keyof EstadoGrupo, boolean>()
    for (const a of acoes) {
      const efeito = EFEITO[a]
      if (efeito) alvos.set(efeito[0], efeito[1])
    }

    const referencia = executado ? before : estadoAtual

    return (
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Megaphone className="w-3.5 h-3.5 text-muted-foreground" />
          {executado ? 'Permissões alteradas' : 'Vai alterar as permissões'}
        </div>

        {Array.from(alvos.entries()).map(([campo, alvo]) => {
          const def = CAMPOS_PERMISSAO.find(c => c.campo === campo)
          if (!def) return null

          const valorAntes = referencia ? Boolean(referencia[campo]) : undefined
          const valorDepois = executado && after ? Boolean(after[campo]) : alvo
          const igual = valorAntes !== undefined && valorAntes === valorDepois

          return (
            <Linha
              key={String(campo)}
              titulo={def.titulo}
              antes={valorAntes === undefined ? null : textoDe(campo, valorAntes)}
              depois={textoDe(campo, valorDepois)}
              semMudanca={igual}
            />
          )
        })}

        {alvos.size === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma permissão informada.</p>
        )}
      </div>
    )
  }

  // --------------------------------------------------------------- perfil
  if (type === 'profile') {
    const temNome = typeof content?.name === 'string' && content.name.trim()
    const temDesc = typeof content?.description === 'string'
    const temFoto = Boolean(content?.picture)

    return (
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
          {executado ? 'Grupo alterado' : 'Vai alterar o grupo'}
        </div>

        {temNome && (
          <Linha
            titulo="Nome"
            antes={executado ? (before?.name ?? null) : (estadoAtual?.name ?? null)}
            depois={executado ? (after?.name || content.name) : content.name}
            semMudanca={executado
              ? before?.name === after?.name
              : estadoAtual?.name === content.name.trim()}
          />
        )}

        {temDesc && (
          <Linha
            titulo="Descrição"
            antes={executado ? (before?.topic ?? null) : (estadoAtual?.topic ?? null)}
            depois={executado ? (after?.topic ?? content.description) : content.description}
            semMudanca={executado
              ? before?.topic === after?.topic
              : estadoAtual?.topic === content.description}
          />
        )}

        {temFoto && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Foto:</span>
            <img
              src={content.picture}
              alt="Nova foto"
              className="w-8 h-8 rounded object-cover border border-border/50"
              onError={e => { e.currentTarget.style.display = 'none' }}
            />
            <span className="font-medium">
              {executado ? 'trocada' : 'nova imagem'}
            </span>
            <span className="text-muted-foreground/70">(a anterior não é guardada)</span>
          </div>
        )}

        {!temNome && !temDesc && !temFoto && (
          <p className="text-xs text-muted-foreground">Nenhum campo informado.</p>
        )}
      </div>
    )
  }

  return null
}
