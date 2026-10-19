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

const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Converte o UUID do grupo (ex.: "9f4b2c1a-7e3d-...") em um codigo curto de 4 caracteres Base62 (ex.: "2xP9").
 * Reversivel para os 5 primeiros digitos hexadecimais do UUID (1.048.576 combinacoes).
 */
function shortGroupId(groupId) {
  const raw = String(groupId || '').trim();
  if (!raw) return '';
  if (raw.length <= 6) return raw;

  const hex = raw.replace(/-/g, '').slice(0, 5).toLowerCase();
  if (/^[0-9a-f]{5}$/.test(hex)) {
    let num = parseInt(hex, 16);
    let out = '';
    for (let i = 0; i < 4; i++) {
      out = BASE62[num % 62] + out;
      num = Math.floor(num / 62);
    }
    return out;
  }
  return raw.slice(0, 4);
}

/**
 * Decodifica um codigo curto Base62 de 4 caracteres de volta para o prefixo hexadecimal de 5 digitos do UUID.
 */
function decodeShortGroupPrefix(code) {
  const s = String(code || '').trim();
  if (s.length !== 4) return null;
  let num = 0;
  for (let i = 0; i < 4; i++) {
    const idx = BASE62.indexOf(s[i]);
    if (idx < 0) return null;
    num = num * 62 + idx;
  }
  if (num < 0 || num >= 0x100000) return null;
  return num.toString(16).padStart(5, '0');
}

/**
 * Resolve o grupo a partir do parametro ?grupid= (ou ?groupid= / ?g=),
 * aceitando codigo curto Base62 de 4 caracteres, prefixo hex, UUID completo, slug ou evolutionGroupId (JID).
 */
async function resolveGroupParam(prisma, rawParam) {
  const val = String(rawParam || '').trim();
  if (!val) return null;

  const orConditions = [
    { id: val },
    { slug: val },
    { evolutionGroupId: val }
  ];

  const decodedHex = decodeShortGroupPrefix(val);
  if (decodedHex) {
    orConditions.push({ id: { startsWith: decodedHex } });
  }
  if (/^[0-9a-f]{4,12}$/i.test(val)) {
    orConditions.push({ id: { startsWith: val.toLowerCase() } });
  }

  return prisma.group.findFirst({
    where: {
      OR: orConditions
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
 * Anexa automaticamente ?grupid=<shortId> (4 caracteres) aos links /l/<codigo> presentes num texto
 * antes do envio pelo worker, mantendo o link muito curto e identificando o grupo de origem.
 */
function appendGroupIdToTrackedLinks(text, groupId) {
  if (!text || !groupId || typeof text !== 'string') return text;
  const shortId = shortGroupId(groupId);
  if (!shortId) return text;

  return text.replace(
    /(https?:\/\/[^\s"'<>]+\/l\/[a-zA-Z0-9_-]+|\/l\/[a-zA-Z0-9_-]+)(\?[^\s"'<>]*)?/g,
    (_match, basePath, query = '') => {
      if (!query) {
        return `${basePath}?grupid=${encodeURIComponent(shortId)}`;
      }
      if (/[?&](grupid|groupid|g)=/i.test(query)) {
        const updatedQuery = query.replace(
          /([?&])(?:grupid|groupid|g)=[^&#\s"'<>]*/i,
          `$1grupid=${encodeURIComponent(shortId)}`
        );
        return `${basePath}${updatedQuery}`;
      }
      const sep = query.startsWith('?') ? '&' : '?';
      return `${basePath}${query}${sep}grupid=${encodeURIComponent(shortId)}`;
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
      parsed.searchParams.set('grupid', shortGroupId(group.id));
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
  shortGroupId,
  decodeShortGroupPrefix,
  resolveGroupParam,
  appendGroupIdToTrackedLinks,
  enrichDestinationUrlWithUtm
};
