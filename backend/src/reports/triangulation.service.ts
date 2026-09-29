import { Injectable } from '@nestjs/common';
import { Species } from '@prisma/client';

export interface SpeciesDisplacementConfig {
  species: Species;
  name: string;
  speedKmH: number; // Velocidad media de desplazamiento en trote o búsqueda
  baseRadiusMeters: number; // Radio mínimo inmediato de búsqueda
  maxRadiusMeters: number; // Límite biológico máximo de dispersión
  timeExponent: number; // Factor de saturación/amortiguamiento con el paso de las horas
  behaviorNote: string;
}

export interface SightingPoint {
  id: string;
  latitude: number;
  longitude: number;
  createdAt: Date | string;
  description?: string;
  title?: string;
  userId?: string;
}

export interface TriangulationResult {
  reportId: string;
  species: Species;
  speciesConfig: SpeciesDisplacementConfig;
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
  perimeterPolygon: Array<[number, number]>; // [lat, lng] array para Leaflet o GeoJSON
  pathPoints: Array<{
    type: 'ORIGIN' | 'SIGHTING';
    id: string;
    latitude: number;
    longitude: number;
    createdAt: string;
    label: string;
  }>;
}

@Injectable()
export class TriangulationService {
  /**
   * Parámetros biológicos calibrados según especie para el modelo de dispersión
   */
  private readonly speciesConfigs: Record<Species, SpeciesDisplacementConfig> = {
    [Species.DOG]: {
      species: Species.DOG,
      name: 'Perro',
      speedKmH: 4.5,
      baseRadiusMeters: 500,
      maxRadiusMeters: 18000,
      timeExponent: 0.65,
      behaviorNote: 'Desplazamiento errático por instinto y olfato. Aumenta con estímulos de comida o ruidos.',
    },
    [Species.CAT]: {
      species: Species.CAT,
      name: 'Gato',
      speedKmH: 0.8,
      baseRadiusMeters: 150,
      maxRadiusMeters: 2500,
      timeExponent: 0.5,
      behaviorNote: 'Territorial y evasivo. Casi siempre se refugia en techos, azoteas, árboles o patios contiguos.',
    },
    [Species.BIRD]: {
      species: Species.BIRD,
      name: 'Ave',
      speedKmH: 18.0,
      baseRadiusMeters: 1000,
      maxRadiusMeters: 35000,
      timeExponent: 0.75,
      behaviorNote: 'Vuelo rápido impulsado por corrientes de aire; radio de búsqueda muy extendido en pocas horas.',
    },
    [Species.RABBIT]: {
      species: Species.RABBIT,
      name: 'Conejo',
      speedKmH: 1.2,
      baseRadiusMeters: 100,
      maxRadiusMeters: 1500,
      timeExponent: 0.52,
      behaviorNote: 'Movimiento cauto a ras de suelo; busca madrigueras, arbustos espesos y jardines resguardados.',
    },
    [Species.OTHER]: {
      species: Species.OTHER,
      name: 'Otro Animal Doméstico',
      speedKmH: 2.5,
      baseRadiusMeters: 300,
      maxRadiusMeters: 6000,
      timeExponent: 0.6,
      behaviorNote: 'Parámetro estándar de búsqueda espacial comunitaria.',
    },
  };

  /**
   * Obtiene la configuración de desplazamiento de una especie
   */
  getSpeciesConfig(species?: Species): SpeciesDisplacementConfig {
    if (!species || !this.speciesConfigs[species]) {
      return this.speciesConfigs[Species.DOG];
    }
    return this.speciesConfigs[species];
  }

  /**
   * Calcula el área y radio espacial de triangulación basado en tiempo y velocidad de especie
   */
  calculateTriangulation(
    report: {
      id: string;
      species?: Species;
      latitude: number;
      longitude: number;
      createdAt: Date | string;
      petName?: string | null;
      title: string;
    },
    sightings: SightingPoint[] = [],
  ): TriangulationResult {
    const config = this.getSpeciesConfig(report.species);

    // 1. Ordenar avistamientos cronológicamente
    const sortedSightings = [...sightings].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    // 2. Determinar punto de ancla (último avistamiento o punto inicial)
    let anchorLat = report.latitude;
    let anchorLng = report.longitude;
    let lastSeenDate = new Date(report.createdAt);
    let isLastSighting = false;
    let sightingId: string | undefined = undefined;

    if (sortedSightings.length > 0) {
      const latest = sortedSightings[sortedSightings.length - 1];
      anchorLat = latest.latitude;
      anchorLng = latest.longitude;
      lastSeenDate = new Date(latest.createdAt);
      isLastSighting = true;
      sightingId = latest.id;
    }

    // 3. Calcular tiempo transcurrido en horas
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - lastSeenDate.getTime());
    const hoursElapsed = Math.max(0.1, Number((diffMs / (1000 * 60 * 60)).toFixed(2)));

    // 4. Calcular Radio de Búsqueda según velocidad de la especie y amortiguamiento
    // Radio(t) = min(R_max, R_0 + v * t^exp)
    const expansionMeters = config.speedKmH * 1000 * Math.pow(hoursElapsed, config.timeExponent);
    const calculatedRadius = Math.round(config.baseRadiusMeters + expansionMeters);
    const searchRadiusMeters = Math.min(config.maxRadiusMeters, Math.max(config.baseRadiusMeters, calculatedRadius));

    // 5. Superficie del área en km²
    const radiusKm = searchRadiusMeters / 1000;
    const searchAreaSquareKm = Number((Math.PI * Math.pow(radiusKm, 2)).toFixed(2));

    // 6. Bounding Box (Caja delimitadora geográfica para queries rápidos)
    // 1 grado de latitud ~ 111.32 km
    // 1 grado de longitud ~ 111.32 km * cos(lat)
    const latDelta = radiusKm / 111.32;
    const lngDelta = radiusKm / (111.32 * Math.cos((anchorLat * Math.PI) / 180));

    const boundingBox = {
      minLat: Number((anchorLat - latDelta).toFixed(6)),
      maxLat: Number((anchorLat + latDelta).toFixed(6)),
      minLon: Number((anchorLng - lngDelta).toFixed(6)),
      maxLon: Number((anchorLng + lngDelta).toFixed(6)),
    };

    // 7. Polígono perimetral circular (32 vértices para mapa interactivo Leaflet)
    const perimeterPolygon: Array<[number, number]> = [];
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
      const angle = (i * 2 * Math.PI) / segments;
      const dLat = (radiusKm / 111.32) * Math.sin(angle);
      const dLng = (radiusKm / (111.32 * Math.cos((anchorLat * Math.PI) / 180))) * Math.cos(angle);
      perimeterPolygon.push([Number((anchorLat + dLat).toFixed(6)), Number((anchorLng + dLng).toFixed(6))]);
    }

    // 8. Trazado de ruta cronológica
    const pathPoints: TriangulationResult['pathPoints'] = [
      {
        type: 'ORIGIN',
        id: report.id,
        latitude: report.latitude,
        longitude: report.longitude,
        createdAt: new Date(report.createdAt).toISOString(),
        label: `Extravío inicial: ${report.petName || report.title}`,
      },
      ...sortedSightings.map((s, idx) => ({
        type: 'SIGHTING' as const,
        id: s.id,
        latitude: s.latitude,
        longitude: s.longitude,
        createdAt: new Date(s.createdAt).toISOString(),
        label: `Avistamiento #${idx + 1} (${new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
      })),
    ];

    return {
      reportId: report.id,
      species: config.species,
      speciesConfig: config,
      hoursElapsed,
      lastSeenTimeAgo: this.formatTimeAgo(lastSeenDate),
      anchorPoint: {
        latitude: anchorLat,
        longitude: anchorLng,
        isLastSighting,
        sightingId,
      },
      searchRadiusMeters,
      searchAreaSquareKm,
      boundingBox,
      perimeterPolygon,
      pathPoints,
    };
  }

  /**
   * Cálculo de distancia en kilómetros mediante fórmula de Haversine
   */
  calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radio terrestre en km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(3));
  }

  private formatTimeAgo(date: Date): string {
    const minutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} d`;
  }
}
