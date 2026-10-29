# Kotae - 内容分享平台

> 记录 · 创作 · 分享，寻找你的答案

Kotae 是一个基于 Nuxt 4 构建的内容分享平台（博客/笔记系统），支持文章发布、评论、点赞、用户管理、通知、相册、心愿单、归档与标签云。项目使用 TypeScript 开发，集成 Vuetify 3 作为 UI 组件库，支持中英双语与 3 套主题。

**线上地址**: https://kotae.cn

---

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | Nuxt (基于 Vue 3 + Nitro) | ^4.1.2 |
| 视图层 | Vue | ^3.5.21 |
| 路由 | Vue Router | ^4.5.1 |
| UI 组件库 | Vuetify (via vuetify-nuxt-module) | ^0.18.7 |
| CSS 框架 | Tailwind CSS (via @nuxtjs/tailwindcss) | ^6.14.0 |
| 图标 | Material Design Icons (@mdi/font) | ^7.4.47 |
| 国际化 | @nuxtjs/i18n | ^10.1.0 |
| 富文本编辑器 | TinyMCE (@tinymce/tinymce-vue) | ^6.3.0 |
| 代码高亮 | Shiki | ^3.13.0 |
| 日期处理 | Day.js | ^1.11.18 |
| 动画 | Anime.js | ^4.2.2 |
| XSS 防护 | isomorphic-dompurify（SSR 端由 jsdom 承载） | ^4.6.0 |
| HTML 转文本 | html-to-text | ^9.0.5 |
| Toast 通知 | vue-sonner | ^2.0.9 |
| 表情选择器 | vue3-emoji-picker | ^1.1.8 |
| 对象存储 | cos-js-sdk-v5 (腾讯云 COS) | ^1.10.1 |
| 交互音效 | cuelume (Web Audio 实时合成) | ^0.1.2 |
| 字体 | Maple Mono CN (@chinese-fonts/maple-mono-cn) | ^2.0.0 |
| SEO | @nuxtjs/sitemap + @nuxtjs/robots | ^7.4.7 / ^5.5.6 |
| 语言 | TypeScript | ^6.0.3 |
| 类型检查 | vue-tsc（Volar） | ^3.3.13 |
| 代码检查 | ESLint + Prettier | ^8.57.1 / ^3.6.2 |
| AI 能力 | 阿里云百炼 Qwen（OpenAI 兼容模式） | - |
| 语音输入 | Web Speech API | - |

---

## 快速开始

### 环境要求

- Node.js `^22.19.0 || ^24.11.0 || >=26.0.0`（Nuxt 4.5 的要求）
- npm / pnpm / yarn / bun（任选其一）

### 安装与运行

```bash
# 安装依赖
npm install

# 启动开发服务器 (http://localhost:3000)
npm run dev

# 构建生产包
npm run build

# 本地预览生产构建
npm run preview

# 静态站点生成
npm run generate
```

### 代码质量

```bash
npm run lint       # ESLint 检查
npm run lint:fix   # ESLint 自动修复
npm run typecheck  # vue-tsc 类型检查（nuxt prepare + vue-tsc --noEmit）
npm run format     # Prettier 格式化
```

---

## 项目结构

```
kotae_nuxt/
├── app/
│   ├── assets/
│   │   ├── css/main.css          # 全局样式与主题派生设计系统
│   │   └── favicon.ico
│   ├── components/               # Vue 组件（自动导入）
│   │   ├── AiAssistDialog.vue    # AI 写作面板（流式输出 / 结果回填）
│   │   ├── AiMenuButton.vue      # AI 功能菜单按钮（图标态 / 带文案态）
│   │   ├── AiModelSelect.vue     # AI 模型选择（搜索 + 过滤）
│   │   ├── AiPromptDialog.vue    # 自定义提示词（覆盖内置 / 新增动作）
│   │   ├── AppBar.vue            # 顶部导航栏（主题 / 语言 / 音效开关）
│   │   ├── AppFooter.vue         # 页脚
│   │   ├── ArticleComment.vue    # 文章评论区
│   │   ├── ArticleForm.vue       # 文章编辑表单（TinyMCE + 图片直传）
│   │   ├── CommandPalette.vue    # 命令面板（Ctrl / ⌘ + K）
│   │   ├── ConfirmDialog.vue     # 通用确认对话框
│   │   ├── DelayFade.vue         # 延迟淡入动画组件
│   │   ├── EmptyState.vue        # 空状态占位
│   │   ├── FetchLoading.vue      # 全局加载指示器
│   │   ├── ImageLightbox.vue     # 图片灯箱
│   │   ├── InkTrail.vue          # 光标墨迹（全屏画布彩蛋）
│   │   ├── LoginDialog.vue       # 登录对话框
│   │   ├── NoticeList.vue        # 通知列表
│   │   ├── NoticePanel.vue       # 通知面板
│   │   ├── ReadAloudBar.vue      # 正文朗读（按钮 + 播放控制浮条）
│   │   ├── RegisterDialog.vue    # 注册对话框
│   │   ├── ResetDialog.vue       # 重置密码对话框
│   │   ├── SearchDialog.vue      # 搜索对话框
│   │   ├── SelectionAskBar.vue   # 划词浮条（解释 / 翻译 / 展开 / 反问我）
│   │   ├── SpeechInput.vue       # 语音输入（含实时转写浮条）
│   │   ├── SpeechLiveBar.vue     # 实时转写浮条（Teleport 到 body）
│   │   └── VToast.vue            # 贴纸风 Toast 外观
│   ├── composables/              # 组合式函数（自动导入）
│   │   ├── api/                  # API 接口模块
│   │   │   ├── base.ts           # 基础类型（分页参数/响应）
│   │   │   ├── useArticle.ts     # 文章 CRUD
│   │   │   ├── useAuth.ts        # 认证（登录/注册/刷新/验证码/COS 密钥）
│   │   │   ├── useComment.ts     # 评论
│   │   │   ├── useLike.ts        # 点赞
│   │   │   ├── useNotice.ts      # 通知
│   │   │   ├── usePhoto.ts       # 相册
│   │   │   ├── useSearch.ts      # 搜索
│   │   │   ├── useTag.ts         # 标签
│   │   │   ├── useUser.ts        # 用户资料
│   │   │   └── useWish.ts        # 心愿单
│   │   ├── useAI.ts              # AI 对话（非流式 ask / 流式 askStream）
│   │   ├── useAiHtml.ts          # AI 富文本净化（白名单 → TinyMCE）
│   │   ├── useAiModels.ts        # 模型列表与用量查询
│   │   ├── useAiPrompts.ts       # 自定义提示词（覆盖内置 / 新增动作，localStorage）
│   │   ├── useArticleHtml.ts     # 正文渲染：Shiki 高亮 + DOMPurify 净化
│   │   ├── useConfetti.ts        # 撒花粒子动画
│   │   ├── useCosUpload.ts       # 腾讯云 COS 直传（统一上传入口）
│   │   ├── useDayjs.ts           # 日期处理（响应式国际化）
│   │   ├── useDebounce.ts        # 防抖
│   │   ├── useExtractText.ts     # HTML 转纯文本（SSR 安全）
│   │   ├── useHttp.ts            # HTTP 客户端封装
│   │   ├── useInkTrail.ts        # 光标墨迹（采样 / 绘制 / 收摊）
│   │   ├── useReadingTime.ts     # 字数统计与预计阅读时间
│   │   ├── useRules.ts           # 表单验证规则
│   │   ├── useShiki.ts           # 代码高亮器单例
│   │   ├── useSound.ts           # 交互音效（cuelume 封装 + 开关持久化）
│   │   ├── useSpeechRecognition.ts # Web Speech API 语音转文字
│   │   ├── useSpeechSynthesis.ts # 正文朗读（分段播放 + 当前段高亮）
│   │   ├── useTextSelection.ts   # 正文划词探测与浮条定位
│   │   ├── useThemeCycle.ts      # 3 套主题轮换
│   │   └── useToast.ts           # Toast 通知（集成音效反馈）
│   ├── layouts/
│   │   └── default.vue           # 默认布局（左右导航抽屉 + AppBar + 页脚）
│   ├── middleware/
│   │   └── auth.ts               # 路由鉴权中间件
│   ├── pages/                    # 基于文件的路由
│   │   ├── index.vue             # 首页（头条 + 最新 + 热门榜）
│   │   ├── article/
│   │   │   ├── [id].vue          # 文章详情（目录 / 代码复制 / 灯箱 / 点赞）
│   │   │   ├── create/index.vue  # 创建文章
│   │   │   ├── edit/[id].vue     # 编辑文章
│   │   │   └── like/index.vue    # 点赞列表
│   │   ├── archive/index.vue     # 归档（按月折叠）
│   │   ├── message/index.vue     # 消息/通知页
│   │   ├── search/index.vue      # 搜索结果页
│   │   ├── tags/index.vue        # 标签云
│   │   ├── wishlist/index.vue    # 心愿单
│   │   └── user/
│   │       ├── [id].vue          # 用户主页
│   │       ├── [username]/
│   │       │   ├── photo.vue     # 用户相册
│   │       │   └── profile.vue   # 用户资料编辑
│   │       └── editPwd/index.vue # 修改密码
│   ├── plugins/
│   │   ├── cuelume.client.ts     # 音效全局委托（bind + 事件代理）
│   │   ├── i18n-router.client.ts # 路由国际化前缀注入
│   │   ├── permissions.ts        # v-permission 权限指令
│   │   └── theme.ts              # 主题 cookie 读写（SSR 直出对应主题）
│   └── error.vue                 # 全局错误页
├── server/                       # Nitro 服务端
│   ├── api/                      # 已无 AI 接口：AI 全部在 Django 侧（backend/ai/）
│   └── utils/
├── shared/                       # 前后端共用类型（#shared 别名）
│   └── types/ai.ts               # AiMessage / AiChatOptions / AiUsage / AiCredentialInfo ...
├── i18n/
│   ├── i18n.config.ts            # i18n 配置
│   └── locales/
│       ├── en/                   # 英文翻译（en.json + $vuetify 合并）
│       └── zh/                   # 中文翻译
├── public/                       # 静态资源
├── nuxt.config.ts                # Nuxt 配置
├── tailwind.config.ts            # Tailwind CSS 配置
├── tsconfig.json                 # TypeScript 配置
└── package.json
```

---

## 核心架构

### HTTP 客户端 (`useHttp`)

所有 API 请求通过 `useHttp` 组合式函数统一管理：

- **自动注入 JWT Token**：从 Cookie 读取 `token`，附加到 `Authorization` 头
- **401 自动刷新**：检测到 401 时自动调用 refresh 接口续期；并发请求共享同一次刷新（`pendingRefresh` 单飞），避免除首个外的请求直接失败
- **并发安全 Loading**：通过 `loadingCount` 引用计数管理全局加载状态
- **统一错误处理**：通过 Toast 展示错误信息
- **超时控制**：默认 10 秒超时

```typescript
const { get, post, put, del } = useHttp()
const data = await get<Article>('/article/1/')
```

### 正文渲染管线 (`useArticleHtml`)

文章正文走「Shiki 高亮 → DOMPurify 净化」的派生管线，**不要在页面里直接 `v-html` 后端内容**：

```typescript
const { html: renderedHtml } = useArticleHtml({
    html: () => article.value?.content,
    themeName: () => name.value, // 当前 Vuetify 主题
    highlighter,
})
```

两条不可回退的约束：

1. 必须在 `computed` 中派生，不能在 `onMounted` 里改写 `article.content`。否则 SSR 首屏输出的是后端原始 HTML（存储型 XSS 面），且原地改写会污染 `useAsyncData` 缓存，导致切换主题后代码块配色不再更新。
2. 服务端没有 DOM，`isomorphic-dompurify` 在 node 条件下用 jsdom 承载净化，浏览器条件下解析到 browser 构建（仍是原生 DOMPurify），jsdom 不会进入客户端包。

### 图片上传 (`useCosUpload`)

前端取临时密钥后直传腾讯云 COS，文章配图、头像、相册共用同一个入口：

```typescript
const { upload } = useCosUpload()
const url = await upload(file, { dir: 'blog/article' })
```

桶名与地域由 `runtimeConfig.public.cosBucket / cosRegion` 注入，不再硬编码在页面里。

### 认证流程

```
用户登录 → 存储 token/refresh/user 到 Cookie
         → useState('isLogin') 标记登录态
         → useHttp 自动携带 Bearer Token
         → 401 时自动 refresh
         → refresh 失败 → 清除 Cookie → 跳转首页
```

### API 组合式函数模式

每个 API 模块导出一个 composable，返回类型化的请求方法：

```typescript
export const useArticle = () => {
    const { get, post, put, del } = useHttp()
    return {
        getArticle: (id) => get<Article>(`/article/${id}/`),
        getArticleList: (options) => get<ArticleListResponse>('/article/', options),
        createArticle: (params) => post<Article>('/article/create/', params),
        updateArticle: (id, params) => put<Article>(`/article/${id}/`, params),
        delArticle: (id) => del(`/article/${id}/`),
    }
}
```

### 路由中间件

- `auth.ts`：检查登录状态，未登录重定向到首页
- 使用方式：`definePageMeta({ middleware: 'auth' })`

### 权限指令 (`v-permission`)

自定义指令，拦截未登录用户的点击操作并弹出登录框：

```html
<v-btn v-permission @click="createArticle">写文章</v-btn>
```

### 交互音效系统 (`cuelume`)

基于 Web Audio API 实时合成的交互音效，零音频文件、零网络请求。采用分层架构：

| 层级 | 机制 | 覆盖范围 |
|------|------|----------|
| 全局触感层 | `cuelume.client.ts` 事件委托 | 所有可交互元素自动 press/release |
| 声明式层 | `data-cuelume-*` 属性 + `bind()` | 需要自定义音效的特定元素 |
| 命令式层 | `useSound()` composable | 语义音效（success/error/toggle/tick/sparkle/whisper） |
| 通知层 | `useToast` 内嵌 | 操作结果反馈（success/error 自动触发） |

**音效语义映射：**

| 音效 | 场景 | 音色 |
|------|------|------|
| `press` / `release` | 所有按钮/链接/列表项/标签等 | 物理按压/回弹触感 |
| `toggle` | 主题切换、音效开关 | 机械开关 click-clack |
| `tick` | 语言切换 | 清脆瞬间选择感 |
| `sparkle` | 点赞 | 明亮上升四音闪烁 |
| `whisper` | 对话框打开 | 最轻柔的气息膨胀 |
| `success` | 操作成功通知 | 温暖三音上升确认 |
| `error` | 操作失败通知 | 沉闷下降两音 |

**避免重复播放约定：**

- 已声明任意 `data-cuelume-*` 属性的元素会被全局委托跳过
- `data-cuelume-manual`：命令式自管理音效的 opt-out 标记（如点赞按钮仅播放 sparkle）
- 所有播放统一受 `setEnabled()` 控制（AppBar 音效开关，localStorage 持久化）

### 国际化 (i18n)

- 默认语言：English，回退语言：中文
- 翻译文件：`i18n/locales/{lang}/`，`index.ts` 把 `$vuetify` 词条合并进同一份 messages
- 组件内统一用 **Vuetify 的 `useLocale()`** 取 `t()` 与 `current`（vuetify-nuxt-module 会把 i18n messages 同步给 Vuetify）；`useI18n()` 仅在 `error.vue` 这类 Nuxt 上下文里使用
- 路由导航自动添加语言前缀（通过 `i18n-router.client.ts` 插件包裹 `router.push`）

---

## AI 辅助写作

写作页与评论区的 AI 能力走 **Django 后端 → 阿里云百炼（DashScope）**。密钥由**每个用户自己提供**，后端加密存库，前端只拿到掩码。

```
浏览器 useAI()  →  {apiBase}ai/*（Django，需 JWT）  →  dashscope.aliyuncs.com/compatible-mode/v1
```

> 这一层原本在 Nitro（`server/api/ai/*`），已整体迁到 Django。现在前端不再持有任何上游密钥，
> 也不再有 `NUXT_AI_API_KEY` 这类服务端配置。相关代码：`backend/ai/`。

### 使用前提

1. **已登录** —— AI 接口全部要求 `IsAuthenticated`，未登录返回 401；
2. **已配置自己的 Key** —— 在 AI 面板右上角的钥匙按钮里填写，或首次打开面板时按提示配置。

两者缺一时，`AiAssistDialog` 会直接给出提示/配置入口，不会白发一次请求。

### 能力

| 场景 | 入口 |
|------|------|
| 文章正文写作 / 润色 / 扩写 / 摘要 | `ArticleForm` 的 TinyMCE 工具栏 `kAiWriter` 菜单按钮 |
| 评论、回复生成 | `ArticleComment` 输入框旁的 `AiMenuButton` |
| 语音输入 | `SpeechInput`（按钮）与 `SpeechLiveBar`（实时转写浮条） |

### 接口与约束（`backend/ai/`）

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/ai/credential/` | GET / PUT / DELETE | 查询（只回掩码）/ 保存 / 清除自己的 Key |
| `/api/ai/chat/` | POST | 非流式对话，返回 `{ content, model, usage, finishReason }` |
| `/api/ai/chat-stream/` | POST | 流式对话，SSE 输出 `{ type: 'delta' \| 'done' \| 'error' }` |
| `/api/ai/models/` | GET | 可选模型（探测上游 `/models`，失败回落内置清单，按用户缓存 10 分钟） |
| `/api/ai/quota/` | GET | 当前用户自己的 token 用量（按天按模型记账） |

- **限流**：按登录用户计数（DRF throttle，默认 20 次 / 分钟），超限 429
- **消息归一化**：role 白名单（`system` / `user` / `assistant`）、单条截断 24000 字符、最多保留最近 40 条
- **错误码**：`400 ai_key_missing` 未配置 Key / `400 ai_key_invalid` Key 无效 / `401` 未登录 /
  `402 ai_quota_exhausted` 免费额度用尽 / `429` 限流 / `502` 上游错误
- **流式实现**：Django 4.0 的 `StreamingHttpResponse` 在 ASGI 下会同步迭代、阻塞事件循环，
  所以流式接口走 `backend/ai/asgi.py` 的原生 ASGI 通道（读上游放线程 + 队列回传），
  其余接口仍是普通 DRF 视图。

### 自定义提示词

AI 面板右上角的编辑图标可以打开提示词配置（`AiPromptDialog`），按场景（文章 / 评论）分开保存，互不影响：

- **覆盖内置动作** —— 换掉「润色」「扩写」等的提示词，菜单项不变；
- **新增自定义动作** —— 自己起名字、选图标、写提示词，追加在菜单末尾。

模板占位符有四个，每个只对应一种东西，不随动作变化：

| 占位符 | 含义 |
| --- | --- |
| `{{text}}` | 你正在处理的文字：选中的内容或输入框里的草稿。生成类动作（帮我写一条 / 帮我回一条）没有草稿，这里就是空 |
| `{{title}}` | 文章标题 |
| `{{reply}}` | 回复场景里对方说了什么 |
| `{{article}}` | 文章正文摘要（约 1200 字），任何动作都能用 |

所以「帮我写一条」用的是 `{{article}}` 而不是 `{{text}}` —— 它要读文章，不是读草稿。配置面板也**只列出当前动作真有值的占位符**：编辑「帮我写一条」时看不到 `{{text}}` 和 `{{reply}}`，因为它们在这个动作里永远是空的，摆出来只会被误插进模板。万一手写了这类占位符，下方会出现一行提示，告诉你它会被替换成空字符串。

漏写 `{{text}}` 且确实有草稿时，草稿会自动接在末尾，避免「模型没拿到素材还白跑一次」；草稿为空则什么都不追加。选了富文本格式会自动补上 HTML 约束。

配置存在 `localStorage` 的 `ai_prompts` 键下，不参与计费、也不跨端同步。改完提示词**不会**自动重新生成，需要手动点「重新生成」。

### 前端安全约束

模型返回的 HTML **必须**经 `normalizeAiHtml()` 处理后再进 TinyMCE —— 它会拆掉包裹整段输出的代码围栏、把剩下的围栏转成 `<pre><code>`、纯文本按空行分段，最后用白名单净化（`style` / `class` / 事件属性一律剥离）。模型被诱导输出 `<script>` 或 `onerror` 就等于把 XSS 写进正文，所以不要直接把流式结果塞进编辑器。

```typescript
import { normalizeAiHtml } from '~/composables/useAiHtml'

const html = normalizeAiHtml(text) // 已净化，可直接 insertContent
```

### 模型

`GET /api/ai/models/` 优先探测用户 Key 对应的上游 `/models`，连不上就回落到后端内置清单（缓存 10 分钟，按用户分桶），响应里的 `source` 会标明来源是 `upstream` 还是 `builtin`。内置清单只放**对话模型** —— rerank / embedding / tts / 图像模型走 `chat/completions` 会直接 502。


---

## 阅读增强

两个纯前端能力，都不改后端、不进 SSR 数据。

### 划词问 AI

在正文里选中任意一段，贴着选区冒出「解释一下 / 翻译 / 展开讲讲 / 反问我」浮条，点开后走 `AiAssistDialog` 流式输出。

- 只有登录且站点开着 AI 时才出现（`useAiClient().available`）；
- 选区必须落在正文容器内 —— 在标题或评论区划词不会弹；
- 回答语言跟随界面语言，翻译的目标语言固定是「另一种」；
- 结果面板的主按钮是**复制**而不是「应用」：这里没有可以写回的地方。

**反问我**是唯一的两段式动作：模型先把话头递回给你——「你想了解这段的哪一点？」（提示词里明确写了不许问「这段讲了什么」这类复述题），你写下自己的疑问，它再正面解答；如果你的问法里带着理解偏差，会顺手指出来，末尾补一句你还没注意到的关键点。这一屏没有「应用」，因为产出是解答本身。疑问上限 600 字，提问还在流式时不能提交（否则是对着半句话作答），答完可以「重新解答」或「换一个问题」。

浮条宽度按实测值贴着屏幕边缘收，四个动作在 360px 宽的屏上仍是一行；再窄会换行，并收成圆角矩形免得被胶囊圆角切掉。

### 正文朗读

文章操作栏里的喇叭按钮，按段落逐段朗读，当前段落高亮并自动滚到视野中间。底部浮条可以暂停 / 跳段 / 调语速（0.75× ~ 1.5×），语速存 `localStorage`。

依赖浏览器 `speechSynthesis`，Chrome / Edge / Safari 支持，音色取决于系统装了哪些语音。

两个细节都是为了「不漏字」：

- **按文本节点收集段落**，而不是按标签白名单。代码块、表格单元格、裸 `<div>` 里的文字都会被读到（早期用 `querySelectorAll('p, li, …')` 会整段跳过，有一篇 969 字的文章收集到 0 字）。
- **长段落按句号切句**再交给引擎，并每 12 秒做一次 pause/resume 保活。整篇或整段一次性丢进去，Chrome 会在长句中途静默停止，后面全不出声。

另外两处是为了「高亮别乱跑」：

- 块级标签里包含 `div` / `section` / `summary` / `figure`。AI 生成和从别处粘进来的内容经常把整段文字直接塞在 `div` 里，`<details><summary>` 的标题也在 `summary` 里；漏掉它们不会丢字，但那一段会兜底到正文根节点 —— 高亮铺满整篇、滚动跳回顶部。
- 换主题会重算正文 HTML（代码块要换配色），`v-html` 把整棵子树重建，段落里存的元素全部脱离文档 —— 表现是「朗读还在继续，但高亮没了、也不再跟着滚动」。检测到脱离会按序号重新绑定一次。

还有两处是为了「别停在中途」：

- **`cancel()` 和 `speak()` 不能挤在同一轮事件循环里**。被取消的 utterance 的 onend / onerror 是异步回来的，新 utterance 偶尔永远等不到 onend，而 onend 是唯一的推进信号 —— 表现就是「改完倍速，当前这段念完就没声了」。所有「取消后重开口」都改成隔 60ms 再说。
- **断链看门狗**：每秒检查一次「我们以为在念，但引擎既没在响也没有待播」，是就说明 onend 丢了，从下一句接着念。连续救两次还不行就停下 —— 引擎真坏了的话，继续救只会飞快跳过正文。

已知行为（不是 bug）：音色跟随**界面**语言而不是正文语言，英文界面读中文文章会用英文音色；暂停时点「上一段 / 下一段」会直接开始播放；读完最后一段浮条自动消失，没有单独的「已读完」状态。

---

## PWA（可安装 + 离线阅读）

`@vite-pwa/nuxt` + Workbox。桌面 Chrome / Edge 地址栏、Android Chrome 菜单、iOS Safari「添加到主屏幕」都能装成独立应用，装完断网也能打开读过的文章。

- **更新提示是手写的**（`PwaUpdatePrompt.vue`）：注册类型用 `prompt`，新版本装好后停在等待态不接管页面 —— 用户可能正在编辑器里写草稿，自动刷新会把内容冲掉。底部冒一张小卡片，点「立即更新」才跳过等待并重载。
- **离线范围 = 访问过的页面**。站点是 SSR，没有预渲染的 `index.html` 可以当兜底页，所以关掉了 `navigateFallback`，改由页面级 NetworkFirst 缓存（3 秒超时）兜住。
- **中文字体不进预缓存**。`@chinese-fonts/maple-mono-cn` 有 3700 多个 woff2 分片（约 148MB），首次安装拉全套是不可接受的；字体走运行时 CacheFirst，用到哪个存哪个。当前预缓存约 410 项、0 个字体文件。
- 图标由 `public/favicon.ico` 生成：`pwa-192`、`pwa-512`、`apple-touch-icon`，外加一张红底安全区的 `pwa-maskable-512`（Android 会把图标裁成圆形 / 水滴）。
- Service Worker 在 `nuxt dev` 下默认不启用，验证请用 `npm run build && node .output/server/index.mjs`。

---

## 光标墨迹（彩蛋）

鼠标划过页面会拖出一串淡墨，停下后约 0.9 秒自行收干消散。纯装饰，不存任何状态。

- **只认鼠标**：`pointermove` 对触摸同样会触发，手指下滑翻页时会在整屏拖出墨迹 —— 那不是彩蛋是事故，所以 `pointerType !== 'mouse'` 直接丢弃。
- **不做粒子**：只保留最近 48 个采样点（间距 3px），按「年龄」衰减透明度与线宽，衰减用 `(1 - age) ** 1.2` 而非线性，观感是先停留再迅速收干，像墨渗进纸里。
- **在段的中点下刀、平头相接**：两次 `stroke()` 只要几何上重叠，alpha 就会混合两次（实测 0.5 → 0.75），于是每个采样点都变成一颗更深的圆珠 —— 满屏的「点」就是这么来的。把圆头收到相切又会在接缝处掐出细腰，尾巴串成香肠。唯一两头不占的切法是在段的中点切开：那里两侧方向相同、端面共面，平头贴平头，重叠为 0、缝隙也为 0。`lineCap` 必须保持 `butt`，任何一处改回 `round` 珠子立刻回来。
- **光晕与主线分两遍画**：光晕宽 2.2 倍、淡到 0.28 倍，垫在主线下面给出湿边。若在同一次循环里逐片画两层，后一片的光晕会盖住前一片的主线，整条尾巴会变成一串「亮头暗尾」的虚线。
- **笔尖只补朝前的半个圆**：补整颗圆会盖住最后一片的平头端面、再混一次 alpha，最浓的那颗珠子正好落在光标上；半圆与端面只共一条直径，拼起来是个圆角笔尖。
- **墨干了就停 rAF**：点阵清空后不再申请下一帧，靠下一次 `pointermove` 唤醒。这个效果大部分时间是关着的，常驻 60fps 循环纯烧电。
- **颜色每帧现取主题主色**，换主题立刻跟上，不需要监听主题变化。
- **系统开启「减少动态效果」时整个功能让位**（`prefers-reduced-motion`），连监听都不挂。
- 编辑器路由（`/article/create`、`/article/edit/:id`）自动关闭 —— 那里的鼠标是在选文字、拖代码块。

---

## API 接口一览

| 模块 | 接口 | 方法 | 说明 |
|------|------|------|------|
| Auth | `/token/` | POST | 用户登录 |
| Auth | `/token/refresh/` | POST | 刷新 Token |
| Auth | `/token/verify/` | POST | 验证 Token |
| Auth | `/register/` | POST | 用户注册 |
| Auth | `/code/` | POST | 获取注册验证码 |
| Auth | `/resetcode/` | POST | 获取重置密码验证码 |
| Auth | `/user/resetpsw/` | PUT | 重置密码 |
| Auth | `/logout/` | POST | 登出 |
| Auth | `/logout_all/` | POST | 全设备登出 |
| Auth | `/coskey/` | GET | 获取 COS 临时密钥 |
| Article | `/article/` | GET | 文章列表（分页/搜索） |
| Article | `/article/{id}/` | GET | 文章详情 |
| Article | `/article/create/` | POST | 创建文章 |
| Article | `/article/{id}/` | PUT | 更新文章 |
| Article | `/article/{id}/` | DELETE | 删除文章 |
| Comment | `/comment/` | GET | 评论列表 |
| Comment | `/comment/` | POST | 发表评论/回复 |
| Like | `/like/` | GET | 点赞列表 |
| Like | `/like/` | POST | 点赞 |
| Like | `/like/{id}/` | DELETE | 取消点赞 |
| Tag | `/tag/` | GET | 标签列表 |
| User | `/user/{id}/` | GET | 获取用户信息 |
| User | `/user/{id}/` | PUT | 更新用户资料 |
| User | `/user/editpsw/{id}/` | PUT | 修改密码 |
| Notice | `/notice/` | GET | 通知列表 |
| Notice | `/notice_read/` | POST | 标记已读 |
| Photo | `/photo/` | GET | 相册列表 |
| Photo | `/photo/` | POST | 上传照片 |
| Photo | `/photo/{id}/` | DELETE | 删除照片 |
| Wish | `/wish/` | GET | 心愿单列表 |
| Wish | `/wish/` | POST | 新增心愿 |
| Wish | `/wish/{id}/` | GET | 心愿详情 |
| Wish | `/wish/{id}/` | PATCH | 局部更新（如仅切换完成状态） |
| Wish | `/wish/{id}/` | DELETE | 删除心愿 |
| Search | `/search/` | GET | 搜索 |
| Search | `/search/` | POST | 记录搜索词 |
| AI | `/ai/credential/` | GET / PUT / DELETE | 查询（掩码）/ 保存 / 清除自己的 API Key |
| AI | `/ai/chat/` | POST | 非流式对话（需登录） |
| AI | `/ai/chat-stream/` | POST | 流式对话，SSE（需登录） |
| AI | `/ai/models/` | GET | 可选模型（需登录） |
| AI | `/ai/quota/` | GET | 当前用户 token 用量（需登录） |

### 本地 Nitro 端点

以下端点曾在**本站**实现（Nitro `server/api/ai/`），现已全部迁到 Django 后端（`backend/ai/`），
前端改为直连 `{apiBase}ai/*` 并携带 JWT。此处仅作历史说明，不再有 Nitro 侧的 AI 端点。

| 端点 | 方法 | 现在的位置 |
|------|------|-----------|
| `/api/ai/chat/` | POST | Django `ai/views.py::AiChatView` |
| `/api/ai/chat-stream/` | POST | Django `ai/asgi.py`（原生 ASGI，SSE） |
| `/api/ai/models/` | GET | Django `ai/views.py::AiModelsView` |
| `/api/ai/quota/` | GET | Django `ai/views.py::AiQuotaView` |
| `/api/ai/credential/` | GET/PUT/DELETE | Django `ai/views.py::AiCredentialView`（新增） |

---

## 主题配置

项目提供 3 套主题，通过 Vuetify 主题系统管理，切换顺序为 light → dark → terminal（`useThemeCycle`）：

| 颜色角色 | Light | Dark | Terminal（终端） |
|----------|-------|------|------------------|
| background | #F9FAFB | #121212 | #050807 |
| surface | #FFFFFF | #1E1E1E | #0B1310 |
| primary | #e41b23 | #349d17 | #2BE86E |
| secondary | #1565C0 | #4FC3F7 | #FFB000 |
| error | #B00020 | #B00020 | #FF5A6E |

`main.css` 中的花饰、荧光笔划线、贴纸阴影全部由 `primary` / `secondary` / `--k-ink` 派生，**纯配色**的新主题只改配置即可。terminal 另带装饰层（扫描线、刷新带、方块光标），需要在 `main.css` 里补。

**主色与副色必须两两不同**。圆环花饰（`--k-accent-b`）、星芒（`--k-accent-d`）、贴纸标签、热门榜 #2 徽章、撒花都从 `secondary` 派生；早先 light 与 dark 共用 `#03DAC6`，结果这些装饰切了主题纹丝不动。同理，`.hero-blob--a` 曾写成 `rgb(var(--v-theme-primary) / 0.75)`——`var()` 展开后是 `rgb(228 27 35 / 0.75)`，旧式 `rgb()` 不认斜杠，整条声明被判无效，两团柔和花饰在三套主题下都是 `none`；要透明度请用 `color-mix(in srgb, rgb(var(--v-theme-primary)) 75%, transparent)`。

### 终端（terminal）

磷光绿点阵屏：近黑底 + 显像管绿主色 + 琥珀副色，卡片描边与硬阴影直接取磷光绿，整页像一块发光的荧光屏。

- **扫描线是静态的，刷新带只动 `transform`**。全屏 `background-position` 动画很贵——除非「位移本身就是效果」，否则不值得。扫描线强度实测下调过：0.055 在文章页能看出明显横条，0.035 + 25% 占空才不干扰阅读。
- **`--k-highlight-soft` 单独压暗**。默认值是「主色混白 55%」，在绿主题里划痕和绿标题同色，字母下半截会糊进划痕；改成混近黑绿，亮字才浮得起来。
- **方块光标是真实元素**（`AppBar.vue` 里的 `.k-caret`），不是 `::after`：标题的 slot 在 `.v-toolbar-title__placeholder` 里，那是块级元素，伪元素会被挤到下一行；而且 `.k-gradient-text` 全站有三处（顶栏、首页大标题、页脚），伪元素会让一屏出现三个闪烁光标。`.k-caret` 只在终端主题下 `display: inline-block`。
- **「减少动态效果」下光标要单独常亮**。全局降级规则把动画钉在末帧，而闪烁的末帧是 `opacity: 0`，等于把光标擦掉。

### 新增主题要改的不止配置

有四处按主题名分支，漏改不会报错，只会静默用错：

| 位置 | 决定什么 |
|------|----------|
| `ArticleForm.vue` | TinyMCE 皮肤（暗色系名单） |
| `useArticleHtml.ts` 的 `SHIKI_THEMES` | 代码高亮配色；**缺 key 会回退到亮色**，暗色主题会拿到 github-light |
| `pages/tags/index.vue` | 暗色下标签云的描边色 |
| `CommandPalette.vue` | 命令面板里「切换主题」的搜索关键词 |

主题名存在 `theme` cookie 里（`app/plugins/theme.ts`），服务端读 cookie 直接渲染对应主题，刷新不会回退到 light、也没有闪白；客户端切换后由 watch 回写 cookie。

---

## 环境配置

### 前端可见（`runtimeConfig.public`）

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NUXT_PUBLIC_API_URL` | 后端 API 地址 | `https://kotae.cn/api/` |
| `NUXT_PUBLIC_SITE_URL` | 站点地址（canonical / og:url / sitemap） | `https://kotae.cn` |
| `NUXT_PUBLIC_COS_BUCKET` | COS 存储桶 | `chen-1302611521` |
| `NUXT_PUBLIC_COS_REGION` | COS 地域 | `ap-nanjing` |
| `NUXT_PUBLIC_AI_ENABLED` | 站点级 AI 开关（设 `false` 则不渲染任何 AI 入口）；能否真正使用还取决于登录态与用户自己的 Key | `true` |

### 仅服务端（`runtimeConfig`）

前端已**没有** AI 相关服务端配置：上游密钥不再由站点统一持有，改由每个用户自带并由 Django 加密保存。

AI 的默认上游、超时、限流等都在 **后端** `backend/.env` 里配：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `AI_DEFAULT_BASE_URL` | 用户没改接口地址时用的上游 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `AI_DEFAULT_MODEL` | 新用户默认模型 | `qwen3.8-flash` |
| `AI_TEMPERATURE` | 采样温度，0 ~ 2 | `0.7` |
| `AI_MAX_TOKENS` | 单次最大输出 token，1 ~ 8192 | `2048` |
| `AI_CONNECT_TIMEOUT` | 连接上游超时（秒） | `10` |
| `AI_TIMEOUT` | 读取上游超时（秒），流式指两分片之间的最长间隔 | `120` |
| `AI_THROTTLE_RATE` | 按用户限流速率（DRF 语法，如 `20/min`） | `20/min` |

---

## 部署

生产环境用 **PM2** 托管 Nitro 产物，跑在 **Windows Server** 上。

### 构建

```bash
npm run build        # 产物在 .output/
```

### PM2 配置

```js
// ecosystem.config.cjs
module.exports = {
    apps: [{
        name: 'kotae',
        script: '.output/server/index.mjs',
        cwd: 'D:/kotae',                 // 必须是项目根，见下方说明
        instances: 1,
        exec_mode: 'fork',
        env: {
            NODE_ENV: 'production',
            NITRO_PORT: 3000,
        },
    }],
}
```

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

**保持 `fork` + `instances: 1`**：Nitro 侧已不承担 AI 逻辑，但 SSR 与 token 刷新仍依赖单进程内的共享状态，多实例请先评估。

### 注入密钥

前端已不需要任何上游密钥：AI 的 Key 由每个用户在自己账号里填写，存在 Django 的加密表里。
这里只保留后端相关的环境变量（如 `NUXT_PUBLIC_API_URL`）注入方式，供参考：

```cmd
:: 管理员 CMD（/M 为机器级，服务也能读到）
setx NUXT_PUBLIC_API_URL "https://kotae.cn/api/" /M

:: 必须杀掉 daemon 再起，单纯 pm2 restart 拿不到新值
pm2 kill
pm2 start ecosystem.config.cjs
pm2 save
```

`setx` 只影响**之后创建**的进程，而 PM2 daemon 会缓存自己的环境，所以 `pm2 kill` 这一步不能省。

也可以改用 env 文件，把配置放在项目目录外：

```js
node_args: '--env-file=D:/kotae/env',
```

> 文件必须是 **UTF-8 无 BOM + LF**。带 BOM 会让首个键名匹配不上；CRLF 会让值尾部带 `\r`。

### 开机自启

`pm2 startup` **不支持 Windows**，用任务计划程序：

- **触发器**：启动时
- **操作**：`C:\Users\<用户>\AppData\Roaming\npm\pm2.cmd`，参数 `resurrect`，起始于项目根目录
- 勾选「不管用户是否登录都要运行」+「使用最高权限运行」

前提是先 `pm2 save`，否则 `resurrect` 没有可恢复的进程列表。

### 验证

```cmd
pm2 env 0                                     :: 看子进程实际拿到的环境变量
curl -i http://localhost:3000/api/ai/models    :: 200 = 通了，503 = 密钥没注入
pm2 logs kotae --lines 50
```

---

## SEO 优化

- **Sitemap**：动态从 API 拉取文章列表生成 sitemap（`@nuxtjs/sitemap`）
- **Robots**：配置爬虫规则，禁止爬取 `/admin` 路径
- **结构化数据**：首页注入 ItemList JSON-LD，文章页注入 BlogPosting JSON-LD
- **Open Graph**：配置 OG 标签用于社交分享
- **Google 站点验证**：已配置 meta 验证标签
- **SSR**：基于 Nuxt 的服务端渲染，正文经服务端净化后输出，首屏 SEO 友好

---

## 开发约定

1. **组件**：使用 Vuetify 组件 + Tailwind CSS 工具类进行样式编写
2. **状态管理**：使用 `useState()` 进行跨组件全局状态通信
3. **对话框**：通过全局 state 控制（如 `useState('login')`）
4. **API 调用**：统一通过 `composables/api/` 下的模块进行
5. **正文渲染**：一律走 `useArticleHtml`，不要直接 `v-html` 后端内容
6. **文件上传**：一律走 `useCosUpload`，不要在页面里 new COS
7. **自动导入**：`composables/` 及 `composables/api/` 目录下的函数自动导入，无需手动 import
8. **类型检查**：`typescript.typeCheck: false`（避免 `nuxt dev` 卡在类型检查上），需要时手动跑 `npm run typecheck`。注意 `nuxi typecheck` 会和自己触发的 `nuxt prepare` 抢跑，同一份代码可能报出不同的错误集，所以脚本是 `nuxt prepare && vue-tsc --noEmit -p .nuxt/tsconfig.json`
9. **字体**：品牌字体为 Maple Mono CN SemiBold
10. **音效**：新增可交互元素默认由全局委托自动覆盖；需自定义音效时用 `data-cuelume-*` 声明；命令式管理时用 `data-cuelume-manual` 排除全局委托
11. **非标准可点击元素**（`<span>`/`<p>`/`<div>` + `@click`）需显式添加 `data-cuelume-press` + `data-cuelume-release` 以获得音效反馈
12. **AI 返回内容**：一律经 `normalizeAiHtml()` 再进编辑器，不要直接 `insertContent(raw)`
13. **AI 密钥**：只在服务端（`runtimeConfig.aiApiKey`），不要写进 `public`、不要提交 `.env`、不要硬编码进 `nuxt.config.ts`
