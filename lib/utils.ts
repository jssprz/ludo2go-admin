import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function mapBggWeightToComplexityTierId(
  weight: number,
  complexities: Array<{ id: string; name: string; slug: string }>
): string | undefined {
  if (!Array.isArray(complexities) || complexities.length === 0 || typeof weight !== 'number') {
    return undefined
  }

  const normalizedWeight = Math.min(Math.max(weight, 1), 5)
  const searchableComplexities = complexities.map((complexity) => ({
    ...complexity,
    searchable: `${complexity.name} ${complexity.slug}`.toLowerCase(),
  }))

  const buckets = [
    { max: 1.5, keywords: ['very-light', 'very light', 'light', 'easy', 'beginner', 'casual'] },
    { max: 2.5, keywords: ['medium-light', 'medium light', 'medium', 'family', 'standard', 'classic'] },
    { max: 3.5, keywords: ['medium-heavy', 'medium heavy', 'heavy', 'advanced', 'expert', 'challenging'] },
    { max: 5, keywords: ['very-heavy', 'very heavy', 'expert', 'difficult', 'complex', 'hard'] },
  ]

  for (const bucket of buckets) {
    if (normalizedWeight <= bucket.max) {
      for (const keyword of bucket.keywords) {
        const match = searchableComplexities.find((complexity) =>
          complexity.searchable.includes(keyword)
        )
        if (match) {
          return match.id
        }
      }
      break
    }
  }

  const ratio = (normalizedWeight - 1) / 4
  const index = Math.min(Math.floor(ratio * complexities.length), complexities.length - 1)

  return complexities[index]?.id
}
