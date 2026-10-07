'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Report, getPrimaryImage } from '../services/api';
import { toJpeg } from 'html-to-image';
import QRCode from 'qrcode';

interface FlyerModalProps {
  report: Report | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function FlyerModal({ report, isOpen, onClose }: FlyerModalProps) {
  const flyerRef = useRef<HTMLDivElement>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const reportId = report?.id || '';
  const reportUrl = reportId
    ? (typeof window !== 'undefined' && window.location.origin
        ? `${window.location.origin}/reporte/${reportId}`
        : `https://perritos-perdidos-slp.vercel.app/reporte/${reportId}`)
    : '';

  // Generar código QR de alta resolución (200x200 para render nítido en caja de 72x72)
  useEffect(() => {
    if (report && isOpen && reportUrl) {
      QRCode.toDataURL(reportUrl, {
        width: 200,
        margin: 1,
        color: {
          dark: '#18181b',
          light: '#FFFFFF',
        },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error('Error generando QR:', err));
    }
  }, [report, isOpen, reportUrl]);

  if (!isOpen || !report) return null;

  const isLost = report.type === 'LOST';
  const isAdoption = report.type === 'ADOPTION';
  const isSighting = report.type === 'SIGHTING';

  const petName = report.petName || report.title || 'Mascota';
  const photo = getPrimaryImage(report.mediaUrl) || ((report as any).images && (report as any).images.length > 0 ? (report as any).images[0] : null);

  const shareTitle = isLost
    ? `🚨 ¡SE BUSCA! ${petName} en San Luis Potosí`
    : isAdoption
    ? `🐶 En Adopción Responsable: ${petName}`
    : `👀 Avistamiento Comunitario: ${petName}`;

  const shareText = `${shareTitle}\n\n${report.description ? report.description.slice(0, 150) + '...' : ''}\n\nContacto: ${report.contactPhone || 'Comunidad SLP'}\n\nVer ubicación en el mapa interactivo:\n${reportUrl}`;

  // Función auxiliar robusta para capturar el elemento sin cortes y garantizando foto y QR
  const captureFlyerBlob = async (): Promise<{ dataUrl: string; file: File }> => {
    if (!flyerRef.current) throw new Error('No se encontró el contenedor del flyer');

    const node = flyerRef.current;

    // 1. Si el QR aún no ha terminado de generarse en estado, lo generamos de inmediato
    let activeQr = qrCodeDataUrl;
    if (!activeQr && reportUrl) {
      try {
        activeQr = await QRCode.toDataURL(reportUrl, {
          width: 200,
          margin: 1,
          color: { dark: '#18181b', light: '#FFFFFF' },
        });
        setQrCodeDataUrl(activeQr);
        // Breve pausa para que React pinte el QR en el DOM
        await new Promise((r) => setTimeout(r, 120));
      } catch (err) {
        console.error('Error generando QR durante captura:', err);
      }
    }

    // 2. Aseguramos que todas las imágenes internas (foto y QR) estén totalmente cargadas
    const imgElements = Array.from(node.querySelectorAll('img'));
    await Promise.all(
      imgElements.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          setTimeout(resolve, 800);
        });
      })
    );

    // Medición exacta sin recortes
    const width = node.offsetWidth || 360;
    const height = node.scrollHeight || node.offsetHeight;

    // IMPORTANTE: cacheBust DEBE ser false.
    // Si cacheBust es true, html-to-image agrega "?timestamp" al final de Data URIs base64,
    // lo que invalida el string base64 y hace que la foto desaparezca completamente.
    const dataUrl = await toJpeg(node, {
      quality: 0.95,
      pixelRatio: 2,
      cacheBust: false,
      width,
      height,
      style: {
        transform: 'none',
        margin: '0',
        maxHeight: 'none',
      },
      backgroundColor: '#ffffff',
    });

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const cleanFileName = `Cartel-${petName.replace(/[^a-zA-Z0-9]/g, '_')}-SLP.jpg`;
    const file = new File([blob], cleanFileName, { type: 'image/jpeg' });

    return { dataUrl, file };
  };

  // 1. Descargar imagen en JPG para Galería o Fotos
  const handleDownloadJpg = async () => {
    setIsProcessing(true);
    setStatusMessage('Generando cartel con foto y código QR...');

    try {
      const { dataUrl } = await captureFlyerBlob();

      const cleanFileName = `Cartel-${petName.replace(/[^a-zA-Z0-9]/g, '_')}-SLP.jpg`;
      const link = document.createElement('a');
      link.download = cleanFileName;
      link.href = dataUrl;
      link.click();

      setStatusMessage('✅ ¡Cartel descargado en JPG! Guardado en tu galería con foto y QR listos.');
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: any) {
      console.error('Error al generar JPG del cartel:', err);
      alert('Hubo un error al generar la imagen. Puedes tomar captura de pantalla o intentar nuevamente.');
      setStatusMessage(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Compartir directamente en Historias (Instagram, Facebook Stories, TikTok, WhatsApp)
  const handleShareToStories = async () => {
    setIsProcessing(true);
    setStatusMessage('Preparando historia con foto y QR...');

    try {
      const { dataUrl, file } = await captureFlyerBlob();

      // En móviles iOS y Android, pasamos ÚNICAMENTE el archivo (sin texto ni URL acompañante).
      // Así el sistema operativo activa el modo nativo de compartir "Foto".
      // Al elegir Instagram o Facebook, la imagen se inserta completa en Historias.
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
        });
        setStatusMessage('✅ ¡Listo! Abriendo tus historias...');
        setTimeout(() => setStatusMessage(null), 3000);
        return;
      }

      // Si el navegador no admite compartir archivos directamente, descargamos el JPG
      const cleanFileName = `Cartel-${petName.replace(/[^a-zA-Z0-9]/g, '_')}-SLP.jpg`;
      const link = document.createElement('a');
      link.download = cleanFileName;
      link.href = dataUrl;
      link.click();

      setStatusMessage('📥 ¡Cartel guardado en tu galería! Ya puedes subirlo directamente a tus Historias.');
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error al compartir historias:', err);
        handleDownloadJpg();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Compartir en Facebook (Feed / Muro / Grupos)
  const handleShareFacebook = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(reportUrl)}&quote=${encodeURIComponent(shareTitle)}`;
    window.open(fbUrl, '_blank', 'noopener,noreferrer,width=600,height=500');
  };

  // 4. Compartir por WhatsApp
  const handleShareWhatsApp = () => {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, '_blank');
  };

  // 5. Copiar Enlace Directo
  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(reportUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-zinc-900 text-white rounded-3xl w-full max-w-lg p-4 sm:p-6 shadow-2xl relative my-auto max-h-[96vh] overflow-y-auto border border-zinc-700 flex flex-col items-center">
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white font-bold text-2xl w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer z-10"
          title="Cerrar"
        >
          ✕
        </button>

        {/* Título del Modal */}
        <div className="text-center mb-3 pr-6">
          <span className="text-2xl sm:text-3xl block mb-1">📢</span>
          <h3 className="text-lg sm:text-xl font-black text-white">
            Cartel Oficial & Compartir en Redes
          </h3>
          <p className="text-xs text-zinc-400">
            Aquí puedes ver el previo oficial con la foto del perrito y su código QR.
          </p>
        </div>

        {/* Mensaje de estado temporal */}
        {statusMessage && (
          <div className="w-full mb-3 p-2.5 rounded-xl bg-paliacate/20 border border-paliacate/60 text-white text-xs font-bold text-center animate-pulse">
            {statusMessage}
          </div>
        )}

        {/* CONTENEDOR DEL CARTEL PARA CAPTURA (Diseñado para proporciones de Historias 9:16 y Flyer) */}
        <div className="w-full flex justify-center overflow-x-auto py-1">
          <div
            ref={flyerRef}
            id="social-flyer-capture"
            className="w-[360px] sm:w-[380px] bg-white text-zinc-900 rounded-3xl overflow-hidden shadow-2xl border-4 border-zinc-800 flex flex-col shrink-0 select-none"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            {/* 1. ENCABEZADO VIBRANTE SEGÚN TIPO */}
            <div
              className={`p-3.5 text-center text-white shrink-0 ${
                isLost
                  ? 'bg-gradient-to-r from-red-700 via-paliacate to-red-700'
                  : isAdoption
                  ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600'
                  : 'bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600'
              }`}
            >
              <div className="text-[11px] font-black tracking-widest uppercase opacity-95">
                Perritos y Animales Perdidos SLP
              </div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mt-0.5 leading-none drop-shadow-sm">
                {isLost ? '🚨 ¡SE BUSCA! 🚨' : isAdoption ? '🐾 EN ADOPCIÓN 🏠' : '👀 AVISTAMIENTO 📍'}
              </h1>
              <p className="text-[11px] font-bold mt-1 text-white/95">
                {isLost
                  ? 'San Luis Potosí, S.L.P. • ¡Ayúdanos a que vuelva a casa!'
                  : isAdoption
                  ? 'San Luis Potosí, S.L.P. • Busca un hogar lleno de amor'
                  : 'San Luis Potosí, S.L.P. • Reportado en vía pública'}
              </p>
            </div>

            {/* 2. FOTOGRAFÍA PRINCIPAL DEL PERRITO (ALTURA FIJA EXPLÍCITA, NUNCA SE COLAPSA) */}
            <div
              className="relative w-full bg-zinc-950 flex items-center justify-center overflow-hidden border-b-2 border-zinc-200 shrink-0"
              style={{ height: '260px', minHeight: '260px', maxHeight: '260px' }}
            >
              {photo ? (
                <img
                  src={photo}
                  alt={petName}
                  className="w-full h-full object-contain pointer-events-none p-2"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div className="text-center p-6 flex flex-col items-center justify-center">
                  <span className="text-6xl block mb-2">🐶</span>
                  <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                    Fotografía no disponible
                  </span>
                </div>
              )}

              {/* Badge de Recompensa sobre la foto si aplica */}
              {isLost && report.reward && report.reward > 0 && (
                <div className="absolute top-2.5 right-2.5 z-20 bg-amber-400 text-zinc-950 font-black px-3.5 py-1.5 rounded-full text-xs shadow-lg border-2 border-amber-200 flex items-center gap-1">
                  <span>💰</span> RECOMPENSA: ${report.reward.toLocaleString('es-MX')} MXN
                </div>
              )}
            </div>

            {/* 3. DATOS DEL ANIMAL & CARACTERÍSTICAS */}
            <div className="p-3.5 sm:p-4 flex flex-col gap-2.5 bg-zinc-50 shrink-0">
              <div className="text-center">
                <h2 className="text-2xl font-black text-zinc-900 tracking-tight leading-tight uppercase">
                  {petName}
                </h2>
                <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1.5">
                  <span className="bg-zinc-200 text-zinc-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-md uppercase">
                    {report.species === 'DOG' ? '🐕 Perro' : report.species === 'CAT' ? '🐈 Gato' : '🐾 Mascota'}
                  </span>
                  {report.breed && (
                    <span className="bg-zinc-200 text-zinc-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-md">
                      {report.breed}
                    </span>
                  )}
                  {report.size && (
                    <span className="bg-zinc-200 text-zinc-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-md">
                      Talla {report.size.toLowerCase()}
                    </span>
                  )}
                  {report.primaryColor && (
                    <span className="bg-zinc-200 text-zinc-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-md">
                      Color: {report.primaryColor}
                    </span>
                  )}
                </div>
              </div>

              {/* DESCRIPCIÓN O SEÑAS PARTICULARES */}
              {report.description && (
                <div className="bg-white p-2.5 rounded-xl border border-zinc-200 text-xs text-zinc-700 leading-snug shrink-0">
                  <strong className="text-zinc-900 block font-bold text-[11px] mb-0.5">
                    Señas particulares o lugar:
                  </strong>
                  <p className="line-clamp-3">
                    {report.description}
                  </p>
                </div>
              )}

              {/* NÚMERO DE TELÉFONO DE CONTACTO (GRANDE, DIRECTO Y DESTACADO) */}
              {report.contactPhone && (
                <div className="bg-emerald-600 text-white rounded-xl p-2.5 text-center shadow-md border border-emerald-500 shrink-0">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-100">
                    Comunícate por Llamada o WhatsApp:
                  </div>
                  <div className="text-xl font-black tracking-wider mt-0.5">
                    📞 {report.contactPhone}
                  </div>
                </div>
              )}

              {/* SECCIÓN DEL CÓDIGO QR COMPACTO (72x72 PX) Y ENLACE AL MAPA DE SLP */}
              <div className="bg-white p-2.5 rounded-xl border border-zinc-200 flex items-center gap-3 shrink-0">
                <div
                  className="w-[72px] h-[72px] min-w-[72px] min-h-[72px] bg-white rounded-lg border border-zinc-300 p-1 flex items-center justify-center shrink-0 shadow-xs"
                  style={{ width: '72px', height: '72px', minWidth: '72px', minHeight: '72px' }}
                >
                  {qrCodeDataUrl ? (
                    <img
                      src={qrCodeDataUrl}
                      alt="Código QR del reporte"
                      className="w-full h-full object-contain"
                      style={{ width: '64px', height: '64px' }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl text-zinc-400">
                      📱
                    </div>
                  )}
                </div>
                <div className="text-left text-xs min-w-0 flex-1">
                  <strong className="text-zinc-900 block font-bold text-[11px] leading-tight">
                    📍 Escanea para ver mapa en vivo de SLP
                  </strong>
                  <p className="text-[10px] text-zinc-600 leading-tight mt-0.5">
                    Abre la ubicación exacta, fotos adicionales y contacto directo en la comunidad.
                  </p>
                  <span className="text-[9px] text-zinc-400 font-semibold block truncate mt-0.5">
                    {reportUrl}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. PIE DE PÁGINA CON MARCA DE M&A DIGITAL ARTISANS */}
            <div className="bg-zinc-900 text-zinc-300 px-3 py-2 text-center text-[10px] border-t border-zinc-800 flex items-center justify-between shrink-0">
              <span className="font-bold text-white flex items-center gap-1">
                <span>🐾</span> Perritos Perdidos SLP
              </span>
              <span className="text-zinc-400 text-[9px] font-medium">
                Desarrollado con ❤️ por <strong className="text-amber-400">M&A Digital Artisans</strong>
              </span>
            </div>
          </div>
        </div>

        {/* BOTONES DE ACCIÓN PARA REDES SOCIALES */}
        <div className="w-full flex flex-col gap-2 mt-4 pt-3 border-t border-zinc-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Botón Principal 1: Compartir en Historias */}
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleShareToStories}
              className="py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:opacity-95 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95 cursor-pointer disabled:opacity-60"
            >
              <span className="text-base">📸</span>
              <span>Compartir en Historias</span>
            </button>

            {/* Botón Principal 2: Descargar Flyer JPG */}
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleDownloadJpg}
              className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95 cursor-pointer disabled:opacity-60"
            >
              <span className="text-base">📥</span>
              <span>Descargar Flyer JPG</span>
            </button>
          </div>

          {/* Botones Secundarios: Facebook, WhatsApp y Copiar Enlace */}
          <div className="grid grid-cols-3 gap-2 mt-1">
            <button
              type="button"
              onClick={handleShareFacebook}
              className="py-2.5 px-2 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
              title="Publicar en Facebook con vista previa de foto"
            >
              <span>🔵</span> Facebook
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="py-2.5 px-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
              title="Compartir por WhatsApp"
            >
              <span>📱</span> WhatsApp
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="py-2.5 px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer border border-zinc-700 shadow-xs"
              title="Copiar enlace directo"
            >
              <span>{copiedLink ? '✅' : '🔗'}</span>
              <span>{copiedLink ? '¡Copiado!' : 'Copiar Link'}</span>
            </button>
          </div>

          <div className="bg-zinc-800/70 border border-zinc-700/60 rounded-xl p-2.5 mt-1 text-[11px] text-zinc-300 flex flex-col gap-1">
            <div className="font-bold text-white flex items-center gap-1">
              <span>💡</span> ¿Cómo publicarlo en tus historias con enlace?
            </div>
            <p className="text-zinc-400 leading-tight">
              1. Presiona <strong>"Compartir en Historias"</strong> o <strong>"Descargar Flyer JPG"</strong>.
            </p>
            <p className="text-zinc-400 leading-tight">
              2. En Instagram o Facebook Stories, sube la foto del cartel y agrega el sticker de <strong>"Enlace" 🔗</strong> con el link copiado para que la gente entre directo al mapa.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
