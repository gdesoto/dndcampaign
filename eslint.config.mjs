// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // Bundled reference apps have their own dependencies and lint configuration.
  { ignores: ['.agents/plugins/nuxt-ui-guidelines/**'] },
  // Your custom configs here
  {
    name: 'project-overrides',
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    }
  }
)
