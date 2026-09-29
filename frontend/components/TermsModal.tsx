'use client';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSection?: 'terms' | 'allies';
}

export default function TermsModal({ isOpen, onClose }: TermsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-theme-surface text-theme-main rounded-3xl w-full max-w-2xl p-5 sm:p-7 shadow-2xl relative my-6 max-h-[90vh] flex flex-col border border-theme transition-colors">
        {/* Header del Modal */}
        <div className="flex items-center justify-between border-b border-theme pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-paliacate/10 text-paliacate border border-paliacate/20 flex items-center justify-center text-xl shrink-0">
              ⚖️
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-theme-main leading-tight">
                Términos, Condiciones y Deslinde Legal
              </h2>
              <p className="text-[11px] text-theme-muted">
                Perritos o Animales Perdidos • Desarrollado por <strong>M&amp;A DIGITAL ARTISANS</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-theme-muted hover:text-theme-main font-bold text-2xl w-8 h-8 rounded-full flex items-center justify-center transition"
          >
            ×
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="overflow-y-auto pr-1 sm:pr-2 my-4 space-y-5 text-xs text-theme-muted leading-relaxed">
          
          {/* SECCIÓN 1: NATURALEZA Y DESLINDE LEGAL DE RESPONSABILIDAD */}
          <div className="p-4 rounded-2xl bg-theme-input/70 border border-theme">
            <h3 className="text-xs font-bold text-theme-main uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <span>🛡️</span> 1. Deslinde Legal de Responsabilidad (Protección del Desarrollador y Empresa)
            </h3>
            <div className="space-y-2 text-[11px]">
              <p>
                <strong>Perritos o Animales Perdidos</strong> es una plataforma tecnológica independiente y comunitaria sin fines de lucro, creada y desarrollada por la empresa <strong>M&amp;A DIGITAL ARTISANS</strong>. Su único propósito es servir como canal público y puente de comunicación entre ciudadanos para el reporte colaborativo de animales domésticos extraviados, avistados o en adopción.
              </p>
              <p>
                <strong>Exclusión de Garantías:</strong> Ni el desarrollador individual ni <strong>M&amp;A DIGITAL ARTISANS</strong> garantizan ni se hacen responsables de que un animal reportado en la plataforma sea efectivamente localizado, avistado, recuperado o devuelto a sus propietarios. El éxito de cualquier reencuentro depende exclusivamente de la colaboración comunitaria y de las circunstancias particulares de cada caso.
              </p>
              <p>
                <strong>Sin Responsabilidad por Acuerdos, Recompensas o Transacciones Monetarias:</strong> Ni la plataforma ni sus creadores actúan como intermediarios, árbitros, fideicomisarios ni garantes en la entrega, negociación o pago de recompensas, ventas, cuotas de recuperación o gastos veterinarios. Cualquier transacción económica acordada entre particulares es bajo el absoluto y exclusivo riesgo de las partes involucradas. M&amp;A DIGITAL ARTISANS se deslinda expresamente de cualquier fraude, reclamo, disputa económica o engaño derivado de acuerdos entre terceros.
              </p>
              <p>
                <strong>Deslinde por Lesiones, Mordeduras, Agresiones o Incidentes Físicos:</strong> M&amp;A DIGITAL ARTISANS y el equipo de desarrollo quedan totalmente exentos de responsabilidad civil, penal o económica frente a cualquier lesión física, mordedura, arañazo, contagio de zoonosis (rabia, sarna, etc.), accidentes viales, allanamientos, robos, agresiones o altercados entre personas ocurridos durante la búsqueda, avistamiento, captura, rescate o entrega de animales.
              </p>
              <p>
                <strong>Contenido Generado por el Usuario:</strong> Las descripciones, fotografías, números de contacto y geolocalizaciones son ingresadas libremente por los usuarios. No nos responsabilizamos por información errónea, suplantaciones de identidad o datos falsos publicados por terceros, reservándonos el derecho de moderar o eliminar publicaciones sospechosas.
              </p>
            </div>
          </div>

          {/* SECCIÓN 2: OBLIGACIONES Y RECOMENDACIONES DE SEGURIDAD PARA USUARIOS */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-theme-main">
            <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <span>⚠️</span> 2. Obligaciones y Reglas de Seguridad para la Comunidad
            </h3>
            <ul className="space-y-2 text-[11px] list-disc list-inside text-theme-muted">
              <li>
                <strong className="text-theme-main">Puntos de Encuentro Seguros:</strong> Si conciertas la entrega de un animal o la entrega de una recompensa, reúnete <strong>SIEMPRE en lugares públicos, concurridos y bien iluminados</strong> (como plazas comerciales, explanadas municipales o clínicas veterinarias reconocidas). Nunca acudas a domicilios solitarios ni vayas solo(a).
              </li>
              <li>
                <strong className="text-theme-main">¡Cero Depósitos por Adelantado! (Prevención de Extorsión):</strong> Jamás deposites anticipos, recargas telefónicas ni transferencias bancarias a personas que afirmen tener a tu mascota si no te han permitido verla físicamente o verificarla en videollamada con señas particulares. Si alguien te pide dinero antes de mostrarte a tu animal, se trata casi con total certeza de un intento de estafa.
              </li>
              <li>
                <strong className="text-theme-main">Prohibición de Reportes Falsos o Maliciosos:</strong> Queda estrictamente prohibido subir reportes de broma, usar fotografías de animales de internet para pedir rescates o publicar información falsa. Dichas acciones resultarán en la eliminación inmediata del reporte y veto permanente del usuario.
              </li>
              <li>
                <strong className="text-theme-main">Trato Digno y Prudencia Animal:</strong> No intentes acorralar a un animal asustado o agresivo si no cuentas con la experiencia o equipo necesario; solicita apoyo a rescatistas o autoridades de bienestar animal.
              </li>
            </ul>
          </div>

          {/* SECCIÓN 3: ESPACIO PARA ALIADOS, VETERINARIAS, REFUGIOS Y MARCAS */}
          <div className="p-4 rounded-2xl bg-confianza/10 border border-confianza/20">
            <h3 className="text-xs font-bold text-confianza uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <span>🤝</span> 3. Espacio para Aliados, Veterinarias y Organizaciones Colaboradoras
            </h3>
            <p className="text-[11px] text-theme-muted mb-2">
              Creemos firmemente en el poder de la sinergia local. Esta plataforma abre sus puertas para sumar a:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] mb-3">
              <div className="bg-theme-surface p-2.5 rounded-xl border border-theme">
                <span className="font-bold text-theme-main block">🏥 Clínicas Veterinarias</span>
                <span className="text-[10px] text-theme-muted">
                  Ofrece lectura gratuita de microchips o tarifas preferenciales para perritos rescatados.
                </span>
              </div>
              <div className="bg-theme-surface p-2.5 rounded-xl border border-theme">
                <span className="font-bold text-theme-main block">🏡 Albergues y Refugios</span>
                <span className="text-[10px] text-theme-muted">
                  Canaliza tus perritos en adopción y coordina esfuerzos de hogar temporal.
                </span>
              </div>
              <div className="bg-theme-surface p-2.5 rounded-xl border border-theme">
                <span className="font-bold text-theme-main block">🛍️ Tiendas y Marcas de Mascotas</span>
                <span className="text-[10px] text-theme-muted">
                  Patrocina placas de identificación, alimento o suministros para rescates.
                </span>
              </div>
              <div className="bg-theme-surface p-2.5 rounded-xl border border-theme">
                <span className="font-bold text-theme-main block">📢 Medios y Difusores</span>
                <span className="text-[10px] text-theme-muted">
                  Súmate a la red de difusión de alertas urgentes en San Luis Potosí.
                </span>
              </div>
            </div>
            <a
              href="https://wa.me/524443211123?text=Hola,%20somos%20una%20veterinaria/organizaci%C3%B3n/marca%20y%20nos%20gustar%C3%ADa%20colaborar%20con%20Perritos%20o%20Animales%20Perdidos."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-confianza text-white font-bold text-xs py-2 px-3.5 rounded-xl hover:opacity-90 transition active:scale-95 shadow-xs"
            >
              <span>💬</span> Contactar para ser Aliado Oficial (WhatsApp)
            </a>
          </div>

          {/* SECCIÓN 4: DONACIONES Y SOSTENIBILIDAD TECNOLÓGICA */}
          <div className="p-4 rounded-2xl bg-esperanza/10 border border-esperanza/20">
            <h3 className="text-xs font-bold text-esperanza uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <span>💚</span> 4. Transparencia en Donaciones Voluntarias
            </h3>
            <p className="text-[11px] text-theme-muted">
              Cualquier aportación o donación económica recibida de usuarios es estrictamente voluntaria y tiene como <strong>único y exclusivo destino solventar los costos directos de infraestructura tecnológica</strong>: pago de servidores en la nube, bases de datos PostgreSQL en Supabase, certificados de seguridad SSL, almacenamiento de fotografías multimedia y licencias de software, garantizando que el servicio permanezca 100% gratuito, en línea y sin interrupciones para el bienestar animal.
            </p>
          </div>

          {/* SECCIÓN 5: CRÉDITOS Y PROPIEDAD INTELECTUAL */}
          <div className="p-4 rounded-2xl bg-theme-input/50 border border-theme text-center">
            <span className="text-2xl block mb-1">🏛️</span>
            <h4 className="font-bold text-xs text-theme-main uppercase tracking-wider">
              Desarrollado por M&amp;A DIGITAL ARTISANS
            </h4>
            <p className="text-[11px] text-theme-muted mt-1 max-w-lg mx-auto">
              Diseño, desarrollo web fullstack y mantenimiento tecnológico impulsado con orgullo por la empresa <strong>M&amp;A DIGITAL ARTISANS</strong> en San Luis Potosí, México. Todos los derechos reservados © {new Date().getFullYear()}.
            </p>
          </div>

        </div>

        {/* Footer del Modal con botón de entendido */}
        <div className="pt-3 border-t border-theme flex justify-end">
          <button
            onClick={onClose}
            className="bg-paliacate hover:opacity-90 active:scale-95 text-white font-bold text-xs py-2.5 px-6 rounded-xl transition shadow-xs"
          >
            Entendido y Acepto los Términos
          </button>
        </div>
      </div>
    </div>
  );
}
