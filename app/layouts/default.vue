<script setup lang="ts">
    const { isLogin, verify } = useAuth()

    const token = useCookie('token')

    onMounted(async () => {
        if (token.value) {
            try {
                await verify({ token: token.value })
                isLogin.value = true
            } catch (e) {}
        } else {
            isLogin.value = false
        }
    })
</script>
<template>
    <NuxtLoadingIndicator />
    <v-app>
        <!--        <v-layout>-->
        <v-navigation-drawer width="60" elevation="3"> </v-navigation-drawer>
        <AppBar />
        <v-navigation-drawer width="60" location="right" elevation="3">
        </v-navigation-drawer>
        <v-main class="bg-background">
            <slot />
        </v-main>
        <snake-bar />
        <!--        </v-layout>-->
    </v-app>
</template>
