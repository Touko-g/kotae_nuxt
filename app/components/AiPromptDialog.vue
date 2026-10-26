<script setup lang="ts">
    import type {
        AiBuiltinAction,
        AiCustomPrompt,
        AiPromptScope,
        AiPromptVarName,
    } from '#shared/types/ai'

    interface Props {
        modelValue: boolean
        /** 当前编辑哪个场景的提示词（文章 / 评论互不影响） */
        scope: AiPromptScope
        /** 该场景的内置动作清单，由调用方提供 —— 面板本身不掺业务知识 */
        builtins: AiBuiltinAction[]
        /** 自定义动作能用的占位符。自定义动作不知道用户想干嘛，只能给场景级的全集 */
        customVars?: AiPromptVarName[]
    }

    /**
     * 不用 `withDefaults` 给 `customVars` 兜底：数组默认值要写成
     * `() => ['text', 'title']`，字面量会被推断成 `string[]`，匹配不上
     * `AiPromptVarName[]`，结果 props 里那个字段仍然被当成可选 ——
     * 传给 `chipsFor(vars: AiPromptVarName[])` 就是
     * 「AiPromptVarName[] | undefined 不能赋给 AiPromptVarName[]」。
     * 改成显式 coalesce，类型一眼看得清，也不依赖宏的推断。
     */
    const props = defineProps<Props>()
    const emit = defineEmits<{
        'update:modelValue': [value: boolean]
        /** 配置被改过：调用方要立刻重建 actions，别等面板关闭 */
        changed: []
    }>()

    const { t } = useLocale()
    const { show } = useToast()
    const {
        configFor,
        overrideFor,
        setOverride,
        addCustom,
        updateCustom,
        removeCustom,
        resetScope,
        hasCustomization,
        createId,
    } = useAiPrompts()

    const tab = ref<'builtin' | 'custom'>('builtin')

    /**
     * 占位符 chip 清单（token 由 `tokenOf` 现拼）。
     * 模板里不能直接写 `{{ '{{text}}' }}` —— Vue 的插值扫描会撞上内层的 `}}`，
     * 把表达式截断成 `'{{text`，直接编译报错。只能绕一层函数。
     */
    const VAR_CHIPS: { name: AiPromptVarName; hint: string }[] = [
        { name: 'text', hint: 'ai_var_text' },
        { name: 'title', hint: 'ai_var_title' },
        { name: 'reply', hint: 'ai_var_reply' },
        { name: 'article', hint: 'ai_var_article' },
    ]

    const tokenOf = (name: AiPromptVarName) => `{{${name}}}`

    /** 没声明 `vars` 的内置动作按这两个算 */
    const DEFAULT_VARS: AiPromptVarName[] = ['text', 'title']

    /** 自定义动作能用的占位符：调用方没传就按 text / title 兜底（永远不是 undefined） */
    const customVarList = computed<AiPromptVarName[]>(
        () => props.customVars ?? DEFAULT_VARS
    )

    /**
     * 只列这个动作**真的有值**的占位符。
     *
     * 早先是四个全摆出来、靠 `scope === 'comment'` 判断显示哪几个，结果
     * 「帮我写一条」的编辑框里既有 `{{text}}`（永远是空）又有 `{{reply}}`
     * （那是「帮我回一条」的上下文），用户照着插进去，提示词里就多出两个空位，
     * 看起来像占位符失效 —— 摆一个填不进去的占位符，比不摆更糟。
     */
    const chipsFor = (vars: AiPromptVarName[]) =>
        VAR_CHIPS.filter(chip => vars.includes(chip.name))

    /** 全角花括号也要认出来，否则「写了个空占位符」这件事根本不会提示 */
    const halfWidth = (template: string) =>
        template.replace(/｛/g, '{').replace(/｝/g, '}')

    /** 模板里写了、但这个动作拿不到值的占位符 */
    const emptyVarsIn = (template: string, vars: AiPromptVarName[]) => {
        const source = halfWidth(template)
        return VAR_CHIPS.filter(chip => !vars.includes(chip.name))
            .filter(chip =>
                new RegExp(`\\{\\{\\s*${chip.name}\\s*\\}\\}`, 'i').test(source)
            )
            .map(chip => chip.name)
    }

    const config = computed(() => configFor(props.scope))

    /** 表单里选图标用的候选，够用就行，不做完整图标库 */
    const ICONS = [
        'mdi-auto-fix',
        'mdi-format-align-left',
        'mdi-emoticon-happy-outline',
        'mdi-translate',
        'mdi-text-box-check-outline',
        'mdi-lightbulb-on-outline',
        'mdi-magnify-scan',
        'mdi-code-tags',
        'mdi-format-title',
        'mdi-arrow-expand-horizontal',
        'mdi-format-list-checks',
        'mdi-comment-quote-outline',
    ]

    // ---------------- 内置动作：覆盖提示词 ----------------

    /** 正在编辑的内置动作 key；null 表示都没展开 */
    const editingKey = ref<string | null>(null)
    const draft = ref('')
    /** 内置动作那个 textarea，用来把占位符插到光标处而不是末尾 */
    const draftInputRef = useTemplateRef('draftInputRef')

    const builtinOf = (key: string) =>
        props.builtins.find(item => item.key === key)

    const builtinVars = (key: string) => builtinOf(key)?.vars ?? DEFAULT_VARS

    /** 当前编辑的内置动作里，写了但拿不到值的占位符 —— 存下来之前就得知道 */
    const draftEmptyVars = computed(() =>
        editingKey.value
            ? emptyVarsIn(draft.value, builtinVars(editingKey.value))
            : []
    )

    /**
     * 打开编辑。
     *
     * 没覆盖过时预填内置默认模板 —— 这是关键：给一个空框，用户根本不知道
     * 原来写了什么、`{{text}}` 该放在哪，只能整段重写，占位符就成了负担。
     * 预填之后看到的是完整提示词，改哪里一目了然。
     */
    const startOverride = (key: string) => {
        editingKey.value = key
        draft.value =
            overrideFor(props.scope, key) ||
            builtinOf(key)?.defaultTemplate ||
            ''
    }

    const saveOverride = () => {
        if (!editingKey.value) return
        const key = editingKey.value
        const value = draft.value.trim()
        // 改回和默认一模一样就当没自定义，别让「已自定义」这个标莫名其妙亮着
        const sameAsDefault =
            value === (builtinOf(key)?.defaultTemplate ?? '').trim()
        setOverride(props.scope, key, sameAsDefault ? '' : draft.value)
        editingKey.value = null
        emit('changed')
        show(t('ai_saved'), 'success')
    }

    const restoreOverride = () => {
        if (!editingKey.value) return
        setOverride(props.scope, editingKey.value, '')
        editingKey.value = null
        emit('changed')
    }

    const isOverridden = (key: string) => !!overrideFor(props.scope, key)

    /**
     * 把占位符插到光标处。
     *
     * 早先直接拼到末尾：用户写了一半的提示词，点一下 chip 发现文字跑到最后去了，
     * 还得手动剪切粘贴 —— 这也是「占位符没用」的一部分来源。
     */
    const insertAtCursor = (
        el: HTMLTextAreaElement | null | undefined,
        current: string,
        token: string
    ) => {
        if (!el || typeof el.selectionStart !== 'number') {
            return { value: current + token, caret: 0 }
        }
        const start = el.selectionStart
        const end = el.selectionEnd ?? start
        return {
            value: current.slice(0, start) + token + current.slice(end),
            caret: start + token.length,
        }
    }

    const textareaOf = (component: any) =>
        component?.$el?.querySelector?.('textarea') as
            | HTMLTextAreaElement
            | null
            | undefined

    const focusAfter = (component: any, caret: number) => {
        const el = textareaOf(component)
        if (!el || !caret) return
        nextTick(() => {
            el.focus()
            el.setSelectionRange(caret, caret)
        })
    }

    const insertDraftVar = (name: string) => {
        const token = `{{${name}}}`
        const { value, caret } = insertAtCursor(
            textareaOf(draftInputRef.value),
            draft.value,
            token
        )
        draft.value = value
        focusAfter(draftInputRef.value, caret)
    }

    // ---------------- 自定义动作 ----------------

    const editing = ref<AiCustomPrompt | null>(null)
    const formError = ref('')
    /** 自定义动作的 textarea，用来把占位符插到光标处 */
    const promptInputRef = useTemplateRef('promptInputRef')

    /** 自定义动作里写了场景拿不到的占位符（比如文章场景写了 `{{reply}}`） */
    const customEmptyVars = computed(() =>
        editing.value
            ? emptyVarsIn(editing.value.prompt, customVarList.value)
            : []
    )

    /**
     * 新增时预填一个带占位符的示例。
     * 给空框的话，多数人会写「帮我改改这段话」就完了，永远不知道 `{{text}}`
     * 该放在哪；预填一份能直接改的，比讲一遍概念管用。
     */
    const blankCustom = (): AiCustomPrompt => ({
        id: createId(),
        name: '',
        icon: 'mdi-auto-fix',
        prompt: '请把下面的文字改写成更口语化的表达，保持原意：\n\n{{text}}',
        // 评论场景只能出纯文本（输入框不接 HTML），所以这里不给选
        format: 'text',
        enabled: true,
    })

    const startAdd = () => {
        editing.value = blankCustom()
        formError.value = ''
    }

    const startEditCustom = (item: AiCustomPrompt) => {
        editing.value = { ...item }
        formError.value = ''
    }

    const cancelEdit = () => {
        editing.value = null
        formError.value = ''
    }

    const saveCustom = () => {
        const item = editing.value
        if (!item) return
        if (!item.name.trim()) {
            formError.value = t('ai_prompt_name_required')
            return
        }
        if (!item.prompt.trim()) {
            formError.value = t('ai_prompt_template_required')
            return
        }
        const exists = config.value.customs.some(one => one.id === item.id)
        if (exists)
            updateCustom(props.scope, { ...item, name: item.name.trim() })
        else addCustom(props.scope, { ...item, name: item.name.trim() })
        editing.value = null
        formError.value = ''
        emit('changed')
        show(t('ai_saved'), 'success')
    }

    /** 删除走二次确认：误删一条写好的提示词，比误点一次生成更让人难受 */
    const pendingDelete = ref<AiCustomPrompt | null>(null)
    const doDelete = () => {
        if (!pendingDelete.value) return
        removeCustom(props.scope, pendingDelete.value.id)
        pendingDelete.value = null
        emit('changed')
    }

    /** 点占位符插到光标处 —— 让用户手打 {{text}} 很容易打成 {text} 而静默失效 */
    const insertVar = (name: string) => {
        if (!editing.value) return
        const token = `{{${name}}}`
        const { value, caret } = insertAtCursor(
            textareaOf(promptInputRef.value),
            editing.value.prompt,
            token
        )
        editing.value.prompt = value
        focusAfter(promptInputRef.value, caret)
    }

    /** 启用 / 停用一条自定义动作。模板里不写对象展开，避免表达式过长 */
    const toggleCustom = (item: AiCustomPrompt, value: unknown) => {
        updateCustom(props.scope, { ...item, enabled: !!value })
        emit('changed')
    }

    const resetAll = () => {
        confirmReset.value = false
        resetScope(props.scope)
        editingKey.value = null
        editing.value = null
        emit('changed')
        show(t('ai_saved'), 'success')
    }

    const confirmReset = ref(false)

    const close = () => emit('update:modelValue', false)

    // 每次打开都回到第一页，避免上次停在「编辑中」的半截状态
    watch(
        () => props.modelValue,
        open => {
            if (!open) return
            tab.value = 'builtin'
            editingKey.value = null
            editing.value = null
            formError.value = ''
        }
    )
</script>

<template>
    <v-dialog
        :model-value="modelValue"
        max-width="760"
        scrollable
        @update:model-value="emit('update:modelValue', $event)"
    >
        <v-card class="prompt-panel">
            <v-card-title class="d-flex align-center ga-2 py-4">
                <v-icon color="primary">mdi-text-box-edit-outline</v-icon>
                <span class="text-h6">{{ t('ai_prompt_settings') }}</span>
                <v-chip size="x-small" variant="tonal" class="ml-1">
                    {{
                        scope === 'article'
                            ? t('ai_prompt_scope_article')
                            : t('ai_prompt_scope_comment')
                    }}
                </v-chip>
                <v-spacer />
                <v-btn
                    icon="mdi-close"
                    size="small"
                    variant="text"
                    :aria-label="t('cancel')"
                    @click="close"
                />
            </v-card-title>
            <v-divider />

            <v-tabs v-model="tab" density="comfortable" color="primary">
                <v-tab value="builtin">
                    <v-icon start size="18">mdi-tune-variant</v-icon>
                    {{ t('ai_prompt_builtin_tab') }}
                </v-tab>
                <v-tab value="custom">
                    <v-icon start size="18">mdi-plus-box-outline</v-icon>
                    {{ t('ai_prompt_custom_tab') }}
                    <v-chip
                        v-if="config.customs.length"
                        size="x-small"
                        class="ml-2"
                        variant="tonal"
                    >
                        {{ config.customs.length }}
                    </v-chip>
                </v-tab>
            </v-tabs>
            <v-divider />

            <v-card-text class="pt-4">
                <!-- ============ 内置动作 ============ -->
                <template v-if="tab === 'builtin'">
                    <p class="text-caption text-medium-emphasis mb-3">
                        {{ t('ai_prompt_builtin_hint') }}
                    </p>

                    <div
                        v-for="item in builtins"
                        :key="item.key"
                        class="prompt-row"
                    >
                        <div class="d-flex align-center ga-2">
                            <v-icon size="18" color="primary">
                                {{ item.icon }}
                            </v-icon>
                            <span class="text-body-2">{{ item.label }}</span>
                            <v-chip
                                v-if="isOverridden(item.key)"
                                size="x-small"
                                color="primary"
                                variant="tonal"
                            >
                                {{ t('ai_prompt_customized') }}
                            </v-chip>
                            <v-spacer />
                            <v-btn
                                v-if="editingKey !== item.key"
                                size="x-small"
                                variant="text"
                                prepend-icon="mdi-pencil-outline"
                                @click="startOverride(item.key)"
                            >
                                {{ t('ai_prompt_edit') }}
                            </v-btn>
                            <template v-else>
                                <v-btn
                                    size="x-small"
                                    variant="text"
                                    @click="editingKey = null"
                                >
                                    {{ t('cancel') }}
                                </v-btn>
                                <v-btn
                                    v-if="isOverridden(item.key)"
                                    size="x-small"
                                    variant="text"
                                    @click="restoreOverride"
                                >
                                    {{ t('ai_prompt_restore') }}
                                </v-btn>
                                <v-btn
                                    size="x-small"
                                    color="primary"
                                    variant="flat"
                                    @click="saveOverride"
                                >
                                    {{ t('ai_prompt_save') }}
                                </v-btn>
                            </template>
                        </div>

                        <v-expand-transition>
                            <div v-if="editingKey === item.key" class="mt-2">
                                <v-textarea
                                    ref="draftInputRef"
                                    v-model="draft"
                                    variant="outlined"
                                    density="compact"
                                    rows="6"
                                    auto-grow
                                    hide-details
                                    :placeholder="
                                        t('ai_prompt_template_placeholder')
                                    "
                                />
                                <div
                                    class="d-flex align-center ga-1 mt-2 text-caption text-medium-emphasis flex-wrap"
                                >
                                    <span>{{ t('ai_prompt_vars') }}</span>
                                    <v-chip
                                        v-for="chip in chipsFor(
                                            builtinVars(item.key)
                                        )"
                                        :key="chip.name"
                                        size="x-small"
                                        variant="tonal"
                                        :title="t(chip.hint)"
                                        @click="insertDraftVar(chip.name)"
                                    >
                                        {{ tokenOf(chip.name) }}
                                    </v-chip>
                                    <v-spacer />
                                    <span class="text-caption">
                                        {{ t('ai_prompt_leave_empty') }}
                                    </span>
                                </div>
                                <p
                                    v-if="draftEmptyVars.length"
                                    class="prompt-warn"
                                >
                                    <v-icon size="14">
                                        mdi-alert-circle-outline
                                    </v-icon>
                                    <span>{{ t('ai_prompt_var_empty') }}</span>
                                    <code
                                        v-for="name in draftEmptyVars"
                                        :key="name"
                                    >
                                        {{ tokenOf(name) }}
                                    </code>
                                </p>
                            </div>
                        </v-expand-transition>
                    </div>
                </template>

                <!-- ============ 自定义动作 ============ -->
                <template v-else>
                    <!-- 编辑表单 -->
                    <div v-if="editing" class="prompt-form">
                        <v-text-field
                            v-model="editing.name"
                            :label="t('ai_prompt_name')"
                            :placeholder="t('ai_prompt_name_placeholder')"
                            variant="outlined"
                            density="comfortable"
                            maxlength="20"
                            counter
                            hide-details="auto"
                            class="mb-4"
                        />

                        <div class="text-caption text-medium-emphasis mb-2">
                            {{ t('ai_prompt_icon') }}
                        </div>
                        <div class="d-flex flex-wrap ga-1 mb-4">
                            <v-btn
                                v-for="icon in ICONS"
                                :key="icon"
                                :color="
                                    editing.icon === icon
                                        ? 'primary'
                                        : undefined
                                "
                                :variant="
                                    editing.icon === icon ? 'flat' : 'text'
                                "
                                size="small"
                                icon
                                @click="editing.icon = icon"
                            >
                                <v-icon size="20">{{ icon }}</v-icon>
                            </v-btn>
                        </div>

                        <template v-if="scope === 'article'">
                            <div class="text-caption text-medium-emphasis mb-2">
                                {{ t('ai_prompt_format') }}
                            </div>
                            <v-btn-toggle
                                v-model="editing.format"
                                density="comfortable"
                                variant="outlined"
                                divided
                                class="mb-4"
                            >
                                <v-btn value="text" size="small">
                                    {{ t('ai_prompt_format_text') }}
                                </v-btn>
                                <v-btn value="html" size="small">
                                    {{ t('ai_prompt_format_html') }}
                                </v-btn>
                            </v-btn-toggle>
                            <p
                                v-if="editing.format === 'html'"
                                class="text-caption text-medium-emphasis mb-4"
                            >
                                {{ t('ai_prompt_html_hint') }}
                            </p>
                        </template>

                        <v-textarea
                            ref="promptInputRef"
                            v-model="editing.prompt"
                            :label="t('ai_prompt_template')"
                            :placeholder="t('ai_prompt_template_placeholder')"
                            variant="outlined"
                            density="comfortable"
                            rows="5"
                            auto-grow
                            hide-details="auto"
                            class="mb-2"
                        />
                        <div
                            class="d-flex align-center flex-wrap ga-1 text-caption text-medium-emphasis"
                        >
                            <span>{{ t('ai_prompt_vars') }}</span>
                            <v-chip
                                v-for="chip in chipsFor(customVarList)"
                                :key="chip.name"
                                size="x-small"
                                variant="tonal"
                                :title="t(chip.hint)"
                                @click="insertVar(chip.name)"
                            >
                                {{ tokenOf(chip.name) }}
                            </v-chip>
                            <span class="ml-1">
                                {{ t('ai_prompt_vars_hint') }}
                            </span>
                        </div>
                        <p v-if="customEmptyVars.length" class="prompt-warn">
                            <v-icon size="14">mdi-alert-circle-outline</v-icon>
                            <span>{{ t('ai_prompt_var_empty') }}</span>
                            <code v-for="name in customEmptyVars" :key="name">
                                {{ tokenOf(name) }}
                            </code>
                        </p>

                        <v-alert
                            v-if="formError"
                            type="warning"
                            variant="tonal"
                            density="compact"
                            class="mt-4"
                        >
                            {{ formError }}
                        </v-alert>

                        <div class="d-flex justify-end ga-2 mt-4">
                            <v-btn variant="text" @click="cancelEdit">
                                {{ t('cancel') }}
                            </v-btn>
                            <v-btn
                                color="primary"
                                variant="flat"
                                @click="saveCustom"
                            >
                                {{ t('ai_prompt_save') }}
                            </v-btn>
                        </div>
                    </div>

                    <!-- 列表 -->
                    <template v-else>
                        <div
                            v-if="!config.customs.length"
                            class="prompt-empty text-medium-emphasis"
                        >
                            <v-icon size="28" class="mb-2">
                                mdi-text-box-plus-outline
                            </v-icon>
                            <div class="text-body-2">
                                {{ t('ai_prompt_empty') }}
                            </div>
                        </div>

                        <div
                            v-for="item in config.customs"
                            :key="item.id"
                            class="prompt-row"
                        >
                            <div class="d-flex align-center ga-2">
                                <v-icon size="18" color="primary">
                                    {{ item.icon }}
                                </v-icon>
                                <span class="text-body-2">{{ item.name }}</span>
                                <v-chip
                                    v-if="item.format === 'html'"
                                    size="x-small"
                                    variant="tonal"
                                >
                                    HTML
                                </v-chip>
                                <v-spacer />
                                <v-switch
                                    :model-value="item.enabled"
                                    color="primary"
                                    density="compact"
                                    hide-details
                                    class="flex-grow-0"
                                    :aria-label="t('ai_prompt_enabled')"
                                    @update:model-value="
                                        value => toggleCustom(item, value)
                                    "
                                />
                                <v-btn
                                    size="x-small"
                                    variant="text"
                                    icon="mdi-pencil-outline"
                                    :aria-label="t('ai_prompt_edit')"
                                    @click="startEditCustom(item)"
                                />
                                <v-btn
                                    size="x-small"
                                    variant="text"
                                    icon="mdi-delete-outline"
                                    :aria-label="t('ai_prompt_delete')"
                                    @click="pendingDelete = item"
                                />
                            </div>
                            <p class="prompt-preview">
                                {{ item.prompt }}
                            </p>
                        </div>

                        <v-btn
                            class="mt-3"
                            color="primary"
                            variant="tonal"
                            prepend-icon="mdi-plus"
                            block
                            @click="startAdd"
                        >
                            {{ t('ai_prompt_add') }}
                        </v-btn>
                    </template>
                </template>
            </v-card-text>

            <v-divider />
            <v-card-actions class="px-4 py-3">
                <v-btn
                    v-if="hasCustomization(scope)"
                    variant="text"
                    color="warning"
                    prepend-icon="mdi-restore"
                    @click="confirmReset = true"
                >
                    {{ t('ai_prompt_reset_all') }}
                </v-btn>
                <v-spacer />
                <v-btn variant="text" @click="close">{{ t('cancel') }}</v-btn>
            </v-card-actions>
        </v-card>

        <!-- 删除确认 -->
        <v-dialog
            :model-value="!!pendingDelete"
            max-width="400"
            @update:model-value="pendingDelete = null"
        >
            <v-card>
                <v-card-title class="text-body-1 pt-4">
                    {{ t('ai_prompt_delete_confirm') }}
                </v-card-title>
                <v-card-text class="text-body-2 text-medium-emphasis">
                    {{ pendingDelete?.name }}
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="pendingDelete = null">
                        {{ t('cancel') }}
                    </v-btn>
                    <v-btn color="error" variant="flat" @click="doDelete">
                        {{ t('ai_prompt_delete') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 全部恢复默认 -->
        <v-dialog v-model="confirmReset" max-width="400">
            <v-card>
                <v-card-title class="text-body-1 pt-4">
                    {{ t('ai_prompt_reset_confirm') }}
                </v-card-title>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="confirmReset = false">
                        {{ t('cancel') }}
                    </v-btn>
                    <v-btn color="warning" variant="flat" @click="resetAll">
                        {{ t('ai_prompt_restore') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-dialog>
</template>

<style scoped>
    .prompt-panel {
        border: 1px solid rgba(var(--v-theme-primary), 0.18);
    }

    .prompt-row {
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
        margin-bottom: 8px;
    }

    /* 提示词可能很长，列表里只给三行，看全文去编辑页 */
    .prompt-preview {
        margin: 6px 0 0;
        font-size: 12px;
        line-height: 1.6;
        opacity: 0.6;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .prompt-empty {
        padding: 28px 0;
        text-align: center;
    }

    /* 写了拿不到值的占位符：提示要显眼但不打断编辑 */
    .prompt-warn {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px;
        margin: 6px 0 0;
        font-size: 12px;
        line-height: 1.6;
        color: rgb(var(--v-theme-warning));
    }

    .prompt-warn code {
        padding: 0 4px;
        border-radius: 4px;
        background: rgba(var(--v-theme-warning), 0.12);
        font-size: 11px;
    }

    .prompt-form {
        padding: 4px 2px;
    }
</style>
