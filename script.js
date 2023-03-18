// TODO canvas should inherit div
const window_width = (window.innerWidth / 3) * 2;
const window_height = window.innerHeight;
const HIDE_TEXT_AT = 1.6;
const SCALE_SYSTEM_DISTANCE = 5;

// UTILS
function readTextFile(file, callback) {
  // DEV
  var rawFile = new XMLHttpRequest();
  rawFile.overrideMimeType("application/json");
  rawFile.open("GET", file, true);
  rawFile.onreadystatechange = function () {
    if (rawFile.readyState === 4 && rawFile.status == "200") {
      callback(rawFile.responseText);
    }
  }
  rawFile.send(null);
}


function hasOverlap(r1, r2) {
  // TODO attribution
  let w1 = r1.width, h1 = r1.height;
  let w2 = r2.width, h2 = r2.height;
  let diff = {
    x: Math.abs((r1.x + w1 / 2) - (r2.x + w2 / 2)),
    y: Math.abs((r1.y + h1 / 2) - (r2.y + h2 / 2))
  };
  let compWidth = (r1.width + r2.width) / 2,
    compHeight = (r1.height + r2.height) / 2;
  let hasOverlap = ((diff.x <= compWidth) && (diff.y <= compHeight))
  return hasOverlap;
}

function cull(objects) {
  viewport = { x: 0, y: 0, width: stage.width(), height: stage.height() }
  for (var i = objects.length; i--;) {
    if (!hasOverlap(viewport, objects[i].getClientRect())) {
      objects[i].listening(false);
      objects[i].visible(false);
    } else {
      objects[i].listening(true);
      objects[i].visible(true);
      // toggle text visibility
      // TODO move this elsewhere
      try {
        if (stage.scale().x >= HIDE_TEXT_AT) {
          objects[i].children[1].visible(true);
        } else {
          objects[i].children[1].visible(false);
        }
      } catch (err) {}
    }
  }
}

function getObjectScale(data, stage_width, stage_height) {
  var xmin, xmax = 0
  var ymin, ymax = 0
  // we're gonna use the Z axis inplace of Y
  for (var i = data.length; i--;) {
    sys = data[i]
    switch (true) {
      case sys.x > xmax:
        xmax = sys.x;
      case sys.x < xmin:
        xmin = sys.x;
      case sys.z > ymax:
        ymax = sys.y;
      case sys.z < ymin:
        ymin = sys.y;
      default:
        break;
    }
  }
  // point cloud
  const pc_width = xmax - xmin;
  const pc_height = ymax - ymin;

  var coefficient = 0
  if (pc_width * stage_height >= pc_height * stage_width) {
    coefficient = stage_width / pc_width
  } else {
    coefficient = stage_height / pc_height
  }

  // center points
  const ctr_x = (xmax + xmin) / 2;
  const ctr_y = (ymax + ymin) / 2;
  // stage center
  const stg_x = stage_width / 2
  const stg_y = stage_height / 2
  return { stage: { x: stg_x, y: stg_y }, center: { x: ctr_x, y: ctr_y }, coefficient: coefficient }
}


// KONVA
Konva.hitOnDragEnabled = true;
Konva.pixelRatio = 1;
var stage = new Konva.Stage({
  container: 'map-el',
  width: window_width,
  height: window_height,
  draggable: true,
});
var layer = new Konva.Layer();

// create our shapes to clone later
var systemShapeTemplate = new Konva.Circle({
  // actual shape to show the system
  radius: 8,
  fill: '#9cd2db',
  stroke: 'black',
  strokeWidth: 0.25,
  hitStrokeWidth: 0,
  shadowForStrokeEnabled: false,
  draggable: false,
})

var systemNameTemplate = new Konva.Text({
  // name of the system
  text: "",
  fontSize: 4,
  align: "center",
  fontFamily: 'Calibri',
  fill: 'black',
  hitStrokeWidth: 0,
  shadowForStrokeEnabled: false,
  listening: false,
  draggable: false,
  width: 16,
  offsetX: 8,
  offsetY: 1.5,
  visible: false, // defualt to false, we'll make it visible when zoomed
})

var systemLine = new Konva.Line({
  points: [],
  stroke: 'black',
  strokeWidth: 0.5,
});


// FUNCS
function genMap(data) {
  data = JSON.parse(data);
  scaled = getObjectScale(data, stage.width(), stage.height());
  // scaled =  { stage: { x: stg_x, y: stg_y }, center: { x: ctr_x, y: ctr_y }, coefficient: coefficient }
  for (var i = data.length; i--;) {
    let sys = data[i];

    nx = (scaled.stage.x + scaled.coefficient * (sys.x - scaled.center.x)) * SCALE_SYSTEM_DISTANCE
    // invert Y (actually the Z axis)
    ny = -(scaled.stage.y + scaled.coefficient * (sys.z - scaled.center.y)) * SCALE_SYSTEM_DISTANCE
    let group = new Konva.Group({
      x: nx,
      y: ny,
      id: sys.id
    })
    group.add(systemShapeTemplate.clone())
    let sysname = systemNameTemplate.clone({
      text: sys.name
    })
    sysname.wrap("char")
    group.add(sysname)
    group.visible(false);
    layer.add(group)
  }
  cull(layer.getChildren());
}


// EVENTS
stage.on('dragend', () => {
  // 'dragend' to see culling in action
  // 'dragmove' for actual operation
  cull(layer.getChildren());
  cull(linelayer.getChildren());
})


stage.on('wheel', (e) => {
  // zoom
  e.evt.preventDefault();
  var oldScale = stage.scaleX();
  var pointer = stage.getPointerPosition();
  var mousePointTo = {
    x: (pointer.x - stage.x()) / oldScale,
    y: (pointer.y - stage.y()) / oldScale,
  };
  let direction = e.evt.deltaY > 0 ? 1 : -1;
  if (e.evt.ctrlKey) {
    direction = -direction;
  }
  var newScale = direction > 0 ? oldScale * 1.2 : oldScale / 1.2;
  if (newScale > 0.1 && newScale < 6) {
    stage.scale({ x: newScale, y: newScale });
    var newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);
    cull(layer.getChildren());
    cull(linelayer.getChildren());
  }
});


// TODO LOOP ABUSE
function findSystemNode(id) {
  nodes = layer.getChildren()
  for (var node = nodes.length; node--;) {
    if (nodes[node].id() == id) {
      return nodes[node];
    }
  }
}

var linelayer = new Konva.Layer();
// TODO LOOP ABUSE
function genLines(data) {
  data = JSON.parse(data);
  nodes = layer.getChildren()
  for (var node = nodes.length; node--;) {
    var id = nodes[node].id()
    var neighbors = data[id]
    if (neighbors !== undefined) {
      for (var n = neighbors.length; n--;) {
        let neighbor = findSystemNode(neighbors[n]);
        line = systemLine.clone({
          points: [nodes[node].x(), nodes[node].y(), neighbor.x(), neighbor.y()]
        });
        // TODO 2x scale and cache?
        linelayer.add(line);
      }
    }
  }
  cull(linelayer.getChildren())
}

readTextFile("/new.json", genMap);
readTextFile("/routes.json", genLines);
stage.add(linelayer); // lines first cause of zindex
stage.add(layer);
