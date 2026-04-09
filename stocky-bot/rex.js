import axios from 'axios'
import 'dotenv/config'

const BASE = process.env.STOCKY_URL
const API_KEY = process.env.STOCKY_API_KEY

let token = null
let tokenExpiry = 0

async function login() {
  const res = await axios.post(`${BASE}/api/auth/login`, {
    username: process.env.STOCKY_USERNAME,
    password: process.env.STOCKY_PASSWORD,
  })
  token = res.data.token
  tokenExpiry = Date.now() + 28 * 24 * 60 * 60 * 1000
  console.log('✅ Logged in to Stocky')
}

async function getToken() {
  if (!token || Date.now() > tokenExpiry) await login()
  return token
}

/**
 * Send a customer message to Rex and get a reply.
 * Rex handles product lookups, order tracking, and order creation.
 */
export async function sendToRex({ phone, message, history = [], tool_result = null }) {
  const body = {
    api_key: API_KEY,
    phone,
    message,
    history,
  }
  if (tool_result) body.tool_result = tool_result

  const res = await axios.post(`${BASE}/api/rex/customer`, body)
  return res.data
}

/**
 * Create a lead in Stocky after Rex collects order details.
 */
export async function createLead(data) {
  const res = await axios.post(
    `${BASE}/api/leads/inbound?api_key=${API_KEY}`,
    data
  )
  return res.data
}
