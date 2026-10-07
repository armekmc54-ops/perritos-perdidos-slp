import type { Metadata } from 'next';
import { getReportById, getPrimaryImage } from '../../../services/api';
import ReportDetailClient from './ReportDetailClient';

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const report = await getReportById(params.id);

  if (!report) {
    return {
      title: 'Reporte de Mascota - Perritos y Animales Perdidos SLP',
      description: 'Plataforma comunitaria de reporte y adopción de animales en San Luis Potosí.',
    };
  }

  const isLost = report.type === 'LOST';
  const isAdoption = report.type === 'ADOPTION';
  const petName = report.petName || report.title || 'Mascota';

  const title = isLost
    ? `🚨 ¡SE BUSCA! ${petName} en San Luis Potosí`
    : isAdoption
    ? `🐶 En Adopción Responsable: ${petName} (SLP)`
    : `👀 Avistamiento Comunitario: ${petName} en SLP`;

  const rewardText = report.reward && report.reward > 0 ? `💰 RECOMPENSA: $${report.reward.toLocaleString('es-MX')} MXN. ` : '';
  const descSnippet = report.description ? report.description.slice(0, 160) : 'Ayuda a reportar o compartir.';
  const description = `${rewardText}${descSnippet} • Contacto: ${report.contactPhone || 'Comunidad SLP'}. Toca para ver ubicación exacta en el mapa de SLP.`;

  // Servimos una URL HTTPS absoluta con el buffer binario real de la imagen.
  // Meta/Facebook rechaza de forma estricta los Data URIs en Base64 en og:image.
  const imageUrl = `https://perritos-perdidos-slp.vercel.app/api/reports/${report.id}/image`;
  const url = `https://perritos-perdidos-slp.vercel.app/reporte/${report.id}`;

  return {
    title: `${title} | Perritos y Animales Perdidos SLP`,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'Perritos y Animales Perdidos SLP',
      images: [
        {
          url: imageUrl,
          secureUrl: imageUrl,
          width: 1200,
          height: 630,
          type: 'image/jpeg',
          alt: title,
        },
      ],
      locale: 'es_MX',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function ReportPage({ params }: Props) {
  const report = await getReportById(params.id);

  return <ReportDetailClient report={report} reportId={params.id} />;
}
