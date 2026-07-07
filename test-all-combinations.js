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

  // T1: Text Message
  await prisma.schedule.create({ data: { ...baseData, type: 'text', content: JSON.stringify({ text: "1. Mensagem de Texto Simples" }) } });

  // T2: Image Message
  await prisma.schedule.create({ data: { ...baseData, type: 'media', content: JSON.stringify({ mediatype: 'image', media: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200', fileName: 'teste.jpg', caption: '2. Imagem teste' }) } });

  // T3: Audio Message
  await prisma.schedule.create({ data: { ...baseData, type: 'media', content: JSON.stringify({ mediatype: 'audio', media: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=piano-moment-9835.mp3', fileName: 'teste.mp3' }) } });

  // T4: Video Message
  await prisma.schedule.create({ data: { ...baseData, type: 'media', content: JSON.stringify({ mediatype: 'video', media: 'https://www.w3schools.com/html/mov_bbb.mp4', fileName: 'video.mp4', caption: '4. Vídeo teste' }) } });

  // T5: Poll Simple
  await prisma.schedule.create({ data: { ...baseData, type: 'poll', content: JSON.stringify({ name: "5. Enquete Simples (1 escolha)", selectableCount: 1, values: ["Opção A", "Opção B"] }) } });

  // T6: Poll Multiple Options and Choices
  await prisma.schedule.create({ data: { ...baseData, type: 'poll', content: JSON.stringify({ name: "6. Enquete Múltipla (Múltiplas escolhas)", selectableCount: 3, values: ["Java", "Python", "JavaScript", "Go"] }) } });

  // T7: Button - 1 Reply
  await prisma.schedule.create({ data: { ...baseData, type: 'button', content: JSON.stringify({ title: "7. Botão Reply", description: "Apenas um botão", footer: "Teste 7", buttons: [{ type: 'reply', displayText: 'Sim', id: 'b1' }] }) } });

  // T8: Button - 3 Replies
  await prisma.schedule.create({ data: { ...baseData, type: 'button', content: JSON.stringify({ title: "8. Três Botões", description: "Três opções de resposta", footer: "Teste 8", buttons: [{ type: 'reply', displayText: 'Opção 1', id: 'o1' }, { type: 'reply', displayText: 'Opção 2', id: 'o2' }, { type: 'reply', displayText: 'Opção 3', id: 'o3' }] }) } });

  // T9: Button - URL + Copy (CTAs)
  await prisma.schedule.create({ data: { ...baseData, type: 'button', content: JSON.stringify({ title: "9. Botões CTA", description: "URL e Copiar", footer: "Teste 9", buttons: [{ type: 'url', displayText: 'Visitar Site', url: 'https://google.com' }, { type: 'copy', displayText: 'Copiar Código', copyCode: 'PROMO123' }] }) } });

  // T10: Button - Reply + Image
  await prisma.schedule.create({ data: { ...baseData, type: 'button', content: JSON.stringify({ title: "10. Botão com Imagem", description: "Olha a imagem em cima", footer: "Teste 10", imageUrl: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200", buttons: [{ type: 'reply', displayText: 'Legal!', id: 'img_btn' }] }) } });

  // T11: Button - Replies + Video
  await prisma.schedule.create({ data: { ...baseData, type: 'button', content: JSON.stringify({ title: "11. Botão com Vídeo", description: "Assista o vídeo", footer: "Teste 11", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4", buttons: [{ type: 'reply', displayText: 'Curti', id: 'v1' }, { type: 'reply', displayText: 'Não curti', id: 'v2' }] }) } });

  // T12: Button - Call (CTA) + Image
  await prisma.schedule.create({ data: { ...baseData, type: 'button', content: JSON.stringify({ title: "12. Botão CTA + Imagem", description: "Ligar para nós", footer: "Teste 12", imageUrl: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200", buttons: [{ type: 'call', displayText: 'Ligar', phoneNumber: '+5511999999999' }] }) } });


  console.log("12 Combinações inseridas! O worker vai disparar...");
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
