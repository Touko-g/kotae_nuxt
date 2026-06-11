// Provide Nuxt auto-imported globals for test environment
import { vi } from 'vitest'
import { ref, reactive, computed, markRaw, h, toRaw } from 'vue'

// Vue reactivity globals
globalThis.ref = ref as any
globalThis.reactive = reactive as any
globalThis.computed = computed as any
globalThis.markRaw = markRaw as any
globalThis.h = h as any
globalThis.toRaw = toRaw as any

// State store for useState mock
const stateStore = new Map<string, any>()

globalThis.useState = ((key: string, init?: () => any) => {
    if (!stateStore.has(key)) {
        stateStore.set(key, ref(init ? init() : undefined))
    }
    return stateStore.get(key)!
}) as any

// Cookie store for useCookie mock
const cookieStore = new Map<string, any>()

globalThis.useCookie = ((key: string) => {
    if (!cookieStore.has(key)) {
        cookieStore.set(key, ref(null))
    }
    return cookieStore.get(key)!
}) as any

globalThis.useRuntimeConfig = (() => ({
    public: {
        apiBase: 'https://kotae.cn/api/',
    },
})) as any

globalThis.navigateTo = vi.fn() as any

globalThis.defineNuxtRouteMiddleware = ((fn: Function) => fn) as any

// Mock useSnackbar (used by useHttp)
globalThis.useSnackbar = (() => ({
    show: vi.fn(),
    close: vi.fn(),
    messages: reactive([]),
})) as any

// Mock useHttp for API composable tests
// Each test file can override these mocks via __mockHttp
const defaultHttpMocks = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
    loading: computed(() => false),
    request: vi.fn(),
}

globalThis.__mockHttp = defaultHttpMocks
globalThis.useHttp = (() => globalThis.__mockHttp) as any

// Mock useAuth for useHttp's onResponseError (which calls useAuth().refresh)
globalThis.useAuth = (() => ({
    isLogin: ref(false),
    refresh: vi.fn(),
    login: vi.fn(),
    verify: vi.fn(),
    getCode: vi.fn(),
    resetCode: vi.fn(),
    resetPsw: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
    getCosKey: vi.fn(),
})) as any

// Mock $fetch (used by useHttp.request)
globalThis.$fetch = vi.fn() as any

// Helpers to reset state between tests
export const _resetState = () => stateStore.clear()
export const _resetCookies = () => cookieStore.clear()
