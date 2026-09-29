'use client';
import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Report, TriangulationData } from '../services/api';

// Generador de iconos SVG interactivos para Leaflet con efecto de foco y halo pulsante
const createCustomIcon = (color: string, emoji: string, isSelected: boolean = false) => {
  const size = isSelected ? 48 : 36;
  const anchor = isSelected ? 24 : 18;
  const fontSize = isSelected ? 22 : 16;

  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
        ${
          isSelected
            ? `
          <div style="
            position: absolute;
            width: ${size + 28}px;
            height: ${size + 28}px;
            border-radius: 50%;
            background-color: ${color};
            opacity: 0.45;
            animation: pulseRing 1.4s ease-out infinite;
            top: -14px;
            left: -14px;
            pointer-events: none;
          "></div>
          <div style="
            position: absolute;
            width: ${size + 12}px;
            height: ${size + 12}px;
            border-radius: 50%;
            border: 2px solid ${color};
            opacity: 0.8;
            top: -6px;
            left: -6px;
            pointer-events: none;
          "></div>
        `
            : ''
        }
        <div style="
          background-color: ${color};
          width: ${size}px;
          height: ${size}px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: ${isSelected ? '0 10px 28px rgba(0,0,0,0.6)' : '0 4px 10px rgba(0,0,0,0.3)'};
          border: ${isSelected ? '3.5px solid #FFFFFF' : '2px solid white'};
          position: relative;
          z-index: 10;
          transition: transform 0.2s ease, width 0.2s ease, height 0.2s ease;
        ">
          <span style="
            transform: rotate(45deg);
            font-size: ${fontSize}px;
            display: block;
            user-select: none;
          ">${emoji}</span>
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [anchor, size],
    popupAnchor: [0, -size],
  });
};

const getReportIcon = (report: Report, isSelected: boolean) => {
  if (report.status === 'RESOLVED') {
    return createCustomIcon('#4A9B6E', '✅', isSelected); // Verde Esperanza
  }
  if (report.type === 'ADOPTION') {
    return createCustomIcon('#2C5F8A', '🏠', isSelected); // Azul Confianza
  }
  if (report.type === 'SIGHTING') {
    return createCustomIcon('#D97706', '👀', isSelected); // Ámbar Avistamiento
  }
  return createCustomIcon('#E8622C', '🐶', isSelected); // Naranja Paliacate
};

const tempPinIcon = createCustomIcon('#EF4444', '📍', true); // Rojo Selección

// Escucha clics en el lienzo del mapa
function MapEventsHandler({
  isPicking,
  onPicked,
  onDeselect,
}: {
  isPicking: boolean;
  onPicked?: (lat: number, lng: number) => void;
  onDeselect?: () => void;
}) {
  useMapEvents({
    click(e) {
      if (isPicking) {
        if (onPicked) onPicked(e.latlng.lat, e.latlng.lng);
      } else {
        // Clic en fondo del mapa: deselecciona y regresa al mapa general
        if (onDeselect) onDeselect();
      }
    },
  });
  return null;
}

// Re-centra y ajusta zoom suavemente con flyTo (con protección contra tamaño 0x0 en móviles)
function MapRecenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    try {
      if (!map || !center || isNaN(center[0]) || isNaN(center[1])) return;
      const size = map.getSize();
      if (!size || size.x === 0 || size.y === 0) {
        map.setView(center, zoom, { animate: false });
        return;
      }
      map.flyTo(center, zoom, { duration: 1.1 });
    } catch (e) {
      try {
        map.setView(center, zoom, { animate: false });
      } catch (err) {}
    }
  }, [center, zoom, map]);
  return null;
}

// Invalida tamaño para asegurar carga fluida de teselas completas en el contenedor, especialmente al alternar pestañas en móvil
function MapResizer({ activeTab }: { activeTab?: string }) {
  const map = useMap();
  useEffect(() => {
    const invalidate = () => {
      try {
        if (map) {
          map.invalidateSize();
        }
      } catch (e) {}
    };

    invalidate();
    const t1 = setTimeout(invalidate, 50);
    const t2 = setTimeout(invalidate, 150);
    const t3 = setTimeout(invalidate, 300);
    const t4 = setTimeout(invalidate, 600);
    const t5 = setTimeout(invalidate, 1200);

    let observer: ResizeObserver | null = null;
    try {
      const container = map.getContainer();
      if (container && typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => {
          invalidate();
        });
        observer.observe(container);
      }
    } catch (e) {}

    const handleResize = () => {
      invalidate();
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [map, activeTab]);
  return null;
}

interface MapProps {
  reports: Report[];
  selectedReportId?: string | null;
  onSelectReport?: (report: Report) => void;
  onDeselectReport?: () => void;
  isPickingLocation?: boolean;
  pickedLocation?: { latitude: number; longitude: number } | null;
  onLocationPicked?: (lat: number, lng: number) => void;
  centerCoords?: [number, number];
  zoom?: number;
  onOpenMessageModal?: (report: Report) => void;
  triangulationData?: {
    lostReport: Report;
    sightings: Report[];
    details?: TriangulationData | null;
  } | null;
  onExitTriangulation?: () => void;
  activeTab?: string;
}

export default function Map({
  reports,
  selectedReportId,
  onSelectReport,
  onDeselectReport,
  isPickingLocation = false,
  pickedLocation,
  onLocationPicked,
  centerCoords = [22.1565, -100.9855],
  zoom = 13,
  onOpenMessageModal,
  triangulationData,
  onExitTriangulation,
  activeTab,
}: MapProps) {
  const selectedReport = reports.find((r) => r.id === selectedReportId);

  const triangulationPath: [number, number][] = triangulationData?.details?.pathPoints && triangulationData.details.pathPoints.length > 0
    ? triangulationData.details.pathPoints.map((p) => [p.latitude, p.longitude] as [number, number])
    : triangulationData
    ? [
        [triangulationData.lostReport.latitude, triangulationData.lostReport.longitude],
        ...triangulationData.sightings.map((s) => [s.latitude, s.longitude] as [number, number]),
      ]
    : [];

  return (
    <div className="w-full h-full relative">
      {/* Banner flotante cuando está en modo selección de ubicación */}
      {isPickingLocation && (
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-[1000] bg-paliacate text-white text-xs md:text-sm font-bold px-4 py-2 rounded-full shadow-lg border border-white flex items-center gap-2 animate-bounce">
          <span>📍</span> Haz clic en el mapa para fijar la ubicación del perrito
        </div>
      )}

      {/* Banner de Modo Triangulación */}
      {!isPickingLocation && triangulationData && (
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-[1000] bg-carbon/95 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-2xl backdrop-blur-md border border-amber-400 flex items-center gap-2.5 max-w-[95%] animate-fadeIn">
          <span className="text-base animate-pulse">📐</span>
          <span className="truncate">
            Triangulación: <strong className="text-amber-300">{triangulationData.lostReport.petName || triangulationData.lostReport.title}</strong>
            {triangulationData.details ? (
              <span className="text-zinc-300 ml-1 text-[11px]">
                • {triangulationData.details.speciesConfig.name} • Radio: {(triangulationData.details.searchRadiusMeters / 1000).toFixed(1)} km ({triangulationData.details.searchAreaSquareKm} km²) • {triangulationData.details.lastSeenTimeAgo}
              </span>
            ) : (
              <span className="text-zinc-300 ml-1 text-[11px]">
                ({triangulationData.sightings.length} avistamientos)
              </span>
            )}
          </span>
          {onExitTriangulation && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExitTriangulation();
              }}
              className="ml-2 bg-amber-500 hover:bg-amber-600 text-white rounded-full px-2.5 py-0.5 text-[11px] font-bold transition shrink-0"
              title="Salir de la vista de triangulación"
            >
              ✕ Salir
            </button>
          )}
        </div>
      )}

      {/* Banner de Enfoque Activo en Perro Seleccionado */}
      {!isPickingLocation && !triangulationData && selectedReport && (
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-[1000] bg-carbon/90 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-2xl backdrop-blur-md border border-white/20 flex items-center gap-2.5 max-w-[90%] truncate animate-fadeIn">
          <span className="w-2.5 h-2.5 rounded-full bg-paliacate animate-ping shrink-0"></span>
          <span className="truncate">
            Enfocando a: <strong className="text-amber-300">{selectedReport.petName || selectedReport.title}</strong> (Zoom a calles)
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onDeselectReport) onDeselectReport();
            }}
            className="ml-1 bg-white/20 hover:bg-white/30 text-white rounded-full px-2 py-0.5 text-[11px] font-bold transition"
            title="Ver mapa completo"
          >
            ✕ Alejar
          </button>
        </div>
      )}

      <MapContainer
        center={centerCoords}
        zoom={zoom}
        className="w-full h-full"
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <MapEventsHandler
          isPicking={isPickingLocation}
          onPicked={(lat, lng) => onLocationPicked && onLocationPicked(lat, lng)}
          onDeselect={onDeselectReport}
        />

        <MapRecenter center={centerCoords} zoom={zoom} />
        <MapResizer activeTab={activeTab} />

        {/* Trazado y Radio Dinámico de Triangulación por Especie */}
        {triangulationData && (
          <>
            {triangulationPath.length > 1 && (
              <Polyline
                positions={triangulationPath}
                pathOptions={{ color: '#E8622C', weight: 4, dashArray: '8, 8', opacity: 0.9 }}
              />
            )}
            <Circle
              center={
                triangulationData.details?.anchorPoint
                  ? [triangulationData.details.anchorPoint.latitude, triangulationData.details.anchorPoint.longitude]
                  : triangulationData.sightings.length > 0
                  ? [triangulationData.sightings[0].latitude, triangulationData.sightings[0].longitude]
                  : [triangulationData.lostReport.latitude, triangulationData.lostReport.longitude]
              }
              radius={triangulationData.details?.searchRadiusMeters || 1200}
              pathOptions={{
                color: '#E8622C',
                fillColor: '#E8622C',
                fillOpacity: 0.15,
                dashArray: '4, 4',
                weight: 2,
              }}
            />
          </>
        )}

        {/* Marcador temporal cuando el usuario hace clic para seleccionar ubicación */}
        {pickedLocation && (
          <Marker
            position={[pickedLocation.latitude, pickedLocation.longitude]}
            icon={tempPinIcon}
          >
            <Popup>
              <strong>Ubicación fijada</strong>
              <br />
              {pickedLocation.latitude.toFixed(4)}, {pickedLocation.longitude.toFixed(4)}
            </Popup>
          </Marker>
        )}

        {/* Pines de los reportes reales */}
        {reports.map((report) => {
          const isSelected = selectedReportId === report.id;
          const pin = getReportIcon(report, isSelected);

          let label = '¡Perdido!';
          let badgeColor = 'bg-paliacate text-white';

          if (report.status === 'RESOLVED') {
            label = '¡Encontrado / Resuelto!';
            badgeColor = 'bg-esperanza text-white';
          } else if (report.type === 'ADOPTION') {
            label = 'En Adopción';
            badgeColor = 'bg-confianza text-white';
          } else if (report.type === 'SIGHTING') {
            label = 'Avistamiento';
            badgeColor = 'bg-amber-600 text-white';
          }

          return (
            <Marker
              key={report.id}
              position={[report.latitude, report.longitude]}
              icon={pin}
              zIndexOffset={isSelected ? 1000 : 0}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e as any);
                  if (onSelectReport) onSelectReport(report);
                },
              }}
            >
              <Popup className="custom-popup">
                <div className="p-1 max-w-[230px]">
                  {report.mediaUrl && (
                    <img
                      src={report.mediaUrl}
                      alt={report.title}
                      className="w-full h-28 object-cover rounded-lg mb-2"
                    />
                  )}
                  <div className="flex items-center gap-1 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
                      {label}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-400 text-carbon">
                        🎯 Enfocado
                      </span>
                    )}
                  </div>
                  {report.reward && report.reward > 0 && (
                    <div className="mb-1 text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                      <span>💰</span> Recompensa: ${report.reward.toLocaleString('es-MX')} MXN
                    </div>
                  )}
                  <h4 className="font-bold text-sm text-carbon leading-snug">
                    {report.petName || report.title}
                  </h4>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {report.description}
                  </p>

                  <div className="mt-2.5 pt-2 border-t border-gray-200 flex flex-col gap-1.5">
                    {onOpenMessageModal && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenMessageModal(report);
                        }}
                        className="w-full bg-confianza hover:opacity-90 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-xs transition flex items-center justify-center gap-1"
                      >
                        <span>💬</span> Enviar Mensaje
                      </button>
                    )}

                    {report.contactPhone && (
                      <a
                        href={`https://wa.me/${report.contactPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                          `Hola, te contacto por el reporte de ${report.petName || report.title} en Perritos Perdidos SLP`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1 w-full bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-xs transition"
                      >
                        <span>📱</span> WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}