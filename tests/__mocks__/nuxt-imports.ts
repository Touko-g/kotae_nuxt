// Mock Nuxt auto-imports used across composables
import { ref, reactive, computed, markRaw, h } from 'vue'

export { ref, reactive, computed, markRaw, h }

// Nuxt-specific globals
const stateStore = new Map<string, ReturnType<typeof ref>>()

export const useState = <T>(key: string, init?: () => T) => {
    if (!stateStore.has(key)) {
        stateStore.set(key, ref(init ? init() : undefined))
    }
    return stateStore.get(key)!
}

// Reset state between tests
export const _resetState = () => stateStore.clear()

const cookieStore = new Map<string, ReturnType<typeof ref>>()

export const useCookie = (key: string) => {
    if (!cookieStore.has(key)) {
        cookieStore.set(key, ref(null))
    }
    return cookieStore.get(key)!
}

export const _resetCookies = () => cookieStore.clear()

export const useRuntimeConfig = () => ({
    public: {
        apiBase: 'https://kotae.cn/api/',
    },
})

export const navigateTo = vi.fn()

export const defineNuxtRouteMiddleware = (fn: Function) => fn
