const params = new URLSearchParams(document.location.search);

var settings = { // cookies in future
    "show_labels":       true,
    "show_inserts":      true,
    "show_area_borders": false,
    "show_tile_cursor":  true
}

var maps = {};

var image = {
    "size":    {"x": 0, "y": 0},
    "dimensions":   {"x": 1, "y": 1},
    "tiles":   [],
    "labels":  [],
    "inserts": [],
    "areas":   {}
}

var measures = {
    "position":   { x: 0, y: 0},
    "start":      { x: 0, y: 0 },
    "zoom":       1,
    "zoom_last":  1,
    "zoom_limit": { "min": 0.1, "max": 5 },
    "pinch":      null,
    "panning":    false
}

var tile_size = 1024;

var zoomable;

var canvas;
var ctx;

var insert_button_list;

var area_info_label;

var tile_cursor;

// Load maps.json from url
async function load_maps_json(url)
{
    const response = await fetch(new Request(url));

    if (!response.ok)
        throw `Can't request "${url}", because ${response.status}`;

    var conf = await response.json();
    maps = {'main': conf.main};

    parse_maps(conf.maps);
}

// Parse dictionary with maps (from maps.json)
function parse_maps(_maps, _parent = null)
{
    if (!_maps)
        return;

    if (!_parent)
        _parent = document.getElementById("maplist");

    // Iterate through _maps
    for (const [key, value] of Object.entries(_maps))
    {
        // If map
        if ('path' in value || 'url' in value)
        {
            var _button = document.createElement("button");

            _button.innerText = 'name' in value ? value.name : key;

            _button.onclick = function ()
            {
                params.set('map', key);
                params.delete('pos');
                history.pushState('', '', '?' + params.toString());
                console.log(maps)
                load_map(key);
            };

            maps[key] = value;
            _parent.appendChild(_button);
            continue;
        }
        // Clear and remove previous
        document.getElementById(`maplist-${key}`)?.remove();

        // If list/dictionary of maps
        var _details = document.createElement("details");
        // _details.open = true;
        var _title = document.createElement("summary");
        var _content = document.createElement("ul");
        _details.setAttribute('id', `maplist-${key}`);

        _title.textContent = key;
        _details.appendChild(_title);

        parse_maps(value, _content)

        _details.appendChild(_content);
        _parent.appendChild(_details);
    }
}

// Parse dictionary with inserts, areas (from Maps/map.json)
function add_teleporters(_maps, _parent = null)
{
    if (!_maps)
        return;

    if (!_parent)
        _parent = document.getElementById("maplist");

    console.log(_maps, _parent);

    // Iterate through _maps
    for (const [key, value] of Object.entries(_maps))
    {
        // If map
        if ('position' in value)
        {
            var _button = document.createElement("button");

            _button.innerText = 'name' in value ? value.name : key;

            _button.onclick = function ()
            {
                move_to(value.position);
            };

            maps[key] = value;
            _parent.appendChild(_button);
            continue;
        }
        // Clear and remove previous
        document.getElementById(`maplist-${key}`)?.remove();

        // If list/dictionary of maps
        var _details = document.createElement("details");
        var _title = document.createElement("summary");
        var _content = document.createElement("ul");
        _details.setAttribute('id', `maplist-${key}`);

        _title.textContent = key;
        _details.appendChild(_title);

        add_teleporters(value, _content)

        _details.appendChild(_content);
        _parent.appendChild(_details);
    }
}

load_maps_json("maps.json").then(() => {
    // Assigns and Events
    // Keyboard Events
    document.addEventListener("keydown", on_keydown);
    // Assign canvas
    zoomable = document.getElementById("map_zoomable");
    // Panning start
    zoomable.addEventListener('mousedown', on_mousedown);
    zoomable.addEventListener('touchstart', (e) => on_touch(e, on_mousedown))
    // Panning end
    zoomable.addEventListener('mouseup', on_mouseup);
    zoomable.addEventListener('mouseleave', on_mouseup);
    zoomable.addEventListener('touchend',  (e) => on_touch(e, on_mouseup))
    // Panning move
    zoomable.addEventListener('mousemove', on_mousemove);
    zoomable.addEventListener('touchmove', (e) => on_touch(e, on_mousemove))
    // Zooming
    zoomable.addEventListener('wheel', on_mousescroll);
    // Copy location
    zoomable.addEventListener('dblclick', on_doubleclick);
    // Assign Area Info Box
    area_info_label = document.getElementById("area_info_label");
    // Assign Tile Box
    tile_cursor = document.getElementById("tile");
    // Assign Inserts List
    insert_button_list = document.getElementById("map_insert_buttons");
    // Assign Canvas
    canvas = document.getElementById("map_canvas");
    ctx = canvas.getContext('2d');

    // Get map
    let map = params.has('map') ? params.get('map') : maps.main;
    load_map(map);
})

function load_map(_map)
{
    console.log(`Loading ${_map}`);

    if (!(_map in maps))
        throw `Can't load ${_map}. It's not in ${maps}`;

    update_transform(true);
    document.body.style.cursor = "wait";

    image.areas = {}
    if ("areas" in maps[_map])
        load_areas(maps[_map].areas)
    else
        toggle_hidden('button_borders', true)

    if ('path' in maps[_map])
        load_image_tiled(maps[_map].path);
    else if ('url' in maps[_map])
        load_image_lone(maps[_map].url);
    else
        throw `Can't load ${_map}. It doesn't have any links attached. Contact map viewer creator.\n${maps[_map]}`
}

async function load_areas(_areas)
{
    var response = await fetch(new Request(_areas));
    image.areas = await response.json();
    toggle_hidden('button_borders', !image.areas)
}

function load_insert_buttons()
{
    if (!image.inserts)
        return;

    image.inserts.forEach((insert) => {
        var new_button = document.createElement("button");

        if (insert.name)
            new_button.title = insert.name;

        if (insert.position)
            new_button.style = `left: ${insert.position.x * 32}px; top: ${insert.position.y * 32}px;`;
        else
            console.error("No position in Nightmare Insert button!");

        insert.show = false;

        new_button.onclick = function ()
        {
            insert.show = ! insert.show;
            requestAnimationFrame(canvas_draw);
        };

        insert_button_list.appendChild(new_button);
    });
}

function load_image_lone(_url)
{
    // Labels
    image.labels = [];
    toggle_hidden('button_labels', true);
    document.getElementById("maplist-Labels")?.remove();

    // Inserts
    image.inserts = []
    document.getElementById("maplist-Inserts")?.remove();
    insert_button_list.innerHTML = "";

    image.dimensions = {'x': 1, 'y': 1}
    image.tiles = [new Image()];
    image.tiles[0].src = _url;
    image.tiles[0].onload = function()
    {
        image.size = { "x": image.tiles[0].naturalWidth,
                       "y": image.tiles[0].naturalHeight};

        requestAnimationFrame(canvas_draw);

        get_param_position();
        document.body.style.cursor = "auto";
    }
}

async function load_image_tiled(_path)
{
    var response = await fetch(_path);
    const image_json = await response.json();

    image.size = image_json.size;

    // Check and load Labels
    image.labels = []
    if ("labels" in image_json)
        image.labels = image_json.labels;
    add_teleporters({"Labels": image.labels});

    toggle_hidden('button_labels', !image.labels.length)
    console.log(`Loaded ${image.labels.length} labels.`)

    // Check and load Nightmare Inserts
    image.inserts = []
    insert_button_list.innerHTML = "";
    if ("inserts" in image_json && settings.show_inserts)
        image.inserts = image_json.inserts;
    console.log(`Loaded ${image.inserts.length} inserts.`)
    add_teleporters({"Inserts": image.inserts});

    canvas_clear()

    var img_loaded_num = 0;

    image.dimensions = { x: Math.ceil(image.size.x / tile_size),
                         y: Math.ceil(image.size.y / tile_size)}

    console.log(`Loading ${image.dimensions.x}:${image.dimensions.y} tiles.`)
    get_param_position();

    image.tiles = []
    for (let _y = 0; _y < image.dimensions.y; _y++)
    {
        for (let _x = 0; _x < image.dimensions.x; _x++)
        {
            let num = _y * image.dimensions.x + _x;
            if (num <= image.tiles.length)
            {
                console.log('creating new')
                image.tiles.push(new Image());
            }

            image.tiles[num].src = image_json.url + `/${_x}_${_y}.${image_json.format}`
            image.tiles[num].onload = function() {
                ctx.drawImage(image.tiles[num], _x * tile_size, _y * tile_size);

                img_loaded_num++;

                if (img_loaded_num == (image.dimensions.y * image.dimensions.x))
                {
                    requestAnimationFrame(canvas_draw)
                    load_insert_buttons();
                }
            }
        }
    }

    requestAnimationFrame(canvas_draw);
    document.body.style.cursor = "auto";
}

// ------
// Canvas
// ------

function canvas_clear()
{
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = image.size.x;
    canvas.height = image.size.y;
}

function canvas_draw()
{
    var time = new Date().getTime() / 1000;
    canvas_clear();

    for (let _y = 0; _y < image.dimensions.y; _y++)
    {
        for (let _x = 0; _x < image.dimensions.x; _x++)
        {
            let num = _y * image.dimensions.x + _x;
            ctx.drawImage(image.tiles[num], _x * tile_size, _y * tile_size);
        }
    }

    canvas_draw_area_borders();
    canvas_draw_inserts();
    canvas_draw_labels();

    console.log(`It took ${((new Date().getTime() / 1000) - time).toFixed(2)}s to redraw canvas.`)
}

function canvas_draw_labels()
{
    if ( !settings.show_labels || !image.labels)
        return;

    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 8;

    ctx.shadowColor = "black";
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    image.labels.forEach((label) => {
        if (!('position' in label))
            throw `No position in label ${label.name}`;
        draw_text(label.name, label.position.x * 32, label.position.y * 32, label.size);
    });

    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}


function draw_text(text, x, y, font_size=12, font="Sans-serif")
{
    ctx.font = `${font_size}em ${font}`;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
}


function canvas_draw_inserts()
{
    if (!settings.show_inserts || !image.inserts)
        return;

    image.inserts.forEach((insert) => {
        if (!("show" in insert))
            return;

        if (!insert.show)
            return;

        if ("image" in insert)
        {
            draw_insert(insert);
        }
        else
        {
            insert.image = new Image();
            insert.image.src = insert.url;

            insert.image.onload = function()
            {
                console.log(`Loaded Nightmare Insert ${insert.name} from ${insert.url}`);
                draw_insert(insert);
            }
        }
    });
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

function canvas_draw_area_borders()
{
    if (!settings.show_area_borders || !("map" in image.areas))
        return;

    ctx.beginPath();
    ctx.strokeStyle = "#FFFFFF99";
    ctx.lineWidth = 2;

    for (let y = 0; y < image.areas.map.length; y++)
    {
        for (var x = 0; x*2 < image.areas.map[y].length; x++)
        {
            // Current tile
            var cur = image.areas.map[y].slice(x*2, x*2+2);
            // Next tile
            if (x*2 + 2 < image.areas.map[y].length)
                var next = image.areas.map[y].slice(x*2+2, x*2+4)
            else
                continue
            // Tile below
            var below = null;
            if (y + 1 < image.areas.map.length)
                below = image.areas.map[y+1].slice(x*2, x*2+2)

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

// -------
// Helpers
// -------

function get_param_position()
{
    if (params.has('pos'))
    {
        // Get position from query
        measures.position.x = -(parseInt(params.get('pos').split('x')[0]) * 32);
        measures.position.y = -(parseInt(params.get('pos').split('x')[1]) * 32);
        measures.zoom = 2.5;
    }
    else
    {
        // Center image.
        measures.position.x = -(image.size.x / 2);
        measures.position.y = -(image.size.y / 2);
        measures.zoom = 0.25;
    }

    measures.position.x = measures.position.x * measures.zoom + window.innerWidth / 2 - 16;
    measures.position.y = measures.position.y * measures.zoom + window.innerHeight / 2 - 16;

    update_transform();
}

function get_event_location(e)
{
    // Touchscreen
    if (e.touches)
        return { x: e.touches[0].clientX,
                 y: e.touches[0].clientY };
    // Mouse
    else if (e.clientX && e.clientY)
        return { x: e.clientX,
                 y: e.clientY };
}

// Get SS14 like tile position, X is flipped, Y should be the same.
function get_tile32_position(event_location)
{
    return {x: Math.floor((event_location.x - measures.position.x) / measures.zoom / 32),
            y: Math.floor((event_location.y - measures.position.y) / measures.zoom / 32)};
}

function update_zoom(zoom_pos, e_pos, flat)
{
    // Get zoom_pos if one wasn't supplied.
    if (!zoom_pos)
        zoom_pos = { x: Math.round((document.body.clientWidth  / 2 - measures.position.x) / measures.zoom),
                     y: Math.round((document.body.clientHeight / 2 - measures.position.y) / measures.zoom)};

    // Get event position, if one wasn't supplied. (Center of the screen)
    if (!e_pos)
        e_pos = { x: document.body.clientWidth / 2,
                  y: document.body.clientHeight / 2}

    // Apply flat zoom
    if (flat)
        measures.zoom *= flat;

    measures.zoom = measures.zoom.toFixed(2);
    measures.zoom = measures.zoom > measures.zoom_limit.max ? measures.zoom_limit.max : measures.zoom; // Zoom In
    measures.zoom = measures.zoom < measures.zoom_limit.min ? measures.zoom_limit.min : measures.zoom; // Zoom Out

    measures.position = { x: Math.round(e_pos.x - zoom_pos.x * measures.zoom),
                          y: Math.round(e_pos.y - zoom_pos.y * measures.zoom)};

    update_transform();
}

// Updates map position and zoom.
function update_transform(restore=false)
{
    if (!zoomable)
        return;

    if (restore)
    {
        measures.position.x = 0;
        measures.position.y = 0;
        measures.zoom = 1;
    }

    if (measures.zoom >= 1)
        zoomable.style.imageRendering = "pixelated";
    else
        zoomable.style.imageRendering = "auto";
    // https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering says that webkit doesn't support `smooth`. Sadly, but I have to use auto for compatibility.

    zoomable.style.transform = `translate(${measures.position.x}px, ${measures.position.y}px) scale(${measures.zoom})`;
}

function update_tile_cursor(event_location)
{
    if (!settings['show_tile_cursor'])
        return;

    let tile_pos = get_tile32_position(event_location);

    tile_cursor.style.left = `${tile_pos.x * 32 - 2}px`;
    tile_cursor.style.top  = `${tile_pos.y * 32 - 2}px`;
}

// Updates Area Info label with new information.
function update_area_info(event_location)
{
    area_info_label.style.left = `${event_location.x + 24}px`;
    area_info_label.style.top  = `${event_location.y + 24}px`;

    let share_position = get_tile32_position(event_location);

    //Check if we have areas
    if (!("points" in image.areas))
    {
        area_info_label.textContent = `x: ${share_position.x}, y: ${share_position.y}\n`;
        return;
    }

    var _id = image.areas.map[share_position.y].slice(share_position.x*2, share_position.x*2+2);
    var _name = "";
    if (_id in image.areas.points)
        _name = image.areas.points[_id].name;
    var _prot = "";
    if (_id in image.areas.points)
        _prot = image.areas.points[_id].protections;
    var _weed = "";
    if (_id in image.areas.points && "weedkiller" in image.areas.points[_id])
        _weed = image.areas.points[_id].weedkiller;

    area_info_label.textContent = `"${_name}" - x: ${share_position.x}, y: ${share_position.y}\n`;

    if (!_prot)
        return;

    area_info_label.textContent += `\n CAS: ${ (_prot[0] == 1) ? "✅" : "❌"} | Fulton: ${ (_prot[1] == 1) ? "✅" : "❌"} | Lasing: ${ (_prot[2] == 1) ? "✅" : "❌"}\n`;
    area_info_label.textContent += ` MortarPlace: ${ (_prot[3] == 1) ? "✅" : "❌"} | MortarFire: ${ (_prot[4] == 1) ? "✅" : "❌"}\n`;
    area_info_label.textContent += ` Medevac: ${ (_prot[5] == 1) ? "✅" : "❌"} | OB: ${ (_prot[6] == 1) ? "✅" : "❌"} | SupplyDrop: ${ (_prot[7] == 1) ? "✅" : "❌"}`;

    if (!_weed)
        return;

    area_info_label.textContent += `\n\n Weedkiller: ${_weed}`
}

//
function move_to(position)
{
    if (!position)
        return;

    measures.zoom = 2;
    measures.position.x = -(position.x * 32) * measures.zoom + window.innerWidth / 2 - 16;
    measures.position.y = -(position.y * 32) * measures.zoom + window.innerHeight / 2 - 16;

    console.log(position, measures.position);

    update_transform()
}

// ------
// Events
// ------

// Handle keyboard events
function on_keydown(e)
{
    switch (e.key)
    {
        // Zoom Out
        case '-':
        case '_':
            update_zoom(null, null, 0.6);
            break;
        // Zoom In
        case '=':
        case '+':
            update_zoom(null, null, 1.5);
            break;

        // Move Left
        case 'h':
        case 'a':
        case 'ArrowLeft':
            measures.position.x = measures.position.x + 75 * measures.zoom;
            update_transform();
            break;
        // Move Up
        case 'k':
        case 'w':
        case 'ArrowUp':
            measures.position.y = measures.position.y + 75 * measures.zoom;
            update_transform();
            break;
        // Move Down
        case 'j':
        case 's':
        case 'ArrowDown':
            measures.position.y = measures.position.y - 75 * measures.zoom;
            update_transform();
            break;
        // Move Left
        case 'l':
        case 'd':
        case 'ArrowRight':
            measures.position.x = measures.position.x - 75 * measures.zoom;
            update_transform();
            break;

        // Fast Move Left
        case 'H':
        case 'A':
            measures.position.x = measures.position.x + 150 * measures.zoom;
            update_transform();
            break;
        // Fast Move Up
        case 'J':
        case 'W':
            measures.position.y = measures.position.y + 150 * measures.zoom;
            update_transform();
            break;
        // Fast Move Down
        case 'K':
        case 'S':
            measures.position.y = measures.position.y - 150 * measures.zoom;
            update_transform();
            break;
        // Fast Move Left
        case 'L':
        case 'D':
            measures.position.x = measures.position.x - 150 * measures.zoom;
            update_transform();
            break;

        default:
            return;
    }

    e.preventDefault();
}

// Handle mousedown event (start panning)
function on_mousedown(e)
{
    e.preventDefault();

    let event_location = get_event_location(e);

    if (settings.show_tile_cursor)
        update_tile_cursor(event_location);
    if (area_info_label && !area_info_label.hidden)
        update_area_info(event_location);

    measures.start = { x: event_location.x - measures.position.x,
                       y: event_location.y - measures.position.y};
    measures.panning = true;
}

// Handle mouseup (stop panning)
function on_mouseup()
{
    measures.panning = false;
    measures.pinch = null;
    measures.zoom_last = measures.zoom;
    // Return cursor to auto
    document.body.style.cursor='auto';
}

// Handle mousemove (panning)
function on_mousemove(e)
{
    if (document.body.style.cursor != "wait")
        document.body.style.cursor='auto';

    e.preventDefault();

    let event_location = get_event_location(e);

    if (settings.show_tile_cursor)
        update_tile_cursor(event_location);
    if (area_info_label && !area_info_label.hidden)
        update_area_info(event_location);

    if (!measures.panning)
        return;

    document.body.style.cursor='move';

    measures.position = { x: event_location.x - measures.start.x,
                          y: event_location.y - measures.start.y};

    update_transform();
}

// Handle mousescroll (zooming)
function on_mousescroll(e, pinch)
{
    if (measures.panning)
        return;

    e.preventDefault();

    let event_location = get_event_location(e);
    let zoom_position = { x: Math.round((event_location.x - measures.position.x) / measures.zoom),
                          y: Math.round((event_location.y - measures.position.y) / measures.zoom)};

    if (pinch)
    {
        measures.zoom = measures.zoom_last * pinch;
    }
    else
    {
        var delta = (e.wheelDelta ? e.wheelDelta : -e.deltaY);
        (delta > 0) ? (measures.zoom *= 1.2) : (measures.zoom *= 0.8);
        if (delta > 0)
            document.body.style.cursor='zoom-in';
        else
            document.body.style.cursor='zoom-out';
    }

    update_zoom(zoom_position, event_location);
}

// Handle doubleclick (copy location)
function on_doubleclick(e)
{
    let event_location = get_event_location(e);

    // Get tile position.
    let share_position = get_tile32_position(event_location);

    console.log(share_position)
    params.set("pos", `${share_position.x}x${share_position.y}`)

    history.pushState('', '', '?' + params.toString());
}

// -----------
// Touchscreen
// -----------

// Handles touches.
function on_touch(e, touch_handler)
{
    if (e.touches.length == 1)
        touch_handler(e);
    else if (e.type == "touchmove" && e.touches.length == 2)
    {
        measures.panning = false;
        on_pinch(e);
    }
}

// Zooms in or out on touchscreen.
function on_pinch(e)
{
    e.preventDefault();

    let touch1 = { x: e.touches[0].clientX,
                   y: e.touches[0].clientY }
    let touch2 = { x: e.touches[1].clientX,
                   y: e.touches[1].clientY }

    let current_distance = (touch1.x - touch2.x)**2 + (touch1.y - touch2.y)**2

    if (measures.pinch == null)
        measures.pinch = current_distance
    else
        on_mousescroll( e, current_distance/measures.pinch )

}

// -------
// Buttons
// -------

function toggle_hidden(eid, bool)
{
    let element = document.getElementById(eid);

    if (!element)
        throw `Element with id ${eid} doesn't exist.`;

    if (bool != null)
        element.hidden = bool;
    else
        element.hidden = ! element.hidden;
}

function toggle_setting(setting)
{
    settings[setting] = !settings[setting];
    requestAnimationFrame(canvas_draw);
}

// ---------------
// Secret Features
// ---------------

function help()
{
    console.log(`Made by @Tunguso4ka
-------------------
Useful commands:
- mortar_calc(0, 1, 2, 3)             Transform viewer coords to inround coords by using offset.
- mortar_calc_get_offset(0, 1, 2, 3)  Get offset between viewer and round.
- load_image_lone("url")              Load your own image.
- canvas_draw()                        Redraw canvas. May fix some rendering bugs.
`)
}

function mortar_calc(viewer_x, viewer_y, offset_x, offset_y)
{
    if (viewer_x == null | viewer_y == null | offset_x == null| offset_y == null)
        throw 'You need to supply Viewer X and Y coordinates, and Offset X and Y coordinates (from mortar_calc_get_offset): "mortar_calc(0, 1, 2, 3)"';

    viewer_x = image.size.x / 32 - viewer_x

    return viewer_x - offset_x, viewer_y - offset_y;
}

function mortar_calc_get_offset(rmc_x, rmc_y, viewer_x, viewer_y)
{
    if (rmc_x == null || rmc_y == null || viewer_x == null || viewer_y == null)
        throw 'You need to supply RMC14 X and Y coordinates, and Map Viewer X and Y coordinates: "mortar_calc_get_offset(0, 1, 2, 3)"';

    viewer_x = image.size.x / 32 - viewer_x

    return rmc_x - viewer_x, rmc_y - viewer_y;
}
