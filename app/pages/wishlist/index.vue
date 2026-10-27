<script setup lang="ts">
    import type { ConfirmDialog } from '#components'

    definePageMeta({ middleware: 'auth' })

    const { t } = useLocale()

    useSeoMeta({
        title: computed(() => t('wishlist')),
        ogTitle: computed(() => t('wishlist')),
    })

    const { getWishList, addWish, updateWish, delWish } = useWish()
    const { show } = useToast()
    const { formatNow } = useDayjs()
    const { soundTick } = useSound()
    const { rules } = useRules()

    const confirmRef = ref<InstanceType<typeof ConfirmDialog>>()

    // key 用 wishlist 而不是 wish：user/[id].vue 的「想做的事」预览也用 wish，
    // 两个页面 handler 不同却撞在同一个 key 上，会互相串数据（dev 下还会报 NUXT_E3004）
    const { data } = await useAsyncData('wishlist', () =>
        getWishList({ pagesize: 1000, order: '-create_time' })
    )

    const wishes = ref<Wish[]>(data.value?.results ?? [])

    // 按完成状态分区展示（取代筛选切换）：未完成为便签网格，已完成为安静清单
    const pendingList = computed(() => wishes.value.filter(w => !w.completed))
    const completedList = computed(() => wishes.value.filter(w => w.completed))
    const pendingCount = computed(() => pendingList.value.length)
    const completedCount = computed(() => completedList.value.length)

    // 新增 / 编辑对话框
    const dialog = ref(false)
    const editingId = ref<number | null>(null)
    const saving = ref(false)
    const formRef = useTemplateRef('formRef')
    const form = reactive({ title: '', content: '' })

    const openAdd = () => {
        editingId.value = null
        form.title = ''
        form.content = ''
        dialog.value = true
    }

    const openEdit = (w: Wish) => {
        editingId.value = w.id
        form.title = w.title
        form.content = w.content ?? ''
        dialog.value = true
    }

    const submit = async () => {
        if (!formRef.value) return
        const { valid } = await formRef.value.validate()
        if (!valid) return

        saving.value = true
        try {
            if (editingId.value == null) {
                const rec = await addWish({
                    title: form.title,
                    content: form.content,
                })
                if (rec?.id != null) wishes.value.unshift(rec)
                show(t('wish_create_success'), 'success')
            } else {
                const rec = await updateWish(editingId.value, {
                    title: form.title,
                    content: form.content,
                })
                const idx = wishes.value.findIndex(
                    w => w.id === editingId.value
                )
                if (idx !== -1 && rec) wishes.value[idx] = rec
                show(t('wish_update_success'), 'success')
            }
            dialog.value = false
        } finally {
            saving.value = false
        }
    }

    // 切换完成状态：乐观更新 + PATCH
    const toggleComplete = async (w: Wish) => {
        const next = !w.completed
        const prevTime = w.complete_time
        w.completed = next
        w.complete_time = next ? new Date().toISOString() : null
        soundTick()
        try {
            const rec = await updateWish(w.id, { completed: next })
            if (rec) Object.assign(w, rec)
        } catch {
            // 失败回滚
            w.completed = !next
            w.complete_time = prevTime
        }
    }

    const handleDel = async (id: number) => {
        if (!confirmRef.value) return
        const confirmed = await confirmRef.value.open('del_wish')
        if (!confirmed) return
        try {
            await delWish(id)
            wishes.value = wishes.value.filter(w => w.id !== id)
            show(t('wish_delete_success'), 'success')
        } catch {
            // 失败提示由 useHttp 统一处理
        }
    }
</script>

<template>
    <v-container class="max-w-4xl px-4 px-sm-6 py-6 py-sm-10">
        <!-- 标题栏 -->
        <header
            class="page-hero anim anim-slide-down d-flex align-center justify-space-between"
        >
            <div>
                <p class="page-hero__eyebrow">✦ Kotae</p>
                <h1 class="text-h4 page-hero__title">
                    <span class="k-highlight">{{ t('wishlist') }}</span>
                </h1>
            </div>
            <v-btn
                color="primary"
                prepend-icon="mdi-plus"
                rounded="pill"
                variant="flat"
                @click="openAdd"
            >
                {{ t('wish_add') }}
            </v-btn>
        </header>

        <!-- 还没去做：便签网格（视觉主体） -->
        <div class="d-flex align-center mb-4 mt-2">
            <span class="section-bar mr-3" aria-hidden="true"></span>
            <h2 class="text-h5 font-weight-bold">
                {{ t('wish_filter_pending') }}
            </h2>
            <span class="k-sticker-badge ml-3">{{ pendingCount }}</span>
        </div>

        <v-row v-if="pendingCount" class="stagger-up">
            <v-col v-for="w in pendingList" :key="w.id" cols="12">
                <v-card
                    class="k-card--sm hover-lift"
                    rounded="lg"
                    variant="flat"
                >
                    <v-list-item lines="two">
                        <template #prepend>
                            <v-checkbox-btn
                                :model-value="w.completed"
                                color="primary"
                                density="comfortable"
                                hide-details
                                @update:model-value="toggleComplete(w)"
                            />
                        </template>
                        <v-list-item-title
                            class="text-subtitle-1 font-weight-medium"
                        >
                            {{ w.title }}
                        </v-list-item-title>
                        <v-list-item-subtitle v-if="w.content">
                            {{ w.content }}
                        </v-list-item-subtitle>
                        <template #append>
                            <div class="d-flex align-center ga-1">
                                <span
                                    class="d-flex align-center ga-1 text-caption text-grey mr-2"
                                >
                                    <v-icon
                                        size="14"
                                        icon="mdi-clock-outline"
                                    />
                                    {{ formatNow(w.create_time) }}
                                </span>
                                <v-btn
                                    icon="mdi-pencil-outline"
                                    variant="text"
                                    size="small"
                                    :aria-label="t('wish_edit')"
                                    @click="openEdit(w)"
                                />
                                <v-btn
                                    icon="mdi-delete-outline"
                                    variant="text"
                                    size="small"
                                    color="error"
                                    :aria-label="t('del')"
                                    @click="handleDel(w.id)"
                                />
                            </div>
                        </template>
                    </v-list-item>
                </v-card>
            </v-col>
        </v-row>

        <!-- 全部完成的小彩蛋 -->
        <v-card
            v-else-if="wishes.length"
            class="k-card--sm text-center pa-8 anim anim-pop"
        >
            <p class="text-h6 mb-1">🎉</p>
            <p class="text-body-1 text-grey">
                {{ t('wish_empty_pending') }}
            </p>
        </v-card>

        <!-- 已经完成：安静的清单面板（弱化处理） -->
        <template v-if="completedCount">
            <div class="d-flex align-center mb-4 mt-10">
                <span class="section-bar mr-3" aria-hidden="true"></span>
                <h2 class="text-h5 font-weight-bold">
                    {{ t('wish_filter_completed') }}
                </h2>
                <span class="k-sticker-badge ml-3">{{ completedCount }}</span>
            </div>
            <v-card class="k-card">
                <v-list lines="two" class="stagger-up">
                    <v-list-item v-for="w in completedList" :key="w.id">
                        <template #prepend>
                            <v-checkbox-btn
                                :model-value="w.completed"
                                color="success"
                                density="comfortable"
                                hide-details
                                @update:model-value="toggleComplete(w)"
                            />
                        </template>
                        <v-list-item-title class="text-grey line-through">
                            {{ w.title }}
                        </v-list-item-title>
                        <v-list-item-subtitle v-if="w.content">
                            {{ w.content }}
                        </v-list-item-subtitle>
                        <template #append>
                            <div class="d-flex align-center ga-1">
                                <span
                                    class="d-flex align-center ga-1 text-caption text-grey mr-2"
                                >
                                    <v-icon
                                        size="14"
                                        icon="mdi-check-circle-outline"
                                    />
                                    {{
                                        formatNow(
                                            w.complete_time || w.update_time
                                        )
                                    }}
                                </span>
                                <v-btn
                                    icon="mdi-pencil-outline"
                                    variant="text"
                                    size="small"
                                    :aria-label="t('wish_edit')"
                                    @click="openEdit(w)"
                                />
                                <v-btn
                                    icon="mdi-delete-outline"
                                    variant="text"
                                    size="small"
                                    color="error"
                                    :aria-label="t('del')"
                                    @click="handleDel(w.id)"
                                />
                            </div>
                        </template>
                    </v-list-item>
                </v-list>
            </v-card>
        </template>

        <!-- 整张清单为空 -->
        <EmptyState v-if="!wishes.length" icon="" :title="t('wish_empty')">
            <v-btn
                color="primary"
                prepend-icon="mdi-plus"
                rounded="pill"
                variant="flat"
                class="mt-4"
                @click="openAdd"
            >
                {{ t('wish_add') }}
            </v-btn>
        </EmptyState>

        <!-- 新增 / 编辑对话框 -->
        <v-dialog v-model="dialog" max-width="480">
            <v-card class="k-card" rounded="lg">
                <v-card-title>
                    {{ editingId == null ? t('wish_add') : t('wish_edit') }}
                </v-card-title>
                <v-form ref="formRef" @submit.prevent="submit">
                    <v-card-text>
                        <v-text-field
                            v-model="form.title"
                            :label="t('title')"
                            :rules="rules.titleRules"
                            variant="outlined"
                            density="comfortable"
                            autofocus
                        />
                        <v-textarea
                            v-model="form.content"
                            :label="t('content')"
                            variant="outlined"
                            density="comfortable"
                            rows="3"
                            auto-grow
                            class="mt-2"
                        />
                    </v-card-text>
                    <v-card-actions>
                        <v-spacer />
                        <v-btn variant="text" @click="dialog = false">
                            {{ t('cancel') }}
                        </v-btn>
                        <v-btn
                            color="primary"
                            variant="flat"
                            :loading="saving"
                            @click="submit"
                        >
                            {{ t('confirm') }}
                        </v-btn>
                    </v-card-actions>
                </v-form>
            </v-card>
        </v-dialog>

        <ConfirmDialog ref="confirmRef" />
    </v-container>
</template>

<style scoped></style>
