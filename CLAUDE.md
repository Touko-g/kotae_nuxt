# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kotae 是一个基于 Nuxt 3 构建的内容分享平台（博客/笔记系统），支持文章发布、评论、点赞、用户管理等功能。项目使用 TypeScript 开发，集成了 Vuetify 作为 UI 组件库，支持国际化（i18n）和深色/浅色主题切换。

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
- **Framework**: Nuxt 3 (Vue 3 + Nitro)
- **UI Library**: Vuetify 3 + TailwindCSS
- **Language**: TypeScript
- **HTTP Client**: `$fetch` (Nuxt built-in, wrapped in `useHttp`)
- **Auth**: JWT (access + refresh tokens)
- **State**: Vue `useState` for global state, Cookies for auth persistence
- **i18n**: `@nuxtjs/i18n` with English/Chinese support
- **Icons**: Material Design Icons (mdi)

### Directory Structure

```
app/
├── components/          # Vue components (auto-imported)
│   ├── AppBar.vue      # Top navigation bar
│   ├── *Dialog.vue     # Modal dialogs (Login, Register, Reset, Search)
│   └── Article*.vue    # Article-related components
├── composables/         # Auto-imported composables
│   ├── useHttp.ts      # HTTP client wrapper with auth & error handling
│   ├── useSnackbar.ts  # Global snackbar notifications
│   ├── useRules.ts     # Form validation rules
│   └── api/            # API endpoint composables
│       ├── useAuth.ts      # Auth APIs (login, register, refresh)
│       ├── useArticle.ts   # Article CRUD
│       ├── useComment.ts   # Comments
│       ├── useUser.ts      # User profile
│       └── ...
├── layouts/            # Layout templates
│   └── default.vue     # Main layout with navigation drawers
├── pages/              # File-based routing
│   ├── index.vue       # Home page with article list
│   ├── article/
│   │   ├── [id].vue    # Article detail
│   │   ├── create/     # Create article
│   │   └── like/       # Liked articles
│   ├── user/
│   │   ├── [id].vue    # User profile
│   │   └── editPwd/    # Change password
│   └── ...
├── middleware/         # Route middleware
│   └── auth.ts         # Login check middleware
├── plugins/            # Nuxt plugins
│   ├── i18n-router.client.ts  # Locale-aware router navigation
│   └── permissions.ts         # Permission directives
└── assets/             # Static assets

i18n/
├── i18n.config.ts      # i18n configuration
└── locales/
    ├── zh/             # Chinese translations
    └── en/             # English translations
```

## Key Patterns

### HTTP Client (`useHttp`)

All API calls go through `useHttp` composable which provides:
- Automatic JWT token injection from cookies
- Token refresh on 401 responses
- Global loading state (`loadingCount`)
- Error handling via snackbar notifications
- Helper methods: `get`, `post`, `put`, `del`

```typescript
const { get, post } = useHttp()
const data = await get<Article>('/article/1/')
```

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

### i18n Usage

- Translations in `i18n/locales/{lang}/`
- Vuetify locale synced with app locale
- Use `useLocale()` composable (wrapper around `useI18n`)
- Router navigation automatically adds locale prefix via plugin

## Environment Configuration

Key runtime config in `nuxt.config.ts`:
- `public.apiBase`: Backend API URL (defaults to `https://kotae.cn/api/`)
- API base can be overridden via `NUXT_PUBLIC_API_URL` env var

## Important Notes

- Type checking is disabled (`typescript.typeCheck: false`)
- Auto-imports enabled for `composables/api/` directory
- Site deployed at `https://kotae.cn`
- Sitemap generated dynamically from API data
