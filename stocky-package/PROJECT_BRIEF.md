# STOCKY - E-Commerce Inventory Management System

## PROJECT OVERVIEW
Build a complete inventory and order management system for **Headz**, a Moroccan e-commerce business selling caps and accessories through Caleo delivery service.

**Owner:** Xtremeshutter (also runs media company and clothing brand Zango)  
**Platform:** Web application (PHP + MySQL backend, to be deployed on existing cPanel hosting)  
**Current Status:** React demo complete, ready for PHP implementation  
**Tech Stack:** PHP, MySQL, React (for file creation demos only)

---

## BUSINESS MODEL

### Products
- Caps (NY Cap, Polo Cap, Tommy Cap, etc.)
- Each product has variants (Size × Color)
- Products under 1 KG need seal bags
- Future: Will expand to other products

### Order Fulfillment via Caleo
1. **Customer orders** on social media (Facebook/Instagram)
2. **Owner uploads** "Pickup Parcels" PDF to Stocky
3. **System extracts** order data (customer, city, amount, etc.)
4. **Owner assigns** products to each order
5. **System calculates** costs, fees, and profit
6. **Caleo delivers** orders
7. **If returned** → Upload "Return PDF" → System restores stock

### Revenue Flow
- **Caleo transfers** total order amount to owner's bank account
- **This amount is SACRED** - never recalculated by Stocky
- Profit = Revenue - (Product Costs + Delivery + Packaging + Seal Bags + Stickers)

---

## KEY REQUIREMENTS

### 1. PDF PARSING (CRITICAL!)
Must parse **Pickup Parcels PDF** from Caleo to extract:
- CMD-ID (e.g., CMD-3446476-ST-265307)
- Customer Name (Destinataire field)
- Phone (téléphone field)
- City (Ville field)
- Address (Adresse field)
- Total Amount (e.g., 99Dhs)
- Date (document date)

**Library:** Use `smalot/pdfparser` (PHP)

### 2. ORDER EXPENSES (FLEXIBLE)
Each order can have:
- **Sticker:** 1 MAD (checkbox)
- **Seal Bag:** 1 MAD (checkbox, returnable if product returned)
- **Packaging:** Variable MAD (editable number, default 1 MAD)

These are **selected during order creation**, not fixed.

### 3. CITY-BASED FEES
Every city has:
- **Delivery Fee** (e.g., 35 MAD for Rabat)
- **Return Fee** (e.g., 5 MAD for Rabat)
- **Packaging Fee** (2 MAD if is_casa=true, 3 MAD if false)

See `morocco_cities.js` for full database.

### 4. RETURN PROCESSING
When order is returned:
1. Extract CMD-IDs from Return PDF
2. Match against existing orders in database
3. Show popup with checkboxes:
   - ☐ Seal Bag Returned (+1 MAD refund)
   - ☐ Product Broken (→ goes to broken stock, non-returnable)
4. If seal bag returned → +1 MAD recovery
5. If product broken → Stock goes to "Broken (Non-Returnable)" 
6. If product OK → Stock restored to sellable inventory

### 5. TEAM & FIXED EXPENSES
Separate page for:
- **Team Members:** Each with name, role, payment type (per order OR monthly fixed OR both)
- **Fixed Expenses:** Monthly recurring (rent, utilities) OR per order (help costs)
- **Facebook Ads:** Daily rate in USD (1 USD = 10 MAD), track rate changes over time
- **Withdrawals:** Track cash taken out of business (manual entries)

### 6. BROKEN STOCK TRACKING
Products can break from:
- Returns (product came back damaged)
- Storage damage (manual entry)

Each broken stock entry has:
- Product/Variant
- Quantity
- Source (Return CMD-ID or "Storage")
- **Returnable to Supplier:** Yes/No
- If Yes → Counts in capital (will get refund)
- If No → Lost value (doesn't count in capital)

### 7. CAPITAL CALCULATION
```
Total Capital = Cash Balance + Stock Value

Cash Balance = 
  Base Amount (user enters initial capital)
  + Clean Profit (from delivered orders)
  - Stock Purchases (automatic from stock arrivals)
  - Manual Withdrawals

Stock Value = 
  (Good Stock × Buying Price) +
  (Returnable Broken Stock × Buying Price) +
  0 for Non-Returnable Broken Stock
```

### 8. PROFIT CALCULATION
```
For Each Delivered Order:

Revenue = total_amount (from Pickup Parcels PDF - SACRED!)

Costs =
  Product Costs (sum of items × buying_price)
  + Delivery Fee (from city database)
  + Sticker (if checked: 1 MAD)
  + Seal Bag (if checked: 1 MAD)
  + Packaging (entered amount, default 1 MAD)

Profit = Revenue - Costs

For Cancelled Orders (Returns):
  Revenue = 0
  Costs = 
    Return Fee (from city database)
    + Lost expenses (sticker + packaging always lost)
    + Seal Bag (if not returned: -1 MAD, if returned: +1 MAD refund)
    + Product Cost (if broken: -60 MAD lost, if OK: 0 as stock restored)
```

### 9. REPORTS PAGE
Must show (with date filters: Big Total, This Week, This Month, Yesterday, Last 7 Days, Custom Range):

**Section 1: Financials**
- Total Capital (Cash + Stock)
- Revenue & Profit
- Expenses Breakdown

**Section 2: Team & Costs** (links to Team page)
- Owner salary (per order)
- Team member costs
- Fixed expenses
- Facebook ads
- Withdrawals

**Section 3: Order Overview**
- Top Products (clickable → detailed table)
- Top Cities (clickable → detailed table)
- Order Status (clickable → filtered order list)
- Broken Products (clickable → broken stock list)
- Performance Metrics (delivery rate, return rate, avg order value, etc.)

---

## DATABASE SCHEMA

### Products Table
```sql
id, name, category, has_sizes, has_colors, created_at
```

### Variants Table
```sql
id, product_id, size, color, buying_price, selling_price, 
stock, low_stock_threshold, created_at
```

### Cities Table
```sql
id, name, delivery_fee, return_fee, is_casa
```

### Orders Table
```sql
id, caleo_id, customer_name, customer_phone, customer_address,
city, total_amount, status, order_date, created_at
```

### Order Items Table
```sql
id, order_id, product_name, size, color, quantity, 
unit_cost, unit_price
```

### Order Expenses Table
```sql
id, order_id, sticker, seal_bag, packaging, 
delivery_fee, return_fee, seal_bag_returned, product_broken
```

### Team Members Table
```sql
id, name, role, payment_type, fixed_monthly, per_order_rate, 
start_date, end_date, is_active
```

### Fixed Expenses Table
```sql
id, name, type, amount, description, start_date, is_active
(type = 'monthly' OR 'per_order')
```

### Facebook Ads Table
```sql
id, daily_rate_usd, start_date, end_date
(track rate changes over time)
```

### Withdrawals Table
```sql
id, amount, description, type, date, created_at
(type = 'stock_purchase' (auto) OR 'manual')
```

### Stock Arrivals Table
```sql
id, variant_id, quantity, additional_fees, description, 
total_cost, date, created_at
```

### Broken Stock Table
```sql
id, variant_id, quantity, source, source_order_id, 
returnable_to_supplier, value_lost, date, created_at
```

---

## FILE STRUCTURE

```
/
├── index.php (main entry point)
├── config/
│   ├── database.php (DB connection)
│   └── constants.php (app settings)
├── includes/
│   ├── header.php
│   ├── footer.php
│   └── navigation.php
├── api/ (AJAX endpoints)
│   ├── products.php
│   ├── orders.php
│   ├── upload_pickup.php (PDF parser)
│   ├── upload_return.php (PDF parser)
│   ├── team.php
│   ├── expenses.php
│   └── reports.php
├── pages/
│   ├── dashboard.php
│   ├── products.php
│   ├── stock.php
│   ├── orders.php
│   ├── team.php
│   └── reports.php
├── assets/
│   ├── css/
│   ├── js/
│   └── uploads/ (PDF storage)
└── vendor/ (Composer dependencies)
```

---

## EXISTING ASSETS

### 1. React Demo
**Location:** `/mnt/user-data/outputs/stocky-final.jsx`
**Purpose:** Full UI/UX reference (2491 lines)
**Contains:** All workflows, modals, forms, calculations
**Use For:** Understanding business logic, UI structure, calculations

### 2. Cities Database
**Location:** `/home/claude/morocco_cities.js`
**Purpose:** ~100 Moroccan cities with delivery/return fees
**Format:** `{ name, delivery_fee, return_fee, is_casa }`

### 3. Sample PDFs
**Pickup Parcels:** `/mnt/user-data/uploads/pickup_parcels_BRM-8330688-CP-903F44.pdf`
- 7 pages, 1 order per page
- Contains: CMD-ID, customer name, phone, city, address, total, date

**Return PDF:** `/mnt/user-data/uploads/return.pdf`
- Page 2 has table with CMD-IDs
- Only need to extract CMD-IDs and match against existing orders

### 4. Previous Transcripts
**Main Planning:** `/mnt/transcripts/2026-02-17-00-58-27-ecommerce-inventory-system-planning.txt`
**Ramassage Workflow:** `/mnt/transcripts/2026-02-18-20-09-28-stocky-ramassage-workflow-pdf-parsing.txt`

---

## CRITICAL BUSINESS RULES

### 1. Revenue from Pickup Parcels PDF is SACRED
**Never recalculate the total_amount field!**
- What Caleo shows in PDF = What Caleo transfers to bank
- Store this value as-is in `orders.total_amount`
- Use it for profit calculation, but NEVER modify it

### 2. Stock Purchases = Automatic Withdrawals
When adding stock:
- Total Cost = (Quantity × Buying Price) + Additional Fees
- Auto-create withdrawal record
- Mark as type='stock_purchase' (cannot be edited/deleted)
- Reduces cash balance automatically

### 3. Packaging Fee Depends on City
```php
$packaging_fee = $city['is_casa'] ? 2 : 3;
```
**BUT** if order has custom packaging expense, use that instead!

### 4. Seal Bags Only for Products < 1 KG
Currently all caps are < 1 KG, so seal bag checkbox should be shown.
Future: Add weight field to products, hide seal bag option if product >= 1 KG.

### 5. Return Fee Comes from City, Not Return PDF
Return PDF only has CMD-IDs. To get return fee:
1. Find order by CMD-ID
2. Get order's city
3. Look up city in cities table
4. Use city's return_fee value

### 6. Broken Stock Doesn't Count in Sellable Stock
```php
// Products page stock display
Good Stock: 48 units (sellable)
Broken Stock: 2 units (not sellable)
  ├─ Returnable: 1 unit (counts in capital)
  └─ Non-Returnable: 1 unit (lost, doesn't count)
```

---

## WORKFLOW EXAMPLES

### Example 1: Upload Pickup Parcels PDF
```
1. User clicks "Upload Pickup Parcels"
2. Selects pickup_parcels_xxx.pdf
3. PHP parses PDF using smalot/pdfparser:
   - Extract text from each page
   - Find CMD-ID pattern: CMD-\d+-ST-\d+
   - Extract: Destinataire, téléphone, Ville, Adresse, Total, Date
4. Return JSON array of extracted orders
5. Show popup with all orders
6. For each order:
   - Select products (dropdowns)
   - Check expenses: ☑ Sticker ☑ Seal Bag ☑ Packaging: [1] MAD
7. Click "Save All Orders"
8. PHP creates order records + order_items + order_expenses
9. Reduces stock for all assigned products
10. Redirects to Orders page
```

### Example 2: Process Returns
```
1. User clicks "Upload Returns"
2. Selects return.pdf
3. PHP parses PDF:
   - Extract CMD-IDs from page 2 table
4. Match CMD-IDs against orders table
5. Show popup with found orders:
   Order: CMD-3567863-ST-265307 | rachid | Rabat | 99 MAD
   ☐ Seal Bag Returned (+1 MAD)
   ☐ Product Broken
6. User checks: ☑ Seal Bag Returned
7. Click "Confirm Returns"
8. PHP:
   - Update order status = 'cancelled'
   - Restore stock to good inventory
   - Record seal_bag_returned = true
   - Calculate return cost: -5 MAD (return fee) +1 MAD (seal bag)
9. Refresh Orders page
```

### Example 3: Add Stock
```
1. User goes to Stock page
2. Clicks "Add Stock"
3. Fills form:
   - Product: NY Cap
   - Variant: M - Black
   - Quantity: 50
   - Buying Price: 60 MAD (auto from variant)
   - Additional Fees: 200 MAD (shipping)
   - Description: "Stock from supplier Ali"
4. System calculates: (50 × 60) + 200 = 3,200 MAD
5. Click "Add Stock"
6. PHP:
   - Adds 50 to variant stock
   - Creates stock_arrivals record
   - Auto-creates withdrawal record (type='stock_purchase', amount=3200)
   - Reduces cash balance by 3,200 MAD
7. Success message
```

---

## DEPLOYMENT NOTES

### Existing Hosting
- **Platform:** cPanel with phpMyAdmin
- **Database:** MySQL available
- **PHP Version:** Check server (likely 7.4 or 8.x)
- **Composer:** May need to install or use dependencies manually

### PDF Parsing Library
```bash
composer require smalot/pdfparser
```

**If no Composer access:**
- Download library manually
- Include via `require_once`

### File Uploads
- Store PDFs in `/assets/uploads/`
- Set proper permissions (755 for dirs, 644 for files)
- Add `.htaccess` to prevent direct PDF access

---

## NEXT STEPS

1. **Set up database schema** (all tables above)
2. **Import cities data** from morocco_cities.js
3. **Build PDF parser** for Pickup Parcels
4. **Build PDF parser** for Returns
5. **Create API endpoints** for all CRUD operations
6. **Build pages** (use React demo as UI reference)
7. **Test with real PDFs** provided in `/mnt/user-data/uploads/`
8. **Deploy to cPanel**

---

## IMPORTANT NOTES

### Do NOT Implement
- ❌ Ramassage PDF parsing (old format, no longer used)
- ❌ Stocky ID generation (use Caleo CMD-ID only)
- ❌ Price recalculation (use PDF amount as-is)

### Special Attention Needed
- ⚠️ PDF text extraction quality (test with real PDFs)
- ⚠️ City name matching (handle variations: "tangier" vs "Tanger")
- ⚠️ UTF-8 encoding for Arabic/French characters
- ⚠️ Date format conversion (M/D/YYYY → YYYY-MM-DD)
- ⚠️ Exchange rate (1 USD = 10 MAD for Facebook ads)

### User Experience
- All modals should be full-screen (like React demo)
- Show loading indicators during PDF parsing
- Clear error messages if PDF parsing fails
- Confirmation before destructive actions (delete order)
- Auto-save form data to prevent loss

---

## CONTACT / QUESTIONS

If anything is unclear:
1. Check React demo (`/mnt/user-data/outputs/stocky-final.jsx`)
2. Review transcripts in `/mnt/transcripts/`
3. Test with sample PDFs in `/mnt/user-data/uploads/`

**Goal:** Production-ready system that handles real Caleo PDFs and calculates accurate profit for Moroccan e-commerce business.
