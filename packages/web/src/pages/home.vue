<script setup lang="ts">
import { computed, ref } from 'vue'
import { PromptArea } from '#/components/prompt-area'
import { type Resource } from '@chat-tutor/shared'
import { client } from '#/utils/client'
import { useCreateChatStore } from '#/utils/stores'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  useSidebar,
  Button
} from '@chat-tutor/ui'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faWarning } from '@fortawesome/free-solid-svg-icons'
import { useSettingsStore } from '#/store/settings'

const input = ref('')
const resources = ref<Resource[]>([])
const running = ref(false)

const store = useCreateChatStore()
const router = useRouter()
const { t } = useI18n()

const handleSend = async (message: string, attachments: Resource[]) => {
  const storedUuid = localStorage.getItem('userUuid') || ''
  const storedType = localStorage.getItem('chatType') || ''
  const { data, error } = await client.chat.post({
    input: message,
    userId: storedUuid,
    type: storedType,
  })
  if (error) {
    return
  }
  store.prompt = message
  store.resources = attachments
  const { id } = data
  router.push(`/chat/${id}`)
}

const getTime = (): 'morning' | 'afternoon' | 'evening' => {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

const greeting = computed(() => {
  const time = getTime()
  return t('home.title', { time: t(`home.greeting.${time}`) })
})

const { isMobile } = useSidebar()

const settings = useSettingsStore()
const route = useRoute()
const userUuid = computed(() => route.query.uuid as string || '')

// 将 uuid 存储到 localStorage
if (userUuid.value) {
  localStorage.setItem('userUuid', userUuid.value)
}

// type 参数
const typeParam = computed(() => route.query.type as string || '')
if (typeParam.value) {
  localStorage.setItem('chatType', typeParam.value)
}

const showSettingsAlert = computed(() => {
  return (import.meta.env.VITE_USER_KEY_REQUIRED === 'true') && (!settings.apiKey)
})
</script>

<template>
  <div class="size-full flex flex-col p-5">
    <div
      class="flex flex-row w-full justify-start items-center gap-1"
      :class="{ 'ml-10': isMobile }"
    >
      <img
        src="/logo.png"
        alt="ChatTutor"
        class="w-10 h-10"
      >
      <span class="text-xl title font-bold select-none">AI.Guodu.Cn</span>
    </div>
    <div class="flex size-full items-center justify-center flex-col">
      <h1 class="text-4xl title select-none font-mono mb-18">
        {{ greeting }}
      </h1>
      <div class="h-32 w-full max-w-2xl">
        <PromptArea
          v-model:input="input"
          v-model:resources="resources"
          :running="running"
          @send="handleSend"
        />
      </div>
      <Alert class="mt-4 max-w-md" v-if="showSettingsAlert">
        <FontAwesomeIcon :icon="faWarning" />
        <AlertTitle>
          {{ t('settings.alert.keyRequired') }}
        </AlertTitle>
        <AlertDescription>
          <div>
            {{ t('settings.alert.pleaseSetKey') }}
          </div>
          <Button class="mt-1" variant="secondary" @click="router.push('/settings')">
            {{ t('settings.title') }}
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  </div>
</template>

<style lang="css" scoped>
.title {
  background: linear-gradient(to right, #90EE90 0%, #8BDEBD 50%, #87CEEB 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}
</style>
