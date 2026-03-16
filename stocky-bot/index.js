import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import 'dotenv/config'
import { handleMessage } from './bot.js'

const logger = pino({ level: 'silent' })

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./sessions')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: true,
    browser: ['Stocky Bot', 'Chrome', '1.0.0'],
    markOnlineOnConnect: false,
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      const shouldReconnect = code !== DisconnectReason.loggedOut
      console.log(`⚠️  Connection closed (code: ${code}). Reconnecting: ${shouldReconnect}`)
      if (shouldReconnect) startBot()
    } else if (connection === 'open') {
      console.log('✅ WhatsApp Bot is connected and ready!')
    } else if (connection === 'connecting') {
      console.log('🔄 Connecting to WhatsApp...')
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      // Skip empty messages and messages sent by the bot itself
      if (!msg.message || msg.key.fromMe) continue

      const jid = msg.key.remoteJid
      if (!jid) continue

      // Skip group messages
      if (jid.endsWith('@g.us')) continue

      const phone = jid.split('@')[0]

      // Extract text from different message types
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        ''

      if (!text.trim()) continue

      console.log(`📩 [${phone}]: ${text}`)

      try {
        const reply = await handleMessage(phone, text)
        await sock.sendMessage(jid, { text: reply })
        console.log(`📤 [${phone}]: ${reply.substring(0, 80)}${reply.length > 80 ? '...' : ''}`)
      } catch (err) {
        console.error(`❌ Error for ${phone}:`, err.message)
        await sock.sendMessage(jid, {
          text: 'Sorry, something went wrong. Please try again in a moment.',
        }).catch(() => {})
      }
    }
  })
}

console.log('🚀 Starting Stocky WhatsApp Bot...')
startBot().catch(console.error)
