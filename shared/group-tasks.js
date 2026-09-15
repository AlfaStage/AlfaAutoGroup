/**
 * Executor de tarefas de grupo (permissoes e perfil).
 *
 * Vive fora de src/ de proposito: e usado tanto pelas rotas do Next quanto
 * pelo worker.js, que roda em outro container e nao enxerga a pasta src.
 *
 * A regra central e "so mexe se precisar": antes de aplicar qualquer coisa,
 * le o estado atual do grupo na Evolution e descarta o que ja esta como
 * pedido. Depois de aplicar, le de novo para confirmar que pegou.
 */

const { readFile } = require('fs/promises');
const { join } = require('path');

const apiUrl = () => process.env.EVOLUTION_API_URL || '';
const globalKey = () => process.env.EVOLUTION_API_KEY || '';

// ---------------------------------------------------------------- Evolution

const tokenCache = new Map();
const TOKEN_TTL_MS = 5 * 60 * 1000;

async function getInstanceToken(instanceName) {
  const hit = tokenCache.get(instanceName);
  if (hit && Date.now() - hit.at < TOKEN_TTL_MS) return hit.token;

  const res = await fetch(`${apiUrl()}/instance/all`, {
    headers: { apikey: globalKey() }
  });
  if (!res.ok) return null;

  const body = await res.json().catch(() => null);
  const list = Array.isArray(body) ? body : (body && body.data) || [];
  const found = list.find(
    (i) => (i.name || (i.instance && i.instance.instanceName)) === instanceName
  );

  const token = (found && found.token) || null;
  if (token) tokenCache.set(instanceName, { token, at: Date.now() });
  return token;
}

async function evoCall(path, options) {
  const { method = 'GET', body, token } = options;

  const headers = { apikey: token };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const init = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);

  const res = await fetch(`${apiUrl()}${path}`, init);

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (e) {
    // resposta nao e JSON
  }
  return { ok: res.ok, status: res.status, data, text };
}

/** Estado atual do grupo, normalizado nos mesmos nomes que usamos no banco. */
async function fetchGroupState(token, groupJid) {
  const r = await evoCall('/group/info', {
    method: 'POST',
    token,
    body: { groupJid }
  });
  if (!r.ok) return null;

  const g = (r.data && r.data.data) || r.data || {};
  return {
    name: g.Name || '',
    topic: g.Topic || '',
    isAnnounce: Boolean(g.IsAnnounce),
    isLocked: Boolean(g.IsLocked),
    isApprovalRequired: Boolean(g.IsJoinApprovalRequired),
    adminOnlyAdd: String(g.MemberAddMode || '').toLowerCase() === 'admin_add'
  };
}

// -------------------------------------------------------------- Permissoes

/** Cada acao da Evolution e o estado que ela produz. */
const ACTION_TARGET = {
  announcement: ['isAnnounce', true],
  not_announcement: ['isAnnounce', false],
  locked: ['isLocked', true],
  unlocked: ['isLocked', false],
  approval_on: ['isApprovalRequired', true],
  approval_off: ['isApprovalRequired', false],
  admin_add: ['adminOnlyAdd', true],
  all_member_add: ['adminOnlyAdd', false]
};

const VALID_ACTIONS = Object.keys(ACTION_TARGET);

const ACTION_LABEL = {
  announcement: 'somente admins falam',
  not_announcement: 'todos podem falar',
  locked: 'somente admins editam o grupo',
  unlocked: 'todos podem editar o grupo',
  approval_on: 'aprovacao para entrar ativada',
  approval_off: 'aprovacao para entrar desativada',
  admin_add: 'somente admins adicionam membros',
  all_member_add: 'todos podem adicionar membros'
};

/**
 * Separa o que precisa ser aplicado do que ja esta valendo.
 * Se o mesmo campo aparecer duas vezes, a ultima acao vence — evita que um
 * agendamento com "locked" e "unlocked" juntos fique indefinido.
 */
function planPermissions(actions, state) {
  const byField = new Map();
  for (const action of actions) {
    if (!ACTION_TARGET[action]) continue;
    const field = ACTION_TARGET[action][0];
    byField.set(field, action);
  }

  const toApply = [];
  const alreadyOk = [];

  for (const action of byField.values()) {
    const field = ACTION_TARGET[action][0];
    const target = ACTION_TARGET[action][1];
    if (state[field] === target) alreadyOk.push(action);
    else toApply.push(action);
  }

  return { toApply, alreadyOk };
}

function describeActions(actions) {
  return actions.map((a) => ACTION_LABEL[a] || a).join('; ');
}

// ------------------------------------------------------------------ Perfil

/**
 * A Evolution aceita a imagem em formatos diferentes conforme a versao.
 * Em vez de chutar, tentamos as variantes em ordem e devolvemos a que passou.
 */
async function setGroupPhoto(token, groupJid, picture, baseUrl) {
  const candidates = [];

  if (picture.startsWith('/api/uploads/')) {
    const filename = picture.split('/').pop();
    try {
      const buffer = await readFile(join(process.cwd(), 'uploads', filename));
      const b64 = buffer.toString('base64');
      candidates.push(['base64 com prefixo', 'data:image/jpeg;base64,' + b64]);
      candidates.push(['base64 puro', b64]);
    } catch (e) {
      // sem o arquivo local, sobra a URL publica
    }
    if (baseUrl) candidates.push(['url publica', baseUrl + picture]);
  } else {
    candidates.push(['url informada', picture]);
  }

  let lastError = 'nenhum formato de imagem disponivel';
  for (const entry of candidates) {
    const label = entry[0];
    const image = entry[1];
    const r = await evoCall('/group/photo', {
      method: 'POST',
      token,
      body: { groupJid, image }
    });
    if (r.ok) return { ok: true, via: label };
    lastError = label + ': ' + r.text;
  }
  return { ok: false, error: lastError };
}

/** Nome e descricao so sao enviados se realmente mudarem. */
function planProfile(payload, state) {
  const toApply = [];
  const alreadyOk = [];

  if (typeof payload.name === 'string' && payload.name.trim()) {
    if (payload.name.trim() === state.name) alreadyOk.push('nome');
    else toApply.push('nome');
  }
  if (typeof payload.description === 'string') {
    if (payload.description === state.topic) alreadyOk.push('descricao');
    else toApply.push('descricao');
  }
  // A Evolution nao expoe hash da foto, entao nao da para comparar: se veio
  // foto no pedido, ela e sempre aplicada.
  if (payload.picture) toApply.push('foto');

  return { toApply, alreadyOk };
}

// ------------------------------------------------------------------ Runner

/**
 * Executa uma tarefa. Nao grava nada — devolve o resultado para quem chamou
 * decidir o que persistir.
 *
 * Retorno: { status: 'done' | 'skipped' | 'error', applied, alreadyOk, groupData, message }
 */
async function runGroupTask(input) {
  const group = input.group;
  const kind = input.kind;
  const payload = input.payload || {};
  const baseUrl = input.baseUrl || '';

  if (!group || !group.instanceName || !group.evolutionGroupId) {
    return { status: 'error', message: 'Grupo sem vinculo com a Evolution' };
  }

  const token = await getInstanceToken(group.instanceName);
  if (!token) {
    return {
      status: 'error',
      message: 'Instancia "' + group.instanceName + '" nao encontrada'
    };
  }

  const jid = group.evolutionGroupId;
  const state = await fetchGroupState(token, jid);
  if (!state) {
    return { status: 'error', message: 'Nao consegui ler o estado atual do grupo' };
  }

  if (kind === 'permission') {
    const actions = Array.isArray(payload.actions)
      ? payload.actions
      : payload.action
        ? [payload.action]
        : [];

    const invalid = actions.filter((a) => !ACTION_TARGET[a]);
    if (invalid.length) {
      return { status: 'error', message: 'Acao invalida: ' + invalid.join(', ') };
    }
    if (!actions.length) {
      return { status: 'error', message: 'Nenhuma permissao informada' };
    }

    const plan = planPermissions(actions, state);

    if (!plan.toApply.length) {
      return {
        status: 'skipped',
        applied: [],
        alreadyOk: plan.alreadyOk,
        groupData: state,
        stateBefore: state,
        message: 'O grupo ja estava assim: ' + describeActions(plan.alreadyOk)
      };
    }

    const applied = [];
    for (const action of plan.toApply) {
      const r = await evoCall('/group/settings', {
        method: 'POST',
        token,
        body: { groupJid: jid, action }
      });
      if (!r.ok) {
        return {
          status: 'error',
          applied,
          alreadyOk: plan.alreadyOk,
          stateBefore: state,
          message: 'Falha em "' + ACTION_LABEL[action] + '": ' + r.text
        };
      }
      applied.push(action);
    }

    // Confirma que o WhatsApp aceitou de verdade.
    const after = await fetchGroupState(token, jid);
    if (after) {
      const naoPegou = applied.filter((a) => {
        const field = ACTION_TARGET[a][0];
        const target = ACTION_TARGET[a][1];
        return after[field] !== target;
      });
      if (naoPegou.length) {
        return {
          status: 'error',
          applied,
          alreadyOk: plan.alreadyOk,
          groupData: after,
          stateBefore: state,
          message:
            'A Evolution aceitou mas o grupo nao mudou: ' + describeActions(naoPegou)
        };
      }
    }

    let message = 'Aplicado: ' + describeActions(applied);
    if (plan.alreadyOk.length) {
      message += ' | ja estava: ' + describeActions(plan.alreadyOk);
    }

    return {
      status: 'done',
      applied,
      alreadyOk: plan.alreadyOk,
      groupData: after || state,
      stateBefore: state,
      message
    };
  }

  if (kind === 'profile') {
    const plan = planProfile(payload, state);

    if (!plan.toApply.length) {
      return {
        status: 'skipped',
        applied: [],
        alreadyOk: plan.alreadyOk,
        groupData: state,
        stateBefore: state,
        message: 'Nada a mudar: ' + (plan.alreadyOk.join(', ') || 'pedido vazio')
      };
    }

    const applied = [];

    if (plan.toApply.includes('nome')) {
      const r = await evoCall('/group/name', {
        method: 'POST',
        token,
        body: { groupJid: jid, name: payload.name.trim() }
      });
      if (!r.ok) {
        return {
          status: 'error',
          applied,
          alreadyOk: plan.alreadyOk,
          stateBefore: state,
          message: 'Falha ao mudar o nome: ' + r.text
        };
      }
      applied.push('nome');
    }

    if (plan.toApply.includes('descricao')) {
      const r = await evoCall('/group/description', {
        method: 'POST',
        token,
        body: { groupJid: jid, description: payload.description }
      });
      if (!r.ok) {
        return {
          status: 'error',
          applied,
          alreadyOk: plan.alreadyOk,
          stateBefore: state,
          message: 'Falha ao mudar a descricao: ' + r.text
        };
      }
      applied.push('descricao');
    }

    if (plan.toApply.includes('foto')) {
      const r = await setGroupPhoto(token, jid, payload.picture, baseUrl);
      if (!r.ok) {
        return {
          status: 'error',
          applied,
          alreadyOk: plan.alreadyOk,
          stateBefore: state,
          message: 'Falha ao mudar a foto (' + r.error + ')'
        };
      }
      applied.push('foto via ' + r.via);
    }

    const after = await fetchGroupState(token, jid);

    let message = 'Aplicado: ' + applied.join(', ');
    if (plan.alreadyOk.length) {
      message += ' | ja estava: ' + plan.alreadyOk.join(', ');
    }

    return {
      status: 'done',
      applied,
      alreadyOk: plan.alreadyOk,
      groupData: after || state,
      stateBefore: state,
      message
    };
  }

  return { status: 'error', message: 'Tipo de tarefa desconhecido: ' + kind };
}

module.exports = {
  runGroupTask,
  fetchGroupState,
  getInstanceToken,
  planPermissions,
  planProfile,
  describeActions,
  VALID_ACTIONS,
  ACTION_LABEL,
  ACTION_TARGET
};
