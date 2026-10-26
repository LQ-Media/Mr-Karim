/* =====================================================================
   The Saif's Bakery — shop settings
   Edit this file to change the menu, prices and contact details.
   Nothing else needs to change.
   ===================================================================== */
window.SAIFS_CONFIG = {
  // Ain's WhatsApp number with country code, digits only, e.g. "6591234567".
  // Orders are sent to this number as a ready-filled WhatsApp message.
  whatsapp: "6580142315",

  instagram: "https://www.instagram.com/bake.withthesaifs/",

  // Set to true once real prices are filled in below.
  showPrices: true,

  // Days of notice needed before the collection date.
  leadDays: { ready: 3, custom: 7 },

  // Delivery only (no self-pickup).
  delivery: { fee: 20, freeAbove: 150, note: "Islandwide · $20, free above $150" },
  slots: ["10am – 12pm", "2pm – 4pm", "5pm – 7pm"],

  // Dates Ain is fully booked or closed (YYYY-MM-DD).
  closedDates: [],

  /* ---------------- Ready-made line ---------------- */
  // cat: "cakes" | "cupcakes" | "bakes"
  // options: what the customer picks (size or box). price: number or null.
  products: [
    { id: "rv-nutella", cat: "cakes", name: "Red Velvet Nutella Cake", tag: "Signature",
      photo: "img/red-velvet-nutella.jpg",
      desc: "Soft red velvet layers with Nutella, finished in buttercream with your message on top.",
      options: [{ label: '5"', note: "4–6 pax", price: 48 }, { label: '7"', note: "10–12 pax", price: 72 }],
      plaque: true, occasions: ["any", "birthday", "thanks"] },
    { id: "gummy-cake", cat: "cakes", name: "Sprinkles & Gummy Bears Cake", tag: "Kids' favourite",
      photo: "img/sprinkles-gummy-bears.jpg",
      desc: "A happy little cake loaded with rainbow sprinkles and gummy bears.",
      options: [{ label: '5"', note: "4–6 pax", price: 45 }, { label: '6"', note: "8–10 pax", price: 58 }],
      plaque: true, occasions: ["any", "birthday"] },
    { id: "cnc-cupcakes", cat: "cupcakes", name: "Cookies & Cream Cupcakes", tag: "Bestseller",
      photo: "img/cookies-and-cream-cupcakes.jpg",
      desc: "Chocolate cupcakes with cookies & cream frosting. Shown here with themed toppers from a custom order.",
      options: [{ label: "Box of 6", note: "", price: 28 }, { label: "Box of 12", note: "", price: 52 }],
      plaque: false, occasions: ["any", "birthday", "thanks"] },
    { id: "mini-cupcakes", cat: "cupcakes", name: "Mini Cupcakes Party Box", tag: "Party box",
      photo: "img/candyland-mini-cupcakes.jpg",
      desc: "Bite-size cupcakes in mixed colours. Perfect for school and party tables.",
      options: [{ label: "Box of 16", note: "", price: 30 }, { label: "Box of 25", note: "", price: 42 }],
      plaque: false, occasions: ["any", "birthday", "aqiqah", "raya"] },
    { id: "fruit-tartlets", cat: "bakes", name: "Fruit Tartlets", tag: "Ain's favourite",
      photo: "img/fruit-tartlets.jpg",
      desc: "Buttery tart shells, vanilla custard and fresh fruit.",
      options: [{ label: "Box of 6", note: "", price: 18 }, { label: "Box of 12", note: "", price: 34 }],
      plaque: false, occasions: ["any", "thanks", "raya", "aqiqah"] },
    { id: "banana-choc", cat: "bakes", name: "Brown Butter Banana Choc Chip Muffins", tag: "Always a hit",
      photo: "img/brown-butter-banana.jpg",
      desc: "Moist brown butter banana muffins with chocolate chips.",
      options: [{ label: "Box of 12", note: "", price: 22 }, { label: "Box of 24", note: "", price: 40 }],
      plaque: false, occasions: ["any", "thanks"] }
  ],

  /* ---------------- Past custom orders (the gallery) ---------------- */
  // preset = the options pre-selected when a customer taps "Make this mine".
  gallery: [
    { id: "paw", name: "Paw Patrol cake", meta: '6" · character toppers', photo: "img/paw-patrol-cake.jpg", theme: "characters",
      preset: { type: "cake", size: "6", palette: "Ocean", decor: ["Theme toppers", "Name plaque"], themeText: "Paw Patrol" } },
    { id: "multidate", name: "Multi-date birthday cake", meta: "One cake, four birthdays", photo: "img/multi-date-birthday-cake.jpg", theme: "classic",
      preset: { type: "cake", size: "7", palette: "Blush", decor: ["Name plaque", "Sprinkles"] } },
    { id: "gummy", name: "Sprinkles & gummy bears", meta: "Designed by her youngest client", photo: "img/sprinkles-gummy-bears.jpg", theme: "classic",
      preset: { type: "cake", size: "6", palette: "Classic", decor: ["Sprinkles", "Gummy bears & candy"] } },
    { id: "elmo", name: "Elmo cake", meta: "Fur-piped character cake", photo: "img/elmo-cake.jpg", theme: "characters",
      preset: { type: "cake", size: "6", palette: "Cherry", decor: ["Theme toppers", "Name plaque"], themeText: "Elmo" } },
    { id: "cinnamoroll", name: "Cinnamoroll 3D cake", meta: "3D character cake", photo: "img/cinnamoroll-cake.jpg", theme: "characters",
      preset: { type: "cake", size: "6", palette: "Ocean", decor: ["Theme toppers"], themeText: "Cinnamoroll" } },
    { id: "bluewhite", name: "Blue & white mini cupcakes", meta: "Soft and simple", photo: "img/blue-white-mini-cupcakes.jpg", theme: "cupcakes",
      preset: { type: "cupcakes", cupSize: "Mini", cupCount: 25, palette: "Ocean", decor: ["Theme toppers"] } },
    { id: "redvelvet", name: "“Finally Legal” cake", meta: '7" square · red velvet Nutella', photo: "img/red-velvet-nutella.jpg", theme: "classic",
      preset: { type: "cake", size: "7", shape: "square", sponge: "Red velvet", filling: "Nutella", palette: "Blush", decor: ["Name plaque"] } },
    { id: "babyshark", name: "Baby Shark mini cupcakes", meta: "Mini cupcakes", photo: "img/baby-shark-mini-cupcakes.jpg", theme: "cupcakes",
      preset: { type: "cupcakes", cupSize: "Mini", cupCount: 25, palette: "Sunshine", decor: ["Theme toppers"], themeText: "Baby Shark" } },
    { id: "minecraft", name: "Minecraft cupcakes", meta: "Cookies & cream", photo: "img/cookies-and-cream-cupcakes.jpg", theme: "cupcakes",
      preset: { type: "cupcakes", cupSize: "Regular", cupCount: 12, sponge: "Chocolate", filling: "Cookies & cream", palette: "Leaf", decor: ["Theme toppers"], themeText: "Minecraft" } },
    { id: "candyland", name: "Candyland mini cupcakes", meta: "Mini cupcakes", photo: "img/candyland-mini-cupcakes.jpg", theme: "cupcakes",
      preset: { type: "cupcakes", cupSize: "Mini", cupCount: 25, palette: "Blush", decor: ["Gummy bears & candy", "Sprinkles"], themeText: "Candyland" } }
  ],

  // Optional prices for the custom builder (used only when showPrices is true).
  customPrices: {
    cake: { "5": 55, "6": 68, "7": 85, "8": 98, "10": 140 },   // buttercream, 1 tier, message included
    secondTier: 75, fondant: 25, heartShape: 10,
    decor: { "Theme toppers": 15, "Gummy bears & candy": 8, "Flowers": 10, "Drip": 8, "Gold beads": 6, "Candles": 3 },
    cupcakes: { Regular: { 6: 30, 12: 55, 24: 100 }, Mini: { 16: 32, 25: 45, 50: 85 } },
    cupcakeToppers: { Regular: 1.5, Mini: 1 }   // per piece, when "Theme toppers" is chosen
  }
};
