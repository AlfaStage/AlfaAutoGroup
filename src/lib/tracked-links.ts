import { randomBytes } from 'crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Encurtador com contagem de cliques.
 *
 * O link publicado vira /l/{code}, que redireciona para o destino real e
 * registra o clique. A troca acontece na criacao do agendamento, para o
 * codigo ja existir quando a mensagem sair.
 */

/** Codigo curto: 7 caracteres, sem ambiguidade visual. */
function gerarCodigo() {
  const alfabeto = 'abcdefghijkmnpqrstuvwxyz23456789'
  const bytes = randomBytes(7)
  let saida = ''
  for (let i = 0; i < 7; i++) saida += alfabeto[bytes[i] % alfabeto.length]
  return saida
}

async function codigoLivre() {
  for (let i = 0; i < 5; i++) {
    const code = gerarCodigo()
    const existe = await prisma.trackedLink.findUnique({ where: { code } })
    if (!existe) return code
  }
  // Praticamente inalcancavel; evita loop infinito.
  return gerarCodigo() + Date.now().toString(36).slice(-3)
}

export function ehUrlValida(valor: string) {
  try {
    const u = new URL(valor)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export async function criarLinkRastreado(opcoes: {
  url: string
  label?: string
  groupId?: string
  scheduleId?: string
}) {
  const code = await codigoLivre()
  return prisma.trackedLink.create({
    data: {
      code,
      url: opcoes.url,
      label: opcoes.label || null,
      groupId: opcoes.groupId || null,
      scheduleId: opcoes.scheduleId || null
    }
  })
}

export function urlCurta(baseUrl: string, code: string) {
  return `${baseUrl.replace(/\/+$/, '')}/l/${code}`
}

/** Acha URLs soltas num texto. */
const REGEX_URL = /https?:\/\/[^\s<>"')]+/g

/**
 * Troca as URLs de um texto por links rastreados.
 * Devolve o texto novo e os links criados.
 */
export async function rastrearLinksDoTexto(
  texto: string,
  baseUrl: string,
  contexto: { groupId?: string; label?: string }
) {
  const encontradas = Array.from(new Set(texto.match(REGEX_URL) || []))
  if (encontradas.length === 0) return { texto, links: [] as any[] }

  const links: any[] = []
  let saida = texto

  for (const url of encontradas) {
    // Nao encurta o que ja e um link nosso.
    if (url.includes('/l/')) continue

    const link = await criarLinkRastreado({
      url,
      label: contexto.label,
      groupId: contexto.groupId
    })
    links.push(link)

    const curta = urlCurta(baseUrl, link.code)
    saida = saida.split(url).join(curta)
  }

  return { texto: saida, links }
}

/**
 * Troca as URLs dos botoes marcados com `track: true`.
 * Muta uma copia; nao altera o array recebido.
 */
export async function rastrearLinksDosBotoes(
  buttons: any[],
  baseUrl: string,
  contexto: { groupId?: string }
) {
  const saida: any[] = []
  const links: any[] = []

  for (const b of buttons || []) {
    const copia = { ...b }

    if (copia.type === 'url' && copia.track && ehUrlValida(String(copia.url || ''))) {
      const link = await criarLinkRastreado({
        url: String(copia.url),
        label: String(copia.displayText || 'botão'),
        groupId: contexto.groupId
      })
      links.push(link)
      copia.url = urlCurta(baseUrl, link.code)
    }

    // `track` e instrucao nossa, nao vai para a Evolution.
    delete copia.track
    saida.push(copia)
  }

  return { buttons: saida, links }
}

/**
 * Ponto unico chamado na criacao do agendamento.
 * Reescreve o content quando o pedido marcou rastreio.
 */
export async function aplicarRastreio(
  type: string,
  content: any,
  baseUrl: string,
  groupId?: string
) {
  if (!baseUrl) return { content, links: [] as any[] }

  const novo = { ...content }
  const links: any[] = []

  if ((type === 'text' || type === 'media') && novo.trackLinks) {
    const campo = type === 'text' ? 'text' : 'caption'
    if (typeof novo[campo] === 'string' && novo[campo]) {
      const r = await rastrearLinksDoTexto(novo[campo], baseUrl, { groupId })
      novo[campo] = r.texto
      links.push(...r.links)
    }
    delete novo.trackLinks
  }

  if (type === 'button' && Array.isArray(novo.buttons)) {
    const r = await rastrearLinksDosBotoes(novo.buttons, baseUrl, { groupId })
    novo.buttons = r.buttons
    links.push(...r.links)
  }

  return { content: novo, links }
}
