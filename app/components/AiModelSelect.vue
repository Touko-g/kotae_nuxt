<script setup lang="ts">
    import type { AiModelInfo } from '#shared/types/ai'

    interface Props {
        modelValue: string
        models: AiModelInfo[]
        loading?: boolean
        disabled?: boolean
        /** builtin 表示上游列表没拿到，用的是内置清单 */
        source?: 'upstream' | 'builtin'
    }

    const props = defineProps<Props>()
    /**
     * 注意 v-autocomplete 清空搜索词时会 emit `null`，
     * 所以这里必须允许 null —— 由调用方决定「清空搜索」不等于「取消选择」。
     */
    const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()
    const { t } = useLocale()

    /** 列表还没回来时，至少把当前模型显示出来，不要空着 */
    const allModels = computed<AiModelInfo[]>(() => {
        if (props.models.length) return props.models
        return props.modelValue
            ? [{ id: props.modelValue, label: props.modelValue }]
            : []
    })

    /**
     * 匹配前先归一化：去掉空格 / 连字符 / 下划线 / 点。
     * 这样 `qwen flash`、`qwen_flash`、`qwen3.8` 都能命中 `qwen-flash` / `qwen3.8-max`。
     */
    const normalize = (value: unknown) =>
        String(value ?? '')
            .toLowerCase()
            .replace(/[\s_.\-/]/g, '')

    /** 用户当前敲进搜索框的内容 */
    const keyword = ref('')

    /** 当前模型的显示名：聚焦时 Vuetify 会自动把它填进搜索框，需要能区分出来 */
    const currentLabel = computed(
        () =>
            allModels.value.find(model => model.id === props.modelValue)
                ?.label ?? props.modelValue
    )

    /**
     * 过滤自己算，结果直接喂给 `:items`，和文章创建页的标签搜索是同一套思路。
     *
     * 为什么不用 `:custom-filter`：Vuetify 的过滤链路会拿 item 的**每个字段**
     * 各调一次过滤器，再按 filterMode 合并结果，行为不好预测；
     * 「输入 q 却提示没有匹配的模型」就是栽在这条链路上。
     * 改成自己算列表后，匹配规则完全由这里决定，可读也可测。
     *
     * 注意这是「包含匹配」：不分词、不打乱字符顺序、不纠错、不支持拼音。
     */
    const items = computed<AiModelInfo[]>(() => {
        const query = normalize(keyword.value)
        if (!query) return allModels.value
        return allModels.value.filter(model =>
            [model.id, model.label, model.desc].some(field =>
                normalize(field).includes(query)
            )
        )
    })

    /**
     * 只在用户真的在打字时才当成筛选条件。
     * 聚焦 / 选中之后 Vuetify 会把当前模型名写回搜索框，
     * 如果照单全收，下次打开菜单就只剩一条了。
     */
    const onSearch = (value?: string) => {
        const text = value ?? ''
        keyword.value = text && text !== currentLabel.value ? text : ''
    }

    const onSelect = (value: unknown) => {
        // 清空搜索词会走到这里并带 null，交给调用方去忽略
        emit('update:modelValue', (value as string | null) ?? null)
    }
</script>

<template>
    <div class="d-flex align-center ai-model-select">
        <v-icon size="15" color="primary" class="mr-1">mdi-chip</v-icon>
        <!--
            用 autocomplete 而不是 select：模型多了要能直接输入筛选。
            这里不加 #selection 插槽 —— 自定义插槽会和搜索输入抢显示位置，
            收起态的默认渲染本来就是「当前模型的 label」，够用了。
        -->
        <v-autocomplete
            :model-value="modelValue"
            :items="items"
            item-title="label"
            item-value="id"
            no-filter
            :loading="loading"
            :disabled="disabled"
            :placeholder="t('ai_model_filter')"
            :no-data-text="t('ai_model_empty')"
            :menu-props="{ maxHeight: 340 }"
            :auto-select-first="false"
            density="compact"
            variant="plain"
            hide-details
            :aria-label="t('ai_model')"
            @update:search="onSearch"
            @update:model-value="onSelect"
        >
            <template #item="{ props: itemProps, item }">
                <v-list-item v-bind="itemProps" :subtitle="item.raw?.desc" />
            </template>
        </v-autocomplete>

        <!-- 用的是内置清单时提醒一下，免得以为是账号真实可用的全部模型 -->
        <v-tooltip
            v-if="source === 'builtin'"
            :text="t('ai_model_builtin')"
            location="top"
        >
            <template #activator="{ props: tipProps }">
                <v-icon
                    v-bind="tipProps"
                    size="15"
                    color="warning"
                    class="ml-1"
                >
                    mdi-alert-circle-outline
                </v-icon>
            </template>
        </v-tooltip>
    </div>
</template>

<style scoped>
    .ai-model-select {
        max-width: 240px;
        min-width: 0;
        /* 窄屏要能缩，否则会把标题栏挤出去 */
        flex: 1 1 auto;
    }

    .ai-model-select :deep(.v-field__input) {
        padding-top: 0;
        padding-bottom: 0;
        min-height: 32px;
        padding-inline: 0;
    }

    /* 收起态看起来像一行文字，不要输入框的内边距 */
    .ai-model-select :deep(.v-field--variant-plain .v-field__field) {
        padding-inline-start: 0;
    }
</style>
