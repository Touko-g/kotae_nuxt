import type { CookieOptions } from 'nuxt/app'

export const AUTH_COOKIE_OPTIONS: CookieOptions = {
    secure: true,
    sameSite: 'lax',
}
