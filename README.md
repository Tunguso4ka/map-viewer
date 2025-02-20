## Tunguso4ka's SS14 Map Viewer
(actually Image Viewer, but who cares?)

## Requirements?

Nope. Pure html, css, js and json.

## How to launch locally?
`python -m http.server`
or
`npx http-server`

## maps/maps.json
```
{
  "maps": {
    "map id": // used in Query param "?map={map id}"
    {
      "name": "map name",
      "url": "map url", // internal or external
      "hidden": true, // not required, dont create button if true
      "labels": // not required
      [
        {"name": "name", "size": 12, "x": 0, "y": 0}
      ]
    }
  }
  "main": "id of main map" // will be used if Query param map is undefined
}
```
