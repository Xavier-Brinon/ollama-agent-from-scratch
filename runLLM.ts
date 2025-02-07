import assert from 'node:assert/strict'
import ollama from 'ollama'
import type { ChatRequest, ChatResponse, Message } from 'ollama'
import { AbortableAsyncIterator } from 'ollama/src/utils.js'
import { logger } from './logger.ts'

const runLLMLogger = logger.child({
  module: 'runLLM'
})

const models: Record<string, ChatRequest['model']> = {
  deepseek: 'deepseek',
  mistral: 'mistral',
  llama: 'llama',
}

/**
 * Runs a LLM model chat stream.
 * @name runLLM
 * @param prompt {string} - The prompt to run
 * @returns {Promise<AbortableAsyncIterator<ChatResponse>>} The response from the LLM
 * @example
 * const response = await runLLM('Hello, how are you?')
 * if (response) {
 *   for await (const chunk of response) {
 *     console.log(chunk)
 *   }
 * }
 */
export const runLLM = async (prompt: string): Promise<AbortableAsyncIterator<ChatResponse>> => {
  assert.ok(typeof prompt === 'string', `runLLM: prompt should be a string. Received: ${typeof prompt}`)
  assert.ok(prompt !== '', 'runLLM: prompt should not be empty')

  const message: Message = {
    role: 'user',
    content: prompt
  }

  let response: AbortableAsyncIterator<ChatResponse>
  try {
    response = await ollama.chat({
      model: models.mistral,
      messages: [message],
      stream: true
    })
  } catch (chatResponseError) {
    runLLMLogger.error({chatResponseError})
    throw chatResponseError
  }
  return response
}
