const { PrismaClient } = require('@prisma/client');
const { runGroupTask } = require('./shared/group-tasks');
const ops = require('./shared/ops');
const capacidade = require('./shared/capacity');
const relatorio = require('./shared/report');
const prisma = new PrismaClient();
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

let isProcessing = false;

/** Recorte do estado do grupo que vale a pena guardar no historico. */
function snapshotTexto(st) {
  if (!st) return null;
  return {
    name: st.name || '',
    topic: st.topic || '',
    isAnnounce: Boolean(st.isAnnounce),
    isLocked: Boolean(st.isLocked),
    isApprovalRequired: Boolean(st.isApprovalRequired),
    adminOnlyAdd: Boolean(st.adminOnlyAdd)
  };
}

/**
 * A Evolution baixa a midia pela URL, entao ela precisa ser absoluta.
 * O painel ja manda absoluta; quem usa a API ou o MCP recebe o caminho
 * relativo de /api/upload, e e aqui que ele vira endereco completo.
 */
function urlAbsolutaDeMidia(valor) {
  const v = String(valor || '');
  if (!v || /^https?:\/\//i.test(v) || v.startsWith('data:')) return v;

  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
  if (!base) return v;
  return v.startsWith('/') ? base + v : base + '/' + v;
}

// Espera crescente entre tentativas: 2min, 10min, 30min.
const TASK_BACKOFF_MIN = [2, 10, 30];
const TASK_MAX_ATTEMPTS = 3;

/**
 * Executa um agendamento de mudanca de grupo (permissao ou perfil).
 * O runGroupTask le o estado atual antes de aplicar: se o grupo ja estiver
 * como pedido, nada e enviado ao WhatsApp e o agendamento fecha como
 * "skipped". Depois de aplicar, ele relê para confirmar que pegou.
 */
async function runGroupSchedule(schedule, content) {
  const attempt = (schedule.attempts || 0) + 1;

  let result;
  try {
    result = await runGroupTask({
      group: schedule.group,
      kind: schedule.type,
      payload: content,
      baseUrl: process.env.NEXT_PUBLIC_APP_URL || ''
    });
  } catch (e) {
    result = { status: 'error', message: String((e && e.message) || e) };
  }

  // Falha transitoria: reagenda em vez de dar o agendamento por perdido.
  if (result.status === 'error' && attempt < TASK_MAX_ATTEMPTS) {
    const minutos = TASK_BACKOFF_MIN[attempt - 1] || 30;
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        status: 'pending',
        attempts: attempt,
        adjustedAt: new Date(Date.now() + minutos * 60 * 1000),
        errorMessage: `tentativa ${attempt}: ${result.message}`
      }
    });
    console.log(`[Worker] Agendamento ${schedule.id} falhou (${result.message}). Nova tentativa em ${minutos}min.`);
    return;
  }

  await prisma.schedule.update({
    where: { id: schedule.id },
    data: {
      status: result.status === 'done' ? 'sent' : result.status, // sent | skipped | error
      attempts: attempt,
      appliedInfo: JSON.stringify({
        applied: result.applied || [],
        alreadyOk: result.alreadyOk || [],
        message: result.message || '',
        // Antes/depois para o painel mostrar o que mudou de fato.
        // A foto nao entra: so guardamos texto.
        before: snapshotTexto(result.stateBefore),
        after: snapshotTexto(result.groupData)
      }),
      skipReason: result.status === 'skipped' ? result.message : null,
      errorMessage: result.status === 'error' ? result.message : null
    }
  });

  // Espelha no banco local o estado que a Evolution confirmou.
  if (result.groupData) {
    try {
      await prisma.group.update({
        where: { id: schedule.groupId },
        data: {
          isAnnounce: Boolean(result.groupData.isAnnounce),
          isLocked: Boolean(result.groupData.isLocked),
          isApprovalRequired: Boolean(result.groupData.isApprovalRequired),
          adminOnlyAdd: Boolean(result.groupData.adminOnlyAdd),
          ...(result.groupData.name ? { name: result.groupData.name } : {}),
          ...(typeof result.groupData.topic === 'string'
            ? { topic: result.groupData.topic, description: result.groupData.topic }
            : {})
        }
      });
    } catch (e) {
      console.error('[Worker] Falha ao espelhar estado do grupo', e);
    }
  }

  console.log(`[Worker] Agendamento ${schedule.id} (${schedule.type}) -> ${result.status}: ${result.message}`);
}

async function processSchedules() {
  if (isProcessing) return;
  isProcessing = true;
  try {
    const now = new Date();
    // 1. Identificar grupos que possuem agendamentos com erro
    const errorGroups = await prisma.schedule.findMany({
      where: { status: 'error' },
      select: { groupId: true },
      distinct: ['groupId']
    });
    const errorGroupIds = errorGroups.map(e => e.groupId);

    // 2. Buscar agendamentos pendentes apenas de grupos SEM erro
    const pendingSchedules = await prisma.schedule.findMany({
      where: {
        status: 'pending',
        adjustedAt: { lte: now },
        ...(errorGroupIds.length > 0 ? { groupId: { notIn: errorGroupIds } } : {})
      },
      include: {
        group: true
      }
    });

    if (pendingSchedules.length === 0) return;

    // Fetch instances to get tokens
    let instanceTokens = {};
    if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
      try {
        const res = await fetch(`${EVOLUTION_API_URL}/instance/all`, {
          headers: { 'apikey': EVOLUTION_API_KEY }
        });
        if (res.ok) {
          const respData = await res.json();
          const data = Array.isArray(respData) ? respData : (respData.data || []);
          for (const inst of data) {
             const name = inst.instance?.instanceName || inst.name;
             if (name) {
               instanceTokens[name] = inst.token;
             }
          }
        }
      } catch (err) {
        console.error('[Worker] Error fetching instances', err);
      }
    }

    for (const schedule of pendingSchedules) {
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: { status: 'processing' }
      });

      const evolutionGroupId = schedule.group.evolutionGroupId;
      const instanceName = schedule.group.instanceName;
      if (!evolutionGroupId || !instanceName) continue;

      const token = instanceTokens[instanceName];
      if (!token) {
        console.error(`[Worker] Token not found for instance ${instanceName}`);
        continue;
      }

      const content = JSON.parse(schedule.content);

      // Permissao e perfil nao sao mensagens: vao para o executor de grupo,
      // que confere o estado atual antes de mexer em qualquer coisa.
      if (schedule.type === 'permission' || schedule.type === 'profile') {
        await runGroupSchedule(schedule, content);
        continue;
      }

      let endpoint = '';
      let payload = {};

      if (schedule.type === 'text') {
        endpoint = `/send/text`;
        payload = {
          number: evolutionGroupId,
          text: content.text,
          mentionAll: Boolean(content.mentionAll),
          delay: 1200
        };
      } else if (schedule.type === 'media') {
        endpoint = `/send/media`;
        payload = {
          number: evolutionGroupId,
          type: content.mediatype || 'image',
          caption: content.caption || '',
          url: urlAbsolutaDeMidia(content.media),
          filename: content.fileName || 'file.mp4',
          mentionAll: Boolean(content.mentionAll),
          delay: 1200
        };
      } else if (schedule.type === 'button') {
        endpoint = `/send/button`;
        
        // Formatar botões garantindo que usem displayText e suporte completo aos tipos
        const formattedButtons = (content.buttons || []).map(b => ({
          type: b.type || 'reply',
          displayText: b.displayText || b.title || b.text || (b.reply && b.reply.title) || 'Opção',
          id: b.id || (b.reply && b.reply.id) || 'btn-' + Math.random().toString(36).substr(2, 5),
          ...(b.type === 'url' ? { url: b.url || 'https://google.com' } : {}),
          ...(b.type === 'call' ? { phoneNumber: b.phoneNumber || b.phone || '' } : {}),
          ...(b.type === 'copy' ? { copyCode: b.copyCode || b.code || '' } : {})
        }));

        if (formattedButtons.length === 0) {
          formattedButtons.push({ type: 'reply', displayText: 'Sim', id: 'btn1' });
        }

        const hasCTA = formattedButtons.some(b => b.type !== 'reply');

        payload = {
          number: evolutionGroupId,
          mentionAll: Boolean(content.mentionAll),
          title: content.title || 'Opção',
          description: content.description || 'Escolha uma opção',
          footer: content.footer || 'Rodapé',
          buttons: formattedButtons,
          delay: 1200
        };

        // Adicionar suporte a botões com imagem ou vídeo apenas se NÃO houver CTA
        if (!hasCTA) {
          if (content.imageUrl || (content.media && content.mediatype === 'image')) {
            payload.imageUrl = urlAbsolutaDeMidia(content.imageUrl || content.media);
          } else if (content.videoUrl || (content.media && content.mediatype === 'video')) {
            payload.videoUrl = urlAbsolutaDeMidia(content.videoUrl || content.media);
          }
        }
      } else if (schedule.type === 'poll') {
        endpoint = `/send/poll`;
        
        let pollOptions = [];
        if (Array.isArray(content.values)) {
          pollOptions = content.values.map(v => typeof v === 'string' ? v : (v.name || v.text || JSON.stringify(v)));
        } else {
          pollOptions = ['Sim', 'Não'];
        }

        payload = {
          number: evolutionGroupId,
          question: content.name || 'Enquete',
          maxAnswer: parseInt(content.selectableCount, 10) || 1,
          options: pollOptions,
          mentionAll: Boolean(content.mentionAll),
          delay: 1200
        };
      }
      // Send to Evolution GO API
      if (EVOLUTION_API_URL && endpoint) {
        try {
          const res = await fetch(`${EVOLUTION_API_URL}${endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': token
            },
            body: JSON.stringify(payload)
          });
          
          if (res.ok) {
            let data = {};
            try { data = await res.json(); } catch (e) {}
            await prisma.schedule.update({
              where: { id: schedule.id },
              data: {
                status: 'sent',
                // A Evolution devolve {data:{Info:{ID}}}; as demais formas ficam de reserva
                evolutionMessageId: ops.extrairIdMensagem(data)
              }
            });
            console.log(`[Worker] Enviado agendamento ${schedule.id} para grupo ${evolutionGroupId}`);
          } else {
            const errText = await res.text();
            console.error(`[Worker] Erro ao enviar agendamento ${schedule.id}:`, errText);
            await prisma.schedule.update({
              where: { id: schedule.id },
              data: {
                status: 'error',
                errorMessage: errText.substring(0, 500)
              }
            });
          }
        } catch (apiErr) {
          console.error(`[Worker] Falha na requisição para agendamento ${schedule.id}:`, apiErr);
          await prisma.schedule.update({
            where: { id: schedule.id },
            data: {
              status: 'error',
              errorMessage: (apiErr.message || String(apiErr)).substring(0, 500)
            }
          });
        }
      }
    }
  } catch (error) {
    console.error('[Worker] Erro ao processar agendamentos:', error);
  } finally {
    isProcessing = false;
  }
}

const fs = require('fs');
const path = require('path');

function cleanOldUploads() {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) return;

  const files = fs.readdirSync(uploadsDir);
  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  files.forEach(file => {
    const filePath = path.join(uploadsDir, file);
    try {
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > SEVEN_DAYS_MS) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    } catch (e) {
      console.error(`[Worker] Erro ao verificar arquivo ${file}:`, e);
    }
  });

  if (deletedCount > 0) {
    console.log(`[Worker] Limpeza concluída: ${deletedCount} arquivos antigos de mídia removidos.`);
  }
}

let lastSyncDate = null;

async function dailySync() {
  try {
    const now = new Date();
    // Run at midnight (between 00:00 and 00:59) only once per day
    if (now.getHours() === 0 && lastSyncDate !== now.getDate()) {
      console.log('[Worker] Iniciando rotinas diárias (Sincronização e Limpeza)...');
      lastSyncDate = now.getDate();
      
      // Limpar uploads antigos
      cleanOldUploads();

      if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) return;

      // 1. Fetch all instances
      const res = await fetch(`${EVOLUTION_API_URL}/instance/all`, {
        headers: { 'apikey': EVOLUTION_API_KEY }
      });
      if (!res.ok) return;
      const respData = await res.json();
      const instances = Array.isArray(respData) ? respData : (respData.data || []);

      for (const inst of instances) {
        const name = inst.instance?.instanceName || inst.name;
        const token = inst.token || (inst.Auth && inst.Auth.token);
        if (!name || !token) continue;

        // 2. Configurar Webhook apenas se estiver em produção
        if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_APP_URL) {
          try {
            const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook`;
            console.log(`[Worker] Configurando webhook para instância ${name}: ${webhookUrl}`);
            
            await fetch(`${EVOLUTION_API_URL}/instance/connect`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY,
                'instanceName': name
              },
              body: JSON.stringify({
                instanceName: name,
                webhookUrl: webhookUrl,
                subscribe: ["MESSAGE"],
                immediate: true
              })
            });
          } catch (e) {
            console.error(`[Worker] Erro ao configurar webhook da instância ${name}`, e);
          }
        }

        // 3. Sincronizar Grupos
        try {
          console.log(`[Worker] Sincronizando grupos da instância ${name}...`);
          const groupsRes = await fetch(`${EVOLUTION_API_URL}/group/list?instanceName=${name}`, {
            headers: { 'apikey': token }
          });
          
          if (groupsRes.ok) {
            const groupsData = await groupsRes.json();
            const fetchedGroups = Array.isArray(groupsData) ? groupsData : [];
            
            for (const g of fetchedGroups) {
              const id = g.id || g.jid || g.JID;
              const subject = g.subject || g.name || g.Name;
              if (!id || !subject) continue;

              const group = await prisma.group.upsert({
                where: { evolutionGroupId: id },
                update: {
                  name: subject,
                  description: g.desc || g.Description || '',
                  instanceName: name
                },
                create: {
                  evolutionGroupId: id,
                  name: subject,
                  description: g.desc || g.Description || '',
                  slug: id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15) + Math.floor(Math.random()*1000),
                  instanceName: name
                }
              });
              
              // Sincronizar membros
              const participants = g.participants || g.Participants || [];
              if (Array.isArray(participants) && participants.length > 0) {
                await prisma.groupMember.deleteMany({
                  where: { groupId: group.id }
                });

                const membersData = participants.map(p => ({
                  groupId: group.id,
                  phone: p.id || p.jid || p.JID || p.PhoneNumber || 'unknown',
                  role: p.admin || p.isAdmin || p.IsAdmin ? 'admin' : 'participant'
                }));

                await prisma.groupMember.createMany({
                  data: membersData
                });
              }
            }
          }
        } catch (e) {
          console.error(`[Worker] Erro ao sincronizar grupos de ${name}`, e);
        }
      }

      console.log('[Worker] Rotinas diárias concluídas com sucesso!');
    }
  } catch (err) {
    console.error('[Worker] Erro nas rotinas diárias:', err);
  }
}

/**
 * Avisa no grupo de gestao sobre agendamentos que acabaram em erro e ainda
 * nao foram comunicados. Roda junto do laco normal, entao o aviso sai em
 * ate 10 segundos depois da falha.
 */
async function avisarErrosPendentes() {
  try {
    const comErro = await prisma.schedule.findMany({
      where: { status: 'error' },
      include: { group: true },
      orderBy: { updatedAt: 'desc' },
      take: 20
    });

    for (const s of comErro) {
      await ops.alertarErroDeAgendamento(prisma, s, s.group);
    }
  } catch (e) {
    console.error('[Worker] Erro ao avisar falhas:', e);
  }
}

/** Guarda a contagem de membros do dia, base do "quantas pessoas entraram". */
async function registrarSnapshotDiario() {
  try {
    const hoje = ops.hojeSP();
    const grupos = await prisma.group.findMany({
      select: { id: true, participantCount: true }
    });

    for (const g of grupos) {
      await prisma.groupDailySnapshot.upsert({
        where: { groupId_date: { groupId: g.id, date: hoje } },
        update: { memberCount: g.participantCount || 0 },
        create: { groupId: g.id, date: hoje, memberCount: g.participantCount || 0 }
      });
    }
  } catch (e) {
    console.error('[Worker] Erro ao gravar snapshot diario:', e);
  }
}

let ultimoRelatorio = null;

/**
 * Relatorio diario as 23:59 no fuso de Sao Paulo.
 * O AlertLog garante que sai uma vez por dia mesmo se o worker reiniciar.
 */
async function relatorioDiario() {
  try {
    const ligado = await ops.lerAjuste(prisma, ops.CHAVE_RELATORIO_ON, 'true');
    if (ligado !== 'true') return;

    const { h, m } = ops.agoraSP();
    if (h !== 23 || m < 59) return;

    const hoje = ops.hojeSP();
    if (ultimoRelatorio === hoje) return;

    const jaEnviado = await prisma.alertLog.findUnique({
      where: { kind_refId: { kind: 'daily_report', refId: hoje } }
    }).catch(() => null);
    if (jaEnviado) { ultimoRelatorio = hoje; return; }

    const destino = await ops.grupoDeAlerta(prisma);
    if (!destino) return;

    // Garante que o snapshot do dia existe antes de calcular o crescimento
    await registrarSnapshotDiario();

    const rel = await relatorio.montarRelatorio(prisma, hoje);
    const texto = relatorio.resumoTexto(rel);

    const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
    const enviado = await ops.enviarParaGrupo(
      destino,
      texto,
      base
        ? { displayText: 'Ver relatório completo', url: `${base}/relatorios/${hoje}`, title: 'Relatório diário' }
        : null
    );

    if (enviado.ok) {
      ultimoRelatorio = hoje;
      await prisma.alertLog.create({
        data: { kind: 'daily_report', refId: hoje, detail: `${rel.totais.enviados} enviados` }
      }).catch(() => {});
      console.log(`[Worker] Relatorio diario de ${hoje} enviado.`);
    } else {
      console.error('[Worker] Falha ao enviar relatorio:', enviado.erro);
    }
  } catch (e) {
    console.error('[Worker] Erro no relatorio diario:', e);
  }
}

/** Cria o proximo grupo das tags cujos grupos encheram. */
async function manterVagas() {
  try {
    const eventos = await capacidade.manterVagasAbertas(prisma);
    for (const e of eventos) {
      if (e.ok) console.log(`[Worker] Tag ${e.tag}: grupo "${e.nome}" criado com ${e.copiados} agendamento(s).`);
      else console.error(`[Worker] Tag ${e.tag}: ${e.erro}`);
    }
  } catch (e) {
    console.error('[Worker] Erro ao manter vagas:', e);
  }
}

// Run every 10 seconds
setInterval(() => {
  processSchedules();
  avisarErrosPendentes();
  relatorioDiario();
  dailySync();
}, 10000);
console.log('[Worker] Iniciado com sucesso. Verificando agendamentos...');
processSchedules();
avisarErrosPendentes();
registrarSnapshotDiario();
dailySync();

// Rotinas mais lentas: lotacao das tags e contagem diaria de membros.
setInterval(() => {
  manterVagas();
  registrarSnapshotDiario();
}, 5 * 60 * 1000);
manterVagas();
