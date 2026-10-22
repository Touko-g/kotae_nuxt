# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kotae 是一个基于 Nuxt 4 构建的内容分享平台（博客/笔记系统），支持文章发布、评论、点赞、用户管理、通知、相册、心愿单、归档、标签云等功能。项目使用 TypeScript 开发，集成 Vuetify 3 作为 UI 组件库，支持中英双语与 4 套主题（light / dark / rainy / glass）。

## Common Commands

```bash
# Development
npm run dev              # Start development server on http://localhost:3000

# Build & Deploy
npm run build            # Build for production
npm run generate         # Generate static site
npm run preview          # Preview production build locally

# Code Quality
npm run lint             # Run ESLint on .js, .ts, .vue files
npm run lint:fix         # Run ESLint with auto-fix
npm run format           # Format code with Prettier
```

## Architecture Overview

### Tech Stack

- **Framework**: Nuxt 4 (Vue 3 + Nitro)
- **UI Library**: Vuetify 3 + TailwindCSS
- **Language**: TypeScript
- **HTTP Client**: `$fetch` (Nuxt built-in, wrapped in `useHttp`)
- **Auth**: JWT (access + refresh tokens)
- **State**: Vue `useState` for global state, Cookies for auth persistence
- **i18n**: `@nuxtjs/i18n` with English/Chinese support
- **Icons**: Material Design Icons (mdi)
- **Storage**: 腾讯云 COS 直传（`useCosUpload`）
- **Sanitize**: `isomorphic-dompurify`（SSR 端由 jsdom 承载，客户端走原生 DOMPurify）

### Directory Structure

```
app/
├── components/          # Vue components (auto-imported)
│   ├── AppBar.vue       # Top navigation bar (theme / locale / sound toggles)
│   ├── AppFooter.vue    # Footer
│   ├── CommandPalette.vue  # Ctrl/⌘ + K command palette
│   ├── *Dialog.vue      # Modal dialogs (Login, Register, Reset, Search)
│   ├── ImageLightbox.vue   # Image lightbox
│   ├── SpeechInput.vue     # Web Speech API voice input
│   └── Article*.vue     # Article-related components
├── composables/         # Auto-imported composables
│   ├── useHttp.ts       # HTTP client wrapper with auth & error handling
│   ├── useArticleHtml.ts # Article body pipeline: Shiki highlight + DOMPurify
│   ├── useCosUpload.ts  # Tencent COS direct upload (single entry point)
│   ├── useToast.ts      # Sticker-style toast notifications
│   ├── useSound.ts      # Interaction sounds (cuelume wrapper)
│   ├── useThemeCycle.ts # 4-theme rotation
│   ├── useRules.ts      # Form validation rules
│   └── api/             # API endpoint composables
│       ├── useAuth.ts      # Auth APIs (login, register, refresh, COS key)
│       ├── useArticle.ts   # Article CRUD
│       ├── useComment.ts   # Comments
│       ├── useUser.ts      # User profile
│       └── useWish.ts      # Wishlist
├── layouts/             # Layout templates
│   └── default.vue      # Main layout with navigation drawers
├── pages/               # File-based routing
│   ├── index.vue        # Home page with article list
│   ├── article/
│   │   ├── [id].vue     # Article detail
│   │   ├── create/      # Create article
│   │   └── like/        # Liked articles
│   ├── archive/         # Archive by month
│   ├── tags/            # Tag cloud
│   ├── wishlist/        # Wishlist
│   ├── user/
│   │   ├── [id].vue     # User profile
│   │   └── editPwd/     # Change password
│   └── ...
├── middleware/          # Route middleware
│   └── auth.ts          # Login check middleware
├── plugins/             # Nuxt plugins
│   ├── cuelume.client.ts      # Global sound delegation
│   ├── i18n-router.client.ts  # Locale-aware router navigation
│   └── permissions.ts         # Permission directives
├── assets/              # Static assets
└── error.vue            # Global error page

i18n/
├── i18n.config.ts       # i18n configuration
└── locales/
    ├── zh/              # Chinese translations
    └── en/              # English translations
```

## Key Patterns

### HTTP Client (`useHttp`)

All API calls go through `useHttp` composable which provides:
- Automatic JWT token injection from cookies
- Token refresh on 401 responses (concurrent requests share one refresh via `pendingRefresh`)
- Global loading state (`loadingCount`)
- Error handling via toast notifications
- Helper methods: `get`, `post`, `put`, `patch`, `del`

```typescript
const { get, post } = useHttp()
const data = await get<Article>('/article/1/')
```

### Article Body Rendering (`useArticleHtml`)

**Never `v-html` raw API content in a page.** Article bodies go through one pipeline: Shiki highlight → DOMPurify sanitize, derived in a `computed`:

```typescript
const { html: renderedHtml } = useArticleHtml({
    html: () => article.value?.content,
    themeName: () => name.value,
    highlighter,
})
```

- Must stay in `computed`. Doing it in `onMounted` means SSR ships unsanitized HTML (stored-XSS surface) and mutating `article.content` pollutes the `useAsyncData` cache, so code blocks stop re-theming.
- The sanitizer runs on the server too (jsdom); the browser resolves to the native DOMPurify build, so jsdom never enters the client bundle.

### File Upload (`useCosUpload`)

```typescript
const { upload } = useCosUpload()
const url = await upload(file, { dir: 'blog/article' })
```

Bucket and region come from `runtimeConfig.public.cosBucket / cosRegion`. Do not instantiate the COS SDK in pages.

### Authentication Flow

1. Login stores `token`, `refresh`, `user` in cookies
2. `isLogin` global state (`useState`) tracks auth status
3. `useHttp` automatically injects Bearer token
4. On 401, attempts token refresh automatically
5. Refresh fails → clears cookies, redirects to home

### Route Middleware

- `auth.ts`: Checks login status, redirects to `/` if not authenticated
- Apply to protected pages: `definePageMeta({ middleware: 'auth' })`

### API Composables Pattern

Each API module exports a composable function returning typed methods:

```typescript
// app/composables/api/useArticle.ts
export const useArticle = () => {
  const { get, post, put, del } = useHttp()
  return {
    getArticle: (id) => get<Article>(`/article/${id}/`),
    getArticleList: (options) => get<ArticleListResponse>('/article/', options),
    // ...
  }
}
```

### Component Conventions

- Use `vuetify` components (`v-card`, `v-btn`, etc.)
- TailwindCSS for utility styling (e.g., `class="flex items-center"`)
- Global state via `useState()` for cross-component communication
- Dialogs controlled by global state (e.g., `useState('login')`)

### Page Shell (Container Convention)

Every page root MUST be a `v-container` with unified padding, no per-page `pa-*`/`ma-*` hacks on `v-row`:

```html
<v-container class="px-4 px-sm-6 py-6 py-sm-10">
    <v-row>… page grid …</v-row>
</v-container>
```

- **Wide pages** (with a side column: home, article detail, user profile): default `v-container` width (no `max-w-*`).
- **Reading pages** (single column / grid flows: search, likes, photos, messages, profile edit, password edit, article form, message board): add `max-w-5xl` to the shell.
- Spacing comes only from the shell (`px-4 px-sm-6 py-6 py-sm-10`); do not add `mx-auto` (v-container self-centers) or root-level margin/padding hacks.

### Theming

Four Vuetify themes: `light` → `dark` → `rainy` → `glass`, cycled by `useThemeCycle`. All decorative styles in `main.css` (highlighter, stickers, blobs) are derived from `primary` / `secondary` tokens — new themes need no CSS changes.

The active theme is persisted in the `theme` cookie by `app/plugins/theme.ts` (restored during SSR so refresh keeps the theme without a flash). That plugin must run after the Vuetify plugin — it declares `dependsOn: ['vuetify:nuxt:client:plugin', 'vuetify:nuxt:server:plugin']`; the `order` option alone does not control execution order.

### i18n Usage

- Translations in `i18n/locales/{lang}/`; `index.ts` merges `$vuetify` messages into the same bundle
- In components, use **Vuetify's `useLocale()`** for `t()` and `current` (vuetify-nuxt-module syncs i18n messages into Vuetify); `useI18n()` is only used in Nuxt-only contexts such as `error.vue`
- Router navigation automatically adds locale prefix via `i18n-router.client.ts` (it wraps `router.push`)

## Environment Configuration

Runtime config in `nuxt.config.ts`:

| Variable | Purpose | Default |
|----------|---------|---------|
| `NUXT_PUBLIC_API_URL` | Backend API URL | `https://kotae.cn/api/` |
| `NUXT_PUBLIC_SITE_URL` | Site origin for canonical / og:url / sitemap | `https://kotae.cn` |
| `NUXT_PUBLIC_COS_BUCKET` | COS bucket | `chen-1302611521` |
| `NUXT_PUBLIC_COS_REGION` | COS region | `ap-nanjing` |

Never hardcode `https://kotae.cn` in pages — read `useRuntimeConfig().public.siteUrl`.

## Important Notes

- Type checking is disabled (`typescript.typeCheck: false`); there are no tests and no CI, so `npm run lint` is the only automated gate
- Auto-imports enabled for `composables/api/` directory
- Site deployed at `https://kotae.cn`
- Sitemap generated dynamically from API data
- `vue3-emoji-picker` calls `initialize()` at module scope and opens IndexedDB; on the server this logs `ReferenceError: indexedDB is not defined` as an unhandled rejection. It is harmless but noisy — render the picker client-side if it needs cleaning up
