<script setup lang="ts">
    const { isLogin, verify, refresh } = useAuth()
    const { user } = useUser()

    const token = useCookie('token')
    const refreshToken = useCookie('refresh')

    onMounted(async () => {
        if (token.value) {
            // const { data, error } = await useAsyncData('verity', () =>
            //     verify({ token: token.value as string })
            // )
            //
            // if (data.value) {
            //     isLogin.value = true
            // }
            //
            // if (error.value) {
            //     if (refreshToken.value) {
            //         const { data, error } = await useAsyncData('refresh', () =>
            //             refresh({ refresh: refreshToken.value as string })
            //         )
            //
            //         if (data.value) {
            //             token.value = data.value.access
            //             refreshToken.value = data.value.refresh
            //             isLogin.value = true
            //         }
            //
            //         if (error.value) {
            //             token.value = null
            //             refreshToken.value = null
            //         }
            //     } else {
            //         token.value = null
            //     }
            // }
            try {
                await verify({ token: token.value })
                isLogin.value = true
            } catch (e) {
                if (refreshToken.value) {
                    try {
                        const data = await refresh({
                            refresh: refreshToken.value,
                        })
                        token.value = data.access
                        refreshToken.value = data.refresh
                        isLogin.value = true
                    } catch (e) {
                        token.value = null
                        refreshToken.value = null
                    }
                } else {
                    token.value = null
                }
            }
        } else {
            isLogin.value = false
            user.value = null
        }
    })
</script>
<template>
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
