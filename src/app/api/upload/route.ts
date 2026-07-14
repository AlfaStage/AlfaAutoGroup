import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure uploads directory exists
    const uploadsDir = join(process.cwd(), 'uploads');
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (e) {
      // Ignored if exists
    }

    // Generate unique file name
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const filename = `${timestamp}-${sanitizedName}`;
    const filepath = join(uploadsDir, filename);

    // Save to disk
    await writeFile(filepath, buffer);

    // Return the URL
    // If NEXT_PUBLIC_APP_URL is set, use it. Otherwise, use relative path or request origin
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    if (!baseUrl && request.headers.get('host')) {
      const protocol = request.headers.get('x-forwarded-proto') || 'http';
      baseUrl = `${protocol}://${request.headers.get('host')}`;
    }

    const fileUrl = `${baseUrl}/api/uploads/${filename}`;

    return NextResponse.json({ success: true, url: fileUrl, filename });
  } catch (error) {
    console.error('Error handling upload:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
