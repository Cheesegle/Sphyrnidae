var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var SAT = require('sat');
var KDBush = require('kdbush');
var performance = require('perf_hooks').performance;
var world = require('./world')
var V = SAT.Vector;
var B = SAT.Box;
var C = SAT.Circle;

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

http.listen(3000, () => {
  console.log('listening on *:3000');
});

var players = [];
var objects = world.generate();
var oindex = new KDBush(objects, p => p.x, p => p.y, 64, Int32Array);
var bullets = [];

function radians(degrees) {
  return degrees * (Math.PI / 180);
}

//emit loop
setInterval(function() {
  for ([i, bullet] of bullets.entries()) {
    bullet.age++;
    if (bullet.age >= 60) {
      bullets.splice(i, 1);
    }
    bullet.x += bullet.speed * Math.cos(bullet.angle);
    bullet.y += bullet.speed * Math.sin(bullet.angle);
    let r = oindex.within(bullet.x, bullet.y, 1000).map(oid => {
      let object = objects[oid];
      let bc = new V(bullet.x + 250, bullet.y + 250);
      let oc = new B(new V(object.x, object.y), 500, 500).toPolygon();
      let collided = SAT.pointInPolygon(bc, oc);
      if (collided) {
        bullets.splice(i, 1);
      }
    });
  }

  let l = [];
  for (player of players) {
    if (player) {
      l.push(player);
    }
  }
  io.emit('p', l, bullets);
}, 1000 / 60);

io.on('connection', (socket) => {
  let id;

  socket.emit('o', objects);

  socket.on('join', function() {
    id = players.length;
    players.push({ x: 1000, y: 1000, id: id, r: 0 });
    socket.emit('id', id);
    console.log('a user connected');
  });

  socket.on('ping', function() {
    socket.emit('pong');
  });

  socket.on('r', function(r) {
    if (players[id]) {
      players[id].r = r;
    }
  });

  let bt = performance.now();

  socket.on('shoot', function(r) {
    if (players[id]) {
      if (performance.now() - (1000 / 2) >= bt) {
        bt = performance.now();

        let barrel = 400;
        bx = players[id].x + (barrel * Math.cos(r));
        by = players[id].y + (barrel * Math.sin(r));
        bullets.push({ x: bx, y: by, speed: 160, angle: r + radians((Math.random() - 0.5) * 10), age: 0, id: bullets.length });
      }
    }
  });

  let del = true;
  let t = performance.now();

  socket.on('m', function(x, y) {
    if (id) {
      if (performance.now() - (1000 / 65) >= t) {
        t = performance.now();

        if (Math.abs(players[id].x - x) <= 45 && Math.abs(players[id].y - y) <= 50) {
          players[id].x = x;
          players[id].y = y;

          let r = oindex.within(players[id].x, players[id].y, 1000).map(oid => {
            object = objects[oid];
            let pc = new C(new V(players[id].x + 250, players[id].y + 250), 250);
            let oc = new B(new V(object.x, object.y), 500, 500).toPolygon();
            let response = new SAT.Response();
            let collided = SAT.testCirclePolygon(pc, oc, response);
            if (collided) {
              let overlapV = response.overlapV.clone().scale(-1.1);
              players[id].x += overlapV.x;
              players[id].y += overlapV.y;
            }
          });
        } else {
          socket.emit('c', players[id])
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
    if (id) {
      players[id] = null;
    }
  });

});