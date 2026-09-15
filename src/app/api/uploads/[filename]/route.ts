import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { join, basename, extname } from 'path';

/**
 * Serve os arquivos enviados como URL publica e permanente.
 *
 * Esta rota fica fora da autenticacao (ver `publicRoutes` no middleware) de
 * proposito: quem busca o arquivo aqui e o servidor da Evolution, que nao tem
 * sessao nem chave. O nome tem timestamp + aleatorio, entao a URL nao e
 * adivinhavel.
 *
 * Precisa de mais do que `readFile`: a Evolution manda `HEAD` antes de baixar
 * video e audio, rejeita `application/octet-stream` e espera `Range` para
 * midia longa.
 */

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.3gp': 'video/3gpp', '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.opus': 'audio/ogg',
  '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav',
  '.pdf': 'application/pdf', '.txt': 'text/plain', '.csv': 'text/csv',
  '.zip': 'application/zip',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};

/** Resolve o nome para um caminho dentro de `uploads/`, ou null. */
function caminhoDe(filename: string) {
  const safeName = basename(decodeURIComponent(filename));
  if (!safeName || safeName.startsWith('.')) return null;
  return { safeName, filepath: join(process.cwd(), 'uploads', safeName) };
}

function cabecalhos(safeName: string, tamanho: number) {
  return {
    'Content-Type': MIME[extname(safeName).toLowerCase()] || 'application/octet-stream',
    'Content-Length': String(tamanho),
    // O nome ja e unico, entao o arquivo nunca muda de conteudo
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
    // A Evolution busca de outra origem
    'Access-Control-Allow-Origin': '*'
  };
}

/** A Evolution sonda o arquivo antes de baixar. Sem isto, ela desiste. */
export async function HEAD(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const alvo = caminhoDe(filename);
  if (!alvo) return new NextResponse(null, { status: 404 });

  try {
    const info = await stat(alvo.filepath);
    return new NextResponse(null, { status: 200, headers: cabecalhos(alvo.safeName, info.size) });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const alvo = caminhoDe(filename);
  if (!alvo) return new NextResponse('File not found', { status: 404 });

  try {
    const info = await stat(alvo.filepath);
    const buffer = await readFile(alvo.filepath);
    const headers = cabecalhos(alvo.safeName, info.size);

    // Download parcial: player de video e a propria Evolution pedem faixas
    const range = request.headers.get('range');
    const faixa = range && /^bytes=\d*-\d*$/.test(range) ? range.slice(6).split('-') : null;

    if (faixa) {
      const inicio = faixa[0] ? parseInt(faixa[0], 10) : 0;
      const fim = faixa[1] ? Math.min(parseInt(faixa[1], 10), info.size - 1) : info.size - 1;

      if (inicio >= info.size || inicio > fim) {
        return new NextResponse(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${info.size}` }
        });
      }

      const pedaco = buffer.subarray(inicio, fim + 1);
      return new NextResponse(pedaco as any, {
        status: 206,
        headers: {
          ...headers,
          'Content-Length': String(pedaco.length),
          'Content-Range': `bytes ${inicio}-${fim}/${info.size}`
        }
      });
    }

    return new NextResponse(buffer as any, { headers });
  } catch (error) {
    console.error('Error serving uploaded file:', error);
    return new NextResponse('File not found', { status: 404 });
  }
}
