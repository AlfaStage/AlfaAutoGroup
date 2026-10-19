/**
 * Filtro anti-bot de pre-visualizacao, deduplicacao de cliques unicos,
 * atribuicao de grupo via ?grupid= e injecao automatica de UTMs.
 */

const { createHash } = require('crypto');

const BOT_UA_REGEX = /WhatsApp|facebookexternalhit|Facebot|TelegramBot|Twitterbot|Slackbot|Discordbot|LinkedInBot|Pinterest|SkypeUriPreview|Iframely|Googlebot|bingbot|crawler|spider|preview/i;

// Janela de 10 minutos para considerar cliques repetidos do mesmo dispositivo como nao-unicos.
const UNIQUE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_SIZE = 2000;
const recentClicks = new Map();

/** Retorna true se a requisicao vier de um bot gerador de preview de link ou metodo HEAD. */
function isPreviewBot(userAgent, method = 'GET') {
  if (String(method).toUpperCase() === 'HEAD') return true;
  const ua = String(userAgent || '').trim();
  if (!ua) return false;
  return BOT_UA_REGEX.test(ua);
}

/**
 * Verifica se o clique e unico na janela de 10 minutos, usando hash leve em memoria.
 * Nao armazena IP em disco (privacidade) e consome < 100 KB de RAM.
 */
function registerAndCheckUnique(targetId, groupId = '', userAgent = '', ipHint = '') {
  const now = Date.now();
  if (recentClicks.size > MAX_CACHE_SIZE) {
    for (const [k, exp] of recentClicks.entries()) {
      if (exp <= now) recentClicks.delete(k);
    }
    if (recentClicks.size > MAX_CACHE_SIZE) {
      const firstKey = recentClicks.keys().next().value;
      if (firstKey) recentClicks.delete(firstKey);
    }
  }

  const raw = `${targetId}|${groupId || ''}|${String(userAgent || '').slice(0, 120)}|${ipHint || ''}`;
  const hash = createHash('sha1').update(raw).digest('hex').slice(0, 16);
  const existingExp = recentClicks.get(hash);

  if (existingExp && existingExp > now) {
    return false;
  }

  recentClicks.set(hash, now + UNIQUE_TTL_MS);
  return true;
}

/** Hora atual (0 a 23) no fuso de Sao Paulo. */
function horaAtualSP(date = null) {
  const d = date ? new Date(date) : new Date();
  const h = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    hour12: false
  }).format(d);
  const num = parseInt(h, 10);
  return Number.isNaN(num) ? 0 : num % 24;
}

/**
 * Resolve o grupo a partir do parametro ?grupid= (ou ?groupid= / ?g=),
 * aceitando ID interno (UUID), slug ou evolutionGroupId (JID).
 */
async function resolveGroupParam(prisma, rawParam) {
  const val = String(rawParam || '').trim();
  if (!val) return null;

  return prisma.group.findFirst({
    where: {
      OR: [
        { id: val },
        { slug: val },
        { evolutionGroupId: val }
      ]
    },
    include: {
      tags: {
        include: { tag: true },
        orderBy: { position: 'asc' },
        take: 1
      }
    }
  }).catch(() => null);
}

/**
 * Anexa automaticamente ?grupid=<groupId> aos links /l/<codigo> presentes num texto
 * antes do envio pelo worker, permitindo saber exatamente de qual grupo veio cada clique.
 */
function appendGroupIdToTrackedLinks(text, groupId) {
  if (!text || !groupId || typeof text !== 'string') return text;

  return text.replace(
    /(https?:\/\/[^\s"'<>]+\/l\/[a-zA-Z0-9_-]+|\/l\/[a-zA-Z0-9_-]+)(\?[^\s"'<>]*)?/g,
    (_match, basePath, query = '') => {
      if (!query) {
        return `${basePath}?grupid=${encodeURIComponent(groupId)}`;
      }
      if (/[?&](grupid|groupid|g)=/i.test(query)) {
        const updatedQuery = query.replace(
          /([?&])(?:grupid|groupid|g)=[^&#\s"'<>]*/i,
          `$1grupid=${encodeURIComponent(groupId)}`
        );
        return `${basePath}${updatedQuery}`;
      }
      const sep = query.startsWith('?') ? '&' : '?';
      return `${basePath}${query}${sep}grupid=${encodeURIComponent(groupId)}`;
    }
  );
}

/**
 * Injeta UTMs automaticas (utm_source=whatsapp, utm_medium=grupo, utm_campaign, utm_content)
 * e resolve placeholders simples ({grupo}, {tag}) no link de destino.
 */
function enrichDestinationUrlWithUtm(destUrl, group, tag, campaign) {
  if (!destUrl || typeof destUrl !== 'string') return destUrl;

  const resolvedTag = tag || (group?.tags && group.tags[0]?.tag) || null;
  let resolved = destUrl;
  const groupName = group?.name || '';
  const groupSlug = group?.slug || '';
  const tagName = resolvedTag?.name || '';
  const tagSlug = resolvedTag?.slug || '';

  if (groupName) {
    resolved = resolved.replace(/\{grupo\}/gi, encodeURIComponent(groupName));
  }
  if (tagName) {
    resolved = resolved.replace(/\{tag\}|\{cidade\}/gi, encodeURIComponent(tagName));
  }

  try {
    const parsed = new URL(resolved);
    if (!/^https?:$/i.test(parsed.protocol)) return resolved;

    // Para links wa.me / api.whatsapp.com, preserva o funcionamento limpo
    const isWaMe = /^(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)$/i.test(parsed.hostname);
    if (isWaMe) return parsed.toString();

    if (!parsed.searchParams.has('utm_source')) {
      parsed.searchParams.set('utm_source', 'whatsapp');
    }
    if (!parsed.searchParams.has('utm_medium')) {
      parsed.searchParams.set('utm_medium', 'grupo');
    }
    if (!parsed.searchParams.has('utm_campaign') && (campaign || tagSlug || groupSlug)) {
      parsed.searchParams.set('utm_campaign', String(campaign || tagSlug || groupSlug));
    }
    if (!parsed.searchParams.has('utm_content') && (groupSlug || groupName)) {
      parsed.searchParams.set('utm_content', String(groupSlug || groupName));
    }
    if (group?.id && !parsed.searchParams.has('grupid')) {
      parsed.searchParams.set('grupid', group.id);
    }

    return parsed.toString();
  } catch (e) {
    return resolved;
  }
}

module.exports = {
  isPreviewBot,
  registerAndCheckUnique,
  horaAtualSP,
  resolveGroupParam,
  appendGroupIdToTrackedLinks,
  enrichDestinationUrlWithUtm
};
