/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Midnight Terminal palette - IDE-inspired
        surface: {
          base: '#0a0e14',
          raised: '#0f1419',
          overlay: '#151b23',
          border: '#1e2530',
        },
        accent: {
          cyan: '#39bae6',
          orange: '#ff8f40',
          green: '#7fd962',
          purple: '#d2a6ff',
          red: '#f07178',
          yellow: '#e6b450',
        },
        text: {
          primary: '#e6e6e6',
          secondary: '#8b949e',
          muted: '#565d67',
        }
      },
      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        body: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'slide-in': 'slideIn 0.3s ease-out forwards',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(57, 186, 230, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(57, 186, 230, 0.5)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(57, 186, 230, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57, 186, 230, 0.03) 1px, transparent 1px)',
        'gradient-radial': 'radial-gradient(ellipse at center, var(--tw-gradient-stops))',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
    },
    container: {
      center: true,
      padding: '1rem',
    },
  },
  plugins: [],
};
