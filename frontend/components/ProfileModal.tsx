'use client';
import { useState, useEffect, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  updateUserProfile,
  getUserProfile,
  makeAdminUser,
  UserProfile,
  Report,
  updateReport,
  updateReportStatus,
  getMessages,
  sendMessage,
  markMessageRead,
  UserMessage,
  resolveReport,
  getTriangulationData,
  TriangulationData,
  Species,
} from '../services/api';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: string;
  onThemeChange: (theme: string) => void;
  allReports?: Report[];
  onSelectReport?: (report: Report) => void;
  onReportUpdated?: (report: Report) => void;
  onTriangulateReport?: (lostReport: Report, sightings: Report[], triangulationData?: TriangulationData) => void;
  initialTab?: 'notifications' | 'reports' | 'settings';
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

export default function ProfileModal({
  isOpen,
  onClose,
  currentTheme,
  onThemeChange,
  allReports = [],
  onSelectReport,
  onReportUpdated,
  onTriangulateReport,
  initialTab = 'notifications',
}: ProfileModalProps) {
  const { data: session, update } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Tab activo: 'notifications' (a primera mano) | 'reports' | 'settings' (aparte)
  const [activeTab, setActiveTab] = useState<'notifications' | 'reports' | 'settings'>(initialTab);

  // Sub-sección dentro de Notificaciones: 'messages' (comunitarios) | 'system_ai' (IA de avistamientos)
  const [activeNotificationSection, setActiveNotificationSection] = useState<'messages' | 'system_ai'>('messages');

  // Estado para edición inline de recompensa
  const [editingRewardReportId, setEditingRewardReportId] = useState<string | null>(null);
  const [editingRewardAmount, setEditingRewardAmount] = useState<string>('');
  const [isSavingReward, setIsSavingReward] = useState(false);

  // Desbloqueo de Administrador con código 230408
  const [adminPin, setAdminPin] = useState('');
  const [showAdminPinPrompt, setShowAdminPinPrompt] = useState(false);
  const [adminPinError, setAdminPinError] = useState<string | null>(null);
  const [adminPinSuccess, setAdminPinSuccess] = useState(false);

  // Mensajería Comunitaria en tiempo real desde la Base de Datos
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyContent, setReplyContent] = useState<{ [messageId: string]: string }>({});
  const [replyingMessageId, setReplyingMessageId] = useState<string | null>(null);
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Estados para Resolución de Caso & Gamificación (Puntos)
  const [resolvingReport, setResolvingReport] = useState<Report | null>(null);
  const [resolvingFinderUserId, setResolvingFinderUserId] = useState<string>('');
  const [resolvingValidatedSightingIds, setResolvingValidatedSightingIds] = useState<string[]>([]);
  const [isResolvingSubmitting, setIsResolvingSubmitting] = useState(false);
  const [resolveSuccessBanner, setResolveSuccessBanner] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Sincronizar initialTab cuando se abre
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const loadProfile = async () => {
    if (session?.user?.email) {
      setName(session.user.name || '');
      try {
        const p = await getUserProfile(session.user.email);
        setProfile(p);
        setPhone(p.phone || '');
      } catch (err) {
        console.error('Error fetching profile:', err);
      }
    }
  };

  const loadUserMessages = async () => {
    if (!session?.user?.email) return;
    setLoadingMessages(true);
    try {
      const msgList = await getMessages(session.user.email);
      setMessages(msgList);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadProfile();
      loadUserMessages();
    }
  }, [session, isOpen]);

  // Al cambiar a la pestaña de notificaciones, refrescar mensajes
  useEffect(() => {
    if (activeTab === 'notifications' && session?.user?.email) {
      loadUserMessages();
    }
  }, [activeTab]);

  // 🤖 Alertas del Sistema: IA de Comparación de Avistamientos con Reportes Perdidos
  // REGLA ESTRICTA DE PRIVACIDAD: La alerta solo es visible para:
  // 1) El dueño legítimo del animal perdido (report.userId === session.user.id)
  // 2) El testigo que subió el avistamiento (sighting.userId === session.user.id)
  // 3) El Administrador
  const aiSightings = useMemo(() => {
    const currentUserId = (session?.user as any)?.id || profile?.id;
    const currentUserEmail = session?.user?.email?.toLowerCase().trim();
    const isAdmin = (session?.user as any)?.role === 'ADMIN' || profile?.role === 'ADMIN';

    // Animales perdidos activos en el sistema
    const lostPets = allReports.filter((r) => r.type === 'LOST' && r.status === 'ACTIVE');
    // Avistamientos activos
    const sightings = allReports.filter((r) => r.type === 'SIGHTING' && r.status === 'ACTIVE');

    const alerts: Array<{
      id: string;
      myDog: Report;
      sighting: Report;
      confidence: 'Alta Probabilidad' | 'Posible Coincidencia';
      matchReason: string;
      uploadedTimeAgo: string;
      exactTime: string;
      isOwnerAlert: boolean;
      isWitnessAlert: boolean;
    }> = [];

    const stopWords = new Set([
      'el', 'la', 'los', 'las', 'un', 'una', 'con', 'de', 'en', 'por', 'perro',
      'perrito', 'se', 'busca', 'reporte', 'zona', 'calle', 'visto', 'ayer', 'hoy',
    ]);

    for (const pet of lostPets) {
      const isOwner = Boolean(
        (pet.userId && pet.userId === currentUserId) ||
        (pet.user?.email && pet.user.email.toLowerCase().trim() === currentUserEmail)
      );

      const petText = `${pet.petName || ''} ${pet.description} ${pet.title} ${pet.breed || ''} ${pet.primaryColor || ''}`.toLowerCase();
      const petWords = petText.split(/[\s,.;:!?]+/).filter((w) => w.length > 2 && !stopWords.has(w));

      for (const sighting of sightings) {
        const isWitness = Boolean(
          (sighting.userId && sighting.userId === currentUserId) ||
          (sighting.user?.email && sighting.user.email.toLowerCase().trim() === currentUserEmail)
        );

        // PRIVACIDAD ESTRICTA: Terceros ajenos NO ven esta notificación
        if (!isOwner && !isWitness && !isAdmin) {
          continue;
        }

        // Si ambas publicaciones declaran especie y difieren (ej. Gato vs Perro), no emparejar
        if (pet.species && sighting.species && pet.species !== sighting.species) {
          continue;
        }

        const sightingText = `${sighting.petName || ''} ${sighting.description} ${sighting.title} ${sighting.breed || ''} ${sighting.primaryColor || ''}`.toLowerCase();
        const commonWords = petWords.filter((w) => sightingText.includes(w));
        const commonTags = (pet.aiTags || []).filter((t) => (sighting.aiTags || []).includes(t));

        const uploadDate = new Date(sighting.createdAt);
        const uploadedTimeAgo = formatRelativeTime(sighting.createdAt);
        let exactTime = 'Reciente';
        try {
          if (!isNaN(uploadDate.getTime())) {
            exactTime = uploadDate.toLocaleDateString('es-MX', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });
          }
        } catch (e) {}

        const hasColorMatch = Boolean(
          pet.primaryColor &&
          sighting.primaryColor &&
          pet.primaryColor.toLowerCase() === sighting.primaryColor.toLowerCase()
        );

        if (commonWords.length > 0 || commonTags.length > 0 || hasColorMatch) {
          const isHigh = commonWords.length >= 2 || commonTags.length >= 2 || hasColorMatch;
          let reasonParts: string[] = [];
          if (hasColorMatch) reasonParts.push(`Mismo color (${pet.primaryColor})`);
          if (commonWords.length > 0) reasonParts.push(`Rasgos: "${commonWords.slice(0, 3).join(', ')}"`);
          if (commonTags.length > 0) reasonParts.push(`Etiquetas IA coincidentes`);

          alerts.push({
            id: `ai-${pet.id}-${sighting.id}`,
            myDog: pet,
            sighting,
            confidence: isHigh ? 'Alta Probabilidad' : 'Posible Coincidencia',
            matchReason: reasonParts.join(' • ') || 'Coincidencia espacial y física detectada por IA',
            uploadedTimeAgo,
            exactTime,
            isOwnerAlert: isOwner,
            isWitnessAlert: isWitness,
          });
        }
      }
    }

    return alerts;
  }, [allReports, profile?.id, profile?.role, session?.user]);

  if (!isOpen || !session?.user) return null;

  const role = (session.user as any).role || profile?.role || 'USER';
  const isAdmin = role === 'ADMIN';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session.user?.email) return;

    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const updated = await updateUserProfile(session.user.email, {
        name: name.trim(),
        phone: phone.trim() || undefined,
      });
      setProfile(updated);
      await update({ name: updated.name, phone: updated.phone });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert('Error al guardar datos de perfil: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnlockAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session.user?.email) return;
    if (adminPin.trim() !== '230408') {
      setAdminPinError('⚠️ PIN incorrecto. Código no autorizado.');
      return;
    }

    try {
      const updated = await makeAdminUser(session.user.email, '230408');
      setProfile(updated);
      await update({ role: 'ADMIN' });
      setAdminPinSuccess(true);
      setAdminPinError(null);
      setShowAdminPinPrompt(false);
    } catch (err: any) {
      setAdminPinError(err.message);
    }
  };

  const handleSaveReward = async (reportId: string) => {
    const val = Number(editingRewardAmount);
    if (isNaN(val) || val < 0) {
      alert('Por favor ingresa un monto válido mayor o igual a 0');
      return;
    }

    setIsSavingReward(true);
    try {
      const updated = await updateReport(reportId, { reward: val > 0 ? val : null });
      if (profile?.reports) {
        setProfile({
          ...profile,
          reports: profile.reports.map((r) => (r.id === reportId ? { ...r, reward: updated.reward } : r)),
        });
      }
      if (onReportUpdated) onReportUpdated(updated);
      setEditingRewardReportId(null);
      alert('💰 Recompensa actualizada con éxito a $' + (updated.reward || 0).toLocaleString('es-MX') + ' MXN');
    } catch (err: any) {
      alert('Error al actualizar la recompensa: ' + err.message);
    } finally {
      setIsSavingReward(false);
    }
  };

  const handleOpenResolveDialog = (r: Report) => {
    setResolvingReport(r);
    setResolvingFinderUserId('');
    setResolvingValidatedSightingIds([]);
    setResolveError(null);
  };

  const handleConfirmResolve = async () => {
    if (!resolvingReport || !session?.user?.email) return;
    setIsResolvingSubmitting(true);
    setResolveError(null);
    try {
      const updated = await resolveReport(resolvingReport.id, {
        requesterEmail: session.user.email,
        finderUserId: resolvingFinderUserId.trim() || undefined,
        validatedSightingIds: resolvingValidatedSightingIds,
      });

      if (profile?.reports) {
        setProfile({
          ...profile,
          reports: profile.reports.map((r) =>
            r.id === resolvingReport.id ? { ...r, status: 'RESOLVED', pointsAwarded: true } : r
          ),
        });
      }
      if (onReportUpdated) onReportUpdated(updated);
      setResolveSuccessBanner('🎉 ¡Caso cerrado con éxito! Se han otorgado los puntos comunitarios a los participantes.');
      setResolvingReport(null);
      await loadProfile();
    } catch (err: any) {
      setResolveError(err.message || 'Error al resolver el reporte');
    } finally {
      setIsResolvingSubmitting(false);
    }
  };

  const handleToggleRead = async (messageId: string) => {
    try {
      await markMessageRead(messageId);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, read: true } : m))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendReply = async (originalMessage: UserMessage) => {
    const text = replyContent[originalMessage.id]?.trim();
    if (!text || !session?.user?.email) return;

    setIsSendingReply(true);
    try {
      const otherUserEmail =
        originalMessage.sender.email.toLowerCase() === session.user.email.toLowerCase()
          ? originalMessage.receiver.email
          : originalMessage.sender.email;

      const newMsg = await sendMessage({
        senderEmail: session.user.email,
        receiverEmail: otherUserEmail,
        reportId: originalMessage.reportId || undefined,
        content: text,
      });

      setMessages((prev) => [newMsg, ...prev]);
      setReplyContent((prev) => ({ ...prev, [originalMessage.id]: '' }));
      setReplyingMessageId(null);
      alert('📨 ¡Respuesta enviada con éxito al usuario!');
    } catch (err: any) {
      alert('Error al responder: ' + err.message);
    } finally {
      setIsSendingReply(false);
    }
  };

  const themes = [
    {
      id: 'arena',
      name: 'Arena SLP (Día)',
      desc: 'Clásico cálido cantera potosina',
      colors: ['#E8622C', '#2C5F8A', '#F8F6F0'],
    },
    {
      id: 'dark',
      name: 'Modo Noche (Carbón)',
      desc: 'Contraparte oscura de alto contraste',
      colors: ['#0F0F12', '#FF7438', '#1A1A1F'],
    },
    {
      id: 'sunset',
      name: 'Atardecer Huasteco',
      desc: 'Naranja terracota y calidez',
      colors: ['#EA580C', '#C2410C', '#FFF1E6'],
    },
    {
      id: 'esperanza',
      name: 'Bosque de la Sierra',
      desc: 'Verde esmeralda y serenidad',
      colors: ['#10B981', '#064E3B', '#EBF5EE'],
    },
  ];

  const unreadMessagesCount = messages.filter(
    (m) => !m.read && m.receiver.email.toLowerCase() === session.user.email?.toLowerCase()
  ).length;

  const totalNotificationsBadge = unreadMessagesCount + aiSightings.length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-theme-surface text-theme-main rounded-3xl w-full max-w-2xl p-6 shadow-2xl relative border border-theme my-6 max-h-[92vh] overflow-y-auto transition-colors">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-theme-muted hover:text-theme-main font-bold text-2xl w-8 h-8 rounded-full flex items-center justify-center transition"
        >
          ×
        </button>

        {/* Encabezado del Perfil */}
        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-theme">
          {session.user.image ? (
            <img
              src={session.user.image}
              alt={session.user.name || 'Usuario'}
              className="w-16 h-16 rounded-full object-cover border-2 border-paliacate shadow-md"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-paliacate text-white text-2xl font-bold flex items-center justify-center shadow-md">
              {(session.user.name || 'U')[0].toUpperCase()}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-theme-main truncate">
                {name || session.user.name || 'Usuario SLP'}
              </h2>
              {isAdmin ? (
                <span className="text-[10px] bg-amber-400 text-carbon font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                  👑 Administrador
                </span>
              ) : (
                <span className="text-[10px] bg-theme-input text-theme-muted font-bold px-2 py-0.5 rounded-full border border-theme uppercase tracking-wider">
                  Miembro Comunitario
                </span>
              )}
              <span className="text-[10px] bg-esperanza/15 text-esperanza border border-esperanza/30 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                <span>⭐</span> {profile?.points || 0} pts • {profile?.level || 'Rescatista Novato 🐾'}
              </span>
            </div>
            <p className="text-xs text-theme-muted truncate">{session.user.email}</p>
            {phone && (
              <p className="text-xs text-confianza font-semibold mt-0.5">
                📞 {phone} (Teléfono público)
              </p>
            )}
          </div>
        </div>

        {/* ===================== PESTAÑAS PRINCIPALES ===================== */}
        {/* Notificaciones y Mensajes a Primera Mano, Mis Reportes en medio, y Configuración Aparte */}
        <div className="flex border-b border-theme gap-2 overflow-x-auto scrollbar-none">
          {/* Pestaña 1: Notificaciones (A Primera Mano) */}
          <button
            onClick={() => setActiveTab('notifications')}
            className={`py-2 px-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'notifications'
                ? 'border-paliacate text-paliacate'
                : 'border-transparent text-theme-muted hover:text-theme-main'
            }`}
          >
            <span>🔔</span> Notificaciones
            {totalNotificationsBadge > 0 && (
              <span className="text-[10px] bg-paliacate text-white font-extrabold px-2 py-0.2 rounded-full animate-pulse shadow-xs">
                {totalNotificationsBadge}
              </span>
            )}
          </button>

          {/* Pestaña 2: Mis Reportes & Historial */}
          <button
            onClick={() => setActiveTab('reports')}
            className={`py-2 px-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'reports'
                ? 'border-paliacate text-paliacate'
                : 'border-transparent text-theme-muted hover:text-theme-main'
            }`}
          >
            <span>🐾</span> Mis Reportes & Historial
            <span className="text-[10px] bg-theme-input px-1.5 py-0.2 rounded-full border border-theme">
              {profile?.reports?.length || 0}
            </span>
          </button>

          {/* Pestaña 3: Configuración (Pestaña aparte) */}
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-2 px-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition flex items-center gap-1.5 ml-auto ${
              activeTab === 'settings'
                ? 'border-paliacate text-paliacate'
                : 'border-transparent text-theme-muted hover:text-theme-main'
            }`}
          >
            <span>⚙️</span> Configuración
          </button>
        </div>

        {/* ===================== VISTA 1: NOTIFICACIONES (A PRIMERA MANO) ===================== */}
        {activeTab === 'notifications' && (
          <div className="mt-4 flex flex-col gap-3">
            {/* Selector de sub-sección: Mensajes vs Sistema (IA) */}
            <div className="flex bg-theme-input p-1 rounded-2xl border border-theme gap-1">
              <button
                type="button"
                onClick={() => setActiveNotificationSection('messages')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  activeNotificationSection === 'messages'
                    ? 'bg-theme-surface text-theme-main shadow-xs'
                    : 'text-theme-muted hover:text-theme-main'
                }`}
              >
                <span>💬</span> Mensajes Comunitarios
                {unreadMessagesCount > 0 && (
                  <span className="text-[9px] bg-paliacate text-white font-extrabold px-1.5 py-0.2 rounded-full">
                    {unreadMessagesCount} nuevos
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveNotificationSection('system_ai')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  activeNotificationSection === 'system_ai'
                    ? 'bg-theme-surface text-theme-main shadow-xs'
                    : 'text-theme-muted hover:text-theme-main'
                }`}
              >
                <span>🤖</span> Alertas del Sistema (IA)
                {aiSightings.length > 0 && (
                  <span className="text-[9px] bg-amber-500 text-white font-extrabold px-1.5 py-0.2 rounded-full">
                    {aiSightings.length}
                  </span>
                )}
              </button>
            </div>

            {/* SECCIÓN 1.A: MENSAJES COMUNITARIOS */}
            {activeNotificationSection === 'messages' && (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
                    Buzón de Mensajes Recibidos y Enviados ({messages.length})
                  </span>
                  <button
                    onClick={loadUserMessages}
                    disabled={loadingMessages}
                    className="text-xs text-confianza hover:underline font-semibold flex items-center gap-1"
                  >
                    <span>🔄</span> {loadingMessages ? 'Actualizando...' : 'Actualizar'}
                  </button>
                </div>

                {loadingMessages && messages.length === 0 ? (
                  <div className="text-center py-10 text-theme-muted text-xs">
                    Cargando mensajes de la comunidad...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-10 bg-theme-input rounded-2xl border border-theme p-6">
                    <span className="text-4xl block mb-2">📬</span>
                    <h4 className="font-bold text-sm text-theme-main">Buzón vacío</h4>
                    <p className="text-xs text-theme-muted mt-1">
                      Aún no tienes mensajes. Cuando un vecino o rescatista te contacte por un perrito, aparecerá aquí al instante.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 max-h-[55vh] overflow-y-auto pr-1">
                    {messages.map((m) => {
                      const isSentByMe = m.sender.email.toLowerCase() === session.user.email?.toLowerCase();
                      const otherUser = isSentByMe ? m.receiver : m.sender;
                      const isReplying = replyingMessageId === m.id;

                      return (
                        <div
                          key={m.id}
                          className={`p-3.5 rounded-2xl border transition flex flex-col gap-2.5 ${
                            !m.read && !isSentByMe
                              ? 'bg-confianza/5 border-confianza/40 ring-1 ring-confianza/20'
                              : 'bg-theme-input border-theme'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-9 h-9 rounded-full text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs ${
                                  isSentByMe ? 'bg-paliacate' : 'bg-confianza'
                                }`}
                              >
                                {(otherUser.name || otherUser.email)[0].toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="font-bold text-xs text-theme-main">
                                    {isSentByMe ? `Para: ${otherUser.name || otherUser.email}` : otherUser.name || otherUser.email}
                                  </h4>
                                  {isSentByMe && (
                                    <span className="text-[9px] bg-theme-surface border border-theme text-theme-muted px-1.5 py-0.2 rounded-md font-bold">
                                      Enviado por ti
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-theme-muted">
                                  {m.report ? (
                                    <>
                                      Reporte: <strong className="text-paliacate">"{m.report.petName || m.report.title}"</strong> •{' '}
                                    </>
                                  ) : null}
                                  {formatRelativeTime(m.createdAt)} ({(() => {
                                    try {
                                      const d = new Date(m.createdAt);
                                      return !isNaN(d.getTime())
                                        ? d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                                        : '';
                                    } catch (e) {
                                      return '';
                                    }
                                  })()})
                                </span>
                              </div>
                            </div>

                            {!m.read && !isSentByMe && (
                              <span className="bg-confianza text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full shrink-0">
                                NUEVO
                              </span>
                            )}
                          </div>

                          <div className="bg-theme-surface/75 p-3 rounded-xl border border-theme text-xs text-theme-main leading-relaxed">
                            {m.content}
                          </div>

                          {/* Opciones de respuesta y WhatsApp */}
                          <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              {!isSentByMe && !m.read && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleRead(m.id)}
                                  className="text-[11px] font-bold text-confianza hover:underline"
                                >
                                  ✓ Marcar leído
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setReplyingMessageId(isReplying ? null : m.id)}
                                className="text-[11px] font-bold text-paliacate hover:underline flex items-center gap-1"
                              >
                                <span>↩️</span> {isReplying ? 'Cerrar respuesta' : 'Responder'}
                              </button>
                            </div>

                            {otherUser.phone && (
                              <a
                                href={`https://wa.me/${otherUser.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                  `Hola ${otherUser.name || ''}, te contacto por tu mensaje en Perritos Perdidos SLP respecto a ${
                                    m.report?.petName || 'tu reporte'
                                  }`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-green-500 hover:bg-green-600 text-white text-[11px] font-bold py-1 px-2.5 rounded-lg transition flex items-center gap-1 shadow-xs"
                              >
                                <span>📱</span> WhatsApp
                              </a>
                            )}
                          </div>

                          {/* Formulario de Respuesta Inline */}
                          {isReplying && (
                            <div className="mt-2 p-2.5 bg-theme-surface rounded-xl border border-theme flex flex-col gap-2">
                              <label className="text-[11px] font-bold text-theme-main">
                                Escribe tu respuesta para {otherUser.name || otherUser.email}:
                              </label>
                              <textarea
                                rows={2}
                                value={replyContent[m.id] || ''}
                                onChange={(e) =>
                                  setReplyContent((prev) => ({ ...prev, [m.id]: e.target.value }))
                                }
                                placeholder="Escribe tu mensaje aquí..."
                                className="w-full bg-theme-input border border-theme rounded-lg p-2 text-xs text-theme-main outline-none focus:border-paliacate resize-none"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setReplyingMessageId(null)}
                                  className="text-xs text-theme-muted hover:text-theme-main px-2 py-1"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  disabled={isSendingReply || !replyContent[m.id]?.trim()}
                                  onClick={() => handleSendReply(m)}
                                  className="bg-paliacate hover:opacity-90 text-white text-xs font-bold px-3 py-1 rounded-lg transition disabled:opacity-50"
                                >
                                  {isSendingReply ? 'Enviando...' : 'Enviar Respuesta'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* SECCIÓN 1.B: ALERTAS DEL SISTEMA (IA DE AVISTAMIENTOS) */}
            {activeNotificationSection === 'system_ai' && (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[11px] font-bold text-theme-muted uppercase tracking-wider block">
                      🤖 Comparador de Avistamientos con IA ({aiSightings.length})
                    </span>
                    <p className="text-[10px] text-theme-muted">
                      La IA compara los perritos perdidos con los avistamientos subidos en San Luis Potosí.
                    </p>
                  </div>
                </div>

                {aiSightings.length === 0 ? (
                  <div className="text-center py-10 bg-theme-input rounded-2xl border border-theme p-6">
                    <span className="text-4xl block mb-2">✨</span>
                    <h4 className="font-bold text-sm text-theme-main">Sin avistamientos detectados</h4>
                    <p className="text-xs text-theme-muted mt-1">
                      Cuando la comunidad suba un avistamiento que coincida con tus reportes, recibirás aquí la notificación de inmediato.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 max-h-[55vh] overflow-y-auto pr-1">
                    {aiSightings.map((alert) => {
                      const dog = alert.sighting;

                      return (
                        <div
                          key={alert.id}
                          className="bg-theme-input p-3.5 rounded-2xl border border-theme flex flex-col gap-2.5 hover:border-amber-400 transition"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                              <span>🤖</span> {alert.confidence}
                            </span>
                            <span className="text-[11px] font-bold text-paliacate bg-paliacate/10 px-2 py-0.5 rounded-md">
                              ⏱️ {alert.uploadedTimeAgo} ({alert.exactTime})
                            </span>
                          </div>

                          <p className="text-[11px] text-theme-muted font-medium">
                            {alert.matchReason} • Referencia a: <strong className="text-theme-main font-bold">"{alert.myDog.petName || alert.myDog.title}"</strong>
                          </p>

                          <div className="flex items-center gap-3">
                            {dog.mediaUrl ? (
                              <img
                                src={dog.mediaUrl}
                                alt={dog.title}
                                className="w-16 h-16 rounded-xl object-cover border border-theme shadow-xs shrink-0"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-xl bg-theme-surface border border-theme flex items-center justify-center text-2xl shrink-0">
                                👀
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-sm text-theme-main truncate">
                                {dog.petName || dog.title}
                              </h4>
                              <p className="text-xs text-theme-muted line-clamp-2 mt-0.5">
                                "{dog.description}"
                              </p>
                              <span className="text-[10px] text-theme-muted mt-1 block">
                                📍 Coordenadas: {dog.latitude.toFixed(4)}, {dog.longitude.toFixed(4)}
                              </span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-theme flex items-center justify-between gap-2">
                            {dog.contactPhone && (
                              <a
                                href={`https://wa.me/${dog.contactPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                  `Hola, vi la notificación del sistema sobre tu avistamiento de "${dog.petName || dog.title}" en Perritos Perdidos SLP`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-bold text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
                              >
                                <span>💬</span> WhatsApp al testigo
                              </a>
                            )}

                            {onSelectReport && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectReport(dog);
                                  onClose();
                                }}
                                className="ml-auto bg-paliacate hover:opacity-90 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition flex items-center gap-1"
                              >
                                <span>🗺️</span> Ver calles del avistamiento
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===================== VISTA 2: MIS REPORTES & HISTORIAL PARA TRIANGULAR ===================== */}
        {activeTab === 'reports' && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xs font-bold text-theme-main uppercase tracking-wider">
                  Mis Reportes Publicados & Historial de Ruta ({profile?.reports?.length || 0})
                </h3>
                <p className="text-[10px] text-theme-muted">
                  Consulta el historial cronológico de avistamientos para triangular ubicaciones en el mapa.
                </p>
              </div>
            </div>

            {profile?.reports?.length === 0 ? (
              <div className="text-center py-10 bg-theme-input rounded-2xl border border-theme p-6">
                <span className="text-4xl block mb-2">🐾</span>
                <h4 className="font-bold text-sm text-theme-main">Aún no tienes reportes</h4>
                <p className="text-xs text-theme-muted mt-1">
                  Crea tu primer reporte comunitario desde el botón "+ Reportar" en la pantalla principal.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3.5 max-h-[55vh] overflow-y-auto pr-1">
                {profile?.reports?.map((r) => {
                  const isEditingThisReward = editingRewardReportId === r.id;

                  // Avistamientos asociados o cercanos para este perrito (para triangulación)
                  const dogSightings = allReports.filter(
                    (other) => other.type === 'SIGHTING' && other.status === 'ACTIVE'
                  );

                  return (
                    <div
                      key={r.id}
                      className="bg-theme-input p-3.5 rounded-2xl border border-theme flex flex-col gap-3 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {r.mediaUrl ? (
                            <img
                              src={r.mediaUrl}
                              alt={r.title}
                              className="w-14 h-14 rounded-xl object-cover border border-theme shadow-xs shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-theme-surface border border-theme flex items-center justify-center text-2xl shrink-0">
                              🐶
                            </div>
                          )}
                          <div>
                            <h4 className="font-bold text-sm text-theme-main">
                              {r.petName || r.title}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                                  r.status === 'RESOLVED'
                                    ? 'bg-esperanza text-white'
                                    : 'bg-paliacate text-white'
                                }`}
                              >
                                {r.status === 'RESOLVED' ? '🎉 Resuelto' : 'Activo'}
                              </span>
                              <span className="text-[10px] text-theme-muted">
                                Publicado: {formatRelativeTime(r.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {onSelectReport && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectReport(r);
                              onClose();
                            }}
                            className="bg-theme-surface border border-theme text-theme-muted hover:text-theme-main text-xs font-bold px-2.5 py-1 rounded-xl whitespace-nowrap"
                          >
                            🗺️ Ubicar
                          </button>
                        )}
                      </div>

                      {/* Control de Recompensa (si es de tipo LOST) */}
                      {r.type === 'LOST' && (
                        <div className="bg-theme-surface/70 p-2.5 rounded-xl border border-theme flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs">💰</span>
                            <span className="text-xs font-bold text-theme-main">Recompensa:</span>
                            {r.reward && r.reward > 0 ? (
                              <span className="text-xs font-extrabold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                                ${Number(r.reward).toLocaleString('es-MX')} MXN
                              </span>
                            ) : (
                              <span className="text-xs text-theme-muted">Sin recompensa asignada</span>
                            )}
                          </div>

                          {isEditingThisReward ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-theme-muted">$</span>
                              <input
                                type="number"
                                min="0"
                                step="50"
                                value={editingRewardAmount}
                                onChange={(e) => setEditingRewardAmount(e.target.value)}
                                placeholder="Ej. 1000"
                                className="w-24 bg-theme-input border border-theme rounded-lg px-2 py-1 text-xs font-bold text-theme-main outline-none focus:border-paliacate"
                              />
                              <button
                                type="button"
                                disabled={isSavingReward}
                                onClick={() => handleSaveReward(r.id)}
                                className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-2.5 py-1 rounded-lg"
                              >
                                {isSavingReward ? '...' : 'Guardar'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingRewardReportId(null)}
                                className="text-theme-muted hover:text-theme-main text-xs px-1"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRewardReportId(r.id);
                                setEditingRewardAmount(String(r.reward || ''));
                              }}
                              className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
                            >
                              ✏️ Modificar monto
                            </button>
                          )}
                        </div>
                      )}

                      {/* HISTORIAL CRONOLÓGICO DE AVISTAMIENTOS PARA TRIANGULACIÓN */}
                      {r.type === 'LOST' && (
                        <div className="bg-theme-surface/60 p-3 rounded-2xl border border-theme flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold text-theme-main uppercase tracking-wider flex items-center gap-1.5">
                              <span>📍</span> Historial de Avistamientos & Ruta ({dogSightings.length})
                            </span>
                            {onTriangulateReport && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const triData = await getTriangulationData(r.id);
                                    onTriangulateReport(r, dogSightings, triData);
                                  } catch (e) {
                                    onTriangulateReport(r, dogSightings);
                                  }
                                  onClose();
                                }}
                                className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-[11px] font-bold px-2.5 py-1 rounded-xl shadow-xs transition flex items-center gap-1"
                                title="Trazar ruta y triángulo de búsqueda en el mapa"
                              >
                                <span>📐</span> Triangular en Mapa
                              </button>
                            )}
                          </div>

                          <div className="flex flex-col gap-1.5 mt-1">
                            {/* Punto 0: Extravío original */}
                            <div className="flex items-center gap-2 text-xs">
                              <span className="w-2.5 h-2.5 rounded-full bg-paliacate shrink-0"></span>
                              <span className="font-bold text-theme-main">Punto de pérdida original:</span>
                              <span className="text-theme-muted">
                                {formatRelativeTime(r.createdAt)} ({r.latitude.toFixed(4)}, {r.longitude.toFixed(4)})
                              </span>
                            </div>

                            {/* Puntos de Avistamientos en el tiempo */}
                            {dogSightings.slice(0, 3).map((s, idx) => (
                              <div key={s.id} className="flex items-center gap-2 text-xs">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                                <span className="font-semibold text-theme-main">
                                  Avistamiento #{idx + 1}:
                                </span>
                                <span className="text-theme-muted truncate flex-1">
                                  "{s.petName || s.title}" • {formatRelativeTime(s.createdAt)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onSelectReport) onSelectReport(s);
                                    onClose();
                                  }}
                                  className="text-[10px] font-bold text-confianza hover:underline shrink-0"
                                >
                                  Ver punto
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Acción de resolver */}
                      {r.status === 'ACTIVE' && (
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => handleOpenResolveDialog(r)}
                            className="bg-esperanza/10 hover:bg-esperanza text-esperanza hover:text-white border border-esperanza/30 text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-xs"
                          >
                            <span>🎉</span> ¿Ya volvió a casa? Marcar como Encontrado & Puntos
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===================== VISTA 3: CONFIGURACIÓN (PESTAÑA APARTE) ===================== */}
        {activeTab === 'settings' && (
          <div className="flex flex-col gap-4 mt-4">
            {/* Sección: Desbloqueo de Administrador */}
            {!isAdmin && (
              <div className="p-3.5 bg-theme-input rounded-2xl border border-theme">
                {!showAdminPinPrompt ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-theme-main">¿Eres el Administrador?</h4>
                      <p className="text-[10px] text-theme-muted">Ingresa tu PIN de seguridad (230408) para habilitar tu panel.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAdminPinPrompt(true)}
                      className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition"
                    >
                      🔐 Ingresar PIN
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleUnlockAdmin} className="flex flex-col gap-2">
                    <label className="text-[11px] font-bold text-theme-main">
                      Ingresa el PIN de Administrador (6 dígitos):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        maxLength={6}
                        value={adminPin}
                        onChange={(e) => setAdminPin(e.target.value)}
                        placeholder="Código (ej. 230408)"
                        className="flex-1 bg-theme-surface border border-theme rounded-xl px-3 py-2 text-xs font-mono font-bold text-center text-theme-main outline-none focus:border-paliacate"
                      />
                      <button
                        type="submit"
                        className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
                      >
                        Activar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAdminPinPrompt(false);
                          setAdminPinError(null);
                        }}
                        className="text-theme-muted hover:text-theme-main text-xs px-2"
                      >
                        Cancelar
                      </button>
                    </div>
                    {adminPinError && (
                      <p className="text-[11px] text-red-500 font-medium">{adminPinError}</p>
                    )}
                  </form>
                )}
              </div>
            )}

            {adminPinSuccess && (
              <div className="p-2 bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-xs rounded-xl font-bold text-center">
                🎉 ¡Rol de Administrador activado con éxito!
              </div>
            )}

            {/* Datos Personales y Teléfono Público */}
            <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
              <h3 className="text-xs font-bold text-theme-main uppercase tracking-wider">
                👤 Datos de Contacto Comunitario
              </h3>

              <div>
                <label className="block text-[11px] font-bold text-theme-muted mb-1">
                  Nombre Visible
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-theme-muted mb-1">
                  Número de Teléfono / WhatsApp (Público para reportes)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej. 4443211123"
                  className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                />
                <p className="text-[10px] text-theme-muted mt-1">
                  Este número se pre-llenará automáticamente cuando publiques un reporte o respondas a un vecino.
                </p>
              </div>

              <div className="flex items-center justify-between mt-1">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-paliacate hover:opacity-90 text-white font-bold py-2 px-4 rounded-xl text-xs shadow-md transition disabled:opacity-50"
                >
                  {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
                {saveSuccess && (
                  <span className="text-xs text-green-600 dark:text-green-400 font-bold flex items-center gap-1">
                    ✓ Perfil actualizado
                  </span>
                )}
              </div>
            </form>

            {/* Selector de Paletas de Colores */}
            <div className="pt-3 border-t border-theme">
              <h3 className="text-xs font-bold text-theme-main uppercase tracking-wider mb-2">
                🎨 Paleta de Colores de la Aplicación
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {themes.map((t) => {
                  const isSelected = currentTheme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onThemeChange(t.id)}
                      className={`p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                        isSelected
                          ? 'border-paliacate bg-paliacate/10 ring-2 ring-paliacate/30'
                          : 'border-theme bg-theme-input hover:border-gray-400'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-theme-main">{t.name}</span>
                          {isSelected && <span className="text-xs">✓</span>}
                        </div>
                        <p className="text-[10px] text-theme-muted mt-0.5">{t.desc}</p>
                      </div>
                      <div className="flex -space-x-1 shrink-0">
                        {t.colors.map((c, i) => (
                          <span
                            key={i}
                            className="w-4 h-4 rounded-full border border-white/50 shadow-xs"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Banner de Éxito de Resolución */}
        {resolveSuccessBanner && (
          <div className="bg-esperanza/15 border border-esperanza/30 text-esperanza text-xs p-3 rounded-2xl mb-3 flex items-center justify-between">
            <span>{resolveSuccessBanner}</span>
            <button type="button" onClick={() => setResolveSuccessBanner(null)} className="font-bold text-base px-2">×</button>
          </div>
        )}

        {/* MODAL DE CIERRE DE CASO, VALIDACIÓN Y REPARTO DE PUNTOS */}
        {resolvingReport && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-60 flex items-center justify-center p-4">
            <div className="bg-theme-surface text-theme-main rounded-3xl w-full max-w-lg p-6 shadow-2xl relative border border-theme animate-scaleUp max-h-[90vh] overflow-y-auto">
              <button
                type="button"
                onClick={() => setResolvingReport(null)}
                className="absolute top-4 right-4 text-theme-muted hover:text-theme-main font-bold text-2xl w-8 h-8 rounded-full flex items-center justify-center transition"
              >
                ×
              </button>

              <div className="text-center mb-4">
                <span className="text-3xl">🎉</span>
                <h3 className="text-lg font-bold text-theme-main mt-1">
                  ¡Marcar como Encontrado & Repartir Puntos!
                </h3>
                <p className="text-xs text-theme-muted">
                  Cierra el caso de <strong className="text-paliacate">"{resolvingReport.petName || resolvingReport.title}"</strong> y recompensa a quienes ayudaron en el rescate.
                </p>
              </div>

              {resolveError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-xs p-3 rounded-xl mb-4 text-center font-medium">
                  {resolveError}
                </div>
              )}

              {/* SECCIÓN 1: ¿QUIÉN LO ENCONTRÓ? (+100 PTS) */}
              <div className="bg-theme-input/70 p-3.5 rounded-2xl border border-theme mb-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-theme-main flex items-center gap-1.5">
                    <span>🏆</span> ¿Quién encontró a la mascota?
                  </span>
                  <span className="text-[10px] bg-amber-500/15 text-amber-600 font-bold px-2 py-0.5 rounded-md border border-amber-500/30">
                    +100 Puntos
                  </span>
                </div>
                <p className="text-[11px] text-theme-muted">
                  Selecciona al usuario que rescató o devolvió al animal, o deja vacío si regresó por su cuenta.
                </p>

                <select
                  value={resolvingFinderUserId}
                  onChange={(e) => setResolvingFinderUserId(e.target.value)}
                  className="w-full bg-theme-surface border border-theme rounded-xl p-2.5 text-xs text-theme-main outline-none focus:border-paliacate"
                >
                  <option value="">Regresó solo a casa / Lo encontré yo mismo (Sin puntos a terceros)</option>
                  {allReports
                    .filter((s) => s.user && s.user.id !== session.user.id)
                    .reduce((uniqueUsers: any[], s) => {
                      if (s.user && !uniqueUsers.some((u) => u.id === s.user!.id)) {
                        uniqueUsers.push(s.user);
                      }
                      return uniqueUsers;
                    }, [])
                    .map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email} ({u.email})
                      </option>
                    ))}
                </select>
              </div>

              {/* SECCIÓN 2: VALIDACIÓN DE AVISTAMIENTOS GENUINOS (+25 PTS CADA UNO) */}
              <div className="bg-theme-input/70 p-3.5 rounded-2xl border border-theme mb-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-theme-main flex items-center gap-1.5">
                    <span>👀</span> Validar Avistamientos Genuinos
                  </span>
                  <span className="text-[10px] bg-confianza/15 text-confianza font-bold px-2 py-0.5 rounded-md border border-confianza/30">
                    +25 Puntos c/u
                  </span>
                </div>
                <p className="text-[11px] text-theme-muted">
                  Marca únicamente los avistamientos que confirmas fueron reales y ayudaron a triangular su ruta. Esto previene fraudes y premia a los testigos genuinos.
                </p>

                {allReports.filter((s) => s.type === 'SIGHTING' && s.id !== resolvingReport.id).length === 0 ? (
                  <p className="text-xs text-theme-muted italic py-1">No hay avistamientos registrados para validar.</p>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                    {allReports
                      .filter((s) => s.type === 'SIGHTING' && s.id !== resolvingReport.id)
                      .slice(0, 10)
                      .map((sighting) => {
                        const isChecked = resolvingValidatedSightingIds.includes(sighting.id);
                        return (
                          <label
                            key={sighting.id}
                            className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 cursor-pointer transition ${
                              isChecked
                                ? 'bg-confianza/10 border-confianza/40 text-theme-main'
                                : 'bg-theme-surface border-theme text-theme-muted'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setResolvingValidatedSightingIds((prev) => [...prev, sighting.id]);
                                  } else {
                                    setResolvingValidatedSightingIds((prev) => prev.filter((id) => id !== sighting.id));
                                  }
                                }}
                                className="w-4 h-4 rounded text-confianza focus:ring-0 cursor-pointer"
                              />
                              <div className="min-w-0">
                                <strong className="text-xs text-theme-main truncate block">
                                  {sighting.petName || sighting.title}
                                </strong>
                                <span className="text-[10px] text-theme-muted block truncate">
                                  Testigo: {sighting.user?.name || sighting.user?.email || 'Comunidad'} • {formatRelativeTime(sighting.createdAt)}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-confianza shrink-0">+25 pts</span>
                          </label>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* BOTONES DE ACCIÓN */}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isResolvingSubmitting}
                  onClick={handleConfirmResolve}
                  className="flex-1 bg-esperanza hover:opacity-90 active:scale-95 text-white font-bold py-3 rounded-2xl text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span>{isResolvingSubmitting ? '⏳' : '🏆'}</span>
                  <span>{isResolvingSubmitting ? 'Validando y repartiendo...' : 'Confirmar Cierre & Repartir Puntos'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setResolvingReport(null)}
                  className="py-3 px-4 rounded-2xl border border-theme text-xs font-bold text-theme-muted hover:text-theme-main transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Botón de Cerrar Sesión */}
        <div className="mt-6 pt-4 border-t border-theme flex justify-between items-center">
          <span className="text-[11px] text-theme-muted">Perritos Perdidos SLP v1.1</span>
          <button
            onClick={() => signOut({ callbackUrl: window.location.href })}
            className="text-red-500 hover:bg-red-500/10 text-xs font-bold px-4 py-2 rounded-xl transition border border-red-500/30"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );
}
