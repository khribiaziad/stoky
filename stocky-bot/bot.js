import { chat } from './claude.js'
import { getProducts, createLead } from './stocky.js'

// Conversation state per phone number
const conversations = new Map()
const TIMEOUT_MS = 30 * 60 * 1000 // 30 min inactivity resets the conversation

// Products cache
let cachedProducts = []
let productsCachedAt = 0
const PRODUCTS_TTL = 5 * 60 * 1000 // refresh every 5 minutes

async function fetchProducts() {
  if (Date.now() - productsCachedAt < PRODUCTS_TTL && cachedProducts.length > 0) {
    return cachedProducts
  }
  try {
    cachedProducts = await getProducts()
    productsCachedAt = Date.now()
    console.log(`🛍️  Products refreshed (${cachedProducts.length} products)`)
  } catch (err) {
    console.error('Failed to fetch products:', err.message)
  }
  return cachedProducts
}

function getConversation(phone) {
  const existing = conversations.get(phone)
  if (existing && Date.now() - existing.lastActive < TIMEOUT_MS) {
    existing.lastActive = Date.now()
    return existing
  }
  // New conversation or expired
  const conv = { history: [], lastActive: Date.now() }
  conversations.set(phone, conv)
  return conv
}

export async function handleMessage(phone, text) {
  const conv = getConversation(phone)
  const products = await fetchProducts()

  // Add the customer's message to history
  conv.history.push({ role: 'user', content: text })

  const response = await chat(conv.history, products)

  // Claude wants to create an order
  if (response.stop_reason === 'tool_use') {
    const toolBlock = response.content.find(b => b.type === 'tool_use')

    if (toolBlock?.name === 'create_order') {
      const orderData = toolBlock.input

      // Save assistant turn (contains the tool_use block)
      conv.history.push({ role: 'assistant', content: response.content })

      let toolResult
      try {
        const result = await createLead({
          customer_name: orderData.customer_name,
          customer_phone: phone,
          customer_city: orderData.customer_city || '',
          customer_address: orderData.customer_address || '',
          items: orderData.items,
        })
        toolResult = { success: true, lead_id: result.id }
        console.log(`✅ Order created for ${phone} — lead #${result.id}`)
      } catch (err) {
        console.error('Failed to create lead:', err.message)
        toolResult = { success: false, error: err.message }
      }

      // Add tool result to history
      conv.history.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: JSON.stringify(toolResult),
        }],
      })

      // Get Claude's final confirmation message
      const finalResponse = await chat(conv.history, products)
      const finalText =
        finalResponse.content.find(b => b.type === 'text')?.text ||
        '✅ Your order has been placed! We will contact you soon to confirm delivery.'

      conv.history.push({ role: 'assistant', content: finalResponse.content })

      // Reset conversation after a successful order
      if (toolResult.success) {
        conversations.delete(phone)
      }

      return finalText
    }
  }

  // Normal conversation response
  const textBlock = response.content.find(b => b.type === 'text')
  const replyText = textBlock?.text || 'Sorry, something went wrong. Please try again.'

  conv.history.push({ role: 'assistant', content: response.content })

  return replyText
}
