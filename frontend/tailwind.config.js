/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                // Paleta oficial "Perritos Perdidos SLP"
                paliacate: "#E8622C", // Naranja Paliacate — urgencia, CTAs
                confianza: "#2C5F8A", // Azul Confianza — navegación, adopción
                esperanza: "#4A9B6E", // Verde Esperanza — resuelto / casos de éxito
                arena: "#F5EFE6", // Arena Cálida — fondo general
                carbon: "#33302E", // Gris Carbón — tipografía principal
                theme: {
                    page: "var(--bg-page)",
                    surface: "var(--bg-surface)",
                    input: "var(--bg-input)",
                    main: "var(--text-main)",
                    muted: "var(--text-muted)",
                    border: "var(--border-color)",
                    primary: "var(--brand-primary)",
                    secondary: "var(--brand-secondary)",
                },
            },
        },
    },
    plugins: [],
};