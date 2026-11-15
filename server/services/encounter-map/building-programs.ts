import type { EncounterMapGeneratorConfig } from '../../../shared/types/encounter-map'

export type BuildingZone = 'PUBLIC' | 'SERVICE' | 'PRIVATE'

/** One room in a building's brief. Areas are target cells; the floor plan scales them to fit. */
export type RoomSpec = {
  label: string
  area: number
  zone: BuildingZone
  /** Lowest encounter scale that includes the room: 0 single, 1 sequence, 2 exploration site. */
  tier: 0 | 1 | 2
  /** Labels of rooms this one is normally entered from. */
  via?: string[]
  /** Circulation space drawn as a hall. */
  hall?: boolean
  /** Opens onto many rooms. */
  hub?: boolean
  /** A destination that should not become a passageway. */
  terminal?: boolean
  /** Candidate for the back door. */
  exit?: boolean
  objective?: boolean
}

export type BuildingProgram = {
  /** The first ground room is the front entrance; the first upper and basement rooms meet the stairs. */
  ground: RoomSpec[]
  upper: RoomSpec[]
  basement: RoomSpec[]
  objective: Record<'ground' | 'upper' | 'basement', RoomSpec>
  /** Upper floors use a corridor between rows of rooms, as in an inn. */
  corridor?: boolean
}

export type BuildingType = EncounterMapGeneratorConfig['buildingType']

type Options = Partial<Omit<RoomSpec, 'label' | 'area' | 'zone'>>
const room = (label: string, area: number, zone: BuildingZone, options: Options = {}): RoomSpec =>
  ({ label, area, zone, tier: 0, ...options })
const goal = (label: string, area: number, via?: string[]): RoomSpec =>
  room(label, area, 'PRIVATE', { terminal: true, objective: true, via })

export const buildingPrograms: Record<BuildingType, BuildingProgram> = {
  MANOR: {
    ground: [
      room('Entrance hall', 24, 'PUBLIC', { hall: true, hub: true }),
      room('Cloakroom', 9, 'PUBLIC', { tier: 2, via: ['Entrance hall'], terminal: true }),
      room('Parlor', 36, 'PUBLIC', { via: ['Entrance hall'] }),
      room('Drawing room', 36, 'PUBLIC', { tier: 2, via: ['Entrance hall', 'Parlor', 'Dining room'] }),
      room('Morning room', 24, 'PUBLIC', { tier: 2, via: ['Parlor', 'Drawing room'], terminal: true }),
      room('Library', 30, 'PUBLIC', { tier: 1, via: ['Parlor', 'Entrance hall'] }),
      room('Dining room', 36, 'PUBLIC', { tier: 1, via: ['Entrance hall', 'Parlor'] }),
      room('Kitchen', 32, 'SERVICE', { via: ['Dining room', "Servants' hall", 'Entrance hall'], exit: true }),
      room('Pantry', 12, 'SERVICE', { tier: 1, via: ['Kitchen'], terminal: true }),
      room('Larder', 12, 'SERVICE', { tier: 2, via: ['Kitchen', 'Scullery'], terminal: true }),
      room("Servants' hall", 20, 'SERVICE', { tier: 2, via: ['Kitchen'] }),
      room('Scullery', 15, 'SERVICE', { tier: 2, via: ['Kitchen'], exit: true }),
      room('Gun room', 12, 'SERVICE', { tier: 2, via: ['Entrance hall', "Servants' hall"], terminal: true }),
    ],
    upper: [
      room('Landing', 16, 'PRIVATE', { hall: true, hub: true }),
      room('Sitting room', 24, 'PRIVATE', { tier: 2, via: ['Landing'] }),
      room('Main bedroom', 24, 'PRIVATE', { via: ['Landing'], terminal: true }),
      room('Dressing room', 10, 'PRIVATE', { tier: 1, via: ['Main bedroom'], terminal: true }),
      room('Guest bedroom', 18, 'PRIVATE', { tier: 1, via: ['Landing'], terminal: true }),
      room('Washroom', 10, 'PRIVATE', { tier: 1, via: ['Landing'], terminal: true }),
      room('Nursery', 16, 'PRIVATE', { tier: 2, via: ['Landing', 'Sitting room'], terminal: true }),
      room('Linen room', 9, 'SERVICE', { tier: 2, via: ['Landing'], terminal: true }),
      room("Maid's room", 12, 'SERVICE', { tier: 2, via: ['Landing'], terminal: true }),
    ],
    basement: [
      room('Cellar passage', 16, 'SERVICE', { hall: true, hub: true }),
      room('Wine cellar', 24, 'SERVICE', { via: ['Cellar passage'], terminal: true }),
      room('Coal store', 12, 'SERVICE', { tier: 1, via: ['Cellar passage'], terminal: true }),
      room('Root cellar', 16, 'SERVICE', { tier: 1, via: ['Cellar passage'], terminal: true }),
      room('Laundry', 20, 'SERVICE', { tier: 2, via: ['Cellar passage'] }),
      room('Cistern room', 14, 'SERVICE', { tier: 2, via: ['Laundry', 'Cellar passage'], terminal: true }),
    ],
    objective: { ground: goal('Private study', 24, ['Library', 'Parlor']), upper: goal('Master suite', 30), basement: goal('Sealed cellar', 20) },
  },
  TAVERN: {
    ground: [
      room('Common room', 80, 'PUBLIC', { hub: true }),
      room('Snug', 14, 'PUBLIC', { tier: 1, via: ['Common room'], terminal: true }),
      room('Washroom', 9, 'PUBLIC', { tier: 2, via: ['Common room'], terminal: true }),
      room('Gaming room', 24, 'PUBLIC', { tier: 2, via: ['Common room'], terminal: true }),
      room('Private dining room', 20, 'PUBLIC', { tier: 2, via: ['Common room'], terminal: true }),
      room('Bar', 16, 'PUBLIC', { via: ['Common room'] }),
      room('Keg store', 14, 'SERVICE', { tier: 1, via: ['Bar', 'Kitchen'], terminal: true }),
      room('Kitchen', 30, 'SERVICE', { via: ['Bar', 'Common room'], exit: true }),
      room('Pantry', 10, 'SERVICE', { tier: 1, via: ['Kitchen'], terminal: true }),
      room('Scullery', 12, 'SERVICE', { tier: 2, via: ['Kitchen'], exit: true }),
      room('Staff room', 14, 'SERVICE', { tier: 2, via: ['Kitchen', 'Scullery'], terminal: true }),
      room('Tack room', 12, 'SERVICE', { tier: 2, via: ['Scullery', 'Kitchen'], terminal: true }),
    ],
    upper: [
      room('Guest hall', 20, 'PRIVATE', { hall: true, hub: true }),
      room('Guest room', 16, 'PRIVATE', { via: ['Guest hall'], terminal: true }),
      room('Guest room', 16, 'PRIVATE', { tier: 1, via: ['Guest hall'], terminal: true }),
      room('Guest room', 16, 'PRIVATE', { tier: 1, via: ['Guest hall'], terminal: true }),
      room('Washroom', 10, 'PRIVATE', { tier: 1, via: ['Guest hall'], terminal: true }),
      room('Guest room', 16, 'PRIVATE', { tier: 2, via: ['Guest hall'], terminal: true }),
      room('Guest room', 16, 'PRIVATE', { tier: 2, via: ['Guest hall'], terminal: true }),
      room("Innkeeper's quarters", 24, 'PRIVATE', { tier: 2, via: ['Guest hall'], terminal: true }),
      room('Linen closet', 9, 'SERVICE', { tier: 2, via: ['Guest hall'], terminal: true }),
    ],
    basement: [
      room('Cellar', 40, 'SERVICE', { hall: true, hub: true }),
      room('Ale cellar', 24, 'SERVICE', { via: ['Cellar'], terminal: true }),
      room('Root cellar', 14, 'SERVICE', { tier: 1, via: ['Cellar'], terminal: true }),
      room('Wine racks', 14, 'SERVICE', { tier: 1, via: ['Cellar'], terminal: true }),
      room('Cold store', 14, 'SERVICE', { tier: 2, via: ['Cellar'], terminal: true }),
      room('Old cistern', 16, 'SERVICE', { tier: 2, via: ['Cellar', 'Cold store'], terminal: true }),
    ],
    objective: { ground: goal("Innkeeper's office", 16, ['Bar', 'Kitchen']), upper: goal('Locked suite', 28), basement: goal("Smugglers' cache", 18) },
    corridor: true,
  },
  TEMPLE: {
    ground: [
      room('Narthex', 20, 'PUBLIC', { hall: true }),
      room('Almonry', 16, 'PUBLIC', { tier: 2, via: ['Narthex', 'Nave'], terminal: true }),
      room('Nave', 110, 'PUBLIC', { hub: true, via: ['Narthex'] }),
      room('Side chapel', 20, 'PUBLIC', { tier: 1, via: ['Nave'], terminal: true }),
      room('Side chapel', 20, 'PUBLIC', { tier: 2, via: ['Nave'], terminal: true }),
      room('Choir', 24, 'PUBLIC', { tier: 2, via: ['Nave', 'Sanctuary'] }),
      room('Sanctuary', 40, 'PRIVATE', { via: ['Nave'] }),
      room('Vestry', 20, 'SERVICE', { via: ['Sanctuary', 'Nave'], exit: true }),
      room('Sacristy', 14, 'SERVICE', { tier: 1, via: ['Vestry', 'Sanctuary'], terminal: true }),
      room('Robing room', 12, 'SERVICE', { tier: 2, via: ['Vestry'], terminal: true }),
      room('Cloister walk', 24, 'SERVICE', { tier: 2, hall: true, via: ['Vestry', 'Nave'], exit: true }),
      room('Scriptorium', 24, 'SERVICE', { tier: 2, via: ['Cloister walk', 'Vestry'] }),
    ],
    upper: [
      room('Clerestory gallery', 20, 'PRIVATE', { hall: true, hub: true }),
      room("Priest's cell", 12, 'PRIVATE', { via: ['Clerestory gallery'], terminal: true }),
      room("Priest's cell", 12, 'PRIVATE', { tier: 1, via: ['Clerestory gallery'], terminal: true }),
      room('Library', 30, 'PRIVATE', { tier: 1, via: ['Clerestory gallery'] }),
      room('Infirmary', 20, 'PRIVATE', { tier: 1, via: ['Clerestory gallery'], terminal: true }),
      room("Priest's cell", 12, 'PRIVATE', { tier: 2, via: ['Clerestory gallery'], terminal: true }),
      room('Bell chamber', 16, 'SERVICE', { tier: 2, via: ['Clerestory gallery'], terminal: true }),
      room('Reading room', 16, 'PRIVATE', { tier: 2, via: ['Library'], terminal: true }),
    ],
    basement: [
      room('Crypt', 50, 'PRIVATE', { hall: true, hub: true }),
      room('Ossuary', 20, 'PRIVATE', { via: ['Crypt'], terminal: true }),
      room('Tomb', 16, 'PRIVATE', { tier: 1, via: ['Crypt'], terminal: true }),
      room('Catacomb', 24, 'PRIVATE', { tier: 1, via: ['Crypt'] }),
      room('Embalming room', 16, 'SERVICE', { tier: 2, via: ['Crypt'], terminal: true }),
      room('Burial niche', 12, 'PRIVATE', { tier: 2, via: ['Catacomb'], terminal: true }),
    ],
    objective: { ground: goal('Reliquary', 20, ['Sanctuary']), upper: goal("High priest's chambers", 26), basement: goal('Sealed tomb', 20) },
  },
  THEATER: {
    ground: [
      room('Lobby', 36, 'PUBLIC', { hall: true, hub: true }),
      room('Box office', 9, 'PUBLIC', { tier: 1, via: ['Lobby'], terminal: true }),
      room('Cloakroom', 9, 'PUBLIC', { tier: 2, via: ['Lobby'], terminal: true }),
      room('Refreshment bar', 20, 'PUBLIC', { tier: 2, via: ['Lobby'], terminal: true }),
      room('Auditorium', 130, 'PUBLIC', { hub: true, via: ['Lobby'] }),
      room('Stage', 50, 'SERVICE', { via: ['Auditorium', 'Stage left wing', 'Stage right wing'] }),
      room('Stage left wing', 16, 'SERVICE', { tier: 1, via: ['Stage', 'Backstage'] }),
      room('Stage right wing', 16, 'SERVICE', { tier: 2, via: ['Stage', 'Backstage'] }),
      room('Backstage', 26, 'SERVICE', { via: ['Stage', 'Stage left wing', 'Stage right wing'], exit: true }),
      room('Prop store', 16, 'SERVICE', { tier: 1, via: ['Backstage', 'Stage left wing'], terminal: true }),
      room('Scenery dock', 30, 'SERVICE', { tier: 2, via: ['Backstage', 'Stage'], exit: true, terminal: true }),
      room('Dressing room', 12, 'PRIVATE', { tier: 1, via: ['Backstage'], terminal: true }),
      room('Dressing room', 12, 'PRIVATE', { tier: 2, via: ['Backstage'], terminal: true }),
      room('Green room', 20, 'PRIVATE', { tier: 2, via: ['Backstage'] }),
    ],
    upper: [
      room('Circle landing', 16, 'PUBLIC', { hall: true, hub: true }),
      room('Gallery seating', 60, 'PUBLIC', { hub: true, via: ['Circle landing'] }),
      room('Private box', 9, 'PRIVATE', { tier: 1, via: ['Circle landing', 'Gallery seating'], terminal: true }),
      room('Fly gallery', 20, 'SERVICE', { tier: 1, via: ['Circle landing'] }),
      room('Wardrobe', 24, 'SERVICE', { tier: 1, via: ['Fly gallery', 'Circle landing'], terminal: true }),
      room('Private box', 9, 'PRIVATE', { tier: 2, via: ['Circle landing', 'Gallery seating'], terminal: true }),
      room('Rehearsal room', 30, 'SERVICE', { tier: 2, via: ['Circle landing'] }),
      room('Scene shop', 30, 'SERVICE', { tier: 2, via: ['Fly gallery', 'Rehearsal room'], terminal: true }),
    ],
    basement: [
      room('Under-stage', 50, 'SERVICE', { hall: true, hub: true }),
      room('Trap room', 16, 'SERVICE', { via: ['Under-stage'], terminal: true }),
      room('Costume store', 24, 'SERVICE', { tier: 1, via: ['Under-stage'], terminal: true }),
      room('Boiler room', 16, 'SERVICE', { tier: 1, via: ['Under-stage'], terminal: true }),
      room('Scenery store', 30, 'SERVICE', { tier: 2, via: ['Under-stage'], terminal: true }),
    ],
    objective: { ground: goal("Manager's office", 16, ['Lobby', 'Backstage']), upper: goal("Impresario's office", 20), basement: goal('Sealed vault', 16) },
  },
  LABORATORY: {
    ground: [
      room('Entry hall', 18, 'PUBLIC', { hall: true, hub: true }),
      room('Main laboratory', 64, 'SERVICE', { hub: true, via: ['Entry hall'] }),
      room('Washroom', 9, 'PUBLIC', { tier: 2, via: ['Entry hall'], terminal: true }),
      room('Office', 16, 'PRIVATE', { tier: 1, via: ['Entry hall', 'Main laboratory'], terminal: true }),
      room('Archive', 16, 'PRIVATE', { tier: 2, via: ['Library', 'Office'], terminal: true }),
      room('Library', 30, 'PUBLIC', { tier: 2, via: ['Entry hall', 'Office'] }),
      room('Reagent store', 12, 'SERVICE', { tier: 1, via: ['Main laboratory'], terminal: true }),
      room('Specimen room', 20, 'SERVICE', { tier: 1, via: ['Main laboratory'], terminal: true }),
      room('Distillery', 20, 'SERVICE', { tier: 2, via: ['Main laboratory', 'Workshop'], terminal: true }),
      room('Animal pens', 20, 'SERVICE', { tier: 2, via: ['Specimen room', 'Workshop'], terminal: true }),
      room('Workshop', 30, 'SERVICE', { via: ['Main laboratory', 'Entry hall'], exit: true }),
      room('Furnace room', 20, 'SERVICE', { tier: 2, via: ['Workshop'], exit: true }),
      room("Assistant's quarters", 16, 'PRIVATE', { tier: 2, via: ['Entry hall', 'Workshop'], terminal: true }),
    ],
    upper: [
      room('Upper corridor', 18, 'PRIVATE', { hall: true, hub: true }),
      room('Study', 20, 'PRIVATE', { via: ['Upper corridor'], terminal: true }),
      room('Quarters', 16, 'PRIVATE', { tier: 1, via: ['Upper corridor'], terminal: true }),
      room('Observatory', 30, 'PRIVATE', { tier: 1, via: ['Upper corridor'], terminal: true }),
      room('Records room', 16, 'PRIVATE', { tier: 1, via: ['Upper corridor'], terminal: true }),
      room('Quarters', 16, 'PRIVATE', { tier: 2, via: ['Upper corridor'], terminal: true }),
      room('Alchemy lab', 30, 'SERVICE', { tier: 2, via: ['Upper corridor'], terminal: true }),
      room('Washroom', 10, 'PRIVATE', { tier: 2, via: ['Upper corridor'], terminal: true }),
    ],
    basement: [
      room('Lower passage', 16, 'SERVICE', { hall: true, hub: true }),
      room('Holding cells', 20, 'SERVICE', { via: ['Lower passage'], terminal: true }),
      room('Cold store', 16, 'SERVICE', { tier: 1, via: ['Lower passage'], terminal: true }),
      room('Dissection room', 24, 'SERVICE', { tier: 1, via: ['Lower passage'] }),
      room('Pump room', 12, 'SERVICE', { tier: 2, via: ['Lower passage'], terminal: true }),
      room('Waste pit', 12, 'SERVICE', { tier: 2, via: ['Dissection room', 'Lower passage'], terminal: true }),
    ],
    objective: { ground: goal('Sealed vault', 16, ['Main laboratory', 'Office']), upper: goal('Arcane sanctum', 26), basement: goal('Containment cell', 18) },
    corridor: true,
  },
}
