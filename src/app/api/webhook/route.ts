import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cleanPhoneDigits, enqueueWelcomeForJoin } from '@shared/welcome'

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || ''
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || ''

async function obterTokenInstancia(instanceName: string): Promise<{ token: string; phone: string } | null> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !instanceName) return null
  try {
    const res = await fetch(`${EVOLUTION_API_URL}/instance/all`, {
      headers: { apikey: EVOLUTION_API_KEY },
      cache: 'no-store'
    })
    if (!res.ok) return null
    const body = await res.json()
    const list = Array.isArray(body) ? body : body.data || []
    const found = list.find(
      (i: any) => (i.name || i.instance?.instanceName) === instanceName
    )
    if (!found?.token) return null
    return {
      token: String(found.token),
      phone: cleanPhoneDigits(found.jid || found.instance?.owner || '')
    }
  } catch {
    return null
  }
}

async function resolverParticipantesDoGrupoNaEvolution(
  instanceName: string,
  groupJid: string
): Promise<Map<string, { phone: string; displayName: string | null }>> {
  const mapa = new Map<string, { phone: string; displayName: string | null }>()
  const inst = await obterTokenInstancia(instanceName)
  if (!inst?.token) return mapa

  try {
    const res = await fetch(`${EVOLUTION_API_URL}/group/info`, {
      method: 'POST',
      headers: {
        apikey: inst.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ groupJid })
    })
    if (!res.ok) return mapa
    const body = await res.json()
    const g = body?.data || body || {}
    const participants = Array.isArray(g.Participants)
      ? g.Participants
      : Array.isArray(g.participants)
        ? g.participants
        : []

    for (const p of participants) {
      const phone = cleanPhoneDigits(p.PhoneNumber || p.phoneNumber || p.JID || p.id || '')
      if (!phone || phone.length < 10) continue
      const displayName =
        p.DisplayName || p.PushName || p.name || p.notify
          ? String(p.DisplayName || p.PushName || p.name || p.notify).trim()
          : null

      const lidRaw = String(p.LID || p.lid || (String(p.JID || '').endsWith('@lid') ? p.JID : '') || '').trim()
      if (lidRaw) {
        const lidClean = lidRaw.replace(/@lid$/i, '')
        mapa.set(lidClean, { phone, displayName })
        mapa.set(`${lidClean}@lid`, { phone, displayName })
      }
      mapa.set(phone, { phone, displayName })
    }
  } catch {
    /* falha silenciosa */
  }

  return mapa
}

/**
 * Extrai entradas (Join) e saidas (Leave) de participantes em um grupo a partir do payload do webhook da Evolution GO.
 * Suporta tanto o formato nativo whatsmeow (`event: "GroupInfo"` com `data.Join` / `data.Leave`, inclusive `@lid`)
 * quanto formatos Evolution/Baileys (`group-participants.update` / `GroupParticipants`).
 */
function extrairMovimentacoesNoGrupo(event: string, data: any): {
  groupJid: string
  joined: Array<{ phone: string; displayName: string | null; lid: string | null }>
  left: Array<{ phone: string; lid: string | null }>
} | null {
  if (!data || typeof data !== 'object') return null

  const ev = String(event || '').trim()
  const isGroupEvent =
    ev === 'GroupInfo' ||
    ev === 'GROUP_INFO' ||
    ev === 'group-participants.update' ||
    ev === 'GroupParticipants' ||
    ev === 'GROUP_PARTICIPANTS_UPDATE'

  if (!isGroupEvent) return null

  const groupJid = String(
    data.JID || data.Chat || data.GroupJid || data.groupJid || data.id || ''
  ).trim()
  if (!groupJid || !groupJid.endsWith('@g.us')) return null

  let rawJoin: any[] = []
  let rawLeave: any[] = []

  if (Array.isArray(data.Join) && data.Join.length > 0) {
    rawJoin = data.Join
  }
  if (Array.isArray(data.Leave) && data.Leave.length > 0) {
    rawLeave = data.Leave
  }

  if (rawJoin.length === 0 && rawLeave.length === 0) {
    const action = String(data.action || data.Action || '').toLowerCase()
    const pList = data.participants || data.Participants
    if (Array.isArray(pList)) {
      if (action === 'add' || action === 'join') rawJoin = pList
      else if (action === 'remove' || action === 'leave') rawLeave = pList
    }
  }

  if (rawJoin.length === 0 && rawLeave.length === 0) return null

  const parseItem = (item: any) => {
    if (typeof item === 'string') {
      const trimmed = item.trim()
      if (trimmed.endsWith('@lid') || /^\d{14,20}$/.test(trimmed)) {
        const lidClean = trimmed.replace(/@lid$/i, '')
        return { phone: '', displayName: null, lid: lidClean }
      }
      const phone = cleanPhoneDigits(trimmed)
      return { phone: phone.length >= 10 ? phone : '', displayName: null, lid: null }
    }
    if (item && typeof item === 'object') {
      const candidate =
        item.PhoneNumber || item.phoneNumber || item.phone || item.JID || item.jid || item.id || ''
      const phone = cleanPhoneDigits(candidate)
      const displayName = item.DisplayName || item.PushName || item.name || item.notify || null
      const lidRaw =
        item.LID || item.lid || (String(item.JID || '').endsWith('@lid') ? item.JID : null)
      const lidClean = lidRaw ? String(lidRaw).trim().replace(/@lid$/i, '') : null
      return {
        phone: phone.length >= 10 ? phone : '',
        displayName: displayName ? String(displayName).trim() : null,
        lid: lidClean
      }
    }
    return { phone: '', displayName: null, lid: null }
  }

  const joined = rawJoin.map(parseItem).filter(x => Boolean(x.phone || x.lid))
  const left = rawLeave.map(parseItem).filter(x => Boolean(x.phone || x.lid))

  if (joined.length === 0 && left.length === 0) return null
  return { groupJid, joined, left }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const event = String(payload.event || '')
    const instanceName = String(payload.instance || payload.instanceName || '')

    // 1. Eventos de entrada/saida de participantes em grupo (Automacao de Boas-Vindas + Membros)
    const movInfo = extrairMovimentacoesNoGrupo(event, payload.data)
    if (movInfo) {
      let group = instanceName
        ? await prisma.group.findUnique({
            where: {
              instanceName_evolutionGroupId: {
                instanceName,
                evolutionGroupId: movInfo.groupJid
              }
            }
          })
        : null

      if (!group) {
        group = await prisma.group.findFirst({
          where: { evolutionGroupId: movInfo.groupJid }
        })
      }

      if (group) {
        // Se algum participante entrou apenas com @lid (padrao atual do WhatsApp),
        // resolve o telefone real consultando o banco local ou /group/info na Evolution GO.
        let evoMap: Map<string, { phone: string; displayName: string | null }> | null = null

        let addedCount = 0
        for (const member of movInfo.joined) {
          let resolvedPhone = member.phone
          let resolvedName = member.displayName
          const lidClean = member.lid ? member.lid.replace(/@lid$/i, '') : null

          if (!resolvedPhone && lidClean) {
            const knownInDb = await prisma.groupMember.findFirst({
              where: {
                OR: [{ lid: lidClean }, { lid: `${lidClean}@lid` }],
                phone: { not: '' }
              },
              select: { phone: true, displayName: true }
            }).catch(() => null)

            if (knownInDb?.phone) {
              resolvedPhone = cleanPhoneDigits(knownInDb.phone)
              if (!resolvedName && knownInDb.displayName) {
                resolvedName = knownInDb.displayName
              }
            }
          }

          if (!resolvedPhone && lidClean && group.instanceName) {
            if (!evoMap) {
              evoMap = await resolverParticipantesDoGrupoNaEvolution(
                group.instanceName,
                movInfo.groupJid
              )
            }
            const fromEvo = evoMap.get(lidClean) || evoMap.get(`${lidClean}@lid`)
            if (fromEvo?.phone) {
              resolvedPhone = fromEvo.phone
              if (!resolvedName && fromEvo.displayName) {
                resolvedName = fromEvo.displayName
              }
            }
          }

          if (!resolvedPhone || resolvedPhone.length < 10) {
            console.warn(
              `[Webhook] Nao foi possivel resolver telefone para entrada no grupo ${group.name} (lid=${lidClean})`
            )
            continue
          }

          const existing = await prisma.groupMember.findFirst({
            where: { groupId: group.id, phone: resolvedPhone },
            select: { id: true, displayName: true }
          })

          if (!existing) {
            await prisma.groupMember.create({
              data: {
                groupId: group.id,
                phone: resolvedPhone,
                lid: lidClean,
                displayName: resolvedName,
                isAdmin: false,
                isSuperAdmin: false,
                role: 'participant',
                firstSeenAt: new Date()
              }
            }).catch(() => {})
            addedCount++
          } else if (lidClean || resolvedName) {
            await prisma.groupMember.update({
              where: { id: existing.id },
              data: {
                ...(lidClean ? { lid: lidClean } : {}),
                ...(resolvedName ? { displayName: resolvedName } : {})
              }
            }).catch(() => {})
          }

          const eqResult = await enqueueWelcomeForJoin(prisma, {
            groupId: group.id,
            phone: resolvedPhone,
            displayName: (resolvedName || existing?.displayName || null) as any
          }).catch(err => {
            console.error('[Webhook] Erro ao enfileirar boas-vindas:', err)
            return null
          })

          if (eqResult) {
            console.log(
              `[Webhook] Entrada detectada em "${group.name}" (${resolvedPhone}): queued=${eqResult.queued} (${eqResult.reason || 'ok'})`
            )
          }
        }

        let removedCount = 0
        for (const leftMember of movInfo.left) {
          const lidClean = leftMember.lid ? leftMember.lid.replace(/@lid$/i, '') : null
          const del = await prisma.groupMember.deleteMany({
            where: {
              groupId: group.id,
              OR: [
                ...(leftMember.phone ? [{ phone: leftMember.phone }] : []),
                ...(lidClean ? [{ lid: lidClean }, { lid: `${lidClean}@lid` }] : [])
              ]
            }
          }).catch(() => ({ count: 0 }))
          removedCount += del.count || 0
        }

        if (addedCount > 0 || removedCount > 0) {
          const nextCount = Math.max(0, (group.participantCount || 0) + addedCount - removedCount)
          await prisma.group.update({
            where: { id: group.id },
            data: { participantCount: nextCount }
          }).catch(() => {})
        }
      }

      return NextResponse.json({ received: true })
    }

    // 2. Evolution GO v2 payload for messages
    if (event === 'Message') {
      const data = payload.data
      if (!data || !data.Info || !data.Message) {
        return NextResponse.json({ received: true })
      }

      const remoteJid = data.Info.Chat
      const fromMe = data.Info.IsFromMe
      const participant = data.Info.PushName || data.Info.Sender || remoteJid

      let textContent = ''
      if (data.Message.conversation) textContent = data.Message.conversation
      else if (data.Message.extendedTextMessage?.text) textContent = data.Message.extendedTextMessage.text
      else if (data.Info.MediaType === 'image' || data.Message.imageMessage) textContent = '[Imagem]'
      else if (data.Info.MediaType === 'video' || data.Message.videoMessage) textContent = '[Vídeo]'
      else if (data.Info.MediaType === 'audio' || data.Message.audioMessage) textContent = '[Áudio]'
      else if (data.Info.MediaType === 'document' || data.Message.documentMessage) textContent = '[Documento]'
      else if (data.Message.buttonsResponseMessage) textContent = `[Botão] ${data.Message.buttonsResponseMessage.selectedDisplayText}`
      else if (data.Message.pollCreationMessage) textContent = `[Enquete] ${data.Message.pollCreationMessage.name}`
      else if (data.Message.pollUpdateMessage) textContent = `[Enquete - Voto]`
      else textContent = '[Mídia/Outro]'

      if (!textContent) {
        return NextResponse.json({ received: true })
      }

      const group = await prisma.group.findUnique({
        where: {
          instanceName_evolutionGroupId: {
            instanceName,
            evolutionGroupId: remoteJid
          }
        }
      })

      if (group) {
        await prisma.message.create({
          data: {
            groupId: group.id,
            sender: fromMe ? 'Sistema/Você' : participant,
            content: textContent
          }
        })
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
