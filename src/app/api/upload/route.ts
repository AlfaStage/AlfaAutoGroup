import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { randomBytes } from 'crypto';
import { isAuthenticated } from '@/lib/auth';

/**
 * Recebe arquivos de tres formas, para servir tanto o painel quanto a API
 * e o MCP:
 *
 *  - multipart/form-data com o campo `file` (o navegador manda assim);
 *  - JSON { filename, base64 } — o jeito do MCP, que nao monta multipart;
 *  - JSON { url } — o servidor baixa e guarda, util para reaproveitar midia
 *    ja publicada em outro lugar.
 */

const LIMITE_BYTES = 64 * 1024 * 1024; // 64 MB: video de WhatsApp cabe folgado

/** Extensoes aceitas, por tipo de midia. */
const TIPOS = {
  image: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  video: ['.mp4', '.3gp', '.mov', '.mkv', '.webm'],
  audio: ['.mp3', '.ogg', '.opus', '.m4a', '.aac', '.wav'],
  document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.zip']
} as const;

const EXTENSOES_OK = new Set<string>(Object.values(TIPOS).flat() as string[]);

const POR_MIME: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov', 'video/3gpp': '.3gp',
  'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/opus': '.opus', 'audio/mp4': '.m4a',
  'audio/aac': '.aac', 'audio/wav': '.wav', 'audio/x-wav': '.wav',
  'application/pdf': '.pdf', 'text/plain': '.txt', 'text/csv': '.csv', 'application/zip': '.zip'
};

/** O `mediatype` que a Evolution espera, deduzido da extensao. */
function tipoDeMidia(ext: string): 'image' | 'video' | 'audio' | 'document' {
  for (const [tipo, lista] of Object.entries(TIPOS)) {
    if ((lista as readonly string[]).includes(ext)) return tipo as any;
  }
  return 'document';
}

function nomeSeguro(original: string, extPorMime?: string) {
  const limpo = String(original || '')
    .split(/[\\/]/).pop()!
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
    .slice(-80);

  let ext = extname(limpo).toLowerCase();
  if (!EXTENSOES_OK.has(ext) && extPorMime) ext = extPorMime;

  const base = (limpo.replace(/\.[^.]*$/, '') || 'arquivo').slice(0, 60);
  return { nome: `${Date.now()}-${randomBytes(3).toString('hex')}-${base}${ext}`, ext };
}

async function gravar(buffer: Buffer, nome: string) {
  const uploadsDir = join(process.cwd(), 'uploads');
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(join(uploadsDir, nome), buffer);
}

function baseUrlDe(request: Request) {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  const host = request.headers.get('host');
  if (!host) return '';
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  return `${proto}://${host}`;
}

function resposta(request: Request, nome: string, ext: string, bytes: number) {
  const caminho = `/api/uploads/${nome}`;
  return NextResponse.json({
    success: true,
    filename: nome,
    // `path` é o valor a usar em content.media ou content.picture
    path: caminho,
    url: `${baseUrlDe(request)}${caminho}`,
    mediatype: tipoDeMidia(ext),
    bytes
  });
}

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Envia um arquivo de mídia
 *     description: >
 *       Aceita `multipart/form-data` com o campo `file`, ou JSON com
 *       `{ filename, base64 }` ou `{ url }`. Devolve `path`, que é o valor a
 *       usar em `content.media` (mensagem de mídia) ou `content.picture`
 *       (foto de grupo), e o `mediatype` deduzido da extensão.
 *       Imagem, vídeo, áudio e documento, até 64 MB.
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Arquivo salvo.
 *       400:
 *         description: Arquivo ausente, grande demais ou de tipo não aceito.
 *       401:
 *         description: Não autorizado.
 */
export async function POST(request: Request) {
  try {
    // Sem isto qualquer um na internet escreveria arquivos no servidor.
    if (!(await isAuthenticated(request))) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';

    // ------------------------------------------------ JSON (API e MCP)
    if (contentType.includes('application/json')) {
      const body = await request.json() as {
        filename?: string
        base64?: string
        url?: string
      };

      if (body.base64) {
        // Aceita data URI e base64 puro
        const ehDataUri = body.base64.startsWith('data:') && body.base64.includes(',');
        const cru = ehDataUri ? body.base64.slice(body.base64.indexOf(',') + 1) : body.base64;
        const mimeDoDataUri = ehDataUri
          ? body.base64.slice(5, body.base64.indexOf(';'))
          : '';

        const buffer = Buffer.from(cru, 'base64');
        if (buffer.length === 0) {
          return NextResponse.json({ error: 'base64 vazio ou inválido' }, { status: 400 });
        }
        if (buffer.length > LIMITE_BYTES) {
          return NextResponse.json({ error: 'Arquivo maior que 64 MB' }, { status: 400 });
        }

        const { nome, ext } = nomeSeguro(body.filename || 'arquivo', POR_MIME[mimeDoDataUri]);
        if (!EXTENSOES_OK.has(ext)) {
          return NextResponse.json(
            { error: `Extensão não aceita: "${ext || 'nenhuma'}". Informe filename com a extensão correta.` },
            { status: 400 }
          );
        }

        await gravar(buffer, nome);
        return resposta(request, nome, ext, buffer.length);
      }

      if (body.url) {
        let origem: Response;
        try {
          origem = await fetch(body.url, { redirect: 'follow' });
        } catch {
          return NextResponse.json({ error: 'Não consegui baixar a URL informada' }, { status: 400 });
        }
        if (!origem.ok) {
          return NextResponse.json({ error: `A URL respondeu ${origem.status}` }, { status: 400 });
        }

        const buffer = Buffer.from(await origem.arrayBuffer());
        if (buffer.length > LIMITE_BYTES) {
          return NextResponse.json({ error: 'Arquivo maior que 64 MB' }, { status: 400 });
        }

        const mime = (origem.headers.get('content-type') || '').split(';')[0].trim();
        let doCaminho = '';
        try { doCaminho = new URL(body.url).pathname } catch { /* url estranha */ }

        const { nome, ext } = nomeSeguro(body.filename || doCaminho || 'arquivo', POR_MIME[mime]);
        if (!EXTENSOES_OK.has(ext)) {
          return NextResponse.json(
            { error: `Extensão não aceita: "${ext || 'nenhuma'}". Informe filename com a extensão correta.` },
            { status: 400 }
          );
        }

        await gravar(buffer, nome);
        return resposta(request, nome, ext, buffer.length);
      }

      return NextResponse.json({ error: 'Informe base64 (com filename) ou url' }, { status: 400 });
    }

    // ------------------------------------------- multipart (o painel)
    const data = await request.formData();
    const file = data.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > LIMITE_BYTES) {
      return NextResponse.json({ error: 'Arquivo maior que 64 MB' }, { status: 400 });
    }

    const { nome, ext } = nomeSeguro(file.name, POR_MIME[file.type]);
    if (!EXTENSOES_OK.has(ext)) {
      return NextResponse.json({ error: `Extensão não aceita: "${ext || 'nenhuma'}"` }, { status: 400 });
    }

    await gravar(buffer, nome);
    return resposta(request, nome, ext, buffer.length);
  } catch (error) {
    console.error('Erro ao salvar arquivo:', error);
    return NextResponse.json({ success: false, error: 'Falha ao salvar o arquivo' }, { status: 500 });
  }
}
