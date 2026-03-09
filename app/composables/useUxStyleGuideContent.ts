import type { TabsItem } from '@nuxt/ui'

export type Principle = {
  title: string
  source: string
  guidance: string
  example: string
}

export type Guideline = {
  title: string
  intent: string
  practices: string[]
}

export type DensityTip = {
  title: string
  guidance: string
}

export type SessionPanel = {
  title: string
  description: string
  bullets: string[]
}

export type QuestRow = {
  quest: string
  status: string
  patron: string
  relevance: string
  updated: string
}

export type TrackerExample = {
  title: string
  summary: string
  good: string[]
  bad: string[]
}

export type NpcExample = {
  name: string
  faction: string
  location: string
  relationship: string
  status: string
}

export type CharacterStat = {
  label: string
  value: string
}

export type SessionBeat = {
  title: string
  note: string
}

export type MapLocation = {
  name: string
  detail: string
}

export type PlayerNote = {
  title: string
  meta: string
  excerpt: string
}

export type PreviewTile = {
  eyebrow: string
  title: string
  detail: string
}

export type FeedbackState = {
  label: string
  color: 'warning' | 'success' | 'error'
}

export type UxGuidePageMeta = {
  title: string
  to: string
  icon: string
  description: string
}

export type DndCharacter = {
  name: string
  class: string
  subclass: string
  race: string
  level: number
  hp: number
  maxHp: number
  ac: number
  speed: number
  passivePerception: number
  proficiencyBonus: number
  conditions: string[]
  icon: string
}

export type DndConditionChip = {
  name: string
  icon: string
  color: 'error' | 'warning' | 'info' | 'success' | 'neutral'
}

export type DndCombatant = {
  name: string
  type: 'pc' | 'npc' | 'monster'
  initiative: number
  hp: number
  maxHp: number
  ac: number
  conditions: string[]
  icon: string
  isActive: boolean
}

export type DndFactionCard = {
  name: string
  motto: string
  territory: string
  influence: 'minor' | 'moderate' | 'major' | 'dominant'
  relation: 'allied' | 'neutral' | 'hostile' | 'unknown'
  icon: string
  keyNpcs: string[]
  color: 'success' | 'info' | 'warning' | 'error' | 'neutral'
}

export type DndSpellSlotTrack = {
  level: number
  total: number
  used: number
}

export type DndItem = {
  name: string
  type: string
  rarity: 'common' | 'uncommon' | 'rare' | 'very rare' | 'legendary' | 'artifact'
  requiresAttunement: boolean
  description: string
  icon: string
  isAttuned: boolean
}

export type DndLocationCard = {
  name: string
  region: string
  status: 'explored' | 'known' | 'rumored' | 'dangerous'
  description: string
  connectedQuests: string[]
  icon: string
  dangerLevel: number
}

export type DndThreatClock = {
  name: string
  description: string
  segments: number
  filled: number
  consequence: string
  urgency: 'error' | 'warning' | 'info'
}

export type DndQuestObjective = {
  text: string
  complete: boolean
}

export type DndQuestDetailed = {
  title: string
  status: 'active' | 'blocked' | 'complete' | 'ready'
  patron: string
  patronIcon: string
  reward: string
  objectives: DndQuestObjective[]
  nextHook: string
}

export type DndQuestListEntry = {
  title: string
  status: 'active' | 'blocked' | 'complete' | 'ready'
  patron: string
  updated: string
  urgency: 'critical' | 'high' | 'normal' | 'low'
}

export type DndSessionEntry = {
  number: number
  title: string
  date: string
  status: 'upcoming' | 'played' | 'draft'
  hasRecap: boolean
  hasRecording: boolean
  playerCount: number
}

export type DndMilestone = {
  title: string
  description: string
  session: string
  complete: boolean
  arc: string
}

export type DndAudioTrack = {
  session: number
  title: string
  duration: string
  date: string
  fileSize: string
}

export type DndNpcListEntry = {
  name: string
  faction: string
  location: string
  status: string
  lastSeen: string
  icon: string
  relation: 'ally' | 'neutral' | 'suspect' | 'hostile'
}

export const uxGuidePages: UxGuidePageMeta[] = [
  {
    title: 'Overview',
    to: '/docs/ux-style-guide',
    icon: 'i-lucide-book-open',
    description: 'How to use the guide and the core campaign UX pillars.',
  },
  {
    title: 'Philosophy',
    to: '/docs/ux-style-guide/philosophy',
    icon: 'i-lucide-compass',
    description: 'Nielsen, Norman, progressive disclosure, and narrative-first interface thinking.',
  },
  {
    title: 'Layouts',
    to: '/docs/ux-style-guide/layouts',
    icon: 'i-lucide-layout-dashboard',
    description: 'Dashboards, campaign routes, character pages, and scene-prep compositions.',
  },
  {
    title: 'Components',
    to: '/docs/ux-style-guide/components',
    icon: 'i-lucide-component',
    description: 'Nuxt UI patterns for cards, panels, modals, tabs, tables, buttons, badges, and forms.',
  },
  {
    title: 'Interaction',
    to: '/docs/ux-style-guide/interaction',
    icon: 'i-lucide-mouse-pointer-click',
    description: 'Hover, click, focus, shortcuts, row actions, and feedback behavior.',
  },
  {
    title: 'Readability',
    to: '/docs/ux-style-guide/readability',
    icon: 'i-lucide-table-properties',
    description: 'Screen real estate, data density, maps, notes, and readable campaign information.',
  },
  {
    title: 'D&D Components',
    to: '/docs/ux-style-guide/dnd-components',
    icon: 'i-lucide-swords',
    description: 'Character cards, quest logs, initiative trackers, faction displays, and other D&D-specific shared components.',
  },
]

export const principles: Principle[] = [
  {
    title: 'Keep the world state legible',
    source: 'Nielsen: visibility of system status',
    guidance:
      'Every campaign screen should make status obvious within a glance: what session is upcoming, which quest is blocked, which NPC note changed, and whether a save succeeded.',
    example:
      'A quest board should surface state badges such as Active, Blocked, Completed, and show the latest milestone timestamp near the title.',
  },
  {
    title: 'Match the DM mental model',
    source: 'Nielsen: match between system and the real world',
    guidance:
      'Use language from tabletop play rather than generic product language. Organize information by campaign, arc, session, scene, NPC, quest, and note instead of abstract admin buckets.',
    example:
      'Label a timeline section Session Recap instead of Activity Feed when the content is notes, decisions, and player outcomes from play.',
  },
  {
    title: 'Make actions feel obvious',
    source: 'Norman: affordances and mapping',
    guidance:
      'Primary actions should look primary, destructive actions should look dangerous, and controls should sit near the content they affect.',
    example:
      'Place Add NPC and Add Quest in the relevant panel header; place Archive Campaign in a guarded menu or confirmation flow.',
  },
  {
    title: 'Reveal complexity in steps',
    source: 'Progressive disclosure',
    guidance:
      'Default screens should favor orientation and next actions first. Advanced filters, audit history, and verbose metadata should appear only when asked for.',
    example:
      'A session page should first show summary, agenda, player notes, and encounters; transcript chunks and export controls can live in secondary tabs or panels.',
  },
  {
    title: 'Use hierarchy to guide scanning',
    source: 'Visual hierarchy',
    guidance:
      'The eye should land on page title, current campaign context, critical actions, then supporting data. Avoid equal-weight panels fighting for attention.',
    example:
      'A character sheet should elevate HP, conditions, class, and core stats before inventory metadata or long-form backstory.',
  },
]

export const layoutGuidelines: Guideline[] = [
  {
    title: 'Dashboard views',
    intent: 'Dashboards are for triage and orientation.',
    practices: [
      'Keep the left navigation route-based and persistent; do not replace campaign section navigation with in-page tabs.',
      'Reserve the page header for current scope, a one-sentence summary, and the 1-3 highest value actions.',
      'Use cards for grouped summaries: active quests, upcoming session prep, unresolved NPC threads, and recent player notes.',
      'Keep dense lists below summary cards so the top of the screen answers what needs attention now.',
    ],
  },
  {
    title: 'Campaign views',
    intent: 'Campaign pages should show narrative context and operational detail together.',
    practices: [
      'Lead with campaign identity: title, tone, current arc, next session date, and campaign health indicators.',
      'Split content into meaningful zones such as Story, People, Places, and Logistics rather than one long undifferentiated page.',
      'Use tabs only for mode changes inside the same route, such as Overview, Session Timeline, and Assets.',
      'Keep map, recording, or transcript regions bounded so they do not push critical notes below the fold on desktop.',
    ],
  },
  {
    title: 'Character sheets',
    intent: 'Character pages should support fast recall during live play.',
    practices: [
      'Pin quick-reference data near the top: ancestry, class, level, HP, armor class, speed, passive scores, and conditions.',
      'Group information by play frequency: combat and spell details before biography and archived notes.',
      'Use collapsible or secondary panels for niche details like downtime logs, private hooks, and long inventories.',
      'Preserve a clean reading rhythm with two-column desktop layouts that collapse to a single clear stack on mobile.',
    ],
  },
]

export const realEstateTips: DensityTip[] = [
  {
    title: 'Treat the first viewport as briefing space',
    guidance:
      'Use it for orientation, status, and top actions. Do not consume the entire first screen with decorative banners or oversized empty padding.',
  },
  {
    title: 'Let dense content breathe through grouping, not whitespace excess',
    guidance:
      'Compact cards, bordered sections, and muted labels work better than giant gutters when the user is actively managing quests, NPCs, and sessions.',
  },
  {
    title: 'Keep parallel information aligned',
    guidance:
      'In two-column layouts, pair related content such as current session notes with initiative or encounter details. Avoid unrelated panels that force context switching.',
  },
  {
    title: 'Use the right rail for optional support',
    guidance:
      'On docs and dense campaign pages, reserve the right side for secondary navigation, metadata, shortcuts, or filters that should not dominate the main task.',
  },
]

export const densityGuidelines: DensityTip[] = [
  {
    title: 'Show summary before detail',
    guidance:
      'For a quest table, lead with status, assignee, next hook, and due session; expose long descriptions on row expand or detail view.',
  },
  {
    title: 'Prefer semantic labels over decorative chrome',
    guidance:
      'Muted uppercase labels, concise badges, and predictable icon use improve readability more than ornamental visual effects.',
  },
  {
    title: 'Design for scan paths',
    guidance:
      'Align timestamps, statuses, and ownership fields consistently so the eye can sweep the same column or edge across sessions and notes.',
  },
  {
    title: 'Use progressive disclosure for metadata',
    guidance:
      'Transcript IDs, storage paths, import provenance, and debug fields should stay hidden behind details toggles or admin-only panels.',
  },
]

export const trackerExamples: TrackerExample[] = [
  {
    title: 'Quest tracker',
    summary: 'Quest interfaces should answer what is active, why it matters, and what is blocked before exposing lore depth.',
    good: [
      'Show quest title, status, patron, next-session relevance, and updated time in the default list view.',
      'Group supporting details into clear regions such as Objectives, Related NPCs, and GM Notes.',
      'Use row expansion or a detail route for long summaries, hidden twists, and transcript references.',
    ],
    bad: [
      'Leading with full lore dumps before the player-facing objective is visible.',
      'Mixing unrelated side quests, rumor fragments, and map annotations into the same card or row.',
    ],
  },
  {
    title: 'NPC directory',
    summary: 'NPC UI should optimize recognition and relationship recall during live play.',
    good: [
      'Surface portrait, faction, location, relationship to the party, and last appearance first.',
      'Keep secret motives and GM-only reveals behind secondary disclosure instead of in the default table.',
      'Provide fast actions like Link to quest, Add session note, and Mark as recurring contact near the NPC header.',
    ],
    bad: [
      'Treating NPC records like generic contacts with no narrative context.',
      'Forcing the user to open each profile just to learn whether the NPC matters this session.',
    ],
  },
  {
    title: 'Session workspace',
    summary: 'Session screens should support active DMing, not archive browsing.',
    good: [
      'Lead with recap, agenda, unresolved hooks, initiative or encounter context, and player notes.',
      'Use tabs for Summary, Player Notes, Recording, and Assets within the same route.',
      'Keep map, audio, and transcript tools bounded so the primary session summary remains visible.',
    ],
    bad: [
      'Pushing session recap below a massive media player or transcript region.',
      'Splitting tightly related live-play information across too many routes.',
    ],
  },
  {
    title: 'Character sheets',
    summary: 'Character views should privilege in-session reference over encyclopedic completeness.',
    good: [
      'Keep HP, armor class, speed, passive scores, conditions, and class/level near the top.',
      'Group content by usage frequency: combat and spells first, biography and downtime later.',
      'Use concise badges or panels for current status effects, exhaustion, or active boons.',
    ],
    bad: [
      'Burying current combat stats below backstory text and long inventory lists.',
      'Using tabs for unrelated top-level navigation instead of route-level character sections.',
    ],
  },
  {
    title: 'Maps and locations',
    summary: 'Map interfaces should preserve orientation while keeping note-taking and context close at hand.',
    good: [
      'Keep the map canvas bounded and pair it with nearby legend, pinned notes, or location details.',
      'Use secondary panels for DM annotations, fog-of-war notes, and linked quest hooks.',
      'Make location labels and layer toggles readable before relying on hover-only interaction.',
    ],
    bad: [
      'Letting the map dominate the entire page so notes and related actions fall below the fold.',
      'Hiding every useful control behind nested menus or hover-only affordances.',
    ],
  },
  {
    title: 'Player notes',
    summary: 'Player note UI should encourage quick capture and easy scanning.',
    good: [
      'Use short titles, obvious save actions, timestamps, and author information.',
      'Separate public note excerpts from GM-only commentary or adjudication notes.',
      'Support quick filtering by session, character, or quest without forcing a full-page search flow.',
    ],
    bad: [
      'Presenting one giant textarea with no context, no prompt, and no visible save state.',
      'Mixing DM adjudication notes directly into player-facing prose with no distinction.',
    ],
  },
]

export const npcExamples: NpcExample[] = [
  {
    name: 'Captain Mirel',
    faction: 'Harbor Watch',
    location: 'South Docks',
    relationship: 'Uneasy ally',
    status: 'Recurring',
  },
  {
    name: 'Seraphine Vale',
    faction: 'High Curators',
    location: 'Archive Spire',
    relationship: 'Quest patron',
    status: 'Active',
  },
  {
    name: 'Tallow Venn',
    faction: 'Ash Market',
    location: 'Night Bazaar',
    relationship: 'Suspect',
    status: 'Hidden motive',
  },
]

export const sessionBeats: SessionBeat[] = [
  {
    title: 'Recap',
    note: 'The party recovered the brass astrolabe but drew attention from the Harbor Watch.',
  },
  {
    title: 'Immediate hook',
    note: 'Captain Mirel asks for a private meeting before the observatory vault opens.',
  },
  {
    title: 'Prep risk',
    note: 'Players may skip the docks and head straight to the archive cellar entrance.',
  },
]

export const characterStats: CharacterStat[] = [
  { label: 'HP', value: '41 / 52' },
  { label: 'AC', value: '17' },
  { label: 'Speed', value: '30 ft' },
  { label: 'Passive Perception', value: '15' },
]

export const mapLocations: MapLocation[] = [
  { name: 'Collapsed Stair', detail: 'Hidden access to the lower archive vaults.' },
  { name: 'Flooded Chapel', detail: 'Contains drowned sigils tied to the Moonstone Lens.' },
  { name: 'Smuggler Dock', detail: 'Escape route linked to Captain Mirel.' },
]

export const playerNotes: PlayerNote[] = [
  {
    title: 'Mirel knows more than he admits',
    meta: 'Session 12 • Rowan • 8:43 PM',
    excerpt: 'He flinched when Seraphine mentioned the drowned bells. Ask about the sealed ledger next session.',
  },
  {
    title: 'Vault sigil sketch',
    meta: 'Session 12 • Iri • 9:05 PM',
    excerpt: 'Looks like the chapel mural and the catacomb gate use the same crescent marking.',
  },
]

export const dashboardPreviewCards: PreviewTile[] = [
  {
    eyebrow: 'Burning thread',
    title: 'Recover the Moonstone Lens before moonrise',
    detail: 'If the party arrives late, the observatory wards awaken hostile echoes.',
  },
  {
    eyebrow: 'Tonight’s omen',
    title: 'The drowned bells ring beneath the archive',
    detail: 'Prep the flooded chapel reveal, the bell toll prophecy, and the harbor bargain.',
  },
  {
    eyebrow: 'Player suspicion',
    title: 'The party thinks Mirel forged the saint-ledger',
    detail: 'Keep this visible so the next confrontation feels reactive, not pre-scripted.',
  },
]

export const campaignViewZones: PreviewTile[] = [
  {
    eyebrow: 'Story pressure',
    title: 'The bells wake what the city buried',
    detail: 'The current arc ties prophetic dreams, drowned saints, and a sealed observatory vault.',
  },
  {
    eyebrow: 'People in conflict',
    title: 'Mirel, Seraphine, and the Lantern Court',
    detail: 'Three factions want the lens for different reasons, and the party is caught between them.',
  },
  {
    eyebrow: 'Places in play',
    title: 'Chapel crypt, drowned archive, smuggler dock',
    detail: 'Each location advances the mystery in a different tone: holy dread, buried knowledge, or betrayal.',
  },
  {
    eyebrow: 'Table logistics',
    title: 'Handouts, map layers, and whisper notes',
    detail: 'Assets support the scene, but never push the campaign state out of view.',
  },
]

export const characterPreviewSections: PreviewTile[] = [
  {
    eyebrow: 'Fight now',
    title: 'Attacks, conditions, and active boons',
    detail: 'Longbow, moon-sigil blessing, and exhaustion stay visible during tense scenes.',
  },
  {
    eyebrow: 'Travel and scouting',
    title: 'Passive senses, movement, and survival reads',
    detail: 'The ranger’s exploration strengths should be as easy to find as combat data.',
  },
  {
    eyebrow: 'Personal arc',
    title: 'Backstory, debts, and downtime threads',
    detail: 'Personal history still matters, but it should not bury the mechanics used every five minutes.',
  },
]

export const scenePrepCards: PreviewTile[] = [
  {
    eyebrow: 'Cold open',
    title: 'A bell rings where no bell survives',
    detail: 'Begin with river fog, silent streets, and one impossible toll beneath the city.',
  },
  {
    eyebrow: 'Moral choice',
    title: 'Save the dockworkers or chase Mirel',
    detail: 'The session becomes memorable when the interface keeps the dilemma in view.',
  },
  {
    eyebrow: 'Escalation',
    title: 'The saint-statue starts weeping black water',
    detail: 'Surface scene consequences so the DM can pivot quickly when players take a hard turn.',
  },
]

export const ritualTrack = [
  'Bell one: fog fills the crypt',
  'Bell two: drowned shades awaken',
  'Bell three: the vault opens itself',
]

export const rightRailItems = [
  'Jump to current arc',
  'Open pinned NPC',
  'Filter notes by session',
]

export const feedbackStates: FeedbackState[] = [
  { label: 'Saving...', color: 'warning' },
  { label: 'Saved', color: 'success' },
  { label: 'Sync failed', color: 'error' },
]

export const questColumns = [
  { accessorKey: 'quest', header: 'Quest' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'patron', header: 'Patron' },
  { accessorKey: 'relevance', header: 'Next Session' },
  { accessorKey: 'updated', header: 'Updated' },
]

export const questRows: QuestRow[] = [
  {
    quest: 'Recover the Moonstone Lens',
    status: 'Active',
    patron: 'High Curator Seraphine',
    relevance: 'Starts tonight',
    updated: '2h ago',
  },
  {
    quest: 'Question the Harbor Smuggler',
    status: 'Blocked',
    patron: 'Captain Mirel',
    relevance: 'Needs NPC reveal',
    updated: 'Yesterday',
  },
  {
    quest: 'Map the catacombs under Emberfall',
    status: 'Ready',
    patron: 'Party Goal',
    relevance: 'Prep complete',
    updated: '4d ago',
  },
]

export const sessionTabs: TabsItem[] = [
  { label: 'Summary', value: 'summary', icon: 'i-lucide-scroll-text' },
  { label: 'Player Notes', value: 'notes', icon: 'i-lucide-notebook-pen', badge: '3' },
  { label: 'Assets', value: 'assets', icon: 'i-lucide-map' },
]

const defaultSessionPanel: SessionPanel = {
  title: 'Session Summary',
  description: 'Lead with the current state of play, not every artifact attached to the session.',
  bullets: [
    'Put the recap, unresolved hooks, and next-scene prep first.',
    'Show only the most relevant quest and NPC links at this layer.',
    'Hide transcripts and exports behind deeper views.',
  ],
}

export const sessionPanels: Record<string, SessionPanel> = {
  summary: defaultSessionPanel,
  notes: {
    title: 'Player Notes',
    description: 'Player-contributed notes are a sibling view of the session, not a separate route.',
    bullets: [
      'Keep note ownership and timestamp visible.',
      'Separate public note summaries from GM-only annotations.',
      'Support quick scanning with concise excerpts.',
    ],
  },
  assets: {
    title: 'Assets',
    description: 'Maps, recordings, and handouts are useful, but they should not replace session orientation.',
    bullets: [
      'Constrain large media to a bounded region.',
      'Keep downloads and playback actions near the asset itself.',
      'Avoid pushing the recap and agenda below the fold.',
    ],
  },
}

export const questActionItems = [
  [
    { label: 'Pin to session prep', icon: 'i-lucide-pin' },
    { label: 'Link to current map', icon: 'i-lucide-map-pinned' },
    { label: 'Assign NPC owner', icon: 'i-lucide-users' },
  ],
  [
    { label: 'Archive quest', icon: 'i-lucide-archive', color: 'error' },
  ],
]

export const interactionGuidelines = [
  'Hover states should preview interactivity, not replace discoverability. A quest title still needs to look clickable before hover through placement, label clarity, or iconography.',
  'Click targets should be scoped. If a row opens a session, secondary buttons inside that row must not trigger accidental navigation.',
  'Keyboard support is a product feature, not a stretch goal. Every modal, tab set, menu, and table action should be reachable without a mouse.',
  'Shortcuts should map to frequent DM actions: create session note, jump to campaign search, open command palette, save draft. Avoid obscure shortcuts for rare actions.',
  'Feedback should be immediate and specific. Show saving, saved, failed, archived, linked, or synced states in place, close to the affected object.',
]

export const shortcutExamples = [
  { keys: ['G'], description: 'Open global search for campaigns, NPCs, quests, and sessions.' },
  { keys: ['N'], description: 'Create a new note in the current campaign context.' },
  { keys: ['S'], description: 'Save the current draft when focus is inside a form.' },
  { keys: ['/'], description: 'Move focus to page-local search or filter.' },
]

export const dndCharacters: DndCharacter[] = [
  {
    name: 'Rowan Ashwalker',
    class: 'Ranger',
    subclass: 'Gloom Stalker',
    race: 'Wood Elf',
    level: 5,
    hp: 41,
    maxHp: 52,
    ac: 17,
    speed: 35,
    passivePerception: 17,
    proficiencyBonus: 3,
    conditions: [],
    icon: 'i-twemoji-compass',
  },
  {
    name: 'Iri Dawnsworn',
    class: 'Cleric',
    subclass: 'Twilight Domain',
    race: 'High Elf',
    level: 5,
    hp: 22,
    maxHp: 28,
    ac: 15,
    speed: 30,
    passivePerception: 13,
    proficiencyBonus: 3,
    conditions: ['Blessed'],
    icon: 'i-twemoji-sparkles',
  },
  {
    name: 'Corvin Ashmark',
    class: 'Rogue',
    subclass: 'Arcane Trickster',
    race: 'Human',
    level: 5,
    hp: 33,
    maxHp: 38,
    ac: 16,
    speed: 30,
    passivePerception: 16,
    proficiencyBonus: 3,
    conditions: ['Poisoned'],
    icon: 'i-twemoji-crossed-swords',
  },
  {
    name: 'Vesper',
    class: 'Wizard',
    subclass: 'School of Divination',
    race: 'Tiefling',
    level: 5,
    hp: 15,
    maxHp: 30,
    ac: 13,
    speed: 30,
    passivePerception: 12,
    proficiencyBonus: 3,
    conditions: ['Concentrating', 'Exhaustion 1'],
    icon: 'i-twemoji-crystal-ball',
  },
]

export const dndConditions: DndConditionChip[] = [
  { name: 'Blinded', icon: 'i-lucide-eye-off', color: 'neutral' },
  { name: 'Charmed', icon: 'i-lucide-heart', color: 'info' },
  { name: 'Deafened', icon: 'i-lucide-volume-x', color: 'neutral' },
  { name: 'Exhaustion', icon: 'i-lucide-battery-low', color: 'warning' },
  { name: 'Frightened', icon: 'i-lucide-alert-triangle', color: 'warning' },
  { name: 'Grappled', icon: 'i-lucide-link-2', color: 'neutral' },
  { name: 'Incapacitated', icon: 'i-lucide-ban', color: 'error' },
  { name: 'Invisible', icon: 'i-lucide-ghost', color: 'info' },
  { name: 'Paralyzed', icon: 'i-lucide-lock', color: 'error' },
  { name: 'Petrified', icon: 'i-lucide-layers', color: 'neutral' },
  { name: 'Poisoned', icon: 'i-lucide-droplets', color: 'success' },
  { name: 'Prone', icon: 'i-lucide-arrow-down', color: 'neutral' },
  { name: 'Restrained', icon: 'i-lucide-anchor', color: 'warning' },
  { name: 'Stunned', icon: 'i-lucide-zap', color: 'warning' },
  { name: 'Unconscious', icon: 'i-lucide-moon', color: 'error' },
  { name: 'Concentrating', icon: 'i-lucide-brain', color: 'info' },
  { name: 'Blessed', icon: 'i-lucide-star', color: 'success' },
  { name: 'Cursed', icon: 'i-lucide-skull', color: 'error' },
]

export const dndCombatants: DndCombatant[] = [
  {
    name: 'Rowan Ashwalker',
    type: 'pc',
    initiative: 22,
    hp: 41,
    maxHp: 52,
    ac: 17,
    conditions: [],
    icon: 'i-twemoji-compass',
    isActive: true,
  },
  {
    name: 'Ash Shade Cultist',
    type: 'monster',
    initiative: 18,
    hp: 0,
    maxHp: 18,
    ac: 12,
    conditions: ['Unconscious'],
    icon: 'i-twemoji-dragon-face',
    isActive: false,
  },
  {
    name: 'Captain Mirel',
    type: 'npc',
    initiative: 14,
    hp: 24,
    maxHp: 36,
    ac: 16,
    conditions: ['Frightened'],
    icon: 'i-twemoji-crossed-swords',
    isActive: false,
  },
  {
    name: 'Iri Dawnsworn',
    type: 'pc',
    initiative: 9,
    hp: 22,
    maxHp: 28,
    ac: 15,
    conditions: ['Blessed', 'Concentrating'],
    icon: 'i-twemoji-sparkles',
    isActive: false,
  },
]

export const dndFactions: DndFactionCard[] = [
  {
    name: 'Harbor Watch',
    motto: 'Order holds the tide.',
    territory: 'South Docks · Merchant Quarter',
    influence: 'major',
    relation: 'allied',
    icon: 'i-lucide-anchor',
    keyNpcs: ['Captain Mirel', 'Dockmaster Yeva'],
    color: 'info',
  },
  {
    name: 'High Curators',
    motto: 'Knowledge that endures outlasts the knower.',
    territory: 'Archive Spire · Lamp District',
    influence: 'dominant',
    relation: 'neutral',
    icon: 'i-lucide-library',
    keyNpcs: ['Seraphine Vale', 'Archivist Nera'],
    color: 'warning',
  },
  {
    name: 'Ash Market',
    motto: 'Everything has a price. Especially secrets.',
    territory: 'Night Bazaar · Undercroft',
    influence: 'moderate',
    relation: 'hostile',
    icon: 'i-lucide-flame',
    keyNpcs: ['Tallow Venn', 'The Factor'],
    color: 'error',
  },
]

export const dndSpellSlots: DndSpellSlotTrack[] = [
  { level: 1, total: 4, used: 2 },
  { level: 2, total: 3, used: 1 },
  { level: 3, total: 2, used: 0 },
]

export const dndItems: DndItem[] = [
  {
    name: 'Moonstone Lens',
    type: 'Wondrous Item',
    rarity: 'very rare',
    requiresAttunement: true,
    description: 'A lens ground from drowned moonstone. The attuned wearer sees through illusions and perceives invisible entities within 30 feet.',
    icon: 'i-lucide-scan-eye',
    isAttuned: true,
  },
  {
    name: 'Dagger of Warning',
    type: 'Weapon (Dagger)',
    rarity: 'uncommon',
    requiresAttunement: true,
    description: 'While attuned, you cannot be surprised. The blade trembles faintly before danger arrives.',
    icon: 'i-lucide-swords',
    isAttuned: true,
  },
  {
    name: 'Cloak of Elvenkind',
    type: 'Wondrous Item',
    rarity: 'uncommon',
    requiresAttunement: true,
    description: 'While hooded, gain advantage on Dexterity (Stealth) checks. Observers have disadvantage on Perception checks to see you.',
    icon: 'i-lucide-wind',
    isAttuned: false,
  },
  {
    name: 'Sending Stone',
    type: 'Wondrous Item',
    rarity: 'common',
    requiresAttunement: false,
    description: 'One of a matched pair. Cast Sending once per day to communicate with the holder of the companion stone.',
    icon: 'i-lucide-radio',
    isAttuned: false,
  },
  {
    name: 'Drowned Bell Fragment',
    type: 'Quest Artifact',
    rarity: 'artifact',
    requiresAttunement: false,
    description: 'A shard of the submerged bell of the Sunken Saint. Hums when within 100 feet of the complete artifact. Do not ring it.',
    icon: 'i-lucide-bell',
    isAttuned: false,
  },
]

export const dndLocations: DndLocationCard[] = [
  {
    name: 'Flooded Chapel',
    region: 'Emberfall Undercroft',
    status: 'explored',
    description: 'A partially submerged sanctuary. The drowned sigils here match the catacomb gate markings discovered last session.',
    connectedQuests: ['Recover the Moonstone Lens', 'Map the Catacombs'],
    icon: 'i-lucide-church',
    dangerLevel: 3,
  },
  {
    name: 'Archive Spire',
    region: 'Lamp District',
    status: 'known',
    description: 'Headquarters of the High Curators. Upper floors remain locked. Seraphine has a private office on the seventh tier.',
    connectedQuests: ['Recover the Moonstone Lens'],
    icon: 'i-lucide-library',
    dangerLevel: 1,
  },
  {
    name: 'Smuggler Dock',
    region: 'South Docks',
    status: 'dangerous',
    description: "Captain Mirel's known escape route. A trapdoor beneath the salt barrels leads to a canal passageway.",
    connectedQuests: ['Question the Harbor Smuggler'],
    icon: 'i-lucide-anchor',
    dangerLevel: 2,
  },
  {
    name: 'Lower Vault',
    region: 'Catacomb Depths',
    status: 'rumored',
    description: 'Said to hold the sealed bell housing. Accessible only after all three crypt sigils are activated. No party member has been inside.',
    connectedQuests: ['Map the Catacombs', 'Recover the Moonstone Lens'],
    icon: 'i-lucide-vault',
    dangerLevel: 5,
  },
]

export const dndThreatClocks: DndThreatClock[] = [
  {
    name: 'Moonrise Deadline',
    description: 'The Moonstone Lens must be recovered before the observatory seals at moonrise.',
    segments: 6,
    filled: 5,
    consequence: 'Observatory wards awaken hostile echoes. The lens becomes unreachable until dawn.',
    urgency: 'error',
  },
  {
    name: 'Drowned Bell Ritual',
    description: "The Sunken Saint's bell is being reassembled by an unknown faction beneath the city.",
    segments: 4,
    filled: 2,
    consequence: 'The bell rings. Drowned shades rise in Emberfall harbor.',
    urgency: 'warning',
  },
  {
    name: 'Harbor Patrol Alert',
    description: 'Harbor Watch is aware of unauthorized activity near the docks.',
    segments: 3,
    filled: 1,
    consequence: 'South Docks are sealed. Captain Mirel cannot be contacted openly.',
    urgency: 'info',
  },
]

export const dndQuestList: DndQuestListEntry[] = [
  { title: 'Recover the Moonstone Lens', status: 'active', patron: 'High Curator Seraphine', updated: '2h ago', urgency: 'critical' },
  { title: 'Question the Harbor Smuggler', status: 'blocked', patron: 'Captain Mirel', updated: 'Yesterday', urgency: 'high' },
  { title: 'Map the Catacombs under Emberfall', status: 'ready', patron: 'Party Goal', updated: '4d ago', urgency: 'normal' },
  { title: 'Find the Lantern Court Envoy', status: 'active', patron: 'Unknown', updated: '1w ago', urgency: 'low' },
  { title: 'Deliver the Sealed Letter', status: 'complete', patron: 'Archivist Nera', updated: '2w ago', urgency: 'low' },
]

export const dndSessions: DndSessionEntry[] = [
  { number: 14, title: 'The Observatory Unsealed', date: 'Tonight', status: 'upcoming', hasRecap: false, hasRecording: false, playerCount: 4 },
  { number: 13, title: 'Bells Beneath the Archive', date: 'Mar 1', status: 'played', hasRecap: true, hasRecording: true, playerCount: 4 },
  { number: 12, title: 'The Ledger and the Liar', date: 'Feb 15', status: 'played', hasRecap: true, hasRecording: true, playerCount: 3 },
  { number: 11, title: 'Harbor Watch Inquiry', date: 'Feb 1', status: 'played', hasRecap: true, hasRecording: false, playerCount: 4 },
  { number: 10, title: 'Night Bazaar Negotiations', date: 'Jan 18', status: 'played', hasRecap: false, hasRecording: true, playerCount: 4 },
]

export const dndMilestones: DndMilestone[] = [
  { title: 'Campaign Begins', description: 'The party meets in Emberfall during the lantern festival.', session: 'Session 1', complete: true, arc: 'Prologue' },
  { title: 'The Brass Astrolabe Retrieved', description: 'First major artifact recovered from the dockside vault.', session: 'Session 7', complete: true, arc: 'The Drowned Archive' },
  { title: 'Captain Mirel Confronted', description: "Mirel admits he forged the harbor manifest under duress.", session: 'Session 12', complete: true, arc: 'The Drowned Archive' },
  { title: 'Recover the Moonstone Lens', description: 'Retrieve the lens from the sealed observatory before moonrise.', session: 'Session 14', complete: false, arc: 'The Drowned Archive' },
  { title: 'Silence the Drowned Bell', description: 'Stop the ritual before the third toll awakens the harbor shades.', session: 'TBD', complete: false, arc: 'The Drowned Archive' },
]

export const dndAudioTracks: DndAudioTrack[] = [
  { session: 13, title: 'Bells Beneath the Archive', duration: '3h 12m', date: 'Mar 1', fileSize: '184 MB' },
  { session: 12, title: 'The Ledger and the Liar', duration: '2h 47m', date: 'Feb 15', fileSize: '162 MB' },
  { session: 10, title: 'Night Bazaar Negotiations', duration: '3h 05m', date: 'Jan 18', fileSize: '178 MB' },
  { session: 9, title: 'The Ash Market Contact', duration: '2h 23m', date: 'Jan 4', fileSize: '138 MB' },
]

export const dndNpcList: DndNpcListEntry[] = [
  { name: 'Captain Mirel', faction: 'Harbor Watch', location: 'South Docks', status: 'Recurring', lastSeen: 'Session 13', icon: 'i-twemoji-crossed-swords', relation: 'ally' },
  { name: 'Seraphine Vale', faction: 'High Curators', location: 'Archive Spire', status: 'Active', lastSeen: 'Session 12', icon: 'i-twemoji-crystal-ball', relation: 'ally' },
  { name: 'Tallow Venn', faction: 'Ash Market', location: 'Night Bazaar', status: 'Hidden motive', lastSeen: 'Session 11', icon: 'i-twemoji-compass', relation: 'suspect' },
  { name: 'Archivist Nera', faction: 'High Curators', location: 'Archive Spire', status: 'Minor contact', lastSeen: 'Session 9', icon: 'i-twemoji-scroll', relation: 'neutral' },
  { name: 'The Factor', faction: 'Ash Market', location: 'Unknown', status: 'Unmet', lastSeen: '—', icon: 'i-twemoji-mage', relation: 'hostile' },
]

export const dndDetailedQuest: DndQuestDetailed = {
  title: 'Recover the Moonstone Lens',
  status: 'active',
  patron: 'High Curator Seraphine',
  patronIcon: 'i-twemoji-crystal-ball',
  reward: '800 gp · Curator Library Access · Moonstone Lens (temporary)',
  objectives: [
    { text: 'Locate the sealed observatory entrance', complete: true },
    { text: 'Bypass or neutralize the lower ward guardians', complete: true },
    { text: 'Retrieve the lens from the upper vault', complete: false },
    { text: 'Return the lens before moonrise', complete: false },
    { text: 'Report findings to Seraphine Vale (optional)', complete: false },
  ],
  nextHook: 'The vault key was last seen with Tallow Venn at the Night Bazaar.',
}

export const useUxStyleGuideContent = () => ({
  uxGuidePages,
  principles,
  layoutGuidelines,
  realEstateTips,
  densityGuidelines,
  trackerExamples,
  npcExamples,
  sessionBeats,
  characterStats,
  mapLocations,
  playerNotes,
  dashboardPreviewCards,
  campaignViewZones,
  characterPreviewSections,
  scenePrepCards,
  ritualTrack,
  rightRailItems,
  feedbackStates,
  questColumns,
  questRows,
  sessionTabs,
  sessionPanels,
  questActionItems,
  interactionGuidelines,
  shortcutExamples,
  dndCharacters,
  dndConditions,
  dndCombatants,
  dndFactions,
  dndSpellSlots,
  dndItems,
  dndLocations,
  dndThreatClocks,
  dndDetailedQuest,
  dndQuestList,
  dndSessions,
  dndMilestones,
  dndAudioTracks,
  dndNpcList,
})
