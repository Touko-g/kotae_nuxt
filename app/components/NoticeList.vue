<!-- components/NoticeList.vue -->
<template>
    <div>
        <!-- 空状态 -->
        <div v-if="!items?.length" class="text-center py-6 text-grey">
            <v-icon icon="mdi-bell-off-outline" size="40" color="grey"></v-icon>
            <div class="mt-2">{{ emptyText || t('no_messages') }}</div>
        </div>

        <!-- 列表内容 -->
        <v-list-item
            v-for="notice in items"
            :key="notice.id"
            class="cursor-pointer"
            @click="navigateTo(`/article/${notice.target_info.id}`)"
        >
            <div class="d-flex">
                <!-- 头像 -->
                <v-avatar size="40" class="mr-3">
                    <v-img :src="notice.user_info.avatar" alt="avatar" />
                </v-avatar>

                <!-- 内容 -->
                <div class="d-flex flex-column">
                    <div>
                        <span class="font-weight-bold">{{
                            notice.user_info.username
                        }}</span>
                        <span class="mx-2">{{ t(label) }}</span>

                        <!-- 如果有标题（评论类型） -->
                        <span
                            v-if="notice.target_info?.title"
                            class="font-weight-bold text-decoration-underline"
                        >
                            {{ notice.target_info.title }}
                        </span>
                    </div>

                    <!-- 内容正文 -->
                    <div v-if="notice.reply_content" class="text-grey">
                        “{{ notice.reply_content }}”
                    </div>
                    <div class="my-1">{{ notice.content }}</div>

                    <!-- 时间 -->
                    <span class="text-xs text-grey">
                        {{ format(notice.create_time) }}
                    </span>
                </div>
            </div>
        </v-list-item>
    </div>
</template>

<script setup lang="ts">
    const { t } = useLocale()

    defineProps<{
        items: Notice[] | null
        label: string
        format: (time: string) => string
        emptyText?: string
    }>()
</script>

<style scoped></style>
