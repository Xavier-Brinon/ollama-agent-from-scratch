import assert from 'node:assert/strict'
import ollama from 'ollama'
import type { ChatRequest, Message } from 'ollama'

const models: Record<string, ChatRequest['model']> = {
  deepseek: 'deepseek',
  mistral: 'mistral',
  llama: 'llama',
}

export const runLLM = async (prompt: Message['content']) => {
  assert.ok(typeof prompt === 'string', `runLLM: prompt should be a string. Received: ${typeof prompt}`)
  assert.ok(prompt !== '', 'runLLM: prompt should not be empty')

  const message: Message = {
    role: 'user',
    content: prompt
  }

  return await ollama.chat({
    model: models.mistral,
    messages: [message],
    stream: true
  })
}
