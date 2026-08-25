// ==================== 面包笔刷模块 ====================

let _crustImg, _crumbImg;
let _currentBrush = 'crust';
let _brushSize = 80;
let _lastX, _lastY;
let _targetGraphics = null;  // 【新增】绘制目标

const BRUSH_CONFIG = {
  minSize: 20,
  maxSize: 200,
  sizeStep: 5,
  overlap: 0.5,
  rotateRange: 0.3,
  scaleRange: 0.1,
  alphaMin: 180,
  alphaMax: 255
};

function brushPreload(crustPath, crumbPath) {
  _crustImg = loadImage(crustPath);
  _crumbImg = loadImage(crumbPath);
}

function brushSetup(startSize, graphics) {  // 【修改】传入目标图层
  if (startSize) _brushSize = constrain(startSize, BRUSH_CONFIG.minSize, BRUSH_CONFIG.maxSize);
  _targetGraphics = graphics;  // 【新增】设置绘制目标
  _lastX = mouseX;
  _lastY = mouseY;
}

function brushStart(x, y) {
  _lastX = x;
  _lastY = y;
  _stamp(x, y);
}

function brushDraw(x, y) {
  let distMoved = dist(x, y, _lastX, _lastY);
  let spacing = _brushSize * BRUSH_CONFIG.overlap;
  if (distMoved < spacing) return;
  
  let steps = ceil(distMoved / spacing);
  steps = min(steps, 20);
  
  for (let i = 0; i < steps; i++) {
    let t = i / steps;
    let px = lerp(_lastX, x, t);
    let py = lerp(_lastY, y, t);
    _stamp(px, py);
  }
  
  _lastX = x;
  _lastY = y;
}

function brushScroll(event) {
  if (event.delta > 0) {
    _brushSize = max(_brushSize - BRUSH_CONFIG.sizeStep, BRUSH_CONFIG.minSize);
  } else {
    _brushSize = min(_brushSize + BRUSH_CONFIG.sizeStep, BRUSH_CONFIG.maxSize);
  }
  return false;
}

function brushSetType(type) {
  if (type === 'crust' || type === 'crumb') {
    _currentBrush = type;
  }
}

function brushSetSize(size) {
  _brushSize = constrain(size, BRUSH_CONFIG.minSize, BRUSH_CONFIG.maxSize);
}

function brushGetSize() {
  return _brushSize;
}

function brushGetType() {
  return _currentBrush;
}

// 【关键修改】_stamp 现在画到 _targetGraphics 上
function _stamp(x, y) {
  let g = _targetGraphics;  // 目标图层
  
  g.push();
  g.translate(x, y);
  
  let img = _currentBrush === 'crust' ? _crustImg : _crumbImg;
  let randomScale = random(1 - BRUSH_CONFIG.scaleRange, 1 + BRUSH_CONFIG.scaleRange);
  let randomRotate = random(-BRUSH_CONFIG.rotateRange, BRUSH_CONFIG.rotateRange);
  let randomAlpha = random(BRUSH_CONFIG.alphaMin, BRUSH_CONFIG.alphaMax);
  
  g.rotate(randomRotate);
  let finalSize = _brushSize * randomScale;
  g.scale(finalSize / img.width);
  g.tint(255, 255, 255, randomAlpha);
  g.imageMode(CENTER);
  g.image(img, 0, 0);
  
  g.pop();
}
