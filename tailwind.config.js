/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif']
      },
      colors: {
        sand: {
          50: '#fdfcfb',
          100: '#f9f6f2',
          200: '#f2ebe0',
          300: '#e8dbc9',
          400: '#d4c5a9',
          500: '#c4a882',
          600: '#b8956f',
          700: '#9a7a5a',
          800: '#7d634d',
          900: '#665241',
          950: '#362a21'
        },
        stone: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
          950: '#0c0a09'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      // Quizlab UI type scale — prefer text-ql-* over arbitrary text-[Npx]
      fontSize: {
        'ql-10': ['10px', { lineHeight: '1.35' }],
        'ql-11': ['11px', { lineHeight: '1.4' }],
        'ql-12': ['12px', { lineHeight: '1.45' }],
        'ql-14': ['13px', { lineHeight: '1.45' }],
        'ql-16': ['15px', { lineHeight: '1.4' }],
        'ql-20': ['18px', { lineHeight: '1.25' }],
        'ql-28': ['24px', { lineHeight: '1.15' }]
      },
      // Pairs with uppercase micro labels — prefer tracking-ql-* over tracking-[Nem]
      letterSpacing: {
        'ql-tune': '0.005em',
        'ql-fine': '0.01em',
        'ql-mono': '0.03em',
        'ql-micro': '0.06em',
        'ql-chrome': '0.08em',
        'ql-caps': '0.1em',
        'ql-strong': '0.12em',
        'ql-label': '0.14em',
        'ql-soft': '0.15em',
        'ql-dense': '0.16em',
        'ql-standard': '0.18em',
        'ql-spread': '0.2em',
        'ql-section': '0.22em',
        'ql-eyebrow': '0.3em',
        'ql-kicker': '0.32em'
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
