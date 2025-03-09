import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import ollama from 'ollama'
import type { ChatRequest, ChatResponse, Message } from 'ollama'
import { logger } from './logger.ts'
import { AbortableAsyncIterator } from './utils.ts'

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
 * @param prompt { prompt:  string } - The prompt to run
 * @returns {Promise<AbortableAsyncIterator<ChatResponse>>} The response from the LLM
 * @example
 * const response = await runLLM({ prompt: 'Hello, how are you?' })
 * if (response) {
 *   for await (const chunk of response) {
 *     console.log(chunk)
 *   }
 * }
 */
export const runLLM = async ({ prompt }: { prompt: string }): Promise<AbortableAsyncIterator<ChatResponse>> => {
  assert.ok(typeof prompt === 'string', `runLLM: prompt should be a string. Received: ${typeof prompt}`)
  assert.ok(prompt !== '', 'runLLM: prompt should not be empty')

  const message: Message = {
    role: 'user',
    content: prompt
  }

  let response: AbortableAsyncIterator<ChatResponse>
  try {
    // @ts-ignore
    response = await ollama.chat({
      model: models.mistral,
      messages: [message],
      stream: true
    })
  } catch (chatResponseError) {
    runLLMLogger.error({chatResponseError})
    throw chatResponseError
  }

/**
 * Types of response can be
 * {
 *   "model": "mistral",
 *   "created_at": "2025-02-06T10:57:47.1218Z",
 *   "message": {
 *     "role": "assistant",
 *     "content": " don"
 *   },
 *   "done": false
 * }
 * or
 * {
 *   "model": "mistral",
 *   "created_at": "2025-02-06T10:57:52.180751Z",
 *   "message": {
 *     "role": "assistant",
 *     "content": ""
 *   },
 *   "done_reason": "stop",
 *   "done": true,
 *   "total_duration": 6119617916,
 *   "load_duration": 568060333,
 *   "prompt_eval_count": 6,
 *   "prompt_eval_duration": 456000000,
 *   "eval_count": 147,
 *   "eval_duration": 5094000000
 * }
 */
  return response
}

/**
 * Runs a LLM modal chat stream with memory of the past messages.
 * @name runLLMChat
 * @param messageContent {string} - The prompt to run
 * @param context {Message[]} - The content of the whole conversation so far
 * @returns {Promise<AbortableAsyncIterator<ChatResponse>>} The response from the LLM
 * @example
 * const response = await runLLM({ messageContent: 'What's my name?',  context: [])
 * if (response) {
 *   for await (const chunk of response) {
 *     console.log(chunk)
 *   }
 * }
 * // Append the response to the current context for the next message.
 */
export const runLLMChat = async ({ messageContent, context }: { messageContent: string, context: Message[] }): Promise<AbortableAsyncIterator<ChatResponse>> => {
  assert.ok(typeof messageContent === 'string', `runLLM: messageContent should be a string. Received: ${typeof messageContent}`)
  assert.ok(messageContent !== '', 'runLLM: message should not be empty')

  const message: Message = {
    role: 'user',
    content: messageContent
  }

  let response: AbortableAsyncIterator<ChatResponse>
  try {
    // @ts-ignore
    response = await ollama.chat({
      model: models.mistral,
      messages: [...context, message],
      stream: true
    })
  } catch (chatResponseError) {
    runLLMLogger.error({chatResponseError})
    throw chatResponseError
  }
  return response
}

export const contextedChat = ({ prompt }: { prompt: string }) => {
  assert.ok(typeof prompt === 'string', `The prompt text should be a string, got ${typeof prompt}`)
  assert.ok(prompt !== '', 'Prompt text is empty')

  const contextDB = new DatabaseSync('./context.db', {
    allowExtension: true
  })
  contextDB.loadExtension('./plugins/json1.dylib')

  contextDB.prepare(`
    create table if not exists context (
      rowid integer primary key autoincrement,
      response text
    )
  `).run()

  /**
   * This chat look for any saved context and add it to the prompt.
   * It then inserts the answer in the table and returns that answer.
   */
  const prepHasContext = contextDB.prepare(`
    select count(*) as count from context limit 1;
  `)
  const { count }  = prepHasContext.get() as { count : number }
  let chatHistory = [] 
  if (count !== 0) {
    // Collect the previous answers.
  }
  runLLMChat({ messageContent: prompt, context: chatHistory })
}
