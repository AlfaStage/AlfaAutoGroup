/**
 * Cliente da Evolution GO.
 *
 * Dois pontos que valem lembrar, porque a API v2 (Node) funciona diferente:
 *  - a instância é identificada pelo token no header `apikey`, não por um
 *    nome na URL;
 *  - a chave global só serve para /instance/all e /instance/create. Todo o
 *    resto exige o token da própria instância.
 */

const API_URL = () => process.env.EVOLUTION_API_URL || ''
const GLOBAL_KEY = () => process.env.EVOLUTION_API_KEY || ''

export type EvolutionInstance = {
  id?: string
  name?: string
  token?: string
  jid?: string
  connected?: boolean
}

// O token de uma instância quase nunca muda; evita um /instance/all por chamada.
const tokenCache = new Map<string, { token: string; at: number }>()
const TOKEN_TTL_MS = 5 * 60 * 1000

export function evolutionConfigured() {
  return Boolean(API_URL() && GLOBAL_KEY())
}

export async function listInstances(): Promise<EvolutionInstance[]> {
  const res = await fetch(`${API_URL()}/instance/all`, {
    headers: { apikey: GLOBAL_KEY() },
    cache: 'no-store'
  })
  if (!res.ok) return []

  const body = await res.json().catch(() => null)
  const list = Array.isArray(body) ? body : (body?.data || [])
  return Array.isArray(list) ? list : []
}

export async function getInstanceToken(instanceName: string): Promise<string | null> {
  const cached = tokenCache.get(instanceName)
  if (cached && Date.now() - cached.at < TOKEN_TTL_MS) return cached.token

  const found = (await listInstances())
    .find((i: any) => (i.name || i.instance?.instanceName) === instanceName)

  const token = found?.token || null
  if (token) tokenCache.set(instanceName, { token, at: Date.now() })
  return token
}

type CallOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  token: string
}

/** Chamada crua: devolve status e corpo já parseado, sem lançar exceção. */
export async function evolutionCall<T = any>(path: string, opts: CallOptions) {
  const { method = 'GET', body, token } = opts

  const res = await fetch(`${API_URL()}${path}`, {
    method,
    headers: {
      apikey: token,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store'
  })

  const text = await res.text()
  let data: T | null = null
  try { data = JSON.parse(text) } catch { /* resposta não-JSON */ }

  return { ok: res.ok, status: res.status, data, text }
}

/**
 * URL da foto de perfil. Serve tanto para contato quanto para grupo — basta
 * passar o JID correspondente (`...@g.us` para grupo).
 * As URLs do WhatsApp expiram, então quem chama deve baixar e guardar.
 */
export async function fetchAvatarUrl(token: string, jid: string): Promise<string | null> {
  const { ok, data } = await evolutionCall<{ data?: { url?: string } }>('/user/avatar', {
    method: 'POST',
    token,
    body: { number: jid, preview: false }
  })
  if (!ok) return null
  return (data as any)?.data?.url || null
}

/** `5511999998888@s.whatsapp.net` -> `5511999998888` */
export function normalizePhone(raw?: string | null): string {
  if (!raw) return ''
  return raw.split('@')[0].split(':')[0].trim()
}

/**
 * Número real do participante. A ordem importa: em grupos com
 * `AddressingMode: "lid"` o campo JID vem como `...@lid`, que é anônimo —
 * o telefone de verdade está em PhoneNumber.
 */
export function participantPhone(p: any): string {
  return normalizePhone(p?.PhoneNumber || p?.phoneNumber)
    || normalizePhone(p?.JID || p?.jid || p?.id)
}

export function participantLid(p: any): string {
  const lid = p?.LID || p?.lid || ''
  if (lid) return normalizePhone(lid)
  const jid = p?.JID || p?.jid || ''
  return String(jid).includes('@lid') ? normalizePhone(jid) : ''
}

export const GROUP_SETTING_ACTIONS = [
  'announcement',
  'not_announcement',
  'locked',
  'unlocked',
  'approval_on',
  'approval_off',
  'admin_add',
  'all_member_add'
] as const

export type GroupSettingAction = typeof GROUP_SETTING_ACTIONS[number]
