/**
 * Tipos de agendamento aceitos pelo sistema.
 *
 * Os quatro primeiros enviam mensagem no grupo. Os dois ultimos mudam o
 * proprio grupo e por isso nao passam pelo jitter anti-ban: uma permissao
 * agendada para as 22h precisa valer as 22h.
 */

export const MESSAGE_TYPES = ['text', 'media', 'button', 'poll'] as const
export const GROUP_ACTION_TYPES = ['permission', 'profile'] as const

export const SCHEDULE_TYPES = [...MESSAGE_TYPES, ...GROUP_ACTION_TYPES] as const
export type ScheduleType = typeof SCHEDULE_TYPES[number]

export function isGroupActionType(type: string) {
  return (GROUP_ACTION_TYPES as readonly string[]).includes(type)
}

/** As oito acoes de permissao da Evolution GO, em pares. */
export const PERMISSION_GROUPS = [
  {
    key: 'fala',
    label: 'Quem pode falar',
    options: [
      { value: 'not_announcement', label: 'Todos os membros' },
      { value: 'announcement', label: 'Somente administradores' }
    ]
  },
  {
    key: 'edicao',
    label: 'Quem edita o grupo',
    options: [
      { value: 'unlocked', label: 'Todos os membros' },
      { value: 'locked', label: 'Somente administradores' }
    ]
  },
  {
    key: 'adicao',
    label: 'Quem adiciona membros',
    options: [
      { value: 'all_member_add', label: 'Todos os membros' },
      { value: 'admin_add', label: 'Somente administradores' }
    ]
  },
  {
    key: 'aprovacao',
    label: 'Aprovar quem entra pelo link',
    options: [
      { value: 'approval_off', label: 'Entrada liberada' },
      { value: 'approval_on', label: 'Exigir aprovação' }
    ]
  }
] as const

export const PERMISSION_ACTIONS = PERMISSION_GROUPS
  .flatMap(g => g.options.map(o => o.value)) as readonly string[]

export const PERMISSION_LABEL: Record<string, string> = {
  announcement: 'somente admins falam',
  not_announcement: 'todos podem falar',
  locked: 'somente admins editam o grupo',
  unlocked: 'todos podem editar o grupo',
  approval_on: 'aprovação para entrar exigida',
  approval_off: 'entrada pelo link liberada',
  admin_add: 'somente admins adicionam membros',
  all_member_add: 'todos podem adicionar membros'
}

/**
 * Valida o `content` de um agendamento.
 * Devolve uma mensagem de erro, ou string vazia quando esta tudo certo.
 */
export function validateScheduleContent(type: string, content: any): string {
  if (!type) return 'Informe o tipo do agendamento'
  if (!(SCHEDULE_TYPES as readonly string[]).includes(type)) {
    return `Tipo inválido: "${type}". Aceitos: ${SCHEDULE_TYPES.join(', ')}`
  }
  if (!content || typeof content !== 'object') {
    return 'content precisa ser um objeto'
  }

  if (type === 'permission') {
    const actions: unknown = Array.isArray(content.actions)
      ? content.actions
      : content.action ? [content.action] : []

    if (!Array.isArray(actions) || actions.length === 0) {
      return 'Informe ao menos uma permissão em content.actions'
    }
    const invalidas = (actions as string[]).filter(a => !PERMISSION_ACTIONS.includes(a))
    if (invalidas.length) {
      return `Permissão inválida: ${invalidas.join(', ')}. Aceitas: ${PERMISSION_ACTIONS.join(', ')}`
    }
    return ''
  }

  if (type === 'profile') {
    const temNome = typeof content.name === 'string' && content.name.trim()
    const temDesc = typeof content.description === 'string'
    const temFoto = typeof content.picture === 'string' && content.picture.trim()
    if (!temNome && !temDesc && !temFoto) {
      return 'Informe ao menos um de: name, description, picture'
    }
    if (typeof content.name === 'string' && content.name.length > 100) {
      return 'O nome do grupo aceita no máximo 100 caracteres'
    }
    return ''
  }

  // Mensagens: validacao minima, o worker ja trata os detalhes
  if (type === 'text' && !content.text) return 'content.text é obrigatório'
  if (type === 'media' && !content.media) return 'content.media é obrigatório'
  if (type === 'button') {
    const erroBotoes = validateButtons(content.buttons)
    if (erroBotoes) return erroBotoes
  }
  if (type === 'poll') {
    if (!content.name) return 'content.name é obrigatório na enquete'
    if (!Array.isArray(content.values) || content.values.length < 2) {
      return 'A enquete precisa de ao menos 2 opções em content.values'
    }
  }

  return ''
}

/** Mapa acao -> par a que ela pertence (fala, edicao, adicao, aprovacao). */
export const ACTION_TO_KEY: Record<string, string> = PERMISSION_GROUPS.reduce(
  (acc, g) => {
    for (const o of g.options) acc[o.value] = g.key
    return acc
  },
  {} as Record<string, string>
)

/** Converte a lista de ações do JSON para o formato do formulário. */
export function actionsToPermissions(actions: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const a of actions || []) {
    const key = ACTION_TO_KEY[a]
    if (key) out[key] = a
  }
  return out
}

/**
 * Regras de combinacao de botoes, aplicadas pelo servidor da Evolution GO.
 * Validar aqui evita que o agendamento so falhe na hora do envio.
 */
export function validateButtons(buttons: any): string {
  if (!Array.isArray(buttons) || buttons.length === 0) {
    return 'Adicione ao menos um botão'
  }

  const tipos = buttons.map((b: any) => String(b?.type || 'reply'))
  const temReply = tipos.includes('reply')
  const temCTA = tipos.some(t => t !== 'reply')

  if (temReply && temCTA) {
    return 'Botões de resposta rápida não podem ser misturados com botões de link, ligação, copiar ou Pix. Use um tipo só por mensagem.'
  }

  if (temReply && tipos.filter(t => t === 'reply').length > 3) {
    return 'No máximo 3 botões de resposta rápida por mensagem'
  }

  if (tipos.includes('pix') && buttons.length > 1) {
    return 'O botão Pix precisa ser enviado sozinho, sem outros botões'
  }

  for (const b of buttons) {
    const tipo = String(b?.type || 'reply')
    if (tipo !== 'pix' && !String(b?.displayText || '').trim()) {
      return 'Todo botão precisa de um texto'
    }
    if (tipo === 'url' && !String(b?.url || '').trim()) {
      return 'Botão de link precisa de uma URL'
    }
    if (tipo === 'call' && !String(b?.phoneNumber || '').trim()) {
      return 'Botão de ligação precisa de um telefone'
    }
    if (tipo === 'copy' && !String(b?.copyCode || '').trim()) {
      return 'Botão de copiar precisa de um código'
    }
  }

  return ''
}
