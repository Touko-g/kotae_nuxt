import type {
    AiAssistAction,
    AiCustomPrompt,
    AiPromptConfig,
    AiPromptScope,
    AiPromptStore,
    AiPromptVars,
} from '#shared/types/ai'

/**
 * 用户自定义提示词。
 *
 * 两种形态：
 * 1. **覆盖内置动作** —— 把「润色」「扩写」的提示词换成自己的一套，菜单项不变；
 * 2. **新增自定义动作** —— 自己起名字、选图标、写提示词，追加在菜单末尾。
 *
 * 存在 localStorage 而不是后端：这份配置只影响自己的操作习惯，
 * 不参与计费也不需要跨端同步，和 `ai_model` 存 cookie 是同一个取舍。
 * 将来要同步到账号，把这一个文件的读写换掉即可，调用方不用动。
 *
 * 提示词模板里的占位符（一个占位符只对应一种东西，不随动作变）：
 * - `{{text}}`    —— 用户正在处理的草稿：选区或输入框内容。生成类动作没有草稿，是空
 * - `{{title}}`   —— 文章标题
 * - `{{reply}}`   —— 回复场景里「对方是谁、说了什么」，运行时才知道，不能写死
 * - `{{article}}` —— 文章正文摘要。生成类动作（帮我写一条 / 帮我回一条）用它
 *
 * 早先让生成类的 `{{text}}` 退化成文章正文，结果和 `{{article}}` 撞成同一个值，
 * 两个名字指向同一样东西，用户根本判断不出该写哪个。
 *
 * 用户忘了写 `{{text}}` 且确实有草稿时会自动把草稿接在末尾 —— 否则提示词里
 * 根本没有素材，模型只能凭空编。宁可多一段原文，也不能让它空跑一次还花掉额度。
 */

const STORAGE_KEY = 'ai_prompts'

/** 富文本动作的公共约束：只回 HTML 片段，别套 Markdown 围栏 */
export const AI_HTML_RULE_BASE =
    '只输出 HTML 片段（可用 <p> <h2> <h3> <h4> <ul> <ol> <li> <strong> <em> <blockquote> <pre> <code>），' +
    '不要用 Markdown 代码块包裹，不要输出 <html>/<body>，不要任何解释。' +
    '代码一律写成 <pre class="language-xxx"><code>代码</code></pre>，xxx 取 javascript / typescript / html / css / json / python / java / c，' +
    '其它语言照实写；行内代码用 <code>。不要用 ``` 围栏，也不要把代码丢成纯文本段落。'

/** 默认不许模型自作主张上色，但原文已有的样式要保住 */
export const AI_COLOR_RULE_OFF =
    '不要自己新增颜色、背景色或自定义样式；原文里已有的内联样式（如 <span style="color:…">）请原样保留。'

/** 自定义动作在 action.key 上的前缀，用来和内置动作区分 */
export const CUSTOM_KEY_PREFIX = 'custom:'

const emptyConfig = (): AiPromptConfig => ({ overrides: {}, customs: [] })

const emptyStore = (): AiPromptStore => ({
    article: emptyConfig(),
    comment: emptyConfig(),
})

/** 把任意读到的值收成合法结构：localStorage 里的东西不可信，可能是上个版本留下的 */
const normalizeConfig = (raw: any): AiPromptConfig => {
    const config = emptyConfig()
    if (!raw || typeof raw !== 'object') return config

    if (raw.overrides && typeof raw.overrides === 'object') {
        for (const [key, value] of Object.entries(raw.overrides)) {
            if (typeof value === 'string' && value.trim()) {
                config.overrides[key] = value
            }
        }
    }

    if (Array.isArray(raw.customs)) {
        config.customs = raw.customs
            .filter((item: any) => item && typeof item === 'object')
            .map(
                (item: any): AiCustomPrompt => ({
                    id: String(item.id || createId()),
                    name: String(item.name || '').slice(0, 20),
                    icon: String(item.icon || 'mdi-auto-fix'),
                    prompt: String(item.prompt || ''),
                    format: item.format === 'html' ? 'html' : 'text',
                    enabled: item.enabled !== false,
                })
            )
    }

    return config
}

const createId = () =>
    `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** 生成类动作的 key：它们没有草稿，读的是文章正文 */
const GENERATE_KEYS = ['generate_comment', 'generate_reply']

/**
 * 旧配置迁移。
 *
 * `generate_*` 的覆盖模板一度把文章正文塞进 `{{text}}`，后来 `{{text}}` 被明确成
 * 「正在处理的草稿」—— 生成类没有草稿，那些模板里的 `{{text}}` 会突然变成空串，
 * 提示词只剩一个标题，模型拿不到正文还照样扣额度，而且界面上看不出任何异常。
 *
 * 只在模板既没写 `{{article}}` 又确实用了 `{{text}}` 时替换：两个都写了说明
 * 用户是有意区分「正文」和「草稿」的，不要动。
 */
export const migrateGenerateOverrides = (
    config: AiPromptConfig
): AiPromptConfig => {
    let changed = false
    const overrides = { ...config.overrides }

    for (const key of GENERATE_KEYS) {
        const stored = overrides[key]
        if (!stored) continue
        // 全角花括号在渲染时会被归一化，迁移也必须先归一化，
        // 否则 `｛｛text｝｝` 匹配不到，照样变成空串
        const template = normalizeBraces(stored)
        if (!/\{\{\s*text\s*\}\}/i.test(template)) continue
        if (/\{\{\s*article\s*\}\}/i.test(template)) continue
        overrides[key] = template.replace(/\{\{\s*text\s*\}\}/gi, '{{article}}')
        changed = true
    }

    return changed ? { ...config, overrides } : config
}

/**
 * 渲染提示词模板。
 *
 * `format: 'html'` 时自动补上 HTML 约束：自定义动作如果只写「帮我改改这段」，
 * 模型十有八九回 Markdown，`normalizeAiHtml` 虽然能兜底，但代码块和标题层级会变形。
 */
/**
 * 中文输入法下 `{` 很容易打成全角 `｛`，正则匹配不到，结果就是
 * 占位符原样留在提示词里、原文反倒被追加到末尾 —— 看起来像「没生效」。
 * 模板是给模型的指令，花括号全角半角没有语义差别，先统一成半角再匹配。
 *
 * 只归一化模板，不动 `vars` 里的原文：原文里的全角花括号是内容的一部分。
 */
const normalizeBraces = (template: string) =>
    template.replace(/｛/g, '{').replace(/｝/g, '}')

export const renderAiPrompt = (
    template: string,
    vars: AiPromptVars = {},
    format: 'text' | 'html' = 'text'
) => {
    const text = vars.text ?? ''
    const source = normalizeBraces(template)
    const hasTextSlot = /\{\{\s*text\s*\}\}/i.test(source)

    // 替换值必须走函数形式：原文里出现 `$&` / `$1` / `` $` `` 时，
    // 字符串形式的 replace 会把它们当成替换模式解释，原文被悄悄改写。
    let out = source
        .replace(/\{\{\s*text\s*\}\}/gi, () => text)
        .replace(/\{\{\s*title\s*\}\}/gi, () => vars.title ?? '')
        .replace(/\{\{\s*reply\s*\}\}/gi, () => vars.reply ?? '')
        .replace(/\{\{\s*article\s*\}\}/gi, () => vars.article ?? '')

    if (!hasTextSlot && text) out += `\n\n${text}`
    if (format === 'html') out += `\n\n${AI_HTML_RULE_BASE}${AI_COLOR_RULE_OFF}`

    return out
}

export const useAiPrompts = () => {
    /** 用 useState 共享：配置面板改完，同一棵组件树里的 AI 面板要立刻看到 */
    const store = useState<AiPromptStore>('ai_prompts', emptyStore)
    const loaded = useState<boolean>('ai_prompts_loaded', () => false)

    const load = () => {
        if (!import.meta.client || loaded.value) return
        loaded.value = true
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (!raw) return
            const parsed = JSON.parse(raw)
            store.value = {
                article: normalizeConfig(parsed?.article),
                comment: migrateGenerateOverrides(
                    normalizeConfig(parsed?.comment)
                ),
            }
        } catch {
            // 坏数据直接当没配置过，不要因为一段 JSON 把整个面板拖挂
            store.value = emptyStore()
        }
    }

    const persist = () => {
        if (!import.meta.client) return
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(store.value))
        } catch {
            // 无痕模式 / 配额满：这次改动只在内存里生效，不弹错打断写作
        }
    }

    // setup 阶段就同步读一次：openAi() 是点击时同步构建 actions 的，
    // 不能等 onMounted 才把配置补上
    load()

    const configFor = (scope: AiPromptScope) => store.value[scope]

    /** 取内置动作的覆盖模板；没覆盖时返回空串 */
    const overrideFor = (scope: AiPromptScope, key: string) =>
        configFor(scope).overrides[key]?.trim() || ''

    /**
     * 渲染一个内置动作：有覆盖就用覆盖的模板，否则原样返回调用方给的默认提示词。
     *
     * `fallback` 是**已经拼好原文和 HTML 约束**的完整提示词（各场景的默认文案不同，
     * 所以由调用方传进来），不能再过一遍 renderAiPrompt —— 否则会因为模板里没有
     * `{{text}}` 而把原文又追加一次。
     */
    const resolveBuiltin = (
        scope: AiPromptScope,
        key: string,
        fallback: string,
        vars: AiPromptVars,
        format: 'text' | 'html' = 'text'
    ) => {
        const override = overrideFor(scope, key)
        return override ? renderAiPrompt(override, vars, format) : fallback
    }

    /** 生成自定义动作（已渲染成可直接发送的提示词） */
    const customActions = (
        scope: AiPromptScope,
        vars: AiPromptVars
    ): AiAssistAction[] =>
        configFor(scope)
            .customs.filter(item => item.enabled && item.prompt.trim())
            .map(item => ({
                key: `${CUSTOM_KEY_PREFIX}${item.id}`,
                label: item.name || 'Custom',
                icon: item.icon || 'mdi-auto-fix',
                format: item.format,
                prompt: renderAiPrompt(item.prompt, vars, item.format),
            }))

    const saveConfig = (scope: AiPromptScope, config: AiPromptConfig) => {
        store.value = { ...store.value, [scope]: config }
        persist()
    }

    const setOverride = (
        scope: AiPromptScope,
        key: string,
        template: string
    ) => {
        const config = configFor(scope)
        const overrides = { ...config.overrides }
        if (template.trim()) overrides[key] = template
        else delete overrides[key]
        saveConfig(scope, { ...config, overrides })
    }

    const addCustom = (scope: AiPromptScope, item: AiCustomPrompt) => {
        const config = configFor(scope)
        saveConfig(scope, { ...config, customs: [...config.customs, item] })
    }

    const updateCustom = (scope: AiPromptScope, item: AiCustomPrompt) => {
        const config = configFor(scope)
        saveConfig(scope, {
            ...config,
            customs: config.customs.map(exist =>
                exist.id === item.id ? item : exist
            ),
        })
    }

    const removeCustom = (scope: AiPromptScope, id: string) => {
        const config = configFor(scope)
        saveConfig(scope, {
            ...config,
            customs: config.customs.filter(item => item.id !== id),
        })
    }

    const resetScope = (scope: AiPromptScope) => {
        saveConfig(scope, emptyConfig())
    }

    /** 是否改过任何东西：面板据此决定要不要显示「恢复默认」 */
    const hasCustomization = (scope: AiPromptScope) => {
        const config = configFor(scope)
        return (
            Object.keys(config.overrides).length > 0 ||
            config.customs.length > 0
        )
    }

    return {
        store,
        configFor,
        overrideFor,
        resolveBuiltin,
        customActions,
        setOverride,
        addCustom,
        updateCustom,
        removeCustom,
        resetScope,
        hasCustomization,
        createId,
    }
}
