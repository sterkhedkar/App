# LR Pharma — Products page (glass redesign)

A single-file, no-build redesign of the `/products` page in a frosted
"liquid glass" style: translucent blurred panels with specular edges over an
animated aurora background, light/dark themes, search, category filters,
sorting and a product detail sheet.

Open `index.html` in a browser, or drop it in as the site's products page.

## Replace the sample products

The live site could not be reached when this was built, so the `PRODUCTS`
array near the bottom of `index.html` holds **sample entries**. Replace them
with the real catalogue:

```js
{ name, category, composition, pack, form, rx, image, description }
```

- `form`: tablet | capsule | syrup | injection | ointment | sachet | herbal | drops
  (picks the illustration when there is no `image`)
- `rx: true` shows an "Rx" badge
- `image`: optional photo URL

Categories, counts and stats are derived from the array automatically.
Category colours are in `TONES`. Nav links point at `/`, `/about`,
`/products`, `/quality` and `/contact`; adjust to match the real routes.
`?category=Syrups` in the URL preselects a category.
