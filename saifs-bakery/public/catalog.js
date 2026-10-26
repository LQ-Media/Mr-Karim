/* The Saif's Bakery: starting menu.
   This is only the first copy. Once the app runs on the server, admins edit the
   live menu in the dashboard (Menu tab), and the app loads it from /api/catalog. */
(function (root) {
  var DEFAULT_CATALOG = {
    version: 1,
    shop: {
      whatsapp: "6580142315",
      instagram: "https://www.instagram.com/bake.withthesaifs/",
      showPrices: true,
      leadDays: { ready: 3, custom: 7 },
      delivery: { fee: 20, freeAbove: 150, note: "Islandwide · $20, free above $150" },
      slots: ["10am – 12pm", "2pm – 4pm", "5pm – 7pm"],
      closedDates: []
    },
    categories: [
      { id: "cakes", label: "Cakes" },
      { id: "cupcakes", label: "Cupcakes" },
      { id: "bakes", label: "Tarts & bakes" }
    ],
    occasions: [
      { id: "any", label: "Any day" }, { id: "birthday", label: "Birthday" }, { id: "thanks", label: "Thank you" },
      { id: "raya", label: "Raya" }, { id: "aqiqah", label: "Aqiqah" }
    ],
    plaques: ["Happy Birthday", "Selamat Hari Jadi", "Barakallah", "Thank you"],

    products: [
      { id: "rv-nutella", active: true, cat: "cakes", name: "Red Velvet Nutella Cake", tag: "Signature",
        photo: "img/red-velvet-nutella.jpg",
        desc: "Soft red velvet layers with Nutella, finished in buttercream with your message on top.",
        options: [{ label: '5"', note: "4–6 pax", price: 48 }, { label: '7"', note: "10–12 pax", price: 72 }],
        plaque: true, occasions: ["any", "birthday", "thanks"] },
      { id: "gummy-cake", active: true, cat: "cakes", name: "Sprinkles & Gummy Bears Cake", tag: "Kids' favourite",
        photo: "img/sprinkles-gummy-bears.jpg",
        desc: "A happy little cake loaded with rainbow sprinkles and gummy bears.",
        options: [{ label: '5"', note: "4–6 pax", price: 45 }, { label: '6"', note: "8–10 pax", price: 58 }],
        plaque: true, occasions: ["any", "birthday"] },
      { id: "cnc-cupcakes", active: true, cat: "cupcakes", name: "Cookies & Cream Cupcakes", tag: "Bestseller",
        photo: "img/cookies-and-cream-cupcakes.jpg",
        desc: "Chocolate cupcakes with cookies & cream frosting. Shown here with themed toppers from a custom order.",
        options: [{ label: "Box of 6", note: "", price: 28 }, { label: "Box of 12", note: "", price: 52 }],
        plaque: false, occasions: ["any", "birthday", "thanks"] },
      { id: "mini-cupcakes", active: true, cat: "cupcakes", name: "Mini Cupcakes Party Box", tag: "Party box",
        photo: "img/candyland-mini-cupcakes.jpg",
        desc: "Bite-size cupcakes in mixed colours. Perfect for school and party tables.",
        options: [{ label: "Box of 16", note: "", price: 30 }, { label: "Box of 25", note: "", price: 42 }],
        plaque: false, occasions: ["any", "birthday", "aqiqah", "raya"] },
      { id: "fruit-tartlets", active: true, cat: "bakes", name: "Fruit Tartlets", tag: "Ain's favourite",
        photo: "img/fruit-tartlets.jpg",
        desc: "Buttery tart shells, vanilla custard and fresh fruit.",
        options: [{ label: "Box of 6", note: "", price: 18 }, { label: "Box of 12", note: "", price: 34 }],
        plaque: false, occasions: ["any", "thanks", "raya", "aqiqah"] },
      { id: "banana-choc", active: true, cat: "bakes", name: "Brown Butter Banana Choc Chip Muffins", tag: "Always a hit",
        photo: "img/brown-butter-banana.jpg",
        desc: "Moist brown butter banana muffins with chocolate chips.",
        options: [{ label: "Box of 12", note: "", price: 22 }, { label: "Box of 24", note: "", price: 40 }],
        plaque: false, occasions: ["any", "thanks"] }
    ],

    gallery: [
      { id: "paw", active: true, name: "Paw Patrol cake", meta: '6" · character toppers', photo: "img/paw-patrol-cake.jpg", theme: "characters",
        preset: { type: "cake", size: "6", palette: "Ocean", decor: ["Theme toppers", "Name plaque"], themeText: "Paw Patrol" } },
      { id: "multidate", active: true, name: "Multi-date birthday cake", meta: "One cake, four birthdays", photo: "img/multi-date-birthday-cake.jpg", theme: "classic",
        preset: { type: "cake", size: "7", palette: "Blush", decor: ["Name plaque", "Sprinkles"] } },
      { id: "gummy", active: true, name: "Sprinkles & gummy bears", meta: "Designed by her youngest client", photo: "img/sprinkles-gummy-bears.jpg", theme: "classic",
        preset: { type: "cake", size: "6", palette: "Classic", decor: ["Sprinkles", "Gummy bears & candy"] } },
      { id: "elmo", active: true, name: "Elmo cake", meta: "Fur-piped character cake", photo: "img/elmo-cake.jpg", theme: "characters",
        preset: { type: "cake", size: "6", palette: "Cherry", decor: ["Theme toppers", "Name plaque"], themeText: "Elmo" } },
      { id: "cinnamoroll", active: true, name: "Cinnamoroll 3D cake", meta: "3D character cake", photo: "img/cinnamoroll-cake.jpg", theme: "characters",
        preset: { type: "cake", size: "6", palette: "Ocean", decor: ["Theme toppers"], themeText: "Cinnamoroll" } },
      { id: "bluewhite", active: true, name: "Blue & white mini cupcakes", meta: "Soft and simple", photo: "img/blue-white-mini-cupcakes.jpg", theme: "cupcakes",
        preset: { type: "cupcakes", cupSize: "Mini", cupCount: 25, palette: "Ocean", decor: ["Theme toppers"] } },
      { id: "redvelvet", active: true, name: "“Finally Legal” cake", meta: '7" square · red velvet Nutella', photo: "img/red-velvet-nutella.jpg", theme: "classic",
        preset: { type: "cake", size: "7", shape: "square", sponge: "Red velvet", filling: "Nutella", palette: "Blush", decor: ["Name plaque"] } },
      { id: "babyshark", active: true, name: "Baby Shark mini cupcakes", meta: "Mini cupcakes", photo: "img/baby-shark-mini-cupcakes.jpg", theme: "cupcakes",
        preset: { type: "cupcakes", cupSize: "Mini", cupCount: 25, palette: "Sunshine", decor: ["Theme toppers"], themeText: "Baby Shark" } },
      { id: "minecraft", active: true, name: "Minecraft cupcakes", meta: "Cookies & cream", photo: "img/cookies-and-cream-cupcakes.jpg", theme: "cupcakes",
        preset: { type: "cupcakes", cupSize: "Regular", cupCount: 12, sponge: "Chocolate", filling: "Cookies & cream", palette: "Leaf", decor: ["Theme toppers"], themeText: "Minecraft" } },
      { id: "candyland", active: true, name: "Candyland mini cupcakes", meta: "Mini cupcakes", photo: "img/candyland-mini-cupcakes.jpg", theme: "cupcakes",
        preset: { type: "cupcakes", cupSize: "Mini", cupCount: 25, palette: "Blush", decor: ["Gummy bears & candy", "Sprinkles"], themeText: "Candyland" } }
    ],
    galleryThemes: [{ id: "characters", label: "Characters" }, { id: "classic", label: "Classic" }, { id: "cupcakes", label: "Cupcakes" }],

    /* Every choice in the custom builder. price = added to the cake;
       perCupcake = added per cupcake. look = how the 3D preview draws it. */
    builder: {
      sizes: [
        { id: "5", label: '5"', note: "4–6 pax", price: 55, active: true },
        { id: "6", label: '6"', note: "8–10 pax", price: 68, active: true },
        { id: "7", label: '7"', note: "10–12 pax", price: 85, active: true },
        { id: "8", label: '8"', note: "14–16 pax", price: 98, active: true },
        { id: "10", label: '10"', note: "20–25 pax", price: 140, active: true }
      ],
      tiers: [
        { id: "1", label: "1 tier", price: 0, active: true },
        { id: "2", label: "2 tiers", price: 75, active: true }
      ],
      shapes: [
        { id: "round", label: "Round", price: 0, active: true },
        { id: "square", label: "Square", price: 0, active: true },
        { id: "heart", label: "Heart", price: 10, active: true }
      ],
      sponges: [
        { id: "Vanilla", label: "Vanilla", color: "#F3DDA8", price: 0, active: true },
        { id: "Chocolate", label: "Chocolate", color: "#5A3726", price: 0, active: true },
        { id: "Red velvet", label: "Red velvet", color: "#9E2B2B", price: 0, active: true },
        { id: "Banana", label: "Banana", color: "#E9C77B", price: 0, active: true },
        { id: "Pandan", label: "Pandan", color: "#9CC27E", price: 0, active: true }
      ],
      fillings: [
        { id: "Vanilla buttercream", label: "Vanilla buttercream", price: 0, active: true },
        { id: "Chocolate ganache", label: "Chocolate ganache", price: 0, active: true },
        { id: "Cream cheese", label: "Cream cheese", price: 0, active: true },
        { id: "Nutella", label: "Nutella", price: 0, active: true },
        { id: "Cookies & cream", label: "Cookies & cream", price: 0, active: true },
        { id: "Strawberry", label: "Strawberry", price: 0, active: true }
      ],
      finishes: [
        { id: "Buttercream", label: "Buttercream", look: "buttercream", price: 0, active: true },
        { id: "Fresh cream", label: "Fresh cream", look: "freshcream", price: 0, active: true },
        { id: "Fondant", label: "Fondant", look: "fondant", price: 25, active: true },
        { id: "Naked", label: "Naked", note: "layers show", look: "naked", price: 0, active: true }
      ],
      palettes: [
        { id: "Classic", label: "Classic", frost: "#FFF6E6", trim: "#F2C66D", accent: "#A84D2E", drip: "#3B2418", active: true },
        { id: "Blush", label: "Blush", frost: "#F6D5CB", trim: "#FFFFFF", accent: "#D98C8C", drip: "#E9A3A3", active: true },
        { id: "Ocean", label: "Ocean", frost: "#D6E4F0", trim: "#FFFFFF", accent: "#5F8FBF", drip: "#4A7BB0", active: true },
        { id: "Cherry", label: "Cherry", frost: "#D8434B", trim: "#FFFFFF", accent: "#9E1F2A", drip: "#7A1420", active: true },
        { id: "Sunshine", label: "Sunshine", frost: "#FFE38A", trim: "#7FC3E8", accent: "#F2A33A", drip: "#F2A33A", active: true },
        { id: "Leaf", label: "Leaf", frost: "#B9D98C", trim: "#7A5A3A", accent: "#5E8F3E", drip: "#5A3726", active: true },
        { id: "Safari", label: "Safari", frost: "#DCE3CF", trim: "#F2C66D", accent: "#A8794F", drip: "#8A5A2B", active: true },
        { id: "Cocoa", label: "Cocoa", frost: "#6B4430", trim: "#3B2418", accent: "#F2C66D", drip: "#2A170F", active: true }
      ],
      decorations: [
        { id: "Theme toppers", label: "Theme toppers", look: "toppers", price: 15, perCupcake: { Regular: 1.5, Mini: 1 }, active: true },
        { id: "Name plaque", label: "Name plaque", look: "plaque", price: 0, active: true },
        { id: "Candles", label: "Candles", look: "candles", price: 3, active: true },
        { id: "Sprinkles", label: "Sprinkles", look: "sprinkles", price: 0, active: true },
        { id: "Gummy bears & candy", label: "Gummy bears & candy", look: "candy", price: 8, active: true },
        { id: "Flowers", label: "Flowers", look: "flowers", price: 10, active: true },
        { id: "Drip", label: "Drip", look: "drip", price: 8, active: true },
        { id: "Gold beads", label: "Gold beads", look: "gold", price: 6, active: true }
      ],
      cupcakeSizes: [
        { id: "Regular", label: "Regular", note: "", active: true, counts: [{ n: 6, price: 30 }, { n: 12, price: 55 }, { n: 24, price: 100 }] },
        { id: "Mini", label: "Mini", note: "bite-size", active: true, counts: [{ n: 16, price: 32 }, { n: 25, price: 45 }, { n: 50, price: 85 }] }
      ],
      greetings: ["Happy Birthday", "Selamat Hari Jadi", "Barakallahu fik"],
      diets: ["Less sweet", "Eggless", "Nut-free"]
    }
  };
  if (typeof module === "object" && module.exports) module.exports = DEFAULT_CATALOG;
  else root.SAIFS_DEFAULT_CATALOG = DEFAULT_CATALOG;
})(typeof window !== "undefined" ? window : globalThis);
