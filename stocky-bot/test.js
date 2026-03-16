import 'dotenv/config'
import { getProducts } from './stocky.js'
import { handleMessage } from './bot.js'

console.log('🧪 Testing Stocky Bot (without WhatsApp)\n')

// Test 1: Connect to Stocky and fetch products
console.log('--- Test 1: Fetching products from Stocky ---')
try {
  const products = await getProducts()
  console.log(`✅ Connected to Stocky — ${products.length} products found`)
  products.slice(0, 3).forEach(p => {
    const inStock = p.variants?.filter(v => v.stock > 0).length || 0
    console.log(`   • ${p.name} (${inStock} variants in stock)`)
  })
} catch (err) {
  console.error('❌ Failed to connect to Stocky:', err.message)
  process.exit(1)
}

console.log()

// Test 2: Simulate a customer conversation in French
console.log('--- Test 2: Customer conversation (French) ---')
const phone = '212600000001'
const messages = [
  'Bonjour',
  'Je cherche une casquette',
  'Je prends la taille M en noir, 1 pièce',
  'Mon nom est Ahmed Benali, je suis à Casablanca, rue Hassan II n°5',
  'Oui je confirme',
]

for (const msg of messages) {
  console.log(`\n👤 Customer: ${msg}`)
  try {
    const reply = await handleMessage(phone, msg)
    console.log(`🤖 Bot: ${reply}`)
  } catch (err) {
    console.error('❌ Error:', err.message)
    break
  }
}

console.log('\n--- Test 3: Customer conversation (Darija) ---')
const phone2 = '212600000002'
const reply = await handleMessage(phone2, 'السلام عليكم، بغيت نشري شي حاجة')
console.log(`\n👤 Customer: السلام عليكم، بغيت نشري شي حاجة`)
console.log(`🤖 Bot: ${reply}`)

console.log('\n✅ All tests done!')
