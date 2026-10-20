/**
 * Motor do Automatizador de Boas-Vindas no Privado (PV).
 *
 * - Suporta regras por Grupo ou por Tag (com heranca automatica e precedencia Grupo > Tag).
 * - Mesmos 4 formatos do agendador: text, media, button, poll.
 * - Blindagem Anti-Ban: delay humanizado (ex.: 45-150s), fila escalonada contra rajadas (+25-45s),
 *   deduplicacao por cooldownDays, protecao de admins/equipe/instancias e instancia remetente opcional.
 * - Modo de Teste Seguro (isTest: true) para testar apenas entre instancias ou grupos de teste.
 */

const variaveis = require('./variables');

const TEAM_WHITELIST_KEY = 'team_whitelist_phones';

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
 * ou Whitelist da Equipe (para nunca disparar boas-vindas automaticas para a propria equipe).
 */
async function isPhoneProtectedFromWelcome(prisma, phone, group, connectedInstancePhones = []) {
  const digits = cleanPhoneDigits(phone);
  if (!digits || digits.length < 10) return true;

  if (group?.ownerPhone && cleanPhoneDigits(group.ownerPhone) === digits) {
    return true;
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

  const resolved = await resolveActiveWelcomeRule(prisma, groupId);
  if (!resolved || !resolved.rule) {
    return { queued: false, reason: 'no_active_rule' };
  }

  const { rule, group, tagId } = resolved;

  const isProtected = await isPhoneProtectedFromWelcome(prisma, digits, group, connectedInstancePhones);
  if (isProtected) {
    return { queued: false, reason: 'protected_team_or_admin' };
  }

  // Deduplicacao por janela de cooldownDays (ignorando disparos de teste isTest=true)
  const cooldownDays = Math.max(1, Number(rule.cooldownDays ?? 30));
  const cutoffDate = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);

  const scopeFilter = rule.tagId
    ? { tagId: rule.tagId }
    : { groupId: group.id };

  const existingDispatch = await prisma.welcomeDispatch.findFirst({
    where: {
      phone: digits,
      isTest: false,
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
      isTest: false
    }
  });

  return { queued: true, dispatch };
}

/**
 * Monta e executa a requisicao HTTP de envio na Evolution GO para um destinatario (numero PV ou JID).
 */
async function sendEvolutionWelcomeMessage(evolutionUrl, token, recipient, type, content, urlAbsolutaDeMidia) {
  let endpoint = '';
  let payload = {};

  if (type === 'text') {
    endpoint = '/send/text';
    payload = {
      number: recipient,
      text: content.text || '',
      delay: 1200
    };
  } else if (type === 'media') {
    endpoint = '/send/media';
    const mediaUrl = typeof urlAbsolutaDeMidia === 'function'
      ? urlAbsolutaDeMidia(content.media)
      : content.media;
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
    const resolveUrl = (u) => (typeof urlAbsolutaDeMidia === 'function' ? urlAbsolutaDeMidia(u) : u);
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

    await prisma.welcomeDispatch.update({
      where: { id: item.id },
      data: { status: 'processing' }
    });

    const senderInstance = item.rule?.senderInstance || item.group?.instanceName || '';
    const token = instanceTokens ? instanceTokens[senderInstance] : null;

    if (!senderInstance || !token) {
      await prisma.welcomeDispatch.update({
        where: { id: item.id },
        data: {
          status: 'error',
          attempts: item.attempts + 1,
          errorMessage: `Sem token ativo para instancia remetente "${senderInstance || 'indefinida'}"`
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
      console.log(`[Welcome] Boas-vindas enviado com sucesso para ${item.phone} (grupo: ${item.group?.name})`);
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

module.exports = {
  cleanPhoneDigits,
  resolveActiveWelcomeRule,
  isPhoneProtectedFromWelcome,
  enqueueWelcomeForJoin,
  sendEvolutionWelcomeMessage,
  processWelcomeQueue
};
