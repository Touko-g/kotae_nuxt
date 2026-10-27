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
npm run typecheck        # nuxt prepare && vue-tsc --noEmit (see note below)
```

`npm run typecheck` deliberately runs `nuxt prepare` first. Calling `nuxi typecheck` on its own races with its own prepare step and can report a bogus error set (auto-imported globals like `useRuntimeConfig` / `ref` suddenly "not found", or errors jumping between files). If the result looks absurd, re-run it — or run `nuxt prepare && vue-tsc --noEmit -p .nuxt/tsconfig.json` manually.

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

server/                  # Nitro server routes (auto-routed)
└── routes/
    └── rss.xml.ts       # GET /rss.xml — RSS 2.0 订阅源（数据取自后端文章列表接口）

scripts/                 # 一次性/定时运行的运维脚本（不参与构建）
└── broadcast.mjs        # 新文章 → Telegram / Discord / X 广播，轮询 RSS + guid 去重

shared/types/ai.ts       # AI types shared by app + server (`#shared/types/ai`)
shared/types/api.ts      # pure backend interfaces (Article / Tag / User / paging) — also read by nuxt.config.ts
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

### AI Capability Layer (Qwen)

Qwen (Alibaba Cloud Bailian / DashScope, OpenAI-compatible mode) is proxied through Nitro — **the API key never reaches the browser**. Do not call `dashscope.aliyuncs.com` from a component.

```typescript
const ai = useAI({ system: '你是中文写作助手' })

await ai.askStream('帮我润色：……')        // streaming, text accumulates in ai.content
const res = await ai.ask('起 5 个标题')   // non-streaming, returns { content, usage, ... }
```

- `POST {apiBase}ai/chat/` → `{ content, model, usage, finishReason }`
- `POST {apiBase}ai/chat-stream/` → SSE, each `data:` is one normalized event: `{type:'delta'|'done'|'error'}`.
- `GET {apiBase}ai/models/` → `{ models, source, default }`. DashScope's compatible mode has no reliable `/models`, so the backend probes it once (4 s timeout, 10 min cache, bucketed per user) and falls back to its built-in catalog; `source` tells the UI which one it got. `is_chat_model()` filters out rerank / embedding / tts / image ids — those 502 on `chat/completions`.
- `GET {apiBase}ai/quota/` → `{ today, total, officialAvailable, consoleUrl }`. **Free quota has no public API** (Bailian only exposes it in the console), so `officialAvailable` is always `false` and the UI links out instead of faking a number. `today` / `total` come from the backend ledger (`AiUsage` table, one row per user/day/model).
- `GET|PUT|DELETE {apiBase}ai/credential/` → the user's own API key. GET returns a mask only; PUT with an empty `api_key` keeps the stored one; the key is Fernet-encrypted at rest.
- `402` = `AllocationQuota.FreeTierOnly` (free quota exhausted). The message says to open the Bailian console; don't fold it into the generic `502`.
- Request body (both chat routes): `{ messages: AiMessage[], model?, temperature?, maxTokens?, topP?, system?, extra? }`. `extra` is passed straight to the upstream body (e.g. `{ enable_search: true }`).
- Guardrails live in `backend/ai/services.py`: message count / length caps, 40-message window, per-**user** DRF throttle (`AI_THROTTLE_RATE`), upstream timeout, and disconnect propagation.
- Error codes (body `{detail, code}`): `400 ai_key_missing` / `400 ai_key_invalid` / `401` not logged in / `402 ai_quota_exhausted` / `429 ai_rate_limited` / `502 ai_upstream_error`. `useAI` surfaces these as `error` + `errorCode`; `needKey` flips on `ai_key_missing`.
- AI requires login **and** a configured key. `useAiClient().available` = site switch ∧ logged in; `AiAssistDialog` additionally gates on `configured` and opens `AiCredentialDialog` instead of firing a request.
- Streaming is served by `backend/ai/asgi.py`, **not** `StreamingHttpResponse` — Django 4.0's ASGI handler iterates streaming responses synchronously on the event loop, which would freeze Channels. Keep `X-Accel-Buffering: no`; behind nginx also disable `proxy_buffering`.

**UI layer.** Two shared components, both driven by `useAI`:

- `AiMenuButton.vue` — the entry point (menu of actions). Pass `label` for a labeled button, omit it for an icon-only one. `items` is `{ key, text, icon }[]`, emits `select(key)`.
- `AiAssistDialog.vue` — streaming result panel with action chips, source preview, copy / regenerate / stop / apply. It takes `actions: AiAssistAction[]` (each carries its own finished prompt) and `initialKey`, emits `apply(result, key)`. The caller decides what "apply" means.
- `AiModelSelect.vue` + `useAiModels.ts` — model picker in the dialog title. The choice is stored in the `ai_model` cookie (SSR-safe, no flash). Switching it while a result exists only clears the result — it does **not** re-run the request, because a stray click on the picker shouldn't burn quota. The same composable exposes `quota` / `formatTokens` for the usage line.

  Filtering is done **by hand**, same shape as the tag search in `ArticleForm.vue`: `no-filter` turns off Vuetify's chain, `@update:search` feeds a local `keyword` ref, and a `computed` replaces `:items`. Do **not** go back to `:custom-filter` — `v-autocomplete` defaults to `filterKeys: ['title']`, so the filter is invoked once per key with `(value, query, item)` where `value` is the *field* value, not the item. Reading `item.raw` off the first argument silently matches nothing, which is exactly how "输入 q 却提示没有匹配的模型" happened. Matching is plain substring after `normalize()` strips space / `_` / `.` / `-` / `/`, across `id` / `label` / `desc` (upstream can return dozens of models, and `desc` is where 超长上下文 lives). Two more guards: `@update:search` ignores the text Vuetify writes back on focus/select (compare against `currentLabel`), otherwise reopening the menu shows a single row; and the `update:modelValue` handler tolerates `null` — clearing the search box must not be read as "deselect the model". Don't add a `#selection` slot — a custom selection renderer fights the search input for the field's display area.

Entry points: `ArticleForm.vue` (润色/扩写/缩写/标重点/续写/起标题/翻译) and `ArticleComment.vue` (评论 + 回复框：润色/缩写/更热情/翻译/生成). Both are hidden when `public.aiEnabled` is false.

`ArticleComment.vue` has **two** AI contexts and they must not share a prompt: 评论文章 (`target: 'comment'`) and 回复评论 (`target: 'reply'`). A reply has to engage with what the other person said, so `handleOpen` stores the parent comment in `data.reply_info.reply_content` and `replyContext()` feeds it in. Without that context the model just writes another generic comment about the article.

`generate_comment` and `generate_reply` are **two separate actions**, not one action with two labels. They were once a single `generate` key whose label swapped on `target` — that broke the prompt config panel, which could only ever show one of them (after opening AI in a reply box, 「帮我写一条」 vanished from the list). Each now has its own key, its own prompt, and its own entry in the panel. `AI_MENU` carries a `target` field (`'both' | 'comment' | 'reply'`) and `aiMenuFor(target)` filters on it; `aiBuiltins` deliberately does **not** filter, so the panel always lists everything.

Both `generate` prompts share `HUMAN_RULE`: a comment must read like a real reader's offhand remark — 语气词 / 吐槽 / 自嘲 allowed, 1–2 emoji allowed, but no 总结体, no 四字词堆砌, no 客服腔. Do **not** reintroduce a blanket "不要用表情符号" constraint; comments are plain text (`{{ comment.content }}`), so emoji need no sanitizing.

**Color policy.** By default the model is told **not** to invent colors (`COLOR_RULE_OFF`) but to preserve inline styles already in the source — otherwise 润色 silently repaints the article. The one exception is the `highlight` (标重点) action, which uses `COLOR_RULE_ON` and may wrap 1–3 key sentences in `<span style="color:#e41b23">` (site primary; ~3.7:1 on the dark card). Change `HIGHLIGHT_COLOR` in `ArticleForm.vue` to repaint the whole feature. The sanitizer already whitelists `color` / `background-color` with hex/rgb/hsl values, so no sanitizer change is needed.

Rules that matter when adding new AI actions:

- Build the prompt in the parent (it owns the text) and put the finished prompt in `AiAssistAction.prompt`; the dialog never composes prompts.
- Actions that rewrite text need a **selection**; only offer them when `editor.selection.getContent()` is non-empty, otherwise the user silently rewrites the whole article.
- TinyMCE loses its selection when the dialog takes focus — snapshot `editor.selection.getBookmark(2, true)` on open and `moveToBookmark` before inserting.
- Article actions are **rich text**: they send the selection as HTML (`getContent({ format: 'html' })`) and ask the model to return an HTML fragment, then run it through `app/composables/useAiHtml.ts` (`normalizeAiHtml`: strip ``` fences → fall back to `textToHtml` if the model ignored the instruction → DOMPurify whitelist). Never insert model HTML without that sanitizer.
- Insert with `editor.insertContent(html)` for both replace and continue — it replaces the selection when there is one. `selection.setContent` leaves a stray `<p>&nbsp;</p>` on multi-block selections.
- `AiAssistAction.format` (`'html' | 'text'`) drives the panel preview: `html` renders sanitized rich text, `text` shows pre-wrap plain text (titles, comments). The preview runs the **same** `normalizeAiHtml` pipeline as Apply, so what you see is what lands in the article.
- Code blocks must be `<pre class="language-xxx"><code>…</code></pre>`. `useArticleHtml` only syntax-highlights that exact shape, so `sanitizeAiHtml` whitelists `class` **only** as `language-*` on `pre`/`code` (everything else is stripped). `normalizeAiHtml` also converts stray Markdown fences into that shape — leaving them alone puts a literal ```` ```js ```` line in the published article.

**Custom prompts (`app/composables/useAiPrompts.ts`).** Users can rewrite a built-in action's prompt or add their own actions. Config lives in `localStorage` under `ai_prompts`, split by scope (`article` / `comment`) — the two contexts have different material (rich text + title vs. a plain-text draft), so they never share a config.

- `resolveBuiltin(scope, key, fallback, vars, format)` returns the user's template if they overrode it, otherwise `fallback` **as-is**. `fallback` must already contain the source text and HTML rules — running it through `renderAiPrompt` again appends the text twice.
- `customActions(scope, vars)` builds the extra actions appended to the menu; their `key` carries the `custom:` prefix.
- Placeholders are `{{text}}`, `{{title}}`, `{{reply}}` and `{{article}}`. **One placeholder = one thing, never keyed off the action**: `{{text}}` is always the selection / draft the user is working on (empty for generation actions — there is no draft), `{{article}}` is always the article excerpt, `{{title}}` the article title, `{{reply}}` the comment being replied to. Generation actions (`generate_comment` / `generate_reply`) therefore use `{{article}}`, not `{{text}}`. This was wrong once: `{{text}}` was made to fall back to the article body for generation actions, which put the *same* value behind two names — users couldn't tell which to use, and "为什么 text 和 article 是一样的" was the bug report. `{{reply}}` only applies to `generate_reply` — it carries "who you're replying to and what they said" at runtime, so it must never be baked into a template. If a template omits `{{text}}` **and** the draft is non-empty, the draft is appended at the end (otherwise the model gets no material and burns a request for nothing); an empty draft appends nothing. `format: 'html'` automatically appends `AI_HTML_RULE_BASE + AI_COLOR_RULE_OFF`.
- Full-width braces `｛｛text｝｝` are normalized to half-width before matching (`normalizeBraces`) — a Chinese IME makes `｛` very easy to type, and an unmatched placeholder silently leaves the literal in the prompt while the source gets appended instead.
- `migrateGenerateOverrides` rewrites a **stored** `generate_*` override's `{{text}}` to `{{article}}` on load. Overrides saved while `{{text}}` still fell back to the article body would otherwise render as an empty string — the prompt keeps only the title, the request still costs quota, and nothing on screen looks wrong. It skips templates that already mention `{{article}}` (both placeholders present = the user is distinguishing them on purpose) and normalizes full-width braces first. Runs on load, not on write, so it is idempotent and needs no version field.
- Editing a prompt does **not** re-run the request. `AiPromptDialog` only emits `prompts-changed`; the caller rebuilds `actions` from the cached selection, and the user clicks 重新生成 themselves.
- `AiPromptDialog` only understands `AiBuiltinAction[]` (`key` / `label` / `icon` / `format` / `vars`). The caller resolves i18n keys into labels before passing them — the panel holds no business knowledge.
- **The panel only lists placeholders that action can actually fill.** Each `AiBuiltinAction` declares `vars` (default `['text','title']`), and `customVars` covers user-defined actions. `{{reply}}` on 「帮我写一条」 and `{{text}}` on any generation action are not merely empty — they are structurally empty, so offering a chip for them is a trap: the user inserts it, the prompt grows two blank slots, and it reads as "占位符又失效了". Earlier the chips were gated on `scope === 'comment'` instead, which leaked exactly these two.
- If a template still *contains* an unavailable placeholder (a saved override, or the user typed it), a warning line names it (`emptyVarsIn`) — silent empty-string substitution is the failure mode users keep reporting. The check normalizes full-width braces first, otherwise `｛｛text｝｝` slips through unnoticed.
- Never write `{{ '{{text}}' }}` in a template. Vue's interpolation scan hits the inner `}}` and the expression is truncated into `'{{text`, which fails to compile. Build the token in script (`tokenOf(name)` → `` `{{${name}}}` ``) and loop over a chip list instead.

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
| `NUXT_PUBLIC_AI_ENABLED` | Site-level AI switch (hides all AI entry points when `false`) | `true` |

AI has **no** frontend server-side config any more: each user supplies their own key, stored encrypted by Django.
Backend knobs (`backend/.env`): `AI_DEFAULT_BASE_URL`, `AI_DEFAULT_MODEL`, `AI_TEMPERATURE`, `AI_MAX_TOKENS`,
`AI_CONNECT_TIMEOUT`, `AI_TIMEOUT`, `AI_THROTTLE_RATE`.

Copy `.env.example` to `.env` for local public config; no AI key is needed on the frontend.

Never hardcode `https://kotae.cn` in pages — read `useRuntimeConfig().public.siteUrl`.

## Important Notes

- Type checking runs on demand via `npm run typecheck` (`vue-tsc`); `typescript.typeCheck` stays `false` so `nuxt build` doesn't pay for it. There are no tests and no CI, so lint + typecheck are the only automated gates
- Auto-imports enabled for `composables/api/` directory. **Auto-imported types do not survive outside the Nuxt app context**, and `import type` does not help: the *target file itself* still enters the program. `nuxt.config.ts` belongs to the node project (no auto-imports), so importing `Article` from `composables/api/useArticle` dragged `useHttp` / `useTag` / `useUser` in and produced 20 `TS2304 Cannot find name 'useCookie' / 'ref' / 'useState'`. Fix: pure interfaces live in `shared/types/api.ts` (`BaseParams`, `BaseResponse`, `Tag`, `User`, `Article`, `ArticleListResponse`), and `base.ts` / `useTag.ts` / `useUser.ts` / `useArticle.ts` re-export them so old import paths keep working. `nuxt prepare` then auto-imports those types project-wide straight from `shared/`. Rule: anything `nuxt.config.ts` needs must be a types-only file with zero imports
- Run `npx vue-tsc -b tsconfig.json` (project-reference mode, what the IDE uses) — `npm run typecheck` only checks the app project and will happily pass while the node project is broken
- **vue-tsc gotcha**: a *static* attribute whose value contains `https://` (e.g. `lazy-src="https://…"`) makes Volar lose the enclosing slot scope, so every slot prop becomes "Cannot find name" (TS2304). It reproduced on `photo.vue`'s `<v-hover v-slot="{ isHovering, props }">`. Fix: hoist the URL into a `const` and bind it (`:lazy-src="LAZY_SRC"`). The slot syntax itself (`v-slot` on the element vs `<template #default>`) is irrelevant — don't "fix" it there
- **`withDefaults` narrowing does not reach the template.** `const props = withDefaults(defineProps<P>(), { x: () => [] })` makes `props.x` non-optional *in script*, but a bare `x` inside `<template>` still resolves against the declared `P` and stays `T | undefined` → `TS2345: Argument of type T[] | undefined is not assignable to parameter of type T[]`. `vue-tsc` on the CLI did **not** flag it (it only shows up in the editor's Volar). Fix: drop `withDefaults` for that field and coalesce explicitly with a `computed` (`const list = computed<T[]>(() => props.x ?? DEFAULT)`), then bind `list` in the template
- Sitemap generated dynamically from API data — the entry field is `loc`, **not** `url`; a `url` key is silently dropped by `@nuxtjs/sitemap`
- **RSS** lives at `server/routes/rss.xml.ts` (`/rss.xml`). It reads the public article list straight from `apiBase`, so it needs no backend change; site name / description are constants at the top of that file. Two non-obvious bits: the feed carries the **full body** in `content:encoded` (relative `src`/`href` are rewritten to absolute, otherwise readers 404 on images and internal links), and an upstream failure returns an **empty but valid** channel rather than 5xx — readers back off or unsubscribe on repeated 5xx. `?limit=N` (1–50, default 20) is there for debugging. Discovery comes from the `rel="alternate"` link in `nuxt.config.ts` `app.head.link` plus the footer button, so adding a feed doesn't require touching any page
- `x-robots-tag: noindex, nofollow` on every route during `nuxt dev` is **expected** — `@nuxtjs/robots` blocks indexing in development. Append `?mockProductionEnv` to any URL to see the production rule (`index, follow, max-image-preview:large, …`). Don't "fix" it in config
- **New-article broadcast** lives in `scripts/broadcast.mjs` (zero deps, Node built-ins only; run via `npm run broadcast`). It polls the RSS feed and uses `<guid>` as the idempotency key, recording **per platform** so a failed channel is retried alone next run. Two behaviours worth remembering: (1) items older than `BROADCAST_MAX_AGE_HOURS` (default 72) are recorded but **not** sent, which is what keeps the first run from dumping the whole archive — use `--all` to force it; (2) `--dry-run` prints the exact payload per platform and writes no state, so always eyeball it before wiring up cron. X posting is raw OAuth 1.0a over `POST /2/tweets` (JSON body is *not* signed, only `oauth_*` params are), and the 280 limit is computed with X's weighted rules — CJK counts 2, every URL counts 23, and `…` (U+2026) also counts 2, so truncation loops on the *final* string rather than reserving a fixed budget. **Weibo is deliberately unsupported**: `statuses/update` has been restricted since 2017 and the only open endpoint (`statuses/share`) posts a bare link with a 30-day token
- Site deployed at `https://kotae.cn`
- `vue3-emoji-picker` calls `initialize()` at module scope and opens IndexedDB; on the server this logs `ReferenceError: indexedDB is not defined` as an unhandled rejection. It is harmless but noisy — render the picker client-side if it needs cleaning up
