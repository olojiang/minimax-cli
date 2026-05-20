import pluginVue from 'eslint-plugin-vue'
import tsParser from '@typescript-eslint/parser'

const vueStyleRules = {
  'vue/attributes-order': 'off',
  'vue/first-attribute-linebreak': 'off',
  'vue/html-indent': 'off',
  'vue/html-self-closing': 'off',
  'vue/max-attributes-per-line': 'off',
  'vue/singleline-html-element-content-newline': 'off',
}

export default [
  {
    ignores: [
      'android/**/build/**',
      'android/app/src/main/assets/**',
      'dist/**',
      'release/**',
    ],
  },
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: 'module',
      },
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
      },
    },
  },
  {
    rules: {
      ...vueStyleRules,
      'vue/multi-word-component-names': 'off',
      'vue/no-required-prop-with-default': 'off',
    }
  }
]
