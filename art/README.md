# Gallery artwork

Put the image files for the virtual gallery (`gallery.html`) in this folder.

## Adding a piece

1. **Upload the image here.** On GitHub, open this `art` folder, choose **Add file → Upload files**, and drag the image in. JPG, PNG or WebP all work. Around 2000–3000 px on the long side is plenty. Use simple file names with no spaces, like `harbour-at-dusk.jpg`.
2. **List it in `gallery.html`.** Open `gallery.html` and click the pencil to edit. Near the top is the `ARTWORKS` list. Add one block per piece:

   ```js
   {
     src: 'art/harbour-at-dusk.jpg',
     title: 'Harbour at Dusk',
     year: '2026',
     medium: 'AI image, hand-finished',
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

Open **`gallery.html?slots`** (add `?slots` to the end of the gallery's address). Every one of the 123 spots shows its number on the wall and on the floor plan. Put that number in the piece's `slot:` field.

Pieces without a `slot` fill the free spots in order: 1, 2, 3 and so on. Spot 1 is on the first wall you face when you walk in.
