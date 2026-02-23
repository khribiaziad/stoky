import React, { useState, useEffect } from 'react';
import { Package, ShoppingCart, TrendingUp, AlertTriangle, Plus, Eye, Edit, Trash2, Upload, Download, Calendar, DollarSign, Box, BarChart3, X, Save, Settings, Users, FileText, Database, Search, Check } from 'lucide-react';

export default function StockyFinal() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [showModal, setShowModal] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Ramassage upload workflow
  const [ramassageOrders, setRamassageOrders] = useState([]);
  const [returnOrders, setReturnOrders] = useState([]);
  const [orderItems, setOrderItems] = useState({}); // Track items for each order by index
  
  // Search states
  const [searchOrders, setSearchOrders] = useState('');
  const [searchProducts, setSearchProducts] = useState('');
  const [searchStock, setSearchStock] = useState('');

  // Cities data
  const cities = [
    { name: 'Casablanca', delivery_fee: 20, return_fee: 0, is_casa: true },
    { name: 'Sbata', delivery_fee: 20, return_fee: 0, is_casa: true },
    { name: 'Tit Mellil', delivery_fee: 35, return_fee: 0, is_casa: true },
    { name: 'Rabat', delivery_fee: 35, return_fee: 5, is_casa: false },
    { name: 'Fes', delivery_fee: 35, return_fee: 5, is_casa: false },
    { name: 'Marrakech', delivery_fee: 35, return_fee: 5, is_casa: false },
    { name: 'Agadir', delivery_fee: 35, return_fee: 5, is_casa: false },
    { name: 'Tanger', delivery_fee: 35, return_fee: 5, is_casa: false },
    { name: 'Meknes', delivery_fee: 35, return_fee: 5, is_casa: false },
    { name: 'Kenitra', delivery_fee: 35, return_fee: 5, is_casa: false },
  ];

  // New product/variant forms
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: 'Caps',
    has_sizes: false,
    has_colors: false,
  });

  const [newVariant, setNewVariant] = useState({
    size: '',
    color: '',
    buying_price: 0,
    selling_price: 0,
    stock_quantity: 0,
  });

  const [stockArrival, setStockArrival] = useState({
    product_id: '',
    variant_id: '',
    quantity: 0,
    additional_fees: 0,
    description: '',
  });

  // Initialize with sample data
  useEffect(() => {
    const sampleProducts = [
      { id: 1, name: 'NY Cap', category: 'Caps', has_sizes: true, has_colors: true, variants: [
        { id: 1, size: 'M', color: 'Black', buying_price: 60, selling_price: 120, stock: 50, low_stock_threshold: 10 },
        { id: 2, size: 'L', color: 'Blue', buying_price: 60, selling_price: 120, stock: 30, low_stock_threshold: 10 },
        { id: 3, size: 'M', color: 'Red', buying_price: 60, selling_price: 120, stock: 8, low_stock_threshold: 10 },
      ]},
      { id: 2, name: 'Polo Cap', category: 'Caps', has_sizes: true, has_colors: true, variants: [
        { id: 4, size: 'M', color: 'White', buying_price: 65, selling_price: 130, stock: 25, low_stock_threshold: 10 },
        { id: 5, size: 'L', color: 'Navy', buying_price: 65, selling_price: 130, stock: 40, low_stock_threshold: 10 },
      ]},
      { id: 3, name: 'Tommy Cap', category: 'Caps', has_sizes: true, has_colors: true, variants: [
        { id: 6, size: 'M', color: 'Black', buying_price: 70, selling_price: 140, stock: 15, low_stock_threshold: 10 },
        { id: 7, size: 'L', color: 'White', buying_price: 70, selling_price: 140, stock: 20, low_stock_threshold: 10 },
      ]},
    ];

    setProducts(sampleProducts);
    setOrders([]);
    setCampaigns([
      { id: 1, name: 'General Ads - All Products', daily_budget_usd: 5, start_date: '2026-02-01', end_date: null, is_active: true },
    ]);
  }, []);

  // Handle Ramassage PDF upload
  const handleRamassageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Simulate parsing the PDF (in real system, you'd use a PDF parser)
    // Extract orders from your sample PDF structure
    const extractedOrders = [
      {
        caleo_id: 'CMD-66789-ST-265307',
        customer_name: 'Ahmed Benali',
        customer_phone: '+212620486319',
        customer_address: '82 rue 08 derb lahjar',
        city: 'Rabat',
        total_amount: 123,
        date: '2026-02-16',
      },
      {
        caleo_id: 'CMD-8788244-ST-265307',
        customer_name: 'Fatima El Amrani',
        customer_phone: '+212623071731',
        customer_address: '15 boulevard Zerktouni',
        city: 'Casablanca',
        total_amount: 123,
        date: '2026-02-16',
      },
      {
        caleo_id: 'CMD-3571829-ST-265307',
        customer_name: 'Youssef Idrissi',
        customer_phone: '+212651386509',
        customer_address: '28 avenue Hassan II',
        city: 'Fes',
        total_amount: 123,
        date: '2026-02-16',
      },
      {
        caleo_id: 'CMD-4982156-ST-265307',
        customer_name: 'Zineb Alaoui',
        customer_phone: '+212667891234',
        customer_address: '45 rue Mohammed V',
        city: 'Marrakech',
        total_amount: 123,
        date: '2026-02-16',
      },
      {
        caleo_id: 'CMD-5123478-ST-265307',
        customer_name: 'Omar Tazi',
        customer_phone: '+212698765432',
        customer_address: '12 avenue Hassan II',
        city: 'Tanger',
        total_amount: 123,
        date: '2026-02-16',
      },
    ];

    setRamassageOrders(extractedOrders);
    
    // Initialize empty items array for each order
    const initialItems = {};
    extractedOrders.forEach((_, index) => {
      initialItems[index] = [];
    });
    setOrderItems(initialItems);
    
    setShowModal('ramassage_products');
  };

  // Handle Returns PDF upload
  const handleReturnsUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Find orders from existing orders that match returned order IDs
    // In real system, parse PDF and extract CMD-IDs
    const returnedOrderIds = ['CMD-66789-ST-265307', 'CMD-3571829-ST-265307'];
    
    const foundReturns = orders.filter(o => returnedOrderIds.includes(o.caleo_id));
    
    if (foundReturns.length === 0) {
      alert('⚠️ No matching orders found in the return PDF. Make sure these orders exist in Stocky first.');
      return;
    }

    setReturnOrders(foundReturns);
    setShowModal('confirm_returns');
  };

  // Save ramassage orders after products selected
  const saveRamassageOrders = () => {
    // Validate all orders have at least one item
    const incomplete = ramassageOrders.find((_, index) => !orderItems[index] || orderItems[index].length === 0);
    if (incomplete) {
      alert('⚠️ Please add at least ONE product to ALL orders before saving!');
      return;
    }

    // Create orders and reduce stock
    const newOrders = ramassageOrders.map((ramOrder, index) => {
      const items = orderItems[index];
      const city = cities.find(c => c.name.toLowerCase() === ramOrder.city.toLowerCase());
      
      // Calculate fees
      const packagingFee = city?.is_casa ? 2 : 3;
      const deliveryFee = city?.delivery_fee || 35;

      // Map items to proper format
      const mappedItems = items.map(item => {
        const product = products.find(p => p.id === parseInt(item.product_id));
        const variant = product.variants.find(v => v.id === parseInt(item.variant_id));
        
        return {
          product: product.name,
          size: variant.size,
          color: variant.color,
          quantity: parseInt(item.quantity),
          unit_price: variant.selling_price,
          unit_cost: variant.buying_price
        };
      });

      return {
        id: orders.length + index + 1,
        stocky_id: `STK-${ramOrder.date.replace(/-/g, '')}-${String(orders.length + index + 1).padStart(4, '0')}`,
        caleo_id: ramOrder.caleo_id,
        customer_name: ramOrder.customer_name,
        customer_phone: ramOrder.customer_phone,
        customer_address: ramOrder.customer_address,
        city: ramOrder.city,
        delivery_fee: deliveryFee,
        packaging_fee: packagingFee,
        total_amount: ramOrder.total_amount,
        status: 'pending',
        order_date: ramOrder.date,
        seal_bag_returned: false,
        items: mappedItems
      };
    });

    // Reduce stock for all items
    const updatedProducts = products.map(product => ({
      ...product,
      variants: product.variants.map(variant => {
        let totalToReduce = 0;
        
        // Sum up quantities for this variant across all orders
        Object.values(orderItems).forEach(items => {
          items.forEach(item => {
            if (parseInt(item.variant_id) === variant.id) {
              totalToReduce += parseInt(item.quantity);
            }
          });
        });
        
        return {
          ...variant,
          stock: variant.stock - totalToReduce
        };
      })
    }));

    setOrders([...orders, ...newOrders]);
    setProducts(updatedProducts);
    setRamassageOrders([]);
    setOrderItems({});
    setShowModal(null);
    
    alert(`✅ Successfully imported ${newOrders.length} orders and updated stock!`);
  };

  // Confirm returns
  const confirmReturns = () => {
    // Update order status to cancelled and add stock back
    const updatedOrders = orders.map(order => {
      const isReturned = returnOrders.find(r => r.id === order.id);
      if (isReturned) {
        return { ...order, status: 'cancelled' };
      }
      return order;
    });

    // Add stock back
    const updatedProducts = products.map(product => ({
      ...product,
      variants: product.variants.map(variant => {
        let stockToAdd = 0;
        returnOrders.forEach(returnOrder => {
          returnOrder.items.forEach(item => {
            const matchingProduct = products.find(p => p.name === item.product);
            if (matchingProduct) {
              const matchingVariant = matchingProduct.variants.find(
                v => v.size === item.size && v.color === item.color
              );
              if (matchingVariant && matchingVariant.id === variant.id) {
                stockToAdd += item.quantity;
              }
            }
          });
        });
        return {
          ...variant,
          stock: variant.stock + stockToAdd
        };
      })
    }));

    setOrders(updatedOrders);
    setProducts(updatedProducts);
    setReturnOrders([]);
    setShowModal(null);
    
    alert(`✅ Successfully processed ${returnOrders.length} returns and restored stock!`);
  };

  // Add item to ramassage order
  const addItemToRamassageOrder = (orderIndex, product_id, variant_id, quantity) => {
    if (!product_id || !variant_id || !quantity) {
      alert('Please select product, variant, and quantity!');
      return;
    }

    const newItem = {
      product_id: String(product_id),
      variant_id: String(variant_id),
      quantity: parseInt(quantity)
    };

    setOrderItems(prevItems => {
      const currentItems = prevItems[orderIndex] || [];
      return {
        ...prevItems,
        [orderIndex]: [...currentItems, newItem]
      };
    });
    
    return true; // Return success
  };

  // Remove item from ramassage order
  const removeItemFromRamassageOrder = (orderIndex, itemIndex) => {
    setOrderItems(prevItems => {
      const updatedItems = (prevItems[orderIndex] || []).filter((_, i) => i !== itemIndex);
      return {
        ...prevItems,
        [orderIndex]: updatedItems
      };
    });
  };

  // Remove order from ramassage import
  const removeRamassageOrder = (orderIndex) => {
    if (confirm('Remove this order from import?')) {
      const updatedOrders = ramassageOrders.filter((_, i) => i !== orderIndex);
      setRamassageOrders(updatedOrders);
      
      // Remove items for this order and reindex
      const newOrderItems = {};
      Object.keys(orderItems).forEach(key => {
        const index = parseInt(key);
        if (index < orderIndex) {
          newOrderItems[index] = orderItems[key];
        } else if (index > orderIndex) {
          newOrderItems[index - 1] = orderItems[key];
        }
      });
      setOrderItems(newOrderItems);
    }
  };

  // Update ramassage order details
  const updateRamassageOrder = (orderIndex, field, value) => {
    const updatedOrders = ramassageOrders.map((order, i) => 
      i === orderIndex ? { ...order, [field]: value } : order
    );
    setRamassageOrders(updatedOrders);
  };

  // Calculate order profit
  const calculateProfit = (order) => {
    const revenue = order.total_amount;
    const productCost = order.items.reduce((sum, item) => sum + (item.unit_cost * item.quantity), 0);
    const deliveryFee = order.delivery_fee;
    const packagingFee = order.packaging_fee;
    
    let totalCost = productCost + deliveryFee + packagingFee;
    let returnFee = 0;
    let sealBagRecovery = 0;
    
    if (order.status === 'cancelled') {
      const city = cities.find(c => c.name === order.city);
      returnFee = city?.return_fee || 5;
      totalCost += returnFee;
      
      if (order.seal_bag_returned && !city?.is_casa) {
        sealBagRecovery = 1;
        totalCost -= sealBagRecovery;
      }
    }
    
    const profit = order.status === 'delivered' ? revenue - totalCost : 0;
    
    return { 
      revenue, 
      totalCost, 
      profit,
      breakdown: { productCost, deliveryFee, packagingFee, returnFee, sealBagRecovery }
    };
  };

  // Add new product
  const handleAddProduct = () => {
    if (!newProduct.name) {
      alert('Please enter product name!');
      return;
    }

    const product = {
      id: products.length + 1,
      name: newProduct.name,
      category: newProduct.category,
      has_sizes: newProduct.has_sizes,
      has_colors: newProduct.has_colors,
      variants: []
    };

    setProducts([...products, product]);
    setShowModal(null);
    setNewProduct({
      name: '',
      category: 'Caps',
      has_sizes: false,
      has_colors: false,
    });
    alert('✅ Product added! Now add variants (sizes/colors) to it.');
  };

  // Add variant to product
  const handleAddVariant = () => {
    if (!newVariant.buying_price || !newVariant.selling_price) {
      alert('Please fill all required fields!');
      return;
    }

    const updatedProducts = products.map(p => {
      if (p.id === selectedProduct.id) {
        const variant = {
          id: Date.now(),
          size: newVariant.size || null,
          color: newVariant.color || null,
          buying_price: parseFloat(newVariant.buying_price),
          selling_price: parseFloat(newVariant.selling_price),
          stock: parseInt(newVariant.stock_quantity) || 0,
          low_stock_threshold: 10
        };
        return { ...p, variants: [...p.variants, variant] };
      }
      return p;
    });

    setProducts(updatedProducts);
    setShowModal(null);
    setNewVariant({
      size: '',
      color: '',
      buying_price: 0,
      selling_price: 0,
      stock_quantity: 0,
    });
    alert('✅ Variant added successfully!');
  };

  // Add stock
  const handleAddStock = () => {
    if (!stockArrival.variant_id || !stockArrival.quantity) {
      alert('Please select variant and quantity!');
      return;
    }

    const updatedProducts = products.map(p => ({
      ...p,
      variants: p.variants.map(v => 
        v.id === parseInt(stockArrival.variant_id)
          ? { ...v, stock: v.stock + parseInt(stockArrival.quantity) }
          : v
      )
    }));

    setProducts(updatedProducts);
    setShowModal(null);
    setStockArrival({
      product_id: '',
      variant_id: '',
      quantity: 0,
      additional_fees: 0,
      description: '',
    });
    alert(`✅ Added ${stockArrival.quantity} units to stock!`);
  };

  // Update order status
  const updateOrderStatus = (orderId, newStatus) => {
    setOrders(orders.map(order => 
      order.id === orderId ? { ...order, status: newStatus } : order
    ));
  };

  // Toggle seal bag
  const toggleSealBag = (orderId) => {
    setOrders(orders.map(order => 
      order.id === orderId ? { ...order, seal_bag_returned: !order.seal_bag_returned } : order
    ));
  };

  // Delete product
  const deleteProduct = (productId) => {
    if (confirm('Are you sure you want to delete this product?')) {
      setProducts(products.filter(p => p.id !== productId));
    }
  };

  // Get last 2 days orders
  const getLastTwoDaysOrders = () => {
    const today = new Date();
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    return orders.filter(order => {
      const orderDate = new Date(order.order_date);
      return orderDate >= twoDaysAgo;
    });
  };

  // Filter functions
  const filteredOrders = orders.filter(order => 
    order.customer_name.toLowerCase().includes(searchOrders.toLowerCase()) ||
    order.stocky_id.toLowerCase().includes(searchOrders.toLowerCase()) ||
    (order.caleo_id && order.caleo_id.toLowerCase().includes(searchOrders.toLowerCase())) ||
    order.customer_phone.includes(searchOrders)
  );

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchProducts.toLowerCase()) ||
    product.category.toLowerCase().includes(searchProducts.toLowerCase())
  );

  const filteredStock = products.filter(product =>
    product.name.toLowerCase().includes(searchStock.toLowerCase()) ||
    product.category.toLowerCase().includes(searchStock.toLowerCase())
  );

  // Calculate stats
  const today = new Date().toISOString().split('T')[0];
  const stats = {
    ordersToday: orders.filter(o => o.order_date === today).length,
    revenueToday: orders.filter(o => o.order_date === today && o.status === 'delivered').reduce((sum, o) => calculateProfit(o).profit, 0),
    delivered: orders.filter(o => o.status === 'delivered').length,
    lowStock: products.flatMap(p => p.variants).filter(v => v.stock <= v.low_stock_threshold).length,
    totalProfit: orders.filter(o => o.status === 'delivered').reduce((sum, o) => calculateProfit(o).profit, 0),
    totalRevenue: orders.filter(o => o.status === 'delivered').reduce((sum, o) => o.total_amount, 0),
    totalOrders: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    onHold: orders.filter(o => o.status === 'on_hold').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'delivered': 'bg-green-100 text-green-800 border-green-300',
      'on_hold': 'bg-blue-100 text-blue-800 border-blue-300',
      'cancelled': 'bg-red-100 text-red-800 border-red-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // MODALS
  const RamassageProductSelectionModal = () => {
    const [currentOrderSelections, setCurrentOrderSelections] = useState({});
    const [editingOrders, setEditingOrders] = useState({}); // Track which orders are being edited

    const toggleEditing = (orderIndex) => {
      setEditingOrders({
        ...editingOrders,
        [orderIndex]: !editingOrders[orderIndex]
      });
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-6xl w-full h-[90vh] flex flex-col shadow-2xl">
          {/* Fixed Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
            <div>
              <h2 className="text-2xl font-bold text-white">Assign Products to Ramassage Orders</h2>
              <p className="text-sm text-emerald-100 mt-1">Add one or more products to each order</p>
            </div>
            <button onClick={() => {
              if (confirm('Cancel import? All extracted orders will be lost.')) {
                setRamassageOrders([]);
                setOrderItems({});
                setShowModal(null);
              }
            }} className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2">
              <X size={24} />
            </button>
          </div>
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-4 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>📋 {ramassageOrders.length} orders found</strong> in Ramassage PDF. 
                Add products to each order (you can add multiple products per order).
              </p>
              <div className="mt-2 text-xs text-blue-700">
                Orders: {ramassageOrders.map(o => o.customer_name).join(', ')}
              </div>
            </div>

            <div className="space-y-6">
              {ramassageOrders.map((ramOrder, orderIndex) => {
                const orderItemsList = orderItems[orderIndex] || [];
                const isComplete = orderItemsList.length > 0;
                const currentSelection = currentOrderSelections[orderIndex] || { product_id: '', variant_id: '', quantity: 1 };
                const isEditing = editingOrders[orderIndex] || false;
                
                return (
                  <div key={orderIndex} className={`border-2 rounded-xl p-4 ${isComplete ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
                    {/* Order Header with Edit/Delete buttons */}
                    <div className="flex items-start justify-between mb-4 pb-3 border-b-2 border-gray-200">
                      <div className="flex-1">
                        {!isEditing ? (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-sm font-bold text-indigo-600">{ramOrder.caleo_id}</span>
                              {isComplete && <Check className="text-green-600" size={20} />}
                              {!isComplete && <span className="text-xs bg-amber-200 text-amber-800 px-2 py-1 rounded-full font-semibold">No items yet</span>}
                            </div>
                            <div className="text-sm text-gray-700">
                              <strong>{ramOrder.customer_name}</strong> • {ramOrder.city} • {ramOrder.total_amount} MAD
                            </div>
                            <div className="text-xs text-gray-500">{ramOrder.customer_phone}</div>
                            <div className="text-xs text-gray-500">{ramOrder.customer_address}</div>
                          </>
                        ) : (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs font-semibold text-gray-700">Customer Name</label>
                                <input
                                  type="text"
                                  className="w-full px-2 py-1 border rounded text-sm"
                                  value={ramOrder.customer_name}
                                  onChange={(e) => updateRamassageOrder(orderIndex, 'customer_name', e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-gray-700">Phone</label>
                                <input
                                  type="text"
                                  className="w-full px-2 py-1 border rounded text-sm"
                                  value={ramOrder.customer_phone}
                                  onChange={(e) => updateRamassageOrder(orderIndex, 'customer_phone', e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-gray-700">Address</label>
                                <input
                                  type="text"
                                  className="w-full px-2 py-1 border rounded text-sm"
                                  value={ramOrder.customer_address}
                                  onChange={(e) => updateRamassageOrder(orderIndex, 'customer_address', e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-gray-700">City</label>
                                <select
                                  className="w-full px-2 py-1 border rounded text-sm"
                                  value={ramOrder.city}
                                  onChange={(e) => updateRamassageOrder(orderIndex, 'city', e.target.value)}
                                >
                                  {cities.map(c => (
                                    <option key={c.name} value={c.name}>{c.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-gray-700">Total Amount (MAD)</label>
                                <input
                                  type="number"
                                  className="w-full px-2 py-1 border rounded text-sm"
                                  value={ramOrder.total_amount}
                                  onChange={(e) => updateRamassageOrder(orderIndex, 'total_amount', e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-gray-700">Caleo ID</label>
                                <input
                                  type="text"
                                  className="w-full px-2 py-1 border rounded text-sm font-mono"
                                  value={ramOrder.caleo_id}
                                  onChange={(e) => updateRamassageOrder(orderIndex, 'caleo_id', e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 ml-3">
                        <button
                          onClick={() => toggleEditing(orderIndex)}
                          className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-blue-600"
                          title={isEditing ? "Done Editing" : "Edit Order"}
                        >
                          {isEditing ? <Check size={18} /> : <Edit size={18} />}
                        </button>
                        <button
                          onClick={() => removeRamassageOrder(orderIndex)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600"
                          title="Delete Order"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Added Items List */}
                    {orderItemsList.length > 0 && (
                      <div className="mb-4 space-y-2">
                        <div className="text-xs font-semibold text-gray-700 uppercase mb-2">Added Items ({orderItemsList.length}):</div>
                        {orderItemsList.map((item, itemIndex) => {
                          const product = products.find(p => p.id === parseInt(item.product_id));
                          const variant = product?.variants.find(v => v.id === parseInt(item.variant_id));
                          
                          return (
                            <div key={itemIndex} className="flex items-center justify-between bg-white p-3 rounded-lg border-2 border-green-200">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900">{product?.name}</span>
                                {variant?.size && <span className="bg-gray-900 text-white px-2 py-0.5 rounded text-xs font-bold">{variant.size}</span>}
                                {variant?.color && <span className="bg-blue-500 text-white px-2 py-0.5 rounded text-xs font-bold">{variant.color}</span>}
                                <span className="text-sm text-gray-600">× {item.quantity}</span>
                              </div>
                              <button
                                onClick={() => removeItemFromRamassageOrder(orderIndex, itemIndex)}
                                className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                title="Remove item"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add New Item Form */}
                    <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                      <div className="text-xs font-semibold text-gray-700 uppercase mb-3">Add Product to This Order:</div>
                      <div className="grid grid-cols-5 gap-3">
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Product</label>
                          <select
                            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-indigo-500 focus:outline-none"
                            value={currentSelection.product_id}
                            onChange={(e) => setCurrentOrderSelections({
                              ...currentOrderSelections,
                              [orderIndex]: { ...currentSelection, product_id: e.target.value, variant_id: '' }
                            })}
                          >
                            <option value="">Select Product</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Variant</label>
                          <select
                            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-indigo-500 focus:outline-none"
                            value={currentSelection.variant_id}
                            onChange={(e) => setCurrentOrderSelections({
                              ...currentOrderSelections,
                              [orderIndex]: { ...currentSelection, variant_id: e.target.value }
                            })}
                            disabled={!currentSelection.product_id}
                          >
                            <option value="">Select Variant</option>
                            {currentSelection.product_id && products.find(p => p.id === parseInt(currentSelection.product_id))?.variants.map(v => (
                              <option key={v.id} value={v.id}>
                                {v.size && `${v.size} - `}{v.color} (Stock: {v.stock})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Qty</label>
                          <input
                            type="number"
                            min="1"
                            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-indigo-500 focus:outline-none"
                            value={currentSelection.quantity}
                            onChange={(e) => setCurrentOrderSelections({
                              ...currentOrderSelections,
                              [orderIndex]: { ...currentSelection, quantity: e.target.value }
                            })}
                          />
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          const success = addItemToRamassageOrder(
                            orderIndex,
                            currentSelection.product_id,
                            currentSelection.variant_id,
                            currentSelection.quantity
                          );
                          
                          if (success) {
                            // Show feedback
                            const product = products.find(p => p.id === parseInt(currentSelection.product_id));
                            const variant = product?.variants.find(v => v.id === parseInt(currentSelection.variant_id));
                            console.log(`Added: ${product?.name} - ${variant?.size} ${variant?.color} × ${currentSelection.quantity}`);
                            
                            // Reset selection
                            setCurrentOrderSelections({
                              ...currentOrderSelections,
                              [orderIndex]: { product_id: '', variant_id: '', quantity: 1 }
                            });
                          }
                        }}
                        className="mt-3 w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus size={18} />
                        Add Item to Order
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="bg-gray-50 px-6 py-4 flex gap-3 border-t rounded-b-2xl flex-shrink-0">
            <button
              onClick={() => {
                setRamassageOrders([]);
                setOrderItems({});
                setShowModal(null);
              }}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveRamassageOrders}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg font-semibold hover:from-emerald-700 hover:to-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <Save size={20} />
              Save All Orders & Update Stock ({ramassageOrders.filter((_, i) => orderItems[i]?.length > 0).length}/{ramassageOrders.length} ready)
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ConfirmReturnsModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-r from-red-600 to-pink-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold text-white">Confirm Returns</h2>
            <p className="text-sm text-red-100 mt-1">Review returned orders and restore stock</p>
          </div>
          <button onClick={() => {
            setReturnOrders([]);
            setShowModal(null);
          }} className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6">
          <div className="mb-4 bg-red-50 border-2 border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              <strong>📦 {returnOrders.length} orders</strong> found in Return PDF. 
              Stock will be restored and orders marked as cancelled.
            </p>
          </div>

          <div className="space-y-4">
            {returnOrders.map((order) => {
              const profit = calculateProfit({...order, status: 'cancelled'});
              
              return (
                <div key={order.id} className="border-2 border-red-200 rounded-xl p-4 bg-red-50">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-bold text-indigo-600">{order.stocky_id}</span>
                        <span className="font-mono text-xs text-gray-600">{order.caleo_id}</span>
                      </div>
                      <div className="text-sm text-gray-700">
                        <strong>{order.customer_name}</strong> • {order.city}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-gray-900">{order.total_amount} MAD</div>
                      <div className="text-xs text-red-600">Return fee: -{profit.breakdown.returnFee} MAD</div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-3">
                    <div className="text-xs font-semibold text-gray-700 mb-2">Items to restore:</div>
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span>{item.product} - {item.size} {item.color}</span>
                        <span className="font-semibold text-green-600">+{item.quantity} to stock</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex gap-3 border-t rounded-b-2xl">
          <button
            onClick={() => {
              setReturnOrders([]);
              setShowModal(null);
            }}
            className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={confirmReturns}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-lg font-semibold hover:from-red-700 hover:to-pink-700 transition-colors flex items-center justify-center gap-2"
          >
            <Check size={20} />
            Confirm Returns & Restore Stock
          </button>
        </div>
      </div>
    </div>
  );

  const RamassageUploadModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
        <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-2xl font-bold text-white">Upload Ramassage PDF</h2>
          <button onClick={() => setShowModal(null)} className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
            <h3 className="font-bold text-blue-900 mb-2">📋 How This Works:</h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Upload Ramassage PDF from Caleo</li>
              <li>Stocky extracts all order data</li>
              <li>You assign products to each order</li>
              <li>Orders are created & stock is reduced</li>
            </ol>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-emerald-500 transition-colors">
            <Upload className="mx-auto mb-4 text-gray-400" size={48} />
            <input
              type="file"
              accept=".pdf"
              onChange={handleRamassageUpload}
              className="hidden"
              id="ramassage-upload"
            />
            <label 
              htmlFor="ramassage-upload"
              className="cursor-pointer"
            >
              <div className="text-sm font-semibold text-gray-700 mb-2">Click to upload Ramassage PDF</div>
              <div className="text-xs text-gray-500">PDF from Caleo with order details</div>
            </label>
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 border-t rounded-b-2xl">
          <button
            onClick={() => setShowModal(null)}
            className="w-full px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  const ReturnsUploadModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
        <div className="bg-gradient-to-r from-red-600 to-pink-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-2xl font-bold text-white">Upload Returns PDF</h2>
          <button onClick={() => setShowModal(null)} className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 p-4 rounded-lg border-2 border-amber-200">
            <h3 className="font-bold text-amber-900 mb-2">📦 How Returns Work:</h3>
            <ol className="text-sm text-amber-800 space-y-1 list-decimal list-inside">
              <li>Upload Returns PDF from Caleo</li>
              <li>Stocky finds matching orders by CMD-ID</li>
              <li>You confirm the returns</li>
              <li>Orders marked cancelled & stock restored</li>
            </ol>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-red-500 transition-colors">
            <Upload className="mx-auto mb-4 text-gray-400" size={48} />
            <input
              type="file"
              accept=".pdf"
              onChange={handleReturnsUpload}
              className="hidden"
              id="returns-upload"
            />
            <label 
              htmlFor="returns-upload"
              className="cursor-pointer"
            >
              <div className="text-sm font-semibold text-gray-700 mb-2">Click to upload Returns PDF</div>
              <div className="text-xs text-gray-500">PDF with returned/cancelled order IDs</div>
            </label>
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 border-t rounded-b-2xl">
          <button
            onClick={() => setShowModal(null)}
            className="w-full px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  const OrderDetailsModal = () => {
    if (!selectedOrder) return null;
    
    const calculations = calculateProfit(selectedOrder);
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
          <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <h2 className="text-2xl font-bold text-white">Order Details & Calculations</h2>
            <button onClick={() => setSelectedOrder(null)} className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2">
              <X size={24} />
            </button>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Order Info */}
            <div className="bg-gray-50 p-4 rounded-xl">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-600 font-semibold">Stocky ID</div>
                  <div className="font-mono text-indigo-600 font-bold">{selectedOrder.stocky_id}</div>
                </div>
                <div>
                  <div className="text-gray-600 font-semibold">Caleo ID</div>
                  <div className="font-mono text-indigo-600 font-bold">{selectedOrder.caleo_id}</div>
                </div>
                <div>
                  <div className="text-gray-600 font-semibold">Customer</div>
                  <div className="font-semibold">{selectedOrder.customer_name}</div>
                </div>
                <div>
                  <div className="text-gray-600 font-semibold">City</div>
                  <div className="font-semibold">{selectedOrder.city}</div>
                </div>
                <div>
                  <div className="text-gray-600 font-semibold">Status</div>
                  <select
                    value={selectedOrder.status}
                    onChange={(e) => {
                      updateOrderStatus(selectedOrder.id, e.target.value);
                      setSelectedOrder({...selectedOrder, status: e.target.value});
                    }}
                    className="px-3 py-1 rounded-lg border-2 border-gray-300 font-semibold"
                  >
                    <option value="pending">Pending</option>
                    <option value="delivered">Delivered</option>
                    <option value="on_hold">On Hold</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Items */}
            <div>
              <h3 className="font-bold text-lg mb-3">Order Items</h3>
              {selectedOrder.items.map((item, idx) => (
                <div key={idx} className="flex justify-between p-3 bg-gray-50 rounded-lg mb-2">
                  <div>
                    <div className="font-semibold">{item.product} - {item.size} {item.color}</div>
                    <div className="text-sm text-gray-600">Qty: {item.quantity}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{item.unit_price * item.quantity} MAD</div>
                    <div className="text-xs text-gray-600">Cost: {item.unit_cost * item.quantity} MAD</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Profit Calculation */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-indigo-200">
              <h3 className="font-bold text-xl mb-4 text-indigo-900">💰 Profit Calculation</h3>
              
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-lg">
                  <span className="text-gray-700 font-semibold">Revenue:</span>
                  <span className="font-bold text-green-600">+{calculations.revenue} MAD</span>
                </div>
                
                <div className="border-t-2 border-indigo-200 pt-3">
                  <div className="font-semibold text-gray-800 mb-2">Costs:</div>
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Product Cost:</span>
                      <span className="text-red-600">-{calculations.breakdown.productCost} MAD</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Delivery Fee:</span>
                      <span className="text-red-600">-{calculations.breakdown.deliveryFee} MAD</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Packaging ({cities.find(c => c.name === selectedOrder.city)?.is_casa ? 'Casa' : 'Other'}):</span>
                      <span className="text-red-600">-{calculations.breakdown.packagingFee} MAD</span>
                    </div>
                    
                    {selectedOrder.status === 'cancelled' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Return Fee:</span>
                          <span className="text-red-600">-{calculations.breakdown.returnFee} MAD</span>
                        </div>
                        
                        {!cities.find(c => c.name === selectedOrder.city)?.is_casa && (
                          <div className="flex items-center justify-between bg-amber-50 p-2 rounded">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedOrder.seal_bag_returned}
                                onChange={() => {
                                  toggleSealBag(selectedOrder.id);
                                  setSelectedOrder({...selectedOrder, seal_bag_returned: !selectedOrder.seal_bag_returned});
                                }}
                                className="w-4 h-4"
                              />
                              <span className="text-sm text-gray-700">Seal bag returned?</span>
                            </div>
                            {selectedOrder.seal_bag_returned && (
                              <span className="text-green-600 font-semibold">+{calculations.breakdown.sealBagRecovery} MAD</span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="border-t-2 border-indigo-200 pt-2">
                  <div className="flex justify-between">
                    <span className="text-gray-700 font-semibold">Total Costs:</span>
                    <span className="text-red-600 font-bold">-{calculations.totalCost.toFixed(2)} MAD</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border-2 border-indigo-300">
                <div className="flex justify-between items-center text-2xl">
                  <span className="font-bold text-gray-900">Net Profit:</span>
                  <span className={`font-black ${calculations.profit > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {calculations.profit.toFixed(2)} MAD
                  </span>
                </div>
                {selectedOrder.status !== 'delivered' && (
                  <div className="text-sm text-amber-600 mt-2">
                    ⚠️ Profit only counts for delivered orders
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t rounded-b-2xl">
            <button
              onClick={() => setSelectedOrder(null)}
              className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const EditOrderModal = () => {
    if (!selectedOrder || showModal !== 'edit_order') return null;
    
    // Using selectedOrder directly and tracking changes
    const [localChanges, setLocalChanges] = React.useState({});
    
    const currentOrder = { ...selectedOrder, ...localChanges };
    
    const updateField = (field, value) => {
      setLocalChanges({ ...localChanges, [field]: value });
    };
    
    const saveEditedOrder = () => {
      const updatedOrder = { ...selectedOrder, ...localChanges };
      setOrders(orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
      setSelectedOrder(null);
      setShowModal(null);
      setLocalChanges({});
      alert('Order updated successfully!');
    };
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
          <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <h2 className="text-2xl font-bold text-white">Edit Order</h2>
            <button onClick={() => {
              setSelectedOrder(null);
              setShowModal(null);
              setLocalChanges({});
            }} className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2">
              <X size={24} />
            </button>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Customer Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                  value={currentOrder.customer_name}
                  onChange={(e) => updateField('customer_name', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                  value={currentOrder.customer_phone}
                  onChange={(e) => updateField('customer_phone', e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                  value={currentOrder.customer_address}
                  onChange={(e) => updateField('customer_address', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">City</label>
                <select
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                  value={currentOrder.city}
                  onChange={(e) => {
                    const newCity = e.target.value;
                    const cityData = cities.find(c => c.name === newCity);
                    setLocalChanges({
                      ...localChanges,
                      city: newCity,
                      delivery_fee: cityData?.delivery_fee || 35,
                      packaging_fee: cityData?.is_casa ? 2 : 3
                    });
                  }}
                >
                  {cities.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Total Amount (MAD)</label>
                <input
                  type="number"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                  value={currentOrder.total_amount}
                  onChange={(e) => updateField('total_amount', parseFloat(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                <select
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                  value={currentOrder.status}
                  onChange={(e) => updateField('status', e.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="delivered">Delivered</option>
                  <option value="on_hold">On Hold</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Caleo ID</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none font-mono"
                  value={currentOrder.caleo_id}
                  onChange={(e) => updateField('caleo_id', e.target.value)}
                />
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Changing the city will automatically update delivery and packaging fees.
              </p>
            </div>
          </div>

          <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex gap-3 border-t rounded-b-2xl">
            <button
              onClick={() => {
                setSelectedOrder(null);
                setShowModal(null);
                setLocalChanges({});
              }}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveEditedOrder}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    );
  };
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
          <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <h2 className="text-2xl font-bold text-white">Edit Order</h2>
            <button onClick={() => {
              setSelectedOrder(null);
              setShowModal(null);
            }} className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2">
              <X size={24} />
            </button>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Customer Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                  value={editedOrder.customer_name}
                  onChange={(e) => setEditedOrder({...editedOrder, customer_name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                  value={editedOrder.customer_phone}
                  onChange={(e) => setEditedOrder({...editedOrder, customer_phone: e.target.value})}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                  value={editedOrder.customer_address}
                  onChange={(e) => setEditedOrder({...editedOrder, customer_address: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">City</label>
                <select
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                  value={editedOrder.city}
                  onChange={(e) => {
                    const newCity = e.target.value;
                    const cityData = cities.find(c => c.name === newCity);
                    setEditedOrder({
                      ...editedOrder, 
                      city: newCity,
                      delivery_fee: cityData?.delivery_fee || 35,
                      packaging_fee: cityData?.is_casa ? 2 : 3
                    });
                  }}
                >
                  {cities.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Total Amount (MAD)</label>
                <input
                  type="number"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                  value={editedOrder.total_amount}
                  onChange={(e) => setEditedOrder({...editedOrder, total_amount: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                <select
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                  value={editedOrder.status}
                  onChange={(e) => setEditedOrder({...editedOrder, status: e.target.value})}
                >
                  <option value="pending">Pending</option>
                  <option value="delivered">Delivered</option>
                  <option value="on_hold">On Hold</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Caleo ID</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none font-mono"
                  value={editedOrder.caleo_id}
                  onChange={(e) => setEditedOrder({...editedOrder, caleo_id: e.target.value})}
                />
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Changing the city will automatically update delivery and packaging fees.
              </p>
            </div>
          </div>

          <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex gap-3 border-t rounded-b-2xl">
            <button
              onClick={() => {
                setSelectedOrder(null);
                setShowModal(null);
              }}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveEditedOrder}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    );
  };
    
    const calculations = calculateProfit(selectedOrder);
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
          <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <h2 className="text-2xl font-bold text-white">Order Details & Calculations</h2>
            <button onClick={() => setSelectedOrder(null)} className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2">
              <X size={24} />
            </button>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Order Info */}
            <div className="bg-gray-50 p-4 rounded-xl">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-600 font-semibold">Stocky ID</div>
                  <div className="font-mono text-indigo-600 font-bold">{selectedOrder.stocky_id}</div>
                </div>
                <div>
                  <div className="text-gray-600 font-semibold">Caleo ID</div>
                  <div className="font-mono text-indigo-600 font-bold">{selectedOrder.caleo_id}</div>
                </div>
                <div>
                  <div className="text-gray-600 font-semibold">Customer</div>
                  <div className="font-semibold">{selectedOrder.customer_name}</div>
                </div>
                <div>
                  <div className="text-gray-600 font-semibold">City</div>
                  <div className="font-semibold">{selectedOrder.city}</div>
                </div>
                <div>
                  <div className="text-gray-600 font-semibold">Status</div>
                  <select
                    value={selectedOrder.status}
                    onChange={(e) => {
                      updateOrderStatus(selectedOrder.id, e.target.value);
                      setSelectedOrder({...selectedOrder, status: e.target.value});
                    }}
                    className="px-3 py-1 rounded-lg border-2 border-gray-300 font-semibold"
                  >
                    <option value="pending">Pending</option>
                    <option value="delivered">Delivered</option>
                    <option value="on_hold">On Hold</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Items */}
            <div>
              <h3 className="font-bold text-lg mb-3">Order Items</h3>
              {selectedOrder.items.map((item, idx) => (
                <div key={idx} className="flex justify-between p-3 bg-gray-50 rounded-lg mb-2">
                  <div>
                    <div className="font-semibold">{item.product} - {item.size} {item.color}</div>
                    <div className="text-sm text-gray-600">Qty: {item.quantity}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{item.unit_price * item.quantity} MAD</div>
                    <div className="text-xs text-gray-600">Cost: {item.unit_cost * item.quantity} MAD</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Profit Calculation */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-indigo-200">
              <h3 className="font-bold text-xl mb-4 text-indigo-900">💰 Profit Calculation</h3>
              
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-lg">
                  <span className="text-gray-700 font-semibold">Revenue:</span>
                  <span className="font-bold text-green-600">+{calculations.revenue} MAD</span>
                </div>
                
                <div className="border-t-2 border-indigo-200 pt-3">
                  <div className="font-semibold text-gray-800 mb-2">Costs:</div>
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Product Cost:</span>
                      <span className="text-red-600">-{calculations.breakdown.productCost} MAD</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Delivery Fee:</span>
                      <span className="text-red-600">-{calculations.breakdown.deliveryFee} MAD</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Packaging ({cities.find(c => c.name === selectedOrder.city)?.is_casa ? 'Casa' : 'Other'}):</span>
                      <span className="text-red-600">-{calculations.breakdown.packagingFee} MAD</span>
                    </div>
                    
                    {selectedOrder.status === 'cancelled' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Return Fee:</span>
                          <span className="text-red-600">-{calculations.breakdown.returnFee} MAD</span>
                        </div>
                        
                        {!cities.find(c => c.name === selectedOrder.city)?.is_casa && (
                          <div className="flex items-center justify-between bg-amber-50 p-2 rounded">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedOrder.seal_bag_returned}
                                onChange={() => {
                                  toggleSealBag(selectedOrder.id);
                                  setSelectedOrder({...selectedOrder, seal_bag_returned: !selectedOrder.seal_bag_returned});
                                }}
                                className="w-4 h-4"
                              />
                              <span className="text-sm text-gray-700">Seal bag returned?</span>
                            </div>
                            {selectedOrder.seal_bag_returned && (
                              <span className="text-green-600 font-semibold">+{calculations.breakdown.sealBagRecovery} MAD</span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="border-t-2 border-indigo-200 pt-2">
                  <div className="flex justify-between">
                    <span className="text-gray-700 font-semibold">Total Costs:</span>
                    <span className="text-red-600 font-bold">-{calculations.totalCost.toFixed(2)} MAD</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border-2 border-indigo-300">
                <div className="flex justify-between items-center text-2xl">
                  <span className="font-bold text-gray-900">Net Profit:</span>
                  <span className={`font-black ${calculations.profit > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {calculations.profit.toFixed(2)} MAD
                  </span>
                </div>
                {selectedOrder.status !== 'delivered' && (
                  <div className="text-sm text-amber-600 mt-2">
                    ⚠️ Profit only counts for delivered orders
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t rounded-b-2xl">
            <button
              onClick={() => setSelectedOrder(null)}
              className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const AddProductModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-2xl font-bold text-white">Add New Product</h2>
          <button onClick={() => setShowModal(null)} className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Product Name *</label>
            <input
              type="text"
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
              value={newProduct.name}
              onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
              placeholder="e.g., Adidas Cap"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
            <input
              type="text"
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
              value={newProduct.category}
              onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
            />
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newProduct.has_sizes}
                onChange={(e) => setNewProduct({...newProduct, has_sizes: e.target.checked})}
                className="w-4 h-4"
              />
              <span className="text-sm font-semibold text-gray-700">Has Sizes</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newProduct.has_colors}
                onChange={(e) => setNewProduct({...newProduct, has_colors: e.target.checked})}
                className="w-4 h-4"
              />
              <span className="text-sm font-semibold text-gray-700">Has Colors</span>
            </label>
          </div>

          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
            💡 After creating the product, add sizes/colors in the next step.
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 flex gap-3 border-t rounded-b-2xl">
          <button
            onClick={() => setShowModal(null)}
            className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAddProduct}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-colors"
          >
            Add Product
          </button>
        </div>
      </div>
    </div>
  );

  const AddVariantModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-2xl font-bold text-white">Add Variant to {selectedProduct?.name}</h2>
          <button onClick={() => setShowModal(null)} className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          {selectedProduct?.has_sizes && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Size</label>
              <input
                type="text"
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                value={newVariant.size}
                onChange={(e) => setNewVariant({...newVariant, size: e.target.value})}
                placeholder="e.g., M, L, XL"
              />
            </div>
          )}

          {selectedProduct?.has_colors && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Color</label>
              <input
                type="text"
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                value={newVariant.color}
                onChange={(e) => setNewVariant({...newVariant, color: e.target.value})}
                placeholder="e.g., Black, Blue, Red"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Buying Price (MAD) *</label>
              <input
                type="number"
                step="0.01"
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                value={newVariant.buying_price}
                onChange={(e) => setNewVariant({...newVariant, buying_price: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Selling Price (MAD) *</label>
              <input
                type="number"
                step="0.01"
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                value={newVariant.selling_price}
                onChange={(e) => setNewVariant({...newVariant, selling_price: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Initial Stock Quantity</label>
            <input
              type="number"
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
              value={newVariant.stock_quantity}
              onChange={(e) => setNewVariant({...newVariant, stock_quantity: e.target.value})}
            />
          </div>

          {parseFloat(newVariant.selling_price) > 0 && parseFloat(newVariant.buying_price) > 0 && (
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-sm font-semibold text-green-800">
                Profit per unit: {(parseFloat(newVariant.selling_price) - parseFloat(newVariant.buying_price)).toFixed(2)} MAD
              </div>
              <div className="text-xs text-green-600">
                Margin: {((parseFloat(newVariant.selling_price) - parseFloat(newVariant.buying_price)) / parseFloat(newVariant.selling_price) * 100).toFixed(1)}%
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-6 py-4 flex gap-3 border-t rounded-b-2xl">
          <button
            onClick={() => setShowModal(null)}
            className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAddVariant}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-colors"
          >
            Add Variant
          </button>
        </div>
      </div>
    </div>
  );

  const AddStockModal = () => {
    const selectedProductForStock = stockArrival.product_id ? products.find(p => p.id === parseInt(stockArrival.product_id)) : null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <h2 className="text-2xl font-bold text-white">Add Stock Arrival</h2>
            <button onClick={() => setShowModal(null)} className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2">
              <X size={24} />
            </button>
          </div>
          
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Product *</label>
              <select
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                value={stockArrival.product_id}
                onChange={(e) => setStockArrival({...stockArrival, product_id: e.target.value, variant_id: ''})}
              >
                <option value="">Select Product</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </div>

            {selectedProductForStock && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Variant *</label>
                <select
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                  value={stockArrival.variant_id}
                  onChange={(e) => setStockArrival({...stockArrival, variant_id: e.target.value})}
                >
                  <option value="">Select Variant</option>
                  {selectedProductForStock.variants.map(variant => (
                    <option key={variant.id} value={variant.id}>
                      {variant.size && `${variant.size} - `}{variant.color} (Current: {variant.stock})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Quantity to Add *</label>
              <input
                type="number"
                min="1"
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                value={stockArrival.quantity}
                onChange={(e) => setStockArrival({...stockArrival, quantity: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Fees (MAD)</label>
              <input
                type="number"
                step="0.01"
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                value={stockArrival.additional_fees}
                onChange={(e) => setStockArrival({...stockArrival, additional_fees: e.target.value})}
                placeholder="Transportation, lunch, etc."
              />
            </div>

            {parseFloat(stockArrival.additional_fees) > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                  rows="2"
                  value={stockArrival.description}
                  onChange={(e) => setStockArrival({...stockArrival, description: e.target.value})}
                  placeholder="e.g., Taxi to supplier + lunch"
                />
              </div>
            )}
          </div>

          <div className="bg-gray-50 px-6 py-4 flex gap-3 border-t rounded-b-2xl">
            <button
              onClick={() => setShowModal(null)}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddStock}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-colors"
            >
              Add Stock
            </button>
          </div>
        </div>
      </div>
    );
  };

  // PAGES (Dashboard, Products, Stock, Orders - keeping them as before but I'll include for completeness)
  
  const Dashboard = () => {
    const lastTwoDaysOrders = getLastTwoDaysOrders();
    
    return (
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-6 border-l-4 border-indigo-600 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Total Profit</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalProfit.toFixed(2)} MAD</p>
              </div>
              <TrendingUp className="text-indigo-600" size={40} strokeWidth={1.5} />
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border-l-4 border-emerald-600 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalRevenue} MAD</p>
              </div>
              <DollarSign className="text-emerald-600" size={40} strokeWidth={1.5} />
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border-l-4 border-blue-600 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Delivered</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.delivered}</p>
              </div>
              <Package className="text-blue-600" size={40} strokeWidth={1.5} />
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border-l-4 border-amber-600 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Low Stock</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.lowStock}</p>
              </div>
              <AlertTriangle className="text-amber-600" size={40} strokeWidth={1.5} />
            </div>
          </div>
        </div>

        {/* Low Stock Alerts */}
        {stats.lowStock > 0 && (
          <div className="bg-amber-50 border-l-4 border-amber-500 rounded-xl p-6 shadow-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-600 mt-1" size={24} />
              <div className="flex-1">
                <h3 className="font-bold text-amber-900 text-lg mb-3">⚠️ Low Stock Alerts</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {products.flatMap(p => 
                    p.variants.filter(v => v.stock <= v.low_stock_threshold).map(v => (
                      <div key={v.id} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm">
                        <div>
                          <span className="font-semibold text-gray-900">{p.name}</span>
                          {v.size && <span className="mx-2 text-sm bg-gray-100 px-2 py-1 rounded">{v.size}</span>}
                          {v.color && <span className="text-sm bg-blue-100 px-2 py-1 rounded">{v.color}</span>}
                        </div>
                        <span className="text-amber-600 font-bold">{v.stock} left</span>
                      </div>
                    ))
                  )}
                </div>
                <button 
                  onClick={() => {
                    setCurrentPage('stock');
                    setShowModal('add_stock');
                  }}
                  className="mt-4 bg-amber-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-amber-700 transition-colors"
                >
                  Add Stock Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Last 2 Days Orders - LIST */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShoppingCart size={24} />
              Last 2 Days Orders
            </h2>
          </div>
          
          {/* Search Bar */}
          <div className="px-6 py-4 border-b bg-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by customer name..."
                className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                value={searchOrders}
                onChange={(e) => setSearchOrders(e.target.value)}
              />
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-3">
              {lastTwoDaysOrders
                .filter(order => order.customer_name.toLowerCase().includes(searchOrders.toLowerCase()))
                .map(order => {
                  const profit = calculateProfit(order);
                  return (
                    <div 
                      key={order.id} 
                      onClick={() => setSelectedOrder(order)}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer border-2 border-transparent hover:border-indigo-300"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="font-mono text-sm font-bold text-indigo-600">{order.stocky_id}</div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(order.status)}`}>
                            {order.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {order.customer_name} • {order.city} • {order.order_date}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">{order.total_amount} MAD</div>
                        <div className={`text-sm font-semibold ${profit.profit > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          Profit: {profit.profit.toFixed(2)} MAD
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
            
            {lastTwoDaysOrders.filter(order => order.customer_name.toLowerCase().includes(searchOrders.toLowerCase())).length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <ShoppingCart className="mx-auto mb-4 text-gray-300" size={48} />
                <p>No orders found in the last 2 days</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ... (keeping Products, Stock, Orders pages identical to previous version)
  const Products = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Box size={24} />
            Products Management
          </h2>
          <button 
            onClick={() => setShowModal('add_product')}
            className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-50 transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            Add Product
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
              value={searchProducts}
              onChange={(e) => setSearchProducts(e.target.value)}
            />
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map(product => (
              <div key={product.id} className="border-2 border-gray-200 rounded-xl overflow-hidden hover:shadow-xl transition-all">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900">{product.name}</h3>
                    <p className="text-xs text-gray-600">{product.category}</p>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => {
                        setSelectedProduct(product);
                        setShowModal('add_variant');
                      }}
                      className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700"
                      title="Add Variant"
                    >
                      <Plus size={16} />
                    </button>
                    <button 
                      onClick={() => deleteProduct(product.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600"
                      title="Delete Product"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="p-3">
                  {product.variants.length > 0 ? (
                    <div className="space-y-2">
                      {product.variants.map(variant => (
                        <div key={variant.id} className={`p-3 rounded-lg border ${variant.stock <= variant.low_stock_threshold ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1">
                              {variant.size && <span className="bg-gray-900 text-white px-2 py-0.5 rounded text-xs font-bold">{variant.size}</span>}
                              {variant.color && <span className="bg-blue-500 text-white px-2 py-0.5 rounded text-xs font-bold">{variant.color}</span>}
                            </div>
                            <span className={`font-bold text-sm ${variant.stock <= variant.low_stock_threshold ? 'text-red-600' : 'text-green-600'}`}>
                              {variant.stock}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 space-y-0.5">
                            <div className="flex justify-between">
                              <span>Price:</span>
                              <span className="font-semibold">{variant.selling_price} MAD</span>
                            </div>
                            <div className="flex justify-between text-green-600">
                              <span>Profit:</span>
                              <span className="font-bold">{variant.selling_price - variant.buying_price} MAD</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-400 text-sm">
                      No variants yet
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Box className="mx-auto mb-4 text-gray-300" size={48} />
              <p>No products found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const Stock = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Database size={24} />
            Stock Management
          </h2>
          <button 
            onClick={() => setShowModal('add_stock')}
            className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-50 transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            Add Stock Arrival
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search stock..."
              className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
              value={searchStock}
              onChange={(e) => setSearchStock(e.target.value)}
            />
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStock.map(product => (
              <div key={product.id} className="border-2 border-gray-200 rounded-xl p-4 bg-gradient-to-br from-white to-gray-50">
                <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b">{product.name}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {product.variants.map(variant => (
                    <div key={variant.id} className={`p-3 rounded-lg text-center border-2 ${variant.stock <= variant.low_stock_threshold ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
                      <div className="flex items-center justify-center gap-1 mb-2">
                        {variant.size && <span className="bg-gray-900 text-white px-2 py-0.5 rounded text-xs font-bold">{variant.size}</span>}
                        {variant.color && <span className="bg-blue-500 text-white px-2 py-0.5 rounded text-xs font-bold">{variant.color}</span>}
                      </div>
                      <div className="text-3xl font-black text-gray-900 mb-1">{variant.stock}</div>
                      <div className="text-xs text-gray-600">Threshold: {variant.low_stock_threshold}</div>
                      {variant.stock <= variant.low_stock_threshold && (
                        <div className="mt-1 text-xs text-red-600 font-semibold">
                          ⚠️ LOW!
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {filteredStock.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Database className="mx-auto mb-4 text-gray-300" size={48} />
              <p>No products found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const Orders = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingCart size={24} />
            All Orders
          </h2>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowModal('ramassage_upload')}
              className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-emerald-600 transition-colors flex items-center gap-2"
            >
              <Upload size={18} />
              Upload Ramassage
            </button>
            <button 
              onClick={() => setShowModal('return_upload')}
              className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition-colors flex items-center gap-2"
            >
              <Upload size={18} />
              Upload Returns
            </button>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by customer name, Stocky ID, Caleo ID, or phone..."
              className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
              value={searchOrders}
              onChange={(e) => setSearchOrders(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredOrders.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Stocky ID</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Caleo ID</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">City</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Profit</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map(order => {
                  const profit = calculateProfit(order);
                  return (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-bold text-indigo-600">{order.stocky_id}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs text-gray-600">{order.caleo_id}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-900">{order.customer_name}</div>
                        <div className="text-xs text-gray-500">{order.customer_phone}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{order.city}</td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-900">{order.total_amount} MAD</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-bold ${profit.profit > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {profit.profit.toFixed(2)} MAD
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(order.status)}`}>
                          {order.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setSelectedOrder(order)}
                            className="text-indigo-600 hover:text-indigo-900 font-semibold text-sm flex items-center gap-1"
                          >
                            <Eye size={16} />
                            View
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowModal('edit_order');
                            }}
                            className="text-blue-600 hover:text-blue-900 font-semibold text-sm flex items-center gap-1"
                          >
                            <Edit size={16} />
                            Edit
                          </button>
                          <button 
                            onClick={() => {
                              if (confirm(`Delete order ${order.stocky_id}?`)) {
                                setOrders(orders.filter(o => o.id !== order.id));
                                // Restore stock when deleting
                                const updatedProducts = products.map(product => ({
                                  ...product,
                                  variants: product.variants.map(variant => {
                                    let stockToRestore = 0;
                                    order.items.forEach(item => {
                                      const matchingProduct = products.find(p => p.name === item.product);
                                      if (matchingProduct) {
                                        const matchingVariant = matchingProduct.variants.find(
                                          v => v.size === item.size && v.color === item.color
                                        );
                                        if (matchingVariant && matchingVariant.id === variant.id) {
                                          stockToRestore += item.quantity;
                                        }
                                      }
                                    });
                                    return {
                                      ...variant,
                                      stock: variant.stock + stockToRestore
                                    };
                                  })
                                }));
                                setProducts(updatedProducts);
                                alert('Order deleted and stock restored!');
                              }
                            }}
                            className="text-red-600 hover:text-red-900 font-semibold text-sm flex items-center gap-1"
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12 text-gray-500 px-6">
              <ShoppingCart className="mx-auto mb-4 text-gray-300" size={48} />
              <p className="mb-4">No orders yet. Upload a Ramassage PDF to import orders from Caleo.</p>
              <button
                onClick={() => setShowModal('ramassage_upload')}
                className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-emerald-700 transition-colors inline-flex items-center gap-2"
              >
                <Upload size={20} />
                Upload Ramassage PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-lg p-2">
                <Package className="text-indigo-600" size={28} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">STOCKY</h1>
                <p className="text-xs text-indigo-200 font-medium">Final Version - New Workflow!</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
              { id: 'products', label: 'Products', icon: Box },
              { id: 'stock', label: 'Stock', icon: Database },
              { id: 'orders', label: 'Orders', icon: ShoppingCart },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setCurrentPage(id)}
                className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all relative ${
                  currentPage === id ? 'text-indigo-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon size={18} strokeWidth={2.5} />
                {label}
                {currentPage === id && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentPage === 'dashboard' && <Dashboard />}
        {currentPage === 'products' && <Products />}
        {currentPage === 'stock' && <Stock />}
        {currentPage === 'orders' && <Orders />}
      </div>

      {/* Modals */}
      {showModal === 'ramassage_upload' && <RamassageUploadModal />}
      {showModal === 'return_upload' && <ReturnsUploadModal />}
      {showModal === 'ramassage_products' && <RamassageProductSelectionModal />}
      {showModal === 'confirm_returns' && <ConfirmReturnsModal />}
      {showModal === 'add_product' && <AddProductModal />}
      {showModal === 'add_variant' && <AddVariantModal />}
      {showModal === 'add_stock' && <AddStockModal />}
      {showModal === 'edit_order' && <EditOrderModal />}
      {selectedOrder && showModal !== 'edit_order' && <OrderDetailsModal />}

      {/* Demo Notice */}
      <div className="fixed bottom-4 right-4 bg-gradient-to-r from-emerald-600 to-green-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-semibold">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
        NEW WORKFLOW - Test Ramassage Upload!
      </div>
    </div>
  );
}
