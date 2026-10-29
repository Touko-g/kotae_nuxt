# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kotae 是一个基于 Nuxt 4 构建的内容分享平台（博客/笔记系统），支持文章发布、评论、点赞、用户管理、通知、相册、心愿单、归档、标签云等功能。项目使用 TypeScript 开发，集成 Vuetify 3 作为 UI 组件库，支持中英双语与 3 套主题（light / dark / terminal）。

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
│   ├── InkTrail.vue        # Decorative cursor ink trail (full-viewport canvas)
│   ├── PwaUpdatePrompt.vue # "New version ready" prompt (prompt-mode SW)
│   ├── ReadAloudBar.vue    # Read-aloud button + playback bar
│   ├── SelectionAskBar.vue # Selection popover (explain / translate / expand / quiz)
│   ├── SpeechInput.vue     # Web Speech API voice input
│   └── Article*.vue     # Article-related components
├── composables/         # Auto-imported composables
│   ├── useHttp.ts       # HTTP client wrapper with auth & error handling
│   ├── useSpeechSynthesis.ts # Read-aloud: per-block playback + highlight
│   ├── useInkTrail.ts        # Ink trail sampling / drawing / teardown
│   ├── useTextSelection.ts   # Article selection detection + popover anchoring
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

server/                  # Nitro server (auto-routed)
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

### Reading Enhancements (selection ask / read-aloud)

Two client-only reading-layer features. Neither touches the SSR payload, and neither needs a backend change.

**Selection ask** — `useTextSelection` + `SelectionAskBar`, wired up in `pages/article/[id].vue`. `selectionchange` is debounced 120ms: dragging a selection fires it continuously, and popping the bar mid-drag is noise. The selection must sit **inside** the article container (`container.contains(range.commonAncestorContainer)`), otherwise highlighting a comment or the title pops it too. The bar is `Teleport`ed to `body` and positioned with viewport coordinates, which means it must carry the current `v-theme--*` class itself — Vuetify's tokens live on `.v-application`, outside the teleport target. Every node in the bar needs `@mousedown.prevent`: the default mousedown collapses the selection, `selectionchange` fires, and the bar unmounts before the click lands. The result panel reuses `AiAssistDialog` with `applyLabel` — "应用" is meaningless here, the action is copy. Actions are built in the page (it owns the selection), never in the dialog.

**Socratic ("反问我")** — the fourth action sets `kind: 'socratic'`, which switches `AiAssistDialog` into a three-step flow: the model turns the question back on the reader ("what would you like to know about this passage?"), the user states their doubt, the model answers it. It is explicitly **not** a quiz — the prompt has to say so in as many words, otherwise the model falls back to a comprehension question and the whole thing collapses into a roundabout "explain". Round two also asks the model to flag it if the user's own framing carries a misunderstanding. Two **separate** `useAI` instances on purpose: sharing one `content` ref means the question disappears the instant you submit (the answer overwrites it), and the two streams' `abort` / `pending` step on each other. The second prompt comes from the caller via `evaluatePrompt(question, answer)` — the dialog doesn't know the source text or the UI language. Round two re-sends source + question + doubt instead of leaning on `keepHistory`, so 「重新解答」 and mid-stream aborts can't inherit a stale context. Submit stays disabled while round one streams (answering a half-finished question is meaningless), and there is no 「应用」 button here: the output is something to read, not text to write back.

**Bar width** — `.k-ask-bar` must be `width: max-content`. A `position: fixed` element with only `left` set is shrink-to-fit against the space between `left` and the containing block's right edge, and `translateX(-50%)` does **not** participate in that calculation — so without it, selecting text on the right half squeezes the bar and the buttons wrap for no reason. The edge clamp measures the real width after render (`nextTick`, which runs before paint, so the correction never shows as a jump) rather than hard-coding half of it: labels change with locale, and an underestimate lets the bar hang ~25px past the right edge at tablet widths. Any `@media` override of `.k-ask-btn` needs the `.k-ask-bar` prefix — the base rule sits later in the file and wins at equal specificity (media queries add none).

**Read-aloud** — `useSpeechSynthesis` + `ReadAloudBar`. Speaks **block by block**, not the whole body at once: long utterances silently stop mid-way in Chrome, and only per-block playback knows which block is current (that's what drives `.k-tts-active`).

Block collection walks **text nodes** (`TreeWalker` + `NodeFilter.SHOW_TEXT`) and groups each one under its nearest block ancestor. Do **not** go back to `querySelectorAll('p, li, …')` + "keep the innermost": that whitelist looked fine on ordinary articles but silently dropped `<pre><code>` blocks, table cells and bare `<div>` text — on one real article it collected **0 of 969 characters**. Any structure the editor produces (or a paste from ChatGPT, which wraps code in nested divs) has to stay readable. Walking text nodes also fixes `li > ul > li`, where the outer `li`'s own text belongs to the outer block and the inner one to the inner block; both survive.

The block list has to include `div` / `section` / `summary` / `figure`, not just semantic tags. AI-generated HTML and pasted content routinely put a whole paragraph of text straight into a `div`, and `<details><summary>` headings live in `summary`. Omitting them does not lose text — it *falls back to the article root*, and then `.k-tts-active` paints the **entire article** and `scrollIntoView` jumps to the top of the page. Text that sits directly in the root has no block to point at, so those segments carry `el: null` and simply skip highlight and follow-scroll rather than highlighting everything.

**Segments go stale when the article DOM is replaced.** Switching theme recomputes `renderedHtml` (Shiki recolours code blocks), `v-html` rebuilds the whole subtree, and every stored element detaches — playback keeps going but the highlight and follow-scroll silently stop, which reads as "highlights disappeared". `speakAt` checks `isConnected` and calls `rebind()`, which re-collects and re-maps by index **only when the block count is unchanged**; if the count differs the content really changed, and a wrong highlight is worse than none.

Each block is then split at sentence boundaries into ≤`MAX_CHUNK` (100) character utterances — one long utterance is precisely what triggers the Chrome cutoff — with a second safety net (`KEEP_ALIVE_MS`, pause+resume every 12s) poking the engine if a chunk still runs long. Chunking is an engine-level detail: `index` / `total` stay at **block** granularity, so the UI never reads "sentence 37 of 120".

**`cancel()` and `speak()` must not share a tick.** Cancelling fires `onend`/`onerror` on the removed utterance *asynchronously*, and a new utterance queued in the same task can end up never receiving its `onend`. `onend` is the only thing that advances the chain, so playback dies right there — reported as "改完倍速，当前这段念完就没声了". Every cancel-then-speak path (`start` / `jump` / `setRate`) therefore goes through `restartAt()`, which cancels and then speaks `CANCEL_SETTLE_MS` (60ms) later. Imperceptible, and it gives the cancelled utterance's events time to land.

**The watchdog is what makes the chain survive a lost `onend`.** A 1s poll checks "we think we're playing, but the engine is neither speaking nor pending" — that can only mean the event was dropped, so it advances from `activePiece + 1` (bumping `run` first, which neutralises a late `onend`). It stands down while paused or while `restartTimer` is pending, since both make the engine look idle. `stalls` counts consecutive rescues and resets on any natural `onend`; past `MAX_STALLS` (2) it calls `stop()` — a broken engine should end the session, not race through the article skipping sentences.

Both failure modes were reproduced before the fix, in a Node harness that loads this exact file (type-stripping, `import.meta.client` replaced) against a fake engine with a controllable clock: with the watchdog disabled, the run ends at `index=0, speaking=true` — stuck mid-article with the bar still showing. Re-enable it and the same scenario reads to the end.

`setRate` re-speaks from the **current sentence**, never the current block: a 1000-character block is a dozen sentences, so restarting the block is a half-minute rewind. It also returns early on an unchanged value (one stray click would otherwise rewind) and does nothing while paused — the new rate applies from the next sentence after resume. `resetEngine()` exists because `cancel()` clears the queue but **not** the paused flag: cancel-then-speak on a paused engine produces silence, which reads as "changing the speed broke the sound". Resuming mid-block is also why `speakAt` only scrolls when `from === 0` — otherwise every speed change yanks the page back to the current block.

Every start / stop / jump bumps a `run` token: `cancel()` fires `onend` and `onerror('interrupted')` on the previous utterance, and without the token one cancel walks the queue forward. `.k-tts-active` lives in `main.css`, not the component, because it targets article DOM that the component doesn't own.

Known behaviour, not bugs: the voice language follows the **UI** language (`lang: () => current === 'zh' ? 'zh-CN' : 'en-US'`), not the article's language — an English-UI reader on a Chinese article gets an English voice. Jumping to another block while paused resumes playback (jump is treated as "play this one"). Reaching the end calls `stop()`, so the bar disappears with no "finished" state.

### PWA (installable + offline reading)

`@vite-pwa/nuxt` (Workbox `generateSW`). Installable from the browser's own install entry — `client.installPrompt` is `false` on purpose, no custom install button.

**Updates are `registerType: 'prompt'`, and that choice has a hard requirement**: a new SW installs, precaches, then sits in `waiting` — it does not take over. Without UI calling `updateServiceWorker(true)`, every visitor stays on the old build forever. `PwaUpdatePrompt.vue` (mounted in `layouts/default.vue`) is that UI. `autoUpdate` was rejected because it reloads the page out from under whoever is writing a draft in the editor. "稍后" only clears the flag for this page load; the waiting SW is still there and re-prompts next visit.

**No `navigateFallback`.** The site is SSR (Nitro runs), so there is no prerendered `index.html` in the precache for Workbox to fall back to. Offline navigation instead comes from the `pages` runtime cache (NetworkFirst, 3s timeout) — i.e. pages you have already visited open offline; anything else shows the browser's offline page.

**Fonts must stay out of the precache.** `@chinese-fonts/maple-mono-cn` ships ~3710 woff2 shards (~148 MB). `globIgnores` blocks `woff2/woff/ttf/eot`, and the `fonts` runtime rule caches shards on demand. Dropping that ignore turns first install into a 148 MB download. Current precache is ~410 entries / no fonts — re-check after adding assets.

**`urlPattern` regexes are matched against `url.href`, not the pathname.** `RegExpRoute` allows a partial match only for *same-origin* requests, and `href` starts with the origin, so `/^\/…/ ` never matches `https://kotae.cn/article/5` — the route silently never fires and pages are never cached. Every path pattern here carries the origin (`^https?:\/\/[^/]+\/…`, origin wildcarded so preview / alternate-domain builds still work).

**Route order matters**: Workbox takes the first match. `cos-images` and `fonts` are registered before `pages`, because the pages rule is deliberately loose (any origin, any extensionless path) and would otherwise swallow COS images.

The pages rule excludes `_nuxt/` and `api/` by prefix, and every other static file by "no dot-extension in the last segment" (`{2,11}` covers `.webmanifest`, `.avif`). Enumerating `.js|.css|.png|…` was the first attempt and it always trails the real asset list.

**`$pwa` is client-only and optional**, so `PwaUpdatePrompt` grabs it in `onMounted` and bridges into a local ref. Reading it in a `computed` at setup caches the `undefined` from SSR forever, and `v-if="$pwa?.needRefresh"` renders `false` on the server but `true` on the client — a hydration mismatch.

Icons: `pwa-192/512` and `apple-touch-icon` were generated from `public/favicon.ico` (which is actually a 628×629 RGBA PNG, not an ICO). `pwa-maskable-512x512` is the same art at 78% on a brand-red field — Android crops maskable icons to a circle/teardrop and anything outside the middle ~80% gets cut. iOS ignores `manifest.icons` entirely, hence the separate `apple-touch-icon` link plus the `apple-mobile-web-app-*` metas in `app.head`.

Service worker is **off in `nuxt dev`** (default). Verify PWA behaviour against `npm run build && node .output/server/index.mjs`, not the dev server.

### Ink Trail (decorative cursor effect)

`useInkTrail` + `InkTrail.vue`, mounted in `layouts/default.vue`: dragging the mouse leaves a fading ink trail that dries out ~900ms after you stop. Purely decorative — no state, no storage, no interaction.

**Mouse only.** `pointermove` fires for touch too, and a finger swipe down the page would smear ink across the whole viewport mid-scroll. `pointerType !== 'mouse'` is dropped. Touch and pen get nothing, deliberately.

**No particle system.** The trail is the last ≤48 sampled points (`MIN_DIST` 3px apart), drawn as short pieces whose alpha and width decay with age — `(1 - age) ** 1.2` rather than linear, so it lingers then dries quickly instead of fading uniformly. That's the whole "ink" effect; storing particles would add per-frame iteration and sorting for nothing.

**Pieces are cut at segment midpoints and drawn with `lineCap: 'butt'` — this is the fix for the "dots" (串珠).** Two separate `stroke()` calls that overlap geometrically composite alpha twice: measured in Chrome, `globalAlpha = 0.5` drawn twice gives **0.75**, not 0.5. Drawing each segment with round caps from vertex to vertex means every sample point is covered by two caps, so every point becomes a slightly darker disc — on a real page it reads as a string of beads. Pulling the caps back until they merely touch fixes the beads but leaves a pinch (tangent circles have zero width at the touch point), so the trail turns into a string of sausages. The only cut that is neither overlapping nor gapped is at the **midpoint of a segment**: both sides there have the same direction and flat faces, so butt cap meets butt cap exactly. Each piece is centred on a vertex and runs midpoint → vertex → midpoint, and consecutive pieces tile the polyline with zero overlap and zero gap. `lineCap` must stay `butt`; a single `round` anywhere re-creates the bead.

**One `stroke()` may self-overlap freely** — verified: a path that doubles back on itself measures 0.498 alpha, identical to a straight one. Canvas builds the stroke outline and fills it once, so self-intersection does not accumulate. The doubling only happens *between* calls.

The tip is finished with a **forward half-disc** (`arc` swept over π, filled), not a full circle: a full circle would sit on top of the last piece's flat end and composite it a second time, putting the darkest bead exactly at the cursor. The half-disc shares only the diameter line with the piece, so the two join into a capsule with no overlap.

**Two passes over the same points, not two strokes per piece.** Halo first (2.2× width, 0.28× alpha), then the main line. Drawing both inside one loop lets the *next* piece's halo paint over the *previous* piece's main line, and the trail reads as a string of bright heads and dull tails.

**The rAF loop stops when the ink is dry.** `frame()` clears the canvas, returns without rescheduling once `points` is empty, and `pointermove` kicks it again. The effect is off most of the time — a resident 60fps loop would burn battery for an idle screen.

**Colour is read from `current.value.colors.primary` every frame** instead of watching the theme, so a theme switch mid-stroke recolours immediately with no listener to maintain.

**`prefers-reduced-motion: reduce` opts out entirely** — checked once in `onMounted`, no listeners attached. Of everything on the site, a mouse-following decoration is the first thing that should yield.

`devicePixelRatio` is capped at 2: a 3× screen makes the backing store 4× larger for a few faint pixels. Canvas is `position: fixed; inset: 0; pointer-events: none; z-index: 5` — above the article (which sets no `z-index`), below the drawer / app bar / dialogs, so ink never smears over chrome.

Editor routes (`/article/create`, `/article/edit/:id`) disable it via the `enabled` option; `watch(options.enabled)` clears the canvas on the way out so stray drops don't hang there.

The numbers (alpha `0.5`, fade exponent `1.2`, width `0.9 + 3.2 * (1 - age)`, halo `2.2×` / `0.28×`) were tuned against offline Pillow snapshots of the same maths, not by eye in the browser — and the first round of that tuning was wrong for an instructive reason. The snapshot harness composited every frame onto the previous one instead of starting from the background each frame, so 72 frames of 0.2 alpha piled up into a solid band; the trail looked like a flat marker stroke and the alpha got pushed *down*. Rendering one frame honestly (clear, then draw) showed the opposite problem: at `0.24` with exponent `1.7`, only the last ~100ms was visible and the tail vanished the instant you stopped moving. **Any preview of this effect has to mirror `clearRect`** — a canvas effect is per-frame, not accumulative. Pillow is also the wrong tool to judge seams: `ImageDraw.line` has no round caps, so it renders the opposite artifact (notches instead of beads). Seam behaviour has to be measured in a real canvas.

`FADE_EXP` is what sets the "drying" feel: at `1.7` the tail is essentially gone within 300ms, at `1.2` the front two-thirds still carries a visible gradient a third of a second after the mouse stops.

Measured on a real page (Playwright, mouse moved across the viewport, alpha profile sampled along the stroke): before the fix, **108 of 372 columns carried a local bump above 0.05 and the peak alpha was 0.763** (the 0.75 bead, exactly as predicted); after, **0 of 348 and peak 0.544** — i.e. nothing exceeds single coverage any more.

### Theming

Three Vuetify themes: `light` → `dark` → `terminal`, cycled by `useThemeCycle`. Decorative styles in `main.css` (highlighter, stickers, blobs) are derived from `primary` / `secondary` / `--k-ink`, so a **colour-only** theme is just a `themes` entry in `nuxt.config.ts` plus an entry in `THEME_ORDER` and a label. `terminal` still needs CSS because it carries decoration the tokens can't express (scanlines, sweep band, block cursor); the other two are pure colour.

The active theme is persisted in the `theme` cookie by `app/plugins/theme.ts` (restored during SSR so refresh keeps the theme without a flash). That plugin must run after the Vuetify plugin — it declares `dependsOn: ['vuetify:nuxt:client:plugin', 'vuetify:nuxt:server:plugin']`; the `order` option alone does not control execution order. A cookie naming a theme that no longer exists falls back to the default and is **cleared on the client only** — clearing it during SSR would emit a pointless `Set-Cookie` on every request.

**Adding a theme touches more than the theme table.** Four places branch on the theme name, and each fails silently (wrong editor skin, wrong code colours) rather than throwing:

| Where | What it decides |
|---|---|
| `ArticleForm.vue` | TinyMCE skin — `['dark','terminal']` are dark |
| `useArticleHtml.ts` `SHIKI_THEMES` | Shiki palette per theme; **missing key falls back to light**, so a dark theme gets github-light code blocks |
| `pages/tags/index.vue` | Tag-cloud outline colour on dark themes |
| `CommandPalette.vue` | Search keywords for the "toggle theme" command |

`terminal` (phosphor green on near-black) is the reference implementation of a decorated theme:

- **`--k-ink` is the phosphor green itself**, not a white. The sticker system draws every card outline and hard offset shadow from it, so the whole page turns into glowing green frames without touching a single card rule. `--k-ink-soft` stays near-white because it is used as *text* colour (`--k-ink` is outline/shadow only) and pure green body copy is unreadable at length.
- **`--k-highlight-soft` is overridden darker.** The default is `primary` mixed 55% with white, so on a green theme the highlighter stroke and the green headline came out the same colour and the bottom third of every letter sank into the bar. Mixing toward a near-black green keeps the bright glyph on a dim stroke.
- **Scanlines are static, the sweep band is a single `transform`.** A full-viewport `background-position` animation is the expensive kind — only worth it when the effect *is* the movement. Scanline alpha was tuned down from 0.055 to 0.035 at 25% duty after measuring on an article page — at 0.055 the banding is visible enough to fatigue reading.
- **The block cursor is a real element (`.k-caret` in `AppBar.vue`), not a `::after`.** The title's slot sits inside `.v-toolbar-title__placeholder`, which is `display: block`, so an `::after` on `.k-gradient-text` lands on the next line. And `.k-gradient-text` appears three times on the home page (app bar, hero headline, footer) — a pseudo-element would have put three blinking cursors on one screen. `.k-caret` is `display: none` everywhere except `terminal`.
- **`prefers-reduced-motion` needs a carve-out for the cursor.** The global reduce block forces `animation-duration: 0.01ms` and one iteration, which freezes an animation at its **final** keyframe — for a blink whose final keyframe is `opacity: 0`, that erases the cursor entirely. It gets an explicit `opacity: 1` override.

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
- **RSS** lives at `server/routes/rss.xml.ts` (`/rss.xml`). It reads the public article list straight from `apiBase`, so it needs no backend change; site name / description are constants at the top of that file. Two non-obvious bits: the feed carries the **full body** in `content:encoded` (relative `src`/`href` are rewritten to absolute, otherwise readers 404 on images and internal links), and an upstream failure returns an **empty but valid** channel rather than 5xx — readers back off or unsubscribe on repeated 5xx. `?limit=N` (1–50, default 20) is there for debugging. Discovery comes from the `rel="alternate"` link in `nuxt.config.ts` `app.head.link` plus the footer button, so adding a feed doesn't require touching any page. `description` must stay **HTML** (not plain text): most readers render only that field, and stripping tags flattens every paragraph and list — which reads as "no formatting". It is XML-**escaped** (`&lt;p&gt;`) rather than CDATA-wrapped, which is what most feeds do and what old parsers handle best; `content:encoded` keeps CDATA because escaping the full body would nearly double the feed size. **Do not add `xml-stylesheet`/XSLT or Accept-based content negotiation** — Chrome is removing XSLT (red warning banner on every visit until it's gone), and a second representation of the same URL risks a CDN serving HTML to readers, which breaks their parsing. A plain XML tree in the browser is the intended result — but it only happens with **`Content-Type: application/xml`**. Chrome enables its built-in XML viewer (syntax highlighting, collapsible nodes, the "no style information" banner) for `application/xml` and `text/xml` only; `application/rss+xml` is rendered as flat monochrome text. Do not "correct" the header to `application/rss+xml` — it looks more semantically right but breaks the browser view. Trade-off: Firefox's Feed Preview keys off `application/rss+xml`, so it won't show its subscribe page anymore (it still parses the feed fine). Thumbnails come from the **first `<img>` in the body**, emitted as both `<enclosure>` (RSS 2.0) and `<media:thumbnail>` (what Feedly/Inoreader actually read) — readers do not dig images out of `content:encoded`, so without these fields list views and share cards stay blank. The same first image also feeds `og:image` / `twitter:image` on the article page (`app/pages/article/[id].vue`), which covers readers that scrape the page instead of the feed.
- `x-robots-tag: noindex, nofollow` on every route during `nuxt dev` is **expected** — `@nuxtjs/robots` blocks indexing in development. Append `?mockProductionEnv` to any URL to see the production rule (`index, follow, max-image-preview:large, …`). Don't "fix" it in config
- **New-article broadcast** lives in `scripts/broadcast.mjs` (zero deps, Node built-ins only; run via `npm run broadcast`). It polls the RSS feed and uses `<guid>` as the idempotency key, recording **per platform** so a failed channel is retried alone next run. Two behaviours worth remembering: (1) items older than `BROADCAST_MAX_AGE_HOURS` (default 72) are recorded but **not** sent, which is what keeps the first run from dumping the whole archive — use `--all` to force it; (2) `--dry-run` prints the exact payload per platform and writes no state, so always eyeball it before wiring up cron. X posting is raw OAuth 1.0a over `POST /2/tweets` (JSON body is *not* signed, only `oauth_*` params are), and the 280 limit is computed with X's weighted rules — CJK counts 2, every URL counts 23, and `…` (U+2026) also counts 2, so truncation loops on the *final* string rather than reserving a fixed budget. **Weibo is deliberately unsupported**: `statuses/update` has been restricted since 2017 and the only open endpoint (`statuses/share`) posts a bare link with a 30-day token
- Site deployed at `https://kotae.cn`
- `vue3-emoji-picker` calls `initialize()` at module scope and opens IndexedDB; on the server this logs `ReferenceError: indexedDB is not defined` as an unhandled rejection. It is harmless but noisy — render the picker client-side if it needs cleaning up
