let params = new URLSearchParams(document.location.search);
let maps;
let map_current;

load_json("maps.json");
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
  //image = document.getElementById("map_image");
  canvas = document.getElementById("canvas");
  ctx = canvas.getContext('2d');

  target.addEventListener('mousedown', on_mousedown);
  target.addEventListener('touchstart', (e) => handle_touch(e, on_mousedown))

  target.addEventListener('mouseup', on_mouseup);
  target.addEventListener('mouseleave', on_mouseup);
  target.addEventListener('touchend',  (e) => handle_touch(e, on_mouseup))

  target.addEventListener('mousemove', on_mousemove);
  target.addEventListener('touchmove', (e) => handle_touch(e, on_mousemove))

  target.addEventListener('wheel', on_mousescroll);

  target.addEventListener('dblclick', on_doubleclick);

  update_transform();
  draw();
}

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
      const url = new URL(window.location)
      url.searchParams.set("foo", "bar")

      params.set('map', key);
      params.delete('pos');
      update_params();
      load_map();
    };

    maplist.appendChild(new_button);
  }
  load_map();
}

function update_params()
{
  history.pushState('', '', '?' + params.toString());
}

function load_map()
{
  if (params.has('map'))
    map_current = params.get('map');

  image.src = maps.maps[map_current].url;

  if ("labels" in maps.maps[map_current])
  {
    labels = maps.maps[map_current].labels;
  }
  else
  {
    labels = []
  }

  console.log(`Loaded map ${map_current} ${image.naturalWidth}:${image.naturalHeight} with ${Object.keys(labels).length} labels.`);

  if (params.has('pos'))
  {
    var new_position = params.get('pos').split(',');

    position.x = parseInt(new_position[0]);
    position.y = parseInt(new_position[1]);
  }

  update_transform();
  image.onload = async function () {
    draw();
  }
}

function toggle_maplist()
{
  button = document.getElementById("maplist");
  button.hidden = ! button.hidden;
}


function draw()
{
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0);

  if ( !show_labels )
    return;

  for (const iter in labels)
  {
    value = labels[iter];
    draw_text(value.name, value.x, value.y, value.size);
  }

}


function draw_text(text, x, y, font_size=12, font="Sans-serif")
{
  ctx.font = `${font_size}em ${font}`;

  ctx.strokeStyle = "black";
  ctx.lineWidth = 12;
  ctx.strokeText(text, x, y);

  ctx.shadowColor = "black";
  ctx.shadowOffsetX = 5;
  ctx.shadowOffsetY = 5;
  ctx.shadowBlur = 5;

  ctx.fillStyle = "white";
  ctx.fillText(text, x, y);
}

function update_transform()
{
  if (!target)
    return;
  target.style.transform = `translate(${position.x}px, ${position.y}px) scale(${zoom})`;
}

function get_event_location(e)
{
  if (e.touches)
    return { x:e.touches[0].clientX,
             y: e.touches[0].clientY }
  else if (e.clientX && e.clientY)
    return { x: e.clientX,
             y: e.clientY }
}

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

function on_mousedown(e)
{
  e.preventDefault();
  event_location = get_event_location(e);
  start = { x: event_location.x - position.x,
            y: event_location.y - position.y};
  is_panning = true;
}

function on_mouseup(e)
{
  is_panning = false;
  initialPinchDistance = null;
  zoom_last = zoom;
}

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

function on_doubleclick(e)
{
  return;
  event_location = get_event_location(e);

  console.log(share_position);
  //params.set("pos", `${share_position.x},${share_position.y}`)
  //update_params();
}


function toggle_labels()
{
  show_labels = !show_labels;
  draw();
}
