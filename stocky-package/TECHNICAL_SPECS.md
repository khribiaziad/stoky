# STOCKY - Technical Specifications

## CALCULATION FORMULAS

### 1. Order Profit Calculation

```php
function calculateOrderProfit($order) {
    // Revenue (SACRED - from Pickup Parcels PDF)
    $revenue = $order['total_amount'];
    
    // Product Costs
    $productCost = 0;
    foreach ($order['items'] as $item) {
        $productCost += $item['unit_cost'] * $item['quantity'];
    }
    
    // Get city fees
    $city = getCityByName($order['city']);
    
    // Order-level expenses
    $expenses = getOrderExpenses($order['id']);
    $sticker = $expenses['sticker'];           // 1 or 0
    $sealBag = $expenses['seal_bag'];          // 1 or 0
    $packaging = $expenses['packaging'];        // Variable amount
    $deliveryFee = $expenses['delivery_fee'];  // From city
    
    // If order is delivered
    if ($order['status'] == 'delivered') {
        $totalCosts = $productCost + $deliveryFee + $sticker + $sealBag + $packaging;
        $profit = $revenue - $totalCosts;
        return $profit;
    }
    
    // If order is cancelled (returned)
    if ($order['status'] == 'cancelled') {
        $returnFee = $expenses['return_fee'];          // From city
        $sealBagReturned = $expenses['seal_bag_returned']; // true/false
        $productBroken = $expenses['product_broken'];     // true/false
        
        // Costs for return
        $returnCosts = $returnFee;
        
        // Sticker and packaging always lost
        $returnCosts += $sticker + $packaging;
        
        // Seal bag: if returned, we get 1 MAD back; if not, it's lost
        if ($sealBagReturned) {
            $returnCosts += $sealBag - 1; // Paid 1, got 1 back = 0 net cost
        } else {
            $returnCosts += $sealBag;     // Lost
        }
        
        // Product: if broken, we lose the product cost; if OK, stock is restored
        if ($productBroken) {
            $returnCosts += $productCost; // Total loss
        }
        // If not broken, productCost = 0 (stock restored to inventory)
        
        $profit = 0 - $returnCosts; // Always negative for returns
        return $profit;
    }
    
    // Pending orders don't count toward profit
    return 0;
}
```

### 2. Clean Profit Calculation

```php
function calculateCleanProfit($dateRange) {
    // Gross Profit from delivered orders
    $grossProfit = 0;
    $orders = getDeliveredOrders($dateRange);
    foreach ($orders as $order) {
        $grossProfit += calculateOrderProfit($order);
    }
    
    // Subtract expenses
    $expenses = 0;
    
    // Team costs
    $teamCosts = calculateTeamCosts($dateRange);
    $expenses += $teamCosts;
    
    // Fixed expenses
    $fixedExpenses = calculateFixedExpenses($dateRange);
    $expenses += $fixedExpenses;
    
    // Facebook ads
    $adsCosts = calculateFacebookAdsCosts($dateRange);
    $expenses += $adsCosts;
    
    // Manual withdrawals
    $withdrawals = getManualWithdrawals($dateRange);
    foreach ($withdrawals as $w) {
        $expenses += $w['amount'];
    }
    
    // Clean profit
    $cleanProfit = $grossProfit - $expenses;
    
    return $cleanProfit;
}
```

### 3. Team Costs Calculation

```php
function calculateTeamCosts($dateRange) {
    $totalCosts = 0;
    $teamMembers = getActiveTeamMembers($dateRange);
    $deliveredOrders = countDeliveredOrders($dateRange);
    
    foreach ($teamMembers as $member) {
        $cost = 0;
        
        // Fixed monthly salary
        if ($member['fixed_monthly'] > 0) {
            $monthsInRange = calculateMonthsInRange($dateRange, $member['start_date'], $member['end_date']);
            $cost += $member['fixed_monthly'] * $monthsInRange;
        }
        
        // Per order rate
        if ($member['per_order_rate'] > 0) {
            $cost += $member['per_order_rate'] * $deliveredOrders;
        }
        
        $totalCosts += $cost;
    }
    
    return $totalCosts;
}
```

### 4. Fixed Expenses Calculation

```php
function calculateFixedExpenses($dateRange) {
    $totalExpenses = 0;
    $expenses = getActiveFixedExpenses($dateRange);
    $deliveredOrders = countDeliveredOrders($dateRange);
    
    foreach ($expenses as $expense) {
        $cost = 0;
        
        if ($expense['type'] == 'monthly') {
            $monthsInRange = calculateMonthsInRange($dateRange, $expense['start_date']);
            $cost += $expense['amount'] * $monthsInRange;
        }
        
        if ($expense['type'] == 'per_order') {
            $cost += $expense['amount'] * $deliveredOrders;
        }
        
        $totalExpenses += $cost;
    }
    
    return $totalExpenses;
}
```

### 5. Facebook Ads Costs

```php
function calculateFacebookAdsCosts($dateRange) {
    $totalCost = 0;
    $USD_TO_MAD = 10;
    
    // Get all rate periods that overlap with date range
    $adsPeriods = getAdsPeriods($dateRange['start'], $dateRange['end']);
    
    foreach ($adsPeriods as $period) {
        $daysInPeriod = calculateDaysInPeriod(
            $period['start_date'], 
            $period['end_date'],
            $dateRange['start'],
            $dateRange['end']
        );
        
        $costUSD = $period['daily_rate_usd'] * $daysInPeriod;
        $costMAD = $costUSD * $USD_TO_MAD;
        $totalCost += $costMAD;
    }
    
    return $totalCost;
}
```

### 6. Cash Balance Calculation

```php
function calculateCashBalance() {
    // Get base amount (user-entered initial capital)
    $baseAmount = getBaseAmount();
    
    // Add all clean profit from delivered orders
    $allTimeCleanProfit = calculateCleanProfit(['start' => null, 'end' => null]);
    
    // Subtract stock purchases (automatic withdrawals)
    $stockPurchases = getWithdrawals(['type' => 'stock_purchase']);
    $stockPurchaseTotal = array_sum(array_column($stockPurchases, 'amount'));
    
    // Subtract manual withdrawals
    $manualWithdrawals = getWithdrawals(['type' => 'manual']);
    $manualWithdrawalTotal = array_sum(array_column($manualWithdrawals, 'amount'));
    
    $cashBalance = $baseAmount + $allTimeCleanProfit - $stockPurchaseTotal - $manualWithdrawalTotal;
    
    return $cashBalance;
}
```

### 7. Stock Value Calculation

```php
function calculateStockValue() {
    $totalValue = 0;
    
    // Good stock
    $variants = getAllVariants();
    foreach ($variants as $variant) {
        $totalValue += $variant['stock'] * $variant['buying_price'];
    }
    
    // Returnable broken stock (can get refund from supplier)
    $brokenStock = getBrokenStock(['returnable_to_supplier' => true]);
    foreach ($brokenStock as $broken) {
        $variant = getVariant($broken['variant_id']);
        $totalValue += $broken['quantity'] * $variant['buying_price'];
    }
    
    // Non-returnable broken stock = 0 (lost value)
    
    return $totalValue;
}
```

### 8. Total Capital Calculation

```php
function calculateTotalCapital() {
    $cashBalance = calculateCashBalance();
    $stockValue = calculateStockValue();
    $totalCapital = $cashBalance + $stockValue;
    return $totalCapital;
}
```

---

## PDF PARSING IMPLEMENTATION

### Pickup Parcels PDF Parser

```php
require_once 'vendor/autoload.php';
use Smalot\PdfParser\Parser;

function parsePickupParcelsPDF($filepath) {
    $parser = new Parser();
    $pdf = $parser->parseFile($filepath);
    $text = $pdf->getText();
    
    $orders = [];
    
    // Extract all CMD-IDs
    preg_match_all('/CMD-\d+-ST-\d+/', $text, $cmdMatches);
    $cmdIds = $cmdMatches[0];
    
    foreach ($cmdIds as $cmdId) {
        // Find section for this CMD-ID
        $orderStart = strpos($text, $cmdId);
        $nextCmdPos = strpos($text, 'CMD-', $orderStart + strlen($cmdId));
        
        if ($nextCmdPos !== false) {
            $orderText = substr($text, $orderStart, $nextCmdPos - $orderStart);
        } else {
            $orderText = substr($text, $orderStart, 1000);
        }
        
        // Extract customer name
        preg_match('/Destinataire[:\s]+([^\n\r]+)/i', $orderText, $nameMatch);
        $customerName = isset($nameMatch[1]) ? trim($nameMatch[1]) : '';
        
        // Extract phone
        preg_match('/téléphone[:\s]*(\+\d+)/i', $orderText, $phoneMatch);
        $customerPhone = isset($phoneMatch[1]) ? trim($phoneMatch[1]) : '';
        
        // Extract city
        preg_match('/Ville[:\s]+([^\n\r]+)/i', $orderText, $cityMatch);
        $city = isset($cityMatch[1]) ? trim($cityMatch[1]) : '';
        
        // Normalize city name
        $city = ucfirst(strtolower($city));
        if (strtolower($city) == 'tangier') $city = 'Tanger';
        
        // Extract address
        preg_match('/Adresse[:\s]+([^\n\r]+)/i', $orderText, $addressMatch);
        $customerAddress = isset($addressMatch[1]) ? trim($addressMatch[1]) : '';
        
        // Extract total
        preg_match('/Total[:\s]*(\d+)\s*(?:Dhs|MAD|dhs)/i', $orderText, $totalMatch);
        $totalAmount = isset($totalMatch[1]) ? intval($totalMatch[1]) : 0;
        
        // Extract date (from document header)
        preg_match('/Date[:\s]+(\d+\/\d+\/\d+)/i', $text, $dateMatch);
        $orderDate = date('Y-m-d'); // Default to today
        
        if (isset($dateMatch[1])) {
            $dateParts = explode('/', $dateMatch[1]);
            if (count($dateParts) == 3) {
                $month = str_pad($dateParts[0], 2, '0', STR_PAD_LEFT);
                $day = str_pad($dateParts[1], 2, '0', STR_PAD_LEFT);
                $year = $dateParts[2];
                $orderDate = "$year-$month-$day";
            }
        }
        
        // Only add if we have minimum required data
        if ($customerName && $customerPhone && $totalAmount > 0) {
            $orders[] = [
                'caleo_id' => $cmdId,
                'customer_name' => $customerName,
                'customer_phone' => $customerPhone,
                'customer_address' => $customerAddress,
                'city' => $city,
                'total_amount' => $totalAmount,
                'date' => $orderDate
            ];
        }
    }
    
    return $orders;
}
```

### Return PDF Parser

```php
function parseReturnPDF($filepath) {
    $parser = new Parser();
    $pdf = $parser->parseFile($filepath);
    $text = $pdf->getText();
    
    // Extract CMD-IDs from table on page 2
    preg_match_all('/CMD-\d+-ST-\d+/', $text, $matches);
    $cmdIds = array_unique($matches[0]);
    
    return $cmdIds;
}
```

---

## DATABASE QUERIES

### Get Orders with Full Details

```sql
SELECT 
    o.*,
    oe.sticker,
    oe.seal_bag,
    oe.packaging,
    oe.delivery_fee,
    oe.return_fee,
    oe.seal_bag_returned,
    oe.product_broken,
    c.delivery_fee as city_delivery_fee,
    c.return_fee as city_return_fee,
    c.is_casa
FROM orders o
LEFT JOIN order_expenses oe ON o.id = oe.order_id
LEFT JOIN cities c ON o.city = c.name
WHERE o.status = 'delivered'
ORDER BY o.order_date DESC
```

### Get Order Items

```sql
SELECT 
    oi.*,
    v.buying_price,
    v.selling_price
FROM order_items oi
LEFT JOIN variants v ON oi.variant_id = v.id
WHERE oi.order_id = ?
```

### Get Stock with Product Info

```sql
SELECT 
    v.id as variant_id,
    v.size,
    v.color,
    v.buying_price,
    v.selling_price,
    v.stock,
    v.low_stock_threshold,
    p.name as product_name,
    p.category
FROM variants v
JOIN products p ON v.product_id = p.id
ORDER BY p.name, v.size, v.color
```

### Get Broken Stock

```sql
SELECT 
    bs.*,
    v.size,
    v.color,
    v.buying_price,
    p.name as product_name
FROM broken_stock bs
JOIN variants v ON bs.variant_id = v.id
JOIN products p ON v.product_id = p.id
WHERE bs.returnable_to_supplier = ?
ORDER BY bs.date DESC
```

### Get Team Costs for Period

```sql
SELECT 
    tm.*,
    CASE
        WHEN tm.payment_type = 'monthly' THEN tm.fixed_monthly * :months
        WHEN tm.payment_type = 'per_order' THEN tm.per_order_rate * :delivered_orders
        WHEN tm.payment_type = 'both' THEN 
            (tm.fixed_monthly * :months) + (tm.per_order_rate * :delivered_orders)
    END as total_cost
FROM team_members tm
WHERE tm.is_active = 1
AND (tm.start_date <= :end_date)
AND (tm.end_date IS NULL OR tm.end_date >= :start_date)
```

---

## API ENDPOINTS

### POST /api/upload_pickup.php
**Input:** Multipart form with PDF file  
**Process:**
1. Validate file (PDF only, max 10MB)
2. Parse PDF using parsePickupParcelsPDF()
3. Return JSON array of extracted orders

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "caleo_id": "CMD-3446476-ST-265307",
      "customer_name": "rachid",
      "customer_phone": "+212772446817",
      "customer_address": "yaakoub elmansour",
      "city": "Rabat",
      "total_amount": 99,
      "date": "2026-02-18"
    }
  ]
}
```

### POST /api/orders/create_bulk.php
**Input:**
```json
{
  "orders": [
    {
      "caleo_id": "CMD-3446476-ST-265307",
      "customer_name": "rachid",
      "customer_phone": "+212772446817",
      "customer_address": "yaakoub elmansour",
      "city": "Rabat",
      "total_amount": 99,
      "date": "2026-02-18",
      "items": [
        {"product_id": 1, "variant_id": 1, "quantity": 1}
      ],
      "expenses": {
        "sticker": 1,
        "seal_bag": 1,
        "packaging": 1
      }
    }
  ]
}
```

**Process:**
1. Begin transaction
2. For each order:
   - Insert into orders table
   - Get city fees and insert into order_expenses
   - Insert items into order_items
   - Reduce stock for each item
3. Commit transaction

### POST /api/upload_return.php
**Input:** Multipart form with PDF file  
**Process:**
1. Parse PDF using parseReturnPDF()
2. Match CMD-IDs against orders table
3. Return matched orders with details

**Response:**
```json
{
  "success": true,
  "matched_orders": [
    {
      "id": 123,
      "caleo_id": "CMD-3567863-ST-265307",
      "customer_name": "rachid",
      "city": "Rabat",
      "total_amount": 99,
      "items": [...]
    }
  ],
  "unmatched_cmd_ids": []
}
```

### POST /api/orders/process_returns.php
**Input:**
```json
{
  "returns": [
    {
      "order_id": 123,
      "seal_bag_returned": true,
      "product_broken": false
    }
  ]
}
```

**Process:**
1. Begin transaction
2. For each return:
   - Update order status = 'cancelled'
   - Update order_expenses (seal_bag_returned, product_broken)
   - If product_broken:
     - Add to broken_stock table (returnable=false)
   - Else:
     - Restore stock to variants table
3. Commit transaction

---

## ERROR HANDLING

### PDF Parsing Errors
```php
try {
    $orders = parsePickupParcelsPDF($filepath);
    if (empty($orders)) {
        throw new Exception("No orders found in PDF. Please check file format.");
    }
} catch (Exception $e) {
    return json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
```

### City Not Found
```php
$city = getCityByName($cityName);
if (!$city) {
    // Log for review
    error_log("City not found: $cityName for order $caleoId");
    
    // Use default fees
    $city = [
        'delivery_fee' => 35,
        'return_fee' => 7,
        'is_casa' => false
    ];
}
```

### Insufficient Stock
```php
foreach ($items as $item) {
    $variant = getVariant($item['variant_id']);
    if ($variant['stock'] < $item['quantity']) {
        throw new Exception(
            "Insufficient stock for {$variant['product_name']} " .
            "{$variant['size']} {$variant['color']}. " .
            "Available: {$variant['stock']}, Requested: {$item['quantity']}"
        );
    }
}
```

---

## SECURITY CONSIDERATIONS

### File Uploads
```php
// Validate file type
$allowedTypes = ['application/pdf'];
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $_FILES['pdf']['tmp_name']);

if (!in_array($mimeType, $allowedTypes)) {
    die('Invalid file type. Only PDF allowed.');
}

// Validate file size (max 10MB)
if ($_FILES['pdf']['size'] > 10 * 1024 * 1024) {
    die('File too large. Maximum 10MB.');
}

// Generate unique filename
$filename = uniqid('pickup_') . '.pdf';
$destination = 'assets/uploads/' . $filename;

move_uploaded_file($_FILES['pdf']['tmp_name'], $destination);
```

### SQL Injection Prevention
```php
// Use prepared statements
$stmt = $pdo->prepare(
    "INSERT INTO orders (caleo_id, customer_name, city, total_amount) 
     VALUES (?, ?, ?, ?)"
);
$stmt->execute([$caleoId, $customerName, $city, $totalAmount]);
```

### XSS Prevention
```php
// Escape output
echo htmlspecialchars($customerName, ENT_QUOTES, 'UTF-8');
```

---

## PERFORMANCE OPTIMIZATION

### Batch Inserts
```php
// Instead of inserting orders one by one, use batch insert
$values = [];
$params = [];
foreach ($orders as $order) {
    $values[] = "(?, ?, ?, ?, ?, ?, ?)";
    $params = array_merge($params, [
        $order['caleo_id'],
        $order['customer_name'],
        $order['customer_phone'],
        $order['customer_address'],
        $order['city'],
        $order['total_amount'],
        $order['date']
    ]);
}

$sql = "INSERT INTO orders (caleo_id, customer_name, customer_phone, 
        customer_address, city, total_amount, order_date) 
        VALUES " . implode(', ', $values);

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
```

### Index Key Columns
```sql
CREATE INDEX idx_orders_caleo_id ON orders(caleo_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_variants_product_id ON variants(product_id);
```

---

## TESTING CHECKLIST

- [ ] Parse Pickup Parcels PDF with 7 orders
- [ ] Create orders from parsed data
- [ ] Verify stock reduction
- [ ] Parse Return PDF
- [ ] Match CMD-IDs against existing orders
- [ ] Process return with seal bag returned
- [ ] Process return with broken product
- [ ] Verify stock restoration
- [ ] Verify broken stock creation
- [ ] Calculate order profit correctly
- [ ] Calculate clean profit correctly
- [ ] Add team member with per-order rate
- [ ] Add team member with monthly fixed
- [ ] Add fixed expense (monthly)
- [ ] Add fixed expense (per order)
- [ ] Track Facebook ads rate change
- [ ] Add stock arrival (verify auto withdrawal)
- [ ] Calculate cash balance correctly
- [ ] Calculate stock value correctly
- [ ] Calculate total capital correctly
- [ ] Test with UTF-8 characters (Arabic names)
- [ ] Test with various city name formats
- [ ] Test date format conversion
- [ ] Test error handling (invalid PDF)
- [ ] Test error handling (insufficient stock)

---

## NOTES

This is a production system handling real money calculations. Test thoroughly before deployment!
