# 📦 Stocky Development Package

Complete briefing package for building the Stocky inventory management system.

## 📄 What's Inside

| File | Size | Description |
|------|------|-------------|
| **QUICK_START.md** | - | Start here! Quick reference guide |
| **PROJECT_BRIEF.md** | 14KB | Complete project overview & requirements |
| **TECHNICAL_SPECS.md** | 19KB | Formulas, database, APIs, security |
| **morocco_cities.js** | 7KB | 100+ cities with delivery/return fees |
| **stocky-final.jsx** | 113KB | Complete React demo (2491 lines) |
| **pickup_parcels_*.pdf** | 905KB | Real Caleo PDF with 7 orders to parse |
| **return.pdf** | 254KB | Real Caleo return PDF |

**Total:** 1.3 MB of comprehensive documentation and samples

## 🎯 Quick Navigation

### 👉 First Time? Start Here:
1. **QUICK_START.md** - Your roadmap (5 min read)
2. **PROJECT_BRIEF.md** - Full context (15 min read)
3. **TECHNICAL_SPECS.md** - Deep dive (20 min read)

### 🔍 Looking for Something Specific?

**Business Model & Requirements** → PROJECT_BRIEF.md  
**Calculation Formulas** → TECHNICAL_SPECS.md (Section: CALCULATION FORMULAS)  
**Database Schema** → TECHNICAL_SPECS.md (Section: DATABASE QUERIES) or PROJECT_BRIEF.md (Section: DATABASE SCHEMA)  
**PDF Parsing** → TECHNICAL_SPECS.md (Section: PDF PARSING IMPLEMENTATION)  
**API Endpoints** → TECHNICAL_SPECS.md (Section: API ENDPOINTS)  
**UI/UX Reference** → stocky-final.jsx  
**City Fees** → morocco_cities.js  
**Real Data Samples** → pickup_parcels_*.pdf, return.pdf  

## 🚀 Project Overview

**What:** E-commerce inventory & order management system  
**For:** Headz (Moroccan cap business using Caleo delivery)  
**Tech:** PHP + MySQL (cPanel hosting)  
**Status:** Design complete, ready for implementation  

### Key Features
- ✅ Upload Caleo PDFs → Auto-extract orders
- ✅ Assign products → Calculate profit
- ✅ Process returns → Restore stock
- ✅ Track team costs, expenses, ads
- ✅ Reports & analytics
- ✅ Broken stock management
- ✅ Capital tracking

## 🎓 What You'll Build

### Phase 1: Foundation
- Database schema (9 tables)
- PDF parser (Pickup Parcels + Returns)
- Cities database (100+ Moroccan cities)

### Phase 2: Core
- Products & variants management
- Order creation & tracking
- Stock management
- Upload & parse Caleo PDFs

### Phase 3: Financial
- Team members & salaries
- Fixed expenses tracking
- Facebook ads tracking
- Withdrawals & cash flow

### Phase 4: Analytics
- Profit calculations
- Reports dashboard
- Performance metrics
- Capital tracking

## 📊 Key Numbers

- **~100 cities** in Morocco with fees
- **7 orders** in sample Pickup PDF
- **9 database tables** needed
- **3 expense types** per order (sticker, seal bag, packaging)
- **2 packaging fees** (2 MAD for Casa, 3 MAD others)
- **1 USD = 10 MAD** (Facebook ads)

## 🔥 Critical Requirements

1. **Never recalculate revenue** - Caleo PDF amount is sacred
2. **Parse real PDFs** - Must extract CMD-ID, name, phone, city, address, total
3. **Handle UTF-8** - Arabic/French names must work
4. **Seal bags returnable** - +1 MAD recovery if returned
5. **Broken stock tracking** - Returnable vs non-returnable to supplier
6. **Auto withdrawals** - Stock purchases reduce cash automatically

## 🧪 Test with Real Data

Sample PDFs provided are real Caleo exports:
- **pickup_parcels_BRM-8330688-CP-903F44.pdf** - 7 actual orders
- **return.pdf** - Actual return data

Parse these successfully = You're on the right track!

## 📝 Development Workflow

```
1. Read QUICK_START.md (5 min)
2. Read PROJECT_BRIEF.md (15 min)
3. Skim TECHNICAL_SPECS.md (note the formulas)
4. Set up database schema
5. Test PDF parsing with real PDFs
6. Build features incrementally
7. Reference stocky-final.jsx for UI/logic
8. Test calculations match TECHNICAL_SPECS.md
9. Deploy to cPanel
```

## 💡 Pro Tips

- **React demo is your friend** - It has all the business logic
- **Test PDFs early** - PDF parsing is the foundation
- **Use transactions** - Multi-table operations need rollback capability
- **Log everything** - Especially PDF parsing and city matching
- **Index key columns** - caleo_id, status, order_date
- **Handle edge cases** - Missing data, UTF-8, city variations

## 🆘 Support

All questions answered in the docs:
- Business logic → PROJECT_BRIEF.md
- Technical details → TECHNICAL_SPECS.md
- UI/UX → stocky-final.jsx
- Quick ref → QUICK_START.md

## ✅ Checklist

Before you start coding:
- [ ] Read QUICK_START.md
- [ ] Read PROJECT_BRIEF.md
- [ ] Understand the profit calculation formula
- [ ] Know the difference between delivered vs returned order profit
- [ ] Understand seal bag recovery mechanism
- [ ] Know how broken stock affects capital

## 🎯 Success Criteria

Your implementation is successful when:
1. ✅ Parses 7 orders from pickup_parcels PDF correctly
2. ✅ Creates orders with custom expenses
3. ✅ Processes returns (both scenarios: seal bag returned, product broken)
4. ✅ Calculates profit matching TECHNICAL_SPECS.md formulas
5. ✅ Auto-creates withdrawals for stock purchases
6. ✅ Tracks team costs (per order + monthly)
7. ✅ Reports show accurate capital calculation

---

**Ready to build?** Start with QUICK_START.md → Happy coding! 🚀
