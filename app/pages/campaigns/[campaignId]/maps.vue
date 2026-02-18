<script setup lang="ts">
import type {
  CampaignMapSummaryDto,
  CampaignMapViewerDto,
  MapGlossaryCommitResultDto,
  MapReimportPreviewDto,
  MapReimportStrategy,
  MapFeatureType,
} from '#shared/types/api/map'

definePageMeta({ layout: 'app' })

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const { request } = useApi()
const canWriteContent = inject('campaignCanWriteContent', computed(() => true))

const { data: maps, pending, refresh, error } = await useAsyncData(
  () => `campaign-maps-${campaignId.value}`,
  () => request<CampaignMapSummaryDto[]>(`/api/campaigns/${campaignId.value}/maps`)
)

const selectedMapId = ref('')
watch(
  maps,
  (value) => {
    if (!value?.length) {
      selectedMapId.value = ''
      return
    }
    if (!selectedMapId.value || !value.find((entry) => entry.id === selectedMapId.value)) {
      selectedMapId.value = value.find((entry) => entry.isPrimary)?.id || value[0]!.id
    }
  },
  { immediate: true }
)

const selectedMap = computed(() =>
  (maps.value || []).find((entry) => entry.id === selectedMapId.value) || null
)

const { data: viewer, pending: viewerPending, refresh: refreshViewer } = await useAsyncData(
  () => `campaign-map-viewer-${campaignId.value}-${selectedMapId.value || 'none'}`,
  () =>
    selectedMapId.value
      ? request<CampaignMapViewerDto>(
          `/api/campaigns/${campaignId.value}/maps/${selectedMapId.value}/viewer`
        )
      : Promise.resolve(null),
  {
    watch: [selectedMapId],
  }
)

const selectedMapHasSvg = computed(() => Boolean(selectedMap.value?.hasSvg))
const svgViewerUrl = computed(() =>
  selectedMapId.value
    ? `/api/campaigns/${campaignId.value}/maps/${selectedMapId.value}/svg?v=${selectedMap.value?.importVersion || 0}`
    : ''
)

const importName = ref('')
const importPrimary = ref(false)
const importFiles = ref<File[] | null>(null)
const importError = ref('')
const importing = ref(false)
const importModalOpen = ref(false)

const hasImportedMaps = computed(() => (maps.value?.length || 0) > 0)
const hasPrimaryMap = computed(() => (maps.value || []).some((entry) => entry.isPrimary))
const importPrimaryDisabled = computed(() => hasPrimaryMap.value)

watch(
  [hasImportedMaps, hasPrimaryMap],
  ([hasMaps, hasPrimary]) => {
    if (!hasMaps) {
      importPrimary.value = true
      return
    }
    if (hasPrimary) {
      importPrimary.value = false
    }
  },
  { immediate: true }
)

const importMap = async () => {
  if (!canWriteContent.value) return
  importError.value = ''
  if (!importFiles.value?.length) {
    importError.value = 'Select at least one file and include the Full JSON export.'
    return
  }

  importing.value = true
  try {
    const formData = new FormData()
    if (importName.value.trim()) {
      formData.set('name', importName.value.trim())
    }
    formData.set('isPrimary', importPrimary.value ? 'true' : 'false')
    for (const file of importFiles.value) {
      formData.append('file', file, file.name)
    }

    const created = await request<CampaignMapSummaryDto>(
      `/api/campaigns/${campaignId.value}/maps`,
      {
        method: 'POST',
        body: formData,
      }
    )
    importName.value = ''
    importPrimary.value = !hasImportedMaps.value
    importFiles.value = null
    importModalOpen.value = false
    await refresh()
    selectedMapId.value = created.id
    await refreshViewer()
  } catch (error) {
    importError.value = (error as Error).message || 'Unable to import map files.'
  } finally {
    importing.value = false
  }
}

const mapEditName = ref('')
const mapEditStatus = ref<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
watch(
  selectedMap,
  (value) => {
    mapEditName.value = value?.name || ''
    mapEditStatus.value = value?.status || 'ACTIVE'
  },
  { immediate: true }
)

const savingMap = ref(false)
const mapSaveError = ref('')

const saveMapMeta = async () => {
  if (!canWriteContent.value) return
  if (!selectedMap.value) return
  savingMap.value = true
  mapSaveError.value = ''
  try {
    await request(`/api/campaigns/${campaignId.value}/maps/${selectedMap.value.id}`, {
      method: 'PATCH',
      body: {
        name: mapEditName.value,
        status: mapEditStatus.value,
      },
    })
    await refresh()
    await refreshViewer()
  } catch (error) {
    mapSaveError.value = (error as Error).message || 'Unable to update map settings.'
  } finally {
    savingMap.value = false
  }
}

const setPrimary = async (mapId: string) => {
  if (!canWriteContent.value) return
  await request(`/api/campaigns/${campaignId.value}/maps/${mapId}/set-primary`, {
    method: 'POST',
  })
  await refresh()
}

const deleteError = ref('')
const deletingMapId = ref('')

const deleteMap = async (mapId: string) => {
  if (!canWriteContent.value) return
  deleteError.value = ''
  const target = (maps.value || []).find((entry) => entry.id === mapId)
  if (!target) return
  const confirmed = window.confirm(
    `Delete map "${target.name}"? This removes its imported files, features, and map glossary links.`
  )
  if (!confirmed) return

  deletingMapId.value = mapId
  try {
    await request(`/api/campaigns/${campaignId.value}/maps/${mapId}`, {
      method: 'DELETE',
    })
    if (selectedMapId.value === mapId) {
      selectedMapId.value = ''
    }
    selectedFeatureIds.value = []
    await refresh()
    await refreshViewer()
  } catch (error) {
    deleteError.value = (error as Error).message || 'Unable to delete map.'
  } finally {
    deletingMapId.value = ''
  }
}

const activeLayers = ref<MapFeatureType[]>(['state', 'marker', 'river', 'burg', 'route'])
const glossaryPointsOnly = ref(false)
const selectedFeatureIds = ref<string[]>([])
const selectedFeatureLabels = computed(() => {
  const byId = new Map((viewer.value?.features || []).map((feature) => [feature.id, feature]))
  return selectedFeatureIds.value
    .map((id) => byId.get(id))
    .filter((entry): entry is CampaignMapViewerDto['features'][number] => Boolean(entry))
    .map((entry) => ({
      id: entry.id,
      name: String(entry.properties.displayName || entry.id),
      type: String(entry.properties.featureType || ''),
    }))
})

const stageOpen = ref(false)
const stageResult = ref<MapGlossaryCommitResultDto | null>(null)
const onStageCommitted = async (result: MapGlossaryCommitResultDto) => {
  stageResult.value = result
  selectedFeatureIds.value = []
}

const reimportFiles = ref<File[] | null>(null)
const reimportError = ref('')
const reimportPreview = ref<MapReimportPreviewDto | null>(null)
const reimportModalOpen = ref(false)
const reimporting = ref(false)
const applyStrategy = ref<MapReimportStrategy>('replace_preserve_links')
const applyMapName = ref('')
const applyKeepPrimary = ref(false)

const previewReimport = async () => {
  if (!canWriteContent.value) return
  if (!selectedMap.value || !reimportFiles.value?.length) {
    reimportError.value = 'Choose re-import files first.'
    return
  }
  reimportError.value = ''
  reimporting.value = true
  try {
    const formData = new FormData()
    for (const file of reimportFiles.value) {
      formData.append('file', file, file.name)
    }
    const preview = await request<MapReimportPreviewDto>(
      `/api/campaigns/${campaignId.value}/maps/${selectedMap.value.id}/reimport`,
      {
        method: 'POST',
        body: formData,
      }
    )
    reimportPreview.value = preview
    applyStrategy.value = preview.availableStrategies[0] || 'replace_preserve_links'
    applyMapName.value = selectedMap.value.name
    applyKeepPrimary.value = selectedMap.value.isPrimary
    reimportModalOpen.value = true
  } catch (error) {
    reimportError.value = (error as Error).message || 'Unable to generate re-import preview.'
  } finally {
    reimporting.value = false
  }
}

const applyReimport = async () => {
  if (!canWriteContent.value) return
  if (!selectedMap.value || !reimportFiles.value?.length) return
  reimporting.value = true
  reimportError.value = ''
  try {
    const formData = new FormData()
    for (const file of reimportFiles.value) {
      formData.append('file', file, file.name)
    }
    formData.set('strategy', applyStrategy.value)
    if (applyMapName.value.trim()) {
      formData.set('mapName', applyMapName.value.trim())
    }
    formData.set('keepPrimary', applyKeepPrimary.value ? 'true' : 'false')
    await request(
      `/api/campaigns/${campaignId.value}/maps/${selectedMap.value.id}/reimport/apply`,
      {
        method: 'POST',
        body: formData,
      }
    )
    reimportModalOpen.value = false
    reimportPreview.value = null
    reimportFiles.value = null
    selectedFeatureIds.value = []
    await refresh()
    await refreshViewer()
  } catch (error) {
    reimportError.value = (error as Error).message || 'Unable to apply re-import strategy.'
  } finally {
    reimporting.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <UAlert
      v-if="!canWriteContent"
      color="warning"
      variant="subtle"
      title="Read-only access"
      description="Your role can view maps but cannot import, edit, or delete them."
    />

    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Campaign maps</p>
        <h1 class="mt-1 text-2xl font-semibold">Import and explore maps</h1>
      </div>
      <UBadge v-if="selectedMap" color="primary" variant="subtle">
        Active map: {{ selectedMap.name }}
      </UBadge>
    </div>

    <UCard v-if="!hasImportedMaps && canWriteContent">
      <template #header>
        <h2 class="text-lg font-semibold">Import Azgaar export</h2>
      </template>
      <MapsImportForm
        :name="importName"
        :primary="importPrimary"
        :files="importFiles"
        :importing="importing"
        :error-message="importError"
        :primary-disabled="importPrimaryDisabled"
        @update:name="importName = $event"
        @update:primary="importPrimary = $event"
        @update:files="importFiles = $event"
        @submit="importMap"
      />
    </UCard>
    <UCard v-else-if="!hasImportedMaps && !pending && !error">
      <p class="text-sm text-muted">
        No maps are available yet. Your role is read-only, so only owners and collaborators can import maps.
      </p>
    </UCard>

    <div v-if="pending" class="space-y-3">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-[420px] w-full" />
    </div>

    <UCard v-else-if="error" class="text-center">
      <p class="text-sm text-error">Unable to load campaign maps.</p>
      <UButton class="mt-3" variant="outline" @click="refresh">Retry</UButton>
    </UCard>

    <div v-else class="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div class="space-y-4">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-base font-semibold">Maps</h2>
              <UBadge variant="subtle">{{ maps?.length || 0 }}</UBadge>
            </div>
          </template>
          <div class="space-y-2">
            <div
              v-for="map in maps || []"
              :key="map.id"
              class="theme-nav-link flex w-full items-center justify-between rounded-md px-3 py-2 text-left"
              :class="selectedMapId === map.id ? 'ring-2 ring-primary/40' : ''"
            >
              <button
                type="button"
                class="min-w-0 flex-1 text-left"
                @click="selectedMapId = map.id"
              >
                <span class="block text-sm font-semibold">{{ map.name }}</span>
                <span class="block text-[11px] uppercase tracking-[0.2em] text-dimmed">
                  v{{ map.importVersion }} · {{ map.status }}
                </span>
              </button>
              <div class="flex items-center gap-2">
                <UBadge v-if="map.isPrimary" color="success" variant="subtle">Primary</UBadge>
                <UButton
                  v-else
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  :disabled="!canWriteContent"
                  @click.stop="setPrimary(map.id)"
                >
                  Set primary
                </UButton>
                <UButton
                  size="xs"
                  variant="ghost"
                  color="error"
                  :disabled="!canWriteContent"
                  :loading="deletingMapId === map.id"
                  @click.stop="deleteMap(map.id)"
                >
                  Delete
                </UButton>
              </div>
            </div>
            <p v-if="!maps?.length" class="text-sm text-muted">No maps imported yet.</p>
            <p v-if="deleteError" class="text-sm text-error">{{ deleteError }}</p>
            <UButton
              v-if="hasImportedMaps"
              class="mt-2 w-full"
              color="neutral"
              variant="outline"
              :disabled="!canWriteContent"
              @click="importModalOpen = true"
            >
              Import another map
            </UButton>
          </div>
        </UCard>

        <MapsLayerPanel v-model="activeLayers" />

        <UCard>
          <template #header>
            <h3 class="text-base font-semibold">Map settings</h3>
          </template>
          <div v-if="selectedMap" class="space-y-3">
            <UFormField label="Map name">
              <UInput v-model="mapEditName" :disabled="!canWriteContent" />
            </UFormField>
            <UFormField label="Status">
              <USelect
                v-model="mapEditStatus"
                :disabled="!canWriteContent"
                :items="[
                  { label: 'Active', value: 'ACTIVE' },
                  { label: 'Archived', value: 'ARCHIVED' },
                ]"
              />
            </UFormField>
            <div class="flex items-center gap-2">
              <UButton :loading="savingMap" :disabled="!canWriteContent" @click="saveMapMeta">Save map</UButton>
              <UButton
                color="error"
                variant="ghost"
                :disabled="!canWriteContent"
                :loading="deletingMapId === selectedMap.id"
                @click="deleteMap(selectedMap.id)"
              >
                Delete map
              </UButton>
              <p v-if="mapSaveError" class="text-sm text-error">{{ mapSaveError }}</p>
            </div>
          </div>
          <p v-else class="text-sm text-muted">Choose a map to edit settings.</p>
        </UCard>
      </div>

      <div class="space-y-4">
        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="text-lg font-semibold">Map viewer</h2>
              <div class="flex flex-wrap items-center gap-2">
                <UCheckbox
                  v-model="glossaryPointsOnly"
                  label="Show glossary features only"
                  :disabled="!selectedMapId"
                />
                <UButton
                  size="sm"
                  :disabled="!canWriteContent || !selectedFeatureIds.length || !selectedMapId"
                  :title="canWriteContent ? undefined : 'Read-only role cannot stage glossary actions'"
                  @click="stageOpen = true"
                >
                  Stage for glossary ({{ selectedFeatureIds.length }})
                </UButton>
              </div>
            </div>
          </template>

          <div v-if="viewerPending" class="space-y-2">
            <USkeleton class="h-[420px] w-full" />
          </div>
          <div v-else-if="viewer">
            <ClientOnly>
              <MapsViewer
                :key="`geojson-${selectedMapId}-${selectedMap?.importVersion || 0}`"
                :viewer="viewer"
                :svg-background-url="selectedMapHasSvg ? svgViewerUrl : ''"
                :active-layers="activeLayers"
                :selected-feature-ids="selectedFeatureIds"
                :glossary-points-only="glossaryPointsOnly"
                @update:selected-feature-ids="selectedFeatureIds = $event"
              />
            </ClientOnly>
          </div>
          <p v-else class="text-sm text-muted">Select a map to load the viewer.</p>
        </UCard>

        <UCard>
          <template #header>
            <h3 class="text-base font-semibold">Selection</h3>
          </template>
          <div class="space-y-2">
            <div class="flex flex-wrap gap-2">
              <UBadge
                v-for="feature in selectedFeatureLabels"
                :key="feature.id"
                variant="subtle"
                color="secondary"
              >
                {{ feature.name }} ({{ feature.type }})
              </UBadge>
            </div>
            <p v-if="!selectedFeatureLabels.length" class="text-sm text-muted">
              Click features on the map to stage glossary actions.
            </p>
            <UButton
              v-if="selectedFeatureLabels.length"
              size="sm"
              variant="ghost"
              color="neutral"
              :disabled="!canWriteContent"
              @click="selectedFeatureIds = []"
            >
              Clear selection
            </UButton>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h3 class="text-base font-semibold">Re-import / update</h3>
          </template>
          <div class="space-y-3">
            <UFileUpload
              v-model="reimportFiles"
              multiple
              :disabled="!canWriteContent"
              label="Upload replacement files"
              accept=".json,.geojson,.svg"
              description="Preview diff first, then choose apply strategy."
            />
            <div class="flex items-center gap-2">
              <UButton :loading="reimporting" :disabled="!canWriteContent || !selectedMap" @click="previewReimport">
                Preview re-import diff
              </UButton>
              <p v-if="reimportError" class="text-sm text-error">{{ reimportError }}</p>
            </div>
          </div>
        </UCard>

        <UAlert
          v-if="stageResult"
          color="success"
          variant="subtle"
          title="Glossary commit completed"
          :description="`Created ${stageResult.created}, linked ${stageResult.linked}, merged ${stageResult.merged}, skipped ${stageResult.skipped}.`"
        />
      </div>
    </div>

    <MapsGlossaryStageModal
      v-model:open="stageOpen"
      :campaign-id="campaignId"
      :map-id="selectedMapId"
      :feature-ids="selectedFeatureIds"
      @committed="onStageCommitted"
    />

    <UModal
      v-model:open="importModalOpen"
      :dismissible="!importing"
      title="Import Azgaar export"
      description="Import a full Azgaar JSON export with optional SVG and GeoJSON artifacts."
    >
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">Import Azgaar export</h3>
          </template>
          <MapsImportForm
            :name="importName"
            :primary="importPrimary"
            :files="importFiles"
            :importing="importing"
            :error-message="importError"
            :primary-disabled="importPrimaryDisabled"
            @update:name="importName = $event"
            @update:primary="importPrimary = $event"
            @update:files="importFiles = $event"
            @submit="importMap"
          />
        </UCard>
      </template>
    </UModal>

    <UModal
      v-model:open="reimportModalOpen"
      :dismissible="!reimporting"
      title="Apply re-import strategy"
      description="Review map diff and apply a re-import strategy to update this map."
    >
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">Apply re-import strategy</h3>
          </template>
          <div v-if="reimportPreview" class="space-y-3">
            <div class="grid gap-2 sm:grid-cols-2">
              <UAlert color="info" variant="subtle" :description="`Added features: ${reimportPreview.diff.added}`" />
              <UAlert color="warning" variant="subtle" :description="`Removed features: ${reimportPreview.diff.removed}`" />
              <UAlert color="secondary" variant="subtle" :description="`Changed features: ${reimportPreview.diff.changed}`" />
              <UAlert color="neutral" variant="subtle" :description="`Impacted glossary links: ${reimportPreview.diff.impactedGlossaryLinks}`" />
            </div>
            <UFormField label="Strategy">
              <USelect
                v-model="applyStrategy"
                :items="[
                  { label: 'Replace and preserve links', value: 'replace_preserve_links' },
                  { label: 'Replace and relink by name', value: 'replace_relink_by_name' },
                  { label: 'Create as a new map', value: 'create_new_map' },
                ]"
              />
            </UFormField>
            <UFormField label="Map name">
              <UInput v-model="applyMapName" />
            </UFormField>
            <UCheckbox v-model="applyKeepPrimary" label="Set result as primary map" />
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton variant="ghost" color="neutral" :disabled="reimporting" @click="reimportModalOpen = false">
                Cancel
              </UButton>
              <UButton :loading="reimporting" @click="applyReimport">
                Apply strategy
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
