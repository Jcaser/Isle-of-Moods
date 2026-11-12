/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#1e2a33',
          700: '#3a4b57',
          500: '#5f7280',
          300: '#8fa1ad',
        },
        sea: {
          50: '#f0f8fa',
          100: '#ddeff3',
          200: '#bfe2ea',
          300: '#94cdd9',
          400: '#66b2c3',
          500: '#4a97aa',
          600: '#3a7b8d',
          700: '#326371',
        },
        lav: {
          50: '#f6f4fd',
          100: '#ece8fa',
          200: '#dcd5f5',
          300: '#c4b9ec',
          400: '#a99be0',
          500: '#8f7ed2',
        },
        sand: {
          50: '#fdfaf3',
          100: '#faf3e4',
          200: '#f3e6cb',
        },
        coral: {
          300: '#f6b6a6',
          400: '#ef9b87',
          500: '#e37f69',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Source Han Sans SC"',
          'sans-serif',
        ],
        display: [
          '"Optima"',
          '"Songti SC"',
          '"Source Han Serif SC"',
          '"Noto Serif SC"',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          'serif',
        ],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.75rem',
      },
      boxShadow: {
        soft: '0 18px 40px -24px rgba(58, 123, 141, 0.35)',
        float: '0 30px 70px -40px rgba(58, 123, 141, 0.45)',
      },
      animation: {
        'drift-slow': 'drift 34s linear infinite',
        'drift-mid': 'drift 22s linear infinite',
        'drift-fast': 'drift 15s linear infinite',
        float: 'float 7s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 4s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
      },
      keyframes: {
        drift: {
          '0%': { transform: 'translate3d(0,0,0)' },
          '100%': { transform: 'translate3d(-50%,0,0)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseSoft: {
          '0%,100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.04)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
