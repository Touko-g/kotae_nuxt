<script setup lang="ts">
    import COS from 'cos-js-sdk-v5'
    const route = useRoute()

    const id = String(route.params.id ?? '')

    const { getUser } = useUser()
    const { getArticleList } = useArticle()
    const { addPhoto, getPhotoList } = usePhoto()
    const { getCosKey } = useAuth()

    const { show } = useSnakebar()
    const { t } = useLocale()
    const { fromNow, format } = useDayjs()
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

    const photoData = reactive({
        photoName: '',
        photoPath: '',
        cosLoading: false,
        uploadLoading: false,
    })

    const { data: user } = await useAsyncData('user', () => getUser(id), {
        watch: [refreshCount],
    })

    if (user.value) {
        articleQuery.author = user.value.username
        photoPage.user = user.value.username
    }

    const { data: articles } = await useAsyncData(
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

    const { data: photos } = await useAsyncData(
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

    const handleUpload = async (file: File | File[]) => {
        if (!file || Array.isArray(file)) return
        try {
            photoData.cosLoading = true
            const { credentials } = await getCosKey()

            const cos = new COS({
                SecretId: credentials.tmpSecretId,
                SecretKey: credentials.tmpSecretKey,
                XCosSecurityToken: credentials.sessionToken,
            })

            cos.putObject({
                Bucket: 'chen-1302611521' /* 存储桶 */,
                Region: 'ap-nanjing' /* 存储桶所在地域，必须字段 */,
                Key: `/blog/photo/${user.value?.username}/${format(new Date(), 'YYYY-MM-DDTHH:mm:ss')}-${file.name}` /* 文件名 */,
                StorageClass: 'STANDARD', // 上传模式, 标准模式
                Body: file, // 上传文件对象
                onProgress: () => {},
            })
                .then(res => (photoData.photoPath = `https://${res.Location}`))
                .catch(err => show(err, 'error'))
        } catch (e) {
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
            show('upload success')
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
                            <v-btn
                                variant="text"
                                @click="
                                    navigateTo(`/user/${user.username}/profile`)
                                "
                                >{{ t('edit_user') }}</v-btn
                            >
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
