import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    resolve: {
        alias: {
            '~': resolve(__dirname, 'app'),
            '#imports': resolve(__dirname, 'tests/__mocks__/nuxt-imports.ts'),
            '#app': resolve(__dirname, 'tests/__mocks__/nuxt-app.ts'),
        },
    },
    test: {
        globals: true,
        environment: 'happy-dom',
        include: ['tests/**/*.test.ts'],
        setupFiles: ['tests/setup.ts'],
        coverage: {
            provider: 'v8',
            include: ['app/composables/**', 'app/middleware/**'],
        },
    },
})
