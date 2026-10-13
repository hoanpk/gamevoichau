class Maze {
  constructor(cols = 21, rows = 13) {
    this.cols = cols;
    this.rows = rows;
    this.grid = [];
    this.gates = [];
    this.exit = null;
    this.monsters = [];
  }

  generate() {
    this.grid = [];
    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = [];
      for (let c = 0; c < this.cols; c++) {
        this.grid[r][c] = {
          row: r, col: c,
          walls: { top: true, right: true, bottom: true, left: true },
          visited: false,
          item: null,
        };
      }
    }

    const stack = [];
    const sr = Math.floor(this.rows / 2);
    const sc = Math.floor(this.cols / 2);
    this.grid[sr][sc].visited = true;
    stack.push(this.grid[sr][sc]);

    while (stack.length > 0) {
      const cur = stack[stack.length - 1];
      const nb = this._unvisitedNeighbors(cur);
      if (nb.length === 0) {
        stack.pop();
      } else {
        const next = nb[Math.floor(Math.random() * nb.length)];
        this._removeWall(cur, next);
        next.visited = true;
        stack.push(next);
      }
    }

    this._setupGates();
    this._setupExit();
    this._placeItems();
    this._placeMonsters();

    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        this.grid[r][c].visited = false;

    return this;
  }

  _unvisitedNeighbors(cell) {
    const { row, col } = cell;
    const n = [];
    if (row > 0 && !this.grid[row - 1][col].visited) n.push(this.grid[row - 1][col]);
    if (row < this.rows - 1 && !this.grid[row + 1][col].visited) n.push(this.grid[row + 1][col]);
    if (col > 0 && !this.grid[row][col - 1].visited) n.push(this.grid[row][col - 1]);
    if (col < this.cols - 1 && !this.grid[row][col + 1].visited) n.push(this.grid[row][col + 1]);
    return n;
  }

  _removeWall(a, b) {
    const dx = b.col - a.col;
    const dy = b.row - a.row;
    if (dx === 1) { a.walls.right = false; b.walls.left = false; }
    if (dx === -1) { a.walls.left = false; b.walls.right = false; }
    if (dy === 1) { a.walls.bottom = false; b.walls.top = false; }
    if (dy === -1) { a.walls.top = false; b.walls.bottom = false; }
  }

  _setupGates() {
    this.gates = [];
    [1, 3, 5, 7, 9, 11, 13, 15, 17, 19].forEach((col, i) => {
      if (col < this.cols) {
        this.grid[0][col].walls.top = false;
        this.gates.push({ row: 0, col, index: i });
      }
    });
  }

  _setupExit() {
    const col = Math.floor(this.cols / 2);
    this.grid[this.rows - 1][col].walls.bottom = false;
    this.exit = { row: this.rows - 1, col };
  }

  _placeItems() {
    const pool = [
      { type: 'boots',  emoji: '👟', name: 'Giày Tốc Độ',  desc: 'Thêm 3 bước di chuyển' },
      { type: 'boots',  emoji: '👟', name: 'Giày Tốc Độ',  desc: 'Thêm 3 bước di chuyển' },
      { type: 'star',   emoji: '⭐',       name: 'Ngôi Sao',       desc: 'Thêm 2 bước di chuyển' },
      { type: 'star',   emoji: '⭐',       name: 'Ngôi Sao',       desc: 'Thêm 2 bước di chuyển' },
      { type: 'double', emoji: '⚡',       name: 'Tăng Tốc',  desc: 'Nhân đôi số bước còn lại' },
      { type: 'bomb',   emoji: '💣', name: 'Boom',         desc: 'Phá 1 bức tường, tạo lối tắt!' },
      { type: 'bomb',   emoji: '💣', name: 'Boom',         desc: 'Phá 1 bức tường, tạo lối tắt!' },
      { type: 'sword',  emoji: '⚔', name: 'Kiếm',   desc: 'Tiêu diệt quái vật chặn đường' },
      { type: 'sword',  emoji: '⚔', name: 'Kiếm',   desc: 'Tiêu diệt quái vật chặn đường' },
      { type: 'shield', emoji: '🛡', name: 'Khiên',  desc: 'Miễn nhiễm 1 hiệu ứng xấu' },
      { type: 'ghost',  emoji: '👻', name: 'Bóng Ma',       desc: 'Xuyên tường 3 bước tiếp theo!' },
      { type: 'swap',   emoji: '🔀', name: 'Hoán Đổi', desc: 'Đổi chỗ ngẫu nhiên với đối thủ' },
      { type: 'pit',    emoji: '🕳', name: 'Hố Sập', desc: 'Rơi! Quay về cửa vào ban đầu' },
      { type: 'pit',    emoji: '🕳', name: 'Hố Sập', desc: 'Rơi! Quay về cửa vào ban đầu' },
      { type: 'freeze', emoji: '🧊', name: 'Đông Băng', desc: 'BRR! Mất lượt tiếp theo' },
      { type: 'freeze', emoji: '🧊', name: 'Đông Băng', desc: 'BRR! Mất lượt tiếp theo' },
    ];

    const candidates = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        if (this.gates.some(g => g.row === r && g.col === c)) continue;
        if (this.exit.row === r && this.exit.col === c) continue;
        candidates.push({ row: r, col: c });
      }

    this._shuffle(candidates);
    const count = Math.min(18, candidates.length);
    for (let i = 0; i < count; i++) {
      const pos = candidates[i];
      const t = pool[Math.floor(Math.random() * pool.length)];
      this.grid[pos.row][pos.col].item = { ...t, row: pos.row, col: pos.col, id: i };
    }
  }

  _placeMonsters() {
    this.monsters = [];
    const taken = new Set();
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        if (this.grid[r][c].item || this.gates.some(g => g.row === r && g.col === c) ||
            (this.exit.row === r && this.exit.col === c))
          taken.add(r + ',' + c);

    const candidates = [];
    for (let r = 1; r < this.rows - 1; r++)
      for (let c = 0; c < this.cols; c++)
        if (!taken.has(r + ',' + c)) candidates.push({ row: r, col: c });

    this._shuffle(candidates);
    for (let i = 0; i < Math.min(5, candidates.length); i++)
      this.monsters.push({ row: candidates[i].row, col: candidates[i].col, alive: true });
  }

  _shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  }

  canMove(fr, fc, tr, tc) {
    if (tr < 0 || tr >= this.rows || tc < 0 || tc >= this.cols) return false;
    const dr = tr - fr, dc = tc - fc;
    if (Math.abs(dr) + Math.abs(dc) !== 1) return false;
    const cell = this.grid[fr][fc];
    if (dr === -1) return !cell.walls.top;
    if (dr === 1) return !cell.walls.bottom;
    if (dc === -1) return !cell.walls.left;
    if (dc === 1) return !cell.walls.right;
    return false;
  }

  getNeighbors(row, col) {
    const cell = this.grid[row][col];
    const n = [];
    if (!cell.walls.top && row > 0) n.push({ row: row - 1, col });
    if (!cell.walls.bottom && row < this.rows - 1) n.push({ row: row + 1, col });
    if (!cell.walls.left && col > 0) n.push({ row, col: col - 1 });
    if (!cell.walls.right && col < this.cols - 1) n.push({ row, col: col + 1 });
    return n;
  }

  breakWall(row, col) {
    const cell = this.grid[row][col];
    const dirs = [];
    if (cell.walls.top && row > 0) dirs.push('top');
    if (cell.walls.bottom && row < this.rows - 1) dirs.push('bottom');
    if (cell.walls.left && col > 0) dirs.push('left');
    if (cell.walls.right && col < this.cols - 1) dirs.push('right');
    if (dirs.length === 0) return null;
    const d = dirs[Math.floor(Math.random() * dirs.length)];
    cell.walls[d] = false;
    if (d === 'top')    this.grid[row - 1][col].walls.bottom = false;
    if (d === 'bottom') this.grid[row + 1][col].walls.top = false;
    if (d === 'left')   this.grid[row][col - 1].walls.right = false;
    if (d === 'right')  this.grid[row][col + 1].walls.left = false;
    return d;
  }

  canExit(row, col) {
    return row === this.exit.row && col === this.exit.col && !this.grid[row][col].walls.bottom;
  }

  isDeadEnd(row, col) {
    const w = this.grid[row][col].walls;
    return [w.top, w.right, w.bottom, w.left].filter(Boolean).length >= 3;
  }
}
