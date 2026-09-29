'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  getReports,
  createReport,
  updateReportStatus,
  Report,
  ReportType,
  ReportStatus,
  Species,
  TriangulationData,
  getTriangulationData,
  sendMessage,
  getMessages,
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

// Formateador de tiempo relativo en español
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
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
  const [mapZoom, setMapZoom] = useState<number>(13);

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

  // Estados del Modal de nuevo reporte
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPickingOnMap, setIsPickingOnMap] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    petName: '',
    type: 'LOST' as ReportType,
    species: 'DOG' as Species,
    breed: '',
    primaryColor: '',
    size: 'MEDIANO',
    description: '',
    contactPhone: '',
    reward: '',
    mediaUrl: '',
    latitude: SLP_CENTER[0],
    longitude: SLP_CENTER[1],
  });

  // Autenticación con NextAuth y Perfiles
  const { data: session } = useSession();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('arena');

  // Inicializar tema visual desde localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('pps-theme') || 'arena';
    setCurrentTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const handleThemeChange = (newTheme: string) => {
    setCurrentTheme(newTheme);
    localStorage.setItem('pps-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const feedRef = useRef<HTMLDivElement>(null);

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
    if (session?.user?.email) {
      getMessages(session.user.email)
        .then((msgs) => {
          const unreadMsgs = msgs.filter(
            (m) => !m.read && m.receiver.email.toLowerCase() === session.user.email?.toLowerCase()
          ).length;
          const sightingsCount = reports.filter((r) => r.type === 'SIGHTING' && r.status === 'ACTIVE').length;
          setUnreadNotificationsCount(unreadMsgs + (sightingsCount > 0 ? 1 : 0));
        })
        .catch(() => {});
    } else {
      setUnreadNotificationsCount(0);
    }
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

  // Manejo de carga de imagen local optimizada
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        alert('La imagen no debe superar los 15MB');
        return;
      }
      try {
        const optimizedBase64 = await compressImage(file);
        setImagePreview(optimizedBase64);
        setFormData((prev) => ({ ...prev, mediaUrl: optimizedBase64 }));
      } catch (err) {
        console.error('Error al optimizar imagen:', err);
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setImagePreview(base64);
          setFormData((prev) => ({ ...prev, mediaUrl: base64 }));
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Envío del nuevo reporte al Backend
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim()) {
      alert('Por favor ingresa una descripción para ayudar a identificar al perrito.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createReport({
        title: formData.petName.trim() || `Reporte de ${formData.species === 'DOG' ? 'Perrito' : formData.species === 'CAT' ? 'Gatito' : 'Mascota'}`,
        petName: formData.petName.trim() || undefined,
        type: formData.type,
        species: formData.species,
        breed: formData.breed.trim() || undefined,
        primaryColor: formData.primaryColor.trim() || undefined,
        size: formData.size || undefined,
        description: formData.description.trim(),
        contactPhone: formData.contactPhone.trim() || undefined,
        reward: formData.reward && !isNaN(Number(formData.reward)) && Number(formData.reward) > 0 ? Number(formData.reward) : null,
        userEmail: session?.user?.email || undefined,
        mediaUrl: formData.mediaUrl || undefined,
        latitude: formData.latitude,
        longitude: formData.longitude,
      });

      // Añadimos reactivamente el reporte a la lista y seleccionamos
      setReports((prev) => [created, ...prev]);
      setSelectedReportId(created.id);
      setMapCenter([created.latitude, created.longitude]);

      // Cerramos modal y reseteamos campos
      setIsModalOpen(false);
      setImagePreview(null);
      setFormData({
        petName: '',
        type: 'LOST',
        species: 'DOG',
        breed: '',
        primaryColor: '',
        size: 'MEDIANO',
        description: '',
        contactPhone: '',
        reward: '',
        mediaUrl: '',
        latitude: SLP_CENTER[0],
        longitude: SLP_CENTER[1],
      });

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

    const isOwner = report.user?.email?.toLowerCase() === session.user.email?.toLowerCase();
    if (!isOwner) {
      alert(
        '🚫 Permiso denegado (403 Forbidden): Únicamente el dueño legítimo del reporte o un Administrador tienen permiso para cerrar este caso y validar los puntos de recompensa comunitaria.'
      );
      return;
    }

    // Abrimos el panel de perfil en la pestaña de reportes donde el dueño puede seleccionar al rescatista y otorgar puntos
    setProfileModalTab('reports');
    setIsProfileModalOpen(true);
  };

  // Alternar selección de perrito: hacer zoom a nivel de calle (16) o regresar al mapa completo (13)
  const handleCardClick = (report: Report) => {
    if (selectedReportId === report.id) {
      // Deseleccionar: regresar a vista general de SLP
      setSelectedReportId(null);
      setMapCenter(SLP_CENTER);
      setMapZoom(13);
    } else {
      // Enfocar y hacer zoom a nivel de calle (16)
      setSelectedReportId(report.id);
      setMapCenter([report.latitude, report.longitude]);
      setMapZoom(16);
    }
  };

  // Cuando se hace clic en un pin del mapa (viceversa)
  const handleMapMarkerClick = (report: Report) => {
    if (selectedReportId === report.id) {
      // Segundo clic en el mismo pin: deseleccionar y alejar
      setSelectedReportId(null);
      setMapCenter(SLP_CENTER);
      setMapZoom(13);
    } else {
      // Enfocar pin y hacer zoom a nivel de calle
      setSelectedReportId(report.id);
      setMapCenter([report.latitude, report.longitude]);
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
    setMapZoom(13);
  };

  // Abrir modal de mensaje directo para un perrito
  const handleOpenSendMessage = (report: Report, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!session?.user) {
      setIsAuthModalOpen(true);
      return;
    }
    setMessagingReport(report);
    setMessageText(
      `Hola, te contacto por el reporte de "${report.petName || report.title}" en Perritos Perdidos SLP.`
    );
  };

  // Enviar mensaje en la plataforma
  const handleSendMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messagingReport || !session?.user?.email || !messageText.trim()) return;

    setIsSendingMessage(true);
    try {
      await sendMessage({
        senderEmail: session.user.email,
        receiverEmail: messagingReport.user?.email,
        reportId: messagingReport.id,
        content: messageText.trim(),
      });

      const recipientName = messagingReport.user?.name || messagingReport.user?.email || 'el dueño del perrito';
      setMessageSuccessBanner(`¡Mensaje enviado a ${recipientName}! Podrás revisar las respuestas en tu buzón.`);
      setMessagingReport(null);
      setMessageText('');
      setTimeout(() => setMessageSuccessBanner(null), 6000);
    } catch (err: any) {
      alert('Error al enviar mensaje: ' + err.message);
    } finally {
      setIsSendingMessage(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col bg-theme-page font-sans text-theme-main relative">
      {/* Header Dinámico con soporte de Temas */}
      <header
        className="sticky top-0 z-30 px-4 md:px-6 py-3.5 flex items-center justify-between shadow-md transition-all duration-300"
        style={{ background: 'var(--header-bg)', color: 'var(--header-text)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-2xl shadow-inner">
            🐶
          </div>
          <div>
            <h1 className="font-bold text-lg md:text-xl tracking-wide leading-tight">
              Perritos Perdidos SLP
            </h1>
            <p className="text-[11px] text-white/80 hidden sm:block">
              Red comunitaria de rescate y adopción en San Luis Potosí
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
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
            className="relative text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-full transition text-lg"
            title="Ver notificaciones y mensajes comunitarios"
          >
            <span>🔔</span>
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-paliacate text-white text-[10px] font-extrabold w-4.5 h-4.5 rounded-full flex items-center justify-center animate-bounce shadow-md border-2 border-white/60">
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
            className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-full transition text-lg"
            title="Personalizar paleta de colores"
          >
            🎨
          </button>

          <button
            onClick={loadReports}
            className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-full transition"
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
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full transition border border-white/20 text-xs md:text-sm font-semibold"
              title="Ver mis reportes e historial"
            >
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || 'Usuario'}
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <span className="w-6 h-6 rounded-full bg-paliacate text-white flex items-center justify-center text-[11px] font-bold">
                  {(session.user.name || 'U')[0].toUpperCase()}
                </span>
              )}
              <span className="hidden sm:inline font-bold max-w-[100px] truncate">
                {session.user.name?.split(' ')[0] || 'Mi Perfil'}
              </span>
              {(session.user as any).role === 'ADMIN' && (
                <span className="text-[10px] bg-amber-400 text-carbon font-extrabold px-1.5 py-0.5 rounded-full">
                  Admin
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full transition border border-white/20 text-xs md:text-sm font-semibold flex items-center gap-1.5"
            >
              <span>👤</span> Iniciar Sesión
            </button>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-paliacate hover:opacity-90 active:scale-95 transition text-white font-bold px-3.5 md:px-5 py-2 rounded-full shadow-lg flex items-center gap-1.5 text-xs md:text-sm"
          >
            <span className="text-base leading-none">+</span> Reportar
          </button>
        </div>
      </header>

      {/* Selector de Pestaña para Móviles (Android / iOS) */}
      <div className="lg:hidden flex bg-theme-surface border-b border-theme sticky top-[65px] z-20 shadow-sm">
        <button
          onClick={() => setMobileTab('list')}
          className={`flex-1 py-2.5 text-center text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition ${
            mobileTab === 'list'
              ? 'border-paliacate text-paliacate bg-paliacate/10'
              : 'border-transparent text-theme-muted'
          }`}
        >
          <span>📋</span> Ver Reportes ({filteredReports.length})
        </button>
        <button
          onClick={() => setMobileTab('map')}
          className={`flex-1 py-2.5 text-center text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition ${
            mobileTab === 'map'
              ? 'border-paliacate text-paliacate bg-paliacate/10'
              : 'border-transparent text-theme-muted'
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
          <Map
            reports={filteredReports}
            selectedReportId={selectedReportId}
            onSelectReport={handleMapMarkerClick}
            onDeselectReport={handleDeselectMap}
            zoom={mapZoom}
            centerCoords={mapCenter}
            onOpenMessageModal={(report) => handleOpenSendMessage(report)}
            triangulationData={triangulationData}
            onExitTriangulation={() => setTriangulationData(null)}
            isPickingLocation={isPickingOnMap}
            pickedLocation={
              isPickingOnMap
                ? { latitude: formData.latitude, longitude: formData.longitude }
                : null
            }
            onLocationPicked={(lat, lng) => {
              setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
              setIsPickingOnMap(false);
              setIsModalOpen(true);
            }}
          />
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
                onClick={() => setIsModalOpen(true)}
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

                  {/* Imagen o Placeholder */}
                  <div className="h-48 bg-gray-200 relative flex items-center justify-center overflow-hidden">
                    {report.mediaUrl ? (
                      <img
                        src={report.mediaUrl}
                        alt={report.title}
                        className="w-full h-full object-cover transition hover:scale-105 duration-300"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <span className="text-4xl">🐕</span>
                        <span className="text-xs font-medium mt-1">Sin fotografía</span>
                      </div>
                    )}

                    {/* Insignia de Estado y Recompensa */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[85%]">
                      {report.status === 'RESOLVED' ? (
                        <span className="bg-esperanza text-white text-xs font-bold px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                          🎉 ¡ENCONTRADO!
                        </span>
                      ) : report.type === 'LOST' ? (
                        <span className="bg-paliacate text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                          ¡PERDIDO!
                        </span>
                      ) : report.type === 'ADOPTION' ? (
                        <span className="bg-confianza text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                          EN ADOPCIÓN
                        </span>
                      ) : (
                        <span className="bg-amber-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                          AVISTAMIENTO
                        </span>
                      )}

                      {report.status === 'ACTIVE' && report.reward && report.reward > 0 && (
                        <span className="bg-amber-400 text-gray-900 text-xs font-extrabold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1 border border-amber-300">
                          💰 ${report.reward.toLocaleString('es-MX')} MXN
                        </span>
                      )}
                    </div>

                    <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[11px] px-2 py-0.5 rounded-md backdrop-blur-xs font-medium">
                      {formatRelativeTime(report.createdAt)}
                    </span>
                  </div>

                  {/* Contenido de la Tarjeta */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-lg text-theme-main leading-snug">
                          {report.petName || report.title}
                        </h3>
                        <span className="text-xs font-semibold text-theme-muted whitespace-nowrap">
                          📍 {dist} km
                        </span>
                      </div>
                      <p className="text-sm text-theme-muted mt-1.5 line-clamp-3">
                        {report.description}
                      </p>

                      {/* Banner de Recompensa Activa */}
                      {report.status === 'ACTIVE' && report.reward && report.reward > 0 && (
                        <div className="mt-2.5 p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <span>💰</span> Recompensa ofrecida:
                          </span>
                          <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-lg">
                            ${report.reward.toLocaleString('es-MX')} MXN
                          </span>
                        </div>
                      )}

                      {/* Banner de Caso de Éxito */}
                      {report.status === 'RESOLVED' && (
                        <div className="mt-2.5 p-2 bg-esperanza/10 border border-esperanza/30 rounded-xl flex items-center gap-1.5 text-xs font-bold text-esperanza">
                          <span>🎉</span> ¡Perrito reunido felizmente con su familia!
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-theme flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        {/* Botón de Resolver si está activo */}
                        {report.status === 'ACTIVE' ? (
                          <button
                            onClick={(e) => handleMarkResolved(report, e)}
                            title="Marcar como encontrado o resuelto"
                            className="text-[11px] font-semibold text-theme-muted hover:text-esperanza transition"
                          >
                            ¿Ya fue encontrado?
                          </button>
                        ) : (
                          <span className="text-[11px] font-bold text-esperanza">
                            Caso de éxito comunitario
                          </span>
                        )}

                        <div className="flex items-center gap-1.5">
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
                                  setTriangulationData({
                                    lostReport: report,
                                    sightings: relevantSightings,
                                    details: triData,
                                  });
                                  setMapCenter([report.latitude, report.longitude]);
                                  setMapZoom(14);
                                } catch (err) {
                                  console.error('Error calculando triangulación:', err);
                                }
                              }}
                              className="text-[11px] font-bold px-2 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition flex items-center gap-1"
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
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-xl transition flex items-center gap-1 ${
                              isSelected
                                ? 'bg-paliacate text-white'
                                : 'bg-theme-input text-theme-muted hover:text-theme-main border border-theme'
                            }`}
                          >
                            {isSelected ? '✕ Alejar mapa' : '🔍 Enfocar calles'}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        {/* Botón de Mensajería en Plataforma */}
                        <button
                          type="button"
                          onClick={(e) => handleOpenSendMessage(report, e)}
                          className="flex-1 bg-confianza hover:opacity-90 active:scale-95 text-white text-xs font-bold py-1.5 px-3 rounded-xl transition flex items-center justify-center gap-1 shadow-xs"
                          title="Enviar mensaje en la plataforma"
                        >
                          <span>💬</span> Enviar Mensaje
                        </button>

                        {/* Botón de Contacto por WhatsApp */}
                        {report.contactPhone && (
                          <a
                            href={`https://wa.me/${report.contactPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                              `Hola, te contacto por el reporte de "${report.petName || report.title}" en Perritos Perdidos SLP`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="bg-green-500 hover:bg-green-600 active:scale-95 text-white text-xs font-bold py-1.5 px-3 rounded-xl transition flex items-center gap-1 shadow-xs shrink-0"
                            title="Contactar vía WhatsApp"
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
        onClick={() => setIsModalOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-40 bg-paliacate hover:opacity-95 text-white font-bold px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 text-base active:scale-95 transition"
      >
        <span className="text-xl leading-none">+</span> Reportar
      </button>

      {/* MODAL DE NUEVO REPORTE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-theme-surface text-theme-main rounded-3xl w-full max-w-lg p-6 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto border border-theme transition-colors">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-theme-muted hover:text-theme-main font-bold text-2xl w-8 h-8 rounded-full flex items-center justify-center transition"
            >
              ×
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">📝</span>
              <h2 className="text-xl md:text-2xl font-bold text-theme-main">
                Publicar Nuevo Reporte
              </h2>
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

              {/* Nombre o Referencia */}
              <div>
                <label className="block text-xs font-bold text-theme-main uppercase tracking-wider mb-1.5">
                  {formData.type === 'SIGHTING'
                    ? 'Referencia o Nombre del Perrito'
                    : 'Nombre del perrito / Referencia'}
                </label>
                <input
                  type="text"
                  value={formData.petName}
                  onChange={(e) => setFormData({ ...formData, petName: e.target.value })}
                  placeholder={
                    formData.type === 'SIGHTING'
                      ? 'Ej. Perro mestizo café visto en glorieta, collar rojo...'
                      : 'Ej. Solovino, Cachorro Golden, Sin nombre...'
                  }
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
                <label className="block text-xs font-bold text-theme-main uppercase tracking-wider mb-1.5">
                  {formData.type === 'SIGHTING'
                    ? 'Teléfono / WhatsApp de Contacto (Opcional)'
                    : 'Teléfono / WhatsApp de Contacto'}
                </label>
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  placeholder="Ej. 4441234567"
                  className="w-full bg-theme-input border border-theme rounded-xl p-3 text-sm outline-none focus:border-paliacate text-theme-main"
                />
                <p className="text-[11px] text-theme-muted mt-1">
                  {formData.type === 'SIGHTING'
                    ? 'Permitirá que el dueño te contacte por WhatsApp para agradecerte o pedirte referencias.'
                    : 'Permitirá que la comunidad te envíe un WhatsApp con 1 toque.'}
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

              {/* Fotografía del Perrito o Avistamiento */}
              <div>
                <label className="block text-xs font-bold text-theme-main uppercase tracking-wider mb-1.5">
                  {formData.type === 'SIGHTING'
                    ? 'Fotografía del Avistamiento (Clave para IA)'
                    : 'Fotografía del Perrito'}
                </label>
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="text-xs text-theme-muted file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-theme-input file:text-theme-main hover:file:opacity-80 cursor-pointer"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-theme-muted">O ingresa un enlace:</span>
                    <input
                      type="url"
                      value={formData.mediaUrl.startsWith('data:') ? '' : formData.mediaUrl}
                      onChange={(e) => {
                        setFormData({ ...formData, mediaUrl: e.target.value });
                        setImagePreview(e.target.value);
                      }}
                      placeholder="https://ejemplo.com/foto.jpg"
                      className="flex-1 bg-theme-input border border-theme rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-paliacate text-theme-main"
                    />
                  </div>
                </div>

                {/* Previsualización de la foto */}
                {imagePreview && (
                  <div className="mt-2 relative w-full h-36 rounded-xl overflow-hidden border border-theme">
                    <img
                      src={imagePreview}
                      alt="Previsualización"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        setFormData({ ...formData, mediaUrl: '' });
                      }}
                      className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md font-bold hover:bg-black"
                    >
                      Quitar
                    </button>
                  </div>
                )}
              </div>

              {/* Selección de Ubicación */}
              <div>
                <label className="block text-xs font-bold text-theme-main uppercase tracking-wider mb-1.5">
                  Ubicación en el Mapa *
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleUseCurrentGPS}
                    className="flex-1 bg-theme-input hover:opacity-80 text-theme-main border border-theme text-xs font-bold py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5"
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
                    className="flex-1 bg-confianza/10 text-confianza hover:bg-confianza/20 text-xs font-bold py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 border border-confianza/30"
                  >
                    <span>🗺️</span> Marcar en el mapa
                  </button>
                </div>
                <p className="text-[11px] text-theme-muted mt-1.5">
                  Coordenadas fijadas: {formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}
                </p>
              </div>

              {/* Botón de Publicación */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-paliacate hover:opacity-95 text-white font-bold py-3.5 rounded-2xl mt-2 transition disabled:opacity-50 shadow-lg text-base active:scale-[0.98]"
              >
                {isSubmitting ? 'Guardando en la base de datos...' : 'Publicar Reporte'}
              </button>
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
        onReportUpdated={(updatedReport) => {
          setReports((prev) =>
            prev.map((r) => (r.id === updatedReport.id ? updatedReport : r))
          );
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
              {messagingReport.mediaUrl ? (
                <img
                  src={messagingReport.mediaUrl}
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
                    {messagingReport.user?.name || messagingReport.user?.email || 'Dueño / Rescatista'}
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

      {/* Footer Comunitario con Marcas y Donaciones */}
      <Footer />
    </main>
  );
}