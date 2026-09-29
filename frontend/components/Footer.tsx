'use client';
import { useState } from 'react';

export default function Footer() {
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);

  return (
    <>
      <footer className="mt-12 border-t border-theme bg-theme-surface/90 text-theme-main py-10 px-4 md:px-8 transition-colors">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">
          
          {/* BANNER 1: MARCAS Y ORGANIZACIONES COLABORADORAS */}
          <div className="bg-gradient-to-r from-paliacate/10 via-amber-500/10 to-confianza/10 border border-theme rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xs">
            <div className="flex items-center gap-4 text-center md:text-left">
              <div className="w-14 h-14 rounded-2xl bg-theme-surface border border-theme flex items-center justify-center text-3xl shrink-0 shadow-sm">
                🤝
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-paliacate/15 text-paliacate px-2.5 py-0.5 rounded-full inline-block mb-1 border border-paliacate/20">
                  100% Sin Fines de Lucro
                </span>
                <h3 className="text-base md:text-lg font-bold text-theme-main">
                  Espacio para Marcas y Colaboradores Locales
                </h3>
                <p className="text-xs text-theme-muted max-w-xl mt-0.5">
                  ¿Tienes una veterinaria, tienda de mascotas o negocio en San Luis Potosí y deseas apoyar la causa comunitaria? Súmate como aliado para difundir o patrocinar insumos de rescate.
                </p>
              </div>
            </div>

            <a
              href="https://wa.me/524443211123?text=Hola,%20me%20gustar%C3%ADa%20colaborar%20como%20marca/veterinaria%20con%20Perritos%20Perdidos%20SLP."
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 bg-theme-surface hover:bg-paliacate hover:text-white border border-theme text-theme-main font-bold text-xs py-3 px-5 rounded-2xl shadow-sm transition active:scale-95 flex items-center gap-2"
            >
              <span>🐾</span>
              <span>Unirme como Colaborador</span>
            </a>
          </div>

          {/* SECCIÓN 2: DONACIONES VOLUNTARIAS & FILOSOFÍA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center border-t border-theme/60 pt-6">
            
            {/* Columna Izq: Identidad */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-2xl">🐶</span>
                <h4 className="font-bold text-sm text-theme-main">Perritos Perdidos SLP</h4>
              </div>
              <p className="text-xs text-theme-muted">
                Red ciudadana de localización, adopción y protección de animales domésticos en San Luis Potosí, S.L.P., México.
              </p>
            </div>

            {/* Columna Centro: Donaciones Voluntarias */}
            <div className="bg-theme-input/60 border border-theme rounded-2xl p-4 text-center md:text-left flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <h5 className="font-bold text-xs text-theme-main flex items-center justify-center md:justify-start gap-1.5">
                  <span>💚</span> Donaciones Voluntarias
                </h5>
                <p className="text-[11px] text-theme-muted mt-0.5">
                  Vía transferencia bancaria (SPEI).
                </p>
              </div>
              <button
                onClick={() => setIsDonationModalOpen(true)}
                className="shrink-0 bg-esperanza hover:opacity-90 active:scale-95 text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <span>💳</span>
                <span>Ver Datos SPEI</span>
              </button>
            </div>

            {/* Columna Der: Contacto de Emergencia */}
            <div className="text-center md:text-right">
              <p className="text-xs text-theme-muted">
                Línea comunitaria de WhatsApp:
              </p>
              <a
                href="https://wa.me/524443211123"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-mono font-bold text-sm text-paliacate hover:underline mt-1"
              >
                <span>📱</span> +52 444 321 1123
              </a>
              <p className="text-[10px] text-theme-muted mt-0.5">
                SLP • Hecho por y para la comunidad potosina
              </p>
            </div>
          </div>

          <div className="text-center text-[11px] text-theme-muted/70 pt-2 border-t border-theme/40">
            © {new Date().getFullYear()} Perritos Perdidos SLP — Proyecto comunitario independiente.
          </div>
        </div>
      </footer>

      {/* MODAL DE DONACIONES VOLUNTARIAS */}
      {isDonationModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-theme-surface text-theme-main rounded-3xl w-full max-w-md p-6 shadow-2xl relative border border-theme">
            <button
              onClick={() => setIsDonationModalOpen(false)}
              className="absolute top-4 right-4 text-theme-muted hover:text-theme-main font-bold text-2xl w-8 h-8 rounded-full flex items-center justify-center transition"
            >
              ×
            </button>

            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-esperanza/10 text-esperanza rounded-full flex items-center justify-center mx-auto text-3xl mb-2">
                💚
              </div>
              <h3 className="text-lg font-bold text-theme-main">Donaciones Voluntarias</h3>
              <p className="text-xs text-theme-muted mt-1">
                Para usuarios agradecidos y protectores que desean mantener activa la plataforma.
              </p>
            </div>

            <div className="bg-theme-input p-4 rounded-2xl border border-theme text-xs flex flex-col gap-3 mb-5">
              <div className="flex items-start gap-2.5">
                <span className="text-base shrink-0">🏛️</span>
                <div>
                  <strong className="text-theme-main block">Transferencia Bancaria Directa (SPEI)</strong>
                  <p className="text-theme-muted text-[11px]">
                    Todas las donaciones son 100% voluntarias y van destinadas exclusivamente al mantenimiento de infraestructura y soporte para rescatistas independientes.
                  </p>
                </div>
              </div>

              <div className="border-t border-theme pt-3 flex items-start gap-2.5">
                <span className="text-base shrink-0">📲</span>
                <div>
                  <strong className="text-theme-main block">¿Cómo obtener los datos de transferencia?</strong>
                  <p className="text-theme-muted text-[11px]">
                    Por seguridad y transparencia, solicita la cuenta CLABE enviando un mensaje directo de WhatsApp al número oficial:
                  </p>
                  <p className="font-mono font-bold text-paliacate mt-1 text-xs">
                    444 321 1123
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <a
                href="https://wa.me/524443211123?text=Hola%20Perritos%20Perdidos%20SLP,%20quisiera%20solicitar%20los%20datos%20bancarios%20para%20una%20donaci%C3%B3n%20voluntaria%20para%20apoyar%20el%20proyecto."
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-esperanza hover:opacity-90 active:scale-95 text-white font-bold py-3 rounded-2xl text-xs text-center shadow-md transition flex items-center justify-center gap-2"
              >
                <span>💬</span>
                <span>Pedir datos SPEI por WhatsApp (4443211123)</span>
              </a>

              <button
                type="button"
                onClick={() => setIsDonationModalOpen(false)}
                className="w-full py-2 text-xs text-theme-muted hover:text-theme-main font-semibold transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
