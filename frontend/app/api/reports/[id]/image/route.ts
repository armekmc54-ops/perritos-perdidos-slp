import { NextRequest, NextResponse } from 'next/server';
import { getReportById, getPrimaryImage } from '@/services/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Fallback a imagen general de alta calidad si el reporte no tiene foto
const FALLBACK_IMAGE_URL = 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=1200&auto=format&fit=crop&q=80';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const report = await getReportById(params.id);
    if (!report) {
      return NextResponse.redirect(new URL(FALLBACK_IMAGE_URL), 302);
    }

    const photo = getPrimaryImage(report.mediaUrl);
    if (!photo) {
      return NextResponse.redirect(new URL(FALLBACK_IMAGE_URL), 302);
    }

    // Si la foto está almacenada como Base64 (data:image/jpeg;base64,... o similar)
    // La convertimos a Buffer binario con Content-Type real para que los rastreadores
    // de Meta (Facebook, Instagram, WhatsApp) y Twitter puedan renderizar la vista previa
    if (photo.startsWith('data:image/')) {
      const matches = photo.match(/^data:([^;]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');

        return new Response(buffer, {
          status: 200,
          headers: {
            'Content-Type': mimeType || 'image/jpeg',
            'Content-Length': buffer.length.toString(),
            'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=43200',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    // Si ya es una URL HTTP o HTTPS externa válida
    if (photo.startsWith('http://') || photo.startsWith('https://')) {
      return NextResponse.redirect(new URL(photo), 302);
    }

    return NextResponse.redirect(new URL(FALLBACK_IMAGE_URL), 302);
  } catch (err) {
    console.error('Error sirviendo imagen binaria para redes sociales:', err);
    return NextResponse.redirect(new URL(FALLBACK_IMAGE_URL), 302);
  }
}
