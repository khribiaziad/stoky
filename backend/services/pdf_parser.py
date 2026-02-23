import re
import pdfplumber
from datetime import datetime
from typing import Optional


# City name normalizations (handle variations from PDFs)
CITY_ALIASES = {
    "tangier": "Tanger",
    "tanger": "Tanger",
    "casablanca": "Casablanca",
    "casa": "Casablanca",
    "rabat": "Rabat",
    "sale": "Sale",
    "salé": "Sale",
    "fes": "Fes",
    "fès": "Fes",
    "meknes": "Meknes",
    "meknès": "Meknes",
    "marrakech": "Marrakech",
    "marrakesh": "Marrakech",
    "agadir": "Agadir",
    "oujda": "Oujda",
    "kenitra": "Kenitra",
    "kénitra": "Kenitra",
    "tetouan": "Tetouan",
    "tétouan": "Tetouan",
    "beni mellal": "Beni Mellal",
    "beni-mellal": "Beni Mellal",
    "al hoceima": "Al Hoceima",
    "al-hoceima": "Al Hoceima",
    "kalaat sraghna": "Kalaat Sraghna",
    "el kelaa des sraghna": "El Kelaa Des Sraghna",
}


def normalize_city(city_name: str) -> str:
    """Normalize city name to match database entries."""
    if not city_name:
        return ""
    key = city_name.strip().lower()
    return CITY_ALIASES.get(key, city_name.strip().title())


def parse_date(date_str: str) -> Optional[datetime]:
    """Parse date from Caleo PDF format (M/D/YYYY or DD/MM/YYYY)."""
    if not date_str:
        return None
    formats = ["%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%d"]
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    return None


def parse_pickup_pdf(filepath: str) -> list[dict]:
    """
    Parse Caleo Pickup Parcels PDF and extract order data.
    Returns a list of order dicts.
    """
    orders = []

    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue

            # Look for CMD-ID on this page
            cmd_match = re.search(r'(CMD-\d+-ST-\d+)', text)
            if not cmd_match:
                continue

            caleo_id = cmd_match.group(1)

            # Extract customer name (Destinataire field)
            customer_name = ""
            name_match = re.search(r'Destinataire\s*[:\s]+([^\n\r]+)', text, re.IGNORECASE)
            if name_match:
                customer_name = name_match.group(1).strip()

            # Extract phone
            customer_phone = ""
            phone_match = re.search(r't[ée]l[ée]phone\s*[:\s]*(\+?\d[\d\s\-]{7,})', text, re.IGNORECASE)
            if phone_match:
                customer_phone = re.sub(r'\s+', '', phone_match.group(1)).strip()

            # Extract city
            city = ""
            city_match = re.search(r'Ville\s*[:\s]+([^\n\r]+)', text, re.IGNORECASE)
            if city_match:
                city = normalize_city(city_match.group(1).strip())

            # Extract address
            customer_address = ""
            addr_match = re.search(r'Adresse\s*[:\s]+([^\n\r]+)', text, re.IGNORECASE)
            if addr_match:
                customer_address = addr_match.group(1).strip()

            # Extract total amount (e.g., "99Dhs" or "99 MAD")
            total_amount = 0
            total_match = re.search(r'Total\s*[:\s]*(\d+(?:\.\d+)?)\s*(?:Dhs|MAD|dhs|mad)', text, re.IGNORECASE)
            if total_match:
                total_amount = float(total_match.group(1))

            # Extract date
            order_date = datetime.now()
            date_match = re.search(r'(\d{1,2}/\d{1,2}/\d{4})', text)
            if date_match:
                parsed = parse_date(date_match.group(1))
                if parsed:
                    order_date = parsed

            # Only include if we have minimum required data
            if caleo_id and customer_name and total_amount > 0:
                orders.append({
                    "caleo_id": caleo_id,
                    "customer_name": customer_name,
                    "customer_phone": customer_phone,
                    "customer_address": customer_address,
                    "city": city,
                    "total_amount": total_amount,
                    "order_date": order_date.isoformat(),
                })

    return orders


def parse_return_pdf(filepath: str) -> list[str]:
    """
    Parse Caleo Return PDF and extract CMD-IDs.
    Returns a list of CMD-ID strings.
    """
    cmd_ids = []

    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
            matches = re.findall(r'CMD-\d+-ST-\d+', text)
            cmd_ids.extend(matches)

    return list(set(cmd_ids))  # deduplicate
