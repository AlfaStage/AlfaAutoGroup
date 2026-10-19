import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthenticated } from '@/lib/auth'
import { getInstanceToken, evolutionCall } from '@/lib/evolution'

const WHITELIST_SETTING_KEY = 'team_whitelist_phones'

type WhitelistEntry = {
  phone: string
  label?: string
  addedAt?: string
}

const DDD_ESTADOS: Record<string, { uf: string; nome: string }> = {
  '11': { uf: 'SP', nome: 'São Paulo (Capital/RM)' },
  '12': { uf: 'SP', nome: 'Vale do Paraíba/Litoral Norte' },
  '13': { uf: 'SP', nome: 'Baixada Santista/Vale do Ribeira' },
  '14': { uf: 'SP', nome: 'Bauru/Marília/Botucatu' },
  '15': { uf: 'SP', nome: 'Sorocaba/Itapetininga' },
  '16': { uf: 'SP', nome: 'Ribeirão Preto/Araraquara' },
  '17': { uf: 'SP', nome: 'São José do Rio Preto/Barretos' },
  '18': { uf: 'SP', nome: 'Presidente Prudente/Araçatuba' },
  '19': { uf: 'SP', nome: 'Campinas/Piracicaba' },
  '21': { uf: 'RJ', nome: 'Rio de Janeiro (Capital/RM)' },
  '22': { uf: 'RJ', nome: 'Campos/Cabo Frio/Macaé' },
  '24': { uf: 'RJ', nome: 'Volta Redonda/Petrópolis' },
  '27': { uf: 'ES', nome: 'Vitória/Vila Velha' },
  '28': { uf: 'ES', nome: 'Cachoeiro de Itapemirim' },
  '31': { uf: 'MG', nome: 'Belo Horizonte (Capital/RM)' },
  '32': { uf: 'MG', nome: 'Juiz de Fora/Barbacena' },
  '33': { uf: 'MG', nome: 'Governador Valadares/Teófilo Otoni' },
  '34': { uf: 'MG', nome: 'Uberlândia/Uberaba' },
  '35': { uf: 'MG', nome: 'Poços de Caldas/Pouso Alegre' },
  '37': { uf: 'MG', nome: 'Divinópolis/Itaúna' },
  '38': { uf: 'MG', nome: 'Montes Claros/Diamantina' },
  '41': { uf: 'PR', nome: 'Curitiba (Capital/RM)' },
  '42': { uf: 'PR', nome: 'Ponta Grossa/Guarapuava' },
  '43': { uf: 'PR', nome: 'Londrina/Apucarana' },
  '44': { uf: 'PR', nome: 'Maringá/Umuarama' },
  '45': { uf: 'PR', nome: 'Foz do Iguaçu/Cascavel' },
  '46': { uf: 'PR', nome: 'Francisco Beltrão/Pato Branco' },
  '47': { uf: 'SC', nome: 'Joinville/Blumenau/Itajaí' },
  '48': { uf: 'SC', nome: 'Florianópolis/Criciúma' },
  '49': { uf: 'SC', nome: 'Chapecó/Lages' },
  '51': { uf: 'RS', nome: 'Porto Alegre (Capital/RM)' },
  '53': { uf: 'RS', nome: 'Pelotas/Rio Grande' },
  '54': { uf: 'RS', nome: 'Caxias do Sul/Passo Fundo' },
  '55': { uf: 'RS', nome: 'Santa Maria/Uruguaiana' },
  '61': { uf: 'DF', nome: 'Brasília/Entorno' },
  '62': { uf: 'GO', nome: 'Goiânia/Anápolis' },
  '63': { uf: 'TO', nome: 'Palmas/Araguaína' },
  '64': { uf: 'GO', nome: 'Rio Verde/Itumbiara' },
  '65': { uf: 'MT', nome: 'Cuiabá/Várzea Grande' },
  '66': { uf: 'MT', nome: 'Rondonópolis/Sinop' },
  '67': { uf: 'MS', nome: 'Campo Grande/Dourados' },
  '68': { uf: 'AC', nome: 'Rio Branco' },
  '69': { uf: 'RO', nome: 'Porto Velho/Ji-Paraná' },
  '71': { uf: 'BA', nome: 'Salvador (Capital/RM)' },
  '73': { uf: 'BA', nome: 'Ilhéus/Itabuna/Porto Seguro' },
  '74': { uf: 'BA', nome: 'Juazeiro/Jacobina' },
  '75': { uf: 'BA', nome: 'Feira de Santana/Alagoinhas' },
  '77': { uf: 'BA', nome: 'Vitória da Conquista/Barreiras' },
  '79': { uf: 'SE', nome: 'Aracaju' },
  '81': { uf: 'PE', nome: 'Recife/Caruaru' },
  '82': { uf: 'AL', nome: 'Maceió/Arapiraca' },
  '83': { uf: 'PB', nome: 'João Pessoa/Campina Grande' },
  '84': { uf: 'RN', nome: 'Natal/Mossoró' },
  '85': { uf: 'CE', nome: 'Fortaleza (Capital/RM)' },
  '86': { uf: 'PI', nome: 'Teresina/Parnaíba' },
  '87': { uf: 'PE', nome: 'Petrolina/Garanhuns' },
  '88': { uf: 'CE', nome: 'Juazeiro do Norte/Sobral' },
  '89': { uf: 'PI', nome: 'Picos/Floriano' },
  '91': { uf: 'PA', nome: 'Belém/Ananindeua' },
  '92': { uf: 'AM', nome: 'Manaus' },
  '93': { uf: 'PA', nome: 'Santarém/Altamira' },
  '94': { uf: 'PA', nome: 'Marabá/Parauapebas' },
  '95': { uf: 'RR', nome: 'Boa Vista' },
  '96': { uf: 'AP', nome: 'Macapá' },
  '97': { uf: 'AM', nome: 'Interior do Amazonas' },
  '98': { uf: 'MA', nome: 'São Luís' },
  '99': { uf: 'MA', nome: 'Imperatriz/Caxias' }
}

function cleanDigits(raw?: string | null): string {
  return String(raw || '').replace(/\D/g, '')
}

function extractDDD(phone: string): string {
  const d = cleanDigits(phone)
  if (d.startsWith('55') && d.length >= 12) {
    return d.substring(2, 4)
  }
  if (d.length === 10 || d.length === 11) {
    return d.substring(0, 2)
  }
  return 'Outros'
}

async function readWhitelist(): Promise<WhitelistEntry[]> {
  const row = await prisma.setting.findUnique({ where: { key: WHITELIST_SETTING_KEY } })
  if (!row?.value) return []
  try {
    const parsed = JSON.parse(row.value)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item: any) => {
        if (typeof item === 'string') {
          return { phone: cleanDigits(item), label: 'Equipe' }
        }
        return {
          phone: cleanDigits(item?.phone),
          label: item?.label || 'Equipe',
          addedAt: item?.addedAt || undefined
        }
      })
      .filter(i => i.phone.length >= 8)
  } catch {
    return []
  }
}

async function saveWhitelist(entries: WhitelistEntry[]) {
  const uniqueMap = new Map<string, WhitelistEntry>()
  for (const e of entries) {
    const p = cleanDigits(e.phone)
    if (p.length >= 8) {
      uniqueMap.set(p, {
        phone: p,
        label: e.label || 'Equipe',
        addedAt: e.addedAt || new Date().toISOString()
      })
    }
  }
  const list = Array.from(uniqueMap.values())
  await prisma.setting.upsert({
    where: { key: WHITELIST_SETTING_KEY },
    update: { value: JSON.stringify(list) },
    create: { key: WHITELIST_SETTING_KEY, value: JSON.stringify(list) }
  })
  return list
}

export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const tagIdFilter = searchParams.get('tagId') || undefined

    const [whitelist, groups] = await Promise.all([
      readWhitelist(),
      prisma.group.findMany({
        where: tagIdFilter
          ? { tags: { some: { tagId: tagIdFilter } } }
          : {},
        include: {
          tags: {
            include: { tag: { select: { id: true, name: true, color: true, slug: true } } },
            orderBy: { position: 'asc' }
          },
          members: {
            select: {
              id: true,
              phone: true,
              displayName: true,
              isAdmin: true,
              isSuperAdmin: true,
              firstSeenAt: true
            }
          }
        },
        orderBy: { name: 'asc' }
      })
    ])

    const whitelistSet = new Set(whitelist.map(w => w.phone))
    const adminOrOwnerSet = new Set<string>()

    // 1ª passagem: descobrir todos os números que são admin, superAdmin ou owner em QUALQUER grupo
    for (const g of groups) {
      const owner = cleanDigits(g.ownerPhone)
      if (owner.length >= 8) adminOrOwnerSet.add(owner)

      for (const m of g.members) {
        const p = cleanDigits(m.phone)
        if (!p || p === 'desconhecido') continue
        if (m.isAdmin || m.isSuperAdmin) {
          adminOrOwnerSet.add(p)
        }
      }
    }

    // 2ª passagem: agrupar presenças por telefone
    type MemberPresence = {
      groupId: string
      grupoNome: string
      instanceName: string
      evolutionGroupId: string
      isAdmin: boolean
      firstSeenAt: Date
      tagId: string | null
      tagNome: string | null
      tagCor: string | null
      position: number
    }

    const byPhone = new Map<
      string,
      {
        phone: string
        displayName: string | null
        isAdminGlobal: boolean
        isWhitelisted: boolean
        presences: MemberPresence[]
      }
    >()

    let totalVagasOcupadas = 0

    for (const g of groups) {
      const primaryTagRel = g.tags?.[0] || null
      const primaryTag = primaryTagRel?.tag || null

      for (const m of g.members) {
        totalVagasOcupadas++
        const p = cleanDigits(m.phone)
        if (!p || p.length < 8) continue

        let entry = byPhone.get(p)
        if (!entry) {
          entry = {
            phone: p,
            displayName: m.displayName || null,
            isAdminGlobal: adminOrOwnerSet.has(p),
            isWhitelisted: whitelistSet.has(p),
            presences: []
          }
          byPhone.set(p, entry)
        } else if (!entry.displayName && m.displayName) {
          entry.displayName = m.displayName
        }

        // Evita duplicar o mesmo grupo se houver registro repetido
        if (!entry.presences.some(pr => pr.groupId === g.id)) {
          entry.presences.push({
            groupId: g.id,
            grupoNome: g.name,
            instanceName: g.instanceName || '',
            evolutionGroupId: g.evolutionGroupId || '',
            isAdmin: Boolean(m.isAdmin || m.isSuperAdmin),
            firstSeenAt: m.firstSeenAt,
            tagId: primaryTag?.id || null,
            tagNome: primaryTag?.name || null,
            tagCor: primaryTag?.color || null,
            position: primaryTagRel?.position ?? 0
          })
        }
      }
    }

    let equipeEAdmins = 0
    let leadsUnicos = 0
    let vagasDuplicadas = 0
    let duplicadosMesmaTag = 0
    let possiveisMembrosEquipe = 0

    const duplicados: any[] = []
    const dddMap = new Map<
      string,
      {
        ddd: string
        uf: string
        regiao: string
        unicos: number
        presencas: number
        porTag: Map<string, number>
      }
    >()

    for (const item of byPhone.values()) {
      // Se é admin em qualquer grupo, dono de instância ou está na Whitelist da Equipe: protegido!
      if (item.isAdminGlobal || item.isWhitelisted) {
        equipeEAdmins++
        continue
      }

      leadsUnicos++
      const qtdGrupos = item.presences.length

      // Mapa de DDD para todos os leads reais
      const ddd = extractDDD(item.phone)
      const infoDDD = DDD_ESTADOS[ddd] || {
        uf: ddd === 'Outros' ? 'INT' : 'BR',
        nome: ddd === 'Outros' ? 'Internacional / Outros' : `DDD ${ddd}`
      }
      let dddEntry = dddMap.get(ddd)
      if (!dddEntry) {
        dddEntry = {
          ddd,
          uf: infoDDD.uf,
          regiao: infoDDD.nome,
          unicos: 0,
          presencas: 0,
          porTag: new Map()
        }
        dddMap.set(ddd, dddEntry)
      }
      dddEntry.unicos++
      dddEntry.presencas += qtdGrupos
      const tagsVistasNoLead = new Set<string>()
      for (const pr of item.presences) {
        const tNome = pr.tagNome || 'Sem Tag'
        if (!tagsVistasNoLead.has(tNome)) {
          tagsVistasNoLead.add(tNome)
          dddEntry.porTag.set(tNome, (dddEntry.porTag.get(tNome) || 0) + 1)
        }
      }

      if (qtdGrupos < 2) continue

      vagasDuplicadas += qtdGrupos - 1

      // Ordena presenças da mais antiga para a mais recente (ou por posição na tag)
      const sortedPresences = [...item.presences].sort((a, b) => {
        if (a.tagId && a.tagId === b.tagId && a.position !== b.position) {
          return a.position - b.position
        }
        return new Date(a.firstSeenAt).getTime() - new Date(b.firstSeenAt).getTime()
      })

      // Verifica se está duplicado dentro da MESMA tag
      const tagCounts = new Map<string, { nome: string; count: number }>()
      for (const pr of sortedPresences) {
        if (pr.tagId && pr.tagNome) {
          const cur = tagCounts.get(pr.tagId) || { nome: pr.tagNome, count: 0 }
          cur.count++
          tagCounts.set(pr.tagId, cur)
        }
      }
      const tagsDuplicadas = Array.from(tagCounts.values())
        .filter(t => t.count >= 2)
        .map(t => t.nome)
      const mesmaTag = tagsDuplicadas.length > 0
      if (mesmaTag) duplicadosMesmaTag++

      // Heurística de proteção: número sem cargo de admin mas presente em 3+ grupos
      const possibleTeam = qtdGrupos >= 3
      if (possibleTeam) possiveisMembrosEquipe++

      // Sugere manter no grupo mais recente / última posição da fila
      const keepGroup = sortedPresences[sortedPresences.length - 1]

      duplicados.push({
        phone: item.phone,
        ddd,
        uf: infoDDD.uf,
        displayName: item.displayName,
        totalGrupos: qtdGrupos,
        mesmaTag,
        tagsDuplicadas,
        possibleTeam,
        sugestaoManterGroupId: keepGroup.groupId,
        grupos: sortedPresences
      })
    }

    // Ordena: possíveis membros de equipe primeiro para revisão, depois mesmaTag, depois mais grupos
    duplicados.sort((a, b) => {
      if (a.mesmaTag !== b.mesmaTag) return a.mesmaTag ? -1 : 1
      return b.totalGrupos - a.totalGrupos
    })

    const mapaDDD = Array.from(dddMap.values())
      .map(d => ({
        ddd: d.ddd,
        uf: d.uf,
        regiao: d.regiao,
        unicos: d.unicos,
        presencas: d.presencas,
        percentual: leadsUnicos > 0 ? Number(((d.unicos / leadsUnicos) * 100).toFixed(1)) : 0,
        porTag: Array.from(d.porTag.entries())
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count)
      }))
      .sort((a, b) => b.unicos - a.unicos)

    const whitelistDetalhada = whitelist.map(w => {
      const entry = byPhone.get(w.phone)
      return {
        ...w,
        displayName: entry?.displayName || null,
        gruposCount: entry?.presences.length || 0,
        isAdminEmAlgum: entry?.isAdminGlobal || false
      }
    })

    return NextResponse.json({
      kpis: {
        totalGrupos: groups.length,
        totalVagasOcupadas,
        membrosUnicosReais: byPhone.size,
        equipeEAdmins,
        leadsUnicos,
        leadsDuplicados: duplicados.length,
        vagasDuplicadas,
        duplicadosMesmaTag,
        possiveisMembrosEquipe
      },
      duplicados: duplicados.slice(0, 300),
      mapaDDD,
      teamWhitelist: whitelistDetalhada
    })
  } catch (error) {
    console.error('[audit] erro ao auditar membros:', error)
    return NextResponse.json({ error: 'Falha ao executar auditoria de membros' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const action = String(body?.action || '')

    if (action === 'whitelist_add') {
      const current = await readWhitelist()
      const phonesRaw: string[] = Array.isArray(body.phones)
        ? body.phones
        : body.phone
          ? [body.phone]
          : []
      const label = String(body.label || 'Equipe (Sem cargo de Admin)').slice(0, 60)

      const updated = await saveWhitelist([
        ...current,
        ...phonesRaw.map(p => ({
          phone: cleanDigits(p),
          label,
          addedAt: new Date().toISOString()
        }))
      ])

      return NextResponse.json({ ok: true, teamWhitelist: updated })
    }

    if (action === 'whitelist_remove') {
      const target = cleanDigits(body.phone)
      const current = await readWhitelist()
      const updated = await saveWhitelist(current.filter(w => w.phone !== target))
      return NextResponse.json({ ok: true, teamWhitelist: updated })
    }

    if (action === 'remove_duplicates') {
      const items: Array<{ phone: string; removeGroupIds: string[] }> = Array.isArray(body.items)
        ? body.items
        : []

      if (items.length === 0) {
        return NextResponse.json({ error: 'Nenhum item informado para remoção' }, { status: 400 })
      }

      const whitelist = await readWhitelist()
      const whitelistSet = new Set(whitelist.map(w => w.phone))

      let removidos = 0
      let protegidos = 0
      const erros: string[] = []

      for (const item of items.slice(0, 50)) {
        const phone = cleanDigits(item.phone)
        if (!phone || whitelistSet.has(phone)) {
          protegidos++
          continue
        }

        // Trava de segurança no backend: verifica se o número é admin/superAdmin em algum grupo
        const adminRecord = await prisma.groupMember.findFirst({
          where: {
            phone,
            OR: [{ isAdmin: true }, { isSuperAdmin: true }]
          }
        })
        if (adminRecord) {
          protegidos++
          continue
        }

        const groupIds = Array.isArray(item.removeGroupIds) ? item.removeGroupIds : []
        for (const gid of groupIds) {
          const group = await prisma.group.findUnique({ where: { id: gid } })
          if (!group || !group.instanceName || !group.evolutionGroupId) continue
          if (cleanDigits(group.ownerPhone) === phone) {
            protegidos++
            continue
          }

          const token = await getInstanceToken(group.instanceName)
          if (!token) {
            erros.push(`Sem token para instância ${group.instanceName}`)
            continue
          }

          const resp = await evolutionCall('/group/participant', {
            method: 'POST',
            token,
            body: {
              groupJid: group.evolutionGroupId,
              participants: [`${phone}@s.whatsapp.net`],
              action: 'remove'
            }
          })

          if (resp.ok) {
            await prisma.groupMember.deleteMany({
              where: { groupId: group.id, phone }
            })
            await prisma.group.update({
              where: { id: group.id },
              data: { participantCount: Math.max(0, (group.participantCount || 1) - 1) }
            }).catch(() => {})
            removidos++
          } else {
            erros.push(`${group.name}: falha ao remover ${phone}`)
          }
        }
      }

      return NextResponse.json({
        ok: true,
        removidos,
        protegidos,
        erros
      })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (error) {
    console.error('[audit POST] erro:', error)
    return NextResponse.json({ error: 'Erro ao processar ação de auditoria' }, { status: 500 })
  }
}
