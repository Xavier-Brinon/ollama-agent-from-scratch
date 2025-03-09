/**
 * Reexported from 'ollama/src/utils.ts' and 'ollama/src/interface.ts'.
 * Nodejs doesn't yet strip types from node_modules files.
 */
export interface ErrorResponse {
  error: string
}

/**
 * An AsyncIterator which can be aborted
 */
export class AbortableAsyncIterator<T extends object> {
  private readonly abortController: AbortController
  private readonly itr: AsyncGenerator<T | ErrorResponse>
  private readonly doneCallback: () => void

  constructor(abortController: AbortController, itr: AsyncGenerator<T | ErrorResponse>, doneCallback: () => void) {
    this.abortController = abortController
    this.itr = itr
    this.doneCallback = doneCallback
  }

  abort() {
    this.abortController.abort()
  }

  async *[Symbol.asyncIterator]() {
    for await (const message of this.itr) {
      if ('error' in message) {
        throw new Error(message.error)
      }
      yield message
      // message will be done in the case of chat and generate
      // message will be success in the case of a progress response (pull, push, create)
      if ((message as any).done || (message as any).status === 'success') {
        this.doneCallback()
        return
      }
    }
    throw new Error('Did not receive done or success response in stream.')
  }
}
