<script setup lang="ts">
    import type {
        AiAssistAction,
        AiBuiltinAction,
        AiPromptScope,
        AiPromptVarName,
    } from '#shared/types/ai'
    import { normalizeAiHtml } from '~/composables/useAiHtml'

    interface Props {
        modelValue: boolean
        /** 动作列表由调用方拼好（提示词里含原文） */
        actions: AiAssistAction[]
        /** 打开时默认执行的动作，缺省取第一个 */
        initialKey?: string
        /** 只读展示的原文 */
        sourceText?: string
        maxTokens?: number
        /** 当前场景：决定自定义提示词读写哪一份配置 */
        scope?: AiPromptScope
        /** 该场景的内置动作清单，传给提示词配置面板 */
        builtins?: AiBuiltinAction[]
        /** 自定义动作能用的占位符（场景级全集），不传由面板按 text/title 兜底 */
        customVars?: AiPromptVarName[]
        /**
         * 主按钮文案。默认是「应用」，因为多数场景要把结果写回编辑器；
         * 划词解释这类只读场景没有「应用」可言，传「复制」更贴切。
         */
        applyLabel?: string
    }

    const props = defineProps<Props>()
    const emit = defineEmits<{
        'update:modelValue': [value: boolean]
        apply: [result: string, key: string]
        /**
         * 提示词被改过：调用方需要重建 actions。
         * 面板不自己重跑请求 —— 用户只是改了个提示词，不该立刻花掉一次额度。
         */
        'prompts-changed': []
    }>()

    const { t } = useLocale()
    const { show } = useToast()

    const { content, error, pending, streaming, askStream, abort, clear } =
        useAI({
            keepHistory: false,
        })

    /**
     * 「反问我」的第二轮：用户说出疑问后请模型解答。
     *
     * 单独一个实例而不是复用上面那个：第一轮的 content 是 AI 的提问、第二轮的
     * content 是解答，共用一个 ref 的话，提交的瞬间提问就从屏幕上消失了；两段
     * 流式的 abort/pending 也会互相踩。拆开之后两轮的显示与中断互不干扰。
     *
     * keepHistory 仍然是 false —— 第二轮的提示词里已经把原文、提问、疑问
     * 全带上了，不依赖对话历史。这样「重新解答」「中断重来」都不会因为上下文
     * 错位而串味。
     */
    const {
        content: verdict,
        error: verdictError,
        pending: verdictPending,
        streaming: verdictStreaming,
        askStream: askVerdict,
        abort: abortVerdict,
        clear: clearVerdict,
    } = useAI({ keepHistory: false })

    /** 用户的疑问。上限比正文选区的 maxLength 小得多：这是自己的话，不是抄原文 */
    const MAX_ANSWER = 600
    const answer = ref('')

    const resetSocratic = () => {
        abortVerdict()
        clearVerdict()
        answer.value = ''
    }

    // 模型列表 / 用量 / 当前选中的模型（cookie 持久化）
    const {
        models,
        source,
        selected,
        loading: modelsLoading,
        quota,
        credential,
        credentialLoading,
        configured,
        load: loadModels,
        loadQuota,
        loadCredential,
        formatTokens,
    } = useAiModels()

    /** Key 配置面板：未配置时由面板内的提示直接拉起 */
    const credentialOpen = ref(false)
    const loggedIn = useAiClient().isLogin

    /** 提示词配置面板：调用方传了 scope + builtins 才开放 */
    const promptOpen = ref(false)
    const canCustomize = computed(
        () => !!props.scope && !!props.builtins?.length
    )

    /**
     * 配置面板开关。关掉时通知调用方重建 actions —— 提示词换了，面板里的
     * prompt 得跟着换。但绝不自动重跑：改配置不该顺手烧掉一次额度。
     */
    const onPromptToggle = (value: boolean) => {
        promptOpen.value = value
        if (!value) emit('prompts-changed')
    }

    const onCredentialSaved = async () => {
        await loadCredential()
        loadModels()
        loadQuota()
    }

    /** 官方额度没有 API，拿不到 quota 时也给一个控制台入口 */
    const consoleUrl = computed(
        () =>
            quota.value?.consoleUrl ??
            'https://bailian.console.aliyun.com/cn-beijing/costing-balance/free-quota'
    )

    const activeKey = ref(props.initialKey ?? props.actions[0]?.key ?? '')

    const activeAction = computed(
        () =>
            props.actions.find(action => action.key === activeKey.value) ??
            props.actions[0]
    )

    /** 当前动作是不是「反问我」这种两段式交互 */
    const isSocratic = computed(() => activeAction.value?.kind === 'socratic')

    /** 解答已经出现过（含流式中）：按钮文案据此在「提交」和「重新解答」之间切 */
    const hasVerdict = computed(
        () => !!verdict.value || verdictStreaming.value || !!verdictError.value
    )

    const busy = computed(() => pending.value || streaming.value)

    /** 当前动作产出富文本时，预览按 HTML 渲染（文章排版），否则按纯文本显示 */
    const isHtml = computed(() => activeAction.value?.format === 'html')

    // 预览走和应用完全同一条管线：这样「代码块 / 围栏」看到的就是落进正文的样子
    const richHtml = computed(() =>
        isHtml.value ? normalizeAiHtml(content.value) : ''
    )

    const run = async () => {
        if (!activeAction.value) return
        // AI 能力必须登录后才能用：未登录时先提示，别去撞 401
        if (!loggedIn.value) {
            show(t('ai_need_login'), 'warning')
            return
        }
        // 没配 Key 就别发请求了，直接把配置面板拉起来
        if (!configured.value) {
            credentialOpen.value = true
            return
        }
        // 重新提问（或换动作）意味着上一轮的疑问作废，解答也一起清掉
        resetSocratic()
        clear()
        await askStream(activeAction.value.prompt, {
            maxTokens: props.maxTokens ?? 1200,
            // 没选到模型就不传，交给服务端默认值
            model: selected.value || undefined,
        })
        // 每次生成后刷新用量（官方额度查不到，但我们自己的账要准）
        loadQuota()
    }

    /**
     * 提交疑问，请模型解答。
     *
     * 第一轮还在流式时不给提交：这时 content 只是半句提问，拿它当「AI 的提问」
     * 拼进第二轮，模型会对着一个残句作答。
     */
    const submitAnswer = async () => {
        const action = activeAction.value
        const text = answer.value.trim()
        if (!action || !content.value || busy.value) return
        if (!text) {
            show(t('ai_answer_empty'), 'warning')
            return
        }
        // 没有 evaluatePrompt 的动作不该走到这里；兜底用面板自己的模板，
        // 免得点了「提交」什么都不发生
        const prompt = action.evaluatePrompt
            ? action.evaluatePrompt(content.value, text)
            : `下面是一段原文、一个关于它的提问，以及我的疑问。请解答我的疑问，如果我的问法里有理解偏差就顺手指出来，200 字以内。\n\n【原文】\n${props.sourceText ?? ''}\n\n【你的提问】\n${content.value}\n\n【我的疑问】\n${text}`

        clearVerdict()
        await askVerdict(prompt, {
            maxTokens: props.maxTokens ?? 1200,
            model: selected.value || undefined,
        })
        loadQuota()
    }

    /**
     * 换模型。
     *
     * 两个必须守住的点：
     * 1. 清空筛选输入框时 v-autocomplete 会 emit null —— 那只是搜索词被清掉了，
     *    不能当成「取消选择」，否则模型会悄悄退回服务端默认值。
     * 2. 不要自动重跑。换模型时自动发一次请求，等于用户没点任何东西就花了额度，
     *    而且流式输出会把已有结果冲掉。这里只清空结果，让用户自己点「开始生成」。
     */
    const onModelChange = (value?: string | null) => {
        if (!value || value === selected.value) return
        selected.value = value
        if (content.value) clear()
    }

    /** 切换动作：中断当前请求，清空结果，重新生成 */
    const select = (key: string) => {
        if (key === activeKey.value && (content.value || busy.value)) return
        abort()
        activeKey.value = key
        run()
    }

    watch(
        () => props.modelValue,
        async open => {
            if (!open) {
                abort()
                abortVerdict()
                return
            }
            activeKey.value = props.initialKey ?? props.actions[0]?.key ?? ''
            // 重新打开等于新的一题，上一轮的作答和评价都不该留着
            resetSocratic()
            // 先确认有没有 Key：没有就别发请求，直接引导去配置
            await loadCredential()
            if (!configured.value) return

            // 面板第一次打开才拉模型列表和用量，平时不占请求
            loadModels()
            loadQuota()
            nextTick(run)
        }
    )

    const close = () => emit('update:modelValue', false)

    const apply = () => {
        if (!content.value.trim()) return
        emit('apply', content.value, activeKey.value)
        close()
    }

    /**
     * 复制的内容随场景变：普通动作只复制结果；
     * 「反问我」复制的是完整的一问一答（提问 + 我的疑问 + 解答），
     * 只留解答的话，粘出去的人看不懂在回答什么。
     */
    const copyPayload = computed(() => {
        if (!isSocratic.value) return content.value
        return [content.value, answer.value.trim(), verdict.value]
            .filter(Boolean)
            .join('\n\n')
    })

    const copy = async () => {
        if (!copyPayload.value) return
        try {
            await navigator.clipboard.writeText(copyPayload.value)
            show(t('ai_copied'), 'success')
        } catch {
            show(t('ai_copy_failed'), 'error')
        }
    }

    onBeforeUnmount(() => {
        abort()
        abortVerdict()
    })
</script>

<template>
    <v-dialog
        :model-value="modelValue"
        max-width="720"
        scrollable
        @update:model-value="emit('update:modelValue', $event)"
    >
        <v-card class="ai-panel">
            <v-card-title class="d-flex align-center ga-2 py-4">
                <v-icon color="primary">mdi-auto-fix</v-icon>
                <span class="text-h6">{{ t('ai_assist') }}</span>
                <AiModelSelect
                    :model-value="selected"
                    :models="models"
                    :loading="modelsLoading"
                    :source="source"
                    :disabled="busy"
                    class="ml-2"
                    @update:model-value="onModelChange"
                />
                <v-spacer />
                <v-btn
                    v-if="canCustomize"
                    icon="mdi-text-box-edit-outline"
                    size="small"
                    variant="text"
                    :aria-label="t('ai_prompt_settings')"
                    @click="promptOpen = true"
                />
                <v-btn
                    icon="mdi-key-variant"
                    size="small"
                    variant="text"
                    :aria-label="t('ai_settings')"
                    @click="credentialOpen = true"
                />
                <v-btn
                    icon="mdi-close"
                    size="small"
                    variant="text"
                    :aria-label="t('cancel')"
                    @click="close"
                />
            </v-card-title>
            <v-divider />

            <v-card-text class="pt-4">
                <!-- 未登录：AI 按用户自己的 key 计费，必须先登录 -->
                <v-alert
                    v-if="!loggedIn"
                    type="warning"
                    variant="tonal"
                    density="comfortable"
                    class="mb-4"
                >
                    {{ t('ai_need_login') }}
                </v-alert>
                <!-- 没配 Key 时不发请求，直接引导配置 -->
                <v-alert
                    v-else-if="!credentialLoading && !configured"
                    type="info"
                    variant="tonal"
                    density="comfortable"
                    class="mb-4"
                >
                    <div class="d-flex align-center flex-wrap ga-2">
                        <span class="text-body-2">
                            {{ t('ai_need_key_desc') }}
                        </span>
                        <v-btn
                            size="small"
                            color="primary"
                            variant="flat"
                            prepend-icon="mdi-key-variant"
                            @click="credentialOpen = true"
                        >
                            {{ t('ai_go_settings') }}
                        </v-btn>
                    </div>
                </v-alert>
                <div class="d-flex flex-wrap ga-2 mb-4">
                    <v-chip
                        v-for="action in actions"
                        :key="action.key"
                        :color="
                            action.key === activeKey ? 'primary' : undefined
                        "
                        :variant="action.key === activeKey ? 'flat' : 'tonal'"
                        size="small"
                        @click="select(action.key)"
                    >
                        <v-icon start size="15">{{ action.icon }}</v-icon>
                        {{ action.label }}
                    </v-chip>
                </div>

                <div
                    class="d-flex align-center ga-2 mb-4 text-caption text-medium-emphasis"
                >
                    <span v-if="quota">
                        <v-icon size="13" class="mr-1">
                            mdi-chart-timeline-variant
                        </v-icon>
                        {{ t('ai_usage_today') }}
                        {{ quota.today.requests }} ·
                        {{ formatTokens(quota.today.totalTokens) }} tokens
                    </span>
                    <v-spacer />
                    <a
                        :href="consoleUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="ai-console-link"
                    >
                        {{ t('ai_quota_console') }}
                        <v-icon size="12">mdi-open-in-new</v-icon>
                    </a>
                </div>

                <v-expansion-panels variant="accordion" class="mb-4">
                    <v-expansion-panel
                        v-if="sourceText"
                        :title="t('ai_source')"
                    >
                        <v-expansion-panel-text>
                            <div class="ai-source">{{ sourceText }}</div>
                        </v-expansion-panel-text>
                    </v-expansion-panel>
                    <!--
                        实际发出去的提示词。占位符有没有被替换、当前动作到底用了
                        哪一版模板，看这里一眼就知道 —— 排查「改了提示词没生效」
                        时不用再去猜是哪一环。
                    -->
                    <v-expansion-panel :title="t('ai_prompt_actual')">
                        <v-expansion-panel-text>
                            <div class="ai-source">
                                {{ activeAction?.prompt }}
                            </div>
                        </v-expansion-panel-text>
                    </v-expansion-panel>
                </v-expansion-panels>

                <!--
                    「反问我」是三段式：AI 提问 → 我的疑问 → 解答。
                    三段各自独立成块，因为用户在任何一段都可能停下来 ——
                    看了提问还没写疑问，也是这个动作的合法中间态。
                -->
                <div v-if="isSocratic" class="ai-socratic">
                    <div class="ai-step-block">
                        <span class="ai-step-label">
                            {{ t('ai_question_label') }}
                        </span>
                        <div class="ai-output">
                            <template v-if="error">
                                <span class="text-error">{{ error }}</span>
                            </template>
                            <template v-else-if="content">
                                <span class="ai-output__text">{{
                                    content
                                }}</span>
                                <span v-if="streaming" class="ai-caret" />
                            </template>
                            <template v-else-if="busy">
                                <span class="text-medium-emphasis">
                                    {{ t('ai_thinking') }}
                                </span>
                                <span class="ai-caret" />
                            </template>
                            <span v-else class="text-medium-emphasis">
                                {{ t('ai_result_empty') }}
                            </span>
                        </div>
                    </div>

                    <div class="ai-step-block">
                        <span class="ai-step-label">
                            {{ t('ai_answer_label') }}
                        </span>
                        <textarea
                            v-model="answer"
                            class="ai-answer"
                            rows="4"
                            :maxlength="MAX_ANSWER"
                            :placeholder="t('ai_answer_placeholder')"
                            :disabled="busy || verdictStreaming"
                        />
                        <div class="ai-answer__bar">
                            <span class="text-caption text-medium-emphasis">
                                {{ answer.length }} / {{ MAX_ANSWER }}
                            </span>
                            <v-spacer />
                            <v-btn
                                size="small"
                                color="primary"
                                variant="flat"
                                :disabled="
                                    !content ||
                                    busy ||
                                    verdictStreaming ||
                                    !answer.trim()
                                "
                                :loading="verdictPending || verdictStreaming"
                                @click="submitAnswer"
                            >
                                {{
                                    hasVerdict
                                        ? t('ai_re_evaluate')
                                        : t('ai_answer_submit')
                                }}
                            </v-btn>
                        </div>
                    </div>

                    <div v-if="hasVerdict" class="ai-step-block">
                        <span class="ai-step-label">
                            {{ t('ai_verdict_label') }}
                        </span>
                        <div class="ai-output">
                            <template v-if="verdictError">
                                <span class="text-error">{{
                                    verdictError
                                }}</span>
                            </template>
                            <template v-else>
                                <span class="ai-output__text">{{
                                    verdict
                                }}</span>
                                <span
                                    v-if="verdictStreaming"
                                    class="ai-caret"
                                />
                            </template>
                        </div>
                    </div>
                </div>

                <div v-else class="ai-output">
                    <template v-if="error">
                        <span class="text-error">{{ error }}</span>
                    </template>
                    <template v-else-if="content">
                        <!-- eslint-disable vue/no-v-html -- richHtml 已过 DOMPurify 白名单 -->
                        <div
                            v-if="isHtml"
                            class="ai-output__rich"
                            v-html="richHtml"
                        ></div>
                        <!-- eslint-enable vue/no-v-html -->
                        <span v-else class="ai-output__text">{{
                            content
                        }}</span>
                        <span v-if="streaming" class="ai-caret" />
                    </template>
                    <template v-else-if="busy">
                        <span class="text-medium-emphasis">
                            {{ t('ai_thinking') }}
                        </span>
                        <span class="ai-caret" />
                    </template>
                    <span v-else class="text-medium-emphasis">
                        {{ t('ai_result_empty') }}
                    </span>
                </div>
            </v-card-text>

            <v-divider />
            <v-card-actions class="px-4 py-3">
                <v-btn
                    v-if="streaming || verdictStreaming"
                    variant="text"
                    prepend-icon="mdi-stop"
                    @click="streaming ? abort() : abortVerdict()"
                >
                    {{ t('ai_stop') }}
                </v-btn>
                <v-btn
                    v-else
                    variant="text"
                    prepend-icon="mdi-refresh"
                    :loading="pending"
                    :disabled="!activeAction"
                    @click="run"
                >
                    <!-- 反问我里「重新生成」的含义是换一个切入点再问，不是重新解答 -->
                    <template v-if="isSocratic">
                        {{ t('ai_ask_another') }}
                    </template>
                    <template v-else>
                        {{ content ? t('ai_regenerate') : t('ai_generate') }}
                    </template>
                </v-btn>
                <v-btn
                    v-if="content"
                    variant="text"
                    prepend-icon="mdi-content-copy"
                    @click="copy"
                >
                    {{ t('ai_copy') }}
                </v-btn>
                <v-spacer />
                <v-btn variant="text" @click="close">{{ t('cancel') }}</v-btn>
                <!--
                    反问我没有「应用」这回事：结果是解答，不是要写回正文的内容。
                    留一个不可用的主按钮只会让人反复去点。
                -->
                <v-btn
                    v-if="!isSocratic"
                    color="primary"
                    variant="flat"
                    :disabled="!content || busy"
                    @click="apply"
                >
                    {{ applyLabel || t('ai_apply') }}
                </v-btn>
            </v-card-actions>
        </v-card>

        <!-- Key 配置面板：保存后重新拉凭据/模型/用量 -->
        <AiCredentialDialog
            v-model="credentialOpen"
            :credential="credential"
            @saved="onCredentialSaved"
        />

        <!-- 提示词配置：保存即通知调用方重建 actions，不等关闭面板 -->
        <AiPromptDialog
            v-if="scope && builtins"
            :model-value="promptOpen"
            :scope="scope"
            :builtins="builtins"
            :custom-vars="customVars"
            @update:model-value="onPromptToggle"
            @changed="emit('prompts-changed')"
        />
    </v-dialog>
</template>

<style scoped>
    .ai-panel {
        border: 1px solid rgba(var(--v-theme-primary), 0.18);
    }

    .ai-source {
        max-height: 160px;
        overflow-y: auto;
        white-space: pre-wrap;
        font-size: 13px;
        line-height: 1.7;
        opacity: 0.8;
    }

    /* 官方额度只能去控制台看，这里只留一个不抢眼的外链 */
    .ai-console-link {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        color: rgb(var(--v-theme-primary));
        text-decoration: none;
        opacity: 0.85;
    }

    .ai-console-link:hover {
        opacity: 1;
        text-decoration: underline;
    }

    .ai-output {
        min-height: 160px;
        max-height: 46vh;
        overflow-y: auto;
        padding: 14px 16px;
        border-radius: 12px;
        background: rgba(var(--v-theme-primary), 0.05);
        border: 1px dashed rgba(var(--v-theme-primary), 0.25);
        font-size: 15px;
        line-height: 1.85;
        white-space: pre-wrap;
        word-break: break-word;
    }

    .ai-output__text {
        white-space: pre-wrap;
    }

    /* ---------- 反问我：问题 / 我的回答 / 评价 ---------- */
    .ai-socratic {
        display: flex;
        flex-direction: column;
        gap: 14px;
    }

    .ai-step-block {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .ai-step-label {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        opacity: 0.55;
    }

    /* 三段各自 46vh 的话面板会高得离谱，这里按内容伸缩；
       问题与评价都可能长，超了各自滚 */
    .ai-socratic .ai-output {
        min-height: 0;
        max-height: 26vh;
    }

    .ai-answer {
        width: 100%;
        padding: 12px 14px;
        border: 1px solid rgba(var(--v-theme-primary), 0.3);
        border-radius: 12px;
        background: rgba(var(--v-theme-primary), 0.04);
        color: rgb(var(--v-theme-on-surface));
        font-family: inherit;
        font-size: 15px;
        line-height: 1.8;
        resize: vertical;
        transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
    }

    .ai-answer::placeholder {
        color: rgb(var(--v-theme-on-surface));
        opacity: 0.38;
    }

    .ai-answer:focus {
        outline: none;
        border-color: rgb(var(--v-theme-primary));
        box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.12);
    }

    .ai-answer:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .ai-answer__bar {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    /* 富文本预览：排版与文章正文保持一致的层级感 */
    .ai-output__rich {
        white-space: normal;
    }

    .ai-output__rich :deep(p) {
        margin: 0 0 10px;
    }

    .ai-output__rich :deep(h2) {
        font-size: 20px;
        font-weight: 700;
        margin: 16px 0 8px;
    }

    .ai-output__rich :deep(h3) {
        font-size: 17px;
        font-weight: 700;
        margin: 14px 0 6px;
    }

    .ai-output__rich :deep(h4) {
        font-size: 15px;
        font-weight: 700;
        margin: 12px 0 6px;
    }

    .ai-output__rich :deep(ul),
    .ai-output__rich :deep(ol) {
        margin: 0 0 10px;
        padding-left: 22px;
    }

    .ai-output__rich :deep(ul) {
        list-style: disc;
    }

    .ai-output__rich :deep(ol) {
        list-style: decimal;
    }

    .ai-output__rich :deep(li) {
        margin: 3px 0;
    }

    .ai-output__rich :deep(blockquote) {
        margin: 10px 0;
        padding-left: 12px;
        border-left: 3px solid rgba(var(--v-theme-primary), 0.6);
        opacity: 0.85;
    }

    .ai-output__rich :deep(pre) {
        margin: 10px 0;
        padding: 10px 12px;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.06);
        overflow-x: auto;
    }

    .ai-output__rich :deep(code) {
        font-family: 'Maple Mono CN', ui-monospace, monospace;
        font-size: 13px;
    }

    .ai-output__rich :deep(a) {
        color: rgb(var(--v-theme-primary));
        text-decoration: underline;
    }

    .ai-output__rich :deep(hr) {
        margin: 14px 0;
        border: 0;
        border-top: 1px solid rgba(var(--v-theme-primary), 0.25);
    }

    .ai-output__rich :deep(table) {
        border-collapse: collapse;
        margin: 10px 0;
    }

    .ai-output__rich :deep(th),
    .ai-output__rich :deep(td) {
        border: 1px solid rgba(0, 0, 0, 0.15);
        padding: 4px 10px;
    }

    /* 流式输出时的光标 */
    .ai-caret {
        display: inline-block;
        width: 2px;
        height: 1em;
        margin-left: 2px;
        vertical-align: text-bottom;
        background: rgb(var(--v-theme-primary));
        animation: ai-blink 1s steps(2, start) infinite;
    }

    @keyframes ai-blink {
        to {
            visibility: hidden;
        }
    }
</style>
