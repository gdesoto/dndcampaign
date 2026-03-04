<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

type SwaggerUIBundle = (config: Record<string, unknown>) => void

declare global {
  interface Window {
    SwaggerUIBundle?: SwaggerUIBundle & {
      presets?: {
        apis?: unknown
      }
    }
  }
}

definePageMeta({ layout: 'docs' })

const swaggerRoot = ref<HTMLElement | null>(null)
const loadError = ref('')

const SWAGGER_UI_CSS_URL = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui.css'
const SWAGGER_UI_SCRIPT_URL = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js'

useHead({
  title: 'API Reference',
  link: [
    {
      rel: 'stylesheet',
      href: SWAGGER_UI_CSS_URL,
    },
  ],
})

const loadSwaggerBundle = async (): Promise<NonNullable<Window['SwaggerUIBundle']>> => {
  if (window.SwaggerUIBundle) {
    return window.SwaggerUIBundle
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-swagger-ui="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Swagger UI script.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = SWAGGER_UI_SCRIPT_URL
    script.async = true
    script.dataset.swaggerUi = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Swagger UI script.'))
    document.head.appendChild(script)
  })

  if (!window.SwaggerUIBundle) {
    throw new Error('Swagger UI bundle was not available after script load.')
  }

  return window.SwaggerUIBundle
}

onMounted(async () => {
  await nextTick()

  if (!swaggerRoot.value) {
    loadError.value = 'API documentation failed to initialize: container not found.'
    return
  }

  try {
    const SwaggerUIBundle = await loadSwaggerBundle()
    SwaggerUIBundle({
      url: '/openapi.json',
      domNode: swaggerRoot.value,
      deepLinking: true,
      docExpansion: 'list',
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 2,
      tryItOutEnabled: true,
      presets: SwaggerUIBundle.presets?.apis ? [SwaggerUIBundle.presets.apis] : [],
      layout: 'BaseLayout',
    })
  } catch (error) {
    loadError.value = error instanceof Error
      ? error.message
      : 'API documentation failed to initialize.'
  }
})
</script>

<template>
  <div class="space-y-6">
    <UPageHeader
      title="API Reference"
      headline="Docs"
      description="Interactive Swagger UI documentation for server endpoints."
    />

    <UPageBody>
      <UCard class="overflow-hidden">
        <div
          v-if="loadError"
          class="rounded border border-error-500/40 bg-error-500/10 p-4 text-sm text-error-200"
        >
          {{ loadError }}
        </div>
        <div
          ref="swaggerRoot"
          class="swagger-root"
        />
      </UCard>
    </UPageBody>
  </div>
</template>

<style scoped>
.swagger-root {
  min-height: calc(100vh - 18rem);
}
</style>

<style>
.dark .swagger-ui {
  color: #e5e7eb;
}

.dark .swagger-ui .topbar {
  background-color: #111827;
}

.dark .swagger-ui .info .title,
.dark .swagger-ui .info p,
.dark .swagger-ui .info li,
.dark .swagger-ui .opblock-tag,
.dark .swagger-ui .opblock-description-wrapper p,
.dark .swagger-ui .response-col_status,
.dark .swagger-ui .response-col_description,
.dark .swagger-ui .tab li button.tablinks,
.dark .swagger-ui label,
.dark .swagger-ui .parameter__name,
.dark .swagger-ui .parameter__type,
.dark .swagger-ui .model-title,
.dark .swagger-ui .model {
  color: #e5e7eb;
}

.dark .swagger-ui .scheme-container,
.dark .swagger-ui .opblock,
.dark .swagger-ui .responses-inner,
.dark .swagger-ui .model-box,
.dark .swagger-ui table thead tr td,
.dark .swagger-ui table thead tr th {
  background: #111827;
  color: #e5e7eb;
}

.dark .swagger-ui .opblock .opblock-summary {
  border-color: #374151;
  background: rgba(15, 23, 42, 0.88);
}

.dark .swagger-ui .opblock .opblock-summary-method {
  color: #ffffff;
  font-weight: 700;
}

.dark .swagger-ui .opblock .opblock-summary-path,
.dark .swagger-ui .opblock .opblock-summary-path__deprecated,
.dark .swagger-ui .opblock .opblock-summary-description {
  color: #f3f4f6;
}

.dark .swagger-ui .opblock.opblock-get {
  background: rgba(8, 145, 178, 0.12);
  border-color: rgba(6, 182, 212, 0.45);
}

.dark .swagger-ui .opblock.opblock-post {
  background: rgba(22, 163, 74, 0.12);
  border-color: rgba(34, 197, 94, 0.45);
}

.dark .swagger-ui .opblock.opblock-put,
.dark .swagger-ui .opblock.opblock-patch {
  background: rgba(217, 119, 6, 0.12);
  border-color: rgba(245, 158, 11, 0.45);
}

.dark .swagger-ui .opblock.opblock-delete {
  background: rgba(220, 38, 38, 0.12);
  border-color: rgba(239, 68, 68, 0.45);
}

.dark .swagger-ui input[type='text'],
.dark .swagger-ui input[type='password'],
.dark .swagger-ui input[type='search'],
.dark .swagger-ui input[type='email'],
.dark .swagger-ui textarea,
.dark .swagger-ui select {
  background: #0b1220;
  color: #e5e7eb;
  border-color: #374151;
}

.dark .swagger-ui .btn {
  color: #e5e7eb;
  border-color: #4b5563;
}

.dark .swagger-ui .btn.execute {
  background: #0891b2;
  border-color: #0891b2;
  color: #ffffff;
}

.dark .swagger-ui .highlight-code,
.dark .swagger-ui .microlight {
  background: #0b1220;
  color: #e5e7eb;
}
</style>
