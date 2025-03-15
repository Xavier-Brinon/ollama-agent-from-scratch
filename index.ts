import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import assert from 'node:assert/strict'
import { signal } from './abortController.ts'
import { contextedChat } from './runLLM.ts'
import { logger } from './logger.ts'

const indexLogger = logger.child({
  module: 'index'
})

const cli = readline.createInterface({ input, output })

const cliResponse = await cli.question('What do you want to aks the agent? ', { signal })
assert.ok(cliResponse !== '', 'cliResponse: cli.question returned empty string.')
cli.close()

const response = contextedChat({ prompt: cliResponse })
indexLogger.debug(response)
