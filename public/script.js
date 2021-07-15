var socket = io();

var V = SAT.Vector;
var B = SAT.Box;
var C = SAT.Circle;

const clamp = (a, min = 0, max = 1) => Math.min(max, Math.max(min, a));
const invlerp = (x, y, a) => clamp((a - x) / (y - x));
const lerp2d = (x, y, a) => x * (1 - a) + y * a;

//start screen
document.getElementById('nickform').addEventListener('submit', function(event) {
  event.preventDefault();
  socket.emit('join', document.getElementById("nickname").value);
  document.getElementById("start").style.visibility = 'hidden';
  document.getElementById("game").style.visibility = 'visible';
});


//assets
var assets = {};
function preload() {
  document.getElementById("p5_loading").style.visibility = 'hidden';

  assets.pistol = loadImage('assets/weapons/m9.png');
  assets.ak = loadImage('assets/weapons/ak.png');
  assets.shotgun = loadImage('assets/weapons/shotgun.png');
  assets.aug = loadImage('assets/weapons/aug.png');

  assets.tileset = loadImage("assets/tiles/Sphyr_r.png");
  assets.ammosmall = loadImage("assets/ammosmall.png");
  assets.ammolarge = loadImage("assets/ammolarge.png");
  assets.bullet = loadImage("assets/bullet.png");

  assets.damageboost = loadImage("assets/icons/damageboost.png");
  assets.capacityboost = loadImage("assets/icons/capacityboost.png");
  assets.healthboost = loadImage("assets/icons/healthboost.png");
  assets.healthpack = loadImage("assets/icons/healthpack.png");
  assets.speedboost = loadImage("assets/icons/speedboost.png");

  assets.font = loadFont("assets/fonts/PIXEAB__.TTF");
  assets.fontb = loadFont("assets/fonts/PIXEARG_.TTF");
}

function setup() {
  document.getElementById("loading").style.visibility = 'hidden';
  document.getElementById("start").style.visibility = 'visible';
  document.getElementById("nickname").select();
  createCanvas(window.innerWidth, window.innerHeight).id('game');
  document.getElementById("game").style.cursor = "crosshair";
  document.addEventListener('contextmenu', event => event.preventDefault());
  document.body.onmousedown = function(e) { if (e.button === 1) return false; }
  rectMode(CENTER);
  ellipseMode(CENTER);
  textAlign(CENTER);
  textFont(assets.font, 100 * u);
}

function errormessage(e) {
  document.getElementById("game").style.visibility = 'hidden';
  document.getElementById("start").style.visibility = 'hidden';
  document.getElementById("messagec").style.visibility = 'visible';
  document.getElementById("message").innerHTML = 'Error: ' + e;
}

function deathmessage() {
  hand = 0;
  document.getElementById("game").style.visibility = 'hidden';
  document.getElementById("start").style.visibility = 'visible';
  document.getElementById("nickname");
  let dd = document.getElementById("death");
  if (dd) {
    dd.remove();
  }
  let d = document.createElement("p");
  d.innerHTML = 'You died!';
  d.style.color = 'red';
  d.id = 'death';
  document.getElementById("start").appendChild(d);
}

var players = [];
var objects = [];
var tmap = [];
var bullets = [];
var dropitem = [];
var bots = [];
var player;
var oindex;
var st = performance.now();
var hand = 0;
var localp = { x: 1000, y: 1000 };

var tdr = true;
var sdr = true;

var u = ((window.innerWidth) / 9000);

function p(x, y, r, h, n, hp, c, mhp) {
  push();


  push();
  if (c) {
    fill(c);
  }
  circle(x * u, y * u, 500 * u);
  pop();

  if (r !== null) {
    push();
    noSmooth();
    if (h !== 'empty' && assets[h] !== undefined) {
      translate(x * u, y * u);
      rotate(r + radians(90));
      if (degrees(r) <= -180 || (degrees(r) <= 90 && degrees(r) >= 0)) {
        scale(1.0, -1.0);
      }
      let ws = (400 * u) / assets[h].height;
      let ws2 = (-(1400 * u) / assets[h].width) / 2;
      image(assets[h], (assets[h].width * ws2) + (650 * u), -150 * u, assets[h].width * ws, assets[h].height * ws);
    }
    pop();
  }

  push();
  fill(50, 0, 150);
  text(n, x * u, (y - 400) * u);
  pop();

  push();
  strokeWeight(8);
  line((x - 250) * u, (y - 350) * u, (x + 250) * u, (y - 350) * u);
  strokeWeight(5);
  stroke(0, 173, 43);
  line((x - 250) * u, (y - 350) * u, (x + lerp2d(-250, 250, hp / mhp)) * u, (y - 350) * u);
  pop();

  pop();
}

function b(x, y) {
  push();
  let ws = (80 * u) / assets.bullet.height;
  image(assets.bullet, x * u, y * u, assets.bullet.width * ws, assets.bullet.height * ws);
  pop();
}

function it(x, y, item) {
  push();
  let ws = (300 * u) / assets[item].height;
  noSmooth();
  image(assets[item], x * u, y * u, assets[item].width * ws, assets[item].height * ws);
  pop();
}

function drawTiles(map, d_cols, s_cols, tilesize, drawsize) {
  push();
  for (let i = map.length - 1; i > -1; --i) {
    let value = Math.floor(map[i] - 1);
    if (value !== -1) {
      let sx = (value % s_cols) * tilesize;
      let sy = Math.floor(value / s_cols) * tilesize;
      let dx = (i % d_cols) * drawsize;
      let dy = Math.floor(i / d_cols) * drawsize;
      noSmooth();
      if (Math.abs(dx - (player.x * u)) - (1000 * u) <= windowWidth / 2 && Math.abs(dy - (player.y * u)) - (1000 * u) <= windowHeight / 2) {
        image(assets.tileset, dx, dy, drawsize, drawsize, sx, sy, tilesize, tilesize);
      }
    }
  }
  pop();
}

var keyState = {};
window.addEventListener('keydown', function(e) {
  keyState[e.keyCode || e.which] = true;
}, true);
window.addEventListener('keyup', function(e) {
  keyState[e.keyCode || e.which] = false;
}, true);

function draw() {
  background(0);
  if (player) {
    push();

    translate(windowWidth / 2, windowHeight / 2);

    translate(-localp.x * u, -localp.y * u);

    drawTiles(tmap, 600, 7, 128, 500 * u);

    for (item of dropitem) {
      if (item) {
        it(item.x, item.y, item.item);
      }
    }

    for (plr of players) {
      if (plr) {
        if (plr.id !== player.id) {
          p(plr.x, plr.y, plr.r, plr.holding, plr.name, plr.health, 'rgb(255,255,255)', plr.maxhp);
        }
      }
    }

    for (bot of bots) {
      p(bot.x, bot.y, bot.r, bot.weapon, bot.name, bot.health, bot.color, bot.maxhp);
    }

    for (bullet of bullets) {
      if (bullet) {
        b(bullet.x, bullet.y);
      }
    }

    p(localp.x, localp.y, Math.atan2(mouseY - (windowHeight / 2), mouseX - (windowWidth / 2)) + radians(-90), player.inventory[hand], player.name, player.health, 'rgb(255,255,255)', player.maxhp);

    let pr = false;



    if (keyState[32]) {
      if (performance.now() - (1000 * 1.1) >= st) {
        st = performance.now();
        socket.emit('s');
      }
    }

    if (keyState[87]) {
      pr = true;
      localp.y -= player.speed2;
    }

    if (keyState[65]) {
      pr = true;
      localp.x -= player.speed2;
    }

    if (keyState[83]) {
      pr = true;
      localp.y += player.speed2;
    }

    if (keyState[68]) {
      pr = true;
      localp.x += player.speed2;
    }

    if (keyState[49] && sdr === false) {
      hand = 0;
      socket.emit('h', hand);
    }
    if (keyState[50] && sdr === false) {
      hand = 1;
      socket.emit('h', hand);
    }
    if (keyState[51] && sdr === false) {
      hand = 2;
      socket.emit('h', hand);
    }
    if (keyState[52] && sdr === false) {
      hand = 3;
      socket.emit('h', hand);
    }
    if (keyState[53] && sdr === false) {
      hand = 4;
      socket.emit('h', hand);
    }


    if (!keyState[49] && !keyState[50] && !keyState[51] && !keyState[52] && !keyState[53]) {
      sdr = false;
    }


    if (keyState[81] && tdr === false) {
      tdr = true;
      socket.emit('drop', hand);
    }

    if (!keyState[81]) {
      tdr = false;
    }

    let om = oindex.within(localp.x, localp.y, 1000);

    om.map(oid => {
      object = objects[oid];
      let pc = new C(new V(localp.x, localp.y), 250);
      let oc = new B(new V(object.x, object.y), 500, 500).toPolygon();
      let response = new SAT.Response();
      let collided = SAT.testCirclePolygon(pc, oc, response);
      if (collided) {
        let clist = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 59, 56, 61, 62, 65, 66];

        if (clist.includes(object.tt)) {
          let overlapV = response.overlapV.clone().scale(-1);
          localp.x += overlapV.x;
          localp.y += overlapV.y;
        }
      }
    });

    if (pr = true) {
      socket.emit('m', localp.x, localp.y);
    }

    socket.emit('r', Math.atan2(mouseY - (windowHeight / 2), mouseX - (windowWidth / 2)) + radians(-90));

    if (mouseIsPressed) {
      if (mouseButton === LEFT) {
        socket.emit('shoot');
      }
      // if (mouseButton === RIGHT) {
      // }
      // if (mouseButton === CENTER) {
      // }
    }
    pop();

    push();
    noStroke();
    fill(0, 0, 0, 127);
    rect(windowWidth - (1300 * u), windowHeight - (300 * u), 2500 * u, 500 * u);
    pop();

    push();
    stroke(0, 34, 69);
    fill(0, 34, 69);

    text('Ammunition: ' + player.ammo + '/' + player.maxammo, windowWidth - (800 * u), windowHeight - (2600 * u));


    if (player.inventory[player.hand] === 'pistol') {
      text('Shoots bullets.', windowWidth - (800 * u), windowHeight - (2900 * u));
    }

    if (player.inventory[player.hand] === 'shotgun') {
      text('Shoots more bullets.', windowWidth - (800 * u), windowHeight - (2900 * u));
    }

    if (player.inventory[player.hand] === 'ak') {
      text('Shoots bullets,\n but faster.', windowWidth - (800 * u), windowHeight - (2900 * u));
    }

    if (player.inventory[player.hand] === 'aug') {
      text('OwO', windowWidth - (800 * u), windowHeight - (2900 * u));
    }

    if (player.inventory[player.hand] === 'm4') {
      text('UwU', windowWidth - (800 * u), windowHeight - (2900 * u));
    }

    pop();

    for ([i, slot] of player.inventory.entries()) {
      push();
      if (i === hand) {
        strokeWeight(6);
        stroke(255, 0, 0);
      } else {
        strokeWeight(3);
      }

      translate(windowWidth - (2300 * u) + ((500 * i) * u), windowHeight - (300 * u));
      noFill();
      rect(0, 0, 400 * u, 400 * u);
      if (slot !== 'empty') {
        let ws = (350 * u) / assets[slot].width;
        let ws2 = (-(650 * u) / assets[slot].width) / 4;
        noSmooth();
        image(assets[slot], (assets[slot].width * ws2), -100 * u, assets[slot].width * ws, assets[slot].height * ws);
      }
      pop();
    }


    push();
    let elist = 1;
    if (player.effects.includes('Invincible')) {
      elist++;
      stroke(0, 255, 0);
      text('Invincible', 400 * u, elist * (120 * u));
    }
    pop();

  }
}

function mouseWheel(event) {
  if (Math.sign(event.delta) === 1) {
    hand += 1;
  }
  if (Math.sign(event.delta) === -1) {
    hand -= 1;
  }
  if (hand > 4) {
    hand = 0;
  }
  if (hand < 0) {
    hand = 4;
  }

  socket.emit('h', hand);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  u = (windowWidth / 10000);
  textFont(assets.font, 100 * u);
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
socket.on('p', function(p, b, pl, di, bo) {
  players = p;
  bullets = b;
  player = pl;
  dropitem = di;
  bots = bo;
});

socket.on('o', function(o) {
  objects = o;
  oindex = new KDBush(objects, p => p.x, p => p.y, 16, Int32Array);
});

socket.on('c', function(p) {
  localp = p;
});

socket.on('name', function(n) {
  name = n;
});

socket.on('tmap', function(m) {
  tmap = m;
});

socket.on("disconnect", function(reason) {
  errormessage(reason);
});

socket.on("dead", function() {
  deathmessage();
});