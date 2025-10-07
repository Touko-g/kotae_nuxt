<script setup lang="ts">
    const theme = useTheme()
    const local = useLocale()
    const { setLocale } = useDayjs()

    const toggleLocal = () => {
        const newLocale = local.current.value === 'zh' ? 'en' : 'zh'
        local.current.value = newLocale
        setLocale(newLocale === 'zh' ? 'zh-cn' : 'en')
    }
</script>

<template>
    <v-app-bar elevation="3">
        <v-app-bar-title class="text-primary" @click="navigateTo('/')">
            Kotae
        </v-app-bar-title>
        <v-spacer></v-spacer>
        <v-btn icon>
            <v-icon>mdi-magnify</v-icon>
        </v-btn>
        <v-btn icon>
            <v-icon>mdi-heart</v-icon>
        </v-btn>
        <v-btn icon @click="theme.toggle()">
            <v-icon>mdi-theme-light-dark</v-icon>
        </v-btn>
        <v-btn icon @click="toggleLocal">
            <v-icon>mdi-translate</v-icon>
        </v-btn>
    </v-app-bar>
</template>

<style scoped></style>
