import type {
  ConversationKnowledgeMapCluster,
  ConversationKnowledgeMapConcept,
  ConversationKnowledgeMapLink
} from './conversation-knowledge-map'

export const knowledgeMapColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)'
]

type MapPosition = {
  entry: ConversationKnowledgeMapConcept
  x: number
  y: number
}

export function createConversationKnowledgeMapLayout(
  cluster: ConversationKnowledgeMapCluster,
  rootColor: string
): {
  colors: ReadonlyMap<string, string>
  height: number
  links: ConversationKnowledgeMapLink[]
  positions: MapPosition[]
  width: number
} {
  const links = buildPrimaryLinks(cluster)
  const levels = buildConceptLevels(cluster.concepts, links)
  const colors = buildConceptColors(levels, links, rootColor)
  const widestLevel = Math.max(...levels.map((level) => level.length))
  const outerRadius = Math.max(0, ...levels.map((level, index) => levelRadius(index, level.length)))
  const padding = 88
  const width = Math.max(360, outerRadius * 2 + padding * 2, widestLevel * 84 + padding * 2)
  const height = Math.max(272, outerRadius * 2 + padding * 2)
  const center = { x: width / 2, y: height / 2 }
  return {
    colors,
    height,
    links,
    positions: levels.flatMap((level, levelIndex) =>
      level.map((entry, index) => {
        if (levelIndex === 0) {
          return { entry, ...center }
        }
        const angle = -Math.PI / 2 + (index / level.length) * Math.PI * 2
        const radius = levelRadius(levelIndex, level.length)
        return {
          entry,
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius
        }
      })
    ),
    width
  }
}

export function linkColorForKnowledgeMap(
  link: ConversationKnowledgeMapLink,
  colors: ReadonlyMap<string, string>,
  rootId: string
): string {
  return colors.get(link.source === rootId ? link.target : link.source) ?? 'var(--chart-1)'
}

function buildPrimaryLinks(
  cluster: ConversationKnowledgeMapCluster
): ConversationKnowledgeMapLink[] {
  const parent = new Map(cluster.concepts.map((entry) => [entry.concept.id, entry.concept.id]))
  const links: ConversationKnowledgeMapLink[] = []
  for (const link of [...cluster.links].sort(
    (left, right) => right.evidenceCount - left.evidenceCount
  )) {
    const sourceRoot = findConceptRoot(parent, link.source)
    const targetRoot = findConceptRoot(parent, link.target)
    if (sourceRoot === targetRoot) {
      continue
    }
    parent.set(targetRoot, sourceRoot)
    links.push(link)
  }
  return links
}

function buildConceptLevels(
  concepts: ConversationKnowledgeMapConcept[],
  links: ConversationKnowledgeMapLink[]
): ConversationKnowledgeMapConcept[][] {
  const root = concepts[0]!
  const conceptsById = new Map(concepts.map((entry) => [entry.concept.id, entry]))
  const neighborsById = new Map<string, string[]>()
  for (const link of links) {
    addNeighbor(neighborsById, link.source, link.target)
    addNeighbor(neighborsById, link.target, link.source)
  }
  const levels: ConversationKnowledgeMapConcept[][] = [[root]]
  const visited = new Set([root.concept.id])
  for (let index = 0; index < levels.length; index += 1) {
    const next: ConversationKnowledgeMapConcept[] = []
    for (const entry of levels[index]!) {
      for (const neighborId of neighborsById.get(entry.concept.id) ?? []) {
        const neighbor = conceptsById.get(neighborId)
        if (!neighbor || visited.has(neighborId)) {
          continue
        }
        visited.add(neighborId)
        next.push(neighbor)
      }
    }
    if (next.length) {
      levels.push(next)
    }
  }
  return levels
}

function buildConceptColors(
  levels: readonly ConversationKnowledgeMapConcept[][],
  links: ConversationKnowledgeMapLink[],
  rootColor: string
): ReadonlyMap<string, string> {
  const colors = new Map<string, string>([[levels[0]![0]!.concept.id, rootColor]])
  for (let levelIndex = 1; levelIndex < levels.length; levelIndex += 1) {
    const priorIds = new Set(levels[levelIndex - 1]!.map((entry) => entry.concept.id))
    for (const [index, entry] of levels[levelIndex]!.entries()) {
      const parentLink = links.find((link) =>
        link.source === entry.concept.id
          ? priorIds.has(link.target)
          : link.target === entry.concept.id && priorIds.has(link.source)
      )
      const parentId =
        parentLink?.source === entry.concept.id ? parentLink.target : parentLink?.source
      colors.set(
        entry.concept.id,
        levelIndex === 1
          ? knowledgeMapColors[index % knowledgeMapColors.length]!
          : ((parentId ? colors.get(parentId) : undefined) ?? rootColor)
      )
    }
  }
  return colors
}

function addNeighbor(neighborsById: Map<string, string[]>, source: string, target: string): void {
  const neighbors = neighborsById.get(source) ?? []
  neighbors.push(target)
  neighborsById.set(source, neighbors)
}

function levelRadius(level: number, count: number): number {
  if (level === 0) {
    return 0
  }
  return Math.max(150 + (level - 1) * 136, (count * 84) / (Math.PI * 2))
}

function findConceptRoot(parent: ReadonlyMap<string, string>, id: string): string {
  let current = id
  while (parent.get(current) !== current) {
    current = parent.get(current) ?? current
  }
  return current
}
