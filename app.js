// 3D 户型翻新 — 单页应用主逻辑
// 数据流：2D 编辑器 -> 户型模型 rooms[] -> 风格引擎 STYLES -> Three.js 3D 渲染 + 造价估算 -> 导出
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ================= 常量 ================= */
const CELL = 40;          // 2D 画布上 1 米 = 40px
const COLS = 20;          // 画布宽 20 米
const ROWS = 14;          // 画布高 14 米
const WALL_H = 2.8;       // 层高（米）
const WALL_T = 0.15;      // 墙厚（米）
const DOOR_W = 0.9;       // 门洞宽（米）

/* 房间类型：标签 + 2D 填充色 */
const ROOM_TYPES = {
  living:   { label: '客厅',   color: '#fde68a' },
  bedroom:  { label: '卧室',   color: '#bfdbfe' },
  kitchen:  { label: '厨房',   color: '#fbcfe8' },
  bathroom: { label: '卫生间', color: '#a7f3d0' },
  balcony:  { label: '阳台',   color: '#ddd6fe' },
  dining:   { label: '餐厅',   color: '#fed7aa' },
};

/* 装修风格预设：墙面 / 地面 / 厨卫瓷砖 / 点缀色 / 硬装单价（元/㎡） */
const STYLES = {
  modern: {
    label: '现代简约', pricePerSqm: 800,
    wall: 0xf5f2ec, floor: 0xc9a876, tile: 0xe8e8e8, accent: 0x3b82f6,
    desc: '浅色墙面 + 原木地板，线条干净，百搭耐看。',
    meta: ['墙面：米白乳胶漆', '地面：原木色地板', '点缀：雾蓝布艺'],
  },
  nordic: {
    label: '北欧', pricePerSqm: 950,
    wall: 0xf8fafc, floor: 0xd9c7a7, tile: 0xdfe9ec, accent: 0x7fb3a3,
    desc: '大面积留白 + 浅木色，配莫兰迪绿点缀，明亮通透。',
    meta: ['墙面：纯白乳胶漆', '地面：浅木纹地板', '点缀：莫兰迪绿'],
  },
  chinese: {
    label: '新中式', pricePerSqm: 1200,
    wall: 0xefe6d8, floor: 0x8a5a3b, tile: 0xd8cfc0, accent: 0xb03a2e,
    desc: '深木色地面 + 暖调墙面，配朱红点缀，沉稳大气。',
    meta: ['墙面：暖米色墙纸', '地面：深胡桃木地板', '点缀：朱红'],
  },
  industrial: {
    label: '工业风', pricePerSqm: 1000,
    wall: 0x9aa0a6, floor: 0x6b7280, tile: 0x55595e, accent: 0xd97706,
    desc: '水泥灰墙面 + 深灰地面，配金属与暖黄灯光，硬朗有个性。',
    meta: ['墙面：水泥灰', '地面：深灰地砖', '点缀：暖黄金属'],
  },
};

/* 家具目录：按房间类型，每件含 3D 搭建用的 id、名称、单价（元） */
const FURNITURE = {
  bedroom:  [
    { id: 'bed',       name: '双人床',   price: 3800 },
    { id: 'wardrobe',  name: '衣柜',     price: 4200 },
    { id: 'nightstand',name: '床头柜',   price: 600 },
    { id: 'plant',     name: '绿植',     price: 150 },
  ],
  living: [
    { id: 'sofa',       name: '布艺沙发', price: 5200 },
    { id: 'coffeeTable',name: '茶几',     price: 1200 },
    { id: 'tvStand',    name: '电视柜',   price: 1800 },
    { id: 'plant',      name: '绿植',     price: 150 },
  ],
  dining: [
    { id: 'diningTable', name: '餐桌',    price: 2600 },
    { id: 'chairs',      name: '餐椅 ×4', price: 1600 },
  ],
  kitchen: [
    { id: 'counter', name: '橱柜', price: 6800 },
  ],
  bathroom: [
    { id: 'bathtub', name: '浴缸',   price: 2200 },
    { id: 'toilet',  name: '马桶',   price: 1500 },
    { id: 'sink',    name: '洗手台', price: 1200 },
  ],
  balcony: [
    { id: 'plant', name: '绿植',   price: 150 },
    { id: 'chair', name: '休闲椅', price: 800 },
  ],
};

/* 示例户型（米）。x/y 为左上角，w/h 为宽/长 */
const SAMPLES = {
  1: [
    { name: '客厅',   type: 'living',   x: 0, y: 0, w: 7, h: 5 },
    { name: '卧室',   type: 'bedroom',  x: 7, y: 0, w: 5, h: 5 },
    { name: '厨房',   type: 'kitchen',  x: 0, y: 5, w: 4, h: 3 },
    { name: '卫生间', type: 'bathroom', x: 4, y: 5, w: 3, h: 3 },
    { name: '阳台',   type: 'balcony',  x: 7, y: 5, w: 5, h: 3 },
  ],
  2: [
    { name: '客厅',   type: 'living',   x: 0,  y: 0, w: 7, h: 6 },
    { name: '主卧',   type: 'bedroom',  x: 7,  y: 0, w: 5, h: 5 },
    { name: '次卧',   type: 'bedroom',  x: 12, y: 0, w: 5, h: 5 },
    { name: '厨房',   type: 'kitchen',  x: 7,  y: 5, w: 4, h: 3 },
    { name: '卫生间', type: 'bathroom', x: 11, y: 5, w: 3, h: 3 },
    { name: '餐厅',   type: 'dining',   x: 0,  y: 6, w: 7, h: 4 },
    { name: '阳台',   type: 'balcony',  x: 14, y: 5, w: 3, h: 3 },
  ],
  3: [
    { name: '客厅',   type: 'living',   x: 0,  y: 0, w: 8, h: 6 },
    { name: '主卧',   type: 'bedroom',  x: 8,  y: 0, w: 5, h: 5 },
    { name: '次卧',   type: 'bedroom',  x: 13, y: 0, w: 5, h: 5 },
    { name: '书房',   type: 'bedroom',  x: 8,  y: 5, w: 5, h: 4 },
    { name: '厨房',   type: 'kitchen',  x: 13, y: 5, w: 5, h: 3 },
    { name: '卫生间', type: 'bathroom', x: 13, y: 8, w: 3, h: 3 },
    { name: '餐厅',   type: 'dining',   x: 0,  y: 6, w: 8, h: 4 },
    { name: '阳台',   type: 'balcony',  x: 18, y: 0, w: 2, h: 5 },
  ],
};

/* ================= 状态 ================= */
const state = { rooms: [], selectedId: null, style: 'modern' };
let nextId = 1;
const $ = (id) => document.getElementById(id);
const fmt = (n) => '¥' + Math.round(n).toLocaleString('zh-CN');

/* ================= 2D 编辑器 ================= */
const canvas = $('plan-canvas');
const ctx = canvas.getContext('2d');
let drag = null; // { mode: 'draw'|'move'|'resize', ... }

function snap(v) { return Math.round(v * 2) / 2; } // 吸附到 0.5 米
function toMeters(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: snap((e.clientX - r.left) * (canvas.width / r.width) / CELL),
    y: snap((e.clientY - r.top) * (canvas.height / r.height) / CELL),
  };
}
function roomAt(mx, my) {
  for (let i = state.rooms.length - 1; i >= 0; i--) {
    const r = state.rooms[i];
    if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return r;
  }
  return null;
}
function selectedRoom() {
  return state.rooms.find((r) => r.id === state.selectedId) || null;
}

function draw2D() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // 网格
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  for (let i = 0; i <= COLS; i++) {
    ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, ROWS * CELL); ctx.stroke();
  }
  for (let j = 0; j <= ROWS; j++) {
    ctx.beginPath(); ctx.moveTo(0, j * CELL); ctx.lineTo(COLS * CELL, j * CELL); ctx.stroke();
  }
  // 房间
  for (const r of state.rooms) {
    const t = ROOM_TYPES[r.type] || ROOM_TYPES.living;
    ctx.fillStyle = t.color;
    ctx.fillRect(r.x * CELL, r.y * CELL, r.w * CELL, r.h * CELL);
    ctx.strokeStyle = r.id === state.selectedId ? '#2563eb' : '#6b7280';
    ctx.lineWidth = r.id === state.selectedId ? 3 : 1.5;
    ctx.strokeRect(r.x * CELL, r.y * CELL, r.w * CELL, r.h * CELL);
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(r.name, (r.x + r.w / 2) * CELL, (r.y + r.h / 2) * CELL - 4);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#4b5563';
    ctx.fillText(`${t.label} · ${(r.w * r.h).toFixed(1)}㎡`, (r.x + r.w / 2) * CELL, (r.y + r.h / 2) * CELL + 14);
    // 选中时右下角画缩放手柄
    if (r.id === state.selectedId) {
      ctx.fillStyle = '#2563eb';
      ctx.fillRect((r.x + r.w) * CELL - 6, (r.y + r.h) * CELL - 6, 12, 12);
    }
  }
  // 正在画的新房间（虚线预览）
  if (drag && drag.mode === 'draw' && drag.preview) {
    const p = drag.preview;
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x * CELL, p.y * CELL, p.w * CELL, p.h * CELL);
    ctx.setLineDash([]);
  }
}

canvas.addEventListener('mousedown', (e) => {
  const m = toMeters(e);
  const sel = selectedRoom();
  // 点中选中房间的右下角手柄 -> 改大小
  if (sel && Math.abs(m.x - (sel.x + sel.w)) < 0.4 && Math.abs(m.y - (sel.y + sel.h)) < 0.4) {
    drag = { mode: 'resize', room: sel };
    return;
  }
  const hit = roomAt(m.x, m.y);
  if (hit) {
    state.selectedId = hit.id;
    drag = { mode: 'move', room: hit, dx: m.x - hit.x, dy: m.y - hit.y, moved: false };
  } else {
    state.selectedId = null;
    drag = { mode: 'draw', x0: m.x, y0: m.y, preview: null };
  }
  refreshAll();
});

canvas.addEventListener('mousemove', (e) => {
  if (!drag) return;
  const m = toMeters(e);
  if (drag.mode === 'draw') {
    const x = Math.min(drag.x0, m.x), y = Math.min(drag.y0, m.y);
    drag.preview = {
      x: Math.max(0, x), y: Math.max(0, y),
      w: Math.min(COLS - Math.max(0, x), Math.abs(m.x - drag.x0)),
      h: Math.min(ROWS - Math.max(0, y), Math.abs(m.y - drag.y0)),
    };
  } else if (drag.mode === 'move') {
    const r = drag.room;
    r.x = Math.max(0, Math.min(COLS - r.w, m.x - drag.dx));
    r.y = Math.max(0, Math.min(ROWS - r.h, m.y - drag.dy));
    drag.moved = true;
  } else if (drag.mode === 'resize') {
    const r = drag.room;
    r.w = Math.max(1, Math.min(COLS - r.x, m.x - r.x));
    r.h = Math.max(1, Math.min(ROWS - r.y, m.y - r.y));
  }
  draw2D();
  if (drag.mode !== 'draw') { updateCost(); updateRoomForm(); }
});

window.addEventListener('mouseup', () => {
  if (!drag) return;
  if (drag.mode === 'draw' && drag.preview) {
    const p = drag.preview;
    if (p.w >= 1 && p.h >= 1) {
      const room = {
        id: nextId++, name: `房间 ${nextId - 1}`, type: 'living',
        x: p.x, y: p.y, w: p.w, h: p.h,
      };
      state.rooms.push(room);
      state.selectedId = room.id;
    }
  }
  drag = null;
  refreshAll();
});

/* ================= 房间属性面板 ================= */
function updateRoomForm() {
  const r = selectedRoom();
  $('room-empty').hidden = !!r;
  $('room-form').hidden = !r;
  if (!r) return;
  if (document.activeElement !== $('room-name')) $('room-name').value = r.name;
  $('room-type').value = r.type;
  if (document.activeElement !== $('room-w')) $('room-w').value = r.w;
  if (document.activeElement !== $('room-h')) $('room-h').value = r.h;
  $('room-area').textContent = `面积 ${(r.w * r.h).toFixed(1)}㎡ · 位置 (${r.x}, ${r.y})`;
}
$('room-name').addEventListener('input', (e) => {
  const r = selectedRoom(); if (!r) return;
  r.name = e.target.value; draw2D(); updateCost();
});
$('room-type').addEventListener('change', (e) => {
  const r = selectedRoom(); if (!r) return;
  r.type = e.target.value; refreshAll();
});
$('room-w').addEventListener('change', (e) => {
  const r = selectedRoom(); if (!r) return;
  r.w = Math.max(1, Math.min(COLS - r.x, Number(e.target.value) || r.w)); refreshAll();
});
$('room-h').addEventListener('change', (e) => {
  const r = selectedRoom(); if (!r) return;
  r.h = Math.max(1, Math.min(ROWS - r.y, Number(e.target.value) || r.h)); refreshAll();
});
$('btn-del-room').addEventListener('click', () => {
  state.rooms = state.rooms.filter((r) => r.id !== state.selectedId);
  state.selectedId = null;
  refreshAll();
});

/* ================= 风格面板 + 造价 ================= */
function updateStylePanel() {
  const s = STYLES[state.style];
  $('style-desc').textContent = s.desc;
  $('style-meta').innerHTML = s.meta.map((m) => `<li>${m}</li>`).join('')
    + `<li>硬装单价：${fmt(s.pricePerSqm)} / ㎡</li>`;
}
function computeCost() {
  const s = STYLES[state.style];
  const lines = [];
  let total = 0;
  for (const r of state.rooms) {
    const area = r.w * r.h;
    const hard = Math.round(area * s.pricePerSqm);
    lines.push({ name: `硬装 · ${r.name}`, qty: `${area.toFixed(1)}㎡`, amount: hard });
    total += hard;
    for (const item of FURNITURE[r.type] || []) {
      lines.push({ name: `家具 · ${item.name}（${r.name}）`, qty: '1', amount: item.price });
      total += item.price;
    }
  }
  return { lines, total };
}
function updateCost() {
  const { lines, total } = computeCost();
  $('cost-table').querySelector('tbody').innerHTML = lines.length
    ? lines.map((l) => `<tr><td>${l.name}</td><td>${l.qty}</td><td>${fmt(l.amount)}</td></tr>`).join('')
    : '<tr><td colspan="3">还没有房间，先画一个吧。</td></tr>';
  $('cost-total').textContent = fmt(total);
}

/* ================= 3D 预览（Three.js） ================= */
let renderer = null, scene = null, camera = null, controls = null, planGroup = null;
let threeReady = false;

function initThree() {
  if (threeReady) return;
  const container = $('three-container');
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeef2f7);
  camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 200);
  setCameraPersp();
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2.05;

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(12, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);

  // 地面
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 26),
    new THREE.MeshStandardMaterial({ color: 0xdfe5ea }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  window.addEventListener('resize', () => {
    if (!renderer) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  const loop = () => { requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); };
  loop();
  threeReady = true;
}

/* 平面坐标（米） -> 世界坐标：户型居中 */
const wx = (px) => px - COLS / 2;
const wz = (py) => py - ROWS / 2;

function box(w, h, d, color, x, y, z, parent) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color }),
  );
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function cyl(rt, rb, h, color, x, y, z, parent, seg = 24) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(rt, rb, h, seg),
    new THREE.MeshStandardMaterial({ color }),
  );
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

/* ---- 家具搭建：每件都是 box / cylinder 拼出来的 ---- */
function buildBed(g, cx, cz, accent) {
  box(1.6, 0.3, 2.0, 0x8a5a3b, cx, 0.25, cz, g);            // 床架
  box(1.5, 0.18, 1.9, 0xf5f5f0, cx, 0.49, cz, g);           // 床垫
  box(1.6, 0.8, 0.1, 0x8a5a3b, cx, 0.6, cz - 1.0, g);       // 床头板
  box(0.6, 0.12, 0.4, 0xffffff, cx - 0.38, 0.62, cz - 0.7, g); // 枕头
  box(0.6, 0.12, 0.4, 0xffffff, cx + 0.38, 0.62, cz - 0.7, g);
  box(1.5, 0.08, 1.1, accent, cx, 0.6, cz + 0.3, g);       // 床尾毯
}
function buildWardrobe(g, cx, cz) {
  box(1.8, 2.1, 0.6, 0x9c7b54, cx, 1.15, cz, g);
  box(0.04, 1.9, 0.02, 0x6b4f2a, cx, 1.15, cz + 0.31, g); // 门缝
}
function buildNightstand(g, cx, cz) { box(0.5, 0.5, 0.4, 0x9c7b54, cx, 0.35, cz, g); }
function buildSofa(g, cx, cz, accent) {
  box(2.0, 0.4, 0.9, accent, cx, 0.3, cz, g);
  box(2.0, 0.65, 0.2, accent, cx, 0.75, cz - 0.35, g);     // 靠背
  box(0.2, 0.55, 0.9, accent, cx - 0.9, 0.5, cz, g);       // 扶手
  box(0.2, 0.55, 0.9, accent, cx + 0.9, 0.5, cz, g);
  box(0.6, 0.12, 0.5, 0xffffff, cx - 0.45, 0.56, cz, g);    // 抱枕
  box(0.6, 0.12, 0.5, 0xffffff, cx + 0.45, 0.56, cz, g);
}
function buildCoffeeTable(g, cx, cz) {
  box(1.2, 0.05, 0.6, 0x6b4f2a, cx, 0.38, cz, g);
  for (const [dx, dz] of [[-0.55, -0.25], [0.55, -0.25], [-0.55, 0.25], [0.55, 0.25]])
    box(0.05, 0.36, 0.05, 0x333333, cx + dx, 0.18, cz + dz, g);
}
function buildTvStand(g, cx, cz) {
  box(1.8, 0.45, 0.4, 0x5b4636, cx, 0.33, cz, g);
  box(1.2, 0.7, 0.05, 0x111111, cx, 0.95, cz, g);           // 电视
}
function buildDiningTable(g, cx, cz) {
  box(1.6, 0.06, 0.9, 0x9c7b54, cx, 0.72, cz, g);
  for (const [dx, dz] of [[-0.7, -0.35], [0.7, -0.35], [-0.7, 0.35], [0.7, 0.35]])
    box(0.07, 0.7, 0.07, 0x333333, cx + dx, 0.35, cz + dz, g);
}
function buildChair(g, cx, cz, ry = 0) {
  const c = new THREE.Group();
  c.position.set(cx, 0, cz); c.rotation.y = ry;
  box(0.45, 0.05, 0.45, 0x7a5c3e, 0, 0.42, 0, c);
  box(0.45, 0.5, 0.05, 0x7a5c3e, 0, 0.7, -0.2, c);
  g.add(c);
}
function buildCounter(g, cx, cz) {
  box(2.4, 0.85, 0.6, 0xcfd8dc, cx, 0.53, cz, g);           // 橱柜
  box(2.5, 0.05, 0.65, 0x37474f, cx, 0.98, cz, g);          // 台面
  box(0.7, 0.06, 0.4, 0x90a4ae, cx - 0.5, 1.0, cz, g);      // 水槽
}
function buildBathtub(g, cx, cz) {
  box(1.7, 0.55, 0.75, 0xffffff, cx, 0.38, cz, g);
  box(1.5, 0.06, 0.55, 0x90caf9, cx, 0.62, cz, g);          // 水面
}
function buildToilet(g, cx, cz) {
  cyl(0.2, 0.24, 0.4, 0xffffff, cx, 0.3, cz, g);
  box(0.45, 0.5, 0.15, 0xffffff, cx, 0.55, cz - 0.25, g);   // 水箱
}
function buildSink(g, cx, cz) {
  box(0.6, 0.8, 0.45, 0xffffff, cx, 0.5, cz, g);
  cyl(0.16, 0.16, 0.08, 0xd7ccc8, cx, 0.94, cz, g);         // 台盆
}
function buildPlant(g, cx, cz) {
  cyl(0.16, 0.13, 0.3, 0xb5651d, cx, 0.25, cz, g);
  const leaf = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x43a047 }),
  );
  leaf.position.set(cx, 0.72, cz); leaf.castShadow = true;
  g.add(leaf);
}

/* 按房间类型摆放家具（坐标为房间内相对偏移，米） */
function buildFurnitureForRoom(g, r, style) {
  const cx = wx(r.x + r.w / 2), cz = wz(r.y + r.h / 2);
  const L = (dx, dz) => [cx + dx, cz + dz]; // 房间中心 + 偏移
  switch (r.type) {
    case 'bedroom': {
      const [bx, bz] = L(-r.w / 2 + 1.1, 0);
      buildBed(g, bx, bz, style.accent);
      const [wxp, wzp] = L(r.w / 2 - 1.0, -r.h / 2 + 0.45);
      buildWardrobe(g, wxp, wzp);
      const [nx, nz] = L(-r.w / 2 + 1.1, -r.h / 2 + 0.45);
      buildNightstand(g, nx, nz);
      const [px, pz] = L(r.w / 2 - 0.4, r.h / 2 - 0.4);
      buildPlant(g, px, pz);
      break;
    }
    case 'living': {
      const [sx, sz] = L(0, -r.h / 2 + 0.65);
      buildSofa(g, sx, sz, style.accent);
      const [tx, tz] = L(0, 0.3);
      buildCoffeeTable(g, tx, tz);
      const [vx, vz] = L(0, r.h / 2 - 0.35);
      buildTvStand(g, vx, vz);
      const [px, pz] = L(r.w / 2 - 0.4, -r.h / 2 + 0.4);
      buildPlant(g, px, pz);
      break;
    }
    case 'dining': {
      buildDiningTable(g, cx, cz);
      buildChair(g, cx - 0.5, cz - 0.85, 0);
      buildChair(g, cx + 0.5, cz - 0.85, 0);
      buildChair(g, cx - 0.5, cz + 0.85, Math.PI);
      buildChair(g, cx + 0.5, cz + 0.85, Math.PI);
      break;
    }
    case 'kitchen': {
      const [kx, kz] = L(0, -r.h / 2 + 0.4);
      buildCounter(g, kx, kz);
      break;
    }
    case 'bathroom': {
      const [tx, tz] = L(-r.w / 2 + 0.95, 0);
      buildBathtub(g, tx, tz);
      const [ox, oz] = L(r.w / 2 - 0.4, -r.h / 2 + 0.4);
      buildToilet(g, ox, oz);
      const [sx, sz] = L(r.w / 2 - 0.4, r.h / 2 - 0.4);
      buildSink(g, sx, sz);
      break;
    }
    case 'balcony': {
      const [p1x, p1z] = L(-r.w / 2 + 0.4, -r.h / 2 + 0.4);
      buildPlant(g, p1x, p1z);
      const [p2x, p2z] = L(r.w / 2 - 0.4, -r.h / 2 + 0.4);
      buildPlant(g, p2x, p2z);
      buildChair(g, cx, cz + 0.2, Math.PI);
      break;
    }
    default: break;
  }
}

/* 一面墙：南墙留出门洞 */
function buildWalls(g, r, wallColor) {
  const mat = new THREE.MeshStandardMaterial({ color: wallColor });
  const wall = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), mat);
    m.position.set(x, WALL_H / 2 + 0.05, z);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  };
  const x0 = wx(r.x), x1 = wx(r.x + r.w);
  const z0 = wz(r.y), z1 = wz(r.y + r.h);
  const cx = (x0 + x1) / 2;
  wall(x1 - x0 + WALL_T, WALL_T, cx, z0);                    // 北墙
  const leftLen = (cx - DOOR_W / 2) - x0;
  const rightLen = x1 - (cx + DOOR_W / 2);
  if (leftLen > 0.1) wall(leftLen, WALL_T, x0 + leftLen / 2, z1);   // 南墙左段
  if (rightLen > 0.1) wall(rightLen, WALL_T, cx + DOOR_W / 2 + rightLen / 2, z1); // 南墙右段
  wall(WALL_T, z1 - z0, x0, (z0 + z1) / 2);                  // 西墙
  wall(WALL_T, z1 - z0, x1, (z0 + z1) / 2);                  // 东墙
}

function rebuild3D() {
  if (!threeReady) return;
  if (planGroup) { scene.remove(planGroup); planGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  planGroup = new THREE.Group();
  scene.add(planGroup);
  const style = STYLES[state.style];
  for (const r of state.rooms) {
    // 地面（厨卫用瓷砖色）
    const floorColor = (r.type === 'kitchen' || r.type === 'bathroom') ? style.tile : style.floor;
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(r.w, 0.1, r.h),
      new THREE.MeshStandardMaterial({ color: floorColor }),
    );
    floor.position.set(wx(r.x + r.w / 2), 0.05, wz(r.y + r.h / 2));
    floor.receiveShadow = true;
    planGroup.add(floor);
    buildWalls(planGroup, r, style.wall);
    buildFurnitureForRoom(planGroup, r, style);
  }
}

function setCameraPersp() {
  camera.position.set(13, 11, 13);
  camera.lookAt(0, 0, 0);
}
function setCameraTop() {
  camera.position.set(0, 22, 0.01);
  camera.lookAt(0, 0, 0);
}
$('btn-cam-persp').addEventListener('click', () => { if (camera) setCameraPersp(); });
$('btn-cam-top').addEventListener('click', () => { if (camera) setCameraTop(); });

/* ================= 视图切换 ================= */
function setView(mode) {
  const is3d = mode === '3d';
  $('editor-2d').hidden = is3d;
  $('viewer-3d').hidden = !is3d;
  $('btn-view-2d').classList.toggle('active', !is3d);
  $('btn-view-3d').classList.toggle('active', is3d);
  $('btn-cam-top').disabled = !is3d;
  $('btn-cam-persp').disabled = !is3d;
  $('btn-export-png').disabled = !is3d;
  if (is3d) {
    initThree();
    rebuild3D();
    // 容器从 hidden 恢复后需要重算尺寸
    requestAnimationFrame(() => {
      const c = $('three-container');
      camera.aspect = c.clientWidth / c.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(c.clientWidth, c.clientHeight);
    });
  }
}
$('btn-view-2d').addEventListener('click', () => setView('2d'));
$('btn-view-3d').addEventListener('click', () => setView('3d'));

/* ================= 示例户型 / 清空 ================= */
function loadSample(n) {
  state.rooms = SAMPLES[n].map((s) => ({ id: nextId++, ...s }));
  state.selectedId = null;
  refreshAll();
}
document.querySelectorAll('[data-sample]').forEach((b) =>
  b.addEventListener('click', () => loadSample(Number(b.dataset.sample))));
$('btn-clear').addEventListener('click', () => {
  state.rooms = []; state.selectedId = null; refreshAll();
});
$('style-select').addEventListener('change', (e) => {
  state.style = e.target.value;
  updateStylePanel(); updateCost(); rebuild3D();
});

/* ================= 导出 / 导入 ================= */
function download(filename, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('btn-export-json').addEventListener('click', () => {
  const data = { version: 1, style: state.style, rooms: state.rooms };
  download('floorplan.json', new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
});
$('btn-import-json').addEventListener('click', () => $('file-import-json').click());
$('file-import-json').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.rooms)) throw new Error('rooms 不是数组');
      state.rooms = data.rooms
        .filter((r) => r && typeof r.x === 'number' && typeof r.y === 'number'
          && typeof r.w === 'number' && typeof r.h === 'number')
        .map((r) => ({
          id: nextId++,
          name: String(r.name || '房间'),
          type: ROOM_TYPES[r.type] ? r.type : 'living',
          x: Math.max(0, Math.min(COLS - 1, r.x)),
          y: Math.max(0, Math.min(ROWS - 1, r.y)),
          w: Math.max(1, Math.min(COLS, r.w)),
          h: Math.max(1, Math.min(ROWS, r.h)),
        }));
      if (data.style && STYLES[data.style]) {
        state.style = data.style;
        $('style-select').value = data.style;
      }
      state.selectedId = null;
      refreshAll();
    } catch (err) {
      alert('导入失败：' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // 允许重复导入同一文件
});
$('btn-export-png').addEventListener('click', () => {
  if (!renderer) return;
  renderer.render(scene, camera);
  renderer.domElement.toBlob((blob) => {
    if (blob) download('3d-preview.png', blob);
  }, 'image/png');
});

/* ================= 统一刷新 ================= */
function refreshAll() {
  draw2D();
  updateRoomForm();
  updateStylePanel();
  updateCost();
  rebuild3D();
}

/* ================= 启动：默认加载 2 居室示例 ================= */
loadSample(2);
