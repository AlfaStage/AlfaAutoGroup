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

  let idsFiltroTag = null;
  if (opcoes.tagId && opcoes.tagId !== 'todas') {
    const relacoes = await prisma.groupTag.findMany({
      where: { tagId: opcoes.tagId },
      select: { groupId: true }
    });
    idsFiltroTag = new Set(relacoes.map(r => r.groupId));
  }

  const agendamentos = await prisma.schedule.findMany({
    where: {
      updatedAt: { gte: inicio, lte: fim },
      ...(idsFiltroTag ? { groupId: { in: Array.from(idsFiltroTag) } } : {})
    },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          slug: true,
          instanceName: true,
          participantCount: true,
          tags: { include: { tag: true } }
        }
      }
    },
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
  const porCampanha = new Map();
  const falhas = [];
  const enquetes = [];

  for (const s of agendamentos) {
    const ehMensagem = TIPOS_MENSAGEM.includes(s.type);
    const instancia = s.group?.instanceName || 'sem instância';
    const chaveGrupo = s.group?.id || 'sem grupo';
    const campanha = s.campaign ? String(s.campaign).trim() : null;

    if (!porGrupo.has(chaveGrupo)) {
      porGrupo.set(chaveGrupo, {
        id: s.group?.id || null,
        nome: s.group?.name || 'Grupo removido',
        slug: s.group?.slug || null,
        instancia,
        membros: s.group?.participantCount || 0,
        enviados: 0, falhados: 0, pulados: 0, cliques: 0
      });
    }
    if (!porInstancia.has(instancia)) {
      porInstancia.set(instancia, { instancia, enviados: 0, falhados: 0, pulados: 0, grupos: new Set() });
    }
    if (!porTipo.has(s.type)) porTipo.set(s.type, { tipo: s.type, enviados: 0, falhados: 0 });
    if (campanha && !porCampanha.has(campanha)) {
      porCampanha.set(campanha, {
        campanha,
        enviados: 0,
        pendentes: 0,
        falhados: 0,
        grupos: new Set(),
        membrosAlcancados: 0
      });
    }

    const g = porGrupo.get(chaveGrupo);
    const i = porInstancia.get(instancia);
    const t = porTipo.get(s.type);
    i.grupos.add(chaveGrupo);

    const campObj = campanha ? porCampanha.get(campanha) : null;
    if (campObj && chaveGrupo !== 'sem grupo' && !campObj.grupos.has(chaveGrupo)) {
      campObj.grupos.add(chaveGrupo);
      campObj.membrosAlcancados += s.group?.participantCount || 0;
    }

    if (s.status === 'sent') {
      totais.enviados++; g.enviados++; i.enviados++; t.enviados++;
      if (campObj) campObj.enviados++;
      if (ehMensagem) totais.mensagens++; else totais.acoesDeGrupo++;
    } else if (s.status === 'error') {
      totais.falhados++; g.falhados++; i.falhados++; t.falhados++;
      if (campObj) campObj.falhados++;
      falhas.push({
        id: s.id,
        grupo: s.group?.name || '—',
        slug: s.group?.slug || null,
        instancia,
        tipo: s.type,
        campanha: campanha || null,
        erro: String(s.errorMessage || '').substring(0, 200),
        quando: s.adjustedAt
      });
    } else if (s.status === 'skipped') {
      totais.pulados++; g.pulados++; i.pulados++;
    } else if (s.status === 'deactivated') {
      totais.desativados++;
    } else if (s.status === 'pending') {
      totais.pendentes++;
      if (campObj) campObj.pendentes++;
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
    where: {
      clickedAt: { gte: inicio, lte: fim },
      ...(idsFiltroTag
        ? {
            OR: [
              { groupId: { in: Array.from(idsFiltroTag) } },
              { link: { groupId: { in: Array.from(idsFiltroTag) } } }
            ]
          }
        : {})
    },
    include: { link: true }
  });

  const porHoraArr = Array.from({ length: 24 }, (_, h) => ({ hora: h, cliques: 0, unicos: 0 }));
  let totalCliquesUnicos = 0;

  const porLink = new Map();
  const gruposEmCliques = new Set();

  for (const c of cliques) {
    const k = c.linkId;
    const grpId = c.groupId || c.link.groupId || null;
    if (grpId) gruposEmCliques.add(grpId);

    const ehUnico = c.isUnique !== false;
    if (ehUnico) totalCliquesUnicos++;

    const h = typeof c.hour === 'number' && c.hour >= 0 && c.hour <= 23
      ? c.hour
      : new Date(c.clickedAt).getHours();
    if (porHoraArr[h]) {
      porHoraArr[h].cliques++;
      if (ehUnico) porHoraArr[h].unicos++;
    }

    if (grpId && porGrupo.has(grpId)) {
      porGrupo.get(grpId).cliques = (porGrupo.get(grpId).cliques || 0) + 1;
    }

    if (!porLink.has(k)) {
      porLink.set(k, {
        code: c.link.code,
        url: c.link.url,
        label: c.link.label,
        groupId: c.link.groupId,
        cliques: 0,
        cliquesUnicos: 0,
        porGrupoMap: new Map()
      });
    }
    const itemLink = porLink.get(k);
    itemLink.cliques++;
    if (ehUnico) itemLink.cliquesUnicos++;
    if (grpId) {
      itemLink.porGrupoMap.set(grpId, (itemLink.porGrupoMap.get(grpId) || 0) + 1);
    }
  }

  const linksOrdenados = Array.from(porLink.values()).sort((a, b) => b.cliques - a.cliques);
  linksOrdenados.forEach(l => {
    if (l.groupId) gruposEmCliques.add(l.groupId);
  });

  // nome do grupo de cada link e de cada clique atribuído via ?grupid=
  const idsGrupos = Array.from(gruposEmCliques);
  const gruposDosLinks = idsGrupos.length
    ? await prisma.group.findMany({ where: { id: { in: idsGrupos } }, select: { id: true, name: true } })
    : [];
  const nomePorId = new Map(gruposDosLinks.map(g => [g.id, g.name]));

  linksOrdenados.forEach(l => {
    l.grupo = l.groupId ? nomePorId.get(l.groupId) || null : null;
    l.porGrupo = Array.from(l.porGrupoMap.entries())
      .map(([gid, qtd]) => ({ groupId: gid, grupo: nomePorId.get(gid) || gid, cliques: qtd }))
      .sort((a, b) => b.cliques - a.cliques);
    delete l.porGrupoMap;
  });

  // ------------------------------------------------ novos membros & churn real
  const ontem = new Date(new Date(`${dataISO}T12:00:00-03:00`).getTime() - 24 * 60 * 60 * 1000)
    .toISOString().substring(0, 10);

  const [hojeSnaps, ontemSnaps] = await Promise.all([
    prisma.groupDailySnapshot.findMany({
      where: {
        date: dataISO,
        ...(idsFiltroTag ? { groupId: { in: Array.from(idsFiltroTag) } } : {})
      },
      include: { group: { select: { id: true, name: true, instanceName: true } } }
    }),
    prisma.groupDailySnapshot.findMany({
      where: {
        date: ontem,
        ...(idsFiltroTag ? { groupId: { in: Array.from(idsFiltroTag) } } : {})
      }
    })
  ]);

  const ontemPorGrupo = new Map(ontemSnaps.map(s => [s.groupId, s.memberCount]));
  const entradasPorGrupo = new Map();

  const crescimento = hojeSnaps
    .map(s => {
      const antes = ontemPorGrupo.get(s.groupId);
      const saldoLiquido = antes === undefined ? 0 : s.memberCount - antes;
      const entradasReais = (s.joinedCount || 0) > 0
        ? s.joinedCount
        : Math.max(0, saldoLiquido);
      const saidasReais = (s.leftCount || 0) > 0
        ? s.leftCount
        : Math.abs(Math.min(0, saldoLiquido));

      entradasPorGrupo.set(s.groupId, entradasReais);

      return {
        groupId: s.groupId,
        grupo: s.group?.name || '—',
        instancia: s.group?.instanceName || '—',
        agora: s.memberCount,
        antes: antes ?? null,
        novos: antes === undefined && entradasReais === 0 && saidasReais === 0 ? null : saldoLiquido,
        entradas: entradasReais,
        saidas: saidasReais
      };
    })
    .filter(c => (c.novos !== null && c.novos !== 0) || c.entradas > 0 || c.saidas > 0)
    .sort((a, b) => (b.entradas - b.saidas) - (a.entradas - a.saidas));

  const totalNovos = crescimento.reduce((soma, c) => soma + (c.entradas || Math.max(0, c.novos || 0)), 0);
  const totalSaidas = crescimento.reduce((soma, c) => soma + (c.saidas || Math.abs(Math.min(0, c.novos || 0))), 0);

  // --------------------------------------------------- tags & funil /g/[code]
  const [tags, tagClicks] = await Promise.all([
    prisma.tag.findMany({
      include: {
        groups: {
          include: {
            group: { select: { id: true, name: true, participantCount: true } }
          }
        }
      }
    }),
    prisma.tagClick
      ? prisma.tagClick.findMany({
          where: { clickedAt: { gte: inicio, lte: fim } }
        }).catch(() => [])
      : Promise.resolve([])
  ]);

  const cliquesPorTag = new Map();
  for (const tc of tagClicks) {
    if (!cliquesPorTag.has(tc.tagId)) {
      cliquesPorTag.set(tc.tagId, { total: 0, unicos: 0 });
    }
    const st = cliquesPorTag.get(tc.tagId);
    st.total++;
    if (tc.isUnique !== false) st.unicos++;
  }

  const resumoTags = tags.map(t => {
    const totalMembros = t.groups.reduce((acc, g) => acc + (g.group?.participantCount || 0), 0);
    const entradasTag = t.groups.reduce((acc, g) => acc + (entradasPorGrupo.get(g.groupId) || 0), 0);
    const clk = cliquesPorTag.get(t.id) || { total: 0, unicos: 0 };
    const taxaConversao = clk.unicos > 0
      ? Math.min(100, Math.round((entradasTag / clk.unicos) * 100))
      : null;

    return {
      id: t.id,
      nome: t.name,
      slug: t.slug,
      cor: t.color,
      capacidade: t.capacity,
      grupos: t.groups.length,
      totalMembros,
      autoCreate: t.autoCreate,
      cliquesConvite: clk.total,
      cliquesConviteUnicos: clk.unicos,
      novosMembrosHoje: entradasTag,
      taxaConversao
    };
  });

  return {
    data: dataISO,
    fuso: FUSO,
    totais: {
      ...totais,
      cliques: cliques.length,
      cliquesUnicos: totalCliquesUnicos,
      linksClicados: linksOrdenados.length,
      novosMembros: totalNovos,
      saidas: Math.abs(totalSaidas),
      saldoLiquido: totalNovos - Math.abs(totalSaidas),
      gruposAtivos: porGrupo.size,
      instancias: porInstancia.size
    },
    porGrupo: Array.from(porGrupo.values()).sort((a, b) => b.enviados - a.enviados),
    porInstancia: Array.from(porInstancia.values())
      .map(i => ({ ...i, grupos: i.grupos.size }))
      .sort((a, b) => b.enviados - a.enviados),
    porTipo: Array.from(porTipo.values()).sort((a, b) => b.enviados - a.enviados),
    porCampanha: Array.from(porCampanha.values())
      .map(c => ({ ...c, grupos: c.grupos.size }))
      .sort((a, b) => b.enviados - a.enviados),
    porHora: porHoraArr,
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

  if (rel.tags && rel.tags.length) {
    linhas.push('', '*Tags e Lotação*');
    rel.tags.slice(0, 5).forEach(t => {
      linhas.push(`• ${t.nome}: ${t.grupos} grupo(s), ${t.totalMembros || 0} membros${t.autoCreate ? ' (auto-criação ativa)' : ''}`);
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
