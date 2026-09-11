import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join, basename } from 'path';

export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const { filename } = await params;

    // basename impede que um nome como ..%2F..%2Fetc%2Fpasswd escape da pasta
    const safeName = basename(decodeURIComponent(filename));
    if (!safeName || safeName.startsWith('.')) {
      return new NextResponse('File not found', { status: 404 });
    }

    // Caminho seguro para a pasta onde salvamos no volume Docker
    const uploadsDir = join(process.cwd(), 'uploads');
    const filepath = join(uploadsDir, safeName);

    const fileBuffer = await readFile(filepath);
    
    let contentType = 'application/octet-stream';
    if (safeName.endsWith('.jpg') || safeName.endsWith('.jpeg')) contentType = 'image/jpeg';
    else if (safeName.endsWith('.png')) contentType = 'image/png';
    else if (safeName.endsWith('.webp')) contentType = 'image/webp';
    else if (safeName.endsWith('.gif')) contentType = 'image/gif';
    else if (safeName.endsWith('.pdf')) contentType = 'application/pdf';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving uploaded file:', error);
    return new NextResponse('File not found', { status: 404 });
  }
}
