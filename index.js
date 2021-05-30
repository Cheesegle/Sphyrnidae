var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var SAT = require('sat');
var KDBush = require('kdbush');
var Walkable = require('walkable');
var StringUtils = require('is-empty-null-undef-nan-whitespace');
var isWhitespace = StringUtils.isEmptyOrNullOrUndefOrNanOrWhitespace;
var performance = require('perf_hooks').performance;
var world = require('./world')
var V = SAT.Vector;
var B = SAT.Box;
var C = SAT.Circle;

const clamp = (a, min = 0, max = 1) => Math.min(max, Math.max(min, a));
const invlerp = (x, y, a) => clamp((a - x) / (y - x));
const lerp2d = (x, y, a) => x * (1 - a) + y * a;

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

http.listen(3000, () => {
  console.log('listening on *:3000');
});

var players = [null];
var objects = world.generate();
var tmap = world.map;
var oindex = new KDBush(objects, p => p.x, p => p.y, 64, Int32Array);
var bullets = [];
var dropitem = [];
var bots = [];

var botspawn = [];



var clist = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 59];

var pathfind = new Walkable(50 * 500, 50 * 500);

for (object of objects) {
  if (clist.includes(object.tt)) {
    pathfind.addRect(500, 500, object.x, object.y);
  }
}

function radians(degrees) {
  return degrees * (Math.PI / 180);
}

//emit loop
setInterval(function() {
  for ([i, bullet] of bullets.entries()) {
    bullet.age++;
    if (bullet.age >= 45) {
      bullets.splice(i, 1);
    }
    bullet.x += bullet.speed * Math.cos(bullet.angle);
    bullet.y += bullet.speed * Math.sin(bullet.angle);
    oindex.within(bullet.x, bullet.y, 550).map(oid => {
      let object = objects[oid];
      let bc = new V(bullet.x, bullet.y);
      let oc = new B(new V(object.x, object.y), 500, 500).toPolygon();
      let collided = SAT.pointInPolygon(bc, oc);
      if (collided) {
        if (clist.includes(object.tt)) {
          bullets.splice(i, 1);
        }
      }
    });

    for ([i2, player] of players.entries()) {
      if (player) {
        let bc = new V(bullet.x, bullet.y);
        let pc = new C(new V(player.x, player.y), 250);
        let collided = SAT.pointInCircle(bc, pc);
        if (collided) {
          bullets.splice(i, 1);
          if (!player.effects.includes('Invincible')) {
            player.health -= bullet.damage;

            if (player.health <= 0) {
              let pp = player;
              io.to(pp.sid).emit('dead');
              if (pp) {
                players[i2] = null;
              }
              for ([h, d] of pp.inventory.entries()) {
                if (d !== 'empty' && d !== 'pistol') {
                  let r = radians(Math.random() * 360);
                  pp.inventory[h] = 'empty';
                  let bx = pp.x - 250 + (800 * Math.cos(r));
                  let by = pp.y - 250 + (800 * Math.sin(r));

                  dropitem.push({ x: bx, y: by, item: d });
                }
              }

              if (pp.ammo >= 30) {
                for (let bc = 0; bc <= pp.ammo - 30; bc += 30) {
                  let r = radians(Math.random() * 360);
                  let bx = pp.x - 250 + (800 * Math.cos(r));
                  let by = pp.y - 250 + (800 * Math.sin(r));

                  dropitem.push({ x: bx, y: by, item: 'ammolarge' });
                }
              }
            }
          }
        }
      }
    }

    for ([i2, bot] of bots.entries()) {
      if (bot) {
        let bc = new V(bullet.x, bullet.y);
        let pc = new C(new V(bot.x, bot.y), 250);
        let collided = SAT.pointInCircle(bc, pc);
        if (collided) {
          bullets.splice(i, 1);
          bot.health -= bullet.damage;
          if (bot.health <= 0) {

            if (bot.name === 'Sentry') {
              let r = radians(Math.random() * 360);
              let bx = bot.x + (800 * Math.cos(r));
              let by = bot.y - 250 + (800 * Math.sin(r));
              let rd = Math.floor(Math.random() * 5) + 1;
              if (rd === 1) {
                dropitem.push({ x: bx, y: by, item: 'ammolarge' });
              } else if (rd === 2 || rd === 3) {
                dropitem.push({ x: bx, y: by, item: 'ammosmall' });
                r = radians(Math.random() * 360);
                bx = bot.x + (800 * Math.cos(r));
                by = bot.y - 250 + (800 * Math.sin(r));
                dropitem.push({ x: bx, y: by, item: 'ammosmall' });
              } else {
                dropitem.push({ x: bx, y: by, item: 'ammosmall' });
              }
            }

            if (bot.name === 'Trooper') {
              let r = radians(Math.random() * 360);
              let bx = bot.x + (800 * Math.cos(r));
              let by = bot.y - 250 + (800 * Math.sin(r));
              let rd = Math.floor(Math.random() * 4) + 1;
              if (rd === 1 || rd === 2) {
                dropitem.push({ x: bx, y: by, item: 'ammolarge' });
                r = radians(Math.random() * 360);
                bx = bot.x + (800 * Math.cos(r));
                by = bot.y - 250 + (800 * Math.sin(r));
                dropitem.push({ x: bx, y: by, item: bot.weapon });
              } else if (rd === 3) {
                dropitem.push({ x: bx, y: by, item: 'ammolarge' });
                r = radians(Math.random() * 360);
                bx = bot.x + (800 * Math.cos(r));
                by = bot.y - 250 + (800 * Math.sin(r));
                dropitem.push({ x: bx, y: by, item: 'healthpack' });
              } else {
                dropitem.push({ x: bx, y: by, item: 'ammolarge' });
              }
            }

            if (bot.name === 'Elite') {
              let r = radians(Math.random() * 360);
              let bx = bot.x + (800 * Math.cos(r));
              let by = bot.y - 250 + (800 * Math.sin(r));
              let rd = Math.floor(Math.random() * 10) + 1;
              if (rd <= 5) {
                dropitem.push({ x: bx, y: by, item: 'ammolarge' });
                r = radians(Math.random() * 360);
                bx = bot.x + (800 * Math.cos(r));
                by = bot.y - 250 + (800 * Math.sin(r));
                if (rd === 1) {
                  dropitem.push({ x: bx, y: by, item: 'capacityboost' });
                }
                if (rd === 2) {
                  dropitem.push({ x: bx, y: by, item: 'damageboost' });
                }
                if (rd === 4) {
                  dropitem.push({ x: bx, y: by, item: 'precisionboost' });
                }
                if (rd === 5) {
                  dropitem.push({ x: bx, y: by, item: 'speedboost' });
                }
              } else {
                dropitem.push({ x: bx, y: by, item: 'ammolarge' });
                r = radians(Math.random() * 360);
                bx = bot.x + (800 * Math.cos(r));
                by = bot.y - 250 + (800 * Math.sin(r));
                dropitem.push({ x: bx, y: by, item: 'boltaction' });
              }
            }

            bots.splice(i2, 1);
          }
        }
      }
    }

  }

  for (playera of players) {
    if (playera) {
      if (playera.health < playera.maxhp) {
        playera.health += 0.1;
      }

      if (playera.inventory.includes('capacityboost')) {
        playera.maxammo = 500;
      } else {
        playera.maxammo = 200;
      }

      let l = [];
      for (playerb of players) {
        if (playerb) {
          if (Math.abs(playera.y - playerb.y) <= 3000) {
            if (Math.hypot(playerb.x - playera.x, playerb.y - playera.y) <= 5500) {
              l.push({ x: playerb.x, y: playerb.y, r: playerb.r, holding: playerb.inventory[playerb.hand], name: playerb.name, health: playerb.health, id: playerb.id, maxhp: playerb.maxhp });
            }
          }
        }
      }

      let bo = [];
      for (bot of bots) {
        if (bot) {
          if (Math.abs(playera.y - bot.y) <= 3000) {
            if (Math.hypot(bot.x - playera.x, bot.y - playera.y) <= 5500) {
              bo.push(bot);
            }
          }
        }
      }

      let b = [];
      for (bullet of bullets) {
        if (Math.abs(playera.y - bullet.y) <= 3000) {
          if (Math.hypot(bullet.x - playera.x, bullet.y - playera.y) <= 5500) {
            b.push({ x: bullet.x, y: bullet.y });
          }
        }
      }

      let di = [];
      for ([i, item] of dropitem.entries()) {
        if (Math.abs(playera.y - item.y) <= 3000) {
          if (Math.hypot(item.x - playera.x, item.y - playera.y) <= 5500) {
            di.push(item);
            if (Math.hypot(item.x - (playera.x - 250), item.y - (playera.y - 250)) <= 400) {
              if (item.item === 'ammosmall') {
                if (playera.ammo < playera.maxammo) {
                  dropitem.splice(i, 1);
                  playera.ammo = clamp(playera.ammo + 10, 0, playera.maxammo)
                }
              } else if (item.item === 'ammolarge') {
                if (playera.ammo < playera.maxammo) {
                  dropitem.splice(i, 1);
                  playera.ammo = clamp(playera.ammo + 30, 0, playera.maxammo)
                }
              } else {
                if (playera.inventory.includes('empty')) {
                  dropitem.splice(i, 1);
                  let f = false;
                  playera.inventory.map((e, s) => {
                    if (e === 'empty' && f === false) {
                      f = true;
                      playera.inventory[s] = item.item;
                    }
                  })
                }
              }
            }
          }
        }
      }

      io.to(playera.sid).emit('p', l, b, playera, di, bo);
    }
  }

  if (dropitem.length > 20) {
    dropitem.shift();
  }

  for (item of dropitem) {
    let om = oindex.within(item.x, item.y, 550);

    om.map(oid => {
      object = objects[oid];
      let ic = new C(new V(item.x, item.y), 250);
      let oc = new B(new V(object.x, object.y), 500, 500).toPolygon();
      let response = new SAT.Response();
      let collided = SAT.testCirclePolygon(ic, oc, response);
      if (collided) {
        if (clist.includes(object.tt)) {
          let overlapV = response.overlapV.clone().scale(-1.5);
          item.x += overlapV.x;
          item.y += overlapV.y;
        }
      }
    });
  }

  if (bots.length < -1) {
    let rd = Math.floor(Math.random() * 10) + 1;

    if (rd <= 5) {
      bots.push({ x: (12 * 500) + ((36 * 500) * Math.random()), y: (12 * 500) + ((36 * 500) * Math.random()), r: 0, weapon: 'pistol', bt: performance.now(), health: 80, name: 'Sentry', color: 'rgb(255,127,127)', maxhp: 80, regen: 0.025 });
    }

    if (rd === 6 || rd === 7) {
      bots.push({ x: (12 * 500) + ((36 * 500) * Math.random()), y: (12 * 500) + ((36 * 500) * Math.random()), r: 0, weapon: 'ak', bt: performance.now(), health: 200, name: 'Trooper', color: 'rgb(127,64,255)', maxhp: 200, regen: 0.05 });
    }

    if (rd === 8 || rd === 9) {
      bots.push({ x: (12 * 500) + ((36 * 500) * Math.random()), y: (12 * 500) + ((36 * 500) * Math.random()), r: 0, weapon: 'shotgun', bt: performance.now(), health: 200, name: 'Trooper', color: 'rgb(127,64,255)', maxhp: 200, regen: 0.05 });
    }

    if (rd === 10) {
      bots.push({ x: (12 * 500) + ((36 * 500) * Math.random()), y: (12 * 500) + ((36 * 500) * Math.random()), r: 0, weapon: 'boltaction', bt: performance.now(), health: 300, name: 'Elite', color: 'rgb(255, 200, 0)', maxhp: 300, regen: 0.1 });
    }
  }

  for (bot of bots) {
    for (player of players) {
      if (player) {
        if (Math.abs(bot.y - player.y) <= 3000) {
          if (Math.hypot(player.x - bot.x, player.y - bot.y) <= 5500) {
            bot.r = Math.atan2(player.y - bot.y, player.x - bot.x) - radians(90);


            if (Math.hypot(player.x - bot.x, player.y - bot.y) >= 2000) {
              if (bot.name === 'Trooper') {

                let p = pathfind.findPath(bot.x, bot.y, player.x, player.y, 200);

                if (p[2] && p[3]) {
                  let mx = clamp(p[2] - bot.x, -5, 5);
                  let my = clamp(p[3] - bot.y, -5, 5);
                  bot.x += mx;
                  bot.y += my;
                }
              }
            }

            if (bot.name === 'Elite') {
              if (Math.hypot(player.x - bot.x, player.y - bot.y) <= 4000) {
                let p = pathfind.findPath(bot.x, bot.y, lerp2d(player.x, bot.x, 2), lerp2d(player.y, bot.y, 2), 200);

                if (p[2] && p[3]) {
                  let mx = clamp(p[2] - bot.x, -20, 20);
                  let my = clamp(p[3] - bot.y, -20, 20);
                  bot.x += mx;
                  bot.y += my;
                }
              } else if (Math.hypot(player.x - bot.x, player.y - bot.y) >= 4300) {
                let p = pathfind.findPath(bot.x, bot.y, player.x, player.y, 200);

                if (p[2] && p[3]) {
                  let mx = clamp(p[2] - bot.x, -20, 20);
                  let my = clamp(p[3] - bot.y, -20, 20);
                  bot.x += mx;
                  bot.y += my;
                }
              }
            }

            if (bot.weapon === 'pistol') {
              if (performance.now() - (1000 / 2) >= bot.bt) {
                bot.bt = performance.now();
                let r = bot.r + radians(90);
                let barrel = 400;
                let bx = bot.x + (barrel * Math.cos(r));
                let by = bot.y + (barrel * Math.sin(r));
                bullets.push({ x: bx, y: by, speed: 180, angle: r + radians((Math.random() - 0.5) * 6), age: 0, damage: 30 });
              }
            }

            if (bot.weapon === 'ak') {
              if (performance.now() - (1000 / 10) >= bot.bt) {
                bot.bt = performance.now();
                let r = bot.r + radians(90);
                let barrel = 700;
                let bx = bot.x + (barrel * Math.cos(r));
                let by = bot.y + (barrel * Math.sin(r));
                bullets.push({ x: bx, y: by, speed: 160, angle: r + radians((Math.random() - 0.5) * 20), age: 0, damage: 10 });
              }
            }

            if (bot.weapon === 'shotgun') {
              if (performance.now() - (1000 / 1) >= bot.bt) {
                bot.bt = performance.now();
                let r = bot.r + radians(90);
                let barrel = 700;
                let bx = bot.x + (barrel * Math.cos(r));
                let by = bot.y + (barrel * Math.sin(r));
                for (i = 0; i < 8; i++) {
                  bullets.push({ x: bx, y: by, speed: 100 + (80 * Math.random()), angle: r + radians((Math.random() - 0.5) * 30), age: 0, damage: 10 });
                }
              }
            }

            if (bot.weapon === 'boltaction') {
              if (performance.now() - (1000 / 1) >= bot.bt) {
                bot.bt = performance.now();
                let r = bot.r + radians(90);
                let barrel = 780;
                let bx = bot.x + (barrel * Math.cos(r));
                let by = bot.y + (barrel * Math.sin(r));
                bullets.push({ x: bx, y: by, speed: 300, angle: r + radians((Math.random() - 0.5) * 6), age: 0, damage: 60 });
              }
            }

          }
        }
      }
    }

    if (bot.health < bot.maxhp) {
      bot.health += bot.regen;
    }

    let om = oindex.within(bot.x, bot.y, 550);

    om.map(oid => {
      object = objects[oid];
      let pc = new C(new V(bot.x, bot.y), 250);
      let oc = new B(new V(object.x, object.y), 500, 500).toPolygon();

      let response = new SAT.Response();
      let collided = SAT.testCirclePolygon(pc, oc, response);
      if (collided) {
        if (clist.includes(object.tt)) {
          let overlapV = response.overlapV.clone().scale(-1.1);
          bot.x += overlapV.x;
          bot.y += overlapV.y;
        }
      }
    });

  }
}, 1000 / 60);



function removeeffect(id, effect) {
  if (players[id]) {
    players[id].effects.map((e, i) => {
      if (e === effect) {
        players[id].effects.splice(i, 1);
      }
    });
  }
}

io.on('connection', (socket) => {
  let id;

  socket.emit('o', objects);

  socket.emit('tmap', tmap);

  socket.on('join', function(name) {
    if (!players[id]) {
      if (isWhitespace(name)) {
        name = 'idiot';
      }
      name = name.substring(0, 20);
      id = players.length;
      players.push({ x: (51 * 500) + ((6 * 500) * Math.random()), y: (45 * 500) + ((6 * 500) * Math.random()), id: id, r: 0, sid: socket.id, inventory: ['pistol', 'capacityboost', 'empty', 'empty', 'empty'], hand: 0, name: name, health: 100, effects: ['Invincible'], speed: 20, speed2: 20, maxhp: 100, ammo: 20, maxammo: 200 });
      socket.emit('name', name);
      socket.emit('id', id);
      console.log('a user connected');
      setTimeout(function() {
        removeeffect(id, 'Invincible')
      }, 15000);

    }
  });

  socket.on('ping', function() {
    socket.emit('pong');
  });

  socket.on('r', function(r) {
    if (players[id]) {
      players[id].r = r;
    }
  });

  socket.on('h', function(h) {
    if (players[id]) {
      players[id].hand = h;
    }
  });

  let st = performance.now();


  socket.on('s', function() {
    if (players[id]) {
      if (performance.now() - (1000 * 1) >= st) {
        st = performance.now();
        let psp = (players[id].speed2 * 2);
        players[id].speed = psp;
        players[id].speed2 = psp;
        setTimeout(function() {
          if (players[id]) {
            if (players[id]) {
              players[id].speed = (psp / 2);
            }
          }
        }, 600);

        setTimeout(function() {
          if (players[id]) {
            players[id].speed2 = (players[id].speed2 / 2);
          }
        }, 500);
      }
    }
  });

  socket.on('drop', function(h) {
    let d = players[id].inventory[h];
    if (d) {
      if (d !== 'empty') {
        let r = players[id].r + radians(90);
        players[id].inventory[h] = 'empty';
        let bx = players[id].x - 250 + (800 * Math.cos(r));
        let by = players[id].y - 250 + (800 * Math.sin(r));

        dropitem.push({ x: bx, y: by, item: d });
      }
    }
  });

  let bt = performance.now();

  socket.on('shoot', function() {
    if (players[id]) {
      let item = players[id].inventory[players[id].hand];


      let dboost = 0;

      if (players[id].inventory.includes('damageboost')) {
        dboost = 20;
      }

      if (item === 'pistol') {
        removeeffect(id, 'Invincible');
        pistol();
      }
      if (item === 'ak') {
        removeeffect(id, 'Invincible');
        ak();
      }
      if (item === 'shotgun') {
        removeeffect(id, 'Invincible');
        shotgun();
      }
      if (item === 'boltaction') {
        removeeffect(id, 'Invincible');
        boltaction();
      }
      if (item === 'healthpack') {
        for ([h, d] of players[id].inventory.entries()) {
          if (d === 'healthpack') {
            let r = radians(Math.random() * 360);
            pp.inventory[h] = 'empty';
            let bx = players[id].x - 250 + (800 * Math.cos(r));
            let by = players[id].y - 250 + (800 * Math.sin(r));

            dropitem.push({ x: bx, y: by, item: d });
          }
        }
        players[id].health = clamp(playera.health + 60, 0, playera.maxhp);
      }
    }


    function pistol() {
      if (performance.now() - (1000 / 2) >= bt && players[id].ammo >= 1) {
        players[id].ammo--;
        bt = performance.now();
        let r = players[id].r + radians(90);
        let barrel = 400;
        bx = players[id].x + (barrel * Math.cos(r));
        by = players[id].y + (barrel * Math.sin(r));
        bullets.push({ x: bx, y: by, speed: 180, angle: r + radians((Math.random() - 0.5) * 6), age: 0, damage: 30 });
      }
    }

    function ak() {
      if (performance.now() - (1000 / 10) >= bt && players[id].ammo >= 1) {
        players[id].ammo--;
        bt = performance.now();
        let r = players[id].r + radians(90);
        let barrel = 700;
        bx = players[id].x + (barrel * Math.cos(r));
        by = players[id].y + (barrel * Math.sin(r));
        bullets.push({ x: bx, y: by, speed: 160, angle: r + radians((Math.random() - 0.5) * 20), age: 0, damage: 10 });
      }
    }

    function boltaction() {
      if (performance.now() - (1000 / 1) >= bt && players[id].ammo >= 1) {
        players[id].ammo--;
        bt = performance.now();
        let r = players[id].r + radians(90);
        let barrel = 780;
        bx = players[id].x + (barrel * Math.cos(r));
        by = players[id].y + (barrel * Math.sin(r));
        bullets.push({ x: bx, y: by, speed: 300, angle: r + radians((Math.random() - 0.5) * 6), age: 0, damage: 60 });
      }
    }

    function shotgun() {
      if (performance.now() - (1000 / 1) >= bt && players[id].ammo >= 8) {
        players[id].ammo -= 8;
        bt = performance.now();
        let r = players[id].r + radians(90);
        let barrel = 700;
        bx = players[id].x + (barrel * Math.cos(r));
        by = players[id].y + (barrel * Math.sin(r));
        for (i = 0; i < 8; i++) {
          bullets.push({ x: bx, y: by, speed: 100 + (80 * Math.random()), angle: r + radians((Math.random() - 0.5) * 30), age: 0, damage: 10 });
        }
      }
    }

  });

  let pard = 10;

  socket.on('m', function(x, y) {

    function col() {
      let om = oindex.within(players[id].x, players[id].y, 550);

      om.map(oid => {
        object = objects[oid];

        let pc = new C(new V(players[id].x, players[id].y), 250);
        let oc = new B(new V(object.x, object.y), 500, 500).toPolygon();
        let response = new SAT.Response();
        let collided = SAT.testCirclePolygon(pc, oc, response);
        if (collided) {
          if (clist.includes(object.tt)) {
            let overlapV = response.overlapV.clone().scale(-1.5);
            players[id].x += overlapV.x;
            players[id].y += overlapV.y;
          }
        }
      });
    }

    if (pard < 10) {
      pard += 1 / 3;
    }

    if (players[id]) {
      if (Math.abs(players[id].x - x) <= players[id].speed && Math.abs(players[id].y - y) <= players[id].speed) {
        players[id].x = x;
        players[id].y = y;
      } else if (pard > 0 && (Math.abs(players[id].x - x) <= players[id].speed * 2 && Math.abs(players[id].y - y) <= players[id].speed * 2)) {
        pard--;
        players[id].x = x;
        players[id].y = y;
      } else {
        socket.emit('c', players[id]);
      }
      col();
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
    if (id) {
      players[id] = null;
    }
  });

});