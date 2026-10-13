const COLS = 21, ROWS = 13;
const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
const PNAMES = ['Chị Châu', 'Em Voi', 'Bố Hoàn', 'Mẹ Trang'];
const AVATARS = [
  'anhnhanvat/chi chau.jpg',
  'anhnhanvat/em voi.jpg',
  'anhnhanvat/bo Hoan.jpg',
  'anhnhanvat/me Trang.jpg',
];

class Game {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.maze = null;
    this.audio = new AudioManager();
    this.cs = 32;
    this.startH = 0;
    this.finishH = 0;
    this.dpr = 1;

    this.phase = 'menu';
    this.players = [];
    this.curIdx = 0;
    this.turnPhase = 'roll';
    this.steps = 0;
    this.dice = 0;
    this.diceRolling = false;
    this.rankings = [];
    this.highlights = [];
    this.monsters = [];
    this.hoverCell = null;
    this.actionTip = null;
    this._raf = null;
    this._loopRunning = false;
    this._pulseT = 0;
    this.avatarImgs = [];
  }

  get cur() { return this.players[this.curIdx]; }

  init() {
    this.canvas = document.getElementById('maze-canvas');
    this.ctx = this.canvas.getContext('2d');
    this._loadAvatars();
    this._menuEvents();
    this._gameEvents();
    this.showScreen('menu');
  }

  _loadAvatars() {
    AVATARS.forEach((src, i) => {
      const img = new Image();
      img.src = src;
      this.avatarImgs[i] = img;
    });
  }

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id + '-screen').classList.add('active');
    if (id === 'game') this._startLoop(); else this._stopLoop();
  }

  /* ══════ Menu ══════ */
  _menuEvents() {
    let num = 2;
    document.querySelectorAll('.player-select button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.player-select button').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        num = +btn.dataset.players;
        this.audio.init(); this.audio.click();
      });
    });
    document.querySelector('.player-select button').classList.add('selected');
    document.getElementById('start-btn').addEventListener('click', () => {
      this.audio.init(); this.audio.gateEnter(); this._startGame(num);
    });
    document.getElementById('replay-btn').addEventListener('click', () => {
      this.audio.click(); this.showScreen('menu');
    });
    document.getElementById('sound-btn').addEventListener('click', () => {
      this.audio.init();
      document.getElementById('sound-btn').textContent = this.audio.toggle() ? '🔊' : '🔇';
    });
  }

  /* ══════ Game Events ══════ */
  _gameEvents() {
    document.getElementById('roll-btn').addEventListener('click', () => {
      if (this.phase === 'playing' && this.turnPhase === 'roll' && !this.diceRolling) this._roll();
    });

    const click = (x, y) => {
      this.audio.init();
      if (this.phase === 'gateSelect') this._gateClick(x, y);
      else if (this.phase === 'playing') this._playClick(x, y);
    };
    this.canvas.addEventListener('click', e => {
      const r = this.canvas.getBoundingClientRect();
      click((e.clientX - r.left) * (this.canvas.width / this.dpr / r.width),
            (e.clientY - r.top) * (this.canvas.height / this.dpr / r.height));
    });
    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault(); this.audio.init();
      const t = e.touches[0], r = this.canvas.getBoundingClientRect();
      click((t.clientX - r.left) * (this.canvas.width / this.dpr / r.width),
            (t.clientY - r.top) * (this.canvas.height / this.dpr / r.height));
    }, { passive: false });

    this.canvas.addEventListener('mousemove', e => {
      const r = this.canvas.getBoundingClientRect();
      this.hoverCell = this._pxToCell(
        (e.clientX - r.left) * (this.canvas.width / this.dpr / r.width),
        (e.clientY - r.top) * (this.canvas.height / this.dpr / r.height));
    });
    this.canvas.addEventListener('mouseleave', () => { this.hoverCell = null; });

    document.addEventListener('keydown', e => {
      if (this.phase !== 'playing') return;
      if (this.turnPhase === 'roll') {
        if (e.key === ' ') { e.preventDefault(); if (!this.diceRolling) this._roll(); }
        else if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
          e.preventDefault(); this._guide('Tung xúc xắc trước! Nhấn Space hoặc nút Tung.');
        }
        return;
      }
      if (this.steps <= 0) return;
      const p = this.cur;
      if (!p || p.row < 0) return;
      let dr = 0, dc = 0;
      if (e.key === 'ArrowUp') dr = -1;
      else if (e.key === 'ArrowDown') dr = 1;
      else if (e.key === 'ArrowLeft') dc = -1;
      else if (e.key === 'ArrowRight') dc = 1;
      else return;
      e.preventDefault();
      if (dr === 1 && this.maze.canExit(p.row, p.col)) { this._finish(p); return; }
      const tr = p.row + dr, tc = p.col + dc;
      if (tr < 0 || tr >= ROWS || tc < 0 || tc >= COLS) {
        this.audio.wallBump(); this._guide('Không thể đi ra ngoài mê cung!'); return;
      }
      const canWalk = this.maze.canMove(p.row, p.col, tr, tc);
      const canGhost = p.ghostSteps > 0;
      if (canWalk || canGhost) this._tryMove(tr, tc);
      else { this.audio.wallBump(); this._guide('Có tường chắn! Thử hướng khác.'); }
    });

    const onResize = () => { if (this.phase !== 'menu') this._sizeCanvas(); };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 150));
  }

  /* ══════ Start ══════ */
  _startGame(n) {
    this.maze = new Maze(COLS, ROWS).generate();
    this.monsters = this.maze.monsters;
    this.players = [];
    for (let i = 0; i < n; i++) {
      this.players.push({
        id: i, name: PNAMES[i], color: COLORS[i],
        row: -1, col: -1, gate: null,
        skipTurn: false, hasSword: false, hasShield: false, ghostSteps: 0,
        finished: false, rank: 0,
      });
    }
    this.curIdx = 0; this.rankings = [];
    this.steps = 0; this.dice = 0;
    this.turnPhase = 'roll'; this.actionTip = null;
    this.phase = 'gateSelect';
    this._sizeCanvas(); this.showScreen('game');
    this._ui();
    this.msg(this.cur.name + ', chọn cửa vào mê cung!');
  }

  _sizeCanvas() {
    const uiH = 110;
    const mw = window.innerWidth - 20;
    const mh = window.innerHeight - uiH;
    const csW = Math.floor(mw / COLS);
    const csH = Math.floor(mh / (ROWS + 2.6));
    this.cs = Math.max(Math.min(csW, csH), 16);
    this.startH = Math.floor(this.cs * 1.2);
    this.finishH = Math.floor(this.cs * 1.4);
    this.dpr = window.devicePixelRatio || 1;
    const lw = COLS * this.cs, lh = this.startH + ROWS * this.cs + this.finishH;
    this.canvas.width = lw * this.dpr;
    this.canvas.height = lh * this.dpr;
    this.canvas.style.width = lw + 'px';
    this.canvas.style.height = lh + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  /* ══════ Loop ══════ */
  _startLoop() {
    if (this._loopRunning) return;
    this._loopRunning = true;
    const loop = () => {
      if (!this._loopRunning) return;
      this._pulseT = (this._pulseT + 0.03) % (Math.PI * 2);
      if (this.actionTip) {
        this.actionTip.timer--;
        if (this.actionTip.timer < 30) this.actionTip.alpha = this.actionTip.timer / 30;
        if (this.actionTip.timer <= 0) this.actionTip = null;
      }
      this._render();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }
  _stopLoop() { this._loopRunning = false; if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; } }

  /* ══════ Tooltip ══════ */
  _showTip(row, col, emoji, title, desc) {
    this.actionTip = { row, col, emoji, title, desc, timer: 130, alpha: 1 };
  }

  /* ══════ Gate Selection ══════ */
  _gateClick(x, y) {
    const cs = this.cs;
    for (const g of this.maze.gates) {
      if (Math.hypot(x - (g.col * cs + cs / 2), y - (this.startH - cs * 0.2)) < cs * 0.9) {
        if (this.players.some(p => p.gate === g.index && p !== this.cur)) {
          this.msg('Cửa này đã có người chọn!'); this.audio.wallBump(); return;
        }
        const p = this.cur;
        p.gate = g.index; p.row = g.row; p.col = g.col;
        this.audio.gateEnter();
        this.msg(p.name + ' chọn Cửa ' + (g.index + 1) + '!');
        this.curIdx++;
        if (this.curIdx >= this.players.length) {
          this.curIdx = 0; this.phase = 'playing'; this.turnPhase = 'roll';
          this.audio.turnStart();
          this.msg('Bắt đầu! ' + this.cur.name + ' tung xúc xắc!');
        } else {
          this.msg(this.cur.name + ', chọn cửa vào!');
        }
        this._ui(); return;
      }
    }
    this._guide('Nhấn vào 1 trong 10 cửa vòm phía trên mê cung!');
  }

  /* ══════ Dice ══════ */
  _roll() {
    const p = this.cur;
    if (p.skipTurn) {
      p.skipTurn = false;
      this.msg(p.name + ' bị mất lượt!');
      this.audio.trap();
      setTimeout(() => this._endTurn(), 1200); this._ui(); return;
    }
    this.diceRolling = true; this.audio.diceRoll();
    const el = document.getElementById('dice');
    el.classList.add('rolling');
    let n = 0;
    const iv = setInterval(() => {
      this.dice = Math.floor(Math.random() * 6) + 1;
      el.textContent = this.dice;
      if (++n >= 14) {
        clearInterval(iv); el.classList.remove('rolling');
        this.diceRolling = false; this.steps = this.dice;
        this.turnPhase = 'move'; this._updateHL(); this._ui();
        this.msg(p.name + ' được ' + this.dice + ' bước!');
      }
    }, 65);
  }

  /* ══════ Movement ══════ */
  _playClick(x, y) {
    const p = this.cur;
    if (!p) return;
    if (this.diceRolling) { this._guide('Xúc xắc đang quay, chờ chút...'); return; }
    if (this.turnPhase === 'roll') {
      this._guide('Nhấn "Tung Xúc Xắc" hoặc phím Space để tung!');
      return;
    }
    if (this.steps <= 0) { this._guide('Đã hết bước! Chờ lượt tiếp theo...'); return; }
    this._moveClick(x, y);
  }

  _moveClick(x, y) {
    const p = this.cur;
    if (!p || p.row < 0) return;
    if (this.maze.canExit(p.row, p.col)) {
      const ey = this.startH + ROWS * this.cs, ex = this.maze.exit.col * this.cs;
      if (x >= ex && x < ex + this.cs && y >= ey) { this._finish(p); return; }
    }
    const cell = this._pxToCell(x, y);
    if (!cell) {
      if (this.maze.canExit(p.row, p.col) && y > this.startH + ROWS * this.cs)
        this._guide('Nhấn vào ô ĐÍCH phía dưới để về đích!');
      return;
    }
    const dist = Math.abs(p.row - cell.row) + Math.abs(p.col - cell.col);
    if (dist === 0) { this._guide('Nhấn vào ô kế bên để di chuyển!'); return; }
    if (dist > 1) { this._guide('Chỉ đi được 1 ô mỗi lần! Nhấn ô sáng kế bên.'); this.audio.wallBump(); return; }
    const canWalk = this.maze.canMove(p.row, p.col, cell.row, cell.col);
    const canGhost = p.ghostSteps > 0;
    if (canWalk || canGhost) { this._tryMove(cell.row, cell.col); return; }
    this.audio.wallBump();
    this._guide('Có tường chắn! Chọn ô sáng khác hoặc dùng 💣 phá tường.');
  }

  _tryMove(r, c) {
    const p = this.cur;
    const monster = this.monsters.find(m => m.row === r && m.col === c && m.alive);
    if (monster) {
      if (p.hasSword) {
        monster.alive = false; p.hasSword = false;
        this._showTip(r, c, '🗡️', 'Tiêu diệt!', 'Quái vật đã bị hạ gục!');
        this.audio.itemPickup();
      } else if (p.hasShield) {
        p.hasShield = false;
        this._showTip(r, c, '🛡️', 'Khiên bảo vệ!', 'Đỡ đòn quái vật!');
        this.audio.move();
      } else {
        this.steps = Math.max(0, this.steps - 2);
        this._showTip(r, c, '👹', 'Quái tấn công!', 'Bị mất 2 bước!');
        this.audio.trap();
      }
    }
    this._move(r, c);
  }

  _move(r, c) {
    const p = this.cur;
    p.row = r; p.col = c;
    this.steps--;
    this.audio.move();
    if (p.ghostSteps > 0) p.ghostSteps--;

    const cell = this.maze.grid[r][c];
    if (cell.item) { this._item(p, cell.item, r, c); cell.item = null; }

    if (this.maze.canExit(r, c)) {
      this._updateHL(); this._ui();
      this.msg(p.name + ' đã tới lối ra! Bước xuống để về đích!');
      return;
    }
    if (this.maze.isDeadEnd(r, c)) this.msg('Ngõ cụt! Quay lại!');

    if (this.steps <= 0) setTimeout(() => this._endTurn(), 400);
    else this._updateHL();
    this._ui();
  }

  _finish(p) {
    p.finished = true; this.rankings.push(p); p.rank = this.rankings.length;
    this.audio.victory();
    this.msg('🏆 ' + p.name + ' về đích thứ ' + p.rank + '!');
    const left = this.players.filter(q => !q.finished);
    if (left.length <= 1) {
      if (left.length === 1) { left[0].finished = true; this.rankings.push(left[0]); left[0].rank = this.rankings.length; }
      setTimeout(() => this._victory(), 2000);
    } else { setTimeout(() => this._endTurn(), 1200); }
    this._ui();
  }

  _endTurn() {
    let nx = (this.curIdx + 1) % this.players.length, c = 0;
    while (this.players[nx].finished && c < this.players.length) { nx = (nx + 1) % this.players.length; c++; }
    if (c >= this.players.length) { this._victory(); return; }
    this.curIdx = nx; this.turnPhase = 'roll';
    this.steps = 0; this.dice = 0; this.highlights = [];
    this.audio.turnStart(); this._ui();
    this.msg('Lượt của ' + this.cur.name + '! Tung xúc xắc!');
  }

  /* ══════ Items ══════ */
  _item(p, item, r, c) {
    switch (item.type) {
      case 'boots':
        this.steps += 3; this.audio.itemPickup();
        this._showTip(r, c, item.emoji, item.name, '+3 bước!');
        break;
      case 'star':
        this.steps += 2; this.audio.itemPickup();
        this._showTip(r, c, item.emoji, item.name, '+2 bước!');
        break;
      case 'double':
        this.steps += this.dice; this.audio.itemPickup();
        this._showTip(r, c, item.emoji, item.name, 'x2 số bước! +' + this.dice);
        break;
      case 'bomb': {
        const dir = this.maze.breakWall(r, c);
        this.audio.itemPickup();
        this._showTip(r, c, item.emoji, 'BOOM!', dir ? 'Phá tường thành công!' : 'Không có tường để phá!');
        break;
      }
      case 'sword':
        p.hasSword = true; this.audio.itemPickup();
        this._showTip(r, c, item.emoji, item.name, 'Sẵn sàng diệt quái!');
        break;
      case 'shield':
        p.hasShield = true; this.audio.itemPickup();
        this._showTip(r, c, item.emoji, item.name, 'Bảo vệ khỏi 1 hiệu ứng xấu!');
        break;
      case 'ghost':
        p.ghostSteps = 3; this.audio.itemPickup();
        this._showTip(r, c, item.emoji, item.name, 'Xuyên tường 3 bước!');
        break;
      case 'swap': {
        const others = this.players.filter(q => q !== p && !q.finished && q.row >= 0);
        if (others.length > 0) {
          const t = others[Math.floor(Math.random() * others.length)];
          const tr = p.row, tc = p.col;
          p.row = t.row; p.col = t.col; t.row = tr; t.col = tc;
          this.audio.itemPickup();
          this._showTip(t.row, t.col, item.emoji, 'Hoán đổi!', 'Đổi chỗ với ' + t.name + '!');
        } else {
          this.audio.move();
          this._showTip(r, c, item.emoji, item.name, 'Không có ai để đổi!');
        }
        break;
      }
      case 'pit':
        if (p.hasShield) {
          p.hasShield = false; this.audio.itemPickup();
          this._showTip(r, c, '🛡️', 'Khiên bảo vệ!', 'Miễn nhiễm hố sập!');
        } else {
          const gate = this.maze.gates[p.gate];
          p.row = gate.row; p.col = gate.col; this.steps = 0;
          this.audio.trap();
          this._showTip(gate.row, gate.col, item.emoji, 'Hố Sập!', 'Quay về cửa vào!');
        }
        break;
      case 'freeze':
        if (p.hasShield) {
          p.hasShield = false; this.audio.itemPickup();
          this._showTip(r, c, '🛡️', 'Khiên bảo vệ!', 'Miễn nhiễm đông băng!');
        } else {
          p.skipTurn = true; this.audio.trap();
          this._showTip(r, c, item.emoji, item.name, 'Mất lượt tiếp theo!');
        }
        break;
    }
  }

  /* ══════ Victory ══════ */
  _victory() {
    this.phase = 'victory'; this._stopLoop();
    const w = this.rankings[0];
    document.getElementById('winner-info').innerHTML =
      '<img class="winner-avatar" src="' + AVATARS[w.id] + '" style="border-color:' + w.color + '">' +
      '<span style="color:' + w.color + '">' + w.name + '</span> chiến thắng!';
    const rd = document.getElementById('rankings');
    const medals = ['🥇', '🥈', '🥉', '4️⃣'];
    rd.innerHTML = '<h2>Bảng Xếp Hạng</h2>' +
      this.rankings.map((p, i) =>
        '<div class="rank-item"><span>' + (medals[i] || (i + 1)) + '</span>' +
        '<img class="rank-avatar" src="' + AVATARS[p.id] + '" style="border-color:' + p.color + '">' +
        '<span style="color:' + p.color + '">' + p.name + '</span></div>'
      ).join('');
    this._confetti(); this.showScreen('victory');
  }

  _confetti() {
    const c = document.getElementById('confetti');
    c.width = window.innerWidth; c.height = window.innerHeight;
    c.style.display = 'block';
    const ctx = c.getContext('2d');
    const bits = [];
    for (let i = 0; i < 120; i++)
      bits.push({ x: Math.random() * c.width, y: Math.random() * -c.height,
        w: 6 + Math.random() * 6, h: 4 + Math.random() * 4,
        color: ['#e74c3c','#3498db','#2ecc71','#f39c12','#ffd700','#e056fd'][Math.floor(Math.random() * 6)],
        vy: 2 + Math.random() * 3, vx: (Math.random() - .5) * 2, rot: Math.random() * 360, vr: (Math.random() - .5) * 10 });
    let f = 0;
    const anim = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      bits.forEach(b => {
        b.y += b.vy; b.x += b.vx; b.rot += b.vr;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot * Math.PI / 180);
        ctx.fillStyle = b.color; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore();
      });
      if (++f < 200) requestAnimationFrame(anim);
      else { ctx.clearRect(0, 0, c.width, c.height); c.style.display = 'none'; }
    };
    requestAnimationFrame(anim);
  }

  /* ══════ Highlights ══════ */
  _updateHL() {
    this.highlights = [];
    const p = this.cur;
    if (!p || p.row < 0 || this.steps <= 0) return;

    let cells = this.maze.getNeighbors(p.row, p.col);
    if (p.ghostSteps > 0) {
      [[p.row-1,p.col],[p.row+1,p.col],[p.row,p.col-1],[p.row,p.col+1]].forEach(([r,c]) => {
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS && !cells.some(n => n.row === r && n.col === c))
          cells.push({ row: r, col: c });
      });
    }
    this.highlights = cells.map(n => ({ row: n.row, col: n.col }));
    if (this.maze.canExit(p.row, p.col))
      this.highlights.push({ row: ROWS, col: this.maze.exit.col, fin: true });
  }

  /* ══════ Coordinates ══════ */
  _pxToCell(x, y) {
    const c = Math.floor(x / this.cs), r = Math.floor((y - this.startH) / this.cs);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    return { row: r, col: c };
  }

  /* ══════ Render ══════ */
  _render() {
    const ctx = this.ctx, cs = this.cs;
    const W = COLS * cs, H = this.startH + ROWS * cs + this.finishH;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, W, H);
    this._rStartArea(); this._rMazeCells(); this._rGates();
    this._rMonsters(); this._rItems(); this._rHL();
    this._rExit(); this._rFinishArea(); this._rPlayers();
    this._rTooltip();
  }

  _rStartArea() {
    const ctx = this.ctx, cs = this.cs, W = COLS * cs;
    ctx.fillStyle = '#141825'; ctx.fillRect(0, 0, W, this.startH);
    ctx.fillStyle = '#d4a458';
    ctx.font = 'bold ' + Math.max(10, this.startH * 0.35) + 'px "Segoe UI",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('VẠCH XUẤT PHÁT', W / 2, this.startH * 0.35);
    ctx.strokeStyle = '#d4a458'; ctx.lineWidth = 2; ctx.setLineDash([8, 4]);
    ctx.beginPath(); ctx.moveTo(0, this.startH - 1); ctx.lineTo(W, this.startH - 1); ctx.stroke();
    ctx.setLineDash([]);
  }

  _rMazeCells() {
    const ctx = this.ctx, cs = this.cs;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * cs, y = this.startH + r * cs;
        ctx.fillStyle = '#c4a882'; ctx.fillRect(x, y, cs, cs);
        ctx.strokeStyle = '#b89e7833'; ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 2, y + 2, cs - 4, cs - 4);
        const cell = this.maze.grid[r][c];
        ctx.strokeStyle = '#594a3c'; ctx.lineWidth = 3;
        if (cell.walls.top)    { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cs, y); ctx.stroke(); }
        if (cell.walls.right)  { ctx.beginPath(); ctx.moveTo(x + cs, y); ctx.lineTo(x + cs, y + cs); ctx.stroke(); }
        if (cell.walls.bottom) { ctx.beginPath(); ctx.moveTo(x, y + cs); ctx.lineTo(x + cs, y + cs); ctx.stroke(); }
        if (cell.walls.left)   { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + cs); ctx.stroke(); }
        if (this.maze.isDeadEnd(r, c) && !cell.item && !this.monsters.some(m => m.row === r && m.col === c && m.alive)) {
          ctx.globalAlpha = 0.3;
          ctx.font = Math.max(10, cs * 0.4) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ff6666'; ctx.fillText('⚠', x + cs / 2, y + cs / 2);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  _rGates() {
    const ctx = this.ctx, cs = this.cs;
    for (const g of this.maze.gates) {
      const x = g.col * cs, y = this.startH;
      const taken = this.players.some(p => p.gate === g.index);
      const avail = this.phase === 'gateSelect' && !taken;
      ctx.fillStyle = avail ? '#c4a882' : '#3d3229';
      ctx.fillRect(x + 2, y - 2, cs - 4, 5);
      const hov = this.hoverCell && Math.abs(this.hoverCell.col - g.col) < 1 && this.hoverCell.row <= 0 && avail;
      ctx.beginPath(); ctx.arc(x + cs / 2, y, cs * 0.42, Math.PI, 0);
      ctx.strokeStyle = avail ? (hov ? '#ffe0a0' : '#d4a458') : '#594a3c';
      ctx.lineWidth = avail ? 3 : 2; ctx.stroke();
      if (avail && hov) { ctx.fillStyle = 'rgba(212,164,88,0.15)'; ctx.fill(); }
      ctx.font = 'bold ' + Math.max(9, cs * 0.34) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = avail ? '#d4a458' : '#6b5d4e';
      ctx.fillText('' + (g.index + 1), x + cs / 2, y - 5);
    }
  }

  _rExit() {
    const ctx = this.ctx, cs = this.cs, ex = this.maze.exit;
    const x = ex.col * cs, y = this.startH + ROWS * cs;
    ctx.fillStyle = '#c4a882'; ctx.fillRect(x + 2, y - 3, cs - 4, 6);
    ctx.beginPath(); ctx.arc(x + cs / 2, y, cs * 0.42, 0, Math.PI);
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3; ctx.stroke();
    const pulse = 0.15 + Math.sin(this._pulseT * 2) * 0.1;
    const grad = ctx.createRadialGradient(x + cs / 2, y, 0, x + cs / 2, y, cs);
    grad.addColorStop(0, 'rgba(255,215,0,' + pulse + ')'); grad.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = grad; ctx.fillRect(x - cs / 2, y - cs / 2, cs * 2, cs);
  }

  _rFinishArea() {
    const ctx = this.ctx, cs = this.cs, y = this.startH + ROWS * cs;
    ctx.fillStyle = '#141825'; ctx.fillRect(0, y, COLS * cs, this.finishH);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold ' + Math.max(12, cs * 0.45) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🏆 ĐÍCH 🏆', COLS * cs / 2, y + this.finishH * 0.55);
  }

  _rMonsters() {
    const ctx = this.ctx, cs = this.cs;
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const x = m.col * cs, y = this.startH + m.row * cs;
      const cx = x + cs / 2, cy = y + cs / 2;
      const pulse = 0.15 + Math.sin(this._pulseT * 2 + m.row) * 0.08;
      ctx.fillStyle = 'rgba(231,76,60,' + pulse + ')';
      ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
      const bob = Math.sin(this._pulseT * 2 + m.row + m.col) * 2;
      ctx.font = Math.max(16, cs * 0.75) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('👹', cx, cy + bob);
    }
  }

  _rItems() {
    const ctx = this.ctx, cs = this.cs;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const item = this.maze.grid[r][c].item;
        if (!item) continue;
        const x = c * cs + cs / 2, y = this.startH + r * cs + cs / 2;
        const bob = Math.sin(this._pulseT * 1.5 + item.id) * 2;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, cs * 0.45);
        glow.addColorStop(0, 'rgba(255,255,255,0.18)');
        glow.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - cs / 2 + 2, y - cs / 2 + 2, cs - 4, cs - 4);
        ctx.font = Math.max(16, cs * 0.75) + 'px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(item.emoji, x, y + bob);
      }
  }

  _rHL() {
    const ctx = this.ctx, cs = this.cs;
    if (this.turnPhase !== 'move' || this.steps <= 0) return;
    const pulse = 0.18 + Math.sin(this._pulseT * 3) * 0.08;
    const p = this.cur;
    for (const h of this.highlights) {
      if (h.fin) {
        ctx.fillStyle = 'rgba(255,215,0,' + (pulse + 0.1) + ')';
        ctx.fillRect(h.col * cs, this.startH + ROWS * cs, cs, this.finishH);
      } else {
        const x = h.col * cs, y = this.startH + h.row * cs;
        const hov = this.hoverCell && this.hoverCell.row === h.row && this.hoverCell.col === h.col;
        const isGhost = p && p.ghostSteps > 0 && !this.maze.canMove(p.row, p.col, h.row, h.col);
        const clr = isGhost ? 'rgba(155,89,182,' : 'rgba(255,255,255,';
        ctx.fillStyle = hov ? clr + '0.4)' : clr + pulse + ')';
        ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
        ctx.strokeStyle = hov ? clr + '0.6)' : clr + (pulse + 0.15) + ')';
        ctx.lineWidth = hov ? 2.5 : 1.5;
        ctx.strokeRect(x + 1, y + 1, cs - 2, cs - 2);
      }
    }
  }

  _drawAvatar(px, py, rad, p, isCur) {
    const ctx = this.ctx;
    const img = this.avatarImgs[p.id];
    const isGhost = p.ghostSteps > 0;

    if (isCur) {
      const glow = 6 + Math.sin(this._pulseT * 2) * 3;
      ctx.beginPath(); ctx.arc(px, py, rad + glow, 0, Math.PI * 2);
      ctx.fillStyle = (isGhost ? '#9b59b6' : p.color) + '33'; ctx.fill();
    }
    ctx.beginPath(); ctx.ellipse(px, py + rad * 0.85, rad * 0.65, rad * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();

    ctx.globalAlpha = isGhost ? 0.55 : 1;
    ctx.save();
    ctx.beginPath(); ctx.arc(px, py, rad, 0, Math.PI * 2); ctx.closePath();

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.clip();
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - s) / 2, sy = 0;
      ctx.drawImage(img, sx, sy, s, s, px - rad, py - rad, rad * 2, rad * 2);
      ctx.restore();
      ctx.beginPath(); ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.strokeStyle = isCur ? '#fff' : p.color; ctx.lineWidth = isCur ? 3 : 2; ctx.stroke();
    } else {
      ctx.fillStyle = isGhost ? '#9b59b6' : p.color; ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.strokeStyle = isCur ? '#fff' : '#ddd'; ctx.lineWidth = isCur ? 2.5 : 1.5; ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold ' + Math.max(10, rad * 0.95) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('' + (p.id + 1), px, py + 1);
    }
    ctx.globalAlpha = 1;

    if (isCur) {
      ctx.font = 'bold ' + Math.max(8, rad * 0.55) + 'px "Segoe UI",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5;
      ctx.strokeText(p.name, px, py + rad + 3);
      ctx.fillText(p.name, px, py + rad + 3);
    }
  }

  _rPlayers() {
    const ctx = this.ctx, cs = this.cs;
    for (const p of this.players) {
      if (p.finished && this.phase !== 'gateSelect') { this._rFinP(p); continue; }
      if (p.finished) continue;
      let px, py;
      if (p.row < 0) {
        px = COLS * cs / (this.players.length + 1) * (p.id + 1);
        py = this.startH * 0.6;
      } else {
        px = p.col * cs + cs / 2;
        py = this.startH + p.row * cs + cs / 2;
      }
      const rad = cs * 0.38, isCur = p === this.cur;
      this._drawAvatar(px, py, rad, p, isCur);

      const icons = [];
      if (p.skipTurn)      icons.push('⛔');
      if (p.hasSword)      icons.push('🗡️');
      if (p.hasShield)     icons.push('🛡️');
      if (p.ghostSteps > 0) icons.push('👻');
      if (icons.length) {
        ctx.font = Math.max(7, cs * 0.24) + 'px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        icons.forEach((ic, i) => ctx.fillText(ic, px - (icons.length - 1) * 5 + i * 10, py - rad - 6));
      }
    }
  }

  _rFinP(p) {
    const ctx = this.ctx, cs = this.cs;
    const fin = this.rankings.filter(q => q.finished);
    const idx = fin.indexOf(p);
    const fx = COLS * cs / 2 + (idx - fin.length / 2 + 0.5) * cs * 1.4;
    const fy = this.startH + ROWS * cs + this.finishH * 0.35;
    const rad = cs * 0.32;
    const img = this.avatarImgs[p.id];

    ctx.save();
    ctx.beginPath(); ctx.arc(fx, fy, rad, 0, Math.PI * 2); ctx.closePath();
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.clip();
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - s) / 2, sy = 0;
      ctx.drawImage(img, sx, sy, s, s, fx - rad, fy - rad, rad * 2, rad * 2);
      ctx.restore();
      ctx.beginPath(); ctx.arc(fx, fy, rad, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2.5; ctx.stroke();
    } else {
      ctx.fillStyle = p.color; ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.arc(fx, fy, rad, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2; ctx.stroke();
    }

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold ' + Math.max(8, cs * 0.25) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('#' + p.rank, fx, fy - rad - 2);
  }

  /* ══════ Tooltip ══════ */
  _rTooltip() {
    const ctx = this.ctx, cs = this.cs;
    let tip = null;

    if (this.hoverCell && this.maze && this.hoverCell.row >= 0 && this.hoverCell.row < ROWS) {
      const hr = this.hoverCell.row, hc = this.hoverCell.col;
      const cell = this.maze.grid[hr][hc];
      if (cell.item)
        tip = { row: hr, col: hc, emoji: cell.item.emoji, title: cell.item.name, desc: cell.item.desc, alpha: 1 };
      const mon = this.monsters.find(m => m.row === hr && m.col === hc && m.alive);
      if (mon)
        tip = { row: hr, col: hc, emoji: '👹', title: 'Quái Vật', desc: 'Cần 🗡️ hoặc mất 2 bước!', alpha: 1 };
    }
    if (this.actionTip && this.actionTip.alpha > 0) tip = this.actionTip;
    if (!tip) return;

    ctx.save();
    ctx.globalAlpha = tip.alpha;
    ctx.font = 'bold 13px "Segoe UI",sans-serif';
    const tw1 = ctx.measureText(tip.emoji + ' ' + tip.title).width;
    ctx.font = '11px "Segoe UI",sans-serif';
    const tw2 = ctx.measureText(tip.desc).width;
    const w = Math.max(tw1, tw2) + 28, h = 50;
    const cx = tip.col * cs + cs / 2;
    let bx = Math.max(4, Math.min(cx - w / 2, COLS * cs - w - 4));
    let by = Math.max(4, this.startH + tip.row * cs - h - 10);

    ctx.fillStyle = 'rgba(20,24,37,0.94)';
    this._roundRect(bx, by, w, h, 8); ctx.fill();
    ctx.strokeStyle = '#d4a458'; ctx.lineWidth = 1.5;
    this._roundRect(bx, by, w, h, 8); ctx.stroke();

    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px "Segoe UI",sans-serif';
    ctx.fillText(tip.emoji + ' ' + tip.title, bx + 12, by + 8);
    ctx.fillStyle = '#d4a458'; ctx.font = '11px "Segoe UI",sans-serif';
    ctx.fillText(tip.desc, bx + 12, by + 28);
    ctx.restore();
  }

  _roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ══════ UI ══════ */
  _ui() {
    const p = this.cur;
    const ti = document.getElementById('turn-info');
    const avi = '<img class="turn-avatar" src="' + AVATARS[p.id] + '" style="border-color:' + p.color + '">';
    if (this.phase === 'gateSelect') {
      ti.innerHTML = avi + '<span style="color:' + p.color + '">' + p.name + '</span> chọn cửa vào';
    } else if (this.phase === 'playing') {
      const s = this.turnPhase === 'roll' ? 'Tung xúc xắc!' : 'Còn ' + this.steps + ' bước';
      ti.innerHTML = avi + '<span style="color:' + p.color + '">' + p.name + '</span> — ' + s;
    }
    document.getElementById('dice').textContent = this.dice || '?';
    const rb = document.getElementById('roll-btn');
    rb.disabled = this.phase !== 'playing' || this.turnPhase !== 'roll' || this.diceRolling;
    rb.style.display = this.phase === 'gateSelect' ? 'none' : '';

    document.getElementById('player-panel').innerHTML = this.players.map(p => {
      const a = p === this.cur && !p.finished ? ' active' : '';
      let st = '';
      if (p.finished) st = '🏆 #' + p.rank;
      else {
        const ic = [];
        if (p.skipTurn) ic.push('⛔');
        if (p.hasSword) ic.push('🗡️');
        if (p.hasShield) ic.push('🛡️');
        if (p.ghostSteps > 0) ic.push('👻' + p.ghostSteps);
        st = ic.join(' ');
      }
      return '<div class="player-card' + a + '" style="border-color:' + (a ? p.color : 'transparent') + '">' +
        '<img class="player-avatar" src="' + AVATARS[p.id] + '" alt="' + p.name + '" style="border-color:' + p.color + '">' +
        '<span class="player-name" style="color:' + p.color + '">' + p.name + '</span>' +
        '<span class="player-status">' + st + '</span></div>';
    }).join('');

    document.getElementById('steps-info').textContent =
      this.turnPhase === 'move' && this.steps > 0 ? 'Bước: ' + this.steps : '';
  }

  msg(t) {
    const el = document.getElementById('message-bar');
    el.textContent = t; el.classList.remove('pop'); el.classList.remove('guide');
    void el.offsetWidth; el.classList.add('pop');
  }

  _guide(t) {
    const el = document.getElementById('message-bar');
    el.textContent = '💡 ' + t;
    el.classList.remove('pop'); el.classList.remove('guide');
    void el.offsetWidth; el.classList.add('guide');
  }
}

window.addEventListener('DOMContentLoaded', () => new Game().init());
