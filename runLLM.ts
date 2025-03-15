import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import ollama from 'ollama'
import type { ChatRequest, ChatResponse, Message } from 'ollama'
import { logger } from './logger.ts'
import { AbortableAsyncIterator } from './utils.ts'

const runLLMLogger = logger.child({
  module: 'runLLM'
})

const contextedChatLogger = logger.child({
  module: 'contextedChat'
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

export const contextedChat = async ({ prompt }: { prompt: string }): Promise<AbortableAsyncIterator<ChatResponse>> => {
  assert.ok(typeof prompt === 'string', `runLLM: prompt should be a string. Received: ${typeof prompt}`)
  assert.ok(prompt !== '', 'runLLM: prompt should not be empty')

  const historyDB = new DatabaseSync('./history.db', {
    allowExtension: true
  })
  historyDB.loadExtension('./plugins/json1.dylib')
  historyDB.prepare('create table if not exists history (prompt text)').run()
  const oldPromptsPrep = historyDB.prepare(`
    select
      prompt -> 'message' ->> 'role' as role,
      prompt -> 'message' ->> 'content' as content
    from history;
  `)
  const oldPrompts = oldPromptsPrep.all() as { message: Message }[]
  contextedChatLogger.debug({ oldPrompts })

  const newMessage = {
    message: {
      role: 'user',
      content: prompt
    }
  }
  const addPromptPrep = historyDB.prepare(`
    insert into history (prompt)
      values (jsonb(?))
    returning *;
  `)
  const addPromptRun = addPromptPrep.run(JSON.stringify(newMessage))
  contextedChatLogger.debug({ addPromptRun })

  const response = await runLLMChat({ messageContent: prompt, context: [] })
  if (response) {
    const fullResponse: ChatResponse[] = []
    let fullContent: Message['content'] = ''

    for await (const part of response) {
      fullResponse.push(part)
      if (part?.message?.content) {
        fullContent += part.message.content
      }
      process.stdout.write(part.message.content)
      if (part.done === true) {
        part.message.content = fullContent
        contextedChatLogger.debug({ part })
      }
    }
  }

  return response
}

export const contextedChat_ = async ({ prompt }: { prompt: string }) => {
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
  const { count } = prepHasContext.get() as { count: number }
  let chatHistory = [] as { message: Message }[]
  if (count !== 0) {
    // Collect the previous answers.
    // e.g. select response -> 'message' ->> 'content' from context;
    const prepGetContext = contextDB.prepare(`
      select
        response -> 'message' ->> 'role' as role,
        response -> 'message' ->> 'content' as content
      from context;
    `)
    const runGetContext = prepGetContext.all() as { message: Message }[]
    chatHistory = runGetContext
  }
  const messagePrompt = { message: { role: 'user', content: prompt} }
  chatHistory = [...chatHistory, messagePrompt]
  contextedChatLogger.debug({ chatHistory, context: chatHistory.map(({ message }) => message) })
  const response = await runLLMChat({ messageContent: prompt, context: chatHistory.map(({ message }) => message) })
  if (response) {
    const fullResponse: ChatResponse[] = []
    let fullContent: Message['content'] = ''

    for await (const part of response) {
      fullResponse.push(part)
      if (part?.message?.content) {
        fullContent += part.message.content
      }
      process.stdout.write(part.message.content)
      if (part.done === true) {
        part.message.content = fullContent
        const prepInsertChat = contextDB.prepare(`
          insert into context (response)
          values (jsonb(?))
          returning *;
        `)
        const runInsertPrompt = prepInsertChat.run(JSON.stringify(messagePrompt))
        const runInsertChat = prepInsertChat.all(JSON.stringify(part))
        contextedChatLogger.debug({ runInsertPrompt, runInsertChat })
      }
    }
  }

  return response
}
