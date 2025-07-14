let params = new URLSearchParams(document.location.search);
let maps;
let map_current;

var labels = [];
var show_labels = true;

var position = { x: 0, y: 0};
var start = { x: 0, y: 0 };
var zoom = 1;
var zoom_last = zoom;
var zoom_limit = { min: 0.1, max: 5 };
var initial_pinch_distance = null;
var is_panning;

var image = new Image();

var canvas;
var ctx;

var area_info_label;
var area_info = {};

// assign elements, events and load json
document.addEventListener('DOMContentLoaded', function()
{
    canvas = document.getElementById("map_zoomable");
    ctx = canvas.getContext('2d');

    area_info_label = document.getElementById("area_info_label");

    canvas.addEventListener('mousedown', on_mousedown);
    canvas.addEventListener('touchstart', (e) => handle_touch(e, on_mousedown))

    canvas.addEventListener('mouseup', on_mouseup);
    canvas.addEventListener('mouseleave', on_mouseup);
    canvas.addEventListener('touchend',  (e) => handle_touch(e, on_mouseup))

    canvas.addEventListener('mousemove', on_mousemove);
    canvas.addEventListener('touchmove', (e) => handle_touch(e, on_mousemove))

    canvas.addEventListener('wheel', on_mousescroll);

    canvas.addEventListener('dblclick', on_doubleclick);

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
            load_map();
        };

        maplist.appendChild(new_button);
    }

    load_map();
}


// Updates map image and labels.
async function load_map()
{
    update_transform(true); // restore position and zoom

    canvas.style.cursor='wait';

    if (params.has('map'))
        map_current = params.get('map');

    if (!map_current)
        map_current = maps.main;

    if ("labels" in maps.maps[map_current])
        labels = maps.maps[map_current].labels;
    else
        labels = []

    image.src = maps.maps[map_current].url;

    toggle_hidden('button_labels', !labels.length)

    console.log(`Loaded map ${map_current} from ${maps.maps[map_current].url} with ${Object.keys(labels).length} labels.`);
    update_transform();

    image.onload = function()
    {
        requestAnimationFrame(draw);
        get_param_position();
        canvas.style.cursor='auto';
    }
    
    area_info = {}
    if (!("areas" in maps.maps[map_current]))
        return;

    var response = await fetch(maps.maps[map_current].areas);

    area_info = await response.json();
    toggle_hidden("button_areas", "areas" in area_info);
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
        zoom = 4;
    }
    else
    {
        // Center image.
        position.x = -(image.naturalWidth / 2);
        position.y = -(image.naturalHeight / 2);
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

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0);

    if ( !show_labels )
        return;

    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 10;

    ctx.shadowColor = "black";
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;
    //ctx.shadowBlur = 10;

    for (const iter in labels)
    {
        value = labels[iter];
        draw_text(ctx, value.name, value.x, value.y, value.size);
    }
}


function draw_text(context, text, x, y, font_size=12, font="Sans-serif")
{
    context.font = `${font_size}em ${font}`;
    context.strokeText(text, x, y);
    context.fillText(text, x, y);
}


// Updates map position and zoom.
function update_transform(restore=false)
{
    if (!canvas)
        return;

    if (restore)
    {
        position.x = 0;
        position.y = 0;
        zoom = 1;
    }

    canvas.style.transform = `translate(${position.x}px, ${position.y}px) scale(${zoom})`;
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

    let currentDistance = (touch1.x - touch2.x)**2 + (touch1.y - touch2.y)**2

    if (initial_pinch_distance == null)
      initial_pinch_distance = currentDistance
    else
      on_mousescroll( e, currentDistance/initial_pinch_distance )

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
    canvas.style.cursor='move';
}


// Stops panning.
function on_mouseup(e)
{
    is_panning = false;
    initialPinchDistance = null;
    zoom_last = zoom;
    canvas.style.cursor='auto';
}


// Updates Area Info label with new information.
function updateAreaInfo(event_location)
{
    //Check if we have areas
    if (!("points" in area_info))
        return;
    
    area_info_label.style.left = `${event_location.x+24}px`;
    area_info_label.style.top = `${event_location.y+24}px`;

    share_position = getSS14Position(event_location);

    var _id = area_info.map[share_position.y].slice(share_position.x*2, share_position.x*2+2);
    var _name = "";
    if (_id in area_info.points)
        _name = area_info.points[_id].name;
    var _prot = "";
    if (_id in area_info.points)
        _prot = area_info.points[_id].protections;

    area_info_label.textContent = `"${_name}" - ${share_position.x},${share_position.y}\n`;

    if (!_prot)
        return;

    area_info_label.textContent += `CAS: ${ (_prot[0] == 1) ? "✔️" : "❌"} | Fulton: ${ (_prot[1] == 1) ? "✔️" : "❌"} | Lasing: ${ (_prot[2] == 1) ? "✔" : "❌"}\n`;
    area_info_label.textContent += `MortarPlace: ${ (_prot[3] == 1) ? "✔" : "❌"} | MortarFire: ${ (_prot[4] == 1) ? "✔" : "❌"}\n`;
    area_info_label.textContent += `Medevac: ${ (_prot[5] == 1) ? "✔" : "❌"} | OB: ${ (_prot[6] == 1) ? "✔" : "❌"} | SupplyDrop: ${ (_prot[7] == 1) ? "✔" : "❌"}`;
}


// Panning.
function on_mousemove(e)
{
    e.preventDefault();

    event_location = get_event_location(e);

    if (area_info_label && !area_info_label.hidden)
        updateAreaInfo(event_location);

    if (!is_panning)
        return;

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
        zoom = pinch * zoom_last;
    }
    else
    {
        var delta = (e.wheelDelta ? e.wheelDelta : -e.deltaY);
        (delta > 0) ? (zoom *= 1.2) : (zoom /= 1.2);
    }

    zoom = zoom.toFixed(2);

    if (zoom > zoom_limit.max)
        zoom = zoom_limit.max;

    if (zoom < zoom_limit.min)
        zoom = zoom_limit.min;

    position = { x: Math.round(event_location.x - zoom_position.x * zoom),
                 y: Math.round(event_location.y - zoom_position.y * zoom)};

    update_transform();
}


function getSS14Position(event_location)
{
    return {x: Math.floor((event_location.x - position.x) / zoom / 32),
            y: Math.floor((event_location.y - position.y) / zoom / 32)};
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


// Button logic
function toggle_labels()
{
    show_labels = !show_labels;
    requestAnimationFrame(draw);
}

function toggle_hidden(eid, bool)
{
    element = document.getElementById(eid);

    if (!element)
        return;

    if (bool != null)
        element.hidden = bool;
    else
        element.hidden = ! element.hidden;
}
