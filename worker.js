const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

let isProcessing = false;

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

      let endpoint = '';
      let payload = {};

      const content = JSON.parse(schedule.content);

      if (schedule.type === 'text') {
        endpoint = `/send/text`;
        payload = {
          number: evolutionGroupId,
          text: content.text,
          delay: 1200
        };
      } else if (schedule.type === 'media') {
        endpoint = `/send/media`;
        payload = {
          number: evolutionGroupId,
          type: content.mediatype || 'image',
          caption: content.caption || '',
          url: content.media,
          filename: content.fileName || 'file.mp4',
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
          title: content.title || 'Opção',
          description: content.description || 'Escolha uma opção',
          footer: content.footer || 'Rodapé',
          buttons: formattedButtons,
          delay: 1200
        };

        // Adicionar suporte a botões com imagem ou vídeo apenas se NÃO houver CTA
        if (!hasCTA) {
          if (content.imageUrl || (content.media && content.mediatype === 'image')) {
            payload.imageUrl = content.imageUrl || content.media;
          } else if (content.videoUrl || (content.media && content.mediatype === 'video')) {
            payload.videoUrl = content.videoUrl || content.media;
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
                evolutionMessageId: data.key?.id || data.data?.key?.id || data.id || null
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

// Run every 10 seconds
setInterval(() => {
  processSchedules();
  dailySync();
}, 10000);
console.log('[Worker] Iniciado com sucesso. Verificando agendamentos...');
processSchedules();
dailySync();
