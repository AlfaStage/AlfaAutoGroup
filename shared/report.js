/**
 * Relatorio diario: o que saiu, o que falhou, quem clicou, o que as enquetes
 * responderam e quantas pessoas entraram — por grupo e por instancia.
 *
 * `montarRelatorio` devolve dados puros, usados tanto pela pagina do painel
 * quanto pelo resumo enviado no WhatsApp as 23:59.
 */

const { getInstanceToken } = require('./group-tasks');
const { janelaDoDia, FUSO } = require('./ops');

const apiUrl = () => process.env.EVOLUTION_API_URL || '';

const TIPOS_MENSAGEM = ['text', 'media', 'button', 'poll'];

/** Resultados de uma enquete ja enviada. */
async function resultadoDaEnquete(instanceName, messageId) {
  if (!messageId) return null;
  const token = await getInstanceToken(instanceName);
  if (!token) return null;

  try {
    const res = await fetch(`${apiUrl()}/polls/${encodeURIComponent(messageId)}/results`, {
      headers: { apikey: token }
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j.data || j;
  } catch (e) {
    return null;
  }
}

async function montarRelatorio(prisma, dataISO, opcoes = {}) {
  const { inicio, fim } = janelaDoDia(dataISO);
  const comEnquetes = opcoes.comEnquetes !== false;

  const agendamentos = await prisma.schedule.findMany({
    where: { updatedAt: { gte: inicio, lte: fim } },
    include: { group: { select: { id: true, name: true, slug: true, instanceName: true, participantCount: true } } },
    orderBy: { adjustedAt: 'asc' }
  });

  // --------------------------------------------------------------- totais
  const totais = {
    enviados: 0, falhados: 0, pulados: 0, desativados: 0, pendentes: 0,
    mensagens: 0, acoesDeGrupo: 0
  };

  const porGrupo = new Map();
  const porInstancia = new Map();
  const porTipo = new Map();
  const falhas = [];
  const enquetes = [];

  for (const s of agendamentos) {
    const ehMensagem = TIPOS_MENSAGEM.includes(s.type);
    const instancia = s.group?.instanceName || 'sem instância';
    const chaveGrupo = s.group?.id || 'sem grupo';

    if (!porGrupo.has(chaveGrupo)) {
      porGrupo.set(chaveGrupo, {
        id: s.group?.id || null,
        nome: s.group?.name || 'Grupo removido',
        slug: s.group?.slug || null,
        instancia,
        membros: s.group?.participantCount || 0,
        enviados: 0, falhados: 0, pulados: 0
      });
    }
    if (!porInstancia.has(instancia)) {
      porInstancia.set(instancia, { instancia, enviados: 0, falhados: 0, pulados: 0, grupos: new Set() });
    }
    if (!porTipo.has(s.type)) porTipo.set(s.type, { tipo: s.type, enviados: 0, falhados: 0 });

    const g = porGrupo.get(chaveGrupo);
    const i = porInstancia.get(instancia);
    const t = porTipo.get(s.type);
    i.grupos.add(chaveGrupo);

    if (s.status === 'sent') {
      totais.enviados++; g.enviados++; i.enviados++; t.enviados++;
      if (ehMensagem) totais.mensagens++; else totais.acoesDeGrupo++;
    } else if (s.status === 'error') {
      totais.falhados++; g.falhados++; i.falhados++; t.falhados++;
      falhas.push({
        id: s.id,
        grupo: s.group?.name || '—',
        slug: s.group?.slug || null,
        instancia,
        tipo: s.type,
        erro: String(s.errorMessage || '').substring(0, 200),
        quando: s.adjustedAt
      });
    } else if (s.status === 'skipped') {
      totais.pulados++; g.pulados++; i.pulados++;
    } else if (s.status === 'deactivated') {
      totais.desativados++;
    } else if (s.status === 'pending') {
      totais.pendentes++;
    }

    if (comEnquetes && s.type === 'poll' && s.status === 'sent') {
      let conteudo = {};
      try { conteudo = JSON.parse(s.content); } catch (e) { /* ignora */ }
      enquetes.push({
        id: s.id,
        grupo: s.group?.name || '—',
        pergunta: conteudo.name || '—',
        opcoes: conteudo.values || [],
        messageId: s.evolutionMessageId,
        instanceName: s.group?.instanceName,
        resultados: null
      });
    }
  }

  // Resultados das enquetes, uma chamada por enquete
  if (comEnquetes) {
    for (const e of enquetes) {
      e.resultados = await resultadoDaEnquete(e.instanceName, e.messageId);
    }
  }

  // --------------------------------------------------------------- cliques
  const cliques = await prisma.linkClick.findMany({
    where: { clickedAt: { gte: inicio, lte: fim } },
    include: { link: true }
  });

  const porLink = new Map();
  for (const c of cliques) {
    const k = c.linkId;
    if (!porLink.has(k)) {
      porLink.set(k, {
        code: c.link.code,
        url: c.link.url,
        label: c.link.label,
        groupId: c.link.groupId,
        cliques: 0
      });
    }
    porLink.get(k).cliques++;
  }

  const linksOrdenados = Array.from(porLink.values()).sort((a, b) => b.cliques - a.cliques);

  // nome do grupo de cada link
  const idsGrupos = Array.from(new Set(linksOrdenados.map(l => l.groupId).filter(Boolean)));
  const gruposDosLinks = idsGrupos.length
    ? await prisma.group.findMany({ where: { id: { in: idsGrupos } }, select: { id: true, name: true } })
    : [];
  const nomePorId = new Map(gruposDosLinks.map(g => [g.id, g.name]));
  linksOrdenados.forEach(l => { l.grupo = l.groupId ? nomePorId.get(l.groupId) || null : null; });

  // ------------------------------------------------------- novos membros
  const ontem = new Date(new Date(`${dataISO}T12:00:00-03:00`).getTime() - 24 * 60 * 60 * 1000)
    .toISOString().substring(0, 10);

  const [hojeSnaps, ontemSnaps] = await Promise.all([
    prisma.groupDailySnapshot.findMany({ where: { date: dataISO }, include: { group: { select: { name: true, instanceName: true } } } }),
    prisma.groupDailySnapshot.findMany({ where: { date: ontem } })
  ]);

  const ontemPorGrupo = new Map(ontemSnaps.map(s => [s.groupId, s.memberCount]));
  const crescimento = hojeSnaps
    .map(s => {
      const antes = ontemPorGrupo.get(s.groupId);
      return {
        grupo: s.group?.name || '—',
        instancia: s.group?.instanceName || '—',
        agora: s.memberCount,
        antes: antes ?? null,
        novos: antes === undefined ? null : s.memberCount - antes
      };
    })
    .filter(c => c.novos !== null && c.novos !== 0)
    .sort((a, b) => (b.novos || 0) - (a.novos || 0));

  const totalNovos = crescimento.reduce((soma, c) => soma + Math.max(0, c.novos || 0), 0);
  const totalSaidas = crescimento.reduce((soma, c) => soma + Math.min(0, c.novos || 0), 0);

  // --------------------------------------------------------------- tags
  const tags = await prisma.tag.findMany({ include: { groups: true } })
  const resumoTags = tags.map(t => ({
    nome: t.name,
    cor: t.color,
    grupos: t.groups.length,
    autoCreate: t.autoCreate
  }))

  return {
    data: dataISO,
    fuso: FUSO,
    totais: {
      ...totais,
      cliques: cliques.length,
      linksClicados: linksOrdenados.length,
      novosMembros: totalNovos,
      saidas: Math.abs(totalSaidas),
      gruposAtivos: porGrupo.size,
      instancias: porInstancia.size
    },
    porGrupo: Array.from(porGrupo.values()).sort((a, b) => b.enviados - a.enviados),
    porInstancia: Array.from(porInstancia.values())
      .map(i => ({ ...i, grupos: i.grupos.size }))
      .sort((a, b) => b.enviados - a.enviados),
    porTipo: Array.from(porTipo.values()).sort((a, b) => b.enviados - a.enviados),
    falhas,
    enquetes,
    links: linksOrdenados,
    crescimento,
    tags: resumoTags
  };
}

/** Resumo curto para mandar no WhatsApp, com link para o relatorio completo. */
function resumoTexto(rel) {
  const t = rel.totais;
  const dataBonita = new Date(`${rel.data}T12:00:00-03:00`)
    .toLocaleDateString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' });

  const linhas = [
    `📊 *Relatório do dia ${dataBonita}*`,
    '',
    `✅ Enviados: *${t.enviados}*  ❌ Falhas: *${t.falhados}*  ⏭️ Pulados: *${t.pulados}*`,
    `💬 Mensagens: ${t.mensagens}   ⚙️ Ações de grupo: ${t.acoesDeGrupo}`,
    `👥 Grupos ativos: ${t.gruposAtivos}   📱 Instâncias: ${t.instancias}`,
    `🖱️ Cliques em links: *${t.cliques}* em ${t.linksClicados} link(s)`,
    `🆕 Novos membros: *${t.novosMembros}*${t.saidas ? `   👋 Saíram: ${t.saidas}` : ''}`
  ];

  if (rel.porInstancia.length) {
    linhas.push('', '*Por instância*');
    rel.porInstancia.slice(0, 5).forEach(i => {
      linhas.push(`• ${i.instancia}: ${i.enviados} enviados, ${i.falhados} falhas (${i.grupos} grupos)`);
    });
  }

  const topGrupos = rel.porGrupo.filter(g => g.enviados > 0).slice(0, 5);
  if (topGrupos.length) {
    linhas.push('', '*Grupos com mais envios*');
    topGrupos.forEach(g => linhas.push(`• ${g.nome}: ${g.enviados}`));
  }

  if (rel.links.length) {
    linhas.push('', '*Links mais clicados*');
    rel.links.slice(0, 5).forEach(l => {
      linhas.push(`• ${l.label || l.url.substring(0, 40)}: ${l.cliques} clique(s)${l.grupo ? ` — ${l.grupo}` : ''}`);
    });
  }

  if (rel.enquetes.length) {
    linhas.push('', '*Enquetes do dia*');
    rel.enquetes.slice(0, 3).forEach(e => {
      linhas.push(`• ${e.pergunta} — ${e.grupo}`);
      if (e.resultados && Array.isArray(e.resultados.options)) {
        e.resultados.options.forEach(o => {
          linhas.push(`   ${o.name || o.option}: ${o.votes ?? o.count ?? 0}`);
        });
      } else {
        linhas.push('   (resultados indisponíveis)');
      }
    });
  }

  if (rel.falhas.length) {
    linhas.push('', `⚠️ *${rel.falhas.length} falha(s) precisam de atenção*`);
    rel.falhas.slice(0, 3).forEach(f => {
      linhas.push(`• ${f.grupo} (${f.tipo}): ${f.erro.substring(0, 80)}`);
    });
  }

  return linhas.join('\n');
}

module.exports = { montarRelatorio, resumoTexto, resultadoDaEnquete };
