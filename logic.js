let params = new URLSearchParams(document.location.search);
let maps;

var labels = [];
var inserts = [];
var settings = { // cookies in future
    "show_labels": true,
    "show_inserts": true,
    "show_area_borders": false,
}

var position = { x: 0, y: 0};
var start = { x: 0, y: 0 };
var zoom = 1;
var zoom_last = zoom;
var zoom_limit = { min: 0.1, max: 5 };
var initial_pinch_distance = null;
var is_panning;

var image = {
    "size": {"x": 0, "y": 0},
    "tile_size": {"x": 0, "y": 0},
    "dimensions": {"x": 1, "y": 1},
    "tiles": []
}

var zoomable;
var canvas;
var ctx;
var insert_button_list;

var area_info_label;
var area_info = {};


// assign elements, events and load json
document.addEventListener('DOMContentLoaded', function()
{
    document.addEventListener("keydown", on_keydown);

    zoomable = document.getElementById("map_zoomable");

    zoomable.addEventListener('mousedown', on_mousedown);
    zoomable.addEventListener('touchstart', (e) => handle_touch(e, on_mousedown))

    zoomable.addEventListener('mouseup', on_mouseup);
    zoomable.addEventListener('mouseleave', on_mouseup);
    zoomable.addEventListener('touchend',  (e) => handle_touch(e, on_mouseup))

    zoomable.addEventListener('mousemove', on_mousemove);
    zoomable.addEventListener('touchmove', (e) => handle_touch(e, on_mousemove))

    zoomable.addEventListener('wheel', on_mousescroll);

    zoomable.addEventListener('dblclick', on_doubleclick);

    area_info_label = document.getElementById("area_info_label");

    insert_button_list = document.getElementById("map_insert_buttons");

    canvas = document.getElementById("map_canvas");
    ctx = canvas.getContext('2d');

    load_maps_json("maps.json");
}, false);


// Loads map.json
async function load_maps_json(url)
{
    var response = await fetch(url);
    maps = await response.json();

    for (const [key, value] of Object.entries(maps.maps))
    {
        if (!value)
        {
            var new_label = document.createElement("p");
            new_label.textContent = key;
            maplist.appendChild(new_label);
            continue;
        }

        if (value.hidden)
            continue;

        // create new button
        var new_button = document.createElement("button");

        if (value.name)
            new_button.innerText = value.name;
        else
            new_button.innerText = key;

        new_button.onclick = function ()
        {
            params.set('map', key);
            params.delete('pos');
            update_params();
            load_map(key);
        };

        maplist.appendChild(new_button);
    }

    if (params.has('map'))
        load_map(params.get('map'));
    else
        load_map(maps.main)
}


// Load map image/images
function load_map(_map = null)
{
    console.log(`Loading ${_map}.`);
    if (!maps.maps)
    {
        console.error(`Can't load map ${_map}: No maps.json loaded.`);
        return;
    }

    if (!_map)
        _map = maps.maps.main;

    if (!(_map in maps.maps))
    {
        console.error(`Can't load map ${_map}: It doesn't exist.`);
        return;
    }

    // restore position and zoom
    update_transform(true);
    document.body.style.cursor = "wait";

    // Check and load Labels
    labels = []
    if ("labels" in maps.maps[_map] && settings.show_labels)
        labels = maps.maps[_map].labels;
    toggle_hidden('button_labels', !labels.length)
    console.log(`Loaded ${labels.length} labels.`)

    // Check and load Nightmare Inserts
    inserts = []
    insert_button_list.innerHTML = "";
    if ("inserts" in maps.maps[_map] && settings.show_inserts)
        inserts = maps.maps[_map].inserts;
    console.log(`Loaded ${inserts.length} inserts.`)

    // Check and load areas
    area_info = {}
    if ("areas" in maps.maps[_map])
        load_areas(_map)

    //
    if ('path' in maps.maps[_map])
        load_image_tiled(maps.maps[_map].path)
    else if ('url' in maps.maps[_map])
        load_image_lone(maps.maps[_map].url)
    else
    {
        console.error(`Can't load map ${_map}: It doesn't have path or url specified. Please, contact map viewer creator.`)
        return;
    }
}


//
function load_image_lone(_url = null)
{
    if (!_url)
    {
        console.error("Can't load image: URL is null.")
        return;
    }

    _image = new Image();
    _image.src = _url;

    image.dimensions = { "x": 1, "y": 1 };
    image.tile_size = { "x": 0, "y": 0}
    image.tiles = [_image];

    _image.onload = function()
    {
        image.size = { "x": _image.naturalWidth,
                       "y": _image.naturalHeight};

        requestAnimationFrame(draw);
        load_insert_buttons();
        get_param_position();
        document.body.style.cursor = "auto";
    }
}


async function load_image_tiled(_path = null)
{
    if (!_path)
    {
        console.error("Can't load image: path is null.")
        return;
    }

    var response = await fetch(_path);
    var image_json = await response.json();

    image.size = image_json.size;
    image.tile_size = image_json.tile_size;
    image.dimensions = image_json.dimensions;

    for (let _y = 0; _y < image.dimensions.y; _y++)
    {
        for (let _x = 0; _x < image.dimensions.x; _x++)
        {
            var num = _y * image.dimensions.x + _x
            if (num <= image.tiles.length)
                image.tiles.push(new Image());

            image.tiles[num].src = image_json.url + `/tile-${num}.${image_json.format}?raw=true`
            image.tiles[num].onload = function()
            {
                requestAnimationFrame(draw);
            }
        }
    }

    requestAnimationFrame(draw);
    load_insert_buttons();
    get_param_position();
    document.body.style.cursor = "auto";
}


async function load_areas(_map)
{
    var response = await fetch(maps.maps[_map].areas);
    area_info = await response.json();
    toggle_hidden('button_borders', !area_info)
}


function load_insert_buttons()
{
    if (!inserts)
        return;

    for (const iter in inserts)
    {
        value = inserts[iter];

        var new_button = document.createElement("button");

        if (value.name)
            new_button.title = value.name;

        if (value.position)
            new_button.style = `left: ${value.position.x * 32}px; top: ${value.position.y * 32}px;`;
        else
            console.error("No position in Nightmare Insert button!");

        inserts[iter].show = false;

        new_button.onclick = function ()
        {
            inserts[iter].show = ! inserts[iter].show;
            requestAnimationFrame(draw);
        };

        insert_button_list.appendChild(new_button);
    }
}


// Updates url
function update_params()
{
    history.pushState('', '', '?' + params.toString());
}


// Gets shared position from params and then updates map position.
function get_param_position()
{
    if (params.has('pos'))
    {
        // Get position from query
        position.x = -(parseInt(params.get('pos').split('x')[0]) * 32);
        position.y = -(parseInt(params.get('pos').split('x')[1]) * 32);
        zoom = 2.5;
    }
    else
    {
        // Center image.
        position.x = -(image.size.x / 2);
        position.y = -(image.size.y / 2);
        zoom = 0.2;
    }

    position.x = position.x * zoom + window.innerWidth / 2 - 16;
    position.y = position.y * zoom + window.innerHeight / 2 - 16;

    update_transform();
}


// Draws map and labels.
function draw()
{
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    canvas.width = image.size.x;
    canvas.height = image.size.y;

    ctx.imageSmoothingEnabled = false;

    for (let _y = 0; _y < image.dimensions.y; _y++)
    {
        for (let _x = 0; _x < image.dimensions.x; _x++)
        {
            var num = _y * image.dimensions.x + _x
            ctx.drawImage(image.tiles[num],
                          _x * image.tile_size.x,
                          _y * image.tile_size.y);
        }
    }

    draw_area_borders();
    draw_inserts();
    draw_labels();
}


function draw_labels()
{
    if ( !settings.show_labels || !labels)
        return;

    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 8;

    ctx.shadowColor = "black";
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    //ctx.shadowBlur = 10;

    for (const iter in labels)
    {
        value = labels[iter];
        draw_text(ctx, value.name, value.x, value.y, value.size);
    }

    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}


function draw_text(context, text, x, y, font_size=12, font="Sans-serif")
{
    context.font = `${font_size}em ${font}`;
    context.strokeText(text, x, y);
    context.fillText(text, x, y);
}


function draw_inserts()
{
    if (!settings.show_inserts || !inserts)
        return;

    for (const iter in inserts)
    {
        value = inserts[iter];

        if (!("show" in value))
            continue;

        if (!value.show)
            continue;

        // shitcode!!
        if ("image" in value)
        {
            draw_insert(value);
        }
        else
        {
            inserts[iter].image = new Image();
            inserts[iter].image.src = value.url;

            inserts[iter].image.onload = function()
            {
                console.log(`Loaded Nightmare Insert ${inserts[iter].name} from ${inserts[iter].url}`);
                draw_insert(inserts[iter]);
            }
        }
    }
}

function draw_insert(_insert)
{
    if (!_insert.offset)
        _insert.offset = {x: 0, y: 0};

    ctx.drawImage(
        _insert.image,
        _insert.position.x * 32 + _insert.offset.x * 32,
        (_insert.position.y + 1) * 32 + _insert.offset.y * 32 - _insert.image.height);
}

function draw_area_borders()
{
    if (!settings.show_area_borders || !("map" in area_info))
        return;

    ctx.beginPath();
    ctx.strokeStyle = "#FFFFFF99";
    ctx.lineWidth = 2;

    for (let y = 0; y < area_info.map.length; y++)
    {
        for (var x = 0; x*2 < area_info.map[y].length; x++)
        {
            // Current tile
            var cur = area_info.map[y].slice(x*2, x*2+2);
            // Next tile
            if (x*2 + 2 < area_info.map[y].length)
                var next = area_info.map[y].slice(x*2+2, x*2+4)
            else
                continue
            // Tile below
            var below = null;
            if (y + 1 < area_info.map.length)
                below = area_info.map[y+1].slice(x*2, x*2+2)

            // Draw line on the right side
            if (cur != next)
            {
                ctx.moveTo(32 * (x+1), 32 * (y));
                ctx.lineTo(32 * (x+1), 32 * (y + 1));
            }

            // Draw line on bottom side
            if (below && cur != below)
            {
                ctx.moveTo(32 * (x), 32 * (y + 1));
                ctx.lineTo(32 * (x + 1), 32 * (y + 1))
            }
        }
    }
    ctx.stroke();
}

// Updates map position and zoom.
function update_transform(restore=false)
{
    if (!zoomable)
        return;

    if (restore)
    {
        position.x = 0;
        position.y = 0;
        zoom = 1;
    }

    if (zoom >= 1)
        zoomable.style.imageRendering = "pixelated";
    else
        zoomable.style.imageRendering = "auto";
    // https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering says that webkit doesn't support `smooth`. Sadly, but I have to use auto for compatibility.

    zoomable.style.transform = `translate(${position.x}px, ${position.y}px) scale(${zoom})`;
}

// Returns clicked/touched position.
function get_event_location(e)
{
    if (e.touches)
        return { x:e.touches[0].clientX,
                 y: e.touches[0].clientY };
    else if (e.clientX && e.clientY)
        return { x: e.clientX,
                 y: e.clientY };
}

// Updates Area Info label with new information.
function updateAreaInfo(event_location)
{
    area_info_label.style.left = `${event_location.x+24}px`;
    area_info_label.style.top = `${event_location.y+24}px`;

    share_position = getSS14Position(event_location);

    //Check if we have areas
    if (!("points" in area_info))
    {
        area_info_label.textContent = `${share_position.x},${share_position.y}\n`;
        return;
    }

    var _id = area_info.map[share_position.y].slice(share_position.x*2, share_position.x*2+2);
    var _name = "";
    if (_id in area_info.points)
        _name = area_info.points[_id].name;
    var _prot = "";
    if (_id in area_info.points)
        _prot = area_info.points[_id].protections;
    var _weed = "";
    if (_id in area_info.points && "weedkiller" in area_info.points[_id])
        _weed = area_info.points[_id].weedkiller;

    area_info_label.textContent = `"${_name}" - ${share_position.x},${share_position.y}\n`;

    if (!_prot)
        return;

    area_info_label.textContent += ` CAS: ${ (_prot[0] == 1) ? "✔️" : "❌"} | Fulton: ${ (_prot[1] == 1) ? "✔️" : "❌"} | Lasing: ${ (_prot[2] == 1) ? "✔️" : "❌"}\n`;
    area_info_label.textContent += ` MortarPlace: ${ (_prot[3] == 1) ? "✔️" : "❌"} | MortarFire: ${ (_prot[4] == 1) ? "✔️" : "❌"}\n`;
    area_info_label.textContent += ` Medevac: ${ (_prot[5] == 1) ? "✔️" : "❌"} | OB: ${ (_prot[6] == 1) ? "✔️" : "❌"} | SupplyDrop: ${ (_prot[7] == 1) ? "✔️" : "❌"}`;

    if (!_weed)
        return;

    area_info_label.textContent += `\n Weedkiller: ${_weed}`
}


function getSS14Position(event_location)
{
    return {x: Math.floor((event_location.x - position.x) / zoom / 32),
            y: Math.floor((event_location.y - position.y) / zoom / 32)};
}


function handle_zoom(zoom_pos, e_pos, flat)
{
    if (!zoom_pos)
        zoom_pos = { x: Math.round((document.body.clientWidth / 2 - position.x) / zoom),
                     y: Math.round((document.body.clientHeight / 2 - position.y) / zoom)};
    if (!e_pos)
        e_pos = { x: document.body.clientWidth / 2,
                  y: document.body.clientHeight / 2}
    if (flat)
        zoom *= flat;

    zoom = zoom.toFixed(2);
    zoom = zoom > zoom_limit.max ? zoom_limit.max : zoom; // Zoom In
    zoom = zoom < zoom_limit.min ? zoom_limit.min : zoom; // Zoom Out

    position = { x: Math.round(e_pos.x - zoom_pos.x * zoom),
                 y: Math.round(e_pos.y - zoom_pos.y * zoom)};

    update_transform();
}
//
// Events
//

// Handles touches.
function handle_touch(e, touch_handler)
{
    if (e.touches.length == 1)
    {
      touch_handler(e);
    }
    else if (e.type == "touchmove" && e.touches.length == 2)
    {
      is_panning = false;
      handle_pinch(e);
    }
}

// Zooms in or out on phones.
function handle_pinch(e)
{
    e.preventDefault();

    let touch1 = { x: e.touches[0].clientX,
                   y: e.touches[0].clientY }
    let touch2 = { x: e.touches[1].clientX,
                   y: e.touches[1].clientY }

    let current_distance = (touch1.x - touch2.x)**2 + (touch1.y - touch2.y)**2

    if (initial_pinch_distance == null)
      initial_pinch_distance = current_distance
    else
      on_mousescroll( e, current_distance/initial_pinch_distance )

}

// Starts panning.
function on_mousedown(e)
{
    e.preventDefault();
    event_location = get_event_location(e);
    updateAreaInfo(event_location);

    start = { x: event_location.x - position.x,
              y: event_location.y - position.y};
    is_panning = true;
}

// Stops panning.
function on_mouseup(e)
{
    is_panning = false;
    initial_pinch_distance = null;
    zoom_last = zoom;
    document.body.style.cursor='auto';
}

// Panning.
function on_mousemove(e)
{
    if (document.body.style.cursor != "wait")
        document.body.style.cursor='auto';

    e.preventDefault();

    event_location = get_event_location(e);

    if (area_info_label && !area_info_label.hidden)
        updateAreaInfo(event_location);

    if (!is_panning)
        return;

    document.body.style.cursor='move';

    position = { x: event_location.x - start.x,
                 y: event_location.y - start.y};

    update_transform();
}


// Zooms in or out.
function on_mousescroll(e, pinch)
{
    if (is_panning)
        return;

    e.preventDefault();

    event_location = get_event_location(e);
    var zoom_position = { x: Math.round((event_location.x - position.x) / zoom),
                          y: Math.round((event_location.y - position.y) / zoom)};

    if (pinch)
    {
        zoom = zoom_last * pinch;
    }
    else
    {
        var delta = (e.wheelDelta ? e.wheelDelta : -e.deltaY);
        (delta > 0) ? (zoom *= 1.2) : (zoom *= 0.8);
        if (delta > 0)
            document.body.style.cursor='zoom-in';
        else
            document.body.style.cursor='zoom-out';
    }

    handle_zoom(zoom_position, event_location);
}


// Updates Query params with clicked location.
function on_doubleclick(e)
{
    event_location = get_event_location(e);

    // Get tile position.
    var share_position = getSS14Position(event_location);

    console.log(share_position)
    params.set("pos", `${share_position.x}x${share_position.y}`)
    update_params();
}


function on_keydown(e)
{
    switch (e.key)
    {
        // Zoom Out
        case '-':
        case '_':
            handle_zoom(null, null, 0.6);
            break;
        // Zoom In
        case '=':
        case '+':
            handle_zoom(null, null, 1.4);
            break;

        // Move Left
        case 'h':
        case 'a':
        case 'ArrowLeft':
            position.x = position.x + 75 * zoom;
            update_transform();
            break;
        // Move Up
        case 'j':
        case 'w':
        case 'ArrowUp':
            position.y = position.y + 75 * zoom;
            update_transform();
            break;
        // Move Down
        case 'k':
        case 's':
        case 'ArrowDown':
            position.y = position.y - 75 * zoom;
            update_transform();
            break;
        // Move Left
        case 'l':
        case 'd':
        case 'ArrowRight':
            position.x = position.x - 75 * zoom;
            update_transform();
            break;

        // Move Left
        case 'H':
        case 'A':
        case 'ArrowLeft':
            position.x = position.x + 150 * zoom;
            update_transform();
            break;
        // Move Up
        case 'J':
        case 'W':
            position.y = position.y + 150 * zoom;
            update_transform();
            break;
        // Move Down
        case 'K':
        case 'S':
            position.y = position.y - 150 * zoom;
            update_transform();
            break;
        // Move Left
        case 'L':
        case 'D':
            position.x = position.x - 150 * zoom;
            update_transform();
            break;

        default:
            return;
    }

    e.preventDefault();
}

// 
// Button logic
//

function toggle_setting(setting)
{
    settings[setting] = !settings[setting];
    requestAnimationFrame(draw);
}

function toggle_hidden(eid, bool)
{
    element = document.getElementById(eid);

    if (!element)
    {
        console.error(`Element with id ${eid} doesn't exist.`);
        return;
    }

    if (bool != null)
        element.hidden = bool;
    else
        element.hidden = ! element.hidden;
}
