import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import assert from 'node:assert/strict'
import { signal } from './abortController.ts'
import { runLLM } from './runLLM.ts'
import type { ChatResponse, Message } from 'ollama'
import { logger } from './logger.ts'

const indexLogger = logger.child({
  module: 'index'
})

const cli = readline.createInterface({ input, output })

const cliResponse = await cli.question('What do you want to aks the agent? ', { signal })
assert.ok(cliResponse !== '', 'cliResponse: cli.question returned empty string.')
cli.close()

const response = await runLLM({ prompt: cliResponse })
if (response) {
  const fullResponse: ChatResponse[] = []
  let fullContent: Message['content'] = ''

  for await (const part of response) {
    fullResponse.push(part)
    if (part?.message?.content) {
      fullContent += part.message.content
    }
    process.stdout.write(part.message.content)
  }

  indexLogger.debug({ fullContent })
  indexLogger.debug({ fullResponse: JSON.stringify(fullResponse, null, 2) })
}
