import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cleanPhoneDigits, enqueueWelcomeForJoin } from '@shared/welcome'

/**
 * Extrai a lista de participantes que entraram no grupo a partir do payload do webhook da Evolution GO.
 * Suporta tanto o formato nativo whatsmeow (`event: "GroupInfo"` com `data.Join`) quanto
 * formatos Evolution/Baileys (`group-participants.update` / `GroupParticipants` com `action: "add" | "join"`).
 */
function extrairEntradasNoGrupo(event: string, data: any): {
  groupJid: string
  joined: Array<{ phone: string; displayName: string | null; lid: string | null }>
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

  let rawList: any[] = []
  if (Array.isArray(data.Join) && data.Join.length > 0) {
    rawList = data.Join
  } else {
    const action = String(data.action || data.Action || '').toLowerCase()
    if (action === 'add' || action === 'join') {
      const pList = data.participants || data.Participants
      if (Array.isArray(pList)) rawList = pList
    }
  }

  if (rawList.length === 0) return null

  const joined: Array<{ phone: string; displayName: string | null; lid: string | null }> = []
  for (const item of rawList) {
    if (typeof item === 'string') {
      const phone = cleanPhoneDigits(item)
      const lid = item.endsWith('@lid') ? item : null
      if (phone.length >= 10) {
        joined.push({ phone, displayName: null, lid })
      }
    } else if (item && typeof item === 'object') {
      const candidate =
        item.PhoneNumber || item.phoneNumber || item.phone || item.JID || item.jid || item.id || ''
      const phone = cleanPhoneDigits(candidate)
      const displayName = item.DisplayName || item.PushName || item.name || item.notify || null
      const lidCandidate = item.LID || item.lid || (String(item.JID || '').endsWith('@lid') ? item.JID : null)
      if (phone.length >= 10) {
        joined.push({
          phone,
          displayName: displayName ? String(displayName).trim() : null,
          lid: lidCandidate ? String(lidCandidate) : null
        })
      }
    }
  }

  if (joined.length === 0) return null
  return { groupJid, joined }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const event = String(payload.event || '')
    const instanceName = String(payload.instance || payload.instanceName || '')

    // 1. Eventos de entrada de participantes em grupo (Automacao de Boas-Vindas + Membros)
    const joinInfo = extrairEntradasNoGrupo(event, payload.data)
    if (joinInfo) {
      let group = instanceName
        ? await prisma.group.findUnique({
            where: {
              instanceName_evolutionGroupId: {
                instanceName,
                evolutionGroupId: joinInfo.groupJid
              }
            }
          })
        : null

      if (!group) {
        group = await prisma.group.findFirst({
          where: { evolutionGroupId: joinInfo.groupJid }
        })
      }

      if (group) {
        let addedCount = 0
        for (const member of joinInfo.joined) {
          const existing = await prisma.groupMember.findFirst({
            where: { groupId: group.id, phone: member.phone },
            select: { id: true, displayName: true }
          })

          if (!existing) {
            await prisma.groupMember.create({
              data: {
                groupId: group.id,
                phone: member.phone,
                lid: member.lid,
                displayName: member.displayName,
                isAdmin: false,
                isSuperAdmin: false,
                role: 'participant',
                firstSeenAt: new Date()
              }
            }).catch(() => {})
            addedCount++
          }

          await enqueueWelcomeForJoin(prisma, {
            groupId: group.id,
            phone: member.phone,
            displayName: member.displayName || existing?.displayName || null
          }).catch(err => {
            console.error('[Webhook] Erro ao enfileirar boas-vindas:', err)
          })
        }

        if (addedCount > 0) {
          await prisma.group.update({
            where: { id: group.id },
            data: { participantCount: (group.participantCount || 0) + addedCount }
          }).catch(() => {})
        }
      }

      return NextResponse.json({ received: true })
    }

    // 2. Evolution GO v2 payload for messages
    // event: "Message"
    // data: { Info: { Chat, Sender, PushName, IsFromMe }, Message: { conversation, ... } }
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
