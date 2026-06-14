import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Document, OCRResult, Annotation, ReviewStats } from '../types'

export const useOcrStore = defineStore('ocr', () => {
  const documents = ref<Document[]>([])
  const currentDoc = ref<Document | null>(null)
  const isLoading = ref(false)
  const searchQuery = ref('')
  const searchResults = ref<OCRResult[]>([])

  const reviewModeActive = ref(false)
  const reviewThreshold = ref(0.9)
  const reviewCurrentIndex = ref(0)
  const reviewStats = ref<ReviewStats | null>(null)

  const lowConfidenceResults = computed(() => {
    if (!currentDoc.value) return []
    return currentDoc.value.results
      .filter(r => r.confidence < reviewThreshold.value)
      .sort((a, b) => a.confidence - b.confidence)
  })

  const currentReviewItem = computed(() => {
    return lowConfidenceResults.value[reviewCurrentIndex.value] || null
  })

  const reviewProgress = computed(() => {
    const total = lowConfidenceResults.value.length
    if (total === 0) return 100
    const reviewed = lowConfidenceResults.value.filter(r => r.reviewed).length
    return Math.round((reviewed / total) * 100)
  })

  // Mock data
  const MOCK_DOC: Document = {
    id: '1',
    name: '论语·学而篇',
    imageUrl: '',
    results: [
      { id: 'r1', text: '子曰', bbox: [50, 30, 80, 40], confidence: 0.95, reviewed: false },
      { id: 'r2', text: '学而', bbox: [50, 80, 80, 40], confidence: 0.88, reviewed: false },
      { id: 'r3', text: '时习之', bbox: [50, 130, 120, 40], confidence: 0.91, reviewed: false },
      { id: 'r4', text: '不亦说乎', bbox: [50, 180, 160, 40], confidence: 0.87, reviewed: false },
      { id: 'r5', text: '有朋', bbox: [200, 30, 80, 40], confidence: 0.93, reviewed: false },
      { id: 'r6', text: '自远方来', bbox: [200, 80, 160, 40], confidence: 0.85, reviewed: false },
      { id: 'r7', text: '不亦乐乎', bbox: [200, 130, 160, 40], confidence: 0.92, reviewed: false },
    ],
    annotations: [],
    createdAt: '2025-01-15'
  }

  const VARIANT_DICT: Record<string, string> = {
    '説': '说', '學': '学', '習': '习', '遠': '远', '樂': '乐', '書': '书',
    '國': '国', '東': '东', '長': '长', '門': '门', '馬': '马', '鳥': '鸟',
    '風': '风', '雲': '云', '龍': '龙', '車': '车', '萬': '万', '見': '见',
  }

  function loadMockDocument() {
    documents.value = [MOCK_DOC]
    currentDoc.value = MOCK_DOC
  }

  async function uploadAndOCR(file: File) {
    isLoading.value = true
    try {
      const formData = new FormData()
      formData.append('file', file)
      const resp = await fetch('/api/ocr', { method: 'POST', body: formData })
      if (resp.ok) {
        const data = await resp.json()
        const doc: Document = {
          id: data.id || Date.now().toString(),
          name: file.name,
          imageUrl: URL.createObjectURL(file),
          results: (data.results || []).map((r: OCRResult) => ({ ...r, reviewed: false })),
          annotations: [],
          createdAt: new Date().toISOString()
        }
        documents.value.push(doc)
        currentDoc.value = doc
      }
    } catch {
      loadMockDocument()
    } finally {
      isLoading.value = false
    }
  }

  function addAnnotation(type: Annotation['type'], bbox: [number, number, number, number], label: string, content: string) {
    if (!currentDoc.value) return
    currentDoc.value.annotations.push({
      id: Date.now().toString(),
      type, bbox, label, content
    })
  }

  function removeAnnotation(id: string) {
    if (!currentDoc.value) return
    currentDoc.value.annotations = currentDoc.value.annotations.filter(a => a.id !== id)
  }

  function convertVariant(text: string): string {
    return text.split('').map(c => VARIANT_DICT[c] || c).join('')
  }

  function searchInDocuments(query: string) {
    const q = query.toLowerCase()
    searchResults.value = documents.value.flatMap(d =>
      d.results.filter(r => r.text.includes(q) || (r.corrected || '').includes(q))
    )
  }

  function exportTEI(): string {
    if (!currentDoc.value) return ''
    let tei = '<?xml version="1.0" encoding="UTF-8"?>\n'
    tei += '<TEI xmlns="http://www.tei-c.org/ns/1.0">\n'
    tei += `  <teiHeader><fileDesc><titleStmt><title>${currentDoc.value.name}</title></titleStmt></fileDesc></teiHeader>\n`
    tei += '  <text><body>\n'
    for (const r of currentDoc.value.results) {
      const status = r.reviewed ? 'reviewed' : 'uncertain'
      tei += `    <seg type="line" xml:id="${r.id}" cert="${r.confidence}" status="${status}">${r.corrected || r.text}</seg>\n`
    }
    tei += '  </body></text>\n</TEI>'
    return tei
  }

  function enterReviewMode(threshold: number = 0.9) {
    reviewThreshold.value = threshold
    reviewModeActive.value = true
    reviewCurrentIndex.value = 0
    const unreviewed = lowConfidenceResults.value.findIndex(r => !r.reviewed)
    if (unreviewed !== -1) {
      reviewCurrentIndex.value = unreviewed
    }
    updateReviewStats()
  }

  function exitReviewMode() {
    reviewModeActive.value = false
  }

  function updateReviewStats() {
    if (!currentDoc.value) return
    const all = currentDoc.value.results
    const low = lowConfidenceResults.value
    reviewStats.value = {
      total: all.length,
      lowConfidence: low.length,
      reviewed: low.filter(r => r.reviewed).length,
      remaining: low.filter(r => !r.reviewed).length
    }
  }

  function goToNextReviewItem() {
    const items = lowConfidenceResults.value
    if (items.length === 0) return
    let next = reviewCurrentIndex.value + 1
    if (next >= items.length) next = 0
    reviewCurrentIndex.value = next
  }

  function goToPrevReviewItem() {
    const items = lowConfidenceResults.value
    if (items.length === 0) return
    let prev = reviewCurrentIndex.value - 1
    if (prev < 0) prev = items.length - 1
    reviewCurrentIndex.value = prev
  }

  function goToReviewItem(index: number) {
    const items = lowConfidenceResults.value
    if (index >= 0 && index < items.length) {
      reviewCurrentIndex.value = index
    }
  }

  function markCurrentReviewed(correctedText?: string) {
    const item = currentReviewItem.value
    if (!item || !currentDoc.value) return
    const target = currentDoc.value.results.find(r => r.id === item.id)
    if (target) {
      if (correctedText !== undefined) {
        target.corrected = correctedText
      }
      target.reviewed = true
      updateReviewStats()
    }
  }

  function updateCorrection(resultId: string, corrected: string) {
    if (!currentDoc.value) return
    const target = currentDoc.value.results.find(r => r.id === resultId)
    if (target) {
      target.corrected = corrected
    }
  }

  async function saveCorrectionsToBackend() {
    if (!currentDoc.value) return
    try {
      const corrections = currentDoc.value.results
        .filter(r => r.corrected !== undefined || r.reviewed)
        .map(r => ({ id: r.id, corrected: r.corrected, reviewed: r.reviewed }))
      await fetch(`/api/ocr/${currentDoc.value.id}/batch-correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corrections })
      })
    } catch {
      // Silently fail - corrections are stored locally
    }
  }

  return {
    documents, currentDoc, isLoading, searchQuery, searchResults,
    reviewModeActive, reviewThreshold, reviewCurrentIndex, reviewStats,
    lowConfidenceResults, currentReviewItem, reviewProgress,
    loadMockDocument, uploadAndOCR, addAnnotation, removeAnnotation,
    convertVariant, searchInDocuments, exportTEI,
    enterReviewMode, exitReviewMode, updateReviewStats,
    goToNextReviewItem, goToPrevReviewItem, goToReviewItem,
    markCurrentReviewed, updateCorrection, saveCorrectionsToBackend
  }
})
