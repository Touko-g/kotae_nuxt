<script setup lang="ts">
    import type { ConfirmDialog } from '#components'
    import type { AiCredentialInfo } from '#shared/types/ai'

    /**
     * 用户自己的 API Key 配置面板。
     *
     * 密钥只往服务端发、从不回读：后端存的是密文，查询接口只回掩码。
     * 所以编辑时输入框永远是空的，占位符提示「已保存 xxx，留空表示不修改」。
     */

    interface Props {
        modelValue: boolean
        credential?: AiCredentialInfo | null
    }

    const props = defineProps<Props>()
    const emit = defineEmits<{
        'update:modelValue': [value: boolean]
        saved: []
    }>()

    const { t } = useLocale()
    const { show } = useToast()
    const client = useAiClient()

    const confirmRef = ref<InstanceType<typeof ConfirmDialog>>()

    const form = reactive({
        api_key: '',
        base_url: '',
        default_model: '',
    })
    const showKey = ref(false)
    const saving = ref(false)
    const removing = ref(false)
    const error = ref('')

    const configured = computed(() => !!props.credential?.configured)
    const masked = computed(() => props.credential?.api_key_masked ?? '')

    const reset = () => {
        form.api_key = ''
        form.base_url = props.credential?.base_url ?? ''
        form.default_model = props.credential?.default_model ?? ''
        error.value = ''
        showKey.value = false
    }

    watch(
        () => props.modelValue,
        open => {
            if (open) reset()
        }
    )

    const close = () => emit('update:modelValue', false)

    const save = async () => {
        const key = form.api_key.trim()
        if (!key && !configured.value) {
            error.value = t('ai_key_required')
            return
        }

        saving.value = true
        error.value = ''
        try {
            await $fetch(client.url('ai/credential/'), {
                method: 'PUT',
                headers: client.headers({
                    'Content-Type': 'application/json',
                }),
                body: {
                    // 留空表示沿用旧 key，不要传空串覆盖掉
                    api_key: key || undefined,
                    base_url: form.base_url.trim() || undefined,
                    default_model: form.default_model.trim() || undefined,
                },
            })
            show(t('ai_saved'), 'success')
            emit('saved')
            close()
        } catch (err: any) {
            error.value = parseAiError(err, t('ai_save_failed')).message
        } finally {
            saving.value = false
        }
    }

    const remove = async () => {
        const ok = await confirmRef.value?.open('ai_remove_confirm')
        if (!ok) return

        removing.value = true
        try {
            await $fetch(client.url('ai/credential/'), {
                method: 'DELETE',
                headers: client.headers(),
            })
            show(t('ai_removed'), 'success')
            emit('saved')
            close()
        } catch (err: any) {
            error.value = parseAiError(err, t('ai_save_failed')).message
        } finally {
            removing.value = false
        }
    }
</script>

<template>
    <v-dialog
        :model-value="modelValue"
        max-width="560"
        @update:model-value="emit('update:modelValue', $event)"
    >
        <v-card>
            <v-card-title class="d-flex align-center ga-2 py-4">
                <v-icon color="primary">mdi-key-variant</v-icon>
                <span class="text-h6">{{ t('ai_settings') }}</span>
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

            <v-card-text class="pt-4">
                <p class="text-caption text-medium-emphasis mb-4">
                    {{ t('ai_key_hint') }}
                </p>

                <v-text-field
                    v-model="form.api_key"
                    :label="t('ai_key')"
                    :type="showKey ? 'text' : 'password'"
                    :placeholder="
                        configured
                            ? t('ai_key_placeholder_saved', [masked])
                            : t('ai_key_placeholder')
                    "
                    :append-inner-icon="showKey ? 'mdi-eye-off' : 'mdi-eye'"
                    autocomplete="off"
                    density="comfortable"
                    variant="outlined"
                    :error-messages="error"
                    @click:append-inner="showKey = !showKey"
                />

                <v-expansion-panels variant="accordion">
                    <v-expansion-panel :title="t('ai_advanced')">
                        <v-expansion-panel-text>
                            <v-text-field
                                v-model="form.base_url"
                                :label="t('ai_base_url')"
                                :hint="t('ai_base_url_hint')"
                                persistent-hint
                                density="comfortable"
                                variant="outlined"
                                class="mb-4"
                            />
                            <v-text-field
                                v-model="form.default_model"
                                :label="t('ai_default_model')"
                                :hint="t('ai_default_model_hint')"
                                persistent-hint
                                density="comfortable"
                                variant="outlined"
                            />
                        </v-expansion-panel-text>
                    </v-expansion-panel>
                </v-expansion-panels>
            </v-card-text>

            <v-divider />
            <v-card-actions class="px-4 py-3">
                <v-btn
                    v-if="configured"
                    variant="text"
                    color="error"
                    prepend-icon="mdi-delete-outline"
                    :loading="removing"
                    @click="remove"
                >
                    {{ t('ai_remove') }}
                </v-btn>
                <v-spacer />
                <v-btn variant="text" @click="close">{{ t('cancel') }}</v-btn>
                <v-btn
                    color="primary"
                    variant="flat"
                    :loading="saving"
                    @click="save"
                >
                    {{ t('ai_save') }}
                </v-btn>
            </v-card-actions>
        </v-card>

        <ConfirmDialog ref="confirmRef" />
    </v-dialog>
</template>
