<script setup lang="ts">
import { PageType, type Page } from '@chat-tutor/shared'
import MermaidPage from './mermaid-page.vue'
import GGBPage from './ggb-page.vue'

defineProps<{
  current: string | null
  pages: Page[]
  isExplaining?: boolean
}>()
</script>

<template>
  <div class="relative size-full">
    <div
      v-for="page in pages"
      :key="page.id"
      class="absolute inset-0"
    >
      <MermaidPage
        v-if="page.type === PageType.MERMAID"
        v-show="current === page.id"
        :page="page"
        :visible="current === page.id"
        :is-explaining="isExplaining"
      />
      <GGBPage
        v-if="page.type === PageType.GGB"
        v-show="current === page.id"
        :page="page"
        :visible="current === page.id"
        :is-explaining="isExplaining"
      />
      <div 
        v-show="isExplaining && current === page.id" 
        class="absolute inset-0 z-50 bg-gray-500/10 cursor-not-allowed" 
        title="Teacher is explaining..."
      ></div>
    </div>
  </div>
</template>
