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
    "map id": "map id for url query",
    {
      "name": "map name",
      "url": "map image url",

      "areas": "areas json url",
      "hidden": false,
      "labels":
      [
        {"name": "label name", "size": 12, "x": 0, "y": 0}
      ],
      "inserts":
      [
        {
          "name": "Insert name",
          "url": "Insert image url",
          "position": {"x": 0, "y": 0},
        }
      ]
    }
  }
  "main": "id of main map"
}
```
