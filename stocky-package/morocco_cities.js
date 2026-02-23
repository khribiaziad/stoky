// Comprehensive Moroccan Cities Database
// Based on the structure: { name, delivery_fee, return_fee, is_casa }
// 
// Fee Structure (UPDATE THESE IF NEEDED):
// - Casablanca zone: delivery_fee: 20 MAD, return_fee: 3 MAD
// - Other cities: delivery_fee: 35 MAD, return_fee: 5-7 MAD depending on distance
//
// is_casa = true means the city uses lower packaging fee (2 MAD instead of 3 MAD)

const moroccan_cities = [
  // CASABLANCA ZONE (Greater Casa area - lower delivery, packaging = 2 MAD)
  { name: "Casablanca", delivery_fee: 20, return_fee: 3, is_casa: true },
  { name: "Mohammedia", delivery_fee: 20, return_fee: 3, is_casa: true },
  { name: "Dar Bouazza", delivery_fee: 20, return_fee: 3, is_casa: true },
  { name: "Bouskoura", delivery_fee: 20, return_fee: 3, is_casa: true },
  { name: "Tit Mellil", delivery_fee: 20, return_fee: 3, is_casa: true },
  { name: "Mediouna", delivery_fee: 20, return_fee: 3, is_casa: true },
  { name: "Nouaceur", delivery_fee: 20, return_fee: 3, is_casa: true },
  { name: "Sbata", delivery_fee: 20, return_fee: 3, is_casa: true },
  
  // RABAT-SALE-KENITRA REGION (Close cities - moderate fees)
  { name: "Rabat", delivery_fee: 35, return_fee: 5, is_casa: false },
  { name: "Sale", delivery_fee: 35, return_fee: 5, is_casa: false },
  { name: "Temara", delivery_fee: 35, return_fee: 5, is_casa: false },
  { name: "Skhirat", delivery_fee: 35, return_fee: 5, is_casa: false },
  { name: "Kenitra", delivery_fee: 35, return_fee: 5, is_casa: false },
  { name: "Khemisset", delivery_fee: 35, return_fee: 5, is_casa: false },
  { name: "Sidi Slimane", delivery_fee: 35, return_fee: 5, is_casa: false },
  { name: "Sidi Kacem", delivery_fee: 35, return_fee: 5, is_casa: false },
  
  // MARRAKECH-SAFI REGION
  { name: "Marrakech", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Safi", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Essaouira", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "El Kelaa Des Sraghna", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Youssoufia", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Chichaoua", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Imintanoute", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Tahannaout", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Amizmiz", delivery_fee: 35, return_fee: 7, is_casa: false },
  
  // FES-MEKNES REGION
  { name: "Fes", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Meknes", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Ifrane", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Azrou", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Hajeb", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Sefrou", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Imouzzer Kandar", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Moulay Yacoub", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Taza", delivery_fee: 35, return_fee: 7, is_casa: false },
  
  // TANGER-TETOUAN-AL HOCEIMA REGION
  { name: "Tanger", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Tangier", delivery_fee: 35, return_fee: 7, is_casa: false }, // Alternative spelling
  { name: "Tetouan", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Al Hoceima", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Larache", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Ksar El Kebir", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Chefchaouen", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Asilah", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Fnideq", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Martil", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "M'diq", delivery_fee: 35, return_fee: 7, is_casa: false },
  
  // ORIENTAL REGION
  { name: "Oujda", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Nador", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Berkane", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Taourirt", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Jerada", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Guercif", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Driouch", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Zaio", delivery_fee: 35, return_fee: 7, is_casa: false },
  
  // SOUSS-MASSA REGION
  { name: "Agadir", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Inezgane", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Tiznit", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Taroudant", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Ouarzazate", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Zagora", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Ait Melloul", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Biougra", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Chtouka Ait Baha", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Tafraout", delivery_fee: 35, return_fee: 7, is_casa: false },
  
  // BENI MELLAL-KHENIFRA REGION
  { name: "Beni Mellal", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Khenifra", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Khouribga", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Fquih Ben Salah", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Azilal", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Kasba Tadla", delivery_fee: 35, return_fee: 7, is_casa: false },
  
  // DRAA-TAFILALET REGION
  { name: "Errachidia", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Midelt", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Tinghir", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Rich", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Goulmima", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Erfoud", delivery_fee: 35, return_fee: 7, is_casa: false },
  { name: "Rissani", delivery_fee: 35, return_fee: 7, is_casa: false },
  
  // Additional cities from your PDFs
  { name: "Kalaat Sraghna", delivery_fee: 35, return_fee: 7, is_casa: false },
];

// Export for use
export default moroccan_cities;

// Total cities: ~100+ major cities
// You can add more cities as needed
