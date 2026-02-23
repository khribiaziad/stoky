"""Run on startup to seed/update the cities table (upsert logic)."""
from database import SessionLocal, engine
import models

models.Base.metadata.create_all(bind=engine)

CITIES = [
    # ── CASABLANCA METRO (delivery: 20, return: 3) ─────────────────────────
    {"name": "Casablanca",          "delivery_fee": 20, "return_fee": 3, "is_casa": True},
    {"name": "Mohammedia",          "delivery_fee": 20, "return_fee": 3, "is_casa": True},
    {"name": "Dar Bouazza",         "delivery_fee": 20, "return_fee": 3, "is_casa": True},
    {"name": "Bouskoura",           "delivery_fee": 20, "return_fee": 3, "is_casa": True},
    {"name": "Tit Mellil",          "delivery_fee": 20, "return_fee": 3, "is_casa": True},
    {"name": "Mediouna",            "delivery_fee": 20, "return_fee": 3, "is_casa": True},
    {"name": "Nouaceur",            "delivery_fee": 20, "return_fee": 3, "is_casa": True},
    {"name": "Sbata",               "delivery_fee": 20, "return_fee": 3, "is_casa": True},
    {"name": "Ain Sebaa",           "delivery_fee": 20, "return_fee": 3, "is_casa": True},
    {"name": "Sidi Bernoussi",      "delivery_fee": 20, "return_fee": 3, "is_casa": True},
    {"name": "Sidi Maarouf",        "delivery_fee": 20, "return_fee": 3, "is_casa": True},
    {"name": "Lahraouiyine",        "delivery_fee": 20, "return_fee": 3, "is_casa": True},
    {"name": "Oulfa",               "delivery_fee": 20, "return_fee": 3, "is_casa": True},
    # ── CASABLANCA-SETTAT PERIPHERY (delivery: 25-30) ─────────────────────
    {"name": "Had Soualem",         "delivery_fee": 25, "return_fee": 3, "is_casa": False},
    {"name": "Ouled Saleh",         "delivery_fee": 25, "return_fee": 3, "is_casa": False},
    {"name": "Bouznika",            "delivery_fee": 30, "return_fee": 5, "is_casa": False},
    {"name": "Benslimane",          "delivery_fee": 30, "return_fee": 5, "is_casa": False},
    {"name": "Berrechid",           "delivery_fee": 30, "return_fee": 5, "is_casa": False},
    {"name": "Ben Ahmed",           "delivery_fee": 35, "return_fee": 5, "is_casa": False},
    {"name": "Settat",              "delivery_fee": 35, "return_fee": 5, "is_casa": False},
    {"name": "El Jadida",           "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Azemmour",            "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Sidi Bennour",        "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Khouribga",           "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Oued Zem",            "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Bejaad",              "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "El Borouj",           "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    # ── RABAT-SALE-KENITRA (delivery: 35, return: 5) ──────────────────────
    {"name": "Rabat",               "delivery_fee": 35, "return_fee": 5, "is_casa": False},
    {"name": "Sale",                "delivery_fee": 35, "return_fee": 5, "is_casa": False},
    {"name": "Temara",              "delivery_fee": 35, "return_fee": 5, "is_casa": False},
    {"name": "Skhirat",             "delivery_fee": 35, "return_fee": 5, "is_casa": False},
    {"name": "Kenitra",             "delivery_fee": 35, "return_fee": 5, "is_casa": False},
    {"name": "Khemisset",           "delivery_fee": 35, "return_fee": 5, "is_casa": False},
    {"name": "Sidi Slimane",        "delivery_fee": 35, "return_fee": 5, "is_casa": False},
    {"name": "Sidi Kacem",          "delivery_fee": 35, "return_fee": 5, "is_casa": False},
    {"name": "Tiflet",              "delivery_fee": 35, "return_fee": 5, "is_casa": False},
    {"name": "Souk El Arbaa",       "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Mechra Bel Ksiri",    "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Sidi Yahia El Gharb", "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Moulay Bousselham",   "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Jorf El Melha",       "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    # ── MARRAKECH-SAFI ─────────────────────────────────────────────────────
    {"name": "Marrakech",           "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Safi",                "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Essaouira",           "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "El Kelaa Des Sraghna","delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Youssoufia",          "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Chichaoua",           "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Imintanoute",         "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Tahannaout",          "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Amizmiz",             "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Benguerir",           "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Ait Ourir",           "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Ourika",              "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    # ── FES-MEKNES ─────────────────────────────────────────────────────────
    {"name": "Fes",                 "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Meknes",              "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Ifrane",              "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Azrou",               "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Hajeb",               "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Sefrou",              "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Imouzzer Kandar",     "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Moulay Yacoub",       "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Taza",                "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Missour",             "delivery_fee": 40, "return_fee": 7, "is_casa": False},
    {"name": "Ain Leuh",            "delivery_fee": 40, "return_fee": 7, "is_casa": False},
    {"name": "El Hajeb",            "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Ain Taoujdate",       "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Bhalil",              "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Boulmane",            "delivery_fee": 40, "return_fee": 7, "is_casa": False},
    # ── TANGER-TETOUAN-AL HOCEIMA ──────────────────────────────────────────
    {"name": "Tanger",              "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Tangier",             "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Tetouan",             "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Al Hoceima",          "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Larache",             "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Ksar El Kebir",       "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Chefchaouen",         "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Asilah",              "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Fnideq",              "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Martil",              "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "M'diq",               "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Ouezzane",            "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Bab Berred",          "delivery_fee": 40, "return_fee": 7, "is_casa": False},
    {"name": "Imzouren",            "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Targuist",            "delivery_fee": 40, "return_fee": 7, "is_casa": False},
    {"name": "Bni Bouayach",        "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Torres de Alcala",    "delivery_fee": 40, "return_fee": 7, "is_casa": False},
    # ── ORIENTAL ───────────────────────────────────────────────────────────
    {"name": "Oujda",               "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Nador",               "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Berkane",             "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Taourirt",            "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Jerada",              "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Guercif",             "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Driouch",             "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Zaio",                "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Ahfir",               "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Saïdia",              "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Aïn Bni Mathar",      "delivery_fee": 40, "return_fee": 7, "is_casa": False},
    {"name": "Debdou",              "delivery_fee": 40, "return_fee": 7, "is_casa": False},
    {"name": "Figuig",              "delivery_fee": 50, "return_fee": 10, "is_casa": False},
    # ── SOUSS-MASSA ────────────────────────────────────────────────────────
    {"name": "Agadir",              "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Inezgane",            "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Tiznit",              "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Taroudant",           "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Ouarzazate",          "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Zagora",              "delivery_fee": 40, "return_fee": 10, "is_casa": False},
    {"name": "Ait Melloul",         "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Biougra",             "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Chtouka Ait Baha",    "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Tafraout",            "delivery_fee": 40, "return_fee": 10, "is_casa": False},
    {"name": "Oulad Teima",         "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Aourir",              "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Dcheira El Jihadia",  "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Ait Baha",            "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Massa",               "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Sidi Ifni",           "delivery_fee": 40, "return_fee": 10, "is_casa": False},
    # ── BENI MELLAL-KHENIFRA ───────────────────────────────────────────────
    {"name": "Beni Mellal",         "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Khenifra",            "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Fquih Ben Salah",     "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Azilal",              "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Kasba Tadla",         "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Souk Sebt Oulad Nemma","delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Demnate",             "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Ouaouizaght",         "delivery_fee": 40, "return_fee": 7, "is_casa": False},
    {"name": "Timoulilt",           "delivery_fee": 40, "return_fee": 7, "is_casa": False},
    # ── DRAA-TAFILALET ─────────────────────────────────────────────────────
    {"name": "Errachidia",          "delivery_fee": 40, "return_fee": 10, "is_casa": False},
    {"name": "Midelt",              "delivery_fee": 40, "return_fee": 10, "is_casa": False},
    {"name": "Tinghir",             "delivery_fee": 40, "return_fee": 10, "is_casa": False},
    {"name": "Rich",                "delivery_fee": 40, "return_fee": 10, "is_casa": False},
    {"name": "Goulmima",            "delivery_fee": 40, "return_fee": 10, "is_casa": False},
    {"name": "Erfoud",              "delivery_fee": 40, "return_fee": 10, "is_casa": False},
    {"name": "Rissani",             "delivery_fee": 40, "return_fee": 10, "is_casa": False},
    {"name": "Boumalne Dades",      "delivery_fee": 40, "return_fee": 10, "is_casa": False},
    {"name": "Kelaat M'Gouna",      "delivery_fee": 40, "return_fee": 10, "is_casa": False},
    {"name": "Kalaat Sraghna",      "delivery_fee": 35, "return_fee": 7, "is_casa": False},
    {"name": "Alnif",               "delivery_fee": 45, "return_fee": 10, "is_casa": False},
    {"name": "Tinjdad",             "delivery_fee": 40, "return_fee": 10, "is_casa": False},
    # ── GUELMIM-OUED NOUN ──────────────────────────────────────────────────
    {"name": "Guelmim",             "delivery_fee": 40, "return_fee": 10, "is_casa": False},
    {"name": "Tan-Tan",             "delivery_fee": 45, "return_fee": 10, "is_casa": False},
    {"name": "Assa",                "delivery_fee": 45, "return_fee": 10, "is_casa": False},
    {"name": "Zag",                 "delivery_fee": 50, "return_fee": 15, "is_casa": False},
    {"name": "Sidi Ifni",           "delivery_fee": 40, "return_fee": 10, "is_casa": False},
    {"name": "Bouizakarne",         "delivery_fee": 40, "return_fee": 10, "is_casa": False},
    # ── LAAYOUNE-SAKIA EL HAMRA ────────────────────────────────────────────
    {"name": "Laayoune",            "delivery_fee": 50, "return_fee": 15, "is_casa": False},
    {"name": "Boujdour",            "delivery_fee": 55, "return_fee": 15, "is_casa": False},
    {"name": "Smara",               "delivery_fee": 50, "return_fee": 15, "is_casa": False},
    {"name": "Tarfaya",             "delivery_fee": 55, "return_fee": 15, "is_casa": False},
    # ── DAKHLA-OUED ED DAHAB ───────────────────────────────────────────────
    {"name": "Dakhla",              "delivery_fee": 60, "return_fee": 20, "is_casa": False},
    {"name": "Aousserd",            "delivery_fee": 65, "return_fee": 20, "is_casa": False},
]

# Deduplicate by name (keep last occurrence)
_seen = {}
for c in CITIES:
    _seen[c["name"]] = c
CITIES = list(_seen.values())


def seed():
    db = SessionLocal()
    added = 0
    updated = 0
    for city_data in CITIES:
        existing = db.query(models.City).filter(models.City.name == city_data["name"]).first()
        if existing:
            existing.delivery_fee = city_data["delivery_fee"]
            existing.return_fee = city_data["return_fee"]
            existing.is_casa = city_data["is_casa"]
            updated += 1
        else:
            db.add(models.City(**city_data))
            added += 1
    db.commit()
    print(f"Cities: {added} added, {updated} updated.")
    db.close()


if __name__ == "__main__":
    seed()
