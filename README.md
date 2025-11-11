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
      "path": "path to image.json, alternative to url, supports multi-tiled images",
      "url": "map image url, unneded if you use path",

      "areas": "areas json url",
      "hidden": false,
      "labels":
      [
        {
          "name": "label name",
          "size": 12,
          "position": {"x": 0, "y": 0}
        }
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

## image.json
```
{
  "size": {
    "x": "image size",
    "y": "image size"
  },
  "tile_size": {
    "x": "tile size",
    "y": "tile size"
  },
  "dimensions": {
    "x": "number of tiles",
    "y": "number of tiles"
  },
  "format": "png/webp",
  "url": "left side of url"
}
```
