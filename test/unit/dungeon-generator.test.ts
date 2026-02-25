import { describe, expect, it } from 'vitest'
import { dungeonGeneratorConfigSchema } from '../../shared/schemas/dungeon'
import { DungeonGeneratorService } from '../../server/services/dungeon/dungeon-generator.service'

describe('dungeon generator service', () => {
  const service = new DungeonGeneratorService()

  it('produces deterministic output for same seed and config', () => {
    const config = dungeonGeneratorConfigSchema.parse({
      width: 60,
      height: 60,
      theme: 'crypt',
    })
    const first = service.generateBaseMap('seed-deterministic', config)
    const second = service.generateBaseMap('seed-deterministic', config)

    expect(second.metadata.configHash).toBe(first.metadata.configHash)
    expect(second.rooms).toEqual(first.rooms)
    expect(second.corridors).toEqual(first.corridors)
    expect(second.doors).toEqual(first.doors)
  })

  it('produces valid room and corridor references', () => {
    const config = dungeonGeneratorConfigSchema.parse({
      width: 80,
      height: 80,
      theme: 'ruins',
    })
    const map = service.generateBaseMap('seed-validity', config)
    const roomIds = new Set(map.rooms.map((room) => room.id))

    expect(map.rooms.length).toBeGreaterThan(1)
    expect(map.corridors.every((corridor) => roomIds.has(corridor.fromRoomId))).toBe(true)
    expect(map.corridors.every((corridor) => roomIds.has(corridor.toRoomId))).toBe(true)
    expect(map.doors.every((door) => map.corridors.some((corridor) => corridor.id === door.corridorId))).toBe(true)
  })

  it('supports scoped regeneration and preserves lock flags when enabled', () => {
    const config = dungeonGeneratorConfigSchema.parse({
      width: 90,
      height: 90,
      theme: 'ruins',
    })
    const base = service.generateBaseMap('seed-scoped', config)
    expect(base.doors.length).toBeGreaterThan(0)

    const edited = {
      ...base,
      doors: base.doors.map((door, index) =>
        index === 0
          ? {
            ...door,
            isLocked: true,
            isSecret: true,
            isSpecial: true,
          }
          : door,
      ),
    }

    const regeneratedPreserve = service.regenerate('DOORS', 'seed-scoped', config, edited, { preserveLocks: true })
    const regeneratedNoPreserve = service.regenerate('DOORS', 'seed-scoped', config, edited, { preserveLocks: false })

    expect(regeneratedPreserve.rooms).toEqual(edited.rooms)
    expect(regeneratedPreserve.corridors).toEqual(edited.corridors)

    const preservedDoor = regeneratedPreserve.doors.find((door) => door.id === edited.doors[0]?.id)
    expect(preservedDoor?.isLocked).toBe(true)
    expect(preservedDoor?.isSecret).toBe(true)
    expect(preservedDoor?.isSpecial).toBe(true)

    const nonPreservedDoor = regeneratedNoPreserve.doors.find((door) => door.id === edited.doors[0]?.id)
    expect(nonPreservedDoor?.isLocked && nonPreservedDoor?.isSecret && nonPreservedDoor?.isSpecial).toBe(false)

    const regenTraps = service.regenerate('TRAPS', 'seed-scoped', config, base, { preserveLocks: true })
    expect(regenTraps.rooms).toEqual(base.rooms)
    expect(regenTraps.corridors).toEqual(base.corridors)
    expect(regenTraps.doors).toEqual(base.doors)
    expect(regenTraps.metadata.passHistory.length).toBeGreaterThan(base.metadata.passHistory.length)
  })

  it('meets performance targets for medium and large map generation', () => {
    const mediumConfig = dungeonGeneratorConfigSchema.parse({
      width: 120,
      height: 120,
      theme: 'crypt',
      layout: {
        roomDensity: 0.35,
        minRoomSize: 4,
        maxRoomSize: 11,
        corridorStyle: 'MIXED',
        connectivityStrictness: 0.7,
        secretRoomChance: 0.1,
      },
    })
    const largeConfig = dungeonGeneratorConfigSchema.parse({
      width: 220,
      height: 220,
      theme: 'mega',
      layout: {
        roomDensity: 0.45,
        minRoomSize: 4,
        maxRoomSize: 12,
        corridorStyle: 'MIXED',
        connectivityStrictness: 0.75,
        secretRoomChance: 0.12,
      },
    })

    const mediumStart = performance.now()
    const mediumMap = service.generateBaseMap('seed-medium-performance', mediumConfig)
    const mediumDuration = performance.now() - mediumStart

    const largeStart = performance.now()
    const largeMap = service.generateBaseMap('seed-large-performance', largeConfig)
    const largeDuration = performance.now() - largeStart

    expect(mediumMap.rooms.length).toBeGreaterThan(0)
    expect(largeMap.rooms.length).toBeGreaterThan(0)
    expect(mediumDuration).toBeLessThan(1500)
    expect(largeDuration).toBeLessThan(5000)
  })
})
