import process from 'node:process'

const abortController = new AbortController()
export const { signal, abort } = abortController

process.on('exit', code => {
  abortController.abort({ onExit: code })
  console.log('\nOnExit triggered with code', { code })
})
