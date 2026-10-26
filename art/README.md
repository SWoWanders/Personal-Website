# Gallery artwork

There are two virtual galleries in the same 3D building:

| Gallery | Address | Image folder | List in `gallery.html` |
|---|---|---|---|
| AI Art Gallery | `gallery.html` | `art/ai/` | `AI_ART` |
| Traditional Art Gallery | `gallery.html?hall=traditional` | `art/traditional/` | `TRADITIONAL_ART` |

## Adding a piece

1. **Upload the image.** On GitHub, open `art/ai` or `art/traditional`, choose **Add file → Upload files**, and drag the image in. JPG, PNG or WebP all work. Around 2000–3000 px on the long side is plenty. Use simple file names with no spaces, like `harbour-at-dusk.jpg`.
2. **List it in `gallery.html`.** Click the pencil to edit `gallery.html`. Near the top are the two lists. Add a block to the right one:

   ```js
   {
     src: 'art/traditional/harbour-at-dusk.jpg',
     title: 'Harbour at Dusk',
     year: '2026',
     medium: 'Acrylic on canvas',
     size: '60 × 90 cm',
     description: 'A few sentences about the piece.',
     link: 'https://www.youtube.com/@stevesartc',
     slot: 12,
     frame: 'black'
   },
   ```

   Only `src` is required. The others are optional:
   - `link` adds a "More about this piece" button to the pop-up.
   - `frame` can be `'black'`, `'white'`, `'oak'` or `'none'`.
   - `scale: 1.2` hangs the piece 20% bigger.
3. **Commit the change.** The site updates in a minute or two.

## Choosing where a piece hangs

Add `slots` to the gallery's address:
- AI gallery: `gallery.html?slots`
- Traditional gallery: `gallery.html?hall=traditional&slots`

Every one of the 123 spots then shows its number on the wall and on the floor plan. Put that number in the piece's `slot:` field.

Pieces without a `slot` fill the free spots in order: 1, 2, 3 and so on. Spot 1 is at the left end of the first wall you face when you walk in.
