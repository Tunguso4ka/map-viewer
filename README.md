## Tunguso4ka's SS14 Map Viewer
(actually Image Viewer, but who cares?)

## Requirements?

Nope. Pure html, css, js and json.

## How to launch locally?
`python -m http.server`
or
`npx http-server`

## maps.json
```
{
  "maps": {
    "map id": // required, used in Query param "?map={map id}"
    { // remove this section to render map id as label
      "name": "map name", // not required, name for the button
      "url": "map url", // required, internal or external

      "areas": "areas json url", // not required, internal or external
      "hidden": true, // not required, dont create button if true
      "labels": // not required, adds labels
      [
        {"name": "name", "size": 12, "x": 0, "y": 0} //creates label with text "name", font size 12, on pos 0,0
      ]
    }
  }
  "main": "id of main map" // required, will be used if Query param map is undefined
}
```
