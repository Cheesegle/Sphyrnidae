var socket = io();

var V = SAT.Vector;
var B = SAT.Box;
var C = SAT.Circle;

const clamp = (a, min = 0, max = 1) => Math.min(max, Math.max(min, a));
const invlerp = (x, y, a) => clamp((a - x) / (y - x));
const lerp = (x, y, a) => x * (1 - a) + y * a;

function setup() {
  createCanvas(window.innerWidth, window.innerHeight).id('game');
  document.getElementById("game").style.cursor = "crosshair";
  document.addEventListener('contextmenu', event => event.preventDefault());
  rectMode(CENTER);
  ellipseMode(CENTER);
}

var players = [];
var objects = [];
var bullets = [];
var localp = { x: 1000, y: 1000 };
var id;

var u = ((window.innerWidth) / 10000);

function p(x, y, r) {
  push();
  circle(x * u, y * u, 500 * u);
  if (r) {
    translate(x * u, y * u);
    rotate(r);
    fill(color('black'));
    rect(0, 300 * u, 80 * u, 200 * u, 10);
  }
  pop();
}

function o(x, y) {
  push();
  fill(color('black'));
  rect(x * u, y * u, 500 * u, 500 * u);
  pop();
}

function b(x, y, x2, y2) {
  push();
  fill(color('blue'));
  circle(x * u, y * u, 80 * u);
  pop();
}

var keyState = {};
window.addEventListener('keydown', function(e) {
  keyState[e.keyCode || e.which] = true;
}, true);
window.addEventListener('keyup', function(e) {
  keyState[e.keyCode || e.which] = false;
}, true);

socket.emit('join')

function draw() {
  clear();
  if (id) {

    translate(windowWidth / 2, windowHeight / 2);

    translate(-localp.x * u, -localp.y * u);

    for (player of players) {
      if (player) {
        if (player.id !== id) {
          p(player.x, player.y, player.r);
        }
      }
    }

    for (bullet of bullets) {
      if (bullet) {
        b(bullet.x, bullet.y);
      }
    }

    push();
    translate(localp.x * u, localp.y * u);
    rotate(Math.atan2(mouseY - (windowHeight / 2), mouseX - (windowWidth / 2)) + radians(-90));

    fill(color('black'));

    rect(0, 300 * u, 80 * u, 200 * u, 10);

    // rect(-20, 300 * u, 80 * u, 200 * u, 10);
    // rect(20, 300 * u, 80 * u, 200 * u, 10);
    pop();

    p(localp.x, localp.y);

    for (object of objects) {
      if (object) {
        o(object.x, object.y);
      }
    }

    let pr = false;

    if (keyState[87]) {
      pr = true;
      localp.y -= 20;
    }

    if (keyState[65]) {
      pr = true;
      localp.x -= 20;
    }

    if (keyState[83]) {
      pr = true;
      localp.y += 20;
    }

    if (keyState[68]) {
      pr = true;
      localp.x += 20;
    }

    for (object of objects) {
      let pc = new C(new V(localp.x + 250, localp.y + 250), 250);
      let oc = new B(new V(object.x, object.y), 500, 500).toPolygon();
      let response = new SAT.Response();
      let collided = SAT.testCirclePolygon(pc, oc, response);
      if (collided) {
        let overlapV = response.overlapV.clone().scale(-1.1);
        localp.x += overlapV.x;
        localp.y += overlapV.y;
      }
    }

    if (pr = true) {
      socket.emit('m', localp.x, localp.y);
    }

    if (mouseIsPressed) {
      if (mouseButton === LEFT) {
        socket.emit('shoot', Math.atan2(mouseY - (windowHeight / 2), mouseX - (windowWidth / 2)));
      }
      // if (mouseButton === RIGHT) {
      // }
      // if (mouseButton === CENTER) {
      // }
    }

  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  u = (windowWidth / 10000);
}

function mouseMoved() {
  socket.emit('r', Math.atan2(mouseY - (windowHeight / 2), mouseX - (windowWidth / 2)) + radians(-90));
}

var latency;
var startTime;

setInterval(function() {
  startTime = Date.now();
  socket.emit('ping');
}, 1000);

socket.on('pong', function() {
  latency = Date.now() - startTime;
});

//main emit
socket.on('p', function(p, b) {
  players = p;
  bullets = b;
});

socket.on('o', function(o) {
  objects = o;
});

socket.on('id', function(sid) {
  id = sid;
});

socket.on('c', function(p) {
  localp = p;
});

socket.on("disconnect", function() {
  alert('disconnected')
});