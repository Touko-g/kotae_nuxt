import type { Config } from 'tailwindcss'
import colors from 'tailwindcss/colors'

export default <Partial<Config>>{
    theme: {
        extend: {
            colors: {
                primary: colors.red,
            },
        },
    },
    plugins: [
        function ({ addUtilities }) {
            addUtilities({
                '.scrollbar-hide': {
                    'scrollbar-width': 'none' /* Firefox */,
                    '-ms-overflow-style': 'none' /* IE & Edge */,
                },
                '.scrollbar-hide::-webkit-scrollbar': {
                    display: 'none' /* Chrome, Safari */,
                },
            })
        },
    ],
}
