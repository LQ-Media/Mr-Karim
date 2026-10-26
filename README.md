# The Saif's Bakery

Ordering website for The Saif's Bakery, Ain's Muslim-owned home bakery in Singapore (Instagram [@bake.withthesaifs](https://www.instagram.com/bake.withthesaifs/)).

Live: https://lq-media.github.io/Mr-Karim/

## How orders work
Customers pick ready-made bakes or customise a past design, choose a date and collection method, and the site opens WhatsApp with the full order written out for Ain. No server, no fees.

## Editing the shop
Everything Ain will want to change lives in **`config.js`**:
- `whatsapp`: Ain's number with country code, digits only (e.g. `6591234567`)
- `products`: the ready-made line (name, photo, options, prices)
- `gallery`: past custom orders shown as starting points
- `leadDays`, `slots`, `closedDates`, `pickupArea`
- `showPrices`: switch to `true` once prices are filled in

Photos live in `img/`. Hosted free on GitHub Pages.
