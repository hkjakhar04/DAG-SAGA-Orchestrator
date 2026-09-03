/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./frontend/index.html",
    "./frontend/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0F172A', // Slate 900
        surface: '#1E293B',    // Slate 800
        primary: '#3B82F6',    // Blue 500
        success: '#10B981',    // Emerald 500
        danger: '#EF4444',     // Red 500
        warning: '#F59E0B',    // Amber 500
      }
    },
  },
  plugins: [],
}
