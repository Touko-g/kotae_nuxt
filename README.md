# Kotae - 内容分享平台

> 记录 · 创作 · 分享，寻找你的答案

Kotae 是一个基于 Nuxt 4 构建的内容分享平台（博客/笔记系统），支持文章发布、评论、点赞、用户管理、通知、相册、心愿单、归档与标签云。项目使用 TypeScript 开发，集成 Vuetify 3 作为 UI 组件库，支持中英双语与 4 套主题。

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
| 语言 | TypeScript | - |
| 代码检查 | ESLint + Prettier | ^8.57.1 / ^3.6.2 |

---

## 快速开始

### 环境要求

- Node.js >= 18
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
│   │   ├── LoginDialog.vue       # 登录对话框
│   │   ├── NoticeList.vue        # 通知列表
│   │   ├── NoticePanel.vue       # 通知面板
│   │   ├── RegisterDialog.vue    # 注册对话框
│   │   ├── ResetDialog.vue       # 重置密码对话框
│   │   ├── SearchDialog.vue      # 搜索对话框
│   │   ├── SpeechInput.vue       # 语音输入（含实时转写浮条）
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
│   │   ├── useArticleHtml.ts     # 正文渲染：Shiki 高亮 + DOMPurify 净化
│   │   ├── useConfetti.ts        # 撒花粒子动画
│   │   ├── useCosUpload.ts       # 腾讯云 COS 直传（统一上传入口）
│   │   ├── useDayjs.ts           # 日期处理（响应式国际化）
│   │   ├── useDebounce.ts        # 防抖
│   │   ├── useExtractText.ts     # HTML 转纯文本（SSR 安全）
│   │   ├── useHttp.ts            # HTTP 客户端封装
│   │   ├── useReadingTime.ts     # 字数统计与预计阅读时间
│   │   ├── useRules.ts           # 表单验证规则
│   │   ├── useShiki.ts           # 代码高亮器单例
│   │   ├── useSound.ts           # 交互音效（cuelume 封装 + 开关持久化）
│   │   ├── useSpeechRecognition.ts # Web Speech API 语音转文字
│   │   ├── useThemeCycle.ts      # 4 套主题轮换
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
│   │   └── permissions.ts        # v-permission 权限指令
│   └── error.vue                 # 全局错误页
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

---

## 主题配置

项目提供 4 套主题，通过 Vuetify 主题系统管理，切换顺序为 light → dark → rainy → glass（`useThemeCycle`）：

| 颜色角色 | Light | Dark | Rainy（雨夜闪电） | Glass（玻璃磨砂） |
|----------|-------|------|-------------------|-------------------|
| background | #F9FAFB | #121212 | #0B1120 | #EAF0FA |
| surface | #FFFFFF | #1E1E1E | #141E33 | #FFFFFF |
| primary | #e41b23 | #349d17 | #F7C948 | #4C6EF5 |
| secondary | #03DAC6 | #03DAC6 | #5F8BE0 | #22B8CF |
| error | #B00020 | #B00020 | #FF7070 | #B00020 |

`main.css` 中的花饰、荧光笔划线、贴纸阴影全部由 `primary` / `secondary` 派生，新增主题无需改样式。

主题名存在 `theme` cookie 里（`app/plugins/theme.ts`），服务端读 cookie 直接渲染对应主题，刷新不会回退到 light、也没有闪白；客户端切换后由 watch 回写 cookie。

---

## 环境配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NUXT_PUBLIC_API_URL` | 后端 API 地址 | `https://kotae.cn/api/` |
| `NUXT_PUBLIC_SITE_URL` | 站点地址（canonical / og:url / sitemap） | `https://kotae.cn` |
| `NUXT_PUBLIC_COS_BUCKET` | COS 存储桶 | `chen-1302611521` |
| `NUXT_PUBLIC_COS_REGION` | COS 地域 | `ap-nanjing` |

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
8. **类型检查**：当前已禁用（`typescript.typeCheck: false`），改动后请依赖 ESLint 兜底
9. **字体**：品牌字体为 Maple Mono CN SemiBold
10. **音效**：新增可交互元素默认由全局委托自动覆盖；需自定义音效时用 `data-cuelume-*` 声明；命令式管理时用 `data-cuelume-manual` 排除全局委托
11. **非标准可点击元素**（`<span>`/`<p>`/`<div>` + `@click`）需显式添加 `data-cuelume-press` + `data-cuelume-release` 以获得音效反馈
