import { BaseChatSource, type BaseSourceOptions } from './baseSource'

/**
 * Phase 2 stub. Will connect to the Streamer.bot WebSocket server and map
 * its chat/sub/redeem events onto ChatSourceEvents. Bot filtering, dedup,
 * and command parsing are already inherited from BaseChatSource, so this
 * class only needs the socket plumbing and event mapping.
 */
export class StreamerbotChatSource extends BaseChatSource {
  constructor(options: BaseSourceOptions) {
    super(options)
  }

  connect(): Promise<void> {
    return Promise.reject(
      new Error('StreamerbotChatSource is a phase 2 stub and is not implemented yet'),
    )
  }

  disconnect(): Promise<void> {
    return Promise.resolve()
  }
}
