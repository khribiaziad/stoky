import { sendToRex, createLead } from './rex.js'

// Conversation state per phone number
const conversations = new Map()
const TIMEOUT_MS = 30 * 60 * 1000 // 30 min inactivity resets the conversation

function getConversation(phone) {
  const existing = conversations.get(phone)
  if (existing && Date.now() - existing.lastActive < TIMEOUT_MS) {
    existing.lastActive = Date.now()
    return existing
  }
  const conv = { history: [], lastActive: Date.now() }
  conversations.set(phone, conv)
  return conv
}

export async function handleMessage(phone, text) {
  const conv = getConversation(phone)

  // Add customer message to history
  conv.history.push({ role: 'user', content: text })

  // Send to Rex
  const response = await sendToRex({
    phone,
    message: text,
    history: conv.history.slice(0, -1), // history before this message
  })

  // Rex wants to create an order
  if (response.tool_use?.name === 'create_order') {
    const orderData = response.tool_use.input

    // Save assistant turn with tool_use block
    conv.history.push({ role: 'assistant', content: response.assistant_content })

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

    // Send tool result back to Rex for final reply
    const finalResponse = await sendToRex({
      phone,
      message: '',
      history: conv.history,
      tool_result: {
        tool_use_id: response.tool_use.id,
        content: JSON.stringify(toolResult),
      },
    })

    const finalText = finalResponse.text ||
      '✅ Your order has been placed! We will contact you soon to confirm delivery.'

    conv.history.push({ role: 'assistant', content: finalResponse.assistant_content })

    // Reset conversation after successful order
    if (toolResult.success) {
      conversations.delete(phone)
    }

    return finalText
  }

  // Normal reply
  const replyText = response.text || 'Sorry, something went wrong. Please try again.'
  conv.history.push({ role: 'assistant', content: response.assistant_content })

  return replyText
}
