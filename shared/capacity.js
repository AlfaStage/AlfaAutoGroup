/**
 * Gestao de grupos lotados.
 *
 * Cada tag tem uma fila de grupos ordenada por `position`. O link publico
 * /g/{codigo} sempre aponta para o primeiro grupo com vaga. Quando esse grupo
 * enche, a tag cria o proximo — mesmo padrao de nome, mesmos agendamentos
 * pendentes — e o link passa a levar para ele, sem ninguem mexer em nada.
 */

const { getInstanceToken } = require('./group-tasks');
const { enviarParaGrupo, grupoDeAlerta, lerAjuste, CHAVE_ALERTAS_ON } = require('./ops');

const apiUrl = () => process.env.EVOLUTION_API_URL || '';
const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');

async function evo(path, { token, method = 'POST', body }) {
  const res = await fetch(`${apiUrl()}${path}`, {
    method,
    headers: { apikey: token, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const texto = await res.text();
  let data = null;
  try { data = JSON.parse(texto); } catch (e) { /* nao-JSON */ }
  return { ok: res.ok, status: res.status, data, texto };
}

/** Busca (e guarda) o link de convite do grupo. */
async function garantirLinkDeConvite(prisma, grupo, forcar) {
  const idade = grupo.inviteLinkAt ? Date.now() - new Date(grupo.inviteLinkAt).getTime() : Infinity;
  const valido = grupo.inviteLink && idade < 7 * 24 * 60 * 60 * 1000;
  if (valido && !forcar) return grupo.inviteLink;

  const token = await getInstanceToken(grupo.instanceName);
  if (!token) return grupo.inviteLink || null;

  const r = await evo('/group/invitelink', {
    token,
    body: { groupJid: grupo.evolutionGroupId, reset: false }
  });
  if (!r.ok) return grupo.inviteLink || null;

  const link = typeof r.data?.data === 'string' ? r.data.data : (r.data?.data?.link || null);
  if (!link) return grupo.inviteLink || null;

  await prisma.group.update({
    where: { id: grupo.id },
    data: { inviteLink: link, inviteLinkAt: new Date() }
  });
  return link;
}

/** Grupos de uma tag, na ordem de preenchimento. */
async function grupasDaTag(prisma, tagId) {
  const vinculos = await prisma.groupTag.findMany({
    where: { tagId },
    include: { group: true },
    orderBy: { position: 'asc' }
  });
  return vinculos.map(v => ({ ...v.group, position: v.position }));
}

/**
 * Primeiro grupo com vaga. Considera lotado quem atingiu a capacidade da tag.
 * Devolve null quando todos estao cheios.
 */
function primeiroComVaga(grupos, capacidade) {
  return grupos.find(g => !g.isFull && (g.participantCount || 0) < capacidade) || null;
}

/** Proximo numero livre para o padrao de nome da tag. */
function proximoNome(tag, grupos) {
  const padrao = tag.namePattern || `${tag.name} {n}`;
  const proximo = grupos.length + 1;
  return padrao.replace(/\{n\}/g, String(proximo)).replace(/\{nn\}/g, String(proximo).padStart(2, '0'));
}

/**
 * Cria o proximo grupo da tag e copia os agendamentos pendentes do modelo.
 * O modelo e o ultimo grupo da fila — o que acabou de encher.
 */

/**
 * Numeros que entram no grupo novo.
 *
 * Procura na fila inteira da tag, do primeiro grupo para o ultimo: o grupo
 * mais antigo e o que tem membros sincronizados de verdade. Um grupo recem
 * criado ainda nao foi sincronizado, entao nao serve de semente sozinho.
 *
 * O numero da propria instancia fica de fora — ele ja entra como criador.
 */
async function numerosSemente(prisma, grupos, instanceName) {
  const numeroDaInstancia = await numeroDaInstanciaDe(prisma, grupos);

  for (const g of grupos) {
    const membros = await prisma.groupMember.findMany({
      where: { groupId: g.id },
      select: { phone: true, isAdmin: true },
      orderBy: { isAdmin: 'desc' },
      take: 10
    });

    const numeros = membros
      .map((m) => String(m.phone || '').replace(/\D/g, ''))
      .filter((n) => n.length >= 10 && n !== numeroDaInstancia);

    const unicos = Array.from(new Set(numeros)).slice(0, 3);
    if (unicos.length) return unicos.map((n) => n + '@s.whatsapp.net');
  }

  return [];
}

/** O numero da propria instancia, deduzido do dono dos grupos da tag. */
async function numeroDaInstanciaDe(prisma, grupos) {
  for (const g of grupos) {
    const dono = await prisma.groupMember.findFirst({
      where: { groupId: g.id, isSuperAdmin: true },
      select: { phone: true }
    });
    if (dono && dono.phone) return String(dono.phone).replace(/\D/g, '');
  }
  return '';
}

async function criarProximoGrupo(prisma, tag, grupos) {
  const modelo = grupos[grupos.length - 1];
  const instanceName = tag.instanceName || modelo?.instanceName;
  if (!instanceName) return { ok: false, erro: 'tag sem instância definida' };

  const token = await getInstanceToken(instanceName);
  if (!token) return { ok: false, erro: `instância "${instanceName}" não encontrada` };

  const nome = proximoNome(tag, grupos);

  // A Evolution nao cria grupo vazio. O grupo novo nasce com os mesmos
  // administradores do anterior, que sao os numeros da propria operacao.
  const participantes = await numerosSemente(prisma, grupos, instanceName);
  if (participantes.length === 0) {
    return {
      ok: false,
      erro: 'nenhum número conhecido nos grupos desta tag — sincronize os grupos para o sistema saber quem adicionar no grupo novo'
    };
  }

  const criado = await evo('/group/create', {
    token,
    body: { groupName: nome, participants: participantes }
  });
  if (!criado.ok) return { ok: false, erro: `Evolution recusou: ${criado.texto}` };

  const d = criado.data || {};
  const jid =
    d.JID || d.jid || d.id ||
    d.data?.JID || d.data?.jid || d.data?.id || '';

  if (!jid) return { ok: false, erro: 'a Evolution não devolveu o JID do grupo criado' };

  // A Evolution informa quem nao pode ser adicionado; nao e motivo para falhar.
  const naoAdicionados = (d.data && d.data.failed) || d.failed || [];
  if (naoAdicionados.length) {
    console.warn(`[capacidade] grupo ${nome}: ${naoAdicionados.length} participante(s) nao entraram`);
  }

  const slug = jid.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15) + Math.floor(Math.random() * 1000);

  const novo = await prisma.group.create({
    data: {
      name: nome,
      slug,
      evolutionGroupId: jid,
      instanceName,
      description: modelo?.description || '',
      topic: modelo?.topic || ''
    }
  });

  await prisma.groupTag.create({
    data: { groupId: novo.id, tagId: tag.id, position: grupos.length }
  });

  // Registra quem entrou. Sem isso o grupo novo nasceria sem membros
  // conhecidos e nao serviria de semente para o proximo da fila.
  const entraram = (d.data && d.data.added) || d.added || [];
  const numerosQueEntraram = participantes
    .map((p) => p.split('@')[0])
    .filter(Boolean);

  if (numerosQueEntraram.length) {
    await prisma.groupMember.createMany({
      data: numerosQueEntraram.map((phone) => ({
        groupId: novo.id,
        phone,
        role: 'participant'
      }))
    }).catch(() => { /* sincronizacao seguinte corrige */ });
  }

  await prisma.group.update({
    where: { id: novo.id },
    data: { participantCount: Math.max(1, entraram.length || numerosQueEntraram.length) }
  });

  // Copia os agendamentos pendentes do modelo, para o grupo novo nascer
  // com a mesma programacao.
  let copiados = 0;
  if (tag.cloneSchedules && modelo) {
    const pendentes = await prisma.schedule.findMany({
      where: { groupId: modelo.id, status: 'pending' },
      orderBy: { adjustedAt: 'asc' }
    });

    for (const s of pendentes) {
      await prisma.schedule.create({
        data: {
          groupId: novo.id,
          type: s.type,
          content: s.content,
          scheduledAt: s.scheduledAt,
          adjustedAt: s.adjustedAt,
          status: 'pending'
        }
      });
      copiados++;
    }
  }

  // Aplica nome/descricao herdados e busca o link de convite.
  const link = await garantirLinkDeConvite(prisma, novo, true);

  return { ok: true, grupo: novo, nome, copiados, link };
}

/**
 * Percorre as tags com autoCreate ligado e garante que sempre exista um
 * grupo com vaga. Chamada periodicamente pelo worker.
 */
async function manterVagasAbertas(prisma) {
  const tags = await prisma.tag.findMany({ where: { autoCreate: true } });
  const eventos = [];

  for (const tag of tags) {
    const grupos = await grupasDaTag(prisma, tag.id);
    if (grupos.length === 0) continue;

    // Marca como cheio quem passou da capacidade
    for (const g of grupos) {
      const cheio = (g.participantCount || 0) >= tag.capacity;
      if (cheio !== g.isFull) {
        await prisma.group.update({ where: { id: g.id }, data: { isFull: cheio } });
        g.isFull = cheio;
      }
    }

    if (primeiroComVaga(grupos, tag.capacity)) continue;

    // Todos cheios: cria o proximo
    const r = await criarProximoGrupo(prisma, tag, grupos);
    eventos.push({ tag: tag.name, ...r });

    if (r.ok) {
      await avisarGrupoCriado(prisma, tag, r);
    } else {
      console.error(`[capacidade] falha ao criar grupo da tag ${tag.name}: ${r.erro}`);
    }
  }

  return eventos;
}

async function avisarGrupoCriado(prisma, tag, resultado) {
  const ligado = await lerAjuste(prisma, CHAVE_ALERTAS_ON, 'true');
  if (ligado !== 'true') return;

  const destino = await grupoDeAlerta(prisma);
  if (!destino) return;

  const base = appUrl();
  const linhas = [
    '✅ *Novo grupo criado automaticamente*',
    '',
    `*Tag:* ${tag.name}`,
    `*Grupo:* ${resultado.nome}`,
    `*Agendamentos copiados:* ${resultado.copiados}`,
    '',
    'Os grupos anteriores da tag estavam cheios. O link de convite já aponta para este.',
    resultado.link ? `*Convite:* ${resultado.link}` : ''
  ].filter(Boolean);

  await enviarParaGrupo(
    destino,
    linhas.join('\n'),
    base ? { displayText: 'Abrir tag', url: `${base}/tags`, title: 'Novo grupo criado' } : null
  );

  await prisma.alertLog.create({
    data: { kind: 'tag_autocreate', refId: `${tag.id}:${resultado.grupo.id}`, detail: resultado.nome }
  }).catch(() => { /* ignora duplicata */ });
}

/**
 * Para onde o link /g/{codigo} deve levar agora.
 * Cria o proximo grupo na hora se todos estiverem cheios e a tag permitir.
 */
async function destinoDoConvite(prisma, codigo) {
  const tag = await prisma.tag.findUnique({ where: { inviteCode: codigo } });
  if (!tag) return { erro: 'nao_encontrado' };

  let grupos = await grupasDaTag(prisma, tag.id);
  if (grupos.length === 0) return { erro: 'sem_grupos' };

  let alvo = primeiroComVaga(grupos, tag.capacity);

  if (!alvo && tag.autoCreate) {
    const r = await criarProximoGrupo(prisma, tag, grupos);
    if (r.ok) {
      await avisarGrupoCriado(prisma, tag, r);
      alvo = r.grupo;
    }
  }

  // Sem vaga e sem criacao automatica: manda para o ultimo, melhor que nada.
  if (!alvo) alvo = grupos[grupos.length - 1];

  const link = await garantirLinkDeConvite(prisma, alvo, false);
  if (!link) return { erro: 'sem_link', tag, grupo: alvo };

  return { tag, grupo: alvo, link };
}

module.exports = {
  garantirLinkDeConvite,
  grupasDaTag,
  primeiroComVaga,
  proximoNome,
  criarProximoGrupo,
  manterVagasAbertas,
  destinoDoConvite
};
