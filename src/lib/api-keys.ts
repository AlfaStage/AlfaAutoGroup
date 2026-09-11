import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PREFIXO = 'aag_'

/** sha256 em hex. A chave em texto nunca é guardada. */
export function hashKey(chave: string) {
  return createHash('sha256').update(chave, 'utf8').digest('hex')
}

/** Gera uma chave nova e devolve o texto (mostrado uma única vez) e o hash. */
export function gerarChave() {
  const segredo = randomBytes(24).toString('hex')
  const chave = `${PREFIXO}${segredo}`
  return {
    chave,
    hash: hashKey(chave),
    // identifica a chave na listagem sem revelá-la
    prefix: `${PREFIXO}${segredo.slice(0, 6)}`
  }
}

/** Comparação em tempo constante, para não vazar informação pelo tempo. */
export function comparaSeguro(a: string, b: string) {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

// lastUsedAt não precisa de precisão: evita uma escrita por requisição
const ultimoRegistro = new Map<string, number>()
const INTERVALO_USO_MS = 60 * 1000

/**
 * Valida uma chave vinda do header Authorization.
 * Devolve a chave encontrada, ou null.
 */
export async function validarChaveApi(chave: string) {
  if (!chave || !chave.startsWith(PREFIXO)) return null

  const hash = hashKey(chave)

  const registro = await prisma.apiKey.findUnique({ where: { hash } })
  if (!registro || registro.revokedAt) return null

  // O findUnique já compara no banco; a comparação abaixo é defesa extra
  // contra um eventual índice case-insensitive.
  if (!comparaSeguro(registro.hash, hash)) return null

  const agora = Date.now()
  const ultimo = ultimoRegistro.get(registro.id) || 0
  if (agora - ultimo > INTERVALO_USO_MS) {
    ultimoRegistro.set(registro.id, agora)
    prisma.apiKey
      .update({ where: { id: registro.id }, data: { lastUsedAt: new Date() } })
      .catch(() => { /* registrar uso não pode derrubar a requisição */ })
  }

  return registro
}

/** Extrai a chave do header Authorization: Bearer <chave>. */
export function chaveDoHeader(request: Request) {
  const header = request.headers.get('authorization') || ''
  if (!header.toLowerCase().startsWith('bearer ')) return ''
  return header.slice(7).trim()
}
