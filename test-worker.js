const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  const evolutionGroupId = "120363400142807886@g.us";
  
  const group = await prisma.group.findFirst({
    where: { evolutionGroupId }
  });

  if (!group) return;

  await prisma.schedule.deleteMany({
    where: { groupId: group.id, status: 'pending' }
  });

  const now = new Date();
  const baseData = {
    groupId: group.id,
    adjustedAt: now,
    scheduledAt: now,
    status: 'pending'
  };

  await prisma.schedule.create({ data: { ...baseData, type: 'text', content: JSON.stringify({ text: "Teste pelo Worker - Olá Grupo!" }) } });
  await prisma.schedule.create({ data: { ...baseData, type: 'media', content: JSON.stringify({ mediatype: 'image', media: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200', fileName: 'teste.jpg', caption: 'Imagem teste' }) } });
  await prisma.schedule.create({ data: { ...baseData, type: 'media', content: JSON.stringify({ mediatype: 'audio', media: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=piano-moment-9835.mp3', fileName: 'teste.mp3' }) } });
  await prisma.schedule.create({ data: { ...baseData, type: 'media', content: JSON.stringify({ mediatype: 'video', media: 'https://www.w3schools.com/html/mov_bbb.mp4', fileName: 'video.mp4', caption: 'Vídeo teste' }) } });
  await prisma.schedule.create({ data: { ...baseData, type: 'poll', content: JSON.stringify({ name: "Vocês estão gostando do sistema?", selectableCount: 1, values: ["Sim", "Não", "Talvez"] }) } });
  await prisma.schedule.create({ data: { ...baseData, type: 'button', content: JSON.stringify({ title: "Alerta do Sistema", description: "Teste de botões Evolution API", footer: "Equipe Alfa", buttons: [{ type: 'reply', reply: { id: 'b1', title: 'Entendi' } }] }) } });

  console.log("6 Agendamentos inseridos!");
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
