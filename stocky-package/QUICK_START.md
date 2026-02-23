# STOCKY - Quick Start Guide for Claude Code

## 📦 Files Provided

1. **PROJECT_BRIEF.md** - Complete project overview, business model, requirements (READ THIS FIRST!)
2. **TECHNICAL_SPECS.md** - All formulas, calculations, database schema, API endpoints
3. **morocco_cities.js** - 100+ Moroccan cities with delivery/return fees
4. **stocky-final.jsx** - Complete React demo (2491 lines) - UI/UX reference
5. **pickup_parcels_BRM-8330688-CP-903F44.pdf** - Real sample PDF to parse (7 orders)
6. **return.pdf** - Real sample return PDF

## 🚀 Quick Start

### Step 1: Read the Brief
```bash
cat PROJECT_BRIEF.md
```
This gives you the full business context and requirements.

### Step 2: Review Technical Specs
```bash
cat TECHNICAL_SPECS.md
```
All calculation formulas, database queries, and API structure.

### Step 3: Examine the React Demo
```bash
cat stocky-final.jsx | less
```
See how the UI/workflows are designed. This is your reference for business logic.

### Step 4: Test PDF Parsing
```bash
# Install PDF parser
composer require smalot/pdfparser

# Test parsing the real Pickup Parcels PDF
php test_parse_pickup.php
```

## 🎯 Priority Order

### Phase 1: Database Setup
1. Create all tables (see TECHNICAL_SPECS.md)
2. Import cities from morocco_cities.js
3. Create sample products (NY Cap, Polo Cap, Tommy Cap)

### Phase 2: PDF Parsing
1. Build Pickup Parcels parser
2. Test with pickup_parcels_BRM-8330688-CP-903F44.pdf
3. Build Return parser
4. Test with return.pdf

### Phase 3: Core Features
1. Orders CRUD
2. Products CRUD
3. Stock management
4. Upload & parse PDFs
5. Process returns

### Phase 4: Team & Expenses
1. Team members management
2. Fixed expenses
3. Facebook ads tracking
4. Withdrawals

### Phase 5: Reports
1. Financial overview
2. Profit calculations
3. Order analytics
4. Team costs breakdown

## 🔍 Key Points

### Critical Business Rules
1. **Revenue from PDF is SACRED** - Never recalculate `total_amount`
2. **Stock purchases = Auto withdrawals** - Reduce cash balance automatically
3. **Return fees from city database** - Not from return PDF
4. **Seal bags are returnable** - Can recover 1 MAD if physically returned
5. **Broken stock tracking** - Returnable vs Non-Returnable to supplier

### PDF Parsing Requirements
- Extract CMD-ID pattern: `CMD-\d+-ST-\d+`
- Handle UTF-8 (Arabic/French characters)
- City name normalization ("tangier" → "Tanger")
- Date format conversion (M/D/YYYY → YYYY-MM-DD)

### Calculation Order
```
Order Profit = Revenue - (Product Costs + Delivery + Sticker + Seal Bag + Packaging)
Clean Profit = Order Profits - (Team Costs + Fixed Expenses + Ads + Withdrawals)
Cash Balance = Base Amount + Clean Profit - Stock Purchases - Manual Withdrawals
Stock Value = (Good Stock × Price) + (Returnable Broken × Price)
Total Capital = Cash Balance + Stock Value
```

## 📊 Database Schema Quick Reference

```
products → variants → stock
orders → order_items + order_expenses
team_members → calculate team costs
fixed_expenses → calculate fixed costs
facebook_ads → track rate changes
withdrawals → stock_purchase (auto) | manual
stock_arrivals → create auto withdrawals
broken_stock → returnable | non-returnable
cities → delivery_fee + return_fee + is_casa
```

## 🧪 Test Cases

### Must Work
- [ ] Parse 7 orders from pickup_parcels PDF
- [ ] Extract: CMD-ID, name, phone, city, address, total, date
- [ ] Handle city name variations (tangier/Tanger)
- [ ] Create orders with custom expenses (sticker, seal bag, packaging)
- [ ] Process return with seal bag returned (+1 MAD recovery)
- [ ] Process return with broken product (→ broken stock)
- [ ] Calculate profit correctly for delivered orders
- [ ] Calculate profit correctly for returned orders
- [ ] Auto-create withdrawal when adding stock
- [ ] Calculate team costs (both fixed + per order types)
- [ ] Track Facebook ads rate changes over time
- [ ] Calculate clean profit and capital correctly

## ⚠️ Common Pitfalls

1. **Don't recalculate revenue** - Use total_amount from PDF as-is
2. **Don't forget UTF-8 encoding** - Arabic names must work
3. **Don't hardcode packaging fees** - Depends on city (is_casa) AND user selection
4. **Don't ignore seal bag recovery** - It's +1 MAD if returned
5. **Don't count broken stock as sellable** - Only good stock is sellable
6. **Don't forget to reduce stock** - When creating orders
7. **Don't forget to restore stock** - When processing returns (unless broken)

## 📝 Git Repo Structure

```
/
├── README.md
├── DATABASE.sql (schema + initial data)
├── config/
│   ├── database.php
│   └── constants.php
├── api/
│   ├── upload_pickup.php (PDF parser)
│   ├── upload_return.php (PDF parser)
│   ├── orders/
│   ├── products/
│   ├── team/
│   └── reports/
├── pages/
│   ├── dashboard.php
│   ├── orders.php
│   ├── products.php
│   ├── stock.php
│   ├── team.php
│   └── reports.php
├── assets/
│   ├── css/
│   ├── js/
│   └── uploads/
├── vendor/ (Composer)
└── tests/
    ├── test_parse_pickup.php
    └── test_parse_return.php
```

## 🎨 UI/UX Guidelines

- Use React demo (stocky-final.jsx) as reference
- All modals should be full-screen
- Show loading indicators during PDF parsing
- Clear error messages with actionable advice
- Confirm before destructive actions
- Auto-save to prevent data loss

## 🔗 Useful References

- React Demo: `stocky-final.jsx` (2491 lines)
- Cities Database: `morocco_cities.js`
- Sample PDFs: `pickup_parcels_*.pdf`, `return.pdf`
- Previous Transcripts: `/mnt/transcripts/`

## 💡 Pro Tips

1. **Start with PDF parsing** - It's the foundation
2. **Test with real PDFs** - Don't use mock data
3. **Build incrementally** - Database → Parser → CRUD → Reports
4. **Log everything** - Especially PDF parsing issues
5. **Handle edge cases** - Empty fields, missing cities, UTF-8 chars
6. **Use transactions** - For multi-table operations (create orders, returns)
7. **Index properly** - caleo_id, order_date, status are frequently queried

## 🆘 When Stuck

1. Check PROJECT_BRIEF.md for business context
2. Check TECHNICAL_SPECS.md for formulas
3. Check stocky-final.jsx for UI/logic reference
4. Test with actual PDFs provided
5. Review transcripts in `/mnt/transcripts/`

## ✅ Ready?

You have everything you need:
- ✅ Complete business requirements
- ✅ Technical specifications
- ✅ Database schema
- ✅ Calculation formulas
- ✅ Real sample PDFs
- ✅ UI/UX reference (React demo)
- ✅ Cities database

**Start with DATABASE.sql → Test PDF parsing → Build incrementally → Deploy!**

Good luck! 🚀
