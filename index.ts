import ollama from 'ollama'
import type { ChatRequest, Message } from 'ollama'

const message: Message = {
  role: 'user',
  content: 'Why is the sky blue?'
}

const models: Record<string, ChatRequest['model']> = {
  deepseek: 'deepseek',
  mistral: 'mistral',
  llama: 'llama',
}

const response = await ollama.chat({
  model: models.deepseek,
  messages: [message],
  stream: true
})

for await (const part of response) {
  process.stdout.write(part.message.content)
}
