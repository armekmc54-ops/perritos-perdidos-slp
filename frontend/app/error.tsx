'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Detalle del error en cliente:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#F8F6F0] text-center font-sans text-[#1F2937]">
      <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-4xl mb-4 shadow-inner">
        🐶
      </div>
      <h2 className="text-xl md:text-2xl font-bold mb-2">
        ¡Vaya! Hubo un detalle al cargar
      </h2>
      <p className="text-sm text-gray-600 max-w-md mb-6 leading-relaxed">
        No te preocupes, los reportes comunitarios y la información de las mascotas están a salvo. Puedes intentar recargar la pantalla o volver al inicio.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={() => reset()}
          className="bg-[#E8622C] hover:opacity-90 active:scale-95 text-white font-bold py-2.5 px-6 rounded-full shadow-md text-sm transition"
        >
          🔄 Reintentar
        </button>
        <button
          onClick={() => (window.location.href = '/')}
          className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 active:scale-95 font-bold py-2.5 px-6 rounded-full text-sm transition shadow-xs"
        >
          🏠 Ir al Inicio
        </button>
      </div>
    </div>
  );
}
