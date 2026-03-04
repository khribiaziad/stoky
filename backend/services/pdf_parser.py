import re
import pdfplumber
from datetime import datetime
from typing import Optional


# ── City normalization ────────────────────────────────────────────────────────

CITY_ALIASES = {
    "tangier": "Tanger", "tanger": "Tanger",
    "casablanca": "Casablanca", "casa": "Casablanca", "dar el beida": "Casablanca",
    "rabat": "Rabat",
    "sale": "Sale", "salé": "Sale",
    "fes": "Fes", "fès": "Fes",
    "meknes": "Meknes", "meknès": "Meknes",
    "marrakech": "Marrakech", "marrakesh": "Marrakech",
    "agadir": "Agadir",
    "oujda": "Oujda",
    "kenitra": "Kenitra", "kénitra": "Kenitra",
    "tetouan": "Tetouan", "tétouan": "Tetouan",
    "beni mellal": "Beni Mellal", "beni-mellal": "Beni Mellal", "benimelal": "Beni Mellal",
    "al hoceima": "Al Hoceima", "al-hoceima": "Al Hoceima", "alhoceima": "Al Hoceima",
    "kalaat sraghna": "Kalaat Sraghna",
    "el kelaa des sraghna": "El Kelaa Des Sraghna",
    "safi": "Safi",
    "essaouira": "Essaouira",
    "nador": "Nador",
    "el jadida": "El Jadida",
    "khouribga": "Khouribga",
    "settat": "Settat",
    "larache": "Larache",
    "guelmim": "Guelmim",
    "dakhla": "Dakhla",
    "laayoune": "Laayoune",
    "errachidia": "Errachidia",
    "ouarzazate": "Ouarzazate",
    "ifrane": "Ifrane",
    "khemisset": "Khemisset",
    "berrechid": "Berrechid",
    "mohammedia": "Mohammedia",
    "temara": "Temara",
    "skhirat": "Skhirat",
    "taza": "Taza",
    "berkane": "Berkane",
    "taourirt": "Taourirt",
}


def normalize_city(city_name: str) -> str:
    if not city_name:
        return ""
    key = city_name.strip().lower()
    # Exact alias match
    if key in CITY_ALIASES:
        return CITY_ALIASES[key]
    # Partial match: if a known city appears within the string
    for alias, canonical in CITY_ALIASES.items():
        if alias in key:
            return canonical
    return city_name.strip().title()


def parse_date(date_str: str) -> Optional[datetime]:
    if not date_str:
        return None
    for fmt in ["%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"]:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    return None


# ── Generic field extractors ──────────────────────────────────────────────────

def _extract_order_id(text: str) -> str:
    """Try multiple patterns to find a tracking / order ID."""
    patterns = [
        r'(CMD-\d+-ST-\d+)',                        # Caleo
        r'(OD[-_]?\d{5,})',                          # Odelivery guess
        r'(AM[-_]?\d{5,})',                          # Amana guess
        r'(MS[-_]?\d{5,})',                          # Maystro guess
        # Generic: labeled reference
        r'(?:ref(?:érence)?|id|n[°o]|num(?:éro)?|code|tracking|colis|bon(?:\s+de\s+livraison)?|commande)\s*[:#\s]\s*([A-Z0-9][-A-Z0-9]{4,})',
        # Generic: uppercase letters + digits (e.g. "BL123456", "WB-987654")
        r'\b([A-Z]{1,5}[-_]?\d{5,})\b',
        # Last resort: a standalone long number that looks like a barcode
        r'\b(\d{8,14})\b',
    ]
    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return ""


def _extract_phone(text: str) -> str:
    """Extract a Moroccan phone number from text.

    Searches the recipient section first to avoid returning the sender's phone,
    which is the same on every page and often appears before the customer's number.
    """
    # Narrow down to the recipient section when possible
    dest_section = re.search(
        r'(?:destinataire|client|b[ée]n[ée]ficiaire|recipient|المستلم).*?(?=exp[ée]diteur|envoyeur|$)',
        text, re.IGNORECASE | re.DOTALL
    )
    search_text = dest_section.group(0) if dest_section else text

    # Try labeled field in recipient section first, then full text
    for search in ([search_text, text] if dest_section else [text]):
        labeled = re.search(
            r'(?:t[ée]l(?:[ée]phone)?|phone|mobile|portable|gsm|هاتف|رقم(?:\s+الهاتف)?|tel)\s*[:#\s]?\s*(\+?[\d\s\.\-]{9,16})',
            search, re.IGNORECASE
        )
        if labeled:
            phone = re.sub(r'[\s\.\-]', '', labeled.group(1))
            if re.match(r'^(\+?212|00212)?[067]\d{8}$', phone):
                return phone

    # Raw Moroccan phone — prefer within recipient section
    for search in ([search_text, text] if dest_section else [text]):
        clean = re.sub(r'[\s\.\-]', '', search)
        m = re.search(r'(\+?212[67]\d{8}|00212[67]\d{8}|0[67]\d{8})', clean)
        if m:
            return m.group(1)

    return ""


def _extract_amount(text: str) -> float:
    """Extract the COD / total amount."""
    # Labeled (many variations across companies and languages)
    labeled = re.search(
        r'(?:total(?:\s+(?:à|a)\s+(?:payer|percevoir))?|montant(?:\s+(?:total|cod|à\s+payer))?|'
        r'amount|cod|prix|valeur|مبلغ|الثمن|prix\s+de\s+vente|contre\s+remboursement)\s*[:#]?\s*'
        r'(\d+(?:[.,]\d{1,2})?)\s*(?:dhs?|mad|درهم|dh)?',
        text, re.IGNORECASE
    )
    if labeled:
        return float(labeled.group(1).replace(',', '.'))

    # Number immediately followed by currency
    m = re.search(r'(\d+(?:[.,]\d{1,2})?)\s*(?:dhs?|mad|درهم)\b', text, re.IGNORECASE)
    if m:
        return float(m.group(1).replace(',', '.'))

    return 0.0


def _extract_city(text: str) -> str:
    """Extract the delivery city."""
    # Labeled field (FR/EN/AR)
    labeled = re.search(
        r'(?:ville(?:\s+de\s+(?:livraison|destination))?|city|destination|wilaya|مدينة|المدينة)\s*[:#]?\s*([^\n\r,]{2,40})',
        text, re.IGNORECASE
    )
    if labeled:
        candidate = labeled.group(1).strip()
        normalized = normalize_city(candidate)
        if normalized:
            return normalized

    # Scan the whole text for a known city name
    text_lower = text.lower()
    # Sort aliases by length desc to match longer names first
    for alias in sorted(CITY_ALIASES, key=len, reverse=True):
        if re.search(r'\b' + re.escape(alias) + r'\b', text_lower):
            return CITY_ALIASES[alias]

    return ""


def _extract_name(text: str) -> str:
    """Extract the customer / recipient name."""
    labeled = re.search(
        r'(?:destinataire|client|nom(?:\s+(?:et\s+)?pr[ée]nom)?|name|recipient|'
        r'b[ée]n[ée]ficiaire|acheteur|المستلم|اسم(?:\s+العميل)?)\s*[:#]?\s*([^\n\r]{2,60})',
        text, re.IGNORECASE
    )
    if labeled:
        name = labeled.group(1).strip()
        # Remove trailing noise (phone numbers, IDs that leaked in)
        name = re.sub(r'\s+\d{6,}.*$', '', name)
        name = re.sub(r'\s{2,}', ' ', name).strip()
        if 2 < len(name) < 60:
            return name
    return ""


def _extract_address(text: str) -> str:
    """Extract the delivery address."""
    m = re.search(
        r'(?:adresse(?:\s+de\s+livraison)?|address|عنوان(?:\s+التوصيل)?)\s*[:#]?\s*([^\n\r]{4,120})',
        text, re.IGNORECASE
    )
    if m:
        return m.group(1).strip()
    return ""


def _extract_date(text: str) -> datetime:
    """Extract a date, fall back to now."""
    m = re.search(r'(\d{1,2}[/\-]\d{1,2}[/\-]\d{4})', text)
    if m:
        parsed = parse_date(m.group(1).replace('-', '/'))
        if parsed:
            return parsed
    m2 = re.search(r'(\d{4}[/\-]\d{2}[/\-]\d{2})', text)
    if m2:
        parsed = parse_date(m2.group(1).replace('-', '/'))
        if parsed:
            return parsed
    return datetime.now()


# ── Odelivery-specific parser ─────────────────────────────────────────────────

def _detect_odelivery_exchange(page) -> bool:
    """
    Detect the Odelivery ECHANGE stamp by looking for an extra image
    at the bottom of the page (top > 600). Normal pages have 3 images;
    exchange pages have 4, the 4th being the ECHANGE stamp at the bottom-left.
    """
    bottom_images = [img for img in page.images if img['top'] > 600]
    return len(bottom_images) > 0


def _parse_odelivery_page(text: str) -> Optional[dict]:
    """
    Parse a single Odelivery (Olivraison) shipment label page.

    Format per page:
        Olivraison
        +212.520.015.583
        Date: YYYY-MM-DD
        Destinataire
        CITY
        HUB CITY_CODE NAME
        CUSTOMER_NAME
        ADDRESS
        Tél: PHONE
        CRBT: C/Espèce #ORDER_ID
        AMOUNT DH
        Expéditeur
        ...
        Nature: CODE
    """
    if 'olivraison' not in text.lower() and 'odelivery' not in text.lower():
        return None

    lines = [l.strip() for l in text.splitlines() if l.strip()]

    # Order ID — after '#' in the CRBT line
    order_id = ""
    crbt_match = re.search(r'#([A-Z0-9]+)', text)
    if crbt_match:
        order_id = crbt_match.group(1)

    # Amount — number before DH
    amount = 0.0
    amount_match = re.search(r'(\d+(?:[.,]\d+)?)\s*DH\b', text, re.IGNORECASE)
    if amount_match:
        amount = float(amount_match.group(1).replace(',', '.'))

    # Phone — Tél: line (skip the company phone at the top)
    phone = ""
    for m in re.finditer(r'Tél\s*[:\s]\s*(\+?[\d\s]{9,15})', text, re.IGNORECASE):
        candidate = re.sub(r'\s', '', m.group(1))
        # Skip the Odelivery company number (+212520015583)
        if '520015583' not in candidate:
            phone = candidate
            break

    # Date
    order_date = datetime.now()
    date_match = re.search(r'Date\s*[:\s]*(\d{4}-\d{2}-\d{2})', text, re.IGNORECASE)
    if date_match:
        parsed = parse_date(date_match.group(1))
        if parsed:
            order_date = parsed

    # City, hub, customer name, address — parsed from line structure
    city = ""
    customer_name = ""
    customer_address = ""

    try:
        # Find "Destinataire" line index
        dest_idx = next(i for i, l in enumerate(lines) if 'destinataire' in l.lower())
        # City is the next line after Destinataire
        city_raw = lines[dest_idx + 1] if dest_idx + 1 < len(lines) else ""
        city = normalize_city(city_raw)
        # HUB line is dest_idx + 2 (starts with "HUB")
        hub_idx = dest_idx + 2
        # Customer name is the line after HUB
        name_idx = hub_idx + 1
        if name_idx < len(lines):
            candidate = lines[name_idx]
            # Sanity: name shouldn't look like a phone, amount, or URL
            if not re.match(r'^[\d\+\.]', candidate) and 'http' not in candidate.lower():
                customer_name = candidate
        # Address is the line after the customer name
        addr_idx = name_idx + 1
        if addr_idx < len(lines):
            candidate = lines[addr_idx]
            if not re.match(r'^Tél', candidate, re.IGNORECASE):
                customer_address = candidate
    except StopIteration:
        pass

    if not order_id or amount <= 0:
        return None

    return {
        "caleo_id": order_id,
        "customer_name": customer_name,
        "customer_phone": phone,
        "customer_address": customer_address,
        "city": city,
        "total_amount": amount,
        "order_date": order_date.isoformat(),
    }


# ── Caleo-specific parser (preserved for accuracy) ────────────────────────────

def _parse_caleo_page(text: str) -> Optional[dict]:
    """Parse a single page using Caleo-specific patterns."""
    cmd_match = re.search(r'(CMD-\d+-ST-\d+)', text)
    if not cmd_match:
        return None

    caleo_id = cmd_match.group(1)

    name_match = re.search(r'Destinataire\s*[:\s]+([^\n\r]+)', text, re.IGNORECASE)
    customer_name = name_match.group(1).strip() if name_match else ""

    # Extract phone from the Destinataire section only, to avoid picking up the
    # sender's phone (which is the same on every page and comes first in many layouts).
    dest_section = re.search(r'Destinataire.*?(?=Exp[ée]diteur|$)', text, re.IGNORECASE | re.DOTALL)
    phone_search_text = dest_section.group(0) if dest_section else text
    phone_match = re.search(r't[ée]l[ée]phone\s*[:\s]*(\+?\d[\d\s\-]{7,})', phone_search_text, re.IGNORECASE)
    customer_phone = re.sub(r'\s+', '', phone_match.group(1)).strip() if phone_match else ""

    city_match = re.search(r'Ville\s*[:\s]+([^\n\r]+)', text, re.IGNORECASE)
    city = normalize_city(city_match.group(1).strip()) if city_match else ""

    addr_match = re.search(r'Adresse\s*[:\s]+([^\n\r]+)', text, re.IGNORECASE)
    customer_address = addr_match.group(1).strip() if addr_match else ""

    total_match = re.search(r'Total\s*[:\s]*(\d+(?:\.\d+)?)\s*(?:Dhs|MAD|dhs|mad)', text, re.IGNORECASE)
    total_amount = float(total_match.group(1)) if total_match else 0.0

    order_date = _extract_date(text)

    if caleo_id and customer_name and total_amount > 0:
        return {
            "caleo_id": caleo_id,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "customer_address": customer_address,
            "city": city,
            "total_amount": total_amount,
            "order_date": order_date.isoformat(),
        }
    return None


# ── Generic parser ────────────────────────────────────────────────────────────

def _parse_generic_page(text: str, page_index: int) -> Optional[dict]:
    """Parse a single page using generic heuristics."""
    order_id   = _extract_order_id(text)
    name       = _extract_name(text)
    phone      = _extract_phone(text)
    city       = _extract_city(text)
    address    = _extract_address(text)
    amount     = _extract_amount(text)
    order_date = _extract_date(text)

    # Need at minimum a name + amount (or an ID + amount) to consider it a valid order
    has_enough = (name and amount > 0) or (order_id and amount > 0)
    if not has_enough:
        return None

    # Fallback ID if nothing was detected
    if not order_id:
        order_id = f"ORD-{datetime.now().strftime('%Y%m%d')}-{page_index + 1:03d}"

    return {
        "caleo_id": order_id,        # field reused as generic "tracking_id"
        "customer_name": name,
        "customer_phone": phone,
        "customer_address": address,
        "city": city,
        "total_amount": amount,
        "order_date": order_date.isoformat(),
    }


# ── Public API ────────────────────────────────────────────────────────────────

def parse_pickup_pdf(filepath: str) -> list[dict]:
    """
    Parse a pickup PDF from any delivery company.
    Tries Caleo-specific parsing first; falls back to generic heuristics.
    Returns a list of order dicts.
    """
    caleo_orders   = []
    generic_orders = []

    with pdfplumber.open(filepath) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()
            if not text:
                continue

            # Try Caleo first
            caleo = _parse_caleo_page(text)
            if caleo:
                caleo_orders.append(caleo)
                continue

            # Try Odelivery
            odelivery = _parse_odelivery_page(text)
            if odelivery:
                generic_orders.append(odelivery)
                continue

            # Generic fallback
            generic = _parse_generic_page(text, i)
            if generic:
                generic_orders.append(generic)

    # Prefer Caleo results if any were found; otherwise return generic/odelivery
    return caleo_orders if caleo_orders else generic_orders


def parse_return_pdf(filepath: str) -> list[str]:
    """
    Parse a return PDF and extract order/tracking IDs.
    Tries Caleo CMD-IDs first, then generic IDs.
    """
    ids = []

    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue

            # Caleo
            caleo_ids = re.findall(r'CMD-\d+-ST-\d+', text)
            if caleo_ids:
                ids.extend(caleo_ids)
                continue

            # Generic: find anything that looks like a tracking ID
            generic = re.findall(
                r'\b(?:[A-Z]{1,6}[-_]?\d{5,}|\d{8,14})\b',
                text
            )
            ids.extend(generic)

    return list(dict.fromkeys(ids))  # deduplicate, preserve order
