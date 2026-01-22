<script setup lang="ts">
    import type { VAlert } from 'vuetify/components'

    type AlertProps = InstanceType<typeof VAlert>['$props']

    defineProps<{
        alertProps?: Partial<AlertProps>
    }>()
</script>

<template>
    <v-alert v-bind="alertProps" closable />
</template>
