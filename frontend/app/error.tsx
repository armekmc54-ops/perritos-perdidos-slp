'use client';

import { useEffect, useState } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error('Error detectado en cliente:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#F8F6F0] text-center font-sans text-[#1F2937]">
      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-3xl mb-3 shadow-inner">
        🐶
      </div>
      <h2 className="text-xl font-bold mb-1">
        ¡Vaya! Hubo un detalle al cargar
      </h2>
      <p className="text-xs text-gray-600 max-w-sm mb-3">
        No te preocupes, la información de los perritos está a salvo.
      </p>

      {/* Detalle técnico del error para diagnóstico rápido */}
      <div className="mb-4 max-w-sm w-full bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl text-left text-xs font-mono shadow-xs">
        <p className="font-bold text-[11px] text-red-900 mb-0.5">Mensaje de error:</p>
        <p className="break-all font-semibold text-red-700">
          {error?.message || error?.name || String(error)}
        </p>
        {error?.digest && (
          <p className="text-[10px] text-gray-500 mt-1">ID: {error.digest}</p>
        )}
        {error?.stack && (
          <div className="mt-2 pt-2 border-t border-red-200">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-[10px] text-red-600 underline font-sans"
            >
              {showDetails ? 'Ocultar traza' : 'Ver traza técnica'}
            </button>
            {showDetails && (
              <pre className="mt-1 text-[9px] text-gray-600 overflow-x-auto whitespace-pre-wrap max-h-32">
                {error.stack}
              </pre>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-center">
        <button
          onClick={() => reset()}
          className="bg-[#E8622C] hover:opacity-90 active:scale-95 text-white font-bold py-2 px-5 rounded-full shadow-md text-xs transition"
        >
          🔄 Reintentar
        </button>
        <button
          onClick={() => (window.location.href = '/')}
          className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 active:scale-95 font-bold py-2 px-5 rounded-full text-xs transition shadow-xs"
        >
          🏠 Ir al Inicio
        </button>
      </div>
    </div>
  );
}
