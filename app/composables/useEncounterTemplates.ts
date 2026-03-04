import type {
  EncounterTemplateCreateInput,
  EncounterTemplateInstantiateInput,
  EncounterTemplateUpdateInput,
} from '#shared/schemas/encounter'
import type { EncounterTemplate } from '#shared/types/encounter'

export function useEncounterTemplates() {
  const { request } = useApi()

  const listTemplates = async (campaignId: string) =>
    request<EncounterTemplate[]>(`/api/campaigns/${campaignId}/encounters/templates`)

  const createTemplate = async (campaignId: string, input: EncounterTemplateCreateInput) =>
    request<EncounterTemplate>(`/api/campaigns/${campaignId}/encounters/templates`, {
      method: 'POST',
      body: input,
    })

  const updateTemplate = async (templateId: string, input: EncounterTemplateUpdateInput) =>
    request<EncounterTemplate>(`/api/encounters/templates/${templateId}`, {
      method: 'PATCH',
      body: input,
    })

  const deleteTemplate = async (templateId: string) =>
    request(`/api/encounters/templates/${templateId}`, {
      method: 'DELETE',
    })

  const instantiateTemplate = async (templateId: string, input: EncounterTemplateInstantiateInput) =>
    request(`/api/encounters/templates/${templateId}/instantiate`, {
      method: 'POST',
      body: input,
    })

  return {
    listTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    instantiateTemplate,
  }
}