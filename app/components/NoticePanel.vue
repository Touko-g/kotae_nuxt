<!-- NoticePanel.vue -->
<template>
    <v-card>
        <v-tabs v-model="tab" grow color="primary">
            <v-tab :value="0">
                <v-badge
                    v-if="notices?.unread?.length"
                    :content="notices?.unread?.length"
                    color="error"
                    floating
                >
                    {{ t('unread') }}
                </v-badge>
                <span v-else>{{ t('unread') }}</span>
            </v-tab>
            <v-tab :value="1">{{ t('read') }}</v-tab>
        </v-tabs>

        <v-card-text>
            <v-window v-model="tab">
                <v-window-item :value="0">
                    <NoticeList
                        :items="notices?.unread || []"
                        :label="label"
                        :format="format"
                    />
                </v-window-item>
                <v-window-item :value="1">
                    <NoticeList
                        :items="notices?.read || []"
                        :label="label"
                        :format="format"
                    />
                </v-window-item>
            </v-window>
        </v-card-text>
    </v-card>
</template>

<script setup lang="ts">
    const props = defineProps<{
        notices: { read: Notice[]; unread: Notice[] } | null
        activeTab: number
        t: Function
        format: (time: string) => string
        label: string
    }>()

    const tab = useModel(props, 'activeTab')
</script>
