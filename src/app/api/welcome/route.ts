import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthenticated } from '@/lib/auth'
import { validateScheduleContent } from '@/lib/schedule-types'
import { aplicarRastreio } from '@/lib/tracked-links'
import {
  MAX_WELCOME_BLOCKS,
  extractWelcomeBlocks,
  cleanPhoneDigits,
  isTestGroupName,
  listarInstanciasEvolution,
  selecionarInstanciaRemetenteConectada,
  sendEvolutionWelcomeSequence
} from '@shared/welcome'
import { montarContextoGrupo } from '@shared/variables'

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || ''
const VALID_TYPES = ['text', 'media', 'button', 'poll'] as const

function baseUrlDoPedido(request: Request) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    request.headers.get('origin') ||
    new URL(request.url).origin
  ).replace(/\/+$/, '')
}

function urlAbsolutaDeMidia(valor: string, baseUrl: string) {
  const v = String(valor || '')
  if (!v || /^https?:\/\//i.test(v) || v.startsWith('data:')) return v
  if (!baseUrl) return v
  return v.startsWith('/') ? `${baseUrl}${v}` : `${baseUrl}/${v}`
}

async function verificarBloqueioGrupoFinal(groupId?: string | null, tagId?: string | null): Promise<string | null> {
  if (groupId) {
    const grp = await prisma.group.findUnique({
      where: { id: groupId },
      select: { name: true }
    })
    if (grp && !isTestGroupName(grp.name)) {
      return `Bloqueio de segurança: não é permitido ativar boas-vindas no grupo final "${grp.name}". Ative apenas em grupos de teste.`
    }
  }
  if (tagId) {
    const tagGroups = await prisma.groupTag.findMany({
      where: { tagId },
      include: { group: { select: { name: true } } }
    })
    const nonTest = tagGroups.find(tg => tg.group && !isTestGroupName(tg.group.name))
    if (nonTest?.group) {
      return `Bloqueio de segurança: a Tag contém o grupo final "${nonTest.group.name}". Ative regras apenas em grupos/tags de teste.`
    }
  }
  return null
}

export async function GET(request: Request) {
  try {
    if (!(await isAuthenticated(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const [rules, dispatches, sentTodayCount, instances] = await Promise.all([
      prisma.welcomeRule.findMany({
        include: {
          group: {
            select: {
              id: true,
              name: true,
              slug: true,
              instanceName: true,
              participantCount: true
            }
          },
          tag: {
            select: {
              id: true,
              name: true,
              slug: true,
              color: true,
              instanceName: true
            }
          },
          _count: {
            select: { dispatches: true }
          }
        },
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.welcomeDispatch.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
        include: {
          group: {
            select: { id: true, name: true, slug: true, instanceName: true }
          },
          rule: {
            select: { id: true, type: true, groupId: true, tagId: true, senderInstance: true }
          }
        }
      }),
      prisma.welcomeDispatch.count({
        where: {
          status: 'sent',
          sentAt: { gte: startOfToday }
        }
      }),
      listarInstanciasEvolution()
    ])

    // Agrega contagens por status de cada regra
    const countsByRule = await prisma.welcomeDispatch.groupBy({
      by: ['ruleId', 'status'],
      _count: { _all: true }
    })

    const statMap = new Map<
      string,
      { pending: number; sent: number; error: number; skipped: number }
    >()
    for (const row of countsByRule) {
      const cur = statMap.get(row.ruleId) || { pending: 0, sent: 0, error: 0, skipped: 0 }
      if (row.status === 'pending' || row.status === 'processing') cur.pending += row._count._all
      else if (row.status === 'sent') cur.sent += row._count._all
      else if (row.status === 'error') cur.error += row._count._all
      else if (row.status === 'skipped') cur.skipped += row._count._all
      statMap.set(row.ruleId, cur)
    }

    let pendentesFila = 0
    let enviadosTotal = 0
    let errosTotal = 0

    const regrasFormatadas = rules.map(r => {
      const st = statMap.get(r.id) || { pending: 0, sent: 0, error: 0, skipped: 0 }
      pendentesFila += st.pending
      enviadosTotal += st.sent
      errosTotal += st.error

      let parsedContent: any = {}
      try {
        parsedContent = JSON.parse(r.content || '{}')
      } catch {
        parsedContent = { text: r.content }
      }

      const blocks = extractWelcomeBlocks(r.type, parsedContent)

      return {
        id: r.id,
        escopo: r.tagId ? 'tag' : 'group',
        groupId: r.groupId,
        tagId: r.tagId,
        enabled: r.enabled,
        type: r.type,
        content: parsedContent,
        blocks,
        delayMinSec: r.delayMinSec,
        delayMaxSec: r.delayMaxSec,
        cooldownDays: r.cooldownDays,
        senderInstance: r.senderInstance,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        grupo: r.group,
        tag: r.tag,
        stats: st
      }
    })

    const filaFormatada = dispatches.map(d => ({
      id: d.id,
      ruleId: d.ruleId,
      groupId: d.groupId,
      grupoNome: d.group?.name || 'Grupo',
      instancia: d.rule?.senderInstance || d.group?.instanceName || '',
      tagId: d.tagId,
      phone: d.phone,
      displayName: d.displayName,
      type: d.rule?.type || 'text',
      status: d.status,
      scheduledAt: d.scheduledAt,
      sentAt: d.sentAt,
      attempts: d.attempts,
      errorMessage: d.errorMessage,
      isTest: d.isTest,
      createdAt: d.createdAt
    }))

    return NextResponse.json({
      resumo: {
        regrasAtivas: rules.filter(r => r.enabled).length,
        regrasTotais: rules.length,
        pendentesFila,
        enviadosHoje: sentTodayCount,
        enviadosTotal,
        errosTotal
      },
      regras: regrasFormatadas,
      fila: filaFormatada,
      instancias: instances.map((i: any) => ({
        name: i.name,
        phone: i.phone,
        jid: i.jid,
        connected: i.connected
      }))
    })
  } catch (error) {
    console.error('Erro em GET /api/welcome:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isAuthenticated(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const action = String(body.action || 'upsert')
    const baseUrl = baseUrlDoPedido(request)

    // 1. Criar ou Atualizar Regra de Boas-Vindas (por Grupo ou por Tag, 1 ou multiplos blocos)
    if (action === 'upsert') {
      let groupId: string | null = body.groupId ? String(body.groupId).trim() : null
      let tagId: string | null = body.tagId ? String(body.tagId).trim() : null

      if (!tagId && body.tagSlug) {
        const t = await prisma.tag.findUnique({ where: { slug: String(body.tagSlug).trim() } })
        if (t) tagId = t.id
      }

      if ((!groupId && !tagId) || (groupId && tagId)) {
        return NextResponse.json(
          { error: 'Informe exatamente um escopo: groupId OU tagId' },
          { status: 400 }
        )
      }

      const enabled = body.enabled !== undefined ? Boolean(body.enabled) : false
      if (enabled) {
        const bloqueio = await verificarBloqueioGrupoFinal(groupId, tagId)
        if (bloqueio) {
          return NextResponse.json({ error: bloqueio }, { status: 403 })
        }
      }

      const defaultType = String(body.type || 'text')
      const rawContent =
        typeof body.content === 'string'
          ? JSON.parse(body.content || '{}')
          : { ...(body.content || {}) }

      const trackLinks =
        body.trackLinks !== undefined
          ? Boolean(body.trackLinks)
          : rawContent.trackLinks !== undefined
            ? Boolean(rawContent.trackLinks)
            : true

      // Extrai blocos: pode vir em body.blocks, body.content.blocks ou como 1 bloco unico
      const candidateBlocks = Array.isArray(body.blocks)
        ? body.blocks
        : Array.isArray(rawContent.blocks)
          ? rawContent.blocks
          : null

      if (candidateBlocks && candidateBlocks.length > MAX_WELCOME_BLOCKS) {
        return NextResponse.json(
          { error: `Limite máximo de ${MAX_WELCOME_BLOCKS} blocos de mensagem por regra.` },
          { status: 400 }
        )
      }

      const rawBlocks = extractWelcomeBlocks(
        defaultType,
        candidateBlocks ? { blocks: candidateBlocks } : rawContent
      )

      const processedBlocks: Array<{ type: string; content: Record<string, any> }> = []
      let totalLinksCriados = 0

      for (let idx = 0; idx < rawBlocks.length; idx++) {
        const blk = rawBlocks[idx]
        const blkType = String(blk.type || defaultType)
        if (!VALID_TYPES.includes(blkType as any)) {
          return NextResponse.json(
            { error: `Bloco #${idx + 1}: Tipo inválido "${blkType}". Use text, media, button ou poll.` },
            { status: 400 }
          )
        }

        const blkContent = { ...(blk.content || {}), trackLinks }
        const problema = validateScheduleContent(blkType as any, blkContent)
        if (problema) {
          return NextResponse.json(
            { error: rawBlocks.length > 1 ? `Bloco #${idx + 1}: ${problema}` : problema },
            { status: 400 }
          )
        }

        const rastreado = await aplicarRastreio(
          blkType,
          blkContent,
          baseUrl,
          groupId || undefined
        )
        totalLinksCriados += rastreado.links.length
        processedBlocks.push({
          type: blkType,
          content: rastreado.content
        })
      }

      const primaryBlock = processedBlocks[0]
      const finalStoredContent = {
        ...primaryBlock.content,
        trackLinks,
        blocks: processedBlocks
      }

      const delayMinSec = Math.max(10, Math.min(3600, Number(body.delayMinSec ?? 45)))
      const delayMaxSec = Math.max(delayMinSec, Math.min(7200, Number(body.delayMaxSec ?? 150)))
      const cooldownDays = Math.max(1, Math.min(365, Number(body.cooldownDays ?? 30)))
      const senderInstance = body.senderInstance ? String(body.senderInstance).trim() : null

      const dataPayload = {
        type: primaryBlock.type,
        content: JSON.stringify(finalStoredContent),
        enabled,
        delayMinSec,
        delayMaxSec,
        cooldownDays,
        senderInstance: senderInstance || null
      }

      const rule = groupId
        ? await prisma.welcomeRule.upsert({
            where: { groupId },
            update: dataPayload,
            create: { groupId, ...dataPayload }
          })
        : await prisma.welcomeRule.upsert({
            where: { tagId: tagId! },
            update: dataPayload,
            create: { tagId: tagId!, ...dataPayload }
          })

      return NextResponse.json({
        ok: true,
        rule,
        blocksCount: processedBlocks.length,
        linksCriados: totalLinksCriados
      })
    }

    // 2. Ativar / Desativar Regra (Toggle)
    if (action === 'toggle') {
      const id = body.id || body.ruleId
      const groupId = body.groupId
      const tagId = body.tagId

      const where = id
        ? { id: String(id) }
        : groupId
          ? { groupId: String(groupId) }
          : tagId
            ? { tagId: String(tagId) }
            : null

      if (!where) {
        return NextResponse.json(
          { error: 'Informe id, groupId ou tagId para ativar/desativar' },
          { status: 400 }
        )
      }

      const existing = await prisma.welcomeRule.findUnique({ where })
      if (!existing) {
        return NextResponse.json({ error: 'Regra não encontrada' }, { status: 404 })
      }

      const nextEnabled =
        body.enabled !== undefined ? Boolean(body.enabled) : !existing.enabled

      if (nextEnabled) {
        const bloqueio = await verificarBloqueioGrupoFinal(existing.groupId, existing.tagId)
        if (bloqueio) {
          return NextResponse.json({ error: bloqueio }, { status: 403 })
        }
      }

      const updated = await prisma.welcomeRule.update({
        where: { id: existing.id },
        data: { enabled: nextEnabled }
      })

      return NextResponse.json({ ok: true, rule: updated })
    }

    // 3. Excluir Regra
    if (action === 'delete') {
      const id = body.id || body.ruleId
      const groupId = body.groupId
      const tagId = body.tagId

      const where = id
        ? { id: String(id) }
        : groupId
          ? { groupId: String(groupId) }
          : tagId
            ? { tagId: String(tagId) }
            : null

      if (!where) {
        return NextResponse.json(
          { error: 'Informe id, groupId ou tagId para excluir' },
          { status: 400 }
        )
      }

      await prisma.welcomeRule.delete({ where })
      return NextResponse.json({ ok: true })
    }

    // 4. Disparo de Teste Seguro (Entre Instancias ou Grupo de Teste, 1 ou multiplos blocos)
    if (action === 'test') {
      const instances = await listarInstanciasEvolution()
      const ruleId = body.ruleId || body.id

      const rule = ruleId
        ? await prisma.welcomeRule.findUnique({
            where: { id: String(ruleId) },
            include: {
              group: true,
              tag: {
                include: {
                  groups: {
                    orderBy: { position: 'asc' },
                    take: 1,
                    include: { group: true }
                  }
                }
              }
            }
          })
        : null

      if (!rule) {
        return NextResponse.json(
          { error: 'Regra de boas-vindas não encontrada para teste' },
          { status: 404 }
        )
      }

      let recipient = ''
      let targetLabel = String(body.targetName || 'Teste Entre Instâncias').trim()

      if (body.targetInstanceName) {
        const targetInst = instances.find((i: any) => i.name === String(body.targetInstanceName).trim())
        if (!targetInst || !targetInst.phone) {
          return NextResponse.json(
            { error: `Instância de destino "${body.targetInstanceName}" não encontrada ou sem número conectado` },
            { status: 400 }
          )
        }
        recipient = targetInst.phone
        targetLabel = targetInst.name
      } else if (body.targetPhoneOrJid) {
        const rawTarget = String(body.targetPhoneOrJid).trim()
        if (rawTarget.endsWith('@g.us')) {
          const targetGroup = await prisma.group.findFirst({
            where: { evolutionGroupId: rawTarget }
          })
          if (targetGroup && !isTestGroupName(targetGroup.name)) {
            return NextResponse.json(
              {
                error:
                  'Bloqueio de segurança: não é permitido disparar testes em grupos finais de clientes. Use entre instâncias ou um grupo de teste.'
              },
              { status: 403 }
            )
          }
          recipient = rawTarget
        } else {
          recipient = cleanPhoneDigits(rawTarget)
        }
      }

      if (!recipient) {
        return NextResponse.json(
          { error: 'Informe targetInstanceName ou targetPhoneOrJid válido para o teste' },
          { status: 400 }
        )
      }

      const sampleGroup =
        rule.group ||
        rule.tag?.groups?.[0]?.group ||
        (await prisma.group.findFirst({ orderBy: { name: 'asc' } }))

      if (!sampleGroup) {
        return NextResponse.json(
          { error: 'Nenhum grupo cadastrado para montar o contexto do teste' },
          { status: 400 }
        )
      }

      const preferredSenderName =
        body.senderInstance ||
        rule.senderInstance ||
        rule.tag?.instanceName ||
        sampleGroup.instanceName ||
        ''

      const senderInst = selecionarInstanciaRemetenteConectada(
        instances,
        preferredSenderName,
        recipient
      )
      if (!senderInst || !senderInst.token) {
        return NextResponse.json(
          {
            error: `Nenhuma instância conectada disponível para enviar o teste (preferida: ${preferredSenderName || 'padrão'}). Verifique se ao menos uma instância está Conectada.`
          },
          { status: 400 }
        )
      }

      let rawContent: any = {}
      try {
        rawContent = JSON.parse(rule.content || '{}')
      } catch {
        rawContent = { text: rule.content }
      }

      const blocks = extractWelcomeBlocks(rule.type, rawContent)

      const ctx = await montarContextoGrupo(prisma, sampleGroup, {
        baseUrl,
        tag: rule.tag || undefined,
        campaign: 'boas-vindas-teste',
        memberName: targetLabel,
        memberPhone: cleanPhoneDigits(recipient) || recipient
      })

      const sendRes = await sendEvolutionWelcomeSequence(
        EVOLUTION_API_URL,
        senderInst.token,
        recipient,
        blocks,
        ctx,
        (u: string) => urlAbsolutaDeMidia(u, baseUrl),
        { isTest: true }
      )

      const dispatchLog = await prisma.welcomeDispatch.create({
        data: {
          ruleId: rule.id,
          groupId: sampleGroup.id,
          tagId: rule.tagId || null,
          phone: recipient,
          displayName: `[TESTE] ${targetLabel}`,
          status: sendRes.ok ? 'sent' : 'error',
          scheduledAt: new Date(),
          sentAt: sendRes.ok ? new Date() : null,
          attempts: 1,
          errorMessage: sendRes.ok
            ? null
            : `HTTP ${sendRes.status}: ${(sendRes.error || sendRes.body || '').slice(0, 200)}`,
          isTest: true
        }
      })

      if (!sendRes.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: `Falha no envio de teste (HTTP ${sendRes.status})`,
            details: sendRes.error || sendRes.body,
            dispatch: dispatchLog
          },
          { status: 502 }
        )
      }

      return NextResponse.json({
        ok: true,
        senderInstance: senderInst.name,
        recipient,
        blocksSent: sendRes.blocksSent,
        resolvedBlocks: sendRes.resolvedBlocks,
        resolvedContent: sendRes.resolvedContent,
        dispatch: dispatchLog
      })
    }

    // 5. Controle da Fila de Boas-Vindas (Cancelar pendentes, Retentar erros, Limpar item)
    if (action === 'queue_control') {
      const subAction = String(body.subAction || '')
      const ruleId = body.ruleId ? String(body.ruleId) : undefined
      const dispatchId = body.dispatchId ? String(body.dispatchId) : undefined

      if (subAction === 'cancel_pending') {
        const res = await prisma.welcomeDispatch.updateMany({
          where: {
            status: 'pending',
            ...(ruleId ? { ruleId } : {}),
            ...(dispatchId ? { id: dispatchId } : {})
          },
          data: {
            status: 'skipped',
            errorMessage: 'Cancelado manualmente pelo painel/API'
          }
        })
        return NextResponse.json({ ok: true, afetados: res.count })
      }

      if (subAction === 'retry_errors') {
        const errored = await prisma.welcomeDispatch.findMany({
          where: {
            status: 'error',
            ...(ruleId ? { ruleId } : {}),
            ...(dispatchId ? { id: dispatchId } : {})
          },
          orderBy: { createdAt: 'asc' },
          take: 50
        })

        let cursorMs = Date.now() + 15000
        for (const item of errored) {
          await prisma.welcomeDispatch.update({
            where: { id: item.id },
            data: {
              status: 'pending',
              attempts: 0,
              errorMessage: null,
              scheduledAt: new Date(cursorMs)
            }
          })
          cursorMs += (25 + Math.floor(Math.random() * 20)) * 1000
        }

        return NextResponse.json({ ok: true, afetados: errored.length })
      }

      if (subAction === 'delete_item' && dispatchId) {
        await prisma.welcomeDispatch.delete({ where: { id: dispatchId } })
        return NextResponse.json({ ok: true, afetados: 1 })
      }

      return NextResponse.json({ error: 'subAction inválida' }, { status: 400 })
    }

    return NextResponse.json({ error: `Ação desconhecida: ${action}` }, { status: 400 })
  } catch (error: any) {
    console.error('Erro em POST /api/welcome:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
