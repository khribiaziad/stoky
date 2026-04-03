from sqlalchemy import Boolean, Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class PaymentType(str, enum.Enum):
    monthly = "monthly"
    per_order = "per_order"
    both = "both"


class ExpenseType(str, enum.Enum):
    monthly = "monthly"
    per_order = "per_order"


class OrderStatus(str, enum.Enum):
    pending = "pending"
    delivered = "delivered"
    cancelled = "cancelled"


class WithdrawalType(str, enum.Enum):
    stock_purchase = "stock_purchase"
    manual = "manual"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    store_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    is_approved = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    role = Column(String, default="admin")  # "admin" or "confirmer"
    store_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # confirmers: points to admin user_id
    team_member_id = Column(Integer, nullable=True)  # links confirmer to their TeamMember record
    google_id = Column(String, nullable=True, unique=True)
    google_email = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (UniqueConstraint('user_id', 'name', name='uq_product_name_per_store'),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String, nullable=False)
    short_name = Column(String, nullable=True)
    category = Column(String, default="caps")
    has_sizes = Column(Boolean, default=True)
    has_colors = Column(Boolean, default=True)
    # is_pack removed (#98) — column still exists in DB but is ignored going forward
    under_1kg = Column(Boolean, default=False)
    supplier = Column(String, nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    variants = relationship("Variant", back_populates="product", cascade="all, delete-orphan")


class Variant(Base):
    __tablename__ = "variants"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    sku = Column(String, nullable=True)
    size = Column(String, nullable=True)
    color = Column(String, nullable=True)
    buying_price = Column(Float, nullable=False)
    selling_price = Column(Float, nullable=True)
    stock = Column(Integer, default=0)
    low_stock_threshold = Column(Integer, default=5)
    created_at = Column(DateTime, server_default=func.now())

    product = relationship("Product", back_populates="variants")
    order_items = relationship("OrderItem", back_populates="variant")
    stock_arrivals = relationship("StockArrival", back_populates="variant")
    broken_stock = relationship("BrokenStock", back_populates="variant")
    warehouse_stock = relationship("VariantStock", back_populates="variant", cascade="all, delete-orphan")


class Pack(Base):
    __tablename__ = "packs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    name = Column(String, nullable=False)
    selling_price = Column(Float, nullable=False)
    packaging_cost = Column(Float, default=0)
    item_count = Column(Integer, nullable=False, default=1)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    presets = relationship("PackPreset", back_populates="pack", cascade="all, delete-orphan")


class PackPreset(Base):
    __tablename__ = "pack_presets"

    id = Column(Integer, primary_key=True, index=True)
    pack_id = Column(Integer, ForeignKey("packs.id"), nullable=False)
    name = Column(String, nullable=False)

    pack = relationship("Pack", back_populates="presets")
    items = relationship("PackPresetItem", back_populates="preset", cascade="all, delete-orphan")


class PackPresetItem(Base):
    __tablename__ = "pack_preset_items"

    id = Column(Integer, primary_key=True, index=True)
    preset_id = Column(Integer, ForeignKey("pack_presets.id"), nullable=False)
    variant_id = Column(Integer, ForeignKey("variants.id"), nullable=False)
    quantity = Column(Integer, default=1)

    preset = relationship("PackPreset", back_populates="items")
    variant = relationship("Variant")


class Offer(Base):
    __tablename__ = "offers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String, nullable=False)
    selling_price = Column(Float, nullable=False)
    packaging_cost = Column(Float, default=0)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    items = relationship("OfferItem", back_populates="offer", cascade="all, delete-orphan")


class OfferItem(Base):
    __tablename__ = "offer_items"

    id = Column(Integer, primary_key=True, index=True)
    offer_id = Column(Integer, ForeignKey("offers.id"), nullable=False)
    variant_id = Column(Integer, ForeignKey("variants.id"), nullable=False)
    quantity = Column(Integer, default=1)

    offer = relationship("Offer", back_populates="items")
    variant = relationship("Variant")


class PromoCode(Base):
    __tablename__ = "promo_codes"
    __table_args__ = (UniqueConstraint('user_id', 'code', name='uq_promocode_per_store'),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    code = Column(String, nullable=False)
    discount_type = Column(String, nullable=False)  # "percentage" or "fixed"
    discount_value = Column(Float, nullable=False)
    min_order_value = Column(Float, nullable=True)
    usage_limit = Column(Integer, nullable=True)   # null = unlimited
    used_count = Column(Integer, default=0)
    expiry_date = Column(DateTime, nullable=True)
    applies_to = Column(String, default="all")     # "all", "products", "packs"
    target_ids = Column(JSON, nullable=True)        # list of product/pack IDs
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


class Warehouse(Base):
    __tablename__ = "warehouses"

    id         = Column(Integer, primary_key=True, index=True)
    store_id   = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name       = Column(String, nullable=False)
    city       = Column(String, nullable=False)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    stock_entries = relationship("VariantStock", back_populates="warehouse", cascade="all, delete-orphan")


class VariantStock(Base):
    __tablename__ = "variant_stock"
    __table_args__ = (UniqueConstraint("variant_id", "warehouse_id", name="uq_variant_warehouse"),)

    id           = Column(Integer, primary_key=True, index=True)
    variant_id   = Column(Integer, ForeignKey("variants.id"), nullable=False, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False, index=True)
    quantity     = Column(Integer, default=0, nullable=False)

    warehouse = relationship("Warehouse", back_populates="stock_entries")
    variant   = relationship("Variant", back_populates="warehouse_stock")


class DeliveryCompanyPrice(Base):
    __tablename__ = "delivery_company_prices"
    __table_args__ = (UniqueConstraint("store_id", "company", "from_city", "to_city", name="uq_delivery_price"),)

    id           = Column(Integer, primary_key=True, index=True)
    store_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    company      = Column(String, nullable=False)   # "olivraison" | "forcelog"
    from_city    = Column(String, nullable=False)   # warehouse city (lowercase)
    to_city      = Column(String, nullable=False)   # destination city (lowercase)
    national_fee = Column(Float, nullable=False)
    local_fee    = Column(Float, nullable=True)     # same-city rate; NULL means use national_fee
    updated_at   = Column(DateTime, server_default=func.now())


class City(Base):
    __tablename__ = "cities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    delivery_fee = Column(Float, nullable=False)
    return_fee = Column(Float, nullable=False)
    is_casa = Column(Boolean, default=False)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    confirmed_by = Column(Integer, ForeignKey("team_members.id"), nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # which user uploaded this order
    caleo_id = Column(String, unique=True, nullable=True, index=True)
    customer_name = Column(String, nullable=False)
    customer_phone = Column(String, nullable=True)
    customer_address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    total_amount = Column(Float, nullable=False)
    status = Column(String, default="pending", index=True)
    order_date = Column(DateTime, nullable=True)
    reported_date = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    tracking_id = Column(String, nullable=True, index=True)
    delivery_status = Column(String, nullable=True)
    pack_id = Column(Integer, ForeignKey("packs.id"), nullable=True)
    offer_id = Column(Integer, ForeignKey("offers.id"), nullable=True)
    promo_code_used   = Column(String, nullable=True)
    discount_amount   = Column(Float, default=0)
    warehouse_id      = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    delivery_provider = Column(String, nullable=True)   # "olivraison" | "forcelog"
    created_at        = Column(DateTime, server_default=func.now())
    is_deleted        = Column(Boolean, default=False, nullable=False, server_default="0")
    deleted_at        = Column(DateTime, nullable=True)
    lead_id           = Column(Integer, ForeignKey("leads.id"), nullable=True)
    callback_time     = Column(DateTime, nullable=True)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    expenses = relationship("OrderExpense", back_populates="order", uselist=False, cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    variant_id = Column(Integer, ForeignKey("variants.id"), nullable=True)
    product_name = Column(String, nullable=False)
    size = Column(String, nullable=True)
    color = Column(String, nullable=True)
    quantity = Column(Integer, default=1)
    unit_cost = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=True)

    order = relationship("Order", back_populates="items")
    variant = relationship("Variant", back_populates="order_items")


class OrderExpense(Base):
    __tablename__ = "order_expenses"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), unique=True, nullable=False)
    sticker = Column(Float, default=0)
    seal_bag = Column(Float, default=0)
    packaging = Column(Float, default=1)
    delivery_fee = Column(Float, default=0)
    return_fee = Column(Float, default=0)
    seal_bag_returned = Column(Boolean, default=False)
    product_broken = Column(Boolean, default=False)

    order = relationship("Order", back_populates="expenses")


class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=True)
    payment_type = Column(String, nullable=False)  # monthly, per_order, both
    fixed_monthly = Column(Float, default=0)
    per_order_rate = Column(Float, default=0)
    is_confirmer = Column(Boolean, default=False)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    is_suspended = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class TeamMemberRateHistory(Base):
    __tablename__ = "team_member_rate_history"

    id             = Column(Integer, primary_key=True)
    team_member_id = Column(Integer, ForeignKey("team_members.id"))
    fixed_monthly  = Column(Float, nullable=True)
    per_order_rate = Column(Float, nullable=True)
    effective_from = Column(DateTime, nullable=False)
    effective_to   = Column(DateTime, nullable=True)
    created_at     = Column(DateTime, server_default=func.now())


class FixedExpense(Base):
    __tablename__ = "fixed_expenses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # monthly, annual, per_order, one_time
    category = Column(String, default="other")  # operations, packaging, platform, software, equipment, legal, marketing, other
    amount = Column(Float, nullable=False)
    description = Column(Text, nullable=True)
    start_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


class AdPlatform(Base):
    __tablename__ = "ad_platforms"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String, nullable=False)   # slug: "facebook", "tiktok", etc.
    label = Column(String, nullable=False)  # display: "Facebook / Meta"
    color = Column(String, default="#1877f2")
    created_at = Column(DateTime, server_default=func.now())

    campaigns = relationship("FacebookAd", back_populates="platform_obj", cascade="all, delete-orphan")


class FacebookAd(Base):
    __tablename__ = "facebook_ads"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    platform_id = Column(Integer, ForeignKey("ad_platforms.id"), nullable=True)
    platform = Column(String, default="facebook")  # kept for legacy/display
    daily_rate_usd = Column(Float, nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    platform_obj = relationship("AdPlatform", back_populates="campaigns")


class Withdrawal(Base):
    __tablename__ = "withdrawals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    amount = Column(Float, nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String, nullable=False)  # stock_purchase, manual
    date = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class StockArrival(Base):
    __tablename__ = "stock_arrivals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    variant_id = Column(Integer, ForeignKey("variants.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    additional_fees = Column(Float, default=0)
    description = Column(Text, nullable=True)
    total_cost = Column(Float, nullable=False)
    date = Column(DateTime, nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    idempotency_key = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, server_default=func.now())

    variant = relationship("Variant", back_populates="stock_arrivals")


class BrokenStock(Base):
    __tablename__ = "broken_stock"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    variant_id = Column(Integer, ForeignKey("variants.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    source = Column(String, nullable=False)  # "return" or "storage"
    source_order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    returnable_to_supplier = Column(Boolean, default=False)
    value_lost = Column(Float, default=0)
    date = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    variant = relationship("Variant", back_populates="broken_stock")


class AppSettings(Base):
    __tablename__ = "app_settings"
    __table_args__ = (UniqueConstraint('user_id', 'key', name='uq_appsettings_user_key'),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    key = Column(String, nullable=False)
    value = Column(String, nullable=True)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id            = Column(Integer, primary_key=True, index=True)
    store_id      = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    plan          = Column(String, default="free")    # "free", "monthly", "annual"
    status        = Column(String, default="active")  # "active", "inactive", "expired"
    start_date    = Column(DateTime, nullable=True)
    end_date      = Column(DateTime, nullable=True)
    notes         = Column(Text, nullable=True)
    needs_renewal = Column(Boolean, default=False)
    created_at    = Column(DateTime, server_default=func.now())


class Payment(Base):
    __tablename__ = "payments"

    id         = Column(Integer, primary_key=True, index=True)
    store_id   = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    amount     = Column(Float, nullable=False)
    plan       = Column(String, nullable=True)
    note       = Column(Text, nullable=True)
    date       = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class PlatformSettings(Base):
    __tablename__ = "platform_settings"

    id    = Column(Integer, primary_key=True, index=True)
    key   = Column(String, unique=True, nullable=False)
    value = Column(String, nullable=True)


class PlatformExpense(Base):
    __tablename__ = "platform_expenses"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String, nullable=False)
    category   = Column(String, default="other")   # hosting, domain, software, marketing, other
    amount     = Column(Float, nullable=False)
    currency   = Column(String, default="MAD")
    type       = Column(String, default="monthly")  # monthly, annual, one_time
    date       = Column(DateTime, nullable=False)
    note       = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class StoreApiKey(Base):
    __tablename__ = "store_api_keys"

    id                      = Column(Integer, primary_key=True)
    store_id                = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    key                     = Column(String, unique=True, nullable=False)
    previous_key            = Column(String, nullable=True)
    previous_key_expires_at = Column(DateTime, nullable=True)
    created_at              = Column(DateTime, server_default=func.now())


class ProductPriceHistory(Base):
    __tablename__ = "product_price_history"

    id                = Column(Integer, primary_key=True)
    variant_id        = Column(Integer, ForeignKey("variants.id"))
    old_selling_price = Column(Float)
    new_selling_price = Column(Float)
    old_buying_price  = Column(Float)
    new_buying_price  = Column(Float)
    changed_at        = Column(DateTime, server_default=func.now())
    changed_by        = Column(Integer, ForeignKey("users.id"), nullable=True)


class BotApiKey(Base):
    __tablename__ = "bot_api_keys"

    id         = Column(Integer, primary_key=True)
    store_id   = Column(Integer, ForeignKey("users.id"), unique=True)
    key        = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class Supplier(Base):
    __tablename__ = "suppliers"
    __table_args__ = (UniqueConstraint('user_id', 'name', name='uq_supplier_name_per_store'),)

    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name       = Column(String, nullable=False)
    phone      = Column(String, nullable=True)
    platform   = Column(String, nullable=True)
    notes      = Column(Text, nullable=True)
    is_active  = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class SupplierPayment(Base):
    __tablename__ = "supplier_payments"

    id          = Column(Integer, primary_key=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False, index=True)
    amount      = Column(Float, nullable=False)
    date        = Column(DateTime, nullable=False)
    note        = Column(Text, nullable=True)
    created_at  = Column(DateTime, server_default=func.now())


class Lead(Base):
    __tablename__ = "leads"

    id               = Column(Integer, primary_key=True)
    store_id         = Column(Integer, ForeignKey("users.id"), nullable=False)
    customer_name    = Column(String, nullable=False)
    customer_phone   = Column(String, nullable=False)
    customer_email   = Column(String, nullable=True)
    customer_city    = Column(String, nullable=True)
    customer_address = Column(String, nullable=True)
    raw_items        = Column(JSON)          # [{"product_name": "...", "quantity": 1}]
    matched_items    = Column(JSON, nullable=True)  # [{variant_id, name, qty, price}]
    total_amount     = Column(Float, nullable=True)
    notes            = Column(Text, nullable=True)
    status           = Column(String, default="pending")  # pending|confirmed|cancelled|unresponsive|reported
    source           = Column(String, nullable=True, default="website")
    order_id         = Column(Integer, ForeignKey("orders.id"), nullable=True)
    reported_date    = Column(DateTime, nullable=True)
    last_message_at  = Column(DateTime, nullable=True)
    created_at       = Column(DateTime, server_default=func.now())


class CampaignConnection(Base):
    __tablename__ = "campaign_connections"

    id               = Column(Integer, primary_key=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    platform         = Column(String, nullable=True, default="meta")   # "meta", "tiktok", etc.
    meta_campaign_id = Column(String, nullable=True)                   # Meta / platform campaign ID string
    campaign_name    = Column(String, nullable=True)
    item_type        = Column(String, nullable=False)                  # "product", "pack", "offer"
    item_id          = Column(Integer, nullable=False)
    delivery_cost    = Column(Float, nullable=True, default=None)
    created_at       = Column(DateTime, server_default=func.now())
