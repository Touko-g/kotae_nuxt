module.exports = {
    root: true,
    extends: [
        '@nuxtjs/eslint-config-typescript',
        'plugin:prettier/recommended',
    ],
    rules: {
        'prettier/prettier': [
            'error',
            {
                semi: false, // 结尾是否加分号
                singleQuote: true, // 使用单引号
                tabWidth: 4, // 缩进空格数
                useTabs: false, // 强制用空格缩进
                trailingComma: 'es5', // 尾随逗号: "es5" | "none" | "all"
                bracketSpacing: true, // 控制对象字面量大括号内的空格
                arrowParens: 'avoid', // 如果只有一个参数，就去掉括号
                vueIndentScriptAndStyle: true, // 保证 <script setup> 和 <style> 有缩进
            },
        ],
    },
}
