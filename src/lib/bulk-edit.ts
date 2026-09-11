/**
 * Edicao em massa de grupos.
 *
 * Nao aplica nada direto: gera um agendamento `profile` por grupo, espacado
 * no tempo. Assim reaproveita todo o pipeline que ja existe — o verificador
 * de estado, as tentativas e o historico — e evita disparar 25 alteracoes
 * de uma vez, que e o tipo de comportamento que o WhatsApp pune.
 */

export type GrupoAlvo = {
  id: string
  name: string
  topic?: string | null
}

export type PedidoEmMassa = {
  nameTemplate?: string
  description?: string
  picture?: string
  /** Segundos entre uma alteracao e a proxima. */
  spacingSeconds?: number
  /** Quando comecar. Ausente = agora. */
  startAt?: string
}

export const ESPACO_PADRAO_S = 45
export const ESPACO_MINIMO_S = 10

/**
 * Variaveis aceitas no template de nome:
 *   {n}     posicao do grupo na selecao (1, 2, 3...)
 *   {nn}    posicao com zero a esquerda (01, 02...)
 *   {total} quantidade de grupos selecionados
 *   {nome}  nome atual do grupo
 */
export function aplicarTemplate(
  template: string,
  grupo: GrupoAlvo,
  indice: number,
  total: number
) {
  const n = indice + 1
  return template
    .replace(/\{n\}/g, String(n))
    .replace(/\{nn\}/g, String(n).padStart(2, '0'))
    .replace(/\{total\}/g, String(total))
    .replace(/\{nome\}/g, grupo.name)
    .trim()
}

export function templateUsaNumeracao(template: string) {
  return /\{nn?\}/.test(template)
}

export type LinhaPrevia = {
  groupId: string
  nomeAtual: string
  nomeNovo: string | null
  mudaNome: boolean
  mudaDescricao: boolean
  mudaFoto: boolean
  quando: string
}

/**
 * Monta a previa do lote. Nao toca no banco — serve tanto para mostrar na
 * tela quanto para gerar os agendamentos depois, com o mesmo calculo.
 */
export function montarPrevia(grupos: GrupoAlvo[], pedido: PedidoEmMassa): LinhaPrevia[] {
  const total = grupos.length
  const espaco = Math.max(ESPACO_MINIMO_S, pedido.spacingSeconds ?? ESPACO_PADRAO_S)
  const inicio = pedido.startAt ? new Date(pedido.startAt).getTime() : Date.now() + 30_000

  const temNome = Boolean(pedido.nameTemplate && pedido.nameTemplate.trim())
  const temDescricao = typeof pedido.description === 'string'
  const temFoto = Boolean(pedido.picture && pedido.picture.trim())

  return grupos.map((g, i) => {
    const nomeNovo = temNome
      ? aplicarTemplate(pedido.nameTemplate as string, g, i, total)
      : null

    return {
      groupId: g.id,
      nomeAtual: g.name,
      nomeNovo,
      mudaNome: Boolean(nomeNovo && nomeNovo !== g.name),
      mudaDescricao: temDescricao && pedido.description !== (g.topic || ''),
      mudaFoto: temFoto,
      quando: new Date(inicio + i * espaco * 1000).toISOString()
    }
  })
}

/** O `content` do agendamento de perfil para uma linha da previa. */
export function contentDaLinha(linha: LinhaPrevia, pedido: PedidoEmMassa) {
  const content: Record<string, string> = {}
  if (linha.mudaNome && linha.nomeNovo) content.name = linha.nomeNovo
  if (linha.mudaDescricao && typeof pedido.description === 'string') {
    content.description = pedido.description
  }
  if (linha.mudaFoto && pedido.picture) content.picture = pedido.picture
  return content
}

export function validarPedido(pedido: PedidoEmMassa, quantidadeGrupos: number): string {
  if (quantidadeGrupos === 0) return 'Selecione ao menos um grupo'

  const temNome = Boolean(pedido.nameTemplate && pedido.nameTemplate.trim())
  const temDescricao = typeof pedido.description === 'string'
  const temFoto = Boolean(pedido.picture && pedido.picture.trim())

  if (!temNome && !temDescricao && !temFoto) {
    return 'Informe ao menos um de: nome, descrição ou foto'
  }

  if (temNome && (pedido.nameTemplate as string).length > 100) {
    return 'O template de nome passa de 100 caracteres'
  }

  if (pedido.spacingSeconds !== undefined && pedido.spacingSeconds < ESPACO_MINIMO_S) {
    return `O espaçamento mínimo é de ${ESPACO_MINIMO_S} segundos`
  }

  if (pedido.startAt && isNaN(new Date(pedido.startAt).getTime())) {
    return 'Data de início inválida'
  }

  return ''
}
