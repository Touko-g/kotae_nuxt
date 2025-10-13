<script setup lang="ts">
    const route = useRoute()

    const id = String(route.params.id ?? '')

    const { getUser } = useUser()
    const { getArticleList } = useArticle()
    const { getPhotoList } = usePhoto()

    const { t } = useLocale()
    const { fromNow } = useDayjs()
    const { width } = useDisplay()

    const refreshCount = useState('refreshCount')
    const loginUser = useCookie<User | null>('user')

    const articleQuery = reactive({
        page: 1,
        pagesize: 7,
        count: 0,
        author: '',
        order: '-create_time',
    })

    const toggle = ref(0)

    const photoPage = reactive({
        page: 1,
        pagesize: 3,
        user: '',
    })

    const { data: user } = await useLazyAsyncData('user', () => getUser(id), {
        watch: [refreshCount],
    })

    if (user.value) {
        articleQuery.author = user.value.username
        photoPage.user = user.value.username
    }

    const { data: articles } = await useLazyAsyncData(
        'articles',
        () => getArticleList({ ...articleQuery }),
        {
            watch: [refreshCount, articleQuery],
        }
    )

    // 计算分页
    if (articles.value?.results.length) {
        articleQuery.count = Math.ceil(
            articles.value.count / articleQuery.pagesize
        )
    }

    const { data: photos } = await useLazyAsyncData(
        'photos',
        () => getPhotoList({ ...photoPage }),
        { watch: [refreshCount] }
    )

    watch(toggle, v =>
        v
            ? (articleQuery.order = '-likes')
            : (articleQuery.order = '-create_time')
    )

    const isSelf = computed(() => {
        return loginUser.value?.id === Number(id)
    })

    const changePage = (page: number) => {
        articleQuery.page = page
    }
</script>

<template>
    <v-row v-if="user" class="ma-2 ma-sm-6">
        <v-col cols="12" sm="12" md="4" lg="3">
            <v-row>
                <v-col cols="12">
                    <v-card>
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
                                    {{ user.username }}
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
                            <v-btn variant="text">{{ t('edit_user') }}</v-btn>
                            <v-spacer />
                        </v-card-actions>
                    </v-card>
                </v-col>
                <v-col cols="12">
                    <v-card>
                        <v-card-title>
                            <v-sheet class="d-flex align-center">
                                <v-icon class="mr-2">mdi-camera</v-icon>
                                {{ t('photo_album') }}
                                <v-spacer />
                                <v-btn
                                    v-if="photos?.results.length"
                                    flat
                                    size="small"
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
                            <v-sheet
                                v-else
                                height="150"
                                class="d-flex justify-center align-center"
                            >
                                <span class="font-weight-bold text-grey">{{
                                    t('no_photo')
                                }}</span>
                            </v-sheet>
                            <v-sheet v-show="isSelf" class="mt-4">
                                <v-file-input
                                    prepend-icon="mdi-image-plus"
                                    chips
                                    density="compact"
                                    accept="image/png, image/jpeg, image/bmp"
                                    variant="outlined"
                                    :label="t('photo')"
                                >
                                </v-file-input>
                                <v-text-field
                                    density="compact"
                                    variant="outlined"
                                    :label="t('photo_name')"
                                ></v-text-field>
                                <v-sheet class="d-flex">
                                    <v-btn size="small">{{
                                        t('upload')
                                    }}</v-btn>
                                    <v-btn size="small" class="ml-2">{{
                                        t('reset')
                                    }}</v-btn>
                                </v-sheet>
                            </v-sheet>
                        </v-card-text>
                    </v-card>
                </v-col>
            </v-row>
        </v-col>
        <v-col cols="12" sm="12" md="8" lg="9">
            <v-card>
                <v-card-title>
                    <div class="d-flex">
                        {{ t('my_article') }}
                        <v-spacer />
                        <v-btn-toggle
                            v-model="toggle"
                            color="primary"
                            density="compact"
                        >
                            <v-btn variant="text">{{ t('newest') }}</v-btn>
                            <v-btn variant="text"> {{ t('like') }}</v-btn>
                        </v-btn-toggle>
                    </div>
                </v-card-title>
                <v-divider color="surface" />
                <v-card-text>
                    <v-list lines="two">
                        <v-list-item
                            v-for="article in articles?.results"
                            :key="article.id"
                            @click="navigateTo(`/article/${article.id}`)"
                        >
                            <template #title>
                                <span>{{ article.title }}</span>
                            </template>

                            <template #subtitle>
                                <div class="d-flex justify-space-between">
                                    <div>
                                        <span class="text-xs"
                                            >{{ t('view') }}:{{ article.views }}
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
                                    <div v-show="width > 400" class="text-xs">
                                        {{ fromNow(article.create_time) }}
                                    </div>
                                </div>
                                <div v-show="width < 400" class="text-xs">
                                    {{ fromNow(article.create_time) }}
                                </div>
                            </template>
                        </v-list-item>
                    </v-list>
                    <v-pagination
                        v-if="articleQuery.count"
                        v-model="articleQuery.page"
                        :length="articleQuery.count"
                        rounded="circle"
                        density="compact"
                        @update:model-value="changePage"
                    ></v-pagination>
                </v-card-text>
            </v-card>
        </v-col>
    </v-row>
</template>

<style scoped></style>
