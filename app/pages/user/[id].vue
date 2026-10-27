<script setup lang="ts">
    definePageMeta({
        middleware: 'auth',
    })

    const { t } = useLocale()

    useSeoMeta({
        title: computed(() => t('user_info')),
        ogTitle: computed(() => t('user_info')),
    })

    const route = useRoute()

    /**
     * 路由参数必须跟着 URL 走。
     * 和文章详情页同一个坑：useAsyncData 用固定 key 时，页面重建后发现同名 key
     * 已有一份 status='success' 的缓存就直接跳过请求，于是从 A 的主页点进 B 的
     * 主页，看到的还是 A 的资料、A 的文章列表。
     */
    const id = computed(() => String(route.params.id ?? ''))

    const { getUser } = useUser()
    const { getArticleList } = useArticle()
    const { addPhoto, getPhotoList } = usePhoto()
    const { getWishList } = useWish()
    const { upload } = useCosUpload()

    const { show } = useToast()
    const { fromNow } = useDayjs()
    const { width } = useDisplay()

    const loginUser = useCookie<User | null>('user')

    // 注意：分页总数不要放进 articleQuery。
    // 它是 fetch 回来才算出来的派生值，放进去会同时造成两个问题：
    // 1) 被当成查询参数发给后端（后端并不认 count）；
    // 2) 它在 watch 的观察范围内，赋值那一刻又会触发一次一模一样的请求。
    const articleQuery = reactive({
        page: 1,
        pagesize: 7,
        author: '',
        order: '-create_time',
    })

    const toggle = ref(0)

    const photoPage = reactive({
        page: 1,
        pagesize: 3,
        user: '',
    })

    const photoData = reactive({
        photoName: '',
        photoPath: '',
        cosLoading: false,
        uploadLoading: false,
    })

    // id 交给 useApiData 做参数：既进 key，也进 fetcher
    const { data: user } = await useApiData('user', p => getUser(p.id), {
        params: () => ({ id: id.value }),
    })

    if (user.value) {
        articleQuery.author = user.value.username
        photoPage.user = user.value.username
    }

    const { data: articles } = await useApiData(
        'articles',
        p =>
            getArticleList({
                page: p.page,
                pagesize: p.pagesize,
                author: p.author,
                order: p.order,
            }),
        {
            // 查询条件全部进 key：翻页、切排序都会自动重取，不用再手写 watch
            params: () => ({
                id: id.value,
                page: articleQuery.page,
                pagesize: articleQuery.pagesize,
                author: articleQuery.author,
                order: articleQuery.order,
            }),
        }
    )

    // 分页总数用 computed 派生：既不会反向写回请求参数，翻页/切换排序后也会跟着更新
    const articleCount = computed(() =>
        articles.value?.results.length
            ? Math.ceil(articles.value.count / articleQuery.pagesize)
            : 0
    )

    const { data: photos } = await useApiData(
        'photo',
        p =>
            getPhotoList({
                page: p.page,
                pagesize: p.pagesize,
                user: p.user,
            }),
        {
            params: () => ({
                id: id.value,
                page: photoPage.page,
                pagesize: photoPage.pagesize,
                user: photoPage.user,
            }),
        }
    )

    watch(toggle, v =>
        v
            ? (articleQuery.order = '-likes')
            : (articleQuery.order = '-create_time')
    )

    const isSelf = computed(() => {
        return loginUser.value?.id === Number(id.value)
    })

    // 「想做的事」接口只返回当前登录用户的数据，故仅在本人主页拉取展示。
    // self 也进 key：登录态从无到有时要重新判定，否则永远停在「不是本人」
    const { data: wishData } = await useApiData(
        'wish',
        async p =>
            p.self
                ? await getWishList({ pagesize: 1000, order: '-create_time' })
                : undefined,
        { params: () => ({ id: id.value, self: isSelf.value }) }
    )
    const wishPreview = computed(
        () => wishData.value?.results.slice(0, 5) ?? []
    )

    const handleUpload = async (file: File | File[]) => {
        if (!file || Array.isArray(file)) return
        try {
            photoData.cosLoading = true
            photoData.photoPath = await upload(file, {
                dir: `blog/photo/${user.value?.username ?? 'anonymous'}`,
            })
        } catch (e: any) {
            show(e?.message ?? String(e), 'error')
        } finally {
            photoData.cosLoading = false
        }
    }

    const uploadPhoto = async () => {
        try {
            photoData.uploadLoading = true
            await addPhoto({
                picture: photoData.photoPath,
                name: photoData.photoName,
            })
            show(t('upload_success'), 'success')
        } catch (e) {
        } finally {
            photoData.uploadLoading = false
            resetPhoto()
        }
    }

    const resetPhoto = () => {
        photoData.photoName = ''
        photoData.photoPath = ''
    }

    const changePage = (page: number) => {
        articleQuery.page = page
    }
</script>

<template>
    <v-container class="px-4 px-sm-6 py-6 py-sm-10">
        <v-row v-if="user" class="stagger-up">
            <v-col cols="12" sm="12" md="4" lg="3">
                <v-row>
                    <v-col cols="12">
                        <v-card class="k-card">
                            <v-card-text>
                                <div class="mx-auto text-center">
                                    <v-avatar size="100">
                                        <v-img
                                            sizes="100"
                                            :src="user.avatar"
                                            :alt="user.username"
                                        ></v-img>
                                    </v-avatar>
                                    <h1 class="my-4 text-3xl">
                                        <span class="k-highlight">{{
                                            user.username
                                        }}</span>
                                    </h1>
                                    <p class="text-xs mt-1">
                                        {{ user.email }}
                                    </p>
                                    <v-divider
                                        class="my-3"
                                        color="surface"
                                    ></v-divider>
                                    <p>
                                        {{ user.about }}
                                    </p>
                                </div>
                            </v-card-text>
                            <v-card-actions v-show="isSelf">
                                <v-spacer />
                                <v-btn
                                    variant="text"
                                    @click="
                                        navigateTo(
                                            `/user/${user.username}/profile`
                                        )
                                    "
                                    >{{ t('edit_user') }}</v-btn
                                >
                                <v-spacer />
                            </v-card-actions>
                        </v-card>
                    </v-col>
                    <v-col cols="12">
                        <v-card class="k-card">
                            <v-card-title>
                                <v-sheet class="d-flex align-center">
                                    <v-icon class="mr-2">mdi-camera</v-icon>
                                    {{ t('photo_album') }}
                                    <v-spacer />
                                    <v-btn
                                        v-if="photos?.results.length"
                                        flat
                                        size="small"
                                        @click="
                                            navigateTo(
                                                `/user/${user.username}/photo`
                                            )
                                        "
                                        >{{ t('more') }}</v-btn
                                    >
                                </v-sheet>
                            </v-card-title>
                            <v-card-text>
                                <v-sheet v-if="photos?.results.length">
                                    <v-carousel
                                        :show-arrows="false"
                                        height="200"
                                        hide-delimiters
                                        cycle
                                    >
                                        <v-carousel-item
                                            v-for="photo in photos.results"
                                            :key="photo.id"
                                            :src="photo.picture"
                                            cover
                                        ></v-carousel-item>
                                    </v-carousel>
                                </v-sheet>
                                <EmptyState
                                    v-else
                                    icon="mdi-image-outline"
                                    :title="t('no_photos')"
                                />
                                <v-sheet v-show="isSelf" class="mt-4">
                                    <v-file-input
                                        prepend-icon="mdi-image-plus"
                                        :loading="photoData.cosLoading"
                                        chips
                                        show-size
                                        counter
                                        density="compact"
                                        accept="image/png, image/jpeg, image/bmp, image/webp"
                                        variant="outlined"
                                        :label="t('photo')"
                                        @update:model-value="handleUpload"
                                    >
                                    </v-file-input>
                                    <v-text-field
                                        v-model="photoData.photoName"
                                        density="compact"
                                        variant="outlined"
                                        :label="t('photo_name')"
                                    ></v-text-field>
                                    <v-sheet class="d-flex">
                                        <v-btn
                                            size="small"
                                            :disabled="!photoData.photoPath"
                                            :loading="photoData.uploadLoading"
                                            @click="uploadPhoto"
                                            >{{ t('upload') }}</v-btn
                                        >
                                        <v-btn
                                            size="small"
                                            class="ml-2"
                                            @click="resetPhoto"
                                            >{{ t('reset') }}</v-btn
                                        >
                                    </v-sheet>
                                </v-sheet>
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>
            </v-col>
            <v-col cols="12" sm="12" md="8" lg="9">
                <v-row>
                    <v-col cols="12">
                        <v-card class="k-card">
                            <v-card-title>
                                <div class="d-flex">
                                    {{ t('my_article') }}
                                    <v-spacer />
                                    <v-btn-toggle
                                        v-model="toggle"
                                        color="primary"
                                        density="compact"
                                    >
                                        <v-btn variant="text">{{
                                            t('newest')
                                        }}</v-btn>
                                        <v-btn variant="text">
                                            {{ t('like') }}</v-btn
                                        >
                                    </v-btn-toggle>
                                </div>
                            </v-card-title>
                            <v-divider color="surface" />
                            <v-card-text>
                                <v-list
                                    v-if="articles?.results.length"
                                    lines="two"
                                    class="stagger-up"
                                >
                                    <v-list-item
                                        v-for="article in articles?.results"
                                        :key="article.id"
                                        @click="
                                            navigateTo(`/article/${article.id}`)
                                        "
                                    >
                                        <template #title>
                                            <span>{{ article.title }}</span>
                                        </template>

                                        <template #subtitle>
                                            <div
                                                class="d-flex justify-space-between"
                                            >
                                                <div>
                                                    <span class="text-xs"
                                                        >{{ t('view') }}:{{
                                                            article.views
                                                        }}
                                                    </span>
                                                    <span class="text-xs mx-2"
                                                        >{{ t('like') }}:{{
                                                            article.likes
                                                        }}</span
                                                    >
                                                    <span class="text-xs">
                                                        {{ t('comment') }}:{{
                                                            article.comments
                                                        }}</span
                                                    >
                                                </div>
                                                <div
                                                    v-show="width > 400"
                                                    class="text-xs"
                                                >
                                                    {{
                                                        fromNow(
                                                            article.create_time
                                                        )
                                                    }}
                                                </div>
                                            </div>
                                            <div
                                                v-show="width < 400"
                                                class="text-xs"
                                            >
                                                {{
                                                    fromNow(article.create_time)
                                                }}
                                            </div>
                                        </template>
                                    </v-list-item>
                                </v-list>
                                <EmptyState
                                    v-else
                                    icon="mdi-file-document-outline"
                                    :title="t('no_articles')"
                                />
                                <v-pagination
                                    v-if="articleCount"
                                    v-model="articleQuery.page"
                                    :length="articleCount"
                                    rounded="circle"
                                    density="compact"
                                    @update:model-value="changePage"
                                ></v-pagination>
                            </v-card-text>
                        </v-card>
                    </v-col>
                    <v-col v-if="isSelf" cols="12">
                        <v-card class="k-card">
                            <v-card-title>
                                <div class="d-flex align-center">
                                    <v-icon class="mr-2"
                                        >mdi-clipboard-list-outline</v-icon
                                    >
                                    {{ t('wishlist') }}
                                    <v-spacer />
                                    <v-btn
                                        variant="text"
                                        size="small"
                                        append-icon="mdi-arrow-right"
                                        @click="navigateTo('/wishlist')"
                                        >{{ t('wish_manage') }}</v-btn
                                    >
                                </div>
                            </v-card-title>
                            <v-divider color="surface" />
                            <v-card-text>
                                <v-list
                                    v-if="wishPreview.length"
                                    lines="one"
                                    class="stagger-up"
                                >
                                    <v-list-item
                                        v-for="w in wishPreview"
                                        :key="w.id"
                                    >
                                        <template #prepend>
                                            <v-icon
                                                :color="
                                                    w.completed
                                                        ? 'success'
                                                        : 'grey'
                                                "
                                                size="small"
                                            >
                                                {{
                                                    w.completed
                                                        ? 'mdi-check-circle'
                                                        : 'mdi-checkbox-blank-circle-outline'
                                                }}
                                            </v-icon>
                                        </template>
                                        <template #title>
                                            <span
                                                :class="{
                                                    'line-through': w.completed,
                                                    'opacity-60': w.completed,
                                                }"
                                                >{{ w.title }}</span
                                            >
                                        </template>
                                    </v-list-item>
                                </v-list>
                                <EmptyState
                                    v-else
                                    icon=""
                                    :title="t('wish_empty')"
                                />
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>
            </v-col>
        </v-row>
    </v-container>
</template>

<style scoped></style>
