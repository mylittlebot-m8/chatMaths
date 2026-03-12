<script setup lang="ts">
import type { ClientMessage, UserClientMessage, AgentClientMessage } from '@chat-tutor/shared'
import UserMessage from './user-message.vue'
import AgentMessage from './agent-message.vue'
import TaskMessage from './task-message.vue'
import AvatarVideoMessage from './avatar-video-message.vue'
import type { AvatarVideoClientMessage } from '@chat-tutor/shared'

const messages = defineModel<ClientMessage[]>('messages', { default: () => [] })
const emit = defineEmits<{ (e: 'video-playing', isPlaying: boolean): void }>()
</script>

<template>
  <div class="flex flex-col h-full gap-2">
    <div
      v-for="message in messages"
      :key="message.id"
    >
      <UserMessage
        v-if="message.type === 'user'"
        :message="message as UserClientMessage"
      />
      <AgentMessage
        v-else-if="message.type === 'agent'"
        :message="message as AgentClientMessage"
      />
      <AvatarVideoMessage
        v-else-if="message.type === 'avatar-video'"
        :message="message as AvatarVideoClientMessage"
        @play="emit('video-playing', $event)"
      />
      <TaskMessage
        v-else
        :message="message"
      />
    </div>
  </div>
</template>
