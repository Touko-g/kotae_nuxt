<script setup lang="ts">
    import type { ConfirmDialog } from '#components'

    definePageMeta({
        middleware: 'auth',
    })
    useSeoMeta({
        title: '摄影集',
        ogTitle: '摄影集',
    })

    const { getPhotoList, delPhoto } = usePhoto()
    const { show } = useSnakebar()
    const { format } = useDayjs()
    const { t } = useLocale()

    const photos = ref<Photo[]>([])
    const cols = ref<number[]>([])
    const loading = ref(false)
    const observer = ref<IntersectionObserver | null>(null)
    const scrollRef = useTemplateRef('scrollRef')
    const confirmRef = ref<InstanceType<typeof ConfirmDialog>>()

    const page = reactive({
        page: 1,
        pagesize: 3,
        count: 0,
    })

    // ✅ 图片预览
    const previewDialog = ref(false)
    const currentIndex = ref(0)

    // ✅ 缩放与拖拽控制
    const zoom = ref(1)
    const offset = reactive({ x: 0, y: 0 })
    const dragging = ref(false)
    const dragStart = reactive({ x: 0, y: 0 })
    const loadingImg = ref<boolean[]>([])

    // 打开预览
    const openPreview = (index: number) => {
        currentIndex.value = index
        previewDialog.value = true
    }

    // 关闭预览
    const closePreview = () => {
        previewDialog.value = false
    }

    // 图片加载动画
    const onImgLoad = (index: number) => {
        loadingImg.value[index] = false
    }

    // 鼠标滚轮缩放
    const handleWheel = (e: WheelEvent) => {
        e.preventDefault()
        if (e.deltaY < 0) zoom.value = Math.min(zoom.value + 0.2, 4)
        else zoom.value = Math.max(zoom.value - 0.2, 0.5)
    }

    // 放大/缩小/重置
    const zoomIn = () => (zoom.value = Math.min(zoom.value + 0.2, 4))
    const zoomOut = () => (zoom.value = Math.max(zoom.value - 0.2, 0.5))
    const resetZoom = () => {
        zoom.value = 1
        offset.x = 0
        offset.y = 0
    }

    // 拖拽逻辑
    const startDrag = (e: MouseEvent) => {
        if (zoom.value === 1) return
        dragging.value = true
        dragStart.x = e.clientX - offset.x
        dragStart.y = e.clientY - offset.y
    }
    const onDrag = (e: MouseEvent) => {
        if (!dragging.value || zoom.value === 1) return
        offset.x = e.clientX - dragStart.x
        offset.y = e.clientY - dragStart.y
    }
    const endDrag = () => {
        dragging.value = false
    }

    // 打开预览时初始化
    watch(previewDialog, val => {
        if (val) {
            zoom.value = 1
            offset.x = 0
            offset.y = 0
            loadingImg.value = photos.value.map(() => true)
        }
    })

    // 随机列宽
    const getRandomIntInclusive = (min: number, max: number): number =>
        Math.floor(Math.random() * (max - min + 1)) + min

    const generateCols = (length: number) => {
        const result: number[] = []
        let flag = false
        for (let i = 0; i < length; i++) {
            if (i % 5 === 0) {
                result.push(12)
            } else if (flag) {
                const random = getRandomIntInclusive(4, 8)
                result.push(random)
                flag = false
            } else {
                const prev = result[result.length - 1] ?? 6
                result.push(12 - prev)
                flag = true
            }
        }
        return result
    }

    // 初始化加载
    const { data } = await useAsyncData('photos', () =>
        getPhotoList({ ...page })
    )

    if (data.value?.results) {
        photos.value = data.value.results
        page.count = Math.ceil(data.value.count / page.pagesize)
        cols.value = generateCols(photos.value.length)
    }

    const handleDel = async (id: number | string, index: number) => {
        if (!confirmRef.value) return

        const confirmed = await confirmRef.value.open('del_photo')
        if (!confirmed) return
        try {
            await delPhoto(id)
            photos.value.splice(index, 1) // 从数组中删除
            cols.value = generateCols(photos.value.length)
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
            cols.value.push(...generateCols(results.length))
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

    onUnmounted(() => observer.value?.disconnect())
</script>

<template>
    <v-container class="max-w-5xl mx-auto px-4 py-10">
        <v-row>
            <v-col
                v-for="(photo, index) in photos"
                :key="photo.id"
                :cols="cols[index]"
            >
                <v-hover v-slot="{ isHovering, props }">
                    <v-img
                        v-bind="props"
                        :src="photo.picture"
                        cover
                        height="100%"
                        class="transition-all duration-300 cursor-pointer"
                        lazy-src="https://chen-1302611521.cos.ap-nanjing.myqcloud.com/blog/photo/Touko/thumbbig-287318.webp"
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
                                <div>by {{ photo.user_info.username }}</div>
                                <div class="text-[10px]">
                                    {{ format(photo.create_time) }}
                                </div>
                            </div>

                            <!-- 右下角删除按钮 -->
                            <v-btn
                                class="self-end"
                                icon="mdi-trash-can-outline"
                                size="small"
                                @click.stop="handleDel(photo.id, index)"
                            />
                        </div>
                    </v-img>
                </v-hover>
            </v-col>
        </v-row>

        <div v-if="photos?.length" ref="scrollRef"></div>

        <div
            v-if="!loading && page.page >= page.count"
            class="text-center text-gray-500 py-4"
        >
            已经到底啦～
        </div>

        <!-- ✅ 图片预览 Dialog -->
        <v-dialog
            v-model="previewDialog"
            fullscreen
            transition="dialog-bottom-transition"
            persistent
        >
            <v-card class="bg-black relative overflow-hidden">
                <v-toolbar dense flat color="black">
                    <v-btn
                        icon="mdi-close"
                        color="white"
                        @click="closePreview"
                    />
                    <v-spacer></v-spacer>
                    <div class="text-white text-sm pr-4">
                        {{ currentIndex + 1 }} / {{ photos.length }}
                    </div>
                </v-toolbar>

                <v-carousel
                    v-model="currentIndex"
                    hide-delimiters
                    show-arrows
                    height="80vh"
                >
                    <v-carousel-item v-for="(photo, i) in photos" :key="i">
                        <div
                            class="relative w-full h-full flex items-center justify-center bg-black overflow-hidden"
                            @wheel="handleWheel"
                            @mousedown="startDrag"
                            @mousemove="onDrag"
                            @mouseup="endDrag"
                            @mouseleave="endDrag"
                        >
                            <v-progress-circular
                                v-if="loadingImg[i]"
                                indeterminate
                                color="white"
                                size="64"
                                class="absolute"
                            />

                            <!-- ✅ 保证图片完整显示，按比例适应屏幕 -->
                            <v-img
                                :src="photo.picture"
                                class="select-none"
                                :style="{
                                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                                    transition: dragging
                                        ? 'none'
                                        : 'transform 0.25s ease',
                                    cursor:
                                        zoom > 1
                                            ? dragging
                                                ? 'grabbing'
                                                : 'grab'
                                            : 'default',
                                    'max-height': '80vh',
                                    'max-width': '90vw',
                                    'object-fit': 'contain',
                                    'user-select': 'none',
                                }"
                                @load="onImgLoad(i)"
                            />
                        </div>
                    </v-carousel-item>
                </v-carousel>

                <div
                    class="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-6 z-10"
                >
                    <v-btn
                        icon="mdi-magnify-minus-outline"
                        color="white"
                        @click="zoomOut"
                    />
                    <v-btn
                        icon="mdi-restore"
                        color="white"
                        @click="resetZoom"
                    />
                    <v-btn
                        icon="mdi-magnify-plus-outline"
                        color="white"
                        @click="zoomIn"
                    />
                </div>
            </v-card>
        </v-dialog>
        <ConfirmDialog ref="confirmRef" />
    </v-container>
</template>

<style scoped>
    .select-none {
        user-select: none;
        pointer-events: auto;
    }
</style>
