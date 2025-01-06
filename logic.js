let params = new URLSearchParams(document.location.search);
let maps;
let map_current;

var labels = {};
var show_labels = true;

var position = { x: 0, y: 0};
var start = { x: 0, y: 0 };
var zoom = 1;
var zoom_last = zoom;
var zoom_limit = { min: 0.3, max: 15 };
var initial_pinch_distance = null;
var is_panning;

var target;
var image = new Image();
image.src = 'icon.png';

var canvas;
var ctx;

window.onload = () =>
{
  target = document.getElementById("map_zoomable");
  canvas = document.getElementById("canvas");
  ctx = canvas.getContext('2d');
  
  canvas.image = document.createElement("canvas");

  target.addEventListener('mousedown', on_mousedown);
  target.addEventListener('touchstart', (e) => handle_touch(e, on_mousedown))

  target.addEventListener('mouseup', on_mouseup);
  target.addEventListener('mouseleave', on_mouseup);
  target.addEventListener('touchend',  (e) => handle_touch(e, on_mouseup))

  target.addEventListener('mousemove', on_mousemove);
  target.addEventListener('touchmove', (e) => handle_touch(e, on_mousemove))

  target.addEventListener('wheel', on_mousescroll);

  target.addEventListener('dblclick', on_doubleclick);

  load_json("maps.json");
}

// Loads map.json
async function load_json(url)
{
  var response = await fetch(url);
  maps = await response.json();

  if (!map_current)
    map_current = maps.main;

  for (const [key, value] of Object.entries(maps.maps))
  {
    var new_button = document.createElement("button");

    new_button.innerText = value.name;
    new_button.onclick = function () {
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
function load_map()
{
  if (params.has('map'))
    map_current = params.get('map');

  image.src = maps.maps[map_current].url;

  if ("labels" in maps.maps[map_current])
    labels = maps.maps[map_current].labels;
  else
    labels = []

  toggle_hidden('labels_button', !labels.length)

  console.log(`Loaded map ${map_current} ${image.naturalWidth}:${image.naturalHeight} with ${Object.keys(labels).length} labels.`);
  update_transform();

  image.onload = function() {
    canvas.image.width = image.naturalWidth;
    canvas.image.height = image.naturalHeight;
    canvas.image.getContext("2d").drawImage(image, 0, 0)

    draw();
    get_param_position();
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
  if (!params.has('pos'))
    return;

  // Get position from query
  var new_position = {x: parseInt(params.get('pos').split(',')[0]),
                      y: parseInt(params.get('pos').split(',')[1])}

  // Convert tile position into real position.
  var delta = canvas.width / canvas.clientWidth;

  update_transform();
}


// Draws map and labels.
function draw()
{
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas.image, 0, 0);

  if ( !show_labels )
    return;

  for (const iter in labels)
  {
    value = labels[iter];
    draw_text(ctx, value.name, value.x, value.y, value.size);
  }
}


function draw_text(context, text, x, y, font_size=12, font="Sans-serif")
{
  context.font = `${font_size}em ${font}`;

  context.strokeStyle = "black";
  context.lineWidth = 12;
  context.strokeText(text, x, y);

  context.shadowColor = "black";
  context.shadowOffsetX = 5;
  context.shadowOffsetY = 5;
  context.shadowBlur = 5;

  context.fillStyle = "white";
  context.fillText(text, x, y);
}


// Updates map position and zoom.
function update_transform()
{
  if (!target)
    return;
  target.style.transform = `translate(${position.x}px, ${position.y}px) scale(${zoom})`;
}


// Returns clicked/touched position.
function get_event_location(e)
{
  if (e.touches)
    return { x:e.touches[0].clientX,
             y: e.touches[0].clientY }
  else if (e.clientX && e.clientY)
    return { x: e.clientX,
             y: e.clientY }
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
  start = { x: event_location.x - position.x,
            y: event_location.y - position.y};
  is_panning = true;
}


// Stops panning.
function on_mouseup(e)
{
  is_panning = false;
  initialPinchDistance = null;
  zoom_last = zoom;
}


// Panning.
function on_mousemove(e)
{
  e.preventDefault();
  if (!is_panning)
    return;
  event_location = get_event_location(e);
  position = { x: event_location.x - start.x,
               y: event_location.y - start.y};
  update_transform();
}


// Zooms in or out.
function on_mousescroll(e, pinch)
{
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


// Updates Query params with clicked location.
function on_doubleclick(e)
{
  event_location = get_event_location(e);

  // Get tile position.
  var delta = canvas.width / canvas.clientWidth;
  var share_position = {x: Math.floor((event_location.x - position.x) / zoom * delta / 32),
                    y: Math.floor((event_location.y - position.y) / zoom * delta / 32)};

  console.log(share_position)
  //params.set("pos", `${share_position.x},${share_position.y}`)
  //update_params();
}


// Button logic
function toggle_labels()
{
  show_labels = !show_labels;
  draw();
}

function toggle_hidden(eid, bool)
{
  button = document.getElementById(eid);
  if (bool != null)
    button.hidden = bool;
  else
    button.hidden = ! button.hidden;
}
