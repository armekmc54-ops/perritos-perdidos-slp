export const getBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (process.env.NEXT_PUBLIC_BACKEND_URL) return process.env.NEXT_PUBLIC_BACKEND_URL;
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return 'https://perritos-perdidos-slp.onrender.com/api/v1';
  }
  return 'http://localhost:3001/api/v1';
};

const customFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const headers = new Headers(init?.headers);
  headers.set('Bypass-Tunnel-Reminder', 'true');
  return fetch(input, {
    ...init,
    headers,
  });
};

export type ReportType = 'LOST' | 'ADOPTION' | 'SIGHTING' | 'SUCCESS';
export type ReportStatus = 'ACTIVE' | 'RESOLVED' | 'DANGER';
export type Species = 'DOG' | 'CAT' | 'BIRD' | 'RABBIT' | 'OTHER';

export interface PointTransaction {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  reportId?: string | null;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
  points?: number;
  level?: string;
  createdAt: string;
  updatedAt: string;
  reports?: Report[];
  pointTransactions?: PointTransaction[];
  foundReports?: Report[];
}

export interface Report {
  id: string;
  title: string;
  petName?: string | null;
  description: string;
  status: ReportStatus;
  type: ReportType;
  species?: Species;
  breed?: string | null;
  primaryColor?: string | null;
  size?: string | null;
  aiTags?: string[];
  latitude: number;
  longitude: number;
  mediaUrl?: string | null;
  contactPhone?: string | null;
  reward?: number | null;
  userId: string;
  resolvedByUserId?: string | null;
  validatedSightingIds?: string[];
  pointsAwarded?: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name?: string | null;
    email: string;
    phone?: string | null;
    avatarUrl?: string | null;
    points?: number;
    level?: string;
  };
  resolvedByUser?: {
    id: string;
    name?: string | null;
    email: string;
    points?: number;
    level?: string;
  } | null;
  pointTransactions?: PointTransaction[];
}

export interface CreateReportInput {
  title?: string;
  petName?: string;
  description: string;
  type: ReportType;
  species?: Species;
  breed?: string;
  primaryColor?: string;
  size?: string;
  aiTags?: string[];
  latitude: number;
  longitude: number;
  mediaUrl?: string;
  contactPhone?: string;
  reward?: number | null;
  userEmail?: string;
}

export interface TriangulationData {
  reportId: string;
  species: Species;
  speciesConfig: {
    species: Species;
    name: string;
    speedKmH: number;
    baseRadiusMeters: number;
    maxRadiusMeters: number;
    timeExponent: number;
    behaviorNote: string;
  };
  hoursElapsed: number;
  lastSeenTimeAgo: string;
  anchorPoint: {
    latitude: number;
    longitude: number;
    isLastSighting: boolean;
    sightingId?: string;
  };
  searchRadiusMeters: number;
  searchAreaSquareKm: number;
  boundingBox: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  perimeterPolygon: Array<[number, number]>;
  pathPoints: Array<{
    type: 'ORIGIN' | 'SIGHTING';
    id: string;
    latitude: number;
    longitude: number;
    createdAt: string;
    label: string;
  }>;
}

// Función para traer los reportes desde la base de datos
export const getReports = async (filters?: { type?: string; status?: string }): Promise<Report[]> => {
  const queryParams = new URLSearchParams();
  if (filters?.type && filters.type !== 'ALL') {
    queryParams.append('type', filters.type);
  }
  if (filters?.status) {
    queryParams.append('status', filters.status);
  }

  const url = `${getBaseUrl()}/reports${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await customFetch(url);
  if (!response.ok) {
    throw new Error('No se pudieron obtener los reportes en este momento.');
  }
  return response.json();
};

// Función para guardar un nuevo reporte
export const createReport = async (reportData: CreateReportInput): Promise<Report> => {
  const response = await customFetch(`${getBaseUrl()}/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(reportData),
  });

  if (!response.ok) {
    let errorDetail = 'Error al crear el reporte';
    try {
      const errorJson = await response.json();
      if (errorJson.message) {
        errorDetail = Array.isArray(errorJson.message)
          ? errorJson.message.join(', ')
          : errorJson.message;
      }
    } catch {
      // fallback a mensaje por defecto
    }
    throw new Error(errorDetail);
  }
  return response.json();
};

// Función para actualizar el estado del reporte (ej. Marcar como RESUELTO / ENCONTRADO)
export const updateReportStatus = async (id: string, status: ReportStatus): Promise<Report> => {
  const response = await customFetch(`${getBaseUrl()}/reports/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error('Error al actualizar el estado del reporte');
  }
  return response.json();
};

// Función para actualizar datos completos de un reporte (ej. monto de recompensa)
export const updateReport = async (
  id: string,
  data: Partial<CreateReportInput>
): Promise<Report> => {
  const response = await customFetch(`${getBaseUrl()}/reports/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Error al actualizar los datos del reporte');
  }
  return response.json();
};

// Función para eliminar un reporte
export const deleteReport = async (id: string): Promise<{ success: boolean }> => {
  const response = await customFetch(`${getBaseUrl()}/reports/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Error al eliminar el reporte');
  }
  return response.json();
};

// Sincronizar usuario con PostgreSQL al iniciar sesión
export const syncUserWithBackend = async (data: {
  email: string;
  name?: string;
  avatarUrl?: string;
  phone?: string;
  role?: string;
  adminCode?: string;
}): Promise<UserProfile> => {
  const response = await customFetch(`${getBaseUrl()}/users/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Error al sincronizar información del usuario.');
  }
  return response.json();
};

// Obtener perfil de usuario
export const getUserProfile = async (email: string): Promise<UserProfile> => {
  const response = await customFetch(`${getBaseUrl()}/users/profile?email=${encodeURIComponent(email)}`);
  if (!response.ok) {
    throw new Error('Error al obtener perfil de usuario');
  }
  return response.json();
};

// Actualizar datos del perfil de usuario
export const updateUserProfile = async (
  email: string,
  data: { name?: string; phone?: string; avatarUrl?: string }
): Promise<UserProfile> => {
  const response = await customFetch(`${getBaseUrl()}/users/profile?email=${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Error al actualizar perfil de usuario');
  }
  return response.json();
};

// Desbloquear rol de Administrador con código PIN (230408)
export const makeAdminUser = async (email: string, adminCode: string): Promise<UserProfile> => {
  const response = await customFetch(`${getBaseUrl()}/users/make-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, adminCode }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Código de administrador incorrecto');
  }
  return response.json();
};

export interface UserMessage {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  reportId?: string | null;
  read: boolean;
  createdAt: string;
  sender: {
    id: string;
    name?: string | null;
    email: string;
    phone?: string | null;
    avatarUrl?: string | null;
  };
  receiver: {
    id: string;
    name?: string | null;
    email: string;
    phone?: string | null;
    avatarUrl?: string | null;
  };
  report?: {
    id: string;
    petName?: string | null;
    title: string;
    type: string;
    mediaUrl?: string | null;
  } | null;
}

// Enviar un mensaje a otro usuario sobre un reporte
export const sendMessage = async (data: {
  senderEmail: string;
  receiverEmail?: string;
  receiverId?: string;
  reportId?: string;
  content: string;
}): Promise<UserMessage> => {
  const response = await customFetch(`${getBaseUrl()}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Error al enviar mensaje');
  }
  return response.json();
};

// Obtener mensajes del usuario logueado
export const getMessages = async (userEmail: string): Promise<UserMessage[]> => {
  const response = await customFetch(`${getBaseUrl()}/messages?userEmail=${encodeURIComponent(userEmail)}`);
  if (!response.ok) {
    throw new Error('Error al obtener mensajes');
  }
  return response.json();
};

// Marcar mensaje como leído
export const markMessageRead = async (id: string): Promise<UserMessage> => {
  const response = await customFetch(`${getBaseUrl()}/messages/${id}/read`, {
    method: 'PATCH',
  });
  if (!response.ok) {
    throw new Error('Error al marcar mensaje como leído');
  }
  return response.json();
};

// Obtener datos de triangulación espacial calculados por el backend
export const getTriangulationData = async (reportId: string): Promise<TriangulationData> => {
  const response = await customFetch(`${getBaseUrl()}/reports/${reportId}/triangulation`);
  if (!response.ok) {
    throw new Error('Error al obtener datos de triangulación espacial');
  }
  return response.json();
};

// Marcar caso como "Encontrado" de forma segura y repartir puntos (Dueño o Admin)
export const resolveReport = async (
  reportId: string,
  data: {
    requesterEmail: string;
    finderUserId?: string;
    validatedSightingIds?: string[];
  }
): Promise<Report> => {
  const response = await customFetch(`${getBaseUrl()}/reports/${reportId}/resolve`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Error al resolver el reporte');
  }
  return response.json();
};

