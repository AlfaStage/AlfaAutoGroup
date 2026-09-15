/**
 * Operacoes que o worker e as rotas do Next compartilham:
 * configuracao, alertas no WhatsApp, lotacao de grupos e o relatorio diario.
 *
 * Vive fora de src/ pelo mesmo motivo de shared/group-tasks.js: o worker roda
 * em outro container e nao enxerga a pasta src.
 */

const { randomBytes } = require('crypto');
const { getInstanceToken } = require('./group-tasks');

const apiUrl = () => process.env.EVOLUTION_API_URL || '';
const globalKey = () => process.env.EVOLUTION_API_KEY || '';
const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');

const FUSO = 'America/Sao_Paulo';

// ------------------------------------------------------------------- datas

/** Data de hoje no fuso de Sao Paulo, no formato YYYY-MM-DD. */
function hojeSP(base) {
  const d = base ? new Date(base) : new Date();
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d);
  const get = (t) => partes.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Hora e minuto atuais em Sao Paulo, como {h, m}. */
function agoraSP() {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date());
  const get = (t) => Number(partes.find((p) => p.type === t).value);
  return { h: get('hour'), m: get('minute') };
}

/** Inicio e fim (UTC) do dia informado, no fuso de Sao Paulo. */
function janelaDoDia(dataISO) {
  // Sao Paulo e UTC-3 o ano todo desde 2019 (sem horario de verao).
  const inicio = new Date(`${dataISO}T00:00:00-03:00`);
  const fim = new Date(`${dataISO}T23:59:59.999-03:00`);
  return { inicio, fim };
}

// ---------------------------------------------------------------- ajustes

const CHAVE_GRUPO_ALERTA = 'alertGroupId';
const CHAVE_ALERTAS_ON = 'alertsEnabled';
const CHAVE_RELATORIO_ON = 'dailyReportEnabled';

async function lerAjuste(prisma, chave, padrao = null) {
  const row = await prisma.setting.findUnique({ where: { key: chave } });
  return row ? row.value : padrao;
}

async function gravarAjuste(prisma, chave, valor) {
  return prisma.setting.upsert({
    where: { key: chave },
    update: { value: String(valor) },
    create: { key: chave, value: String(valor) }
  });
}

/** Grupo que recebe alertas e relatorios. Null = ninguem configurou ainda. */
async function grupoDeAlerta(prisma) {
  const id = await lerAjuste(prisma, CHAVE_GRUPO_ALERTA);
  if (!id) return null;
  return prisma.group.findUnique({ where: { id } });
}

// ---------------------------------------------------------------- envio

/** Envia texto para um grupo, opcionalmente com um botao de link. */
async function enviarParaGrupo(grupo, texto, botao) {
  if (!grupo || !grupo.instanceName || !grupo.evolutionGroupId) {
    return { ok: false, erro: 'grupo de alerta sem vinculo com a Evolution' };
  }

  const token = await getInstanceToken(grupo.instanceName);
  if (!token) return { ok: false, erro: 'instancia do grupo de alerta nao encontrada' };

  // Botoes de resposta rapida sao recusados pelo WhatsApp; o de link passa.
  const usarBotao = botao && botao.url && botao.displayText;

  const path = usarBotao ? '/send/button' : '/send/text';
  const body = usarBotao
    ? {
        number: grupo.evolutionGroupId,
        title: botao.title || 'AlfaAltoGrup',
        description: texto,
        footer: botao.footer || 'Painel de gestão',
        buttons: [{ type: 'url', displayText: botao.displayText, url: botao.url }],
        delay: 800
      }
    : { number: grupo.evolutionGroupId, text: texto, delay: 800 };

  try {
    const res = await fetch(`${apiUrl()}${path}`, {
      method: 'POST',
      headers: { apikey: token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const txt = await res.text();
    if (!res.ok) return { ok: false, erro: txt };

    let id = null;
    try {
      const j = JSON.parse(txt);
      id = extrairIdMensagem(j);
    } catch (e) { /* resposta nao-JSON */ }

    return { ok: true, messageId: id };
  } catch (e) {
    return { ok: false, erro: String((e && e.message) || e) };
  }
}

/**
 * Id da mensagem na resposta da Evolution.
 * O formato e {data:{Info:{ID}}} — as variantes antigas ficam de reserva.
 */
function extrairIdMensagem(resposta) {
  if (!resposta) return null;
  const d = resposta.data || resposta;
  return (
    (d.Info && d.Info.ID) ||
    (d.key && d.key.id) ||
    (d.data && d.data.Info && d.data.Info.ID) ||
    d.id ||
    null
  );
}

// ---------------------------------------------------------------- alertas

const MOTIVOS = [
  {
    teste: /reply.*n[aã]o podem ser misturados|resposta r[aá]pida/i,
    porque: 'A Evolution recusa botões de resposta rápida misturados com outros tipos.',
    comoResolver: 'Deixe só um tipo de botão na mensagem.'
  },
  {
    teste: /server returned error 405/i,
    porque: 'O WhatsApp recusou o formato da mensagem — costuma ser botão de resposta rápida em conta comum.',
    comoResolver: 'Troque por botão de link, copiar ou ligar.'
  },
  {
    teste: /not authorized|401/i,
    porque: 'A instância não autorizou a chamada.',
    comoResolver: 'Confira se a instância está conectada no painel.'
  },
  {
    teste: /not found|404/i,
    porque: 'O grupo ou a instância não foi encontrado na Evolution.',
    comoResolver: 'Sincronize os grupos no painel.'
  },
  {
    teste: /admin|forbidden|403/i,
    porque: 'A instância não é administradora do grupo.',
    comoResolver: 'Promova o número a administrador no WhatsApp.'
  },
  {
    teste: /timeout|ECONNREFUSED|fetch failed|network/i,
    porque: 'A Evolution não respondeu a tempo.',
    comoResolver: 'Verifique se a instância está conectada; o sistema tenta de novo sozinho.'
  }
];

/** Traduz a mensagem crua de erro em causa provavel e caminho de solucao. */
function explicarErro(mensagem) {
  const texto = String(mensagem || '');
  for (const m of MOTIVOS) {
    if (m.teste.test(texto)) return { porque: m.porque, comoResolver: m.comoResolver };
  }
  return {
    porque: 'A Evolution recusou a operação e devolveu o erro acima.',
    comoResolver: 'Abra o agendamento no painel para ver os detalhes e tentar de novo.'
  };
}

const ROTULO_TIPO = {
  text: 'Mensagem de texto',
  media: 'Mídia',
  button: 'Mensagem com botões',
  poll: 'Enquete',
  permission: 'Troca de permissão',
  profile: 'Edição do grupo'
};

/**
 * Avisa no grupo de gestao que um agendamento falhou.
 * Nao repete o alerta do mesmo agendamento.
 */
async function alertarErroDeAgendamento(prisma, schedule, grupoDoErro) {
  const ligado = await lerAjuste(prisma, CHAVE_ALERTAS_ON, 'true');
  if (ligado !== 'true') return { ok: false, motivo: 'alertas desligados' };

  const destino = await grupoDeAlerta(prisma);
  if (!destino) return { ok: false, motivo: 'grupo de alerta nao configurado' };

  // Nao avisa sobre um erro no proprio grupo de alerta, para nao dar ruido.
  if (destino.id === schedule.groupId) return { ok: false, motivo: 'erro no proprio grupo de alerta' };

  const jaAvisado = await prisma.alertLog.findUnique({
    where: { kind_refId: { kind: 'schedule_error', refId: schedule.id } }
  }).catch(() => null);
  if (jaAvisado) return { ok: false, motivo: 'ja avisado' };

  const explicacao = explicarErro(schedule.errorMessage);
  const quando = new Date(schedule.adjustedAt).toLocaleString('pt-BR', { timeZone: FUSO });

  const linhas = [
    '🚨 *Falha em agendamento*',
    '',
    `*Grupo:* ${grupoDoErro?.name || 'desconhecido'}`,
    `*Instância:* ${grupoDoErro?.instanceName || '—'}`,
    `*O que era:* ${ROTULO_TIPO[schedule.type] || schedule.type}`,
    `*Quando deveria sair:* ${quando}`,
    `*Tentativas:* ${schedule.attempts || 0}`,
    '',
    `*Erro:* ${String(schedule.errorMessage || '').substring(0, 300)}`,
    `*Por que aconteceu:* ${explicacao.porque}`,
    `*Como resolver:* ${explicacao.comoResolver}`,
    '',
    '⚠️ Enquanto este erro existir, os demais agendamentos deste grupo ficam parados.'
  ];

  const base = appUrl();
  const link = base && grupoDoErro?.slug
    ? `${base}/${grupoDoErro.slug}?agendamento=${schedule.id}`
    : null;

  const resultado = await enviarParaGrupo(
    destino,
    linhas.join('\n'),
    link ? { displayText: 'Resolver agora', url: link, title: 'Falha em agendamento' } : null
  );

  if (resultado.ok) {
    await prisma.alertLog.create({
      data: {
        kind: 'schedule_error',
        refId: schedule.id,
        detail: String(schedule.errorMessage || '').substring(0, 500)
      }
    }).catch(() => { /* corrida entre rodadas do worker */ });
  }

  return resultado;
}

module.exports = {
  FUSO,
  CHAVE_GRUPO_ALERTA,
  CHAVE_ALERTAS_ON,
  CHAVE_RELATORIO_ON,
  hojeSP,
  agoraSP,
  janelaDoDia,
  lerAjuste,
  gravarAjuste,
  grupoDeAlerta,
  enviarParaGrupo,
  extrairIdMensagem,
  explicarErro,
  alertarErroDeAgendamento,
  ROTULO_TIPO,
  gerarCodigoConvite: () => randomBytes(5).toString('hex')
};
