/**
 * Motor do Automatizador de Boas-Vindas no Privado (PV).
 *
 * - Suporta regras por Grupo ou por Tag (com heranca automatica e precedencia Grupo > Tag).
 * - Mesmos 4 formatos do agendador: text, media, button, poll.
 * - Blindagem Anti-Ban: delay humanizado (ex.: 45-150s), fila escalonada contra rajadas (+25-45s),
 *   deduplicacao por cooldownDays, protecao de admins/equipe/instancias e instancia remetente opcional.
 * - Modo de Teste Seguro (isTest: true) e suporte automatico a Grupos de Teste (/teste|test/i).
 */

const variaveis = require('./variables');

const TEAM_WHITELIST_KEY = 'team_whitelist_phones';
const recentJoinLocks = new Map();

/**
 * Extrai apenas os digitos reais do numero a partir de um telefone ou JID do WhatsApp.
 * Remove sufixo de device (:2, :74) antes de extrair digitos, e ignora @lid puros.
 */
function cleanPhoneDigits(raw) {
  const str = String(raw || '').trim();
  if (!str) return '';
  if (str.endsWith('@lid') || str.endsWith('@g.us') || str.endsWith('@broadcast')) {
    return '';
  }
  const userPart = str.split('@')[0].split(':')[0];
  return userPart.replace(/\D/g, '');
}

/**
 * Identifica se um grupo e um grupo dedicado de testes pelo nome.
 */
function isTestGroupName(name) {
  return /teste|test/i.test(String(name || ''));
}

/**
 * Resolve a regra de boas-vindas ativa para um grupo (precedencia: Grupo > Tag).
 * - Se o grupo tiver regra propria e enabled=false, retorna null (override explicito).
 * - Se o grupo tiver regra propria e enabled=true, retorna ela.
 * - Se o grupo nao tiver regra propria, verifica a Tag principal do grupo.
 */
async function resolveActiveWelcomeRule(prisma, groupId) {
  if (!prisma || !groupId) return null;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      welcomeRule: true,
      tags: {
        orderBy: { position: 'asc' },
        take: 1,
        include: {
          tag: {
            include: { welcomeRule: true }
          }
        }
      }
    }
  }).catch(() => null);

  if (!group) return null;

  const primaryTagRel = group.tags?.[0] || null;
  const primaryTag = primaryTagRel?.tag || null;

  if (group.welcomeRule) {
    if (!group.welcomeRule.enabled) return null;
    return {
      rule: group.welcomeRule,
      scope: 'group',
      group,
      tag: primaryTag,
      tagId: primaryTag?.id || null
    };
  }

  if (primaryTag?.welcomeRule && primaryTag.welcomeRule.enabled) {
    return {
      rule: primaryTag.welcomeRule,
      scope: 'tag',
      group,
      tag: primaryTag,
      tagId: primaryTag.id
    };
  }

  return null;
}

/**
 * Verifica se o numero pertence a um admin global, dono de grupo, instancia conectada
 * ou Whitelist da Equipe (para nunca disparar boas-vindas automaticas para a propria equipe em grupos reais).
 * Em Grupos de Teste (/teste|test/i), permite que outra instancia ou numero privado de admin receba o disparo!
 */
async function isPhoneProtectedFromWelcome(prisma, phone, group, connectedInstancePhones = []) {
  const digits = cleanPhoneDigits(phone);
  if (!digits || digits.length < 10) return true;

  // Nunca dispara para o proprio criador/dono do grupo
  if (group?.ownerPhone && cleanPhoneDigits(group.ownerPhone) === digits) {
    return true;
  }

  // Em grupos de teste (/teste|test/i), permite testar entrando com outra instancia ou numero de admin/equipe
  if (isTestGroupName(group?.name)) {
    return false;
  }

  for (const instPhone of connectedInstancePhones) {
    if (cleanPhoneDigits(instPhone) === digits) return true;
  }

  // Verifica Whitelist da Equipe
  const setting = await prisma.setting.findUnique({
    where: { key: TEAM_WHITELIST_KEY }
  }).catch(() => null);

  if (setting?.value) {
    try {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const wPhone = cleanPhoneDigits(typeof item === 'string' ? item : item?.phone);
          if (wPhone && wPhone === digits) return true;
        }
      }
    } catch {
      /* json invalido */
    }
  }

  // Verifica se e admin ou superAdmin em qualquer grupo
  const adminMember = await prisma.groupMember.findFirst({
    where: {
      phone: digits,
      OR: [{ isAdmin: true }, { isSuperAdmin: true }]
    },
    select: { id: true }
  }).catch(() => null);

  return Boolean(adminMember);
}

/**
 * Enfileira um disparo de boas-vindas quando um novo membro entra no grupo.
 * Aplica delay humanizado e escalonamento anti-rajada no SQLite.
 */
async function enqueueWelcomeForJoin(prisma, { groupId, phone, displayName = null, connectedInstancePhones = [] }) {
  const digits = cleanPhoneDigits(phone);
  if (!digits || digits.length < 10 || digits.length > 15) {
    return { queued: false, reason: 'invalid_phone' };
  }

  const nowLock = Date.now();
  if (recentJoinLocks.size > 500) {
    for (const [k, ts] of recentJoinLocks.entries()) {
      if (nowLock - ts > 15000) recentJoinLocks.delete(k);
    }
  }
  const lockKey = `${groupId}:${digits}`;
  const lastLock = recentJoinLocks.get(lockKey) || 0;
  if (nowLock - lastLock < 15000) {
    return { queued: false, reason: 'concurrent_duplicate' };
  }
  recentJoinLocks.set(lockKey, nowLock);

  const resolved = await resolveActiveWelcomeRule(prisma, groupId);
  if (!resolved || !resolved.rule) {
    return { queued: false, reason: 'no_active_rule' };
  }

  const { rule, group, tagId } = resolved;
  const isTestGroup = isTestGroupName(group?.name);

  const isProtected = await isPhoneProtectedFromWelcome(prisma, digits, group, connectedInstancePhones);
  if (isProtected) {
    return { queued: false, reason: 'protected_team_or_admin' };
  }

  // Deduplicacao por janela de cooldown:
  // - Em grupos finais: cooldownDays (ex.: 30 dias)
  // - Em grupos de teste (/teste|test/i): 30 segundos, permitindo sair e entrar repetidas vezes para testar
  const cooldownDays = Math.max(1, Number(rule.cooldownDays ?? 30));
  const cooldownWindowMs = isTestGroup ? 30 * 1000 : cooldownDays * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - cooldownWindowMs);

  const scopeFilter = rule.tagId
    ? { tagId: rule.tagId }
    : { groupId: group.id };

  const existingDispatch = await prisma.welcomeDispatch.findFirst({
    where: {
      phone: digits,
      ...(isTestGroup ? {} : { isTest: false }),
      status: { in: ['pending', 'processing', 'sent'] },
      createdAt: { gte: cutoffDate },
      ...scopeFilter
    },
    select: { id: true, status: true }
  }).catch(() => null);

  if (existingDispatch) {
    return { queued: false, reason: 'cooldown_duplicate' };
  }

  // Calcula delay humanizado entre delayMinSec e delayMaxSec
  const minSec = Math.max(10, Number(rule.delayMinSec ?? 45));
  const maxSec = Math.max(minSec, Number(rule.delayMaxSec ?? 150));
  const randomDelayMs = (minSec + Math.floor(Math.random() * (maxSec - minSec + 1))) * 1000;

  const now = Date.now();
  let targetTimeMs = now + randomDelayMs;

  // Escalonamento anti-rajada: garante espacamento minimo de 25s a 45s apos o ultimo pendente
  const lastPending = await prisma.welcomeDispatch.findFirst({
    where: { status: 'pending' },
    orderBy: { scheduledAt: 'desc' },
    select: { scheduledAt: true }
  }).catch(() => null);

  if (lastPending?.scheduledAt) {
    const lastMs = new Date(lastPending.scheduledAt).getTime();
    const gapMs = (25 + Math.floor(Math.random() * 21)) * 1000; // 25s a 45s
    if (lastMs + gapMs > targetTimeMs) {
      targetTimeMs = lastMs + gapMs;
    }
  }

  const dispatch = await prisma.welcomeDispatch.create({
    data: {
      ruleId: rule.id,
      groupId: group.id,
      tagId: rule.tagId || tagId || null,
      phone: digits,
      displayName: displayName ? String(displayName).trim().slice(0, 80) : null,
      status: 'pending',
      scheduledAt: new Date(targetTimeMs),
      isTest: isTestGroup
    }
  });

  return { queued: true, dispatch };
}

/**
 * Monta texto rico de fallback quando o WhatsApp rejeita InteractiveMessage (/send/button) no privado (erro 473).
 */
function formatButtonFallbackText(content) {
  const partes = [];
  if (content.title && String(content.title).trim()) {
    partes.push(`*${String(content.title).trim()}*`);
  }
  if (content.description && String(content.description).trim()) {
    partes.push(String(content.description).trim());
  }
  if (Array.isArray(content.buttons) && content.buttons.length > 0) {
    const linhasBotoes = [];
    for (const b of content.buttons) {
      const tipo = String(b?.type || 'reply');
      const label = String(b?.displayText || 'Acessar').trim();
      if (tipo === 'url' && b?.url) {
        linhasBotoes.push(`👉 *${label}:*\n${String(b.url).trim()}`);
      } else if (tipo === 'copy' && b?.copyCode) {
        linhasBotoes.push(`📋 *${label}:* ${String(b.copyCode).trim()}`);
      } else if (tipo === 'call' && b?.phoneNumber) {
        linhasBotoes.push(`📞 *${label}:* ${String(b.phoneNumber).trim()}`);
      } else if (tipo === 'pix') {
        const chave = String(b?.key || b?.copyCode || '').trim();
        if (chave) linhasBotoes.push(`💠 *Pix (${label}):* ${chave}`);
      } else if (label) {
        linhasBotoes.push(`• *${label}*`);
      }
    }
    if (linhasBotoes.length > 0) {
      partes.push(linhasBotoes.join('\n\n'));
    }
  }
  if (content.footer && String(content.footer).trim()) {
    partes.push(`_${String(content.footer).trim()}_`);
  }
  return partes.join('\n\n');
}

/**
 * Monta e executa a requisicao HTTP de envio na Evolution GO para um destinatario (numero PV ou JID).
 */
async function sendEvolutionWelcomeMessage(evolutionUrl, token, recipient, type, content, urlAbsolutaDeMidia) {
  let endpoint = '';
  let payload = {};
  const resolveUrl = (u) => (typeof urlAbsolutaDeMidia === 'function' ? urlAbsolutaDeMidia(u) : u);

  if (type === 'text') {
    endpoint = '/send/text';
    payload = {
      number: recipient,
      text: content.text || '',
      delay: 1200
    };
  } else if (type === 'media') {
    endpoint = '/send/media';
    const mediaUrl = resolveUrl(content.media);
    payload = {
      number: recipient,
      type: content.mediatype || 'image',
      caption: content.caption || '',
      url: mediaUrl,
      filename: content.fileName || 'arquivo',
      delay: 1200
    };
  } else if (type === 'button') {
    endpoint = '/send/button';
    const hasCTA = Array.isArray(content.buttons) && content.buttons.some((b) => b.type !== 'reply');
    payload = {
      number: recipient,
      title: content.title || '',
      description: content.description || '',
      footer: content.footer || '',
      buttons: content.buttons || [],
      ...(!hasCTA && content.imageUrl ? { imageUrl: resolveUrl(content.imageUrl) } : {}),
      ...(!hasCTA && content.videoUrl ? { videoUrl: resolveUrl(content.videoUrl) } : {}),
      delay: 1200
    };
  } else if (type === 'poll') {
    endpoint = '/send/poll';
    payload = {
      number: recipient,
      question: content.name || '',
      options: content.values || [],
      maxAnswer: content.selectableCount || 1,
      delay: 1200
    };
  } else {
    return { ok: false, status: 400, error: `Tipo de mensagem nao suportado: ${type}` };
  }

  try {
    const res = await fetch(`${evolutionUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        apikey: token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const respText = await res.text();

    // Fallback inteligente no PV: se /send/button falhar (ex.: erro 473 do WhatsApp em chat 1-a-1),
    // entrega automaticamente como midia + legenda formatada ou texto formatado com os links clicaveis.
    if (!res.ok && type === 'button') {
      const fallbackText = formatButtonFallbackText(content);
      const mediaCandidate = content.imageUrl || content.videoUrl;
      const fbEndpoint = mediaCandidate ? '/send/media' : '/send/text';
      const fbPayload = mediaCandidate
        ? {
            number: recipient,
            type: content.videoUrl ? 'video' : 'image',
            caption: fallbackText,
            url: resolveUrl(mediaCandidate),
            filename: 'boas-vindas',
            delay: 1200
          }
        : {
            number: recipient,
            text: fallbackText,
            delay: 1200
          };

      const fbRes = await fetch(`${evolutionUrl}${fbEndpoint}`, {
        method: 'POST',
        headers: {
          apikey: token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fbPayload)
      });
      const fbRespText = await fbRes.text();
      return {
        ok: fbRes.ok,
        status: fbRes.status,
        body: fbRespText,
        fallbackUsed: fbEndpoint
      };
    }

    return {
      ok: res.ok,
      status: res.status,
      body: respText
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err?.message || String(err)
    };
  }
}

/**
 * Lista todas as instancias cadastradas na Evolution GO com status de conexao e telefone limpo.
 */
async function listarInstanciasEvolution(evolutionUrl, evolutionKey) {
  const evoUrl = evolutionUrl || process.env.EVOLUTION_API_URL || '';
  const evoKey = evolutionKey || process.env.EVOLUTION_API_KEY || '';
  if (!evoUrl || !evoKey) return [];
  try {
    const res = await fetch(`${evoUrl}/instance/all`, {
      headers: { apikey: evoKey },
      cache: 'no-store'
    });
    if (!res.ok) return [];
    const body = await res.json();
    const list = Array.isArray(body) ? body : body.data || [];
    return list
      .map((inst) => {
        const name = String(inst.name || inst.instance?.instanceName || '').trim();
        const token = String(inst.token || '').trim();
        const jid = String(inst.jid || inst.instance?.owner || '').trim();
        const phone = cleanPhoneDigits(jid);
        const connected = Boolean(inst.connected ?? inst.instance?.state === 'open');
        return { name, token, jid, phone, connected };
      })
      .filter((i) => Boolean(i.name));
  } catch {
    return [];
  }
}

/**
 * Seleciona a melhor instancia remetente CONECTADA.
 * - Se a instancia preferida (da regra ou do grupo) estiver conectada e nao for o proprio destinatario, usa ela.
 * - Se a instancia preferida estiver desconectada (ex.: sem QR lido) ou for o proprio destinatario do teste,
 *   faz fallback automatico para outra instancia conectada ativa.
 */
function selecionarInstanciaRemetenteConectada(instances, preferredName, recipientPhoneOrJid) {
  const list = Array.isArray(instances) ? instances : [];
  const connected = list.filter((i) => i.connected && i.token);
  if (connected.length === 0) return null;

  const recipientDigits = cleanPhoneDigits(recipientPhoneOrJid);
  const notSelf = recipientDigits
    ? connected.filter((i) => i.phone !== recipientDigits)
    : connected;

  if (preferredName) {
    const prefNotSelf = notSelf.find((i) => i.name === preferredName);
    if (prefNotSelf) return prefNotSelf;
  }

  if (notSelf.length > 0) {
    return notSelf[0];
  }

  return connected.find((i) => i.name === preferredName) || connected[0];
}

/**
 * Processa ate 2 envios pendentes da fila de boas-vindas por ciclo do worker (10s).
 */
async function processWelcomeQueue(prisma, instanceTokens, evolutionUrl, urlAbsolutaDeMidia) {
  if (!prisma || !evolutionUrl) return;

  const now = new Date();
  const pendingList = await prisma.welcomeDispatch.findMany({
    where: {
      status: 'pending',
      scheduledAt: { lte: now }
    },
    orderBy: { scheduledAt: 'asc' },
    take: 2,
    include: {
      rule: true,
      group: true
    }
  });

  if (pendingList.length === 0) return;

  const instances = await listarInstanciasEvolution(evolutionUrl, process.env.EVOLUTION_API_KEY);

  for (let i = 0; i < pendingList.length; i++) {
    const item = pendingList[i];

    // Se a regra foi desativada depois que entrou na fila (e nao for um disparo de teste), pula
    if (!item.isTest && (!item.rule || !item.rule.enabled)) {
      await prisma.welcomeDispatch.update({
        where: { id: item.id },
        data: {
          status: 'skipped',
          errorMessage: 'Regra desativada antes do envio'
        }
      }).catch(() => {});
      continue;
    }

    // Evita envio duplicado caso 2 webhooks simultaneos tenham enfileirado o mesmo numero
    const duplicateSent = await prisma.welcomeDispatch.findFirst({
      where: {
        id: { not: item.id },
        ruleId: item.ruleId,
        phone: item.phone,
        status: 'sent',
        sentAt: { gte: new Date(Date.now() - 30 * 1000) }
      },
      select: { id: true }
    }).catch(() => null);

    if (duplicateSent) {
      await prisma.welcomeDispatch.update({
        where: { id: item.id },
        data: {
          status: 'skipped',
          errorMessage: 'Duplicidade concorrente evitada'
        }
      }).catch(() => {});
      continue;
    }

    await prisma.welcomeDispatch.update({
      where: { id: item.id },
      data: { status: 'processing' }
    });

    const preferredSender = item.rule?.senderInstance || item.group?.instanceName || '';
    const chosenInst = selecionarInstanciaRemetenteConectada(instances, preferredSender, item.phone);
    const senderInstance = chosenInst?.name || preferredSender;
    const token = chosenInst?.token || (instanceTokens ? instanceTokens[preferredSender] : null);

    if (!senderInstance || !token) {
      await prisma.welcomeDispatch.update({
        where: { id: item.id },
        data: {
          status: 'error',
          attempts: item.attempts + 1,
          errorMessage: `Sem instancia remetente conectada para enviar (preferida: "${preferredSender || 'indefinida'}")`
        }
      });
      continue;
    }

    let rawContent = {};
    try {
      rawContent = JSON.parse(item.rule.content || '{}');
    } catch {
      rawContent = { text: String(item.rule.content || '') };
    }

    const ctx = await variaveis.montarContextoGrupo(prisma, item.group, {
      campaign: 'boas-vindas',
      memberName: item.displayName || '',
      memberPhone: item.phone || ''
    });

    const resolvedContent = variaveis.resolverConteudoAgendamento(item.rule.type, rawContent, ctx);

    const res = await sendEvolutionWelcomeMessage(
      evolutionUrl,
      token,
      item.phone,
      item.rule.type,
      resolvedContent,
      urlAbsolutaDeMidia
    );

    if (res.ok) {
      await prisma.welcomeDispatch.update({
        where: { id: item.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          attempts: item.attempts + 1,
          errorMessage: null
        }
      });
      console.log(`[Welcome] Boas-vindas enviado com sucesso via ${senderInstance} para ${item.phone} (grupo: ${item.group?.name})`);
    } else {
      const nextAttempt = item.attempts + 1;
      const shouldRetry = nextAttempt < 2 && !item.isTest;
      await prisma.welcomeDispatch.update({
        where: { id: item.id },
        data: {
          status: shouldRetry ? 'pending' : 'error',
          attempts: nextAttempt,
          ...(shouldRetry ? { scheduledAt: new Date(Date.now() + 120 * 1000) } : {}),
          errorMessage: `HTTP ${res.status}: ${(res.body || res.error || '').slice(0, 200)}`
        }
      });
      console.error(`[Welcome] Falha ao enviar boas-vindas para ${item.phone}:`, res.status, res.body || res.error);
    }

    if (i < pendingList.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

async function resolverParticipantesDoGrupoNaEvolution(instanceName, groupJid) {
  const mapa = new Map();
  const evoUrl = process.env.EVOLUTION_API_URL || '';
  if (!evoUrl || !groupJid) return mapa;

  const instances = await listarInstanciasEvolution();
  const connectedCandidates = [
    ...instances.filter((i) => i.connected && i.name === instanceName),
    ...instances.filter((i) => i.connected && i.name !== instanceName)
  ];

  for (const inst of connectedCandidates) {
    if (!inst?.token) continue;
    try {
      const res = await fetch(`${evoUrl}/group/info`, {
        method: 'POST',
        headers: {
          apikey: inst.token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ groupJid })
      });
      if (!res.ok) continue;
      const body = await res.json();
      const g = body?.data || body || {};
      const participants = Array.isArray(g.Participants)
        ? g.Participants
        : Array.isArray(g.participants)
          ? g.participants
          : [];

      if (participants.length === 0) continue;

      for (const p of participants) {
        const phone = cleanPhoneDigits(p.PhoneNumber || p.phoneNumber || p.JID || p.id || '');
        if (!phone || phone.length < 10) continue;
        const displayName =
          p.DisplayName || p.PushName || p.name || p.notify
            ? String(p.DisplayName || p.PushName || p.name || p.notify).trim()
            : null;

        const lidRaw = String(p.LID || p.lid || (String(p.JID || '').endsWith('@lid') ? p.JID : '') || '').trim();
        if (lidRaw) {
          const lidClean = lidRaw.replace(/@lid$/i, '');
          mapa.set(lidClean, { phone, displayName });
          mapa.set(`${lidClean}@lid`, { phone, displayName });
        }
        mapa.set(phone, { phone, displayName });
      }

      if (mapa.size > 0) break;
    } catch {
      /* tenta proxima instancia conectada */
    }
  }

  return mapa;
}

function extrairMovimentacoesNoGrupo(event, data) {
  if (!data || typeof data !== 'object') return null;

  const ev = String(event || '').trim();
  const isGroupEvent =
    ev === 'GroupInfo' ||
    ev === 'GROUP_INFO' ||
    ev === 'group-participants.update' ||
    ev === 'GroupParticipants' ||
    ev === 'GROUP_PARTICIPANTS_UPDATE';

  if (!isGroupEvent) return null;

  const groupJid = String(
    data.JID || data.Chat || data.GroupJid || data.groupJid || data.id || ''
  ).trim();
  if (!groupJid || !groupJid.endsWith('@g.us')) return null;

  let rawJoin = [];
  let rawLeave = [];

  if (Array.isArray(data.Join) && data.Join.length > 0) {
    rawJoin = data.Join;
  }
  if (Array.isArray(data.Leave) && data.Leave.length > 0) {
    rawLeave = data.Leave;
  }

  if (rawJoin.length === 0 && rawLeave.length === 0) {
    const action = String(data.action || data.Action || '').toLowerCase();
    const pList = data.participants || data.Participants;
    if (Array.isArray(pList)) {
      if (action === 'add' || action === 'join') rawJoin = pList;
      else if (action === 'remove' || action === 'leave') rawLeave = pList;
    }
  }

  if (rawJoin.length === 0 && rawLeave.length === 0) return null;

  const parseItem = (item) => {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed.endsWith('@lid') || /^\d{14,20}$/.test(trimmed)) {
        const lidClean = trimmed.replace(/@lid$/i, '');
        return { phone: '', displayName: null, lid: lidClean };
      }
      const phone = cleanPhoneDigits(trimmed);
      return { phone: phone.length >= 10 ? phone : '', displayName: null, lid: null };
    }
    if (item && typeof item === 'object') {
      const candidate =
        item.PhoneNumber || item.phoneNumber || item.phone || item.JID || item.jid || item.id || '';
      const phone = cleanPhoneDigits(candidate);
      const displayName = item.DisplayName || item.PushName || item.name || item.notify || null;
      const lidRaw =
        item.LID || item.lid || (String(item.JID || '').endsWith('@lid') ? item.JID : null);
      const lidClean = lidRaw ? String(lidRaw).trim().replace(/@lid$/i, '') : null;
      return {
        phone: phone.length >= 10 ? phone : '',
        displayName: displayName ? String(displayName).trim() : null,
        lid: lidClean
      };
    }
    return { phone: '', displayName: null, lid: null };
  };

  const joined = rawJoin.map(parseItem).filter((x) => Boolean(x.phone || x.lid));
  const left = rawLeave.map(parseItem).filter((x) => Boolean(x.phone || x.lid));

  if (joined.length === 0 && left.length === 0) return null;
  return { groupJid, joined, left };
}

async function handleWebhookRequest(prisma, NextResponse, request) {
  try {
    const payload = await request.json();
    const event = String(payload.event || '');
    const instanceName = String(payload.instance || payload.instanceName || '');

    const movInfo = extrairMovimentacoesNoGrupo(event, payload.data);
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
        : null;

      if (!group) {
        group = await prisma.group.findFirst({
          where: { evolutionGroupId: movInfo.groupJid }
        });
      }

      if (group) {
        let evoMap = null;
        let connectedInstancePhones = null;
        let addedCount = 0;

        for (const member of movInfo.joined) {
          let resolvedPhone = member.phone;
          let resolvedName = member.displayName;
          const lidClean = member.lid ? member.lid.replace(/@lid$/i, '') : null;

          if (!resolvedPhone && lidClean) {
            const knownInDb = await prisma.groupMember.findFirst({
              where: {
                OR: [{ lid: lidClean }, { lid: `${lidClean}@lid` }],
                phone: { not: '' }
              },
              select: { phone: true, displayName: true }
            }).catch(() => null);

            if (knownInDb?.phone) {
              resolvedPhone = cleanPhoneDigits(knownInDb.phone);
              if (!resolvedName && knownInDb.displayName) {
                resolvedName = knownInDb.displayName;
              }
            }
          }

          if (!resolvedPhone && lidClean) {
            if (!evoMap) {
              evoMap = await resolverParticipantesDoGrupoNaEvolution(
                group.instanceName,
                movInfo.groupJid
              );
            }
            const fromEvo = evoMap.get(lidClean) || evoMap.get(`${lidClean}@lid`);
            if (fromEvo?.phone) {
              resolvedPhone = fromEvo.phone;
              if (!resolvedName && fromEvo.displayName) {
                resolvedName = fromEvo.displayName;
              }
            }
          }

          if (!resolvedPhone || resolvedPhone.length < 10) {
            console.warn(
              `[Webhook] Nao foi possivel resolver telefone para entrada no grupo ${group.name} (lid=${lidClean})`
            );
            continue;
          }

          const existing = await prisma.groupMember.findFirst({
            where: { groupId: group.id, phone: resolvedPhone },
            select: { id: true, displayName: true }
          });

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
            }).catch(() => {});
            addedCount++;
          } else if (lidClean || resolvedName) {
            await prisma.groupMember.update({
              where: { id: existing.id },
              data: {
                ...(lidClean ? { lid: lidClean } : {}),
                ...(resolvedName ? { displayName: resolvedName } : {})
              }
            }).catch(() => {});
          }

          if (!connectedInstancePhones) {
            const insts = await listarInstanciasEvolution();
            connectedInstancePhones = insts.map((i) => i.phone).filter(Boolean);
          }

          const eqResult = await enqueueWelcomeForJoin(prisma, {
            groupId: group.id,
            phone: resolvedPhone,
            displayName: resolvedName || existing?.displayName || null,
            connectedInstancePhones
          }).catch((err) => {
            console.error('[Webhook] Erro ao enfileirar boas-vindas:', err);
            return null;
          });

          if (eqResult) {
            console.log(
              `[Webhook] Entrada detectada em "${group.name}" (${resolvedPhone}): queued=${eqResult.queued} (${eqResult.reason || 'ok'})`
            );
          }
        }

        let removedCount = 0;
        for (const leftMember of movInfo.left) {
          const lidClean = leftMember.lid ? leftMember.lid.replace(/@lid$/i, '') : null;
          const del = await prisma.groupMember.deleteMany({
            where: {
              groupId: group.id,
              OR: [
                ...(leftMember.phone ? [{ phone: leftMember.phone }] : []),
                ...(lidClean ? [{ lid: lidClean }, { lid: `${lidClean}@lid` }] : [])
              ]
            }
          }).catch(() => ({ count: 0 }));
          removedCount += del.count || 0;
        }

        if (addedCount > 0 || removedCount > 0) {
          const nextCount = Math.max(0, (group.participantCount || 0) + addedCount - removedCount);
          await prisma.group.update({
            where: { id: group.id },
            data: { participantCount: nextCount }
          }).catch(() => {});
        }
      }

      return NextResponse.json({ received: true });
    }

    if (event === 'Message') {
      const data = payload.data;
      if (!data || !data.Info || !data.Message) {
        return NextResponse.json({ received: true });
      }

      const remoteJid = data.Info.Chat;
      const fromMe = data.Info.IsFromMe;
      const participant = data.Info.PushName || data.Info.Sender || remoteJid;

      let textContent = '';
      if (data.Message.conversation) textContent = data.Message.conversation;
      else if (data.Message.extendedTextMessage?.text) textContent = data.Message.extendedTextMessage.text;
      else if (data.Info.MediaType === 'image' || data.Message.imageMessage) textContent = '[Imagem]';
      else if (data.Info.MediaType === 'video' || data.Message.videoMessage) textContent = '[Vídeo]';
      else if (data.Info.MediaType === 'audio' || data.Message.audioMessage) textContent = '[Áudio]';
      else if (data.Info.MediaType === 'document' || data.Message.documentMessage) textContent = '[Documento]';
      else if (data.Message.buttonsResponseMessage) textContent = `[Botão] ${data.Message.buttonsResponseMessage.selectedDisplayText}`;
      else if (data.Message.pollCreationMessage) textContent = `[Enquete] ${data.Message.pollCreationMessage.name}`;
      else if (data.Message.pollUpdateMessage) textContent = `[Enquete - Voto]`;
      else textContent = '[Mídia/Outro]';

      if (!textContent) {
        return NextResponse.json({ received: true });
      }

      const group = await prisma.group.findUnique({
        where: {
          instanceName_evolutionGroupId: {
            instanceName,
            evolutionGroupId: remoteJid
          }
        }
      });

      if (group) {
        await prisma.message.create({
          data: {
            groupId: group.id,
            sender: fromMe ? 'Sistema/Você' : participant,
            content: textContent
          }
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

module.exports = {
  cleanPhoneDigits,
  isTestGroupName,
  resolveActiveWelcomeRule,
  isPhoneProtectedFromWelcome,
  enqueueWelcomeForJoin,
  formatButtonFallbackText,
  sendEvolutionWelcomeMessage,
  listarInstanciasEvolution,
  selecionarInstanciaRemetenteConectada,
  processWelcomeQueue,
  extrairMovimentacoesNoGrupo,
  handleWebhookRequest
};
