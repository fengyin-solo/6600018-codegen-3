export interface OCRResult {
  id: string
  text: string
  bbox: [number, number, number, number]
  confidence: number
  corrected?: string
  reviewed?: boolean
}

export interface Document {
  id: string
  name: string
  imageUrl: string
  results: OCRResult[]
  annotations: Annotation[]
  createdAt: string
}

export interface Annotation {
  id: string
  type: 'region' | 'character' | 'note'
  bbox: [number, number, number, number]
  label: string
  content: string
}

export interface VariantChar {
  ancient: string
  modern: string
  frequency: number
}

export interface ReviewStats {
  total: number
  lowConfidence: number
  reviewed: number
  remaining: number
}

export interface ReviewState {
  isActive: boolean
  threshold: number
  currentIndex: number
  lowConfidenceResults: OCRResult[]
  stats: ReviewStats | null
}
