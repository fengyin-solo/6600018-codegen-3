<template>
  <div class="h-full flex flex-col bg-gray-900 border-l border-gray-800">
    <div class="p-4 border-b border-gray-800">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-amber-400 font-bold text-sm">低置信度复核模式</h3>
        <button @click="store.exitReviewMode()" class="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-800">
          退出
        </button>
      </div>

      <div class="flex items-center gap-2 mb-3">
        <label class="text-xs text-gray-400">置信度阈值:</label>
        <select v-model.number="localThreshold" @change="onThresholdChange"
          class="bg-gray-800 text-sm rounded px-2 py-1 text-white">
          <option :value="0.95">95%</option>
          <option :value="0.9">90%</option>
          <option :value="0.85">85%</option>
          <option :value="0.8">80%</option>
          <option :value="0.7">70%</option>
        </select>
      </div>

      <div v-if="store.reviewStats" class="bg-gray-800 rounded p-3 mb-3">
        <div class="flex justify-between text-xs mb-2">
          <span class="text-gray-400">复核进度</span>
          <span class="text-amber-400">{{ store.reviewProgress }}%</span>
        </div>
        <div class="w-full bg-gray-700 rounded-full h-2 mb-3">
          <div class="bg-amber-500 h-2 rounded-full transition-all"
            :style="{ width: store.reviewProgress + '%' }"></div>
        </div>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="bg-gray-900 rounded p-2">
            <div class="text-gray-500">待复核</div>
            <div class="text-yellow-400 font-bold text-sm">{{ store.reviewStats.remaining }}</div>
          </div>
          <div class="bg-gray-900 rounded p-2">
            <div class="text-gray-500">已完成</div>
            <div class="text-green-400 font-bold text-sm">{{ store.reviewStats.reviewed }}</div>
          </div>
          <div class="bg-gray-900 rounded p-2">
            <div class="text-gray-500">低置信度</div>
            <div class="text-orange-400 font-bold text-sm">{{ store.reviewStats.lowConfidence }}</div>
          </div>
          <div class="bg-gray-900 rounded p-2">
            <div class="text-gray-500">总行数</div>
            <div class="text-white font-bold text-sm">{{ store.reviewStats.total }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="store.lowConfidenceResults.length === 0" class="flex-1 flex items-center justify-center text-gray-500 text-sm p-4">
      所有识别结果置信度均高于阈值，无需复核
    </div>

    <div v-else-if="store.currentReviewItem" class="flex-1 overflow-y-auto p-4">
      <div class="bg-red-900/30 border border-red-800 rounded-lg p-4 mb-4">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs text-red-400 font-medium">
            {{ store.reviewCurrentIndex + 1 }} / {{ store.lowConfidenceResults.length }}
          </span>
          <span class="px-2 py-0.5 rounded text-xs font-bold bg-red-900 text-red-400">
            {{ (store.currentReviewItem.confidence * 100).toFixed(0) }}%
          </span>
        </div>

        <div class="mb-3">
          <div class="text-xs text-gray-400 mb-1">识别原文</div>
          <div class="text-white font-medium text-lg">{{ store.currentReviewItem.text }}</div>
          <div class="text-xs text-gray-500 mt-1">
            简体: {{ store.convertVariant(store.currentReviewItem.text) }}
          </div>
        </div>

        <div class="mb-4">
          <div class="text-xs text-gray-400 mb-1">校正结果</div>
          <input v-model="correctedText"
            @keyup.enter="markAndNext"
            placeholder="输入校正文字..."
            class="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-amber-500" />
        </div>

        <div class="flex gap-2">
          <button @click="skipItem"
            class="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded text-sm">
            跳过
          </button>
          <button @click="markCorrect"
            class="flex-1 bg-green-700 hover:bg-green-600 text-white py-2 rounded text-sm">
            确认无误
          </button>
          <button @click="markAndNext"
            class="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2 rounded text-sm">
            保存并下一条
          </button>
        </div>
      </div>

      <div class="flex justify-between gap-2 mb-4">
        <button @click="store.goToPrevReviewItem()"
          class="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded text-sm flex items-center justify-center gap-1">
          ← 上一条
        </button>
        <button @click="store.goToNextReviewItem()"
          class="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded text-sm flex items-center justify-center gap-1">
          下一条 →
        </button>
      </div>

      <div>
        <div class="text-xs text-gray-400 mb-2">待复核列表 (按置信度排序)</div>
        <div class="space-y-1 max-h-64 overflow-y-auto">
          <div v-for="(item, idx) in store.lowConfidenceResults" :key="item.id"
            @click="jumpToItem(idx)"
            class="bg-gray-800 rounded p-2 text-xs cursor-pointer hover:bg-gray-700 transition-colors"
            :class="{
              'ring-2 ring-amber-500': idx === store.reviewCurrentIndex,
              'opacity-50': item.reviewed
            }">
            <div class="flex justify-between items-center">
              <span class="text-white truncate flex-1">
                {{ item.reviewed && item.corrected ? item.corrected : item.text }}
              </span>
              <span class="ml-2 px-1.5 py-0.5 rounded text-xs"
                :class="item.reviewed ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'">
                {{ item.reviewed ? '✓' : (item.confidence * 100).toFixed(0) + '%' }}
              </span>
            </div>
            <div v-if="item.corrected && item.text !== item.corrected" class="text-gray-500 mt-1">
              原文: <span class="line-through">{{ item.text }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="p-4 border-t border-gray-800">
      <div class="text-xs text-gray-500 mb-2">
        快捷键: Enter 保存并下一条 | ← → 上下导航
      </div>
      <button @click="finishReview"
        class="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-sm font-medium">
        完成复核并回写
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useOcrStore } from '../store/ocr'

const store = useOcrStore()
const localThreshold = ref(store.reviewThreshold)
const correctedText = ref('')

watch(() => store.currentReviewItem, (item) => {
  if (item) {
    correctedText.value = item.corrected || ''
  }
}, { immediate: true })

function onThresholdChange() {
  store.enterReviewMode(localThreshold.value)
}

function markCorrect() {
  store.markCurrentReviewed()
  store.goToNextReviewItem()
}

function markAndNext() {
  if (correctedText.value.trim()) {
    store.markCurrentReviewed(correctedText.value.trim())
  } else {
    store.markCurrentReviewed()
  }
  store.goToNextReviewItem()
}

function skipItem() {
  store.goToNextReviewItem()
}

function jumpToItem(idx: number) {
  store.goToReviewItem(idx)
}

async function finishReview() {
  await store.saveCorrectionsToBackend()
  store.exitReviewMode()
}

function handleKeydown(e: KeyboardEvent) {
  if (!store.reviewModeActive) return
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    store.goToPrevReviewItem()
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    store.goToNextReviewItem()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>
