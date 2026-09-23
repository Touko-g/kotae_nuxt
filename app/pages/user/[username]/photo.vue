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

    // ✅ 图片预览
    const previewDialog = ref(false)
    const currentIndex = ref(0)

    // ✅ 缩放、旋转与拖拽控制
    const zoom = ref(1)
    const rotation = ref(0)
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

    // 放大/缩小
    const zoomIn = () => (zoom.value = Math.min(zoom.value + 0.2, 4))
    const zoomOut = () => (zoom.value = Math.max(zoom.value - 0.2, 0.5))

    // 复位视图（缩放/旋转/位移）
    const resetTransform = () => {
        zoom.value = 1
        rotation.value = 0
        offset.x = 0
        offset.y = 0
    }
    const resetZoom = resetTransform

    // 旋转：将角度规整到 (-180, 180]，支持任意角度与滑块联动
    const normalizeAngle = (deg: number) => {
        const angle = ((deg % 360) + 360) % 360
        return angle > 180 ? angle - 360 : angle
    }
    const rotateBy = (delta: number) => {
        rotation.value = normalizeAngle(rotation.value + delta)
    }
    const rotateRight = () => rotateBy(90)
    const rotateLeft = () => rotateBy(-90)

    // 上一张 / 下一张
    const goPrev = () => {
        if (currentIndex.value > 0) currentIndex.value--
    }
    const goNext = () => {
        if (currentIndex.value < photos.value.length - 1) currentIndex.value++
    }

    // 键盘快捷键（仅在预览打开时生效）
    const onKeydown = (e: KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowLeft':
                goPrev()
                break
            case 'ArrowRight':
                goNext()
                break
            case '+':
            case '=':
                zoomIn()
                break
            case '-':
                zoomOut()
                break
            case '0':
                resetTransform()
                break
            case 'r':
                rotateRight()
                break
            case 'R':
                rotateLeft()
                break
            case 'Escape':
                closePreview()
                break
            default:
                return
        }
        e.preventDefault()
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

    // 光标状态：与拖拽热区（外层容器）保持一致，仅放大后可拖拽
    const dragCursor = computed(() => {
        if (zoom.value > 1) return dragging.value ? 'grabbing' : 'grab'
        return 'default'
    })

    // 打开/关闭预览：初始化视图并挂载/卸载键盘监听
    watch(previewDialog, val => {
        if (!import.meta.client) return
        if (val) {
            resetTransform()
            loadingImg.value = photos.value.map(() => true)
            window.addEventListener('keydown', onKeydown)
        } else {
            window.removeEventListener('keydown', onKeydown)
        }
    })

    // 切换图片时复位视图，避免带着上一张的缩放/旋转态
    watch(currentIndex, () => resetTransform())

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
        if (import.meta.client) window.removeEventListener('keydown', onKeydown)
    })
</script>

<template>
    <v-container class="max-w-5xl px-4 px-sm-6 py-6 py-sm-10">
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
                            :style="{ cursor: dragCursor }"
                            @wheel="handleWheel"
                            @mousedown="startDrag"
                            @mousemove="onDrag"
                            @mouseup="endDrag"
                            @mouseleave="endDrag"
                        >
                            <!-- 环境光背景：同图放大模糊，增强沉浸感 -->
                            <img
                                :src="photo.picture"
                                alt=""
                                aria-hidden="true"
                                class="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-30 blur-3xl"
                            />
                            <v-progress-circular
                                v-if="loadingImg[i]"
                                indeterminate
                                color="white"
                                size="64"
                                class="absolute z-20"
                            />

                            <!-- ✅ 保证图片完整显示，按比例适应屏幕 -->
                            <v-img
                                :src="photo.picture"
                                class="select-none relative z-10 preview-img"
                                :style="{
                                    transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${zoom})`,
                                    transition: dragging
                                        ? 'none'
                                        : 'transform 0.25s ease',
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

                <!-- 预览控制栏：旋转滑杆 + 操作按钮 + 快捷键提示 -->
                <div
                    class="absolute bottom-5 left-1/2 z-30 flex w-[min(92vw,560px)] -translate-x-1/2 flex-col gap-1 rounded-2xl bg-white/10 px-4 py-2.5 text-white ring-1 ring-white/15 backdrop-blur-md"
                >
                    <div class="flex items-center gap-3">
                        <v-icon size="18" color="white">
                            mdi-rotate-right
                        </v-icon>
                        <v-slider
                            v-model="rotation"
                            :min="-180"
                            :max="180"
                            step="1"
                            density="compact"
                            hide-details
                            thumb-size="14"
                            class="flex-1"
                        />
                        <span class="w-12 text-right text-xs tabular-nums">
                            {{ rotation }}°
                        </span>
                    </div>

                    <div class="flex items-center justify-center gap-2">
                        <v-btn
                            icon
                            variant="text"
                            color="white"
                            data-cuelume-press
                            data-cuelume-release
                            @click="rotateLeft"
                        >
                            <v-icon icon="mdi-rotate-left" />
                            <v-tooltip activator="parent" location="top">
                                {{ t('rotate_left') }}
                            </v-tooltip>
                        </v-btn>
                        <v-btn
                            icon
                            variant="text"
                            color="white"
                            data-cuelume-press
                            data-cuelume-release
                            @click="zoomOut"
                        >
                            <v-icon icon="mdi-magnify-minus-outline" />
                            <v-tooltip activator="parent" location="top">
                                {{ t('zoom_out') }}
                            </v-tooltip>
                        </v-btn>
                        <v-btn
                            icon
                            variant="text"
                            color="white"
                            data-cuelume-press
                            data-cuelume-release
                            @click="resetZoom"
                        >
                            <v-icon icon="mdi-restore" />
                            <v-tooltip activator="parent" location="top">
                                {{ t('reset_view') }}
                            </v-tooltip>
                        </v-btn>
                        <v-btn
                            icon
                            variant="text"
                            color="white"
                            data-cuelume-press
                            data-cuelume-release
                            @click="zoomIn"
                        >
                            <v-icon icon="mdi-magnify-plus-outline" />
                            <v-tooltip activator="parent" location="top">
                                {{ t('zoom_in') }}
                            </v-tooltip>
                        </v-btn>
                        <v-btn
                            icon
                            variant="text"
                            color="white"
                            data-cuelume-press
                            data-cuelume-release
                            @click="rotateRight"
                        >
                            <v-icon icon="mdi-rotate-right" />
                            <v-tooltip activator="parent" location="top">
                                {{ t('rotate_right') }}
                            </v-tooltip>
                        </v-btn>
                    </div>

                    <div
                        class="text-center text-[11px] tracking-wide text-white/55"
                    >
                        {{ t('preview_hint') }}
                    </div>
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

    /* 预览主图阴影，与模糊背景拉开层次 */
    .preview-img {
        filter: drop-shadow(0 12px 32px rgb(0 0 0 / 0.55));
    }
</style>
