/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: { 950:'#0a0c10', 900:'#0f1117', 800:'#161b25', 700:'#1e2535', 600:'#253047' },
        brand:   { 400:'#38bdf8', 500:'#0ea5e9', 600:'#0284c7' },
        accent:  { 400:'#a78bfa', 500:'#8b5cf6' },
        success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
      },
      fontFamily: { mono: ['JetBrains Mono', 'Fira Code', 'monospace'] },
    },
  },
  plugins: [],
}
