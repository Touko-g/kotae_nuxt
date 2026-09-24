<script setup lang="ts">
    interface Command {
        id: string
        title: string
        keywords: string
        icon: string
        group: 'nav' | 'action'
        // navigateTo 等动作可能返回导航结果，统一放宽为 unknown
        run: () => unknown
    }

    const { t, current } = useLocale()
    const { cycleTheme } = useThemeCycle()
    const { setLocale } = useDayjs()
    const { soundWhisper, soundToggle, soundTick, toggleSound } = useSound()
    const { isLogin, performLogout } = useAuth()

    const palette = useState('commandPalette', () => false)
    const loginDialog = useState('login')
    const searchDialog = useState('search')
    const user = useCookie<User | null>('user')

    const query = ref('')
    const activeIndex = ref(0)
    const inputRef = ref()
    const cmdListRef = useTemplateRef('cmdListRef')

    const commands = computed<Command[]>(() => {
        const q = query.value.trim()
        const list: Command[] = [
            {
                id: 'home',
                title: t('cmd_home'),
                keywords: 'home index 首页 首夜 shouye',
                icon: 'mdi-home-outline',
                group: 'nav',
                run: () => navigateTo('/'),
            },
        ]
        if (isLogin.value) {
            list.push({
                id: 'message',
                title: t('message'),
                keywords: 'message notice 消息 通知 xiaoxi',
                icon: 'mdi-message-reply-outline',
                group: 'nav',
                run: () => navigateTo('/message'),
            })
            list.push({
                id: 'likes',
                title: t('like_article'),
                keywords: 'like collect 喜欢 收藏 likeguan',
                icon: 'mdi-heart-outline',
                group: 'nav',
                run: () => navigateTo('/article/like'),
            })
        }
        list.push({
            id: 'write',
            title: t('add'),
            keywords: 'create write article 写文章 创建 发布',
            icon: 'mdi-circle-edit-outline',
            group: 'nav',
            run: () => {
                if (!isLogin.value) {
                    loginDialog.value = true
                    return
                }
                navigateTo('/article/create')
            },
        })
        if (isLogin.value && user.value) {
            list.push({
                id: 'profile',
                title: t('about_me'),
                keywords: 'profile me user 我的主页 个人 主页',
                icon: 'mdi-human',
                group: 'nav',
                run: () => navigateTo(`/user/${user.value?.id}`),
            })
        }

        const actions: Command[] = []
        if (q) {
            actions.push({
                id: 'search-for',
                title: t('cmd_search_query', [q]),
                keywords: `search ${q.toLowerCase()} 搜索 sousuo`,
                icon: 'mdi-book-search-outline',
                group: 'action',
                run: () =>
                    navigateTo({
                        path: '/search',
                        query: { query: q, type: 'title' },
                    }),
            })
        }
        actions.push(
            {
                id: 'open-search',
                title: t('cmd_open_search'),
                keywords: 'search dialog 搜索 打开搜索',
                icon: 'mdi-magnify',
                group: 'action',
                run: () => {
                    searchDialog.value = true
                },
            },
            {
                id: 'theme',
                title: t('cmd_toggle_theme'),
                keywords:
                    'theme dark light rainy glass 主题 深色 浅色 夜间 雨夜 闪电 玻璃 磨砂',
                icon: 'mdi-theme-light-dark',
                group: 'action',
                run: () => {
                    cycleTheme()
                    soundToggle()
                },
            },
            {
                id: 'lang',
                title: t('cmd_toggle_lang'),
                keywords: 'language locale i18n 语言 中英文 切换语言',
                icon: 'mdi-translate',
                group: 'action',
                run: () => {
                    const newLocale = current.value === 'zh' ? 'en' : 'zh'
                    current.value = newLocale
                    setLocale(newLocale === 'zh' ? 'zh-cn' : 'en')
                    soundTick()
                },
            },
            {
                id: 'sound',
                title: t('cmd_toggle_sound'),
                keywords: 'sound audio volume 音效 声音 静音 开关',
                icon: 'mdi-volume-high',
                group: 'action',
                run: () => toggleSound(),
            }
        )
        if (isLogin.value) {
            actions.push({
                id: 'logout',
                title: t('logout'),
                keywords: 'logout sign out 登出 退出 注销',
                icon: 'mdi-logout',
                group: 'action',
                run: () => performLogout(),
            })
        } else {
            actions.push({
                id: 'login',
                title: t('sign_in'),
                keywords: 'login sign in 登录 登陆',
                icon: 'mdi-login',
                group: 'action',
                run: () => {
                    loginDialog.value = true
                },
            })
        }

        return [...list, ...actions]
    })

    const filtered = computed(() => {
        const q = query.value.trim().toLowerCase()
        if (!q) return commands.value
        return commands.value.filter(
            cmd =>
                cmd.title.toLowerCase().includes(q) ||
                cmd.keywords.toLowerCase().includes(q)
        )
    })

    // 按分组渲染，同时保留在扁平列表中的序号（键盘导航用）
    const sections = computed(() => {
        const groups: {
            group: string
            items: { cmd: Command; index: number }[]
        }[] = []
        filtered.value.forEach((cmd, index) => {
            let g = groups.find(x => x.group === cmd.group)
            if (!g) {
                g = { group: cmd.group, items: [] }
                groups.push(g)
            }
            g.items.push({ cmd, index })
        })
        return groups
    })

    const move = (dir: number) => {
        const len = filtered.value.length
        if (!len) return
        activeIndex.value = (activeIndex.value + dir + len) % len
    }

    const run = async (cmd: Command) => {
        palette.value = false
        await cmd.run()
    }

    const selectActive = () => {
        const cmd = filtered.value[activeIndex.value]
        if (cmd) run(cmd)
    }

    watch(query, () => {
        activeIndex.value = 0
    })

    // 活动项滚动到可视区域
    watch(activeIndex, () => {
        nextTick(() => {
            cmdListRef.value
                ?.querySelector('[data-cmd-active="true"]')
                ?.scrollIntoView({ block: 'nearest' })
        })
    })

    watch(palette, value => {
        if (value) {
            query.value = ''
            activeIndex.value = 0
            soundWhisper()
            nextTick(() => inputRef.value?.focus())
        }
    })

    // 全局快捷键：Ctrl+K / Cmd+K 开关命令面板
    const onGlobalKey = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault()
            palette.value = !palette.value
        }
    }

    onMounted(() => {
        window.addEventListener('keydown', onGlobalKey)
    })

    onUnmounted(() => {
        window.removeEventListener('keydown', onGlobalKey)
    })
</script>

<template>
    <v-dialog
        v-model="palette"
        max-width="620"
        transition="dialog-bottom-transition"
    >
        <v-card>
            <v-text-field
                ref="inputRef"
                v-model="query"
                :placeholder="t('cmd_placeholder')"
                prepend-inner-icon="mdi-magnify"
                variant="plain"
                hide-details
                density="comfortable"
                class="px-4 py-2"
                @keydown.down.prevent="move(1)"
                @keydown.up.prevent="move(-1)"
                @keydown.enter.prevent="selectActive"
            />
            <v-divider />
            <div ref="cmdListRef" class="cmd-list">
                <v-list density="compact" variant="flat">
                    <template v-for="section in sections" :key="section.group">
                        <v-list-subheader>
                            {{
                                section.group === 'nav'
                                    ? t('cmd_nav')
                                    : t('cmd_actions')
                            }}
                        </v-list-subheader>
                        <v-list-item
                            v-for="entry in section.items"
                            :key="entry.cmd.id"
                            :data-cmd-active="entry.index === activeIndex"
                            :active="entry.index === activeIndex"
                            :title="entry.cmd.title"
                            :prepend-icon="entry.cmd.icon"
                            class="mx-2 rounded-lg"
                            @click="run(entry.cmd)"
                            @mouseenter="activeIndex = entry.index"
                        />
                    </template>
                    <div
                        v-if="!filtered.length"
                        class="pa-6 text-center text-grey"
                    >
                        {{ t('nothing') }}
                    </div>
                </v-list>
            </div>
            <v-divider />
            <div class="px-4 py-2 text-caption text-grey">
                {{ t('cmd_hint') }}
            </div>
        </v-card>
    </v-dialog>
</template>

<style scoped>
    .cmd-list {
        max-height: 360px;
        overflow-y: auto;
        scrollbar-width: thin;
    }
</style>
