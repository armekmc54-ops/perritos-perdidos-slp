'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Report, getPrimaryImage } from '../../../services/api';
import FlyerModal from '../../../components/FlyerModal';

interface ReportDetailClientProps {
  report: Report | null;
  reportId: string;
}

export default function ReportDetailClient({ report, reportId }: ReportDetailClientProps) {
  const router = useRouter();
  const [isFlyerOpen, setIsFlyerOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!report) {
    return (
      <main className="min-h-screen bg-theme-bg text-theme-main flex items-center justify-center p-4">
        <div className="bg-theme-surface border border-theme rounded-3xl p-8 max-w-md w-full text-center shadow-xl">
          <span className="text-5xl block mb-3">🐾</span>
          <h1 className="text-xl font-bold mb-2">Reporte no encontrado</h1>
          <p className="text-sm text-theme-muted mb-6">
            Es posible que este reporte haya sido resuelto por su familia o eliminado recientemente.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 px-4 rounded-xl bg-paliacate hover:opacity-90 text-white font-bold text-sm transition"
          >
            🗺️ Ir al Mapa de San Luis Potosí
          </button>
        </div>
      </main>
    );
  }

  const isLost = report.type === 'LOST';
  const isAdoption = report.type === 'ADOPTION';
  const isSighting = report.type === 'SIGHTING';

  const petName = report.petName || report.title || 'Mascota';
  const photo = getPrimaryImage(report.mediaUrl);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : `https://perritos-perdidos-slp.vercel.app/reporte/${report.id}`;

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const handleGoToMap = () => {
    router.push(`/?reportId=${report.id}`);
  };

  return (
    <main className="min-h-screen bg-theme-bg text-theme-main p-4 sm:p-6 md:p-10 flex flex-col items-center">
      {/* Barra de navegación superior */}
      <header className="w-full max-w-xl flex items-center justify-between mb-4">
        <button
          onClick={() => router.push('/')}
          className="text-xs font-bold text-theme-muted hover:text-theme-main flex items-center gap-1.5 transition"
        >
          <span>←</span> Regresar al mapa
        </button>
        <div className="flex items-center gap-1.5 text-xs font-bold text-paliacate">
          <span>🐾</span> Perritos Perdidos SLP
        </div>
      </header>

      {/* Tarjeta Detallada de la Mascota */}
      <article className="w-full max-w-xl bg-theme-surface border border-theme rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Banner de Estado */}
        <div
          className={`py-2.5 px-4 text-center text-white font-black text-sm tracking-wide uppercase ${
            isLost
              ? 'bg-gradient-to-r from-red-700 via-paliacate to-red-700'
              : isAdoption
              ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600'
              : 'bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600'
          }`}
        >
          {isLost ? '🚨 ¡Perro Extraviado en SLP! 🚨' : isAdoption ? '🐾 En Adopción Responsable 🏠' : '👀 Avistamiento Comunitario 📍'}
        </div>

        {/* Imagen de la mascota */}
        <div className="relative w-full h-72 sm:h-96 bg-zinc-950 flex items-center justify-center overflow-hidden">
          {photo ? (
            <>
              <img
                src={photo}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover blur-xl opacity-40 scale-110 pointer-events-none"
              />
              <img
                src={photo}
                alt={petName}
                className="relative z-10 max-h-full max-w-full object-contain"
              />
            </>
          ) : (
            <div className="text-center p-8">
              <span className="text-7xl block mb-2">🐶</span>
              <span className="text-xs text-zinc-400 font-bold uppercase">Fotografía no disponible</span>
            </div>
          )}

          {/* Badge de Recompensa sobre la foto */}
          {isLost && report.reward && report.reward > 0 && (
            <div className="absolute top-3 right-3 z-20 bg-amber-400 text-zinc-950 font-black px-3.5 py-1.5 rounded-full text-xs sm:text-sm shadow-xl border border-amber-200 flex items-center gap-1.5 animate-pulse">
              <span>💰</span> RECOMPENSA: ${report.reward.toLocaleString('es-MX')} MXN
            </div>
          )}
        </div>

        {/* Contenido & Detalles */}
        <div className="p-5 sm:p-6 flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <h1 className="text-2xl sm:text-3xl font-black text-theme-main tracking-tight uppercase">
                {petName}
              </h1>
              <span className="text-[11px] text-theme-muted font-semibold">
                San Luis Potosí, S.L.P.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="bg-theme-input border border-theme text-theme-main text-xs font-bold px-2.5 py-1 rounded-xl">
                {report.species === 'DOG' ? '🐕 Perro' : report.species === 'CAT' ? '🐈 Gato' : '🐾 Mascota'}
              </span>
              {report.breed && (
                <span className="bg-theme-input border border-theme text-theme-main text-xs font-bold px-2.5 py-1 rounded-xl">
                  {report.breed}
                </span>
              )}
              {report.size && (
                <span className="bg-theme-input border border-theme text-theme-main text-xs font-bold px-2.5 py-1 rounded-xl">
                  Talla {report.size.toLowerCase()}
                </span>
              )}
              {report.primaryColor && (
                <span className="bg-theme-input border border-theme text-theme-main text-xs font-bold px-2.5 py-1 rounded-xl">
                  Color: {report.primaryColor}
                </span>
              )}
            </div>
          </div>

          {/* Descripción */}
          {report.description && (
            <div className="bg-theme-input p-3.5 rounded-2xl border border-theme text-sm leading-relaxed text-theme-main">
              <strong className="block text-xs font-bold text-theme-muted uppercase tracking-wider mb-1">
                Detalles & Señas Particulares:
              </strong>
              {report.description}
            </div>
          )}

          {/* Botón Principal: Ver en el Mapa Interactivo */}
          <button
            onClick={handleGoToMap}
            className="w-full py-3.5 px-4 rounded-2xl bg-paliacate hover:opacity-95 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition active:scale-95 cursor-pointer"
          >
            <span>🗺️</span>
            <span>Ver Ubicación Exacta en el Mapa de SLP</span>
          </button>

          {/* Fila de Contacto (WhatsApp & Llamada) */}
          {report.contactPhone && (
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://wa.me/${report.contactPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Hola, vi la publicación de "${petName}" en Perritos Perdidos SLP y tengo información.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-3 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md"
              >
                <span>📱</span> Enviar WhatsApp
              </a>
              <a
                href={`tel:${report.contactPhone.replace(/\D/g, '')}`}
                className="py-3 px-3 rounded-2xl bg-theme-input hover:opacity-80 border border-theme text-theme-main font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <span>📞</span> Llamar: {report.contactPhone}
              </a>
            </div>
          )}

          {/* Botón Destacado de Flyer / Redes Sociales */}
          <div className="pt-3 border-t border-theme flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => setIsFlyerOpen(true)}
              className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:opacity-95 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
            >
              <span>🖼️</span>
              <span>Generar Cartel / Compartir en Historias</span>
            </button>
            <button
              onClick={handleCopy}
              className="py-3 px-4 rounded-2xl bg-theme-input hover:opacity-80 border border-theme text-theme-main font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <span>{copiedLink ? '✅' : '🔗'}</span>
              <span>{copiedLink ? '¡Enlace Copiado!' : 'Copiar Link'}</span>
            </button>
          </div>
        </div>

        {/* Pie de Marca */}
        <footer className="bg-zinc-950 text-zinc-400 p-3 text-center text-xs border-t border-theme flex items-center justify-between">
          <span className="font-bold text-white text-[11px]">
            🐾 Perritos y Animales Perdidos SLP
          </span>
          <span className="text-[10px]">
            Desarrollado con ❤️ por <strong className="text-amber-400">M&A Digital Artisans</strong>
          </span>
        </footer>
      </article>

      {/* Modal del Cartel Oficial Descargable */}
      <FlyerModal
        report={report}
        isOpen={isFlyerOpen}
        onClose={() => setIsFlyerOpen(false)}
      />
    </main>
  );
}
