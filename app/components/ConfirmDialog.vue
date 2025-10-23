<script setup lang="ts">
    const { t } = useLocale()

    const visible = ref(false)
    const message = ref('')
    let resolveFn: (value: boolean) => void

    // 暴露方法给父组件调用
    defineExpose({
        open: (msg: string) => {
            message.value = msg
            visible.value = true
            return new Promise<boolean>(resolve => {
                resolveFn = resolve
            })
        },
    })

    const confirm = () => {
        visible.value = false
        resolveFn(true)
    }

    const cancel = () => {
        visible.value = false
        resolveFn(false)
    }
</script>

<template>
    <v-dialog
        v-model="visible"
        width="auto"
        persistent
        transition="dialog-bottom-transition"
    >
        <v-card>
            <!-- 标题 -->
            <v-card-title class="text-center text-lg font-semibold py-4">
                {{ t(message) }}
            </v-card-title>

            <!-- 按钮 -->
            <v-card-actions class="justify-end space-x-3 px-4 py-3">
                <v-btn text color="gray-500" @click="cancel">
                    {{ t('cancel') }}
                </v-btn>
                <v-btn color="primary" variant="flat" @click="confirm">
                    {{ t('confirm') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
