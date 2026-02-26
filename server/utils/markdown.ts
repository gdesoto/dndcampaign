import { parseMarkdown } from '@nuxtjs/mdc/runtime'

export type ParsedCampaignMarkdown = Awaited<ReturnType<typeof parseMarkdown>>

export const parseCampaignMarkdown = async (
  markdown: string
): Promise<ParsedCampaignMarkdown> =>
  parseMarkdown(markdown ?? '', {
    toc: {
      depth: 2,
      searchDepth: 2,
    },
  })
