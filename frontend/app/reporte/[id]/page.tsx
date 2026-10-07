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

  const photo = getPrimaryImage(report.mediaUrl) || 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=1200&auto=format&fit=crop&q=80';
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
          url: photo,
          width: 1200,
          height: 630,
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
      images: [photo],
    },
  };
}

export default async function ReportPage({ params }: Props) {
  const report = await getReportById(params.id);

  return <ReportDetailClient report={report} reportId={params.id} />;
}
