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
  tokenExpiry = Date.now() + 28 * 24 * 60 * 60 * 1000 // 28 days
  console.log('✅ Logged in to Stocky')
}

async function getToken() {
  if (!token || Date.now() > tokenExpiry) {
    await login()
  }
  return token
}

export async function getProducts() {
  const t = await getToken()
  const res = await axios.get(`${BASE}/api/products`, {
    headers: { Authorization: `Bearer ${t}` },
  })
  return res.data
}

export async function createLead(data) {
  const res = await axios.post(
    `${BASE}/api/leads/inbound?api_key=${API_KEY}`,
    data
  )
  return res.data
}
