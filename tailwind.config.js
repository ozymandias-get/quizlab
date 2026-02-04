/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./frontend/index.html",
        "./frontend/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
                'display': ['Playfair Display', 'Georgia', 'serif'],
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
                    950: '#362a21',
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
                    950: '#0c0a09',
                },
            },
        },
    },
    plugins: [],
}
