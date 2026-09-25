<script setup lang="ts">
    import type { ConfirmDialog } from '#components'

    definePageMeta({
        middleware: 'auth',
    })
    const { t } = useLocale()

    useSeoMeta({
        title: computed(() => t('photo_album')),
        ogTitle: computed(() => t('photo_album')),
    })

    const { getPhotoList, delPhoto } = usePhoto()
    const { show } = useSnackbar()
    const { format } = useDayjs()

    const currentUser = useCookie<User | null>('user')
    // 仅照片作者本人可删除
    const isOwner = (photo: Photo) =>
        String(photo.user_info.id) === String(currentUser.value?.id)

    const photos = ref<Photo[]>([])
    const loading = ref(false)
    const observer = ref<IntersectionObserver | null>(null)
    const scrollRef = useTemplateRef('scrollRef')
    const confirmRef = ref<InstanceType<typeof ConfirmDialog>>()

    const page = reactive({
        page: 1,
        pagesize: 8,
        count: 0,
    })

    // 图片预览：复用通用 ImageLightbox 组件（缩放/旋转/拖拽/键盘/轮播均在组件内实现）
    const lightboxVisible = ref(false)
    const lightboxIndex = ref(0)
    const lightboxImages = computed(() =>
        photos.value.map(p => ({ src: p.picture, caption: p.name }))
    )

    // 打开预览
    const openPreview = (index: number) => {
        lightboxIndex.value = index
        lightboxVisible.value = true
    }

    // 瀑布流：按索引循环取一组固定宽高比，制造错落节奏（确定性，SSR 安全）
    const ASPECTS = [0.8, 1, 1.33, 0.75, 1.2, 1, 0.85, 1.5]
    const aspectOf = (index: number) => ASPECTS[index % ASPECTS.length]

    // 初始化加载
    const { data } = await useAsyncData('photos', () =>
        getPhotoList({ ...page })
    )

    if (data.value?.results) {
        photos.value = data.value.results
        page.count = Math.ceil(data.value.count / page.pagesize)
    }

    const handleDel = async (id: number | string, index: number) => {
        if (!confirmRef.value) return

        const confirmed = await confirmRef.value.open('del_photo')
        if (!confirmed) return
        try {
            await delPhoto(id)
            photos.value.splice(index, 1) // 从数组中删除
            show(t('photo_delete_success'), 'success')
        } catch (err) {}
    }

    // 加载更多
    const loadPhotos = async () => {
        if (loading.value || page.page >= page.count) return
        loading.value = true
        page.page++
        const { results } = await getPhotoList({ ...page })
        if (results?.length) {
            photos.value.push(...results)
        }
        loading.value = false
    }

    // 监听加载更多
    onMounted(async () => {
        observer.value = new IntersectionObserver(
            async entries => {
                if (entries[0]?.isIntersecting) await loadPhotos()
            },
            { rootMargin: '100px' }
        )
        await nextTick()
        if (scrollRef.value) observer.value.observe(scrollRef.value)
    })

    watch(photos, async () => {
        await nextTick()
        if (scrollRef.value && observer.value)
            observer.value.observe(scrollRef.value)
    })

    onUnmounted(() => {
        observer.value?.disconnect()
    })
</script>

<template>
    <v-container class="max-w-5xl px-4 px-sm-6 py-6 py-sm-10">
        <header class="page-hero anim anim-slide-down">
            <p class="page-hero__eyebrow">✦ Kotae</p>
            <h1 class="text-h4 page-hero__title">
                <span class="k-highlight">{{ t('photo') }}</span>
            </h1>
        </header>
        <div class="stagger-up columns-2 gap-4 sm:columns-3 lg:columns-4">
            <div
                v-for="(photo, index) in photos"
                :key="photo.id"
                class="mb-4 break-inside-avoid"
            >
                <v-hover v-slot="{ isHovering, props }">
                    <v-img
                        v-bind="props"
                        :src="photo.picture"
                        cover
                        rounded="xl"
                        :aspect-ratio="aspectOf(index)"
                        :class="[
                            'transition-transform duration-300 ease-out cursor-pointer overflow-hidden',
                            isHovering ? 'scale-105' : 'scale-100',
                        ]"
                        lazy-src="https://chen-1302611521.cos.ap-nanjing.myqcloud.com/blog/photo/Touko/thumbbig-287318.webp"
                        data-cuelume-press
                        data-cuelume-release
                        @click="openPreview(index)"
                    >
                        <template #placeholder>
                            <div
                                class="d-flex align-center justify-center fill-height"
                            >
                                <v-progress-circular
                                    color="primary"
                                    size="60"
                                    indeterminate
                                ></v-progress-circular>
                            </div>
                        </template>
                        <!-- hover 蒙层 -->
                        <div
                            v-if="isHovering"
                            class="absolute inset-0 flex flex-col justify-between p-2"
                        >
                            <!-- 右上角信息 -->
                            <div
                                class="self-end bg-black/50 text-white p-1 rounded-md text-xs flex flex-col items-end space-y-0.5"
                            >
                                <div class="font-semibold truncate">
                                    {{ photo.name }}
                                </div>
                                <div>
                                    {{ t('by') }}
                                    {{ photo.user_info.username }}
                                </div>
                                <div class="text-[10px]">
                                    {{ format(photo.create_time) }}
                                </div>
                            </div>

                            <!-- 右下角删除按钮（仅作者可见） -->
                            <v-btn
                                v-if="isOwner(photo)"
                                class="self-end"
                                icon="mdi-trash-can-outline"
                                size="small"
                                @click.stop="handleDel(photo.id, index)"
                            />
                        </div>
                    </v-img>
                </v-hover>
            </div>
        </div>

        <EmptyState
            v-if="!photos.length"
            icon="mdi-image-outline"
            :title="t('no_photos')"
        />

        <div v-if="photos?.length" ref="scrollRef"></div>

        <div
            v-if="photos.length && !loading && page.page >= page.count"
            class="py-4 text-center text-grey"
        >
            {{ t('end_of_list') }}
        </div>

        <!-- 图片预览：复用通用 Lightbox -->
        <ImageLightbox
            v-model="lightboxVisible"
            :images="lightboxImages"
            :start="lightboxIndex"
        />
        <ConfirmDialog ref="confirmRef" />
    </v-container>
</template>

<style scoped></style>
