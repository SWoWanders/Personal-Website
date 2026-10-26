# Gallery artwork

There are two virtual galleries in the same 3D building:

| Gallery | Address | Image folder | List in `gallery.html` |
|---|---|---|---|
| AI Art Gallery | `gallery.html` | `art/ai/` | `AI_ART` |
| Traditional Art Gallery | `gallery.html?hall=traditional` | `art/traditional/` | `TRADITIONAL_ART` |

## Adding a piece

1. **Upload the image.** On GitHub, open `art/ai` or `art/traditional`, choose **Add file → Upload files**, and drag the image in. JPG, PNG or WebP all work. Upload a web-sized copy, about 1600–2000 px on the long side, and keep your full-resolution originals off GitHub (see "Protecting your art" below). Use simple file names with no spaces, like `harbour-at-dusk.jpg`.
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

Every spot then shows its number on the wall and on the floor plan. The Traditional gallery has 123 spots. The AI gallery has 122, because spot 76 is where the arch into The Form Room is. Put that number in the piece's `slot:` field.

Pieces without a `slot` fill the free spots in order: 1, 2, 3 and so on. Spot 1 is at the left end of the first wall you face when you walk in.

## Protecting your art

The galleries make your art hard to save:
- The 3D walls and the full-size pop-up are drawn as graphics, not ordinary images, so right-click "Save image" and long-press "Save" don't work.
- Dragging the image out doesn't work.
- Every full-size view carries a small "© Steve's Art Channel" watermark and an "All rights reserved" notice.

No website can make art completely uncopyable. Anyone can take a screenshot, and because this repository is public, the files in `art/` can be opened directly on GitHub. So only upload web-sized copies (about 1600–2000 px), never print-quality originals.

## Duplicates are removed automatically

Every time art or `gallery.html` changes on GitHub, the **Remove duplicate art** check runs (see the repository's **Actions** tab). It spots the same image uploaded twice, even if one copy was resized or saved in a different format (JPG, PNG, WebP…). It keeps the copy the gallery lists first, or failing that the oldest one. Then it deletes the extra file and any gallery entry pointing to it.

Removed files stay in the repository's history, so nothing is lost for good. If the check ever removes something it shouldn't have, two very similar but different pieces might have been mistaken for one. Ask Claude to restore it.

## The Form Room (AI gallery)

Halfway along the AI gallery's left-hand (west) wall, an arched passage leads to **The Form Room**. It holds a fixed series of twelve titled generative compositions. Their titles and descriptions are in the `FORM_SERIES` list in `gallery.html`.

To undo the room, ask Claude to restore the `before-form-room` branch. That branch is a saved copy of the gallery from just before the room was added.
