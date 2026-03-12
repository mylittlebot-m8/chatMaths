<script setup lang="ts">
import { ref } from 'vue'
import type { AvatarVideoClientMessage } from '@chat-tutor/shared'

const props = defineProps<{
  message: AvatarVideoClientMessage
}>()

const emit = defineEmits<{
  (e: 'play', isPlaying: boolean): void
}>()

const videoRef = ref<HTMLVideoElement | null>(null)

const handlePlay = () => {
  emit('play', true)
}

const handlePause = () => {
  emit('play', false)
}

const handleEnded = () => {
  emit('play', false)
}
</script>

<template>
  <div class="flex flex-col mt-2 mb-2">
    <div class="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm max-w-sm">
      <video
        ref="videoRef"
        class="w-full aspect-square object-cover"
        :src="message.url"
        controls
        autoplay
        @play="handlePlay"
        @pause="handlePause"
        @ended="handleEnded"
      ></video>
    </div>
  </div>
</template>
