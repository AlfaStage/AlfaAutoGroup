/**
 * Motor de Variaveis Dinamicas e Spintax para mensagens, legendas, botoes e enquetes.
 *
 * Executado em memoria (< 1ms) no momento do disparo pelo worker.js.
 */

const { randomBytes } = require('crypto');
const { appendGroupIdToTrackedLinks, shortGroupId } = require('./bot-filter');

const FUSO = 'America/Sao_Paulo';

/** Catalogo completo de variaveis disponiveis para exibir no painel e na documentacao. */
const CATALOGO_VARIAVEIS = [
  {
    categoria: 'Grupo',
    itens: [
      { chave: '{grupo}', exemplo: 'Salvador #02', descricao: 'Nome completo atual do grupo' },
      { chave: '{nome_grupo}', exemplo: 'Salvador #02', descricao: 'Sinônimo de {grupo}' },
      { chave: '{grupo_base}', exemplo: 'Salvador', descricao: 'Nome do grupo sem a numeração final' },
      { chave: '{n}', exemplo: '2', descricao: 'Número do grupo na fila ou extraído do nome' },
      { chave: '{nn}', exemplo: '02', descricao: 'Número do grupo com 2 dígitos (01, 02...)' },
      { chave: '{numero_grupo}', exemplo: '2', descricao: 'Sinônimo de {n}' },
      { chave: '{descricao_grupo}', exemplo: 'Grupo VIP de ofertas', descricao: 'Descrição/tópico atual do grupo' },
      { chave: '{topico}', exemplo: 'Grupo VIP de ofertas', descricao: 'Sinônimo de {descricao_grupo}' },
      { chave: '{slug_grupo}', exemplo: 'salvador-02', descricao: 'Identificador curto (slug) do grupo' },
      { chave: '{id_grupo}', exemplo: '2xP9', descricao: 'Código curto de 4 caracteres do grupo (usado em ?grupid=)' },
      { chave: '{link_grupo}', exemplo: 'https://chat.whatsapp.com/...', descricao: 'Link de convite direto do grupo no WhatsApp' }
    ]
  },
  {
    categoria: 'Lotação & Escassez',
    itens: [
      { chave: '{membros}', exemplo: '842', descricao: 'Quantidade atual de participantes no grupo' },
      { chave: '{capacidade}', exemplo: '950', descricao: 'Capacidade máxima configurada na Tag (ou 950)' },
      { chave: '{vagas}', exemplo: '108', descricao: 'Vagas restantes até atingir a capacidade' },
      { chave: '{vagas_restantes}', exemplo: '108', descricao: 'Sinônimo de {vagas}' },
      { chave: '{ocupacao}', exemplo: '89%', descricao: 'Percentual de ocupação do grupo com símbolo %' },
      { chave: '{percentual_ocupacao}', exemplo: '89', descricao: 'Número percentual de ocupação (0 a 100)' },
      { chave: '{vagas_status}', exemplo: 'Últimas vagas!', descricao: 'Frase automática de escassez conforme ocupação' }
    ]
  },
  {
    categoria: 'Tag / Praça / Cidade',
    itens: [
      { chave: '{tag}', exemplo: 'Salvador', descricao: 'Nome da Tag principal à qual o grupo pertence' },
      { chave: '{cidade}', exemplo: 'Salvador', descricao: 'Sinônimo de {tag} (ideal para campanhas regionais)' },
      { chave: '{praca}', exemplo: 'Salvador', descricao: 'Sinônimo de {tag}' },
      { chave: '{tag_slug}', exemplo: 'salvador', descricao: 'Slug da Tag principal' },
      { chave: '{total_grupos_tag}', exemplo: '3', descricao: 'Quantidade total de grupos vinculados à Tag' },
      { chave: '{total_membros_tag}', exemplo: '2450', descricao: 'Soma de membros de todos os grupos da Tag' },
      { chave: '{link_tag}', exemplo: 'https://aag.../g/6f1749', descricao: 'Link público inteligente (/g/) da Tag com redirecionamento automático' },
      { chave: '{link_convite}', exemplo: 'https://aag.../g/6f1749', descricao: 'Sinônimo de {link_tag} (ou link do próprio grupo se não tiver Tag)' }
    ]
  },
  {
    categoria: 'Data, Hora & Saudação (SP)',
    itens: [
      { chave: '{saudacao}', exemplo: 'Bom dia', descricao: 'Bom dia / Boa tarde / Boa noite conforme horário de SP' },
      { chave: '{saudacao_emoji}', exemplo: 'Bom dia ☀️', descricao: 'Saudação contextual acompanhada de emoji' },
      { chave: '{hoje}', exemplo: '19/10/2026', descricao: 'Data de hoje no formato DD/MM/AAAA' },
      { chave: '{data}', exemplo: '19/10/2026', descricao: 'Sinônimo de {hoje}' },
      { chave: '{data_curta}', exemplo: '19/10', descricao: 'Data de hoje curta (DD/MM)' },
      { chave: '{amanha}', exemplo: '20/10/2026', descricao: 'Data de amanhã (DD/MM/AAAA) — ótimo para prazos de ofertas' },
      { chave: '{amanha_curta}', exemplo: '20/10', descricao: 'Data de amanhã curta (DD/MM)' },
      { chave: '{dia_semana}', exemplo: 'segunda-feira', descricao: 'Dia da semana por extenso' },
      { chave: '{mes}', exemplo: 'outubro', descricao: 'Nome do mês atual por extenso' },
      { chave: '{hora}', exemplo: '14:30', descricao: 'Horário atual do disparo (HH:MM)' },
      { chave: '{ano}', exemplo: '2026', descricao: 'Ano atual (AAAA)' }
    ]
  },
  {
    categoria: 'Campanha & Anti-Ban (Spintax)',
    itens: [
      { chave: '{campanha}', exemplo: 'Black Friday Outubro', descricao: 'Nome da campanha definida no agendamento' },
      { chave: '{instancia}', exemplo: 'IceLaser-0800', descricao: 'Nome da instância conectada do grupo' },
      { chave: '{id_curto}', exemplo: 'A9F2', descricao: 'Código único de 4 caracteres gerado a cada envio (protocolo/anti-ban)' },
      { chave: '{Olá|Oi|E aí}', exemplo: 'Olá', descricao: 'Spintax: sorteia automaticamente uma das opções separadas por | em cada grupo' }
    ]
  }
];

function extrairNumeroDoGrupo(nome, fallbackPos) {
  if (typeof fallbackPos === 'number' && fallbackPos >= 0) return fallbackPos + 1;
  const m = String(nome || '').match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 1;
}

function extrairBaseDoNome(nome) {
  return String(nome || '')
    .replace(/[\s#\-_]*\d+\s*$/, '')
    .trim() || String(nome || '');
}

function dadosDeTempoSP(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(agora);

  const get = (t) => (partes.find((p) => p.type === t) || {}).value || '';
  const dia = get('day');
  const mesNum = get('month');
  const ano = get('year');
  const horaNum = parseInt(get('hour') || '12', 10) % 24;
  const minuto = get('minute');

  const amanhaDate = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
  const partesAmanha = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).formatToParts(amanhaDate);
  const getAm = (t) => (partesAmanha.find((p) => p.type === t) || {}).value || '';

  const diaSemana = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    weekday: 'long'
  }).format(agora);

  const mesExtenso = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    month: 'long'
  }).format(agora);

  let saudacao = 'Boa noite';
  let saudacaoEmoji = 'Boa noite 🌙';
  if (horaNum >= 5 && horaNum < 12) {
    saudacao = 'Bom dia';
    saudacaoEmoji = 'Bom dia ☀️';
  } else if (horaNum >= 12 && horaNum < 18) {
    saudacao = 'Boa tarde';
    saudacaoEmoji = 'Boa tarde 🌤️';
  }

  return {
    saudacao,
    saudacao_emoji: saudacaoEmoji,
    hoje: `${dia}/${mesNum}/${ano}`,
    data: `${dia}/${mesNum}/${ano}`,
    data_curta: `${dia}/${mesNum}`,
    amanha: `${getAm('day')}/${getAm('month')}/${getAm('year')}`,
    amanha_curta: `${getAm('day')}/${getAm('month')}`,
    dia_semana: diaSemana,
    mes: mesExtenso,
    hora: `${String(horaNum).padStart(2, '0')}:${minuto}`,
    ano
  };
}

/**
 * Monta o dicionario de contexto de um grupo consultando suas tags (se ainda nao carregadas).
 */
async function montarContextoGrupo(prisma, group, extras = {}) {
  const baseUrl = String(extras.baseUrl || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
  let tagPrincipal = extras.tag || null;
  let posicaoNaTag = typeof extras.position === 'number' ? extras.position : null;
  let totalGruposTag = extras.totalGruposTag || 1;
  let totalMembrosTag = extras.totalMembrosTag || (group?.participantCount || 0);

  if (!tagPrincipal && prisma && group?.id) {
    const vinculo = await prisma.groupTag.findFirst({
      where: { groupId: group.id },
      orderBy: { position: 'asc' },
      include: {
        tag: {
          include: {
            groups: {
              include: {
                group: { select: { participantCount: true } }
              }
            }
          }
        }
      }
    }).catch(() => null);

    if (vinculo && vinculo.tag) {
      tagPrincipal = vinculo.tag;
      posicaoNaTag = vinculo.position;
      totalGruposTag = (vinculo.tag.groups || []).length || 1;
      totalMembrosTag = (vinculo.tag.groups || []).reduce(
        (acc, g) => acc + (g.group?.participantCount || 0),
        0
      );
    }
  }

  const nomeGrupo = group?.name || 'Grupo';
  const numGrupo = extrairNumeroDoGrupo(nomeGrupo, posicaoNaTag);
  const membros = Number(group?.participantCount || 0);
  const capacidade = Number(tagPrincipal?.capacity || 950);
  const vagas = Math.max(0, capacidade - membros);
  const pct = capacidade > 0 ? Math.min(100, Math.round((membros / capacidade) * 100)) : 0;

  let vagasStatus = 'Vagas abertas';
  if (pct >= 95 || vagas <= 20) vagasStatus = 'Últimas vagas!';
  else if (pct >= 80) vagasStatus = 'Grupo quase cheio!';
  else if (pct >= 50) vagasStatus = 'Mais da metade preenchido';

  const linkTag = tagPrincipal?.inviteCode && baseUrl
    ? `${baseUrl}/g/${tagPrincipal.inviteCode}`
    : (group?.inviteLink || '');

  const tempo = dadosDeTempoSP();

  return {
    groupId: group?.id || '',
    grupo: nomeGrupo,
    nome_grupo: nomeGrupo,
    grupo_base: extrairBaseDoNome(nomeGrupo),
    n: String(numGrupo),
    nn: String(numGrupo).padStart(2, '0'),
    numero_grupo: String(numGrupo),
    descricao_grupo: group?.topic || group?.description || '',
    topico: group?.topic || group?.description || '',
    slug_grupo: group?.slug || '',
    id_grupo: shortGroupId(group?.id || ''),
    link_grupo: group?.inviteLink || linkTag || '',
    membros: String(membros),
    capacidade: String(capacidade),
    vagas: String(vagas),
    vagas_restantes: String(vagas),
    ocupacao: `${pct}%`,
    percentual_ocupacao: String(pct),
    vagas_status: vagasStatus,
    tag: tagPrincipal?.name || extrairBaseDoNome(nomeGrupo),
    cidade: tagPrincipal?.name || extrairBaseDoNome(nomeGrupo),
    praca: tagPrincipal?.name || extrairBaseDoNome(nomeGrupo),
    tag_slug: tagPrincipal?.slug || '',
    total_grupos_tag: String(totalGruposTag),
    total_membros_tag: String(totalMembrosTag),
    link_tag: linkTag,
    link_convite: linkTag || group?.inviteLink || '',
    campanha: extras.campaign || '',
    instancia: group?.instanceName || '',
    id_curto: randomBytes(2).toString('hex').toUpperCase(),
    ...tempo
  };
}

/**
 * Substitui Spintax {opcao1|opcao2} e variaveis {chave} em uma string,
 * alem de anexar ?grupid= em links /l/ rastreados.
 */
function resolverTextoVariaveis(texto, ctx = {}) {
  if (!texto || typeof texto !== 'string') return texto;

  // 1. Spintax: {opção 1|opção 2|opção 3}
  let out = texto.replace(/\{([^{}|]+\|[^{}]+)\}/g, (_match, opcoesRaw) => {
    const opcoes = opcoesRaw.split('|').map((s) => s.trim()).filter(Boolean);
    if (!opcoes.length) return '';
    return opcoes[Math.floor(Math.random() * opcoes.length)];
  });

  // 2. Variaveis nomeadas {chave}
  out = out.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, rawKey) => {
    const key = String(rawKey).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(ctx, key) && ctx[key] !== undefined && ctx[key] !== null) {
      return String(ctx[key]);
    }
    return match;
  });

  // 3. Anexa ?grupid= automaticamente nos links encurtados /l/[code]
  if (ctx.groupId) {
    out = appendGroupIdToTrackedLinks(out, ctx.groupId);
  }

  return out;
}

/**
 * Aplica resolucao de variaveis e ?grupid= em todo o objeto `content` de um agendamento.
 */
function resolverConteudoAgendamento(type, content, ctx = {}) {
  if (!content || typeof content !== 'object') return content;
  const clone = JSON.parse(JSON.stringify(content));

  if (type === 'text') {
    if (typeof clone.text === 'string') {
      clone.text = resolverTextoVariaveis(clone.text, ctx);
    }
  } else if (type === 'media') {
    if (typeof clone.caption === 'string') {
      clone.caption = resolverTextoVariaveis(clone.caption, ctx);
    }
  } else if (type === 'button') {
    if (typeof clone.title === 'string') clone.title = resolverTextoVariaveis(clone.title, ctx);
    if (typeof clone.description === 'string') clone.description = resolverTextoVariaveis(clone.description, ctx);
    if (typeof clone.footer === 'string') clone.footer = resolverTextoVariaveis(clone.footer, ctx);
    if (Array.isArray(clone.buttons)) {
      clone.buttons = clone.buttons.map((b) => ({
        ...b,
        ...(typeof b.displayText === 'string' ? { displayText: resolverTextoVariaveis(b.displayText, ctx) } : {}),
        ...(typeof b.title === 'string' ? { title: resolverTextoVariaveis(b.title, ctx) } : {}),
        ...(typeof b.text === 'string' ? { text: resolverTextoVariaveis(b.text, ctx) } : {}),
        ...(typeof b.url === 'string' ? { url: resolverTextoVariaveis(b.url, ctx) } : {}),
        ...(typeof b.copyCode === 'string' ? { copyCode: resolverTextoVariaveis(b.copyCode, ctx) } : {})
      }));
    }
  } else if (type === 'poll') {
    if (typeof clone.name === 'string') clone.name = resolverTextoVariaveis(clone.name, ctx);
    if (Array.isArray(clone.values)) {
      clone.values = clone.values.map((v) =>
        typeof v === 'string' ? resolverTextoVariaveis(v, ctx) : v
      );
    }
  } else if (type === 'profile') {
    if (typeof clone.name === 'string') clone.name = resolverTextoVariaveis(clone.name, ctx);
    if (typeof clone.description === 'string') clone.description = resolverTextoVariaveis(clone.description, ctx);
  }

  return clone;
}

module.exports = {
  CATALOGO_VARIAVEIS,
  montarContextoGrupo,
  resolverTextoVariaveis,
  resolverConteudoAgendamento,
  dadosDeTempoSP
};
