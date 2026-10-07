'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  getReports,
  createReport,
  updateReport,
  updateReportStatus,
  deleteReport,
  Report,
  ReportType,
  ReportStatus,
  Species,
  TriangulationData,
  getTriangulationData,
  sendMessage,
  getMessages,
  getReportImages,
  getPrimaryImage,
} from '../services/api';
import { useSession } from 'next-auth/react';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import Footer from '../components/Footer';

// Cargamos el mapa dinámicamente sin SSR para evitar fallos de Leaflet en Node
const Map = dynamic(() => import('../components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 text-carbon/60">
      <span className="text-3xl animate-bounce mb-2">🗺️</span>
      <p className="font-semibold text-sm">Cargando mapa interactivo...</p>
    </div>
  ),
});

// Coordenadas del centro de San Luis Potosí
const SLP_CENTER: [number, number] = [22.1565, -100.9855];

// Fórmula de Haversine para calcular distancia en km
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Formateador de tiempo relativo en español con protección contra fechas inválidas
function formatRelativeTime(dateString: string): string {
  if (!dateString) return 'Reciente';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Reciente';
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Hace un momento';
    if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Hace ${diffInHours} ${diffInHours === 1 ? 'hora' : 'horas'}`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Ayer';
    if (diffInDays < 30) return `Hace ${diffInDays} días`;
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  } catch (e) {
    return 'Reciente';
  }
}

// Componente de descripción expandible con botón "Ver más..." / "Ver menos"
function ExpandableText({ text, limit = 75 }: { text: string; limit?: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (!text) return null;
  const isLong = text.length > limit;

  return (
    <div className="mt-1 text-xs text-theme-muted leading-relaxed">
      <p className="whitespace-pre-line">
        {isLong && !isExpanded ? `${text.slice(0, limit).trim()}...` : text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="text-[11px] font-bold text-paliacate hover:underline mt-0.5 inline-flex items-center gap-1 cursor-pointer"
        >
          {isExpanded ? 'Ver menos ▲' : 'Ver más... ▼'}
        </button>
      )}
    </div>
  );
}

// Galería de imágenes completa y sin recortes para tarjetas de reporte
function ReportCardGallery({
  mediaUrl,
  title,
  status,
  type,
  reward,
  createdAt,
  onOpenLightbox,
}: {
  mediaUrl?: string | null;
  title: string;
  status: ReportStatus;
  type: ReportType;
  reward?: number | null;
  createdAt: string;
  onOpenLightbox: (images: string[], index: number) => void;
}) {
  const images = getReportImages(mediaUrl);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const hasDragged = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    hasDragged.current = false;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || images.length <= 1) return;
    const diffX = e.touches[0].clientX - touchStartX.current;
    const diffY = e.touches[0].clientY - (touchStartY.current || 0);

    if (Math.abs(diffX) > 8 && Math.abs(diffX) > Math.abs(diffY)) {
      hasDragged.current = true;
      const atStart = currentIndex === 0 && diffX > 0;
      const atEnd = currentIndex === images.length - 1 && diffX < 0;
      setDragOffset(atStart || atEnd ? diffX * 0.35 : diffX);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsDragging(false);
    if (touchStartX.current === null || images.length <= 1) {
      setDragOffset(0);
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - (touchStartY.current || 0);

    if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < 0) {
        // Deslizar izquierda -> siguiente foto
        setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
      } else {
        // Deslizar derecha -> foto anterior
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
      }
    }
    setDragOffset(0);
    touchStartX.current = null;
    touchStartY.current = null;
    setTimeout(() => {
      hasDragged.current = false;
    }, 60);
  };

  const renderBadges = () => (
    <div className="absolute top-2 left-2 z-20 flex flex-wrap gap-1 max-w-[85%] pointer-events-none">
      {status === 'RESOLVED' ? (
        <span className="bg-esperanza text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
          🎉 ¡ENCONTRADO!
        </span>
      ) : type === 'LOST' ? (
        <span className="bg-paliacate text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">
          ¡PERDIDO!
        </span>
      ) : type === 'ADOPTION' ? (
        <span className="bg-confianza text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">
          EN ADOPCIÓN
        </span>
      ) : (
        <span className="bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">
          AVISTAMIENTO
        </span>
      )}

      {status === 'ACTIVE' && reward && reward > 0 && (
        <span className="bg-amber-400 text-gray-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 border border-amber-300">
          💰 ${Number(reward).toLocaleString('es-MX')} MXN
        </span>
      )}
    </div>
  );

  if (!images.length) {
    return (
      <div className="h-32 bg-theme-input/50 relative flex flex-col items-center justify-center text-theme-muted select-none">
        <span className="text-3xl mb-0.5">🐕</span>
        <span className="text-[11px] font-medium">Sin fotografía</span>
        {renderBadges()}
        <span className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-md backdrop-blur-xs font-medium">
          {formatRelativeTime(createdAt)}
        </span>
      </div>
    );
  }

  return (
    <div className="relative group w-full bg-zinc-950 flex flex-col select-none">
      {/* Contenedor de la foto completa con fondo ambiental difuminado */}
      <div
        className="relative h-36 sm:h-40 w-full overflow-hidden flex items-center justify-center cursor-pointer select-none bg-zinc-950"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          e.stopPropagation();
          if (!hasDragged.current) {
            onOpenLightbox(images, currentIndex);
          }
        }}
        title="Toca para ver la foto en pantalla completa"
      >
        {/* Carrusel de fotos animado con transición fluida */}
        <div
          className="flex h-full w-full will-change-transform"
          style={{
            transform: `translateX(calc(-${currentIndex * 100}% + ${dragOffset}px))`,
            transition: isDragging ? 'none' : 'transform 320ms cubic-bezier(0.2, 0.9, 0.3, 1)',
          }}
        >
          {images.map((img, idx) => (
            <div key={idx} className="relative w-full h-full shrink-0 flex items-center justify-center overflow-hidden">
              {/* Fondo ambiental difuminado */}
              <img
                src={img}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110 pointer-events-none select-none"
              />
              {/* Fotografía completa nítida */}
              <img
                src={img}
                alt={title}
                className="relative z-10 max-h-full max-w-full object-contain pointer-events-none transition duration-200 hover:scale-[1.02]"
              />
            </div>
          ))}
        </div>

        {renderBadges()}

        {/* Botón lupa / pantalla completa */}
        <div className="absolute top-2 right-2 z-20 bg-black/60 hover:bg-black text-white p-1 rounded-full backdrop-blur-xs text-[10px] opacity-90 shadow-md">
          🔍
        </div>

        {/* Tiempo relativo */}
        <span className="absolute bottom-1.5 right-1.5 z-20 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded-md backdrop-blur-xs font-medium">
          {formatRelativeTime(createdAt)}
        </span>

        {/* Controles de carrusel si hay más de 1 foto */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
              }}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 z-20 bg-black/65 hover:bg-black active:scale-90 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shadow-lg transition backdrop-blur-xs cursor-pointer"
              title="Foto anterior"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
              }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 bg-black/65 hover:bg-black active:scale-90 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shadow-lg transition backdrop-blur-xs cursor-pointer"
              title="Siguiente foto"
            >
              ›
            </button>

            {/* Indicador de fotos (ej. 1 de 3) */}
            <div className="absolute bottom-1.5 left-1.5 z-20 bg-black/75 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-xs flex items-center gap-1 shadow-md">
              <span>📷</span>
              <span>{currentIndex + 1} de {images.length}</span>
            </div>
          </>
        )}
      </div>

      {/* Tira de miniaturas interactivas cuando hay 2 o 3 fotos */}
      {images.length > 1 && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900 border-t border-zinc-800 z-10">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(idx);
              }}
              className={`relative h-7 flex-1 rounded-md overflow-hidden border transition cursor-pointer bg-black flex items-center justify-center ${
                idx === currentIndex
                  ? 'border-paliacate ring-1 ring-paliacate/60 scale-[1.02]'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={img}
                alt={`Miniatura ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-0.2 right-0.5 text-[8px] font-bold bg-black/75 text-white px-0.5 rounded">
                {idx + 1}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  // Estado principal de datos
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estados de navegación y filtros
  const [activeFilter, setActiveFilter] = useState<'ALL' | ReportType | 'RESOLVED'>('ALL');
  const [filterNearby5km, setFilterNearby5km] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(SLP_CENTER);
  const [mapZoom, setMapZoom] = useState<number>(12);

  // Estados para enviar mensajes directos a dueños de perritos
  const [messagingReport, setMessagingReport] = useState<Report | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageSuccessBanner, setMessageSuccessBanner] = useState<string | null>(null);

  // Modo de Triangulación de Ubicaciones en el Mapa e Historial de Avistamientos
  const [triangulationData, setTriangulationData] = useState<{
    lostReport: Report;
    sightings: Report[];
    details?: TriangulationData | null;
  } | null>(null);
  const [profileModalTab, setProfileModalTab] = useState<'notifications' | 'reports' | 'settings'>('notifications');
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);

  // Filtro por Especie de Animal
  const [speciesFilter, setSpeciesFilter] = useState<'ALL' | Species>('ALL');

  // Ubicación del usuario (para distancia y reportes)
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Vista en pantallas móviles: 'map' o 'list'
  const [mobileTab, setMobileTab] = useState<'map' | 'list'>('list');

  // Estados del Modal de nuevo reporte o edición
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPickingOnMap, setIsPickingOnMap] = useState(false);
  const [hasPickedLocation, setHasPickedLocation] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isCompressingPhotos, setIsCompressingPhotos] = useState(false);
  const [lightboxData, setLightboxData] = useState<{ images: string[]; index: number } | null>(null);
  const [lightboxDragOffset, setLightboxDragOffset] = useState<number>(0);
  const [isLightboxDragging, setIsLightboxDragging] = useState<boolean>(false);
  const lightboxTouchStartX = useRef<number | null>(null);
  const lightboxTouchStartY = useRef<number | null>(null);

  const [formData, setFormData] = useState<{
    petName: string;
    type: ReportType;
    species: Species;
    customSpecies: string;
    breed: string;
    primaryColor: string;
    size: string;
    description: string;
    contactPhone: string;
    reward: string;
    mediaUrl: string;
    latitude: number | null;
    longitude: number | null;
  }>({
    petName: '',
    type: 'LOST' as ReportType,
    species: 'DOG' as Species,
    customSpecies: '',
    breed: '',
    primaryColor: '',
    size: 'MEDIANO',
    description: '',
    contactPhone: '',
    reward: '',
    mediaUrl: '',
    latitude: null,
    longitude: null,
  });

  // Autenticación con NextAuth y Perfiles
  const { data: session } = useSession();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('arena');
  const [isMounted, setIsMounted] = useState(false);

  // Inicializar tema visual desde localStorage con salvaguarda para Safari
  useEffect(() => {
    setIsMounted(true);
    try {
      const savedTheme = localStorage.getItem('pps-theme') || 'arena';
      setCurrentTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } catch (e) {
      console.warn('Almacenamiento local restringido:', e);
    }
  }, []);

  const handleThemeChange = (newTheme: string) => {
    setCurrentTheme(newTheme);
    try {
      localStorage.setItem('pps-theme', newTheme);
    } catch (e) {
      console.warn('No se pudo guardar preferencia:', e);
    }
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const feedRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Auto pre-llenar teléfono del usuario autenticado si existe
  useEffect(() => {
    if (session?.user && (session.user as any).phone) {
      setFormData((prev) => ({
        ...prev,
        contactPhone: prev.contactPhone || (session.user as any).phone || '',
      }));
    }
  }, [session, isModalOpen]);

  // 1. Cargar reportes iniciales desde el backend
  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await getReports();
      setReports(data);
      setErrorMessage(null);
    } catch (err: any) {
      console.error('Error al cargar reportes:', err);
      setErrorMessage(
        'No pudimos sincronizar los reportes en este momento. Por favor revisa tu conexión a internet o intenta de nuevo.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();

    // Intentar obtener la ubicación del usuario con permiso del navegador
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setUserCoords(loc);
        },
        () => {
          // Permiso denegado o no disponible; usamos el centro de SLP por defecto
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Calcular notificaciones pendientes (mensajes y avistamientos) para la campana a primera mano
  useEffect(() => {
    let isMounted = true;
    const fetchUnread = () => {
      if (session?.user?.email) {
        getMessages(session.user.email)
          .then((msgs) => {
            if (!isMounted) return;
            const unreadMsgs = msgs.filter(
              (m) => !m.read && m.receiver.email.toLowerCase() === session.user.email?.toLowerCase()
            ).length;
            const sightingsCount = reports.filter((r) => r.type === 'SIGHTING' && r.status === 'ACTIVE').length;
            setUnreadNotificationsCount(unreadMsgs + (sightingsCount > 0 ? 1 : 0));
          })
          .catch(() => {});
      } else {
        if (isMounted) setUnreadNotificationsCount(0);
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [session, reports]);

  // 2. Filtrado reactivo de reportes
  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      // Filtro especial: Casos de Éxito
      if (activeFilter === 'RESOLVED') {
        if (report.status !== 'RESOLVED' && report.type !== 'SUCCESS') {
          return false;
        }
      } else if (activeFilter !== 'ALL') {
        // En los filtros por tipo regulares ('LOST', 'ADOPTION', 'SIGHTING'),
        // filtramos por tipo y solo activos
        if (report.type !== activeFilter) {
          return false;
        }
      }

      // Filtro por Especie de Animal
      if (speciesFilter !== 'ALL') {
        const repSpecies = report.species || 'DOG';
        if (repSpecies !== speciesFilter) {
          return false;
        }
      }

      // Filtro por radio de 5km
      if (filterNearby5km) {
        const referenceLat = userCoords?.latitude ?? SLP_CENTER[0];
        const referenceLng = userCoords?.longitude ?? SLP_CENTER[1];
        const distance = calculateDistanceKm(
          referenceLat,
          referenceLng,
          report.latitude,
          report.longitude
        );
        if (distance > 5) {
          return false;
        }
      }
      return true;
    });
  }, [reports, activeFilter, filterNearby5km, userCoords, speciesFilter]);

  // Contadores para las pestañas
  const counts = useMemo(() => {
    return {
      all: reports.length,
      lost: reports.filter((r) => r.type === 'LOST' && r.status === 'ACTIVE').length,
      adoption: reports.filter((r) => r.type === 'ADOPTION' && r.status === 'ACTIVE').length,
      sighting: reports.filter((r) => r.type === 'SIGHTING' && r.status === 'ACTIVE').length,
      resolved: reports.filter((r) => r.status === 'RESOLVED' || r.type === 'SUCCESS').length,
    };
  }, [reports]);

  // Manejador para fijar ubicación GPS actual en el formulario
  const handleUseCurrentGPS = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }));
        setHasPickedLocation(true);
        setUserCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        alert('📍 Ubicación GPS obtenida con éxito.');
      },
      (error) => {
        console.error('Error de GPS:', error);
        alert('No se pudo acceder a tu ubicación. Permite el acceso o selecciónala en el mapa.');
      },
      { enableHighAccuracy: true }
    );
  };

  // Comprime y optimiza la imagen para carga rápida en móviles y web
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const maxDim = 1200; // Máximo 1200px para mantener nitidez
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          // Exportar como JPEG con calidad 0.82 (~100-300KB de peso óptimo)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          resolve(compressedDataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // Manejo de carga de hasta 3 fotografías optimizadas
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const availableSlots = 3 - imagePreviews.length;
    if (availableSlots <= 0) {
      alert('Ya has alcanzado el límite máximo de 3 fotografías.');
      return;
    }

    const toProcess = files.slice(0, availableSlots);
    setIsCompressingPhotos(true);
    try {
      const newCompressed: string[] = [];
      for (const file of toProcess) {
        if (file.size > 15 * 1024 * 1024) {
          alert(`La foto "${file.name}" supera los 15MB y no se pudo cargar.`);
          continue;
        }
        try {
          const opt = await compressImage(file);
          newCompressed.push(opt);
        } catch {
          const reader = new FileReader();
          const res = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          newCompressed.push(res);
        }
      }

      setImagePreviews((prev) => {
        const combined = [...prev, ...newCompressed].slice(0, 3);
        setFormData((f) => ({
          ...f,
          mediaUrl: combined.length === 1 ? combined[0] : JSON.stringify(combined),
        }));
        return combined;
      });
    } finally {
      setIsCompressingPhotos(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    setImagePreviews((prev) => {
      const updated = prev.filter((_, idx) => idx !== indexToRemove);
      setFormData((f) => ({
        ...f,
        mediaUrl: updated.length === 0 ? '' : updated.length === 1 ? updated[0] : JSON.stringify(updated),
      }));
      return updated;
    });
  };

  // Reiniciar estado del formulario
  const resetFormState = () => {
    setEditingReport(null);
    setImagePreviews([]);
    setHasPickedLocation(false);
    setFormData({
      petName: '',
      type: 'LOST',
      species: 'DOG',
      customSpecies: '',
      breed: '',
      primaryColor: '',
      size: 'MEDIANO',
      description: '',
      contactPhone: (session?.user as any)?.phone || '',
      reward: '',
      mediaUrl: '',
      latitude: null,
      longitude: null,
    });
  };

  // Abrir modal en modo de edición de reporte
  const handleOpenEdit = (report: Report, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingReport(report);
    const existingImgs = getReportImages(report.mediaUrl);
    setImagePreviews(existingImgs);
    setHasPickedLocation(true);

    setFormData({
      petName: report.petName || report.title || '',
      type: report.type,
      species: report.species || 'DOG',
      customSpecies: '',
      breed: report.breed || '',
      primaryColor: report.primaryColor || '',
      size: report.size || 'MEDIANO',
      description: report.description || '',
      contactPhone: report.contactPhone || '',
      reward: report.reward ? String(report.reward) : '',
      mediaUrl: report.mediaUrl || '',
      latitude: report.latitude,
      longitude: report.longitude,
    });
    setIsModalOpen(true);
  };

  // Abrir modal de creación de reporte asegurando sesión activa
  const handleOpenCreateReport = () => {
    if (!session?.user) {
      setIsAuthModalOpen(true);
      alert('🐾 Inicia sesión o regístrate para que tu reporte quede vinculado a tu perfil y puedas recibir notificaciones y mensajes en tu buzón.');
      return;
    }
    resetFormState();
    setIsModalOpen(true);
  };

  // Envío del nuevo reporte o actualización al Backend
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. OBLIGATORIO: Sesión de usuario
    if (!session?.user?.email) {
      setIsAuthModalOpen(true);
      alert('🔒 Es obligatorio iniciar sesión o crear tu cuenta comunitaria gratuita para publicar un reporte.');
      return;
    }

    // 2. OBLIGATORIO: Descripción
    if (!formData.description.trim()) {
      alert('Por favor ingresa una descripción para ayudar a identificar al perrito.');
      return;
    }

    // 3. OBLIGATORIO: Teléfono de contacto a 10 dígitos
    const cleanPhone = (formData.contactPhone || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      alert('📞 Es obligatorio ingresar tu número de teléfono de contacto a 10 dígitos para que las personas puedan comunicarse contigo.');
      return;
    }

    // 4. OBLIGATORIO: Ubicación en el mapa
    if (formData.latitude === null || formData.longitude === null || (!editingReport && !hasPickedLocation)) {
      alert('📍 Es obligatorio marcar la ubicación en el mapa o usar tu ubicación actual para situar al perrito.');
      return;
    }

    setIsSubmitting(true);
    try {
      const animalTypeName = formData.species === 'DOG' ? 'Perro'
        : formData.species === 'CAT' ? 'Gato'
        : formData.species === 'BIRD' ? 'Ave'
        : formData.species === 'RABBIT' ? 'Conejo'
        : formData.customSpecies.trim() || 'Mascota';

      const defaultTitle = formData.type === 'SIGHTING'
        ? `Avistamiento de ${animalTypeName}`
        : formData.type === 'ADOPTION'
        ? `${animalTypeName} en adopción`
        : `${animalTypeName} extraviado`;

      const breedValue = formData.species === 'OTHER' && formData.customSpecies.trim()
        ? (formData.breed.trim() ? `${formData.customSpecies.trim()} - ${formData.breed.trim()}` : formData.customSpecies.trim())
        : formData.breed.trim() || undefined;

      const mediaValue = imagePreviews.length === 1
        ? imagePreviews[0]
        : imagePreviews.length > 1
          ? JSON.stringify(imagePreviews)
          : formData.mediaUrl || undefined;

      // SI ESTAMOS EN MODO EDICIÓN:
      if (editingReport) {
        const updated = await updateReport(
          editingReport.id,
          {
            title: formData.petName.trim() || defaultTitle,
            petName: formData.petName.trim() || undefined,
            type: formData.type,
            species: formData.species,
            breed: breedValue,
            primaryColor: formData.primaryColor.trim() || undefined,
            size: formData.size || undefined,
            description: formData.description.trim(),
            contactPhone: cleanPhone,
            reward:
              formData.reward && !isNaN(Number(formData.reward)) && Number(formData.reward) > 0
                ? Number(formData.reward)
                : null,
            userEmail: session.user.email,
            mediaUrl: mediaValue,
            images: imagePreviews.length > 0 ? imagePreviews : undefined,
            latitude: formData.latitude,
            longitude: formData.longitude,
          },
          session.user.email
        );

        setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        setIsModalOpen(false);
        resetFormState();
        alert('🐾 ¡Publicación actualizada exitosamente!');
        return;
      }

      // SI ES UN REPORTE NUEVO:
      const created = await createReport({
        title: formData.petName.trim() || defaultTitle,
        petName: formData.petName.trim() || undefined,
        type: formData.type,
        species: formData.species,
        breed: breedValue,
        primaryColor: formData.primaryColor.trim() || undefined,
        size: formData.size || undefined,
        description: formData.description.trim(),
        contactPhone: cleanPhone,
        reward: formData.reward && !isNaN(Number(formData.reward)) && Number(formData.reward) > 0 ? Number(formData.reward) : null,
        userEmail: session.user.email,
        mediaUrl: mediaValue,
        images: imagePreviews.length > 0 ? imagePreviews : undefined,
        latitude: formData.latitude,
        longitude: formData.longitude,
      });

      // Añadimos reactivamente el reporte a la lista y seleccionamos
      setReports((prev) => [created, ...prev]);
      setSelectedReportId(created.id);
      setMapCenter(getOptimalFocusCenter(created.latitude, created.longitude));
      setMapZoom(16);

      // Cerramos modal y reseteamos campos
      setIsModalOpen(false);
      resetFormState();

      alert('🐾 ¡Reporte publicado con éxito! Ya está visible en el mapa y la comunidad.');
    } catch (err: any) {
      console.error('Error al guardar reporte:', err);
      alert(`Hubo un error al guardar el reporte: ${err.message || 'Verifica la conexión'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Marcar perrito como resuelto / encontrado (con control estricto de permisos)
  const handleMarkResolved = async (report: Report, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!session?.user?.email) {
      alert('🔒 Acción protegida: Inicia sesión con la cuenta dueña del reporte para marcar a tu mascota como encontrada.');
      setIsAuthModalOpen(true);
      return;
    }

    const isAdmin = (session.user as any)?.role === 'ADMIN';
    const userPhoneClean = ((session.user as any)?.phone || '').replace(/\D/g, '');
    const reportPhoneClean = (report.contactPhone || '').replace(/\D/g, '');
    const isPhoneOwner =
      Boolean(userPhoneClean.length >= 10 && reportPhoneClean.length >= 10 &&
      userPhoneClean.slice(-10) === reportPhoneClean.slice(-10));

    const isOwner =
      report.user?.email?.toLowerCase() === session.user.email?.toLowerCase() ||
      report.userId === (session.user as any)?.id ||
      isPhoneOwner;

    if (!isAdmin && !isOwner) {
      alert(
        'Únicamente el dueño que publicó este reporte o un administrador pueden marcarlo como resuelto y validar los puntos de rescate.'
      );
      return;
    }

    // Abrimos el panel de perfil en la pestaña de reportes donde el dueño puede seleccionar al rescatista y otorgar puntos
    setProfileModalTab('reports');
    setIsProfileModalOpen(true);
  };

  // Eliminar un reporte permanentemente (Admins pueden borrar cualquiera, Usuarios sus propios reportes)
  const handleDeleteReport = async (report: Report, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (!session?.user?.email) {
      alert('🔒 Inicia sesión para gestionar o eliminar reportes.');
      setIsAuthModalOpen(true);
      return;
    }

    const isAdmin = (session.user as any)?.role === 'ADMIN';
    const userPhoneClean = ((session.user as any)?.phone || '').replace(/\D/g, '');
    const reportPhoneClean = (report.contactPhone || '').replace(/\D/g, '');
    const isPhoneOwner =
      Boolean(userPhoneClean.length >= 10 && reportPhoneClean.length >= 10 &&
      userPhoneClean.slice(-10) === reportPhoneClean.slice(-10));

    const isOwner =
      report.user?.email?.toLowerCase() === session.user.email?.toLowerCase() ||
      report.userId === (session.user as any)?.id ||
      isPhoneOwner;

    if (!isAdmin && !isOwner) {
      alert('🔒 Únicamente el autor original de la publicación o un Administrador pueden eliminar este reporte.');
      return;
    }

    const petName = report.petName || report.title || 'este reporte';
    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar permanentemente el reporte de "${petName}"? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    try {
      await deleteReport(report.id, session.user.email);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
      if (selectedReportId === report.id) {
        setSelectedReportId(null);
      }
      if (triangulationData?.lostReport?.id === report.id) {
        setTriangulationData(null);
      }
      alert(`El reporte de "${petName}" ha sido eliminado exitosamente.`);
    } catch (err: any) {
      console.error('Error al eliminar el reporte:', err);
      alert(err.message || 'No se pudo eliminar el reporte. Por favor intenta de nuevo.');
    }
  };

  // Calcula el centro óptico para enfocar un reporte en el mapa
  // En móviles el mapa tiene menos altura disponible y hay barras de pestañas y botones,
  // por lo que una compensación de ~0.0015 centra perfectamente el marcador y el popup sin recortarse arriba.
  // En PC (pantallas grandes), una compensación de ~0.0026 ofrece un centrado óptico equilibrado.
  const getOptimalFocusCenter = (lat: number, lng: number): [number, number] => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    const offset = isMobile ? 0.0015 : 0.0026;
    return [lat + offset, lng];
  };

  // Alternar selección de perrito: hacer zoom a nivel de calle (16) o regresar al mapa completo (12)
  const handleCardClick = (report: Report) => {
    if (selectedReportId === report.id) {
      // Deseleccionar: regresar a vista general de SLP
      setSelectedReportId(null);
      setMapCenter(SLP_CENTER);
      setMapZoom(12);
    } else {
      // Enfocar y hacer zoom a nivel de calle (16) con compensación óptica para centrado perfecto
      setSelectedReportId(report.id);
      setMapCenter(getOptimalFocusCenter(report.latitude, report.longitude));
      setMapZoom(16);
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setMobileTab('map');
      }
    }
  };

  // Cuando se hace clic en un pin del mapa (viceversa)
  const handleMapMarkerClick = (report: Report) => {
    if (selectedReportId === report.id) {
      // Segundo clic en el mismo pin: deseleccionar y alejar
      setSelectedReportId(null);
      setMapCenter(SLP_CENTER);
      setMapZoom(12);
    } else {
      // Enfocar pin y hacer zoom a nivel de calle con compensación óptica
      setSelectedReportId(report.id);
      setMapCenter(getOptimalFocusCenter(report.latitude, report.longitude));
      setMapZoom(16);

      // Desplazar el feed suavemente hacia la tarjeta correspondiente
      setTimeout(() => {
        const cardEl = document.getElementById(`report-card-${report.id}`);
        if (cardEl) {
          cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  };

  // Al hacer clic fuera en el lienzo del mapa, restaurar vista general
  const handleDeselectMap = () => {
    setSelectedReportId(null);
    setMapCenter(SLP_CENTER);
    setMapZoom(12);
  };

  // Abrir modal de mensaje directo para un perrito
  const handleOpenSendMessage = (report: Report, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!session?.user) {
      setIsAuthModalOpen(true);
      return;
    }
    const userPhoneClean = ((session.user as any)?.phone || '').replace(/\D/g, '');
    const reportPhoneClean = (report.contactPhone || '').replace(/\D/g, '');
    const isPhoneOwner =
      Boolean(userPhoneClean.length >= 10 && reportPhoneClean.length >= 10 &&
      userPhoneClean.slice(-10) === reportPhoneClean.slice(-10));

    const isOwner =
      Boolean(session.user.email &&
      (report.user?.email?.toLowerCase() === session.user.email.toLowerCase() ||
       report.userId === (session.user as any)?.id ||
       isPhoneOwner));
    if (isOwner) {
      alert('Esta es tu propia publicación comunitaria.');
      return;
    }
    setMessagingReport(report);
    setMessageText(
      `Hola, te contacto por el reporte de "${report.petName || report.title}" en Perritos y Animales Perdidos.`
    );
  };

  // Enviar mensaje en la plataforma
  const handleSendMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messagingReport || !session?.user?.email || !messageText.trim()) return;

    setIsSendingMessage(true);
    try {
      const sent = await sendMessage({
        senderEmail: session.user.email,
        receiverEmail: messagingReport.user?.email,
        reportId: messagingReport.id,
        content: messageText.trim(),
      });

      const recipientName =
        sent.receiver?.name ||
        sent.receiver?.email ||
        (messagingReport.user && messagingReport.user.email !== 'anonimo@slp.com'
          ? messagingReport.user.name || messagingReport.user.email
          : 'el dueño del perrito');
      setMessageSuccessBanner(`¡Mensaje enviado a ${recipientName}! Podrás revisar las respuestas en tu buzón.`);
      setMessagingReport(null);
      setMessageText('');
      setTimeout(() => setMessageSuccessBanner(null), 6000);
    } catch (err: any) {
      alert(err.message || 'Error al enviar mensaje');
    } finally {
      setIsSendingMessage(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col bg-theme-page font-sans text-theme-main relative">
      {/* Header Dinámico con soporte de Temas */}
      <header
        className="sticky top-0 z-30 px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between shadow-md transition-all duration-300"
        style={{ background: 'var(--header-bg)', color: 'var(--header-text)' }}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 flex items-center justify-center text-xl sm:text-2xl shadow-inner shrink-0">
            🐶
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base sm:text-xl tracking-wide leading-tight truncate">
              Perritos y Animales Perdidos
            </h1>
            <p className="text-[11px] text-white/80 hidden sm:block truncate">
              Red comunitaria de rescate y adopción en San Luis Potosí
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Botón de Notificaciones a Primera Mano (Mensajes y Alertas IA) */}
          <button
            onClick={() => {
              if (session?.user) {
                setProfileModalTab('notifications');
                setIsProfileModalOpen(true);
              } else {
                setIsAuthModalOpen(true);
              }
            }}
            className="relative text-white/90 hover:text-white hover:bg-white/10 p-1.5 sm:p-2 rounded-full transition text-base sm:text-lg"
            title="Ver notificaciones y mensajes comunitarios"
          >
            <span>🔔</span>
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-paliacate text-white text-[9px] sm:text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center animate-bounce shadow-md border-2 border-white/60">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Botón de Selección de Tema / Paleta */}
          <button
            onClick={() => {
              if (session?.user) {
                setProfileModalTab('settings');
                setIsProfileModalOpen(true);
              } else {
                const themes = ['arena', 'dark', 'sunset', 'esperanza'];
                const next = themes[(themes.indexOf(currentTheme) + 1) % themes.length];
                handleThemeChange(next);
              }
            }}
            className="text-white/90 hover:text-white hover:bg-white/10 p-1.5 sm:p-2 rounded-full transition text-base sm:text-lg"
            title="Personalizar paleta de colores"
          >
            🎨
          </button>

          {/* Botón de recarga oculto en móviles para ahorrar espacio */}
          <button
            onClick={loadReports}
            className="hidden sm:flex text-white/90 hover:text-white hover:bg-white/10 p-2 rounded-full transition"
            title="Recargar reportes"
          >
            🔄
          </button>

          {/* Estado de Sesión / Perfil */}
          {session?.user ? (
            <button
              onClick={() => {
                setProfileModalTab('reports');
                setIsProfileModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-2 sm:px-3 py-1.5 rounded-full transition border border-white/20 text-xs sm:text-sm font-semibold"
              title="Ver mis reportes e historial"
            >
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || 'Usuario'}
                  className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover"
                />
              ) : (
                <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-paliacate text-white flex items-center justify-center text-[10px] sm:text-[11px] font-bold">
                  {(session.user.name || 'U')[0].toUpperCase()}
                </span>
              )}
              <span className="hidden sm:inline font-bold max-w-[90px] truncate">
                {session.user.name?.split(' ')[0] || 'Mi Perfil'}
              </span>
              {(session.user as any).role === 'ADMIN' && (
                <span className="text-[9px] sm:text-[10px] bg-amber-400 text-carbon font-extrabold px-1.5 py-0.5 rounded-full">
                  Admin
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="bg-white/10 hover:bg-white/20 text-white px-2.5 sm:px-3 py-1.5 rounded-full transition border border-white/20 text-xs sm:text-sm font-semibold flex items-center gap-1"
            >
              <span>👤</span> <span className="hidden sm:inline">Iniciar Sesión</span>
            </button>
          )}

          <button
            onClick={handleOpenCreateReport}
            className="bg-paliacate hover:opacity-90 active:scale-95 transition text-white font-bold px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-lg flex items-center gap-1 text-xs sm:text-sm shrink-0"
          >
            <span className="text-sm sm:text-base leading-none font-extrabold">+</span>
            <span>Reportar</span>
          </button>
        </div>
      </header>

      {/* Selector de Pestaña para Móviles (Android / iOS) */}
      <div className="lg:hidden flex bg-theme-surface border-b border-theme sticky top-[53px] sm:top-[65px] z-20 shadow-sm">
        <button
          onClick={() => setMobileTab('list')}
          className={`flex-1 py-2.5 text-center text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 border-b-2 transition ${
            mobileTab === 'list'
              ? 'border-paliacate text-paliacate bg-paliacate/10'
              : 'border-transparent text-theme-muted hover:text-theme-main'
          }`}
        >
          <span>📋</span> Ver Reportes ({filteredReports.length})
        </button>
        <button
          onClick={() => {
            setMobileTab('map');
            setTimeout(() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('resize'));
              }
            }, 60);
          }}
          className={`flex-1 py-2.5 text-center text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 border-b-2 transition ${
            mobileTab === 'map'
              ? 'border-paliacate text-paliacate bg-paliacate/10'
              : 'border-transparent text-theme-muted hover:text-theme-main'
          }`}
        >
          <span>🗺️</span> Ver Mapa
        </button>
      </div>

      {/* Barra de Filtros Interactiva */}
      <section className="bg-theme-surface shadow-sm border-b border-theme px-4 md:px-6 py-3 flex gap-2 md:gap-3 overflow-x-auto scrollbar-none z-10">
        <button
          onClick={() => setActiveFilter('ALL')}
          className={`px-4 py-1.5 rounded-full text-xs md:text-sm font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
            activeFilter === 'ALL'
              ? 'bg-paliacate text-white shadow-sm'
              : 'bg-theme-input text-theme-main border border-theme hover:opacity-80'
          }`}
        >
          <span>🐾</span> Todos
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
            {counts.all}
          </span>
        </button>

        <button
          onClick={() => setActiveFilter('LOST')}
          className={`px-4 py-1.5 rounded-full text-xs md:text-sm font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
            activeFilter === 'LOST'
              ? 'bg-paliacate text-white shadow-sm'
              : 'border border-paliacate/40 text-paliacate hover:bg-paliacate/10'
          }`}
        >
          <span>🚨</span> Perdidos
          <span className="text-[10px] bg-white/30 px-1.5 py-0.5 rounded-full">
            {counts.lost}
          </span>
        </button>

        <button
          onClick={() => setActiveFilter('ADOPTION')}
          className={`px-4 py-1.5 rounded-full text-xs md:text-sm font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
            activeFilter === 'ADOPTION'
              ? 'bg-confianza text-white shadow-sm'
              : 'border border-confianza/40 text-confianza hover:bg-confianza/10'
          }`}
        >
          <span>🏠</span> En Adopción
          <span className="text-[10px] bg-white/30 px-1.5 py-0.5 rounded-full">
            {counts.adoption}
          </span>
        </button>

        <button
          onClick={() => setActiveFilter('SIGHTING')}
          className={`px-4 py-1.5 rounded-full text-xs md:text-sm font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
            activeFilter === 'SIGHTING'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'border border-amber-600/40 text-amber-600 hover:bg-amber-500/10'
          }`}
        >
          <span>👀</span> Avistamientos
          <span className="text-[10px] bg-white/30 px-1.5 py-0.5 rounded-full">
            {counts.sighting}
          </span>
        </button>

        <button
          onClick={() => setActiveFilter('RESOLVED')}
          className={`px-4 py-1.5 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
            activeFilter === 'RESOLVED'
              ? 'bg-esperanza text-white shadow-md ring-2 ring-esperanza/40'
              : 'border border-esperanza/40 text-esperanza hover:bg-esperanza/10'
          }`}
        >
          <span>🎉</span> Casos de Éxito
          <span className="text-[10px] bg-white/30 px-1.5 py-0.5 rounded-full font-bold">
            {counts.resolved}
          </span>
        </button>

        <button
          onClick={() => setFilterNearby5km(!filterNearby5km)}
          className={`px-4 py-1.5 rounded-full text-xs md:text-sm font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
            filterNearby5km
              ? 'bg-esperanza text-white shadow-sm'
              : 'border border-theme text-theme-main bg-theme-input hover:opacity-80'
          }`}
        >
          <span>📍</span> A menos de 5km
        </button>

        {/* Selector de Especie Doméstica */}
        <div className="flex items-center gap-1 bg-theme-input p-1 rounded-full border border-theme shrink-0">
          {[
            { id: 'ALL', label: 'Todos', icon: '🐾' },
            { id: 'DOG' as Species, label: 'Perros', icon: '🐶' },
            { id: 'CAT' as Species, label: 'Gatos', icon: '🐱' },
            { id: 'BIRD' as Species, label: 'Aves', icon: '🦜' },
            { id: 'RABBIT' as Species, label: 'Conejos', icon: '🐰' },
            { id: 'OTHER' as Species, label: 'Otros', icon: '🐹' },
          ].map((sp) => (
            <button
              key={sp.id}
              onClick={() => setSpeciesFilter(sp.id as any)}
              className={`px-2.5 py-1 rounded-full text-xs font-bold transition flex items-center gap-1 ${
                speciesFilter === sp.id
                  ? 'bg-paliacate text-white shadow-xs'
                  : 'text-theme-muted hover:text-theme-main'
              }`}
            >
              <span>{sp.icon}</span>
              <span className="hidden sm:inline">{sp.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Grid Principal: Mapa a la izquierda, Feed a la derecha */}
      <section className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Mapa */}
        <div
          className={`w-full lg:w-1/2 h-[calc(100vh-185px)] lg:h-[calc(100vh-130px)] bg-gray-100 border-r border-gray-300 relative z-0 ${
            mobileTab === 'map' ? 'block' : 'hidden lg:block'
          }`}
        >
          {isMounted && (mobileTab === 'map' || (typeof window !== 'undefined' && window.innerWidth >= 1024)) ? (
            <Map
              reports={filteredReports}
              selectedReportId={selectedReportId}
              onSelectReport={handleMapMarkerClick}
              onDeselectReport={handleDeselectMap}
              zoom={mapZoom}
              centerCoords={mapCenter}
              onOpenMessageModal={(report) => handleOpenSendMessage(report)}
              onOpenLightbox={(imgs, idx) => setLightboxData({ images: imgs, index: idx })}
              triangulationData={triangulationData}
              onExitTriangulation={() => setTriangulationData(null)}
              isPickingLocation={isPickingOnMap}
              pickedLocation={
                isPickingOnMap && formData.latitude !== null && formData.longitude !== null
                  ? { latitude: formData.latitude, longitude: formData.longitude }
                  : null
              }
              onLocationPicked={(lat, lng) => {
                setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
                setHasPickedLocation(true);
                setIsPickingOnMap(false);
                if (!session?.user) {
                  setIsAuthModalOpen(true);
                  alert('🐾 Inicia sesión o regístrate para que tu reporte quede vinculado a tu perfil y puedas recibir notificaciones y mensajes en tu buzón.');
                  return;
                }
                setIsModalOpen(true);
              }}
              activeTab={mobileTab}
              onEditReport={(rep) => handleOpenEdit(rep)}
              currentUserEmail={session?.user?.email || undefined}
              currentUserId={(session?.user as any)?.id || undefined}
              currentUserPhone={(session?.user as any)?.phone || undefined}
              isAdmin={(session?.user as any)?.role === 'ADMIN'}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 text-carbon/60">
              <span className="text-3xl animate-bounce mb-2">🗺️</span>
              <p className="font-semibold text-sm">Cargando mapa interactivo...</p>
            </div>
          )}
        </div>

        {/* Feed de Reportes Reales */}
        <div
          ref={feedRef}
          className={`w-full lg:w-1/2 p-4 md:p-6 overflow-y-auto h-[calc(100vh-185px)] lg:h-[calc(100vh-130px)] ${
            mobileTab === 'list' ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-theme-main flex items-center gap-2">
                {activeFilter === 'RESOLVED' ? (
                  <><span>🎉</span> Casos de Éxito Comunitarios</>
                ) : (
                  <>Últimos Reportes</>
                )}
              </h2>
              <p className="text-xs text-theme-muted">
                {activeFilter === 'RESOLVED'
                  ? `Celebrando ${filteredReports.length} ${filteredReports.length === 1 ? 'perrito recuperado' : 'perritos recuperados'} con sus familias`
                  : `Mostrando ${filteredReports.length} ${filteredReports.length === 1 ? 'reporte' : 'reportes'} en San Luis Potosí`
                }
              </p>
            </div>
            {filterNearby5km && (
              <span className="text-xs font-bold text-esperanza bg-esperanza/10 px-2.5 py-1 rounded-full border border-esperanza/30">
                📍 Filtrando a &lt; 5km
              </span>
            )}
          </div>

          {/* Mensaje de error de conexión */}
          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-xl text-sm mb-4 flex items-center justify-between">
              <div>
                <p className="font-bold">Aviso de conexión:</p>
                <p>{errorMessage}</p>
              </div>
              <button
                onClick={loadReports}
                className="bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-red-700"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Spinner de carga */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-theme-muted">
              <div className="w-10 h-10 border-4 border-paliacate border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="font-semibold text-sm">Buscando reportes comunitarios...</p>
            </div>
          )}

          {/* Sin resultados */}
          {!loading && filteredReports.length === 0 && (
            <div className="bg-theme-surface rounded-2xl p-8 text-center border border-theme shadow-sm my-6">
              <span className="text-4xl block mb-2">{activeFilter === 'RESOLVED' ? '🏆' : '🐾'}</span>
              <h3 className="font-bold text-lg text-theme-main">
                {activeFilter === 'RESOLVED'
                  ? 'Aún no hay casos de éxito registrados'
                  : 'No hay reportes con este filtro'}
              </h3>
              <p className="text-sm text-theme-muted mt-1 max-w-sm mx-auto">
                {activeFilter === 'RESOLVED'
                  ? 'Cuando un perrito sea encontrado o adoptado, márcalo como resuelto para inspirar y celebrar con la comunidad potosina.'
                  : 'Sé el primero en reportar un perrito perdido o en adopción en esta zona.'}
              </p>
              <button
                onClick={handleOpenCreateReport}
                className="mt-4 bg-paliacate hover:opacity-90 text-white text-sm font-bold px-5 py-2.5 rounded-full shadow transition"
              >
                + Crear Nuevo Reporte
              </button>
            </div>
          )}

          {/* Lista de Tarjetas Dinámicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredReports.map((report) => {
              const isSelected = selectedReportId === report.id;
              const refLat = userCoords?.latitude ?? SLP_CENTER[0];
              const refLng = userCoords?.longitude ?? SLP_CENTER[1];
              const dist = calculateDistanceKm(
                refLat,
                refLng,
                report.latitude,
                report.longitude
              ).toFixed(1);

              return (
                <article
                  key={report.id}
                  id={`report-card-${report.id}`}
                  onClick={() => handleCardClick(report)}
                  className={`bg-theme-surface rounded-2xl shadow-sm border transition-all duration-300 overflow-hidden flex flex-col cursor-pointer ${
                    isSelected
                      ? 'ring-4 ring-paliacate border-paliacate shadow-2xl scale-[1.02] bg-paliacate/5 dark:bg-paliacate/10'
                      : 'border-theme hover:border-gray-400 hover:shadow-md'
                  }`}
                >
                  {/* Banner de Enfoque Activo en el Mapa */}
                  {isSelected && (
                    <div className="bg-paliacate text-white text-[11px] font-extrabold px-3 py-1.5 flex items-center justify-between shadow-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                        🎯 Enfocado en el mapa (Nivel de calle)
                      </span>
                      <span className="text-[10px] bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-full transition">
                        ✕ Clic para alejar
                      </span>
                    </div>
                  )}

                  {/* Galería de Fotografías Completa y Sin Recortes */}
                  <ReportCardGallery
                    mediaUrl={report.mediaUrl}
                    title={report.petName || report.title}
                    status={report.status}
                    type={report.type}
                    reward={report.reward}
                    createdAt={report.createdAt}
                    onOpenLightbox={(imgs, idx) => setLightboxData({ images: imgs, index: idx })}
                  />

                  {/* Contenido de la Tarjeta */}
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-sm sm:text-base text-theme-main leading-snug">
                          {report.petName || report.title}
                        </h3>
                        <span className="text-[11px] font-semibold text-theme-muted whitespace-nowrap">
                          📍 {dist} km
                        </span>
                      </div>
                      <ExpandableText text={report.description} limit={75} />

                      {/* Banner de Recompensa Activa */}
                      {report.status === 'ACTIVE' && report.reward && report.reward > 0 && (
                        <div className="mt-1.5 p-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between">
                          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <span>💰</span> Recompensa:
                          </span>
                          <span className="text-[11px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/20 px-1.5 py-0.2 rounded-md">
                            ${Number(report.reward).toLocaleString('es-MX')} MXN
                          </span>
                        </div>
                      )}

                      {/* Banner de Caso de Éxito */}
                      {report.status === 'RESOLVED' && (
                        <div className="mt-1.5 p-1.5 bg-esperanza/10 border border-esperanza/30 rounded-lg flex items-center gap-1.5 text-[11px] font-bold text-esperanza">
                          <span>🎉</span> ¡Perrito reunido felizmente con su familia!
                        </div>
                      )}
                    </div>

                    <div className="mt-2 pt-2 border-t border-theme flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        {/* Botón de Resolver si está activo */}
                        {report.status === 'ACTIVE' ? (
                          <button
                            onClick={(e) => handleMarkResolved(report, e)}
                            title="Marcar como encontrado o resuelto"
                            className="text-[10px] font-semibold text-theme-muted hover:text-esperanza transition cursor-pointer"
                          >
                            ¿Ya fue encontrado?
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-esperanza">
                            Caso de éxito comunitario
                          </span>
                        )}

                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          {/* Botón de Editar y Eliminar Reporte (Visible para el Dueño o un Administrador) */}
                          {(() => {
                            const isAdmin = (session?.user as any)?.role === 'ADMIN';
                            const userPhoneClean = ((session?.user as any)?.phone || '').replace(/\D/g, '');
                            const reportPhoneClean = (report.contactPhone || '').replace(/\D/g, '');
                            const isPhoneOwner =
                              Boolean(userPhoneClean.length >= 10 && reportPhoneClean.length >= 10 &&
                              userPhoneClean.slice(-10) === reportPhoneClean.slice(-10));

                            const isOwner =
                              Boolean(session?.user?.email &&
                              (report.user?.email?.toLowerCase() === session?.user?.email?.toLowerCase() ||
                                report.userId === (session?.user as any)?.id ||
                                isPhoneOwner));
                            if (!isAdmin && !isOwner) return null;

                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenEdit(report, e)}
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-paliacate/10 hover:bg-paliacate/20 text-paliacate border border-paliacate/30 transition flex items-center gap-1 cursor-pointer"
                                  title={isAdmin ? 'Editar publicación (Permiso Administrador)' : 'Editar los datos y fotos de mi publicación'}
                                >
                                  <span>✏️</span> Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteReport(report, e)}
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 transition flex items-center gap-1 cursor-pointer"
                                  title={isAdmin ? 'Eliminar reporte (Permiso Administrador)' : 'Eliminar mi publicación permanentemente'}
                                >
                                  <span>🗑️</span> Eliminar
                                </button>
                              </>
                            );
                          })()}

                          {/* Botón de Triangulación Rápida si es un reporte de animal perdido */}
                          {report.type === 'LOST' && (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  const triData = await getTriangulationData(report.id);
                                  const relevantSightings = reports.filter(
                                    (s) => s.type === 'SIGHTING' && (s.species === report.species || !report.species)
                                  );

                                  if (!relevantSightings || relevantSightings.length === 0) {
                                    alert('⏱️ Aún no se han registrado avistamientos comunitarios recientes para este perrito o ha transcurrido el tiempo límite de triangulación.\n\nTe mostramos la última ubicación conocida y el radio de dispersión estimado en el mapa.');
                                  }

                                  setTriangulationData({
                                    lostReport: report,
                                    sightings: relevantSightings,
                                    details: triData,
                                  });
                                  setMapCenter([report.latitude, report.longitude]);
                                  setMapZoom(13);
                                  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                                    setMobileTab('map');
                                  }
                                } catch (err) {
                                  console.error('Error calculando triangulación:', err);
                                  alert('⏱️ Ya ha transcurrido el tiempo límite para estimar la ruta o aún no hay avistamientos registrados para este reporte.\n\nMostrando ubicación original.');
                                  setMapCenter([report.latitude, report.longitude]);
                                  setMapZoom(13);
                                  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                                    setMobileTab('map');
                                  }
                                }
                              }}
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition flex items-center gap-1 cursor-pointer"
                              title="Calcular área de búsqueda espacial según especie y tiempo"
                            >
                              <span>📐</span> Triangular
                            </button>
                          )}

                          {/* Botón de Alternar Foco en el Mapa */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCardClick(report);
                            }}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg transition flex items-center gap-1 ${
                              isSelected
                                ? 'bg-paliacate text-white'
                                : 'bg-theme-input text-theme-muted hover:text-theme-main border border-theme'
                            }`}
                          >
                            {isSelected ? '✕ Alejar' : '🔍 Enfocar'}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pt-0.5">
                        {/* Botón de Mensajería en Plataforma */}
                        <button
                          type="button"
                          onClick={(e) => handleOpenSendMessage(report, e)}
                          className="flex-1 bg-confianza hover:opacity-90 active:scale-95 text-white text-xs font-bold py-1 px-2.5 rounded-lg transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                          title="Enviar mensaje en la plataforma"
                        >
                          <span>💬</span> Enviar Mensaje
                        </button>

                        {/* Botón de Contacto por WhatsApp */}
                        {report.contactPhone && (
                          <a
                            href={`https://wa.me/${report.contactPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                              `Hola, te contacto por el reporte de ${report.petName || report.title} en Perritos Perdidos SLP`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 bg-green-500 hover:bg-green-600 active:scale-95 text-white text-xs font-bold py-1 px-2.5 rounded-lg transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                            title="Contactar al dueño directamente por WhatsApp"
                          >
                            <span>📱</span> WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Botón Flotante para Móviles (+ Reportar) */}
      <button
        onClick={handleOpenCreateReport}
        className="lg:hidden fixed bottom-6 right-6 z-40 bg-paliacate hover:opacity-95 text-white font-bold px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 text-base active:scale-95 transition"
      >
        <span className="text-xl leading-none">+</span> Reportar
      </button>

      {/* MODAL DE NUEVO REPORTE O EDICIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-theme-surface text-theme-main rounded-3xl w-full max-w-lg p-6 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto border border-theme transition-colors">
            <button
              onClick={() => {
                setIsModalOpen(false);
                resetFormState();
              }}
              className="absolute top-5 right-5 text-theme-muted hover:text-theme-main font-bold text-2xl w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer"
            >
              ×
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">{editingReport ? '✏️' : '📝'}</span>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-theme-main">
                  {editingReport ? 'Modificar Publicación' : 'Publicar Nuevo Reporte'}
                </h2>
                {editingReport && (
                  <p className="text-xs text-theme-muted mt-0.5">
                    Modifica los datos que necesites o gestiona tus fotografías (puedes agregar las fotos faltantes o cambiarlas hasta 3).
                  </p>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmitReport} className="flex flex-col gap-4">
              {/* Tipo de Reporte */}
              <div>
                <label className="block text-xs font-bold text-theme-main uppercase tracking-wider mb-1.5">
                  Tipo de Reporte *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'LOST' })}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition ${
                      formData.type === 'LOST'
                        ? 'bg-paliacate text-white border-paliacate shadow-sm'
                        : 'border-theme text-theme-main bg-theme-input hover:opacity-80'
                    }`}
                  >
                    🚨 Perdido
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'ADOPTION', reward: '' })}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition ${
                      formData.type === 'ADOPTION'
                        ? 'bg-confianza text-white border-confianza shadow-sm'
                        : 'border-theme text-theme-main bg-theme-input hover:opacity-80'
                    }`}
                  >
                    🏠 Adopción
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'SIGHTING', reward: '' })}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition ${
                      formData.type === 'SIGHTING'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                        : 'border-theme text-theme-main bg-theme-input hover:opacity-80'
                    }`}
                  >
                    👀 Avistamiento
                  </button>
                </div>
              </div>

              {/* Especie del Animal (Multi-Especie Doméstica) */}
              <div>
                <label className="block text-xs font-bold text-theme-main uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Especie del Animal *</span>
                  <span className="text-[10px] text-theme-muted font-normal">Ajusta la velocidad de búsqueda</span>
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { id: 'DOG' as Species, label: 'Perro', icon: '🐶' },
                    { id: 'CAT' as Species, label: 'Gato', icon: '🐱' },
                    { id: 'BIRD' as Species, label: 'Ave', icon: '🦜' },
                    { id: 'RABBIT' as Species, label: 'Conejo', icon: '🐰' },
                    { id: 'OTHER' as Species, label: 'Otro', icon: '🐾' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, species: s.id })}
                      className={`py-2 px-1 text-center rounded-xl border text-xs font-bold transition flex flex-col items-center gap-0.5 ${
                        formData.species === s.id
                          ? 'bg-paliacate text-white border-paliacate shadow-xs'
                          : 'border-theme text-theme-main bg-theme-input hover:opacity-80'
                      }`}
                    >
                      <span className="text-base">{s.icon}</span>
                      <span className="text-[10px]">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rasgos Físicos (Raza, Color Principal y Tamaño) */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-theme-muted mb-1">Raza (Opcional)</label>
                  <input
                    type="text"
                    value={formData.breed}
                    onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                    placeholder="Ej. Mestizo, Siamés..."
                    className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-theme-muted mb-1">Color Principal</label>
                  <input
                    type="text"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    placeholder="Ej. Café, Blanco..."
                    className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-theme-muted mb-1">Tamaño</label>
                  <select
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                  >
                    <option value="PEQUEÑO">Pequeño</option>
                    <option value="MEDIANO">Mediano</option>
                    <option value="GRANDE">Grande</option>
                  </select>
                </div>
              </div>

              {/* Campo extra para especificar cuando la especie seleccionada es 'OTRO' */}
              {formData.species === 'OTHER' && (
                <div className="bg-theme-input/50 p-3 rounded-2xl border border-theme animate-fadeIn">
                  <label className="block text-xs font-bold text-theme-main uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>¿Qué tipo de animal o especie es? *</span>
                    <span className="text-[10px] text-paliacate font-bold">Especifica especie</span>
                  </label>
                  <input
                    type="text"
                    required={formData.species === 'OTHER'}
                    value={formData.customSpecies}
                    onChange={(e) => setFormData({ ...formData, customSpecies: e.target.value })}
                    placeholder="Ej. Hurón, Tortuga, Erizo, Caballo, Loro..."
                    className="w-full bg-theme-surface border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main font-semibold"
                  />
                </div>
              )}

              {/* Nombre o Referencia Dinámico según la Especie */}
              <div>
                <label className="block text-xs font-bold text-theme-main uppercase tracking-wider mb-1.5">
                  {(() => {
                    const animalLabel =
                      formData.species === 'DOG'
                        ? 'Perro'
                        : formData.species === 'CAT'
                        ? 'Gato'
                        : formData.species === 'BIRD'
                        ? 'Ave'
                        : formData.species === 'RABBIT'
                        ? 'Conejo'
                        : formData.customSpecies.trim() || 'Animal';

                    return formData.type === 'SIGHTING'
                      ? `Referencia o Nombre del ${animalLabel} Visto`
                      : `Nombre del ${animalLabel} / Referencia`;
                  })()}
                </label>
                <input
                  type="text"
                  value={formData.petName}
                  onChange={(e) => setFormData({ ...formData, petName: e.target.value })}
                  placeholder={(() => {
                    if (formData.species === 'DOG') {
                      return formData.type === 'SIGHTING'
                        ? 'Ej. Perro mestizo café visto en glorieta, collar rojo...'
                        : 'Ej. Solovino, Firulais, Golden Retriever...';
                    }
                    if (formData.species === 'CAT') {
                      return formData.type === 'SIGHTING'
                        ? 'Ej. Gato siamés con collar azul visto en azotea...'
                        : 'Ej. Michi, Minino, Siamés...';
                    }
                    if (formData.species === 'BIRD') {
                      return formData.type === 'SIGHTING'
                        ? 'Ej. Perico australiano verde visto en parque...'
                        : 'Ej. Piolín, Ninfa, Cotorro...';
                    }
                    if (formData.species === 'RABBIT') {
                      return formData.type === 'SIGHTING'
                        ? 'Ej. Conejo blanco enano visto en jardín...'
                        : 'Ej. Tambor, Orejitas, Manchas...';
                    }
                    return formData.type === 'SIGHTING'
                      ? `Ej. ${formData.customSpecies.trim() || 'Animal'} visto cruzando la calle...`
                      : `Ej. Nombre de la mascota o seña particular...`;
                  })()}
                  className="w-full bg-theme-input border border-theme rounded-xl p-3 text-sm outline-none focus:border-paliacate text-theme-main"
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-bold text-theme-main uppercase tracking-wider mb-1.5">
                  {formData.type === 'SIGHTING'
                    ? 'Descripción del Avistamiento *'
                    : 'Descripción Detallada *'}
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={
                    formData.type === 'SIGHTING'
                      ? '¿Dónde lo viste exactamente, hacia qué calle iba, señas particulares o estado?'
                      : 'Talla, color de pelaje, señas particulares, collar, o situación...'
                  }
                  className="w-full bg-theme-input border border-theme rounded-xl p-3 text-sm outline-none focus:border-paliacate text-theme-main resize-none"
                />
              </div>

              {/* Teléfono / WhatsApp */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-theme-main uppercase tracking-wider">
                    Teléfono / WhatsApp de Contacto *
                  </label>
                  <span className="text-[10px] text-paliacate font-bold">
                    Obligatorio a 10 dígitos
                  </span>
                </div>
                <input
                  type="tel"
                  required
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  placeholder="Ej. 4441234567"
                  className="w-full bg-theme-input border border-theme rounded-xl p-3 text-sm outline-none focus:border-paliacate text-theme-main"
                />
                <p className="text-[11px] text-theme-muted mt-1">
                  Permitirá que la comunidad o el dueño te contacte por WhatsApp o llamada con 1 toque.
                </p>
              </div>

              {/* Recompensa Económica (Solo aplica si el reporte es de un perrito PERDIDO) */}
              {formData.type === 'LOST' && (
                <div>
                  <label className="block text-xs font-bold text-theme-main uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>💰 Recompensa (Opcional - MXN)</span>
                    <span className="text-[10px] text-amber-500 font-bold">Incentivo de rescate</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-theme-muted">
                      $
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={formData.reward}
                      onChange={(e) => setFormData({ ...formData, reward: e.target.value })}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      placeholder="Ej. 1000"
                      className="w-full bg-theme-input border border-theme rounded-xl pl-8 pr-3 py-2.5 text-sm outline-none focus:border-paliacate text-theme-main font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[11px] text-theme-muted mr-1">Rápidos:</span>
                    {[300, 500, 1000, 2000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setFormData({ ...formData, reward: String(amt) })}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                          formData.reward === String(amt)
                            ? 'bg-amber-400 text-carbon border-amber-400 shadow-xs'
                            : 'bg-theme-input border-theme text-theme-muted hover:text-theme-main hover:border-amber-400'
                        }`}
                      >
                        ${amt.toLocaleString('es-MX')}
                      </button>
                    ))}
                    {formData.reward && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, reward: '' })}
                        className="text-[11px] text-red-400 hover:text-red-500 underline ml-auto"
                      >
                        Sin recompensa
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-theme-muted mt-1">
                    Monto ofrecido a quien devuelva al perrito o brinde información clave.
                  </p>
                </div>
              )}

              {/* Fotografías de la Mascota (Hasta 3 fotos completas) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-theme-main uppercase tracking-wider flex items-center gap-1.5">
                    <span>📷</span>
                    <span>Fotografías ({imagePreviews.length}/3)</span>
                  </label>
                  <span className="text-[10px] text-theme-muted font-normal">
                    Hasta 3 fotos completas
                  </span>
                </div>

                <p className="text-[11px] text-theme-muted mb-2.5">
                  Sube hasta 3 fotos (de frente, cuerpo entero o señas). Se mostrarán completas sin cortar la cabeza o patas.
                </p>

                {/* Inputs ocultos para Cámara directa y Galería con selección múltiple */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageFileChange}
                  className="hidden"
                />

                {/* Previsualizaciones de fotos subidas (1 a 3 fotos) */}
                {imagePreviews.length > 0 && (
                  <div className={`grid gap-2 mb-3 ${imagePreviews.length === 1 ? 'grid-cols-1' : imagePreviews.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {imagePreviews.map((img, idx) => (
                      <div
                        key={idx}
                        className={`relative rounded-2xl overflow-hidden border-2 border-paliacate/80 bg-zinc-950 flex items-center justify-center shadow-md group ${
                          imagePreviews.length === 1 ? 'h-52' : 'h-36'
                        }`}
                      >
                        {/* Ambient blur */}
                        <img
                          src={img}
                          alt=""
                          aria-hidden="true"
                          className="absolute inset-0 w-full h-full object-cover blur-md opacity-30 scale-110 pointer-events-none select-none"
                        />
                        {/* Foto completa sin recortes */}
                        <img
                          src={img}
                          alt={`Foto ${idx + 1}`}
                          className="relative z-10 max-h-full max-w-full object-contain"
                        />
                        {/* Badge de orden */}
                        <div className="absolute top-2 left-2 z-20 bg-black/75 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-xs shadow">
                          {idx === 0 ? '⭐ Principal' : `Foto ${idx + 1}`}
                        </div>
                        {/* Botón quitar foto */}
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="absolute top-2 right-2 z-20 bg-red-600 hover:bg-red-700 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition cursor-pointer"
                          title="Quitar esta foto"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Botones de acción para agregar fotos (si tiene menos de 3) */}
                {imagePreviews.length < 3 ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={isCompressingPhotos}
                      onClick={() => cameraInputRef.current?.click()}
                      className="py-3 px-3 rounded-2xl bg-paliacate/10 hover:bg-paliacate/20 border-2 border-dashed border-paliacate/60 text-paliacate font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-1 transition active:scale-95 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <span className="text-2xl">📷</span>
                      <span>{imagePreviews.length === 0 ? 'Tomar Foto' : '+ Tomar otra foto'}</span>
                      <span className="text-[10px] text-paliacate/80 font-medium">Cámara directa</span>
                    </button>

                    <button
                      type="button"
                      disabled={isCompressingPhotos}
                      onClick={() => galleryInputRef.current?.click()}
                      className="py-3 px-3 rounded-2xl bg-theme-input hover:opacity-80 border-2 border-dashed border-theme text-theme-main font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-1 transition active:scale-95 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <span className="text-2xl">🖼️</span>
                      <span>{imagePreviews.length === 0 ? 'Subir Galería' : '+ Agregar foto'}</span>
                      <span className="text-[10px] text-theme-muted font-normal">
                        {imagePreviews.length === 0 ? 'Selecciona hasta 3 fotos' : `Quedan ${3 - imagePreviews.length} disponibles`}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-esperanza/10 border border-esperanza/30 text-esperanza text-xs font-bold text-center flex items-center justify-center gap-1.5 shadow-xs">
                    <span>✓</span>
                    <span>Has añadido el máximo de 3 fotografías permitidas.</span>
                  </div>
                )}

                {/* Opción alternativa: pegar enlace de imagen web */}
                {imagePreviews.length < 3 && (
                  <div className="mt-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-theme-muted shrink-0">O por enlace:</span>
                      <input
                        type="url"
                        placeholder="https://ejemplo.com/foto.jpg"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = (e.target as HTMLInputElement).value.trim();
                            if (val && imagePreviews.length < 3) {
                              setImagePreviews((prev) => [...prev, val].slice(0, 3));
                              (e.target as HTMLInputElement).value = '';
                            }
                          }
                        }}
                        className="flex-1 bg-theme-input border border-theme rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-paliacate text-theme-main"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Selección de Ubicación Obligatoria */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-theme-main uppercase tracking-wider">
                    Ubicación en el Mapa *
                  </label>
                  {hasPickedLocation || editingReport ? (
                    <span className="text-[11px] font-bold text-esperanza flex items-center gap-1">
                      <span>✓</span> Ubicación fijada
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-amber-500 animate-pulse flex items-center gap-1">
                      <span>⚠️</span> Obligatoria
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleUseCurrentGPS}
                    className="flex-1 bg-theme-input hover:opacity-80 text-theme-main border border-theme text-xs font-bold py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5"
                  >
                    <span>📍</span> Usar mi ubicación actual
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setIsPickingOnMap(true);
                      setMobileTab('map');
                    }}
                    className="flex-1 bg-confianza/10 text-confianza hover:bg-confianza/20 text-xs font-bold py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 border border-confianza/30"
                  >
                    <span>🗺️</span> Marcar en el mapa
                  </button>
                </div>

                {hasPickedLocation || editingReport ? (
                  <div className="p-3 rounded-2xl bg-esperanza/10 border border-esperanza/30 flex items-center justify-between gap-2.5 mt-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-esperanza font-bold text-base">✅</span>
                      <div>
                        <strong className="text-esperanza block font-bold">Ubicación lista</strong>
                        <span className="text-theme-muted text-[11px]">
                          Coordenadas: {formData.latitude !== null && formData.longitude !== null ? `${formData.latitude.toFixed(4)}, ${formData.longitude.toFixed(4)}` : 'Fijada'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        setIsPickingOnMap(true);
                        setMobileTab('map');
                      }}
                      className="text-[11px] font-bold text-paliacate hover:underline shrink-0"
                    >
                      Cambiar punto
                    </button>
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-amber-500/10 border-2 border-dashed border-amber-500/40 flex items-center gap-2.5 mt-2">
                    <span className="text-xl shrink-0">📍</span>
                    <div className="flex-1 text-xs">
                      <strong className="text-amber-600 dark:text-amber-400 block font-bold">
                        Ubicación pendiente requerida
                      </strong>
                      <span className="text-theme-muted text-[11px]">
                        Para evitar encimar perritos, presiona "Usar mi ubicación actual" o "Marcar en el mapa".
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Botón de Publicación o Guardar Cambios con Opción de Cancelar */}
              <div className="flex items-center gap-3 mt-4 pt-2 border-t border-theme">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetFormState();
                  }}
                  className="flex-1 bg-theme-input hover:bg-gray-200 dark:hover:bg-zinc-800 text-theme-muted hover:text-theme-main font-bold py-3 rounded-2xl transition border border-theme text-sm sm:text-base cursor-pointer text-center"
                >
                  ✕ Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || (!editingReport && !hasPickedLocation)}
                  className="flex-[2] bg-paliacate hover:opacity-95 text-white font-bold py-3 rounded-2xl transition disabled:opacity-50 shadow-lg text-sm sm:text-base active:scale-[0.98] cursor-pointer"
                >
                  {isSubmitting
                    ? editingReport
                      ? 'Guardando cambios...'
                      : 'Publicando reporte...'
                    : !editingReport && !hasPickedLocation
                    ? '📍 Falta fijar ubicación'
                    : editingReport
                    ? '💾 Guardar Cambios'
                    : '🐾 Publicar Reporte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modales de Autenticación y Perfil de Usuario */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => window.location.reload()}
      />
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        initialTab={profileModalTab}
        currentTheme={currentTheme}
        onThemeChange={handleThemeChange}
        allReports={reports}
        onSelectReport={(report) => {
          handleCardClick(report);
          setIsProfileModalOpen(false);
        }}
        onEditReport={(report) => handleOpenEdit(report)}
        onReportUpdated={(updatedReport) => {
          setReports((prev) =>
            prev.map((r) => (r.id === updatedReport.id ? updatedReport : r))
          );
        }}
        onReportDeleted={(deletedReportId) => {
          setReports((prev) => prev.filter((r) => r.id !== deletedReportId));
          if (selectedReportId === deletedReportId) {
            setSelectedReportId(null);
          }
          if (triangulationData?.lostReport?.id === deletedReportId) {
            setTriangulationData(null);
          }
        }}
        onTriangulateReport={(lostReport, sightings, triDetails) => {
          setTriangulationData({ lostReport, sightings, details: triDetails });
          const centerLat = triDetails?.anchorPoint ? triDetails.anchorPoint.latitude : lostReport.latitude;
          const centerLng = triDetails?.anchorPoint ? triDetails.anchorPoint.longitude : lostReport.longitude;
          setMapCenter([centerLat, centerLng]);
          setMapZoom(14);
          if (window.innerWidth < 1024) {
            setMobileTab('map');
          }
        }}
      />

      {/* MODAL PARA ENVIAR MENSAJE DIRECTO EN PLATAFORMA */}
      {messagingReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-theme-surface text-theme-main rounded-3xl w-full max-w-md p-6 shadow-2xl relative border border-theme animate-scaleUp">
            <button
              onClick={() => setMessagingReport(null)}
              className="absolute top-5 right-5 text-theme-muted hover:text-theme-main font-bold text-2xl w-8 h-8 rounded-full flex items-center justify-center transition"
            >
              ×
            </button>

            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-theme">
              {getPrimaryImage(messagingReport.mediaUrl) ? (
                <img
                  src={getPrimaryImage(messagingReport.mediaUrl)!}
                  alt={messagingReport.title}
                  className="w-14 h-14 rounded-2xl object-cover border border-theme shadow-xs shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-paliacate/10 text-paliacate flex items-center justify-center text-2xl shrink-0">
                  🐶
                </div>
              )}
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-confianza uppercase tracking-wider block">
                  Mensaje Comunitario
                </span>
                <h3 className="font-bold text-base text-theme-main truncate">
                  {messagingReport.petName || messagingReport.title}
                </h3>
                <p className="text-xs text-theme-muted truncate">
                  Para:{' '}
                  <strong>
                    {messagingReport.user && messagingReport.user.email !== 'anonimo@slp.com'
                      ? messagingReport.user.name || messagingReport.user.email
                      : 'Dueño / Rescatista'}
                  </strong>
                </p>
              </div>
            </div>

            {/* Sugerencias Rápidas de Texto */}
            <div className="mb-3">
              <label className="block text-[11px] font-bold text-theme-muted uppercase mb-1.5">
                Mensajes rápidos:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  '¡Hola! Vi a tu perrito cerca de...',
                  'Tengo información sobre el perrito.',
                  '¿Sigue extraviado? Quiero ayudar.',
                ].map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setMessageText(sug)}
                    className="text-[11px] bg-theme-input hover:bg-theme-input/80 border border-theme px-2.5 py-1 rounded-lg text-theme-muted hover:text-theme-main transition"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSendMessageSubmit} className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-bold text-theme-main mb-1">
                  Tu Mensaje *
                </label>
                <textarea
                  rows={4}
                  required
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Escribe detalles claros, ubicación o cómo pueden coordinar..."
                  className="w-full bg-theme-input border border-theme rounded-2xl p-3 text-xs text-theme-main outline-none focus:border-paliacate transition resize-none"
                />
              </div>

              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setMessagingReport(null)}
                  className="flex-1 bg-theme-input border border-theme text-theme-muted font-bold py-2.5 rounded-xl text-xs hover:text-theme-main transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSendingMessage || !messageText.trim()}
                  className="flex-1 bg-confianza hover:opacity-90 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <span>📨</span> {isSendingMessage ? 'Enviando...' : 'Enviar Mensaje'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BANNER FLOTANTE DE NOTIFICACIÓN DE MENSAJE ENVIADO */}
      {messageSuccessBanner && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-carbon text-white text-xs font-semibold px-5 py-3 rounded-2xl shadow-2xl border border-white/20 flex items-center gap-3 animate-bounce">
          <span>📨</span>
          <span>{messageSuccessBanner}</span>
          <button
            onClick={() => {
              setMessageSuccessBanner(null);
              setIsProfileModalOpen(true);
            }}
            className="bg-paliacate hover:opacity-90 text-white text-[11px] font-bold px-3 py-1 rounded-xl shadow-xs transition"
          >
            Ver Buzón
          </button>
        </div>
      )}

      {/* MODAL LIGHTBOX: VER FOTOGRAFÍA COMPLETA EN PANTALLA COMPLETA */}
      {lightboxData && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 select-none"
          onClick={() => setLightboxData(null)}
        >
          {/* Botón cerrar */}
          <button
            type="button"
            onClick={() => setLightboxData(null)}
            className="absolute top-4 right-4 z-50 bg-white/20 hover:bg-white/40 text-white text-3xl font-bold w-11 h-11 rounded-full flex items-center justify-center transition cursor-pointer shadow-lg"
            aria-label="Cerrar foto"
          >
            ×
          </button>

          {/* Contador de fotos */}
          {lightboxData.images.length > 1 && (
            <div className="absolute top-5 left-5 z-50 bg-black/70 text-white text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-xs shadow-md border border-white/10 flex items-center gap-1.5">
              <span>📷</span>
              <span>Foto {lightboxData.index + 1} de {lightboxData.images.length}</span>
            </div>
          )}

          {/* Contenedor de la foto sin recortes con soporte táctil para deslizar */}
          <div
            className="relative max-w-5xl max-h-[85vh] w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              lightboxTouchStartX.current = e.touches[0].clientX;
              lightboxTouchStartY.current = e.touches[0].clientY;
              setIsLightboxDragging(true);
            }}
            onTouchMove={(e) => {
              if (lightboxTouchStartX.current === null || lightboxData.images.length <= 1) return;
              const diffX = e.touches[0].clientX - lightboxTouchStartX.current;
              const diffY = e.touches[0].clientY - (lightboxTouchStartY.current || 0);
              if (Math.abs(diffX) > 8 && Math.abs(diffX) > Math.abs(diffY)) {
                const atStart = lightboxData.index === 0 && diffX > 0;
                const atEnd = lightboxData.index === lightboxData.images.length - 1 && diffX < 0;
                setLightboxDragOffset(atStart || atEnd ? diffX * 0.35 : diffX);
              }
            }}
            onTouchEnd={(e) => {
              setIsLightboxDragging(false);
              if (
                lightboxTouchStartX.current === null ||
                !lightboxData ||
                lightboxData.images.length <= 1
              ) {
                setLightboxDragOffset(0);
                lightboxTouchStartX.current = null;
                lightboxTouchStartY.current = null;
                return;
              }
              const diffX = e.changedTouches[0].clientX - lightboxTouchStartX.current;
              const diffY = e.changedTouches[0].clientY - (lightboxTouchStartY.current || 0);
              if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
                if (diffX < 0) {
                  // Swipe a la izquierda -> siguiente foto
                  setLightboxData((prev) =>
                    prev ? { ...prev, index: prev.index < prev.images.length - 1 ? prev.index + 1 : 0 } : null
                  );
                } else {
                  // Swipe a la derecha -> foto anterior
                  setLightboxData((prev) =>
                    prev ? { ...prev, index: prev.index > 0 ? prev.index - 1 : prev.images.length - 1 } : null
                  );
                }
              }
              setLightboxDragOffset(0);
              lightboxTouchStartX.current = null;
              lightboxTouchStartY.current = null;
            }}
          >
            {/* Carrusel animado a pantalla completa */}
            <div
              className="flex h-full w-full will-change-transform items-center"
              style={{
                transform: `translateX(calc(-${lightboxData.index * 100}% + ${lightboxDragOffset}px))`,
                transition: isLightboxDragging ? 'none' : 'transform 320ms cubic-bezier(0.2, 0.9, 0.3, 1)',
              }}
            >
              {lightboxData.images.map((img, idx) => (
                <div
                  key={idx}
                  className="w-full h-full shrink-0 flex items-center justify-center p-2 select-none"
                >
                  <img
                    src={img}
                    alt={`Foto ${idx + 1} de la mascota`}
                    className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl transition select-none pointer-events-none"
                  />
                </div>
              ))}
            </div>

            {/* Flechas de navegación en lightbox si hay múltiples fotos */}
            {lightboxData.images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxData((prev) =>
                      prev ? { ...prev, index: prev.index > 0 ? prev.index - 1 : prev.images.length - 1 } : null
                    );
                  }}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 bg-black/70 hover:bg-black active:scale-95 text-white w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold shadow-xl transition backdrop-blur-xs cursor-pointer border border-white/20"
                  aria-label="Foto anterior"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxData((prev) =>
                      prev ? { ...prev, index: prev.index < prev.images.length - 1 ? prev.index + 1 : 0 } : null
                    );
                  }}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 bg-black/70 hover:bg-black active:scale-95 text-white w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold shadow-xl transition backdrop-blur-xs cursor-pointer border border-white/20"
                  aria-label="Siguiente foto"
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Footer Comunitario con Marcas y Donaciones */}
      <Footer />
    </main>
  );
}