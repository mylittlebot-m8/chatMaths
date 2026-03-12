<script setup lang="ts">
import { PromptArea } from '#/components/prompt-area'
import ChatMessages from './messages.vue'
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { type ClientMessage, type Resource, type AvatarVideoClientMessage } from '@chat-tutor/shared'

const props = defineProps<{
  running?: boolean
}>()

const input = ref('')
const resources = ref<Resource[]>([])
const messages = defineModel<ClientMessage[]>('messages', { default: [] })

const chatContainerRef = ref<HTMLDivElement | null>(null)
const promptAreaRef = ref()
const isUserScrolling = ref(false)
const isExplaining = ref(false)
const hasSentRequest = ref(false)
const isVideoLoading = ref(true)
let scrollTimeout: any = null

const emit = defineEmits<{
  send: [input: string, resources: Resource[]]
  stop: []
  explaining: [playing: boolean]
}>()

const videoQueue = computed(() => {
  return messages.value.filter(m => m.type === 'avatar-video') as AvatarVideoClientMessage[]
})

const currentVideoIndex = ref(0)
const isPlaying = ref(false)

const currentVideo = computed(() => {
  if (videoQueue.value.length === 0) return undefined
  return videoQueue.value[currentVideoIndex.value] || videoQueue.value[videoQueue.value.length - 1]
})

// Auto-advance to latest video if not playing
watch(() => videoQueue.value.length, (newLen, oldLen) => {
  if (newLen > 0) hasSentRequest.value = false // We got SOMETHING
  if (newLen > oldLen && !isPlaying.value) {
    currentVideoIndex.value = newLen - 1
  }
})

// Watch for video change to reset loading state
watch(() => currentVideo.value?.url, () => {
  if (currentVideo.value) {
    isVideoLoading.value = true
  }
})

const messagesWithoutVideos = computed(() => {
  return messages.value.filter(m => m.type !== 'avatar-video')
})

const handleVideoEnded = () => {
  if (currentVideoIndex.value < videoQueue.value.length - 1) {
    currentVideoIndex.value++
    nextTick(() => {
      isPlaying.value = true
    })
  } else {
    isPlaying.value = false
  }
}

const handleVideoPlaying = (playing: boolean) => {
  isPlaying.value = playing
  isExplaining.value = playing
  emit('explaining', playing)
  if (playing) {
    scrollToBottom()
  }
}

const handleSend = () => {
  if (input.value.trim()) {
    hasSentRequest.value = true
    currentVideoIndex.value = 0
    emit('send', input.value, resources.value)
    input.value = ''
    resources.value = []
  }
}

const blur = () => {
  promptAreaRef.value?.blur()
}

defineExpose({
  blur
})

const isAtBottom = () => {
  if (!chatContainerRef.value) return true
  const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.value
  return scrollHeight - scrollTop - clientHeight < 50
}

const scrollToBottom = () => {
  if (!chatContainerRef.value || isUserScrolling.value) return
  chatContainerRef.value.scrollTo({
    top: chatContainerRef.value.scrollHeight,
    behavior: 'smooth'
  })
}

const handleScroll = () => {
  if (!chatContainerRef.value) return

  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }

  const atBottom = isAtBottom()

  if (!atBottom) {
    isUserScrolling.value = true
  }

  scrollTimeout = setTimeout(() => {
    if (isAtBottom()) {
      isUserScrolling.value = false
    }
  }, 150)
}

watch(() => messages.value, () => {
  nextTick(() => {
    scrollToBottom()
  })
}, { deep: true })

onMounted(() => {
  scrollToBottom()
})

onUnmounted(() => {
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }
})
</script>

<template>
  <div class="flex flex-col h-full w-full overflow-hidden border-l border-gray-100 dark:border-gray-800">
    <!-- Featured Video (Avatar) Section with Queue Support -->
    <div v-if="currentVideo || running || hasSentRequest" class="p-3 bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800 shrink-0">
      <div class="relative group">
        <!-- Actual Video (using v-show to allow metadata/buffering in background) -->
        <video
          v-if="currentVideo"
          v-show="!isVideoLoading"
          :key="currentVideo.url"
          :src="currentVideo.url"
          class="w-full aspect-video object-cover rounded-xl shadow-lg border-2 border-primary/20"
          controls
          autoplay
          @play="handleVideoPlaying(true)"
          @pause="handleVideoPlaying(false)"
          @ended="handleVideoEnded"
          @canplay="isVideoLoading = false"
        ></video>
        
        <!-- Loading Placeholder / Preparing State -->
        <div 
          v-if="isVideoLoading || !currentVideo" 
          class="w-full aspect-video rounded-xl shadow-lg border-2 border-dashed border-primary/20 bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center relative overflow-hidden"
        >
          <img src="/placeholder.png" class="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-50" />
          <div class="z-10 flex flex-col items-center gap-3">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <div class="text-xs font-medium text-primary/80 animate-pulse">{{ $t('chat.avatarLoading') }}...</div>
          </div>
        </div>

        <div class="absolute top-2 left-2 flex items-center gap-2">
          <div class="px-2 py-0.5 bg-black/50 backdrop-blur-md rounded text-[10px] text-white uppercase tracking-widest font-bold border border-white/10">
            AI Avatar
          </div>
          <div v-if="videoQueue.length > 1 && !isVideoLoading" class="flex items-center gap-1">
            <button 
              v-for="(video, index) in videoQueue" 
              :key="video.id"
              @click="currentVideoIndex = index"
              class="px-2 py-0.5 backdrop-blur-md rounded text-[10px] font-bold transition-all border"
              :class="[
                currentVideoIndex === index 
                ? 'bg-primary text-white border-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]' 
                : 'bg-black/40 text-white/70 border-white/10 hover:bg-black/60'
              ]"
            >
              P{{ index + 1 }}
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <div
      ref="chatContainerRef"
      class="w-full flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar"
      @scroll="handleScroll"
    >
      <div class="flex flex-col gap-4">
        <ChatMessages :messages="messagesWithoutVideos" @video-playing="handleVideoPlaying" />
      </div>
    </div>
    <div
      class="max-md:fixed max-md:bottom-0 max-md:left-0 max-md:bg-background w-full p-4 flex-shrink-0"
    >
      <PromptArea
        ref="promptAreaRef"
        v-model:input="input"
        v-model:resources="resources"
        :running="running"
        :is-explaining="isExplaining"
        @send="handleSend"
        @stop="$emit('stop')"
      />
    </div>
  </div>
</template>
