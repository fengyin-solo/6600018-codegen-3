<template>
  <div class="flex h-screen">
    <!-- Left: Document list -->
    <div class="w-64 bg-gray-900 p-4 flex flex-col gap-3 border-r border-gray-800">
      <h1 class="text-lg font-bold text-amber-400">古籍 OCR 标注平台</h1>

      <div>
        <label class="block bg-amber-500 text-black text-center py-2 rounded cursor-pointer hover:bg-amber-400 text-sm font-medium">
          上传古籍图片
          <input type="file" accept="image/*" @change="onUpload" class="hidden" />
        </label>
      </div>

      <button @click="store.loadMockDocument()" class="bg-gray-800 py-2 rounded text-sm hover:bg-gray-700">
        加载示例文档
      </button>

      <!-- Low confidence review mode button -->
      <button v-if="store.currentDoc && !store.reviewModeActive"
        @click="store.enterReviewMode()"
        class="bg-red-700 hover:bg-red-600 py-2 rounded text-sm font-medium flex items-center justify-center gap-2">
        <span class="w-2 h-2 bg-red-400 rounded-full animate-pulse"></span>
        低置信度复核模式
        <span class="text-xs bg-red-900 px-1.5 py-0.5 rounded">
          {{ store.lowConfidenceResults.length }} 项
        </span>
      </button>

      <button v-if="store.reviewModeActive"
        @click="store.exitReviewMode()"
        class="bg-red-900 text-red-300 border border-red-700 py-2 rounded text-sm font-medium">
        退出复核模式
      </button>

      <!-- Search -->
      <div>
        <input v-model="store.searchQuery" @input="store.searchInDocuments(store.searchQuery)"
          placeholder="全文检索..." class="w-full bg-gray-800 rounded px-3 py-2 text-sm" />
        <div v-if="store.searchResults.length" class="mt-1 space-y-1">
          <div v-for="r in store.searchResults" :key="r.id" class="bg-gray-800 rounded p-1 text-xs">
            {{ r.text }} <span class="text-gray-500">{{ (r.confidence * 100).toFixed(0) }}%</span>
          </div>
        </div>
      </div>

      <!-- Document list -->
      <div class="flex-1 overflow-y-auto space-y-1">
        <div v-for="d in store.documents" :key="d.id" @click="store.currentDoc = d"
          class="bg-gray-800 rounded p-2 cursor-pointer text-sm"
          :class="store.currentDoc?.id === d.id ? 'ring-1 ring-amber-500' : ''">
          {{ d.name }}
          <div class="text-xs text-gray-500">{{ d.results.length }} 行识别</div>
        </div>
      </div>

      <!-- Export -->
      <button @click="doExport" class="bg-green-700 py-2 rounded text-sm hover:bg-green-600">
        导出 TEI/XML
      </button>
    </div>

    <!-- Center: Image + OCR overlay -->
    <div class="flex-1 relative bg-gray-950 overflow-hidden">
      <ImageCanvas v-if="store.currentDoc" />
      <div v-else class="flex items-center justify-center h-full text-gray-600">
        请上传古籍图片或加载示例文档
      </div>
    </div>

    <!-- Right: Review Panel OR OCR results & annotations -->
    <div v-if="store.reviewModeActive" class="w-96">
      <ReviewPanel />
    </div>
    <div v-else class="w-80 bg-gray-900 p-4 flex flex-col gap-3 border-l border-gray-800 overflow-y-auto">
      <h3 class="text-amber-300 font-bold text-sm">OCR 识别结果</h3>
      <div v-if="store.currentDoc" class="space-y-2">
        <div v-for="r in store.currentDoc.results" :key="r.id"
          class="bg-gray-800 rounded p-2 text-sm"
          :class="{ 'ring-1 ring-green-500': r.reviewed }">
          <div class="flex justify-between">
            <span class="text-white font-medium">{{ r.corrected || r.text }}</span>
            <div class="flex items-center gap-1">
              <span v-if="r.reviewed" class="text-green-400 text-xs">✓</span>
              <span class="text-xs px-2 py-0.5 rounded"
                :class="r.confidence > 0.9 ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'">
                {{ (r.confidence * 100).toFixed(0) }}%
              </span>
            </div>
          </div>
          <div v-if="r.corrected && r.text !== r.corrected" class="text-xs text-gray-500 mt-1">
            原文: <span class="line-through">{{ r.text }}</span>
          </div>
          <div class="text-xs text-gray-400 mt-1">
            简体: {{ store.convertVariant(r.corrected || r.text) }}
          </div>
          <input v-model="r.corrected" placeholder="人工校正..."
            @blur="onCorrectionChange(r.id, r.corrected)"
            class="w-full bg-gray-700 rounded px-2 py-1 text-xs mt-1" />
        </div>
      </div>

      <h3 class="text-amber-300 font-bold text-sm mt-4">标注列表</h3>
      <div v-if="store.currentDoc" class="space-y-1">
        <div v-for="a in store.currentDoc.annotations" :key="a.id"
          class="bg-gray-800 rounded p-2 text-xs flex justify-between">
          <span>[{{ a.type }}] {{ a.label }}: {{ a.content }}</span>
          <button @click="store.removeAnnotation(a.id)" class="text-red-400 hover:underline">删除</button>
        </div>
        <div v-if="!store.currentDoc.annotations.length" class="text-gray-600 text-xs">
          在图片上拖拽框选区域添加标注
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useOcrStore } from './store/ocr'
import ImageCanvas from './components/ImageCanvas.vue'
import ReviewPanel from './components/ReviewPanel.vue'

const store = useOcrStore()

function onUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) store.uploadAndOCR(file)
}

function onCorrectionChange(id: string, corrected: string | undefined) {
  if (corrected !== undefined) {
    store.updateCorrection(id, corrected)
  }
}

function doExport() {
  const tei = store.exportTEI()
  if (!tei) return
  const blob = new Blob([tei], { type: 'application/xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${store.currentDoc?.name || 'export'}.xml`
  a.click()
  URL.revokeObjectURL(url)
}
</script>
