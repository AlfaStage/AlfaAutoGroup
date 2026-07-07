import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    
    // Evolution GO v2 payload for messages
    // event: "Message"
    // data: { Info: { Chat, Sender, PushName, IsFromMe }, Message: { conversation, ... } }
    if (payload.event === 'Message') {
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

      // Ignore empty
      if (!textContent) {
        return NextResponse.json({ received: true });
      }

      // A instância está em payload.instance ou header
      const instanceName = payload.instance || '';

      // Encontrar o grupo no banco
      const group = await prisma.group.findUnique({
        where: { 
          instanceName_evolutionGroupId: {
            instanceName: instanceName,
            evolutionGroupId: remoteJid
          }
        }
      })

      if (group) {
        // Save message
        await prisma.message.create({
          data: {
            groupId: group.id,
            sender: fromMe ? 'Sistema/Você' : participant,
            content: textContent,
          }
        })
      }
    }
    
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook Error:", error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
