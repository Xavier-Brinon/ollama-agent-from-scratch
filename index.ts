import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import assert from 'node:assert/strict'
import ollama from 'ollama'
import type { ChatRequest, Message } from 'ollama'

const cli = readline.createInterface({ input, output })

const cliResponse = await cli.question('What do you want to aks the agent?')
assert.ok(cliResponse !== '', 'cliResponse: cli.question returned empty string.')
cli.close()

const message: Message = {
  role: 'user',
  content: cliResponse
}

const models: Record<string, ChatRequest['model']> = {
  deepseek: 'deepseek',
  mistral: 'mistral',
  llama: 'llama',
}

const response = await ollama.chat({
  model: models.mistral,
  messages: [message],
  stream: true
})

for await (const part of response) {
  process.stdout.write(part.message.content)
}
