import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const { filename } = await params;
    
    // Caminho seguro para a pasta onde salvamos no volume Docker
    const uploadsDir = join(process.cwd(), 'uploads');
    const filepath = join(uploadsDir, filename);

    const fileBuffer = await readFile(filepath);
    
    let contentType = 'application/octet-stream';
    if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) contentType = 'image/jpeg';
    else if (filename.endsWith('.png')) contentType = 'image/png';
    else if (filename.endsWith('.webp')) contentType = 'image/webp';
    else if (filename.endsWith('.gif')) contentType = 'image/gif';
    else if (filename.endsWith('.pdf')) contentType = 'application/pdf';

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
