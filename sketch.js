// ============================================
// 视频播放控制
// ============================================

let videoFinished = false;
let videoElement = null;
let skipBtn = null;
let skipDialog = null;
let p5Container = null;

// ============================================
// 配置参数
// ============================================

const CONFIG = {
  IMAGE_RATIO: 16 / 9,
  EASING: 0.08,
  MUSIC_GAP: 3000,
};

// ========== 画板模式配置 ==========
let isDrawingMode = false;
let drawingGraphics = null;
let drawingHistory = [];
let historyStep = -1;

// ========== 手动裁剪模式 ==========
let isCroppingMode = false;
let cropRect = null;
let isDraggingCrop = false;
let isResizingCrop = false;
let cropStartPos = null;
let resizeHandle = '';
const CROP_HANDLE_SIZE = 20;

// ========== 完成物体调整模式 ==========
let isAdjustMode = false;
let finishedObjects = [];
let currentObject = null;
let isObjectConfirmed = false;
let isDraggingObject = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let nextObjectId = 1;

// ========== 右键删除菜单 ==========
let deleteMenu = null;

// ========== Card 电子手帐系统 ==========
let isCardMode = false;
let cardObject = null;
let cardBgImages = [];
let currentCardBg = 0;
let cardElements = [];
let selectedElement = null;
let isTextInputActive = false;
let cardScale = 1.0;
let cardDisplayRect = null;
let nextElementId = 1;
let cardButtons = [];
let lastClickTime = 0;
let lastClickedElement = null;
let isDraggingElement = false;

// ========== 帮助系统 ==========
let isHelpOpen = false;
let helpButtonRect = null;

// ============================================
// 全局变量
// ============================================

let imgA = null;
let imgB = null;
let imgA_Y = 0;
let targetA_Y = 0;
let isLoaded = false;

let music1 = null;
let music2 = null;
let currentTrack = 1;
let isPlaying = false;
let gapTimer = 0;
let waitingForNext = false;
let musicStarted = false;

let iconCrust, iconCrumb;

// ============================================
// p5.js 生命周期函数
// ============================================

function preload() {
  imgA = loadImage('assets/imageA.png');
  imgB = loadImage('assets/imageB.png');
  music1 = loadSound('assets/music1.mp3');
  music2 = loadSound('assets/music2.mp3');
  
  brushPreload('assets/crust.png', 'assets/crumb.png');
  
  iconCrust = loadImage('assets/crust.png');
  iconCrumb = loadImage('assets/crumb.png');
  
  cardBgImages[0] = loadImage('assets/card1.png');
  cardBgImages[1] = loadImage('assets/card2.png');
  cardBgImages[2] = loadImage('assets/card3.png');
}

function setup() {
  let cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent('p5-container');
  
  videoElement = document.getElementById('intro-video');
  skipBtn = document.getElementById('skip-btn');
  skipDialog = document.getElementById('skip-dialog');
  p5Container = document.getElementById('p5-container');
  
  setupVideoEvents();
  
  if (imgA && imgB && music1 && music2) {
    isLoaded = true;
  }
  
  // 初始A图在上，但有动画
  imgA_Y = -height;
  targetA_Y = -height;
  
  initDrawingCanvas();
  
  noLoop();
}

function draw() {
  if (!videoFinished) {
    background(0);
    return;
  }
  
  if (isCardMode) {
    drawCardInterface();
    return;
  }
  
  if (isHelpOpen) {
    drawHelpPanel();
    return;
  }
  
  background(0);
  
  if (!isLoaded) {
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(24);
    text('Loading... Click or press any key to start', width/2, height/2);
    return;
  }
  
  updateMusic();
  
  let stage = getStageArea();
  
  // 使用lerp实现平滑动画
  imgA_Y = lerp(imgA_Y, targetA_Y, CONFIG.EASING);
  
  image(imgB, stage.x, stage.y, stage.w, stage.h);
  
  if (!isDrawingMode && !isCroppingMode) {
    drawFinishedObjects(stage.x, stage.y, stage.w, stage.h);
  }
  
  image(imgA, stage.x, stage.y + imgA_Y, stage.w, stage.h);
  
  if (isDrawingMode) drawDrawingInterface();
  if (isCroppingMode) drawCropInterface();
  if (isAdjustMode) drawAdjustMode();
  
  drawDeleteMenu();
  
  // 问号帮助按钮
  if (!isDrawingMode && !isCroppingMode && !isAdjustMode) {
    drawHelpButton();
  }
  
  if (!musicStarted && !isDrawingMode && !isAdjustMode && !isCroppingMode && !isCardMode) {
    drawStartHint();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
// ============================================
// 视频控制
// ============================================

function setupVideoEvents() {
  if (!videoElement) return;
  
  videoElement.addEventListener('ended', onVideoEnd);
  
  videoElement.addEventListener('canplay', () => {
    videoElement.play().catch(e => {
      skipBtn.textContent = '点击开始';
    });
  });
  
  skipBtn.addEventListener('click', showSkipDialog);
  
  document.getElementById('confirm-skip').addEventListener('click', () => {
    hideSkipDialog();
    skipVideo();
  });
  
  document.getElementById('cancel-skip').addEventListener('click', () => {
    hideSkipDialog();
    videoElement.play();
  });
  
  document.getElementById('video-container').addEventListener('click', (e) => {
    if (e.target === skipBtn) return;
    if (videoElement.paused) {
      videoElement.play();
      skipBtn.textContent = '跳过 ▶▶';
    }
  });
}

function showSkipDialog() {
  videoElement.pause();
  skipDialog.classList.add('active');
}

function hideSkipDialog() {
  skipDialog.classList.remove('active');
}

function skipVideo() {
  videoElement.pause();
  onVideoEnd();
}

function onVideoEnd() {
  if (videoFinished) return;
  videoFinished = true;
  
  document.getElementById('video-container').style.display = 'none';
  p5Container.style.display = 'block';
  
  loop();
}

// ============================================
// 统一舞台区域
// ============================================

function getStageArea() {
  let windowRatio = width / height;
  let stageW, stageH, stageX, stageY;
  
  if (windowRatio > CONFIG.IMAGE_RATIO) {
    stageH = height;
    stageW = height * CONFIG.IMAGE_RATIO;
    stageX = (width - stageW) / 2;
    stageY = 0;
  } else {
    stageW = width;
    stageH = width / CONFIG.IMAGE_RATIO;
    stageX = 0;
    stageY = (height - stageH) / 2;
  }
  
  return { x: stageX, y: stageY, w: stageW, h: stageH };
}

function calculateDrawSize() {
  let area = getStageArea();
  return { w: area.w, h: area.h };
}
// ============================================
// 画板系统
// ============================================

function initDrawingCanvas() {
  let w = 1920;
  let h = 1080;
  drawingGraphics = createGraphics(w, h);
  drawingGraphics.clear();
  brushSetup(80, drawingGraphics);
  initHistory();
}

function initHistory() {
  drawingHistory = [];
  historyStep = -1;
  saveDrawingState();
}

function saveDrawingState() {
  drawingHistory = drawingHistory.slice(0, historyStep + 1);
  
  let snapshot = createImage(1920, 1080);
  snapshot.copy(drawingGraphics, 0, 0, 1920, 1080, 0, 0, 1920, 1080);
  
  drawingHistory.push(snapshot);
  historyStep++;
  
  if (drawingHistory.length > 50) {
    drawingHistory.shift();
    historyStep--;
  }
}

function undoDrawing() {
  if (historyStep > 0) {
    historyStep--;
    restoreHistory();
  }
}

function redoDrawing() {
  if (historyStep < drawingHistory.length - 1) {
    historyStep++;
    restoreHistory();
  }
}

function restoreHistory() {
  if (historyStep < 0 || historyStep >= drawingHistory.length) return;
  let img = drawingHistory[historyStep];
  drawingGraphics.clear();
  drawingGraphics.image(img, 0, 0);
}

function clearDrawing() {
  drawingGraphics.clear();
  saveDrawingState();
}

function getCanvasArea() {
  let stage = getStageArea();
  
  let canvasH = stage.h * 0.55;
  let canvasW = canvasH * CONFIG.IMAGE_RATIO;
  
  if (canvasW > stage.w * 0.9) {
    canvasW = stage.w * 0.9;
    canvasH = canvasW / CONFIG.IMAGE_RATIO;
  }
  
  let canvasX = stage.x + (stage.w - canvasW) / 2;
  let canvasY = stage.y + stage.h * 0.05;
  
  return { x: canvasX, y: canvasY, w: canvasW, h: canvasH };
}

function getToolbarArea() {
  let stage = getStageArea();
  let canvas = getCanvasArea();
  
  let toolbarY = canvas.y + canvas.h + stage.h * 0.03;
  let toolbarH = stage.y + stage.h - toolbarY - stage.h * 0.02;
  
  return {
    x: stage.x + stage.w * 0.05,
    y: toolbarY,
    w: stage.w * 0.9,
    h: max(toolbarH, stage.h * 0.25)
  };
}

function toggleDrawingMode() {
  isDrawingMode = !isDrawingMode;
  if (isDrawingMode) {
    isAdjustMode = false;
    isCroppingMode = false;
  }
}
// ============================================
// 画板界面绘制
// ============================================

function drawDrawingInterface() {
  let canvas = getCanvasArea();
  let toolbar = getToolbarArea();
  let stage = getStageArea();
  
  push();
  
  fill(0, 0, 0, 200);
  
  if (canvas.y > stage.y) {
    rect(stage.x, stage.y, stage.w, canvas.y - stage.y);
  }
  if (toolbar.y + toolbar.h < stage.y + stage.h) {
    rect(stage.x, toolbar.y + toolbar.h, stage.w, stage.y + stage.h - toolbar.y - toolbar.h);
  }
  if (canvas.x > stage.x) {
    rect(stage.x, canvas.y, canvas.x - stage.x, toolbar.y + toolbar.h - canvas.y);
  }
  if (canvas.x + canvas.w < stage.x + stage.w) {
    rect(canvas.x + canvas.w, canvas.y, stage.x + stage.w - canvas.x - canvas.w, toolbar.y + toolbar.h - canvas.y);
  }
  
  fill(255);
  rect(canvas.x, canvas.y, canvas.w, canvas.h, 5);
  
  if (drawingGraphics) {
    image(drawingGraphics, canvas.x, canvas.y, canvas.w, canvas.h);
  }
  
  fill(30, 30, 30, 220);
  rect(toolbar.x, toolbar.y, toolbar.w, toolbar.h, 10);
  
  let uiScale = stage.h / 1080;
  
  // 放大图标和按钮
  let iconSize = min(90 * uiScale, toolbar.h * 0.45);
  let iconY = toolbar.y + toolbar.h * 0.12;
  let leftMargin = toolbar.x + 20 * uiScale;
  
  drawBrushIcon(iconCrust, leftMargin, iconY, iconSize, 'crust');
  drawBrushIcon(iconCrumb, leftMargin + iconSize + 20 * uiScale, iconY, iconSize, 'crumb');
  
  fill(255);
  textAlign(LEFT, CENTER);
  textSize(16 * uiScale);
  text("大小: " + int(brushGetSize()), leftMargin, iconY + iconSize + 25 * uiScale);
  
  fill(200);
  textAlign(CENTER, CENTER);
  textSize(14 * uiScale);
  text("滚轮调大小", toolbar.x + toolbar.w * 0.35, toolbar.y + toolbar.h * 0.3);
  text("1=脆皮 2=碎屑", toolbar.x + toolbar.w * 0.35, toolbar.y + toolbar.h * 0.6);
  
  // 放大按钮
  let btnW = min(100 * uiScale, toolbar.w * 0.2);
  let btnH = min(50 * uiScale, toolbar.h * 0.4);
  let btnY = toolbar.y + toolbar.h * 0.5 - btnH/2;
  let rightStart = toolbar.x + toolbar.w * 0.55;
  let btnGap = 15 * uiScale;
  
  drawButton("撤销", rightStart, btnY, btnW, btnH, uiScale);
  drawButton("前进", rightStart + btnW + btnGap, btnY, btnW, btnH, uiScale);
  drawButton("清空", rightStart + (btnW + btnGap) * 2, btnY, btnW, btnH, uiScale);
  drawButton("完成", rightStart + (btnW + btnGap) * 3, btnY, btnW * 1.2, btnH, uiScale, '#27ae60');
  
  pop();
}

function drawButton(label, x, y, w, h, scale, bgColor) {
  push();
  
  let hover = mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h;
  
  if (bgColor) {
    if (hover) {
      fill(red(color(bgColor)) + 30, green(color(bgColor)) + 30, blue(color(bgColor)) + 30);
      cursor(HAND);
    } else {
      fill(bgColor);
    }
  } else {
    if (hover) {
      fill(80, 150, 255);
      cursor(HAND);
    } else {
      fill(60, 120, 220);
    }
  }
  
  rect(x, y, w, h, 8 * scale);
  
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(16 * scale);
  text(label, x + w/2, y + h/2);
  
  pop();
}

function drawBrushIcon(img, x, y, size, type) {
  push();
  
  let isSelected = brushGetType() === type;
  let hover = mouseX > x && mouseX < x + size && mouseY > y && mouseY < y + size;
  
  if (isSelected) {
    stroke(100, 200, 255);
    strokeWeight(4);
    fill(255, 255, 255, 80);
  } else if (hover) {
    stroke(200, 200, 200);
    strokeWeight(2);
    fill(255, 255, 255, 40);
    cursor(HAND);
  } else {
    stroke(150);
    strokeWeight(1);
    fill(255, 255, 255, 20);
  }
  
  rect(x, y, size, size, 8);
  
  noStroke();
  if (img && img.width > 0) {
    let s = min(size * 0.75 / img.width, size * 0.75 / img.height);
    let dw = img.width * s;
    let dh = img.height * s;
    image(img, x + (size-dw)/2, y + (size-dh)/2, dw, dh);
  }
  
  fill(255);
  textAlign(CENTER);
  textSize(max(size * 0.22, 12));
  text(type === 'crust' ? '脆皮' : '碎屑', x + size/2, y + size + size * 0.35);
  
  pop();
}
// ============================================
// 裁剪系统
// ============================================

function finishDrawing() {
  if (!drawingGraphics) return;
  
  isDrawingMode = false;
  isCroppingMode = true;
  
  cropRect = {
    x: 1920 * 0.2,
    y: 1080 * 0.2,
    w: 1920 * 0.6,
    h: 1080 * 0.6
  };
}

function drawCropInterface() {
  let stage = getStageArea();
  
  push();
  
  background(0, 0, 0, 180);
  
  // 放大画布显示
  let bigCanvasH = stage.h * 0.75;
  let bigCanvasW = bigCanvasH * CONFIG.IMAGE_RATIO;
  
  if (bigCanvasW > stage.w * 0.95) {
    bigCanvasW = stage.w * 0.95;
    bigCanvasH = bigCanvasW / CONFIG.IMAGE_RATIO;
  }
  
  let bigX = stage.x + (stage.w - bigCanvasW) / 2;
  let bigY = stage.y + stage.h * 0.02;
  
  let displayCanvas = {x: bigX, y: bigY, w: bigCanvasW, h: bigCanvasH};
  
  image(drawingGraphics, bigX, bigY, bigCanvasW, bigCanvasH);
  
  let screenCrop = canvasToScreenRect(cropRect, displayCanvas);
  
  noStroke();
  fill(0, 0, 0, 150);
  
  rect(bigX, bigY, bigCanvasW, screenCrop.y - bigY);
  rect(bigX, screenCrop.y + screenCrop.h, bigCanvasW, bigY + bigCanvasH - screenCrop.y - screenCrop.h);
  rect(bigX, screenCrop.y, screenCrop.x - bigX, screenCrop.h);
  rect(screenCrop.x + screenCrop.w, screenCrop.y, bigX + bigCanvasW - screenCrop.x - screenCrop.w, screenCrop.h);
  
  stroke(255);
  strokeWeight(3);
  drawingContext.setLineDash([10, 5]);
  noFill();
  rect(screenCrop.x, screenCrop.y, screenCrop.w, screenCrop.h);
  drawingContext.setLineDash([]);
  
  drawResizeHandle(screenCrop.x, screenCrop.y, 'nw');
  drawResizeHandle(screenCrop.x + screenCrop.w, screenCrop.y, 'ne');
  drawResizeHandle(screenCrop.x, screenCrop.y + screenCrop.h, 'sw');
  drawResizeHandle(screenCrop.x + screenCrop.w, screenCrop.y + screenCrop.h, 'se');
  
  // 按钮下移，放大
  let btnY = bigY + bigCanvasH + 30;
  let uiScale = stage.h / 1080;
  
  drawButton("确认裁剪", stage.x + stage.w/2 - 110 * uiScale, btnY, 100 * uiScale, 50 * uiScale, uiScale, '#27ae60');
  drawButton("重新绘制", stage.x + stage.w/2 + 10 * uiScale, btnY, 100 * uiScale, 50 * uiScale, uiScale, '#e74c3c');
  
  // 分行提示，加大字体
  fill(255);
  textAlign(CENTER);
  textSize(20 * uiScale);
  let tipY = bigY - 40 * uiScale;
  text("拖拽框体：移动位置", stage.x + stage.w/2, tipY);
  textSize(18 * uiScale);
  text("拖拽四角：调整大小 | 滚轮：缩放裁剪框", stage.x + stage.w/2, tipY + 28 * uiScale);
  
  pop();
}

function drawResizeHandle(sx, sy, type) {
  push();
  let over = dist(mouseX, mouseY, sx, sy) < CROP_HANDLE_SIZE + 5;
  
  if (over || isResizingCrop && resizeHandle === type) {
    fill(100, 200, 255);
    cursor(CROSS);
  } else {
    fill(255);
  }
  
  noStroke();
  ellipse(sx, sy, CROP_HANDLE_SIZE, CROP_HANDLE_SIZE);
  pop();
}

function canvasToScreenRect(rect, area) {
  return {
    x: map(rect.x, 0, 1920, area.x, area.x + area.w),
    y: map(rect.y, 0, 1080, area.y, area.y + area.h),
    w: map(rect.w, 0, 1920, 0, area.w),
    h: map(rect.h, 0, 1080, 0, area.h)
  };
}

function screenToCanvasRect(sx, sy, area) {
  return {
    x: map(sx, area.x, area.x + area.w, 0, 1920),
    y: map(sy, area.y, area.y + area.h, 0, 1080)
  };
}

function confirmCrop() {
  if (!cropRect || !drawingGraphics) return;
  
  let c = cropRect;
  c.x = constrain(c.x, 0, 1920);
  c.y = constrain(c.y, 0, 1080);
  c.w = constrain(c.w, 10, 1920 - c.x);
  c.h = constrain(c.h, 10, 1080 - c.y);
  
  let cropped = createImage(int(c.w), int(c.h));
  cropped.copy(drawingGraphics, int(c.x), int(c.y), int(c.w), int(c.h), 0, 0, int(c.w), int(c.h));
  
  currentObject = {
    id: nextObjectId++,
    img: cropped,
    x: width / 2,
    y: height / 2,
    scale: 1.0,
    w: int(c.w),
    h: int(c.h)
  };
  
  isCroppingMode = false;
  isAdjustMode = true;
  isObjectConfirmed = false;
  
  // 动画上移
  targetA_Y = -height;
  
  drawingGraphics.clear();
  initHistory();
}
// ============================================
// 摆放模式
// ============================================

function drawAdjustMode() {
  push();
  
  fill(255, 255, 255, 200);
  textAlign(CENTER, TOP);
  textSize(18);
  
  if (!isObjectConfirmed) {
    text("拖动调整位置 | 滚轮缩放 | 点击临时确定", width/2, 20);
  } else {
    text("滚轮缩放 | 拖动调整 | 回车永久确定 | 右键删除", width/2, 20);
  }
  
  for (let obj of finishedObjects) {
    drawObject(obj, false);
  }
  
  if (currentObject) {
    drawObject(currentObject, true);
  }
  
  pop();
}

function drawObject(obj, isCurrent) {
  if (!obj || !obj.img) return;
  
  push();
  
  let imgW = obj.img.width;
  let imgH = obj.img.height;
  let displayW = imgW * obj.scale;
  let displayH = imgH * obj.scale;
  
  imageMode(CENTER);
  
  if (isCurrent && !isObjectConfirmed) {
    tint(255, 220);
    stroke(100, 200, 255);
    strokeWeight(3);
    noFill();
    rect(obj.x - displayW/2, obj.y - displayH/2, displayW, displayH);
  } else if (isCurrent && isObjectConfirmed) {
    stroke(100, 255, 150);
    strokeWeight(2);
    noFill();
    rect(obj.x - displayW/2, obj.y - displayH/2, displayW, displayH);
  }
  
  noTint();
  noStroke();
  image(obj.img, obj.x, obj.y, displayW, displayH);
  
  pop();
}

function drawFinishedObjects(stageX, stageY, stageW, stageH) {
  for (let obj of finishedObjects) {
    push();
    
    let displayW = obj.w * obj.scale;
    let displayH = obj.h * obj.scale;
    
    imageMode(CENTER);
    image(obj.img, obj.x, obj.y, displayW, displayH);
    
    pop();
  }
}

function permanentConfirm() {
  if (!currentObject || !isObjectConfirmed) return;
  
  finishedObjects.push({
    id: currentObject.id,
    img: currentObject.img,
    x: currentObject.x,
    y: currentObject.y,
    scale: currentObject.scale,
    w: currentObject.w,
    h: currentObject.h,
    card: null
  });
  
  currentObject = null;
  isAdjustMode = false;
  isObjectConfirmed = false;
  
  // 保持A图在上
  targetA_Y = -height;
}
// ============================================
// 删除菜单
// ============================================

function showDeleteMenu(x, y, objectId) {
  deleteMenu = { x: x, y: y, targetId: objectId, visible: true };
}

function isOverDeleteMenu(mx, my) {
  if (!deleteMenu || !deleteMenu.visible) return false;
  return mx > deleteMenu.x && mx < deleteMenu.x + 120 &&
         my > deleteMenu.y && my < deleteMenu.y + 40;
}

function drawDeleteMenu() {
  if (!deleteMenu || !deleteMenu.visible) return;
  
  push();
  fill(50, 50, 50, 230);
  stroke(200, 80, 80);
  strokeWeight(2);
  rect(deleteMenu.x, deleteMenu.y, 120, 40, 6);
  
  noStroke();
  fill(255, 100, 100);
  textAlign(CENTER, CENTER);
  textSize(14);
  text("🗑 删除", deleteMenu.x + 60, deleteMenu.y + 20);
  
  if (mouseIsPressed && mouseButton === LEFT) {
    if (mouseX > deleteMenu.x && mouseX < deleteMenu.x + 120 &&
        mouseY > deleteMenu.y && mouseY < deleteMenu.y + 40) {
      deleteObjectById(deleteMenu.targetId);
      deleteMenu.visible = false;
    }
  }
  pop();
}

function deleteObjectById(id) {
  for (let i = finishedObjects.length - 1; i >= 0; i--) {
    if (finishedObjects[i].id === id) {
      finishedObjects.splice(i, 1);
      return;
    }
  }
}

function isOnObject(mx, my, obj) {
  if (!obj) return false;
  
  let displayW = obj.w * obj.scale;
  let displayH = obj.h * obj.scale;
  
  return mx > obj.x - displayW/2 && mx < obj.x + displayW/2 &&
         my > obj.y - displayH/2 && my < obj.y + displayH/2;
}

// ============================================
// 帮助系统
// ============================================

function drawHelpButton() {
  let stage = getStageArea();
  let btnSize = 40;
  let btnX = stage.x + stage.w - btnSize - 15;
  let btnY = stage.y + 15;
  
  helpButtonRect = { x: btnX, y: btnY, w: btnSize, h: btnSize };
  
  push();
  
  let hover = mouseX > btnX && mouseX < btnX + btnSize &&
              mouseY > btnY && mouseY < btnY + btnSize;
  
  if (hover) {
    fill(100, 150, 255);
    cursor(HAND);
  } else {
    fill(200, 200, 200, 180);
  }
  
  ellipse(btnX + btnSize/2, btnY + btnSize/2, btnSize, btnSize);
  
  fill(30);
  textAlign(CENTER, CENTER);
  textSize(24);
  text("?", btnX + btnSize/2, btnY + btnSize/2);
  
  pop();
}

function drawHelpPanel() {
  push();
  
  fill(0, 0, 0, 200);
  rect(0, 0, width, height);
  
  let panelW = min(600, width * 0.85);
  let panelH = min(550, height * 0.85);
  let panelX = (width - panelW) / 2;
  let panelY = (height - panelH) / 2;
  
  fill(40, 40, 50);
  stroke(100, 150, 255);
  strokeWeight(2);
  rect(panelX, panelY, panelW, panelH, 15);
  
  fill(255);
  noStroke();
  textAlign(CENTER, TOP);
  textSize(28);
  text("操作指南", width/2, panelY + 25);
  
  textAlign(LEFT, TOP);
  textSize(15);
  let lineH = 26;
  let startY = panelY + 70;
  let startX = panelX + 35;
  
  let lines = [
    "【全局操作】",
    "W / S        —  上层图 上升 / 下降",
    "E            —  进入画板模式",
    "",
    "【画板模式】",
    "鼠标拖拽     —  绘制笔刷",
    "滚轮         —  调整笔刷大小",
    "1 / 2        —  切换脆皮 / 碎屑笔刷",
    "Z / X        —  撤销 / 前进",
    "C            —  清空画布",
    "Enter        —  完成绘制",
    "",
    "【裁剪模式】",
    "拖拽框体     —  移动裁剪区域",
    "拖拽四角     —  调整裁剪大小",
    "滚轮         —  缩放裁剪框",
    "",
    "【摆放模式】",
    "鼠标拖拽     —  移动物体位置",
    "滚轮         —  缩放物体大小",
    "点击物体     —  临时确定位置",
    "Enter        —  永久确定摆放",
    "",
    "【场景浏览】",
    "双击物体     —  打开 Card 日记",
    "右键物体     —  删除物体",
    "",
    "【Card 日记】",
    "拖拽元素     —  移动位置",
    "滚轮         —  缩放大小",
    "双击文字     —  编辑文字内容",
    "导入图片     —  只能1张，自动压缩"
  ];
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === "") continue;
    
    if (lines[i].startsWith("【")) {
      fill(100, 200, 255);
      textSize(17);
    } else {
      fill(220);
      textSize(14);
    }
    
    text(lines[i], startX, startY + i * lineH);
  }
  
  fill(150);
  textAlign(CENTER, BOTTOM);
  textSize(14);
  text("点击任意处关闭", width/2, panelY + panelH - 20);
  
  pop();
}
// ============================================
// Card 电子手帐系统
// ============================================

function enterCardMode(obj) {
  isCardMode = true;
  cardObject = obj;
  
  if (!obj.card) {
    obj.card = {
      bgIndex: 0,
      elements: [],
      isLocked: false,
      importedImage: null
    };
  }
  
  cardElements = JSON.parse(JSON.stringify(obj.card.elements));
  currentCardBg = obj.card.bgIndex;
  
  let stage = getStageArea();
  let maxCardW = stage.w * 0.55;
  let maxCardH = stage.h * 0.85;
  let cardRatio = 2496 / 1792;
  
  if (maxCardW / maxCardH > cardRatio) {
    cardScale = maxCardH / 1792;
  } else {
    cardScale = maxCardW / 2496;
  }
}

function drawCardInterface() {
  let stage = getStageArea();
  
  push();
  
  background(20, 20, 30);
  
  let cardMaxW = stage.w * 0.55;
  let cardMaxH = stage.h * 0.85;
  let cardRatio = 2496 / 1792;
  
  let cardW, cardH;
  if (cardMaxW / cardMaxH > cardRatio) {
    cardH = cardMaxH;
    cardW = cardH * cardRatio;
  } else {
    cardW = cardMaxW;
    cardH = cardW / cardRatio;
  }
  
  let cardX = stage.x + (stage.w * 0.55 - cardW) / 2;
  let cardY = stage.y + (stage.h - cardH) / 2;
  
  cardDisplayRect = { x: cardX, y: cardY, w: cardW, h: cardH };
  
  if (cardBgImages[currentCardBg] && cardBgImages[currentCardBg].width > 0) {
    image(cardBgImages[currentCardBg], cardX, cardY, cardW, cardH);
  } else {
    fill(240, 230, 220);
    rect(cardX, cardY, cardW, cardH, 10);
  }
  
  if (cardObject && cardObject.card && cardObject.card.importedImage) {
    drawCardImageFixed(cardObject.card.importedImage);
  }
  
  for (let el of cardElements) {
    if (el.type === 'text') {
      drawCardTextFixed(el);
    }
  }
  
  if (selectedElement && !isTextInputActive) {
    drawSelectionBoxFixed(selectedElement);
  }
  
  drawCardButtonsFixed(stage);
  
  fill(255);
  textAlign(CENTER, TOP);
  textSize(14 * (stage.h / 1080));
  let status = cardObject.card.isLocked ? "（已锁定，点击'继续编辑'修改）" : "（编辑中）";
  text("Card 日记 " + status, stage.x + stage.w/2, stage.y + 10);
  
  pop();
}

function cardToScreenFixed(cx, cy) {
  if (!cardDisplayRect) return { x: 0, y: 0 };
  return {
    x: cardDisplayRect.x + cx * cardScale,
    y: cardDisplayRect.y + cy * cardScale
  };
}

function screenToCardFixed(sx, sy) {
  if (!cardDisplayRect) return { x: 0, y: 0 };
  return {
    x: (sx - cardDisplayRect.x) / cardScale,
    y: (sy - cardDisplayRect.y) / cardScale
  };
}

function drawCardImageFixed(imgData) {
  if (!imgData || !imgData.img) return;
  
  let pos = cardToScreenFixed(imgData.x, imgData.y);
  
  push();
  translate(pos.x, pos.y);
  rotate(imgData.rotation || 0);
  
  let displayW = imgData.width * cardScale * (imgData.scale || 1);
  let displayH = imgData.height * cardScale * (imgData.scale || 1);
  
  imageMode(CENTER);
  image(imgData.img, 0, 0, displayW, displayH);
  
  if (selectedElement && selectedElement.type === 'image' && selectedElement.id === 'imported') {
    noFill();
    stroke(100, 200, 255);
    strokeWeight(2);
    rect(-displayW/2, -displayH/2, displayW, displayH);
  }
  
  pop();
}

function drawCardTextFixed(el) {
  let pos = cardToScreenFixed(el.x, el.y);
  
  push();
  translate(pos.x, pos.y);
  rotate(el.rotation || 0);
  scale(el.scale || 1);
  
  noStroke();
  fill(el.color || '#333333');
  textAlign(LEFT, TOP);
  textSize(el.size * cardScale);
  text(el.content, 0, 0);
  
  if (selectedElement && selectedElement.id === el.id && !isTextInputActive) {
    noFill();
    stroke(100, 200, 255);
    strokeWeight(1);
    let tw = textWidth(el.content);
    let th = el.size * 1.2;
    rect(-2, -2, tw + 4, th);
  }
  
  pop();
}

function drawSelectionBoxFixed(el) {
  let pos = cardToScreenFixed(el.x, el.y);
  
  push();
  translate(pos.x, pos.y);
  rotate(el.rotation || 0);
  
  let boxW, boxH;
  
  if (el.type === 'text') {
    let displayScale = el.scale || 1;
    boxW = (el.width || 100) * cardScale * displayScale;
    boxH = el.size * 1.2 * cardScale * displayScale;
  } else {
    boxW = el.width * cardScale * (el.scale || 1);
    boxH = el.height * cardScale * (el.scale || 1);
  }
  
  noFill();
  stroke(100, 200, 255);
  strokeWeight(2);
  drawingContext.setLineDash([5, 3]);
  rect(-boxW/2, -boxH/2, boxW, boxH);
  drawingContext.setLineDash([]);
  
  fill(100, 200, 255);
  noStroke();
  let handleSize = 8;
  ellipse(-boxW/2, -boxH/2, handleSize, handleSize);
  ellipse(boxW/2, -boxH/2, handleSize, handleSize);
  ellipse(-boxW/2, boxH/2, handleSize, handleSize);
  ellipse(boxW/2, boxH/2, handleSize, handleSize);
  
  pop();
}

function drawCardButtonsFixed(stage) {
  let btnX = stage.x + stage.w * 0.72;
  let btnY = stage.y + stage.h * 0.12;
  let btnW = min(stage.w * 0.22, 140);
  let btnH = min(stage.h * 0.08, 45);
  let gap = stage.h * 0.02;
  
  cardButtons = [];
  
  let buttons = [];
  
  if (!cardObject.card.isLocked) {
    buttons = [
      { label: '导入文字', color: '#3498db', action: 'addText' },
      { label: '导入图片', color: '#9b59b6', action: 'addImage' },
      { label: '切换Card', color: '#e67e22', action: 'switchBg' },
      { label: '删除元素', color: '#e74c3c', action: 'deleteEl' },
      { label: '确定', color: '#27ae60', action: 'confirm' },
      { label: '退出', color: '#7f8c8d', action: 'exit' }
    ];
  } else {
    buttons = [
      { label: '继续编辑', color: '#3498db', action: 'unlock' },
      { label: '退出', color: '#7f8c8d', action: 'exit' }
    ];
  }
  
  for (let i = 0; i < buttons.length; i++) {
    let b = buttons[i];
    let y = btnY + i * (btnH + gap);
    
    if (y + btnH > stage.y + stage.h - 20) break;
    
    let hover = mouseX > btnX && mouseX < btnX + btnW &&
                mouseY > y && mouseY < y + btnH;
    
    push();
    if (hover) {
      fill(red(color(b.color)) + 20, green(color(b.color)) + 20, blue(color(b.color)) + 20);
      cursor(HAND);
    } else {
      fill(b.color);
    }
    
    rect(btnX, y, btnW, btnH, 6);
    
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(min(14, btnH * 0.4));
    text(b.label, btnX + btnW/2, y + btnH/2);
    pop();
    
    cardButtons.push({
      x: btnX, y: y, w: btnW, h: btnH,
      action: b.action
    });
  }
  
  fill(255);
  textAlign(CENTER);
  textSize(12);
  text("Card " + (currentCardBg + 1) + " / 3", btnX + btnW/2, btnY - 15);
}
function handleCardButton(action) {
  switch(action) {
    case 'addText':
      if (!cardObject.card.isLocked) addNewText();
      break;
    case 'addImage':
      if (!cardObject.card.isLocked) triggerImageUpload();
      break;
    case 'switchBg':
      currentCardBg = (currentCardBg + 1) % 3;
      if (!cardObject.card.isLocked) {
        cardObject.card.bgIndex = currentCardBg;
      }
      break;
    case 'deleteEl':
      if (!cardObject.card.isLocked && selectedElement) {
        deleteSelectedElement();
      }
      break;
    case 'confirm':
      if (!cardObject.card.isLocked) confirmCard();
      break;
    case 'unlock':
      cardObject.card.isLocked = false;
      cardElements = JSON.parse(JSON.stringify(cardObject.card.elements));
      break;
    case 'exit':
      exitCardMode();
      break;
  }
}

function addNewText() {
  let content = window.prompt("请输入文字：", "");
  
  if (!content || content.trim().length === 0) {
    return;
  }
  
  let newEl = {
    type: 'text',
    id: nextElementId++,
    content: content.trim(),
    x: 1248,
    y: 896,
    size: 40,
    color: '#333333',
    scale: 1,
    rotation: 0,
    width: textWidth(content.trim()) + 20
  };
  
  cardElements.push(newEl);
  selectedElement = newEl;
}

function startTextEditFixed(el) {
  let newContent = window.prompt("编辑文字：", el.content);
  
  if (newContent === null) {
    return;
  }
  
  newContent = newContent.trim();
  
  if (newContent.length === 0) {
    cardElements = cardElements.filter(e => e.id !== el.id);
    if (selectedElement && selectedElement.id === el.id) {
      selectedElement = null;
    }
    return;
  }
  
  el.content = newContent;
  textSize(el.size || 20);
  el.width = textWidth(newContent) + 20;
  
  for (let e of cardElements) {
    if (e.id === el.id) {
      e.content = newContent;
      e.width = el.width;
      break;
    }
  }
}

function deleteSelectedElement() {
  if (!selectedElement) return;
  
  if (selectedElement.type === 'text') {
    cardElements = cardElements.filter(e => e.id !== selectedElement.id);
  } else if (selectedElement.type === 'image') {
    cardObject.card.importedImage = null;
  }
  
  selectedElement = null;
}

function triggerImageUpload() {
  let fileInput = createFileInput(handleImageUpload);
  fileInput.elt.accept = 'image/*';
  fileInput.elt.click();
  fileInput.remove();
}

function handleImageUpload(file) {
  if (file.type !== 'image') return;
  
  loadImage(file.data, (img) => {
    let maxW = 1200;
    let newW = img.width;
    let newH = img.height;
    
    if (newW > maxW) {
      newH = newH * (maxW / newW);
      newW = maxW;
    }
    
    let compressed = createImage(int(newW), int(newH));
    let tempG = createGraphics(int(newW), int(newH));
    tempG.image(img, 0, 0, newW, newH);
    compressed.copy(tempG, 0, 0, int(newW), int(newH), 0, 0, int(newW), int(newH));
    
    cardObject.card.importedImage = {
      img: compressed,
      x: 1248,
      y: 896,
      width: newW,
      height: newH,
      scale: 1,
      rotation: 0
    };
    
    selectedElement = { type: 'image', id: 'imported', x: 1248, y: 896, width: newW, height: newH, scale: 1, rotation: 0 };
    
    tempG.remove();
  });
}

function confirmCard() {
  cardElements = cardElements.filter(e => {
    if (e.type === 'text') {
      return e.content && e.content.trim().length > 0;
    }
    return true;
  });
  
  cardObject.card.bgIndex = currentCardBg;
  cardObject.card.elements = JSON.parse(JSON.stringify(cardElements));
  cardObject.card.isLocked = true;
  
  selectedElement = null;
  isTextInputActive = false;
}

function exitCardMode() {
  isCardMode = false;
  cardObject = null;
  cardElements = [];
  selectedElement = null;
  isTextInputActive = false;
}

function findElementAtFixed(cx, cy) {
  if (cardObject.card.importedImage) {
    let img = cardObject.card.importedImage;
    let w = (img.width * (img.scale || 1)) / 2;
    let h = (img.height * (img.scale || 1)) / 2;
    if (cx > img.x - w && cx < img.x + w &&
        cy > img.y - h && cy < img.y + h) {
      return { 
        type: 'image', 
        id: 'imported', 
        x: img.x, 
        y: img.y, 
        width: img.width, 
        height: img.height, 
        scale: img.scale || 1, 
        rotation: img.rotation || 0 
      };
    }
  }
  
  for (let i = cardElements.length - 1; i >= 0; i--) {
    let el = cardElements[i];
    if (el.type === 'text') {
      let displayScale = el.scale || 1;
      let w = (el.width || 100) * displayScale;
      let h = el.size * 1.2 * displayScale;
      
      if (cx > el.x && cx < el.x + w &&
          cy > el.y && cy < el.y + h) {
        return el;
      }
    }
  }
  
  return null;
}
// ============================================
// 鼠标交互
// ============================================

function mousePressed() {
  if (!videoFinished) return;
  
  if (isHelpOpen) {
    isHelpOpen = false;
    return;
  }
  
  if (isCardMode) {
    for (let btn of cardButtons) {
      if (mouseX > btn.x && mouseX < btn.x + btn.w &&
          mouseY > btn.y && mouseY < btn.y + btn.h) {
        handleCardButton(btn.action);
        return;
      }
    }
    
    if (cardDisplayRect &&
        mouseX > cardDisplayRect.x && mouseX < cardDisplayRect.x + cardDisplayRect.w &&
        mouseY > cardDisplayRect.y && mouseY < cardDisplayRect.y + cardDisplayRect.h) {
      
      let cardPos = screenToCardFixed(mouseX, mouseY);
      let clicked = findElementAtFixed(cardPos.x, cardPos.y);
      
      if (clicked) {
        selectedElement = clicked;
        
        if (clicked.type === 'text' && !cardObject.card.isLocked) {
          let now = millis();
          if (now - lastClickTime < 400 && lastClickedElement === clicked.id) {
            startTextEditFixed(clicked);
            lastClickTime = 0;
            lastClickedElement = null;
            return;
          }
          lastClickTime = now;
          lastClickedElement = clicked.id;
        }
        
        isDraggingElement = true;
        dragOffsetX = cardPos.x - clicked.x;
        dragOffsetY = cardPos.y - clicked.y;
      } else {
        selectedElement = null;
        lastClickedElement = null;
      }
    }
    
    return;
  }
  
  if (!musicStarted && !isDrawingMode && !isAdjustMode && !isCroppingMode) {
    startMusic();
    musicStarted = true;
  }
  
  if (isDrawingMode) {
    checkDrawingUIClick();
    
    if (isInsideCanvas(mouseX, mouseY)) {
      let pos = screenToCanvas(mouseX, mouseY);
      brushStart(pos.x, pos.y);
      if (historyStep < 0) initHistory();
    }
    return;
  }
  
  if (isCroppingMode) {
    let canvas = getCanvasArea();
    let bigCanvasH = canvas.h / 0.55 * 0.75;
    let bigCanvasW = bigCanvasH * CONFIG.IMAGE_RATIO;
    if (bigCanvasW > canvas.w / 0.9 * 0.95) {
      bigCanvasW = canvas.w / 0.9 * 0.95;
      bigCanvasH = bigCanvasW / CONFIG.IMAGE_RATIO;
    }
    let bigX = canvas.x + (canvas.w - bigCanvasW) / 2;
    let bigY = canvas.y + canvas.h * 0.02;
    let displayCanvas = {x: bigX, y: bigY, w: bigCanvasW, h: bigCanvasH};
    let screenCrop = canvasToScreenRect(cropRect, displayCanvas);
    
    let handles = [
      {x: screenCrop.x, y: screenCrop.y, type: 'nw'},
      {x: screenCrop.x + screenCrop.w, y: screenCrop.y, type: 'ne'},
      {x: screenCrop.x, y: screenCrop.y + screenCrop.h, type: 'sw'},
      {x: screenCrop.x + screenCrop.w, y: screenCrop.y + screenCrop.h, type: 'se'}
    ];
    
    for (let h of handles) {
      if (dist(mouseX, mouseY, h.x, h.y) < CROP_HANDLE_SIZE + 5) {
        isResizingCrop = true;
        resizeHandle = h.type;
        cropStartPos = {x: mouseX, y: mouseY};
        return;
      }
    }
    
    if (mouseX > screenCrop.x && mouseX < screenCrop.x + screenCrop.w &&
        mouseY > screenCrop.y && mouseY < screenCrop.y + screenCrop.h) {
      isDraggingCrop = true;
      cropStartPos = {
        x: mouseX,
        y: mouseY,
        rectX: cropRect.x,
        rectY: cropRect.y
      };
      return;
    }
    
    let stage = getStageArea();
    let btnY = bigY + bigCanvasH + 30;
    let uiScale = stage.h / 1080;
    
    if (mouseY > btnY && mouseY < btnY + 50 * uiScale) {
      if (mouseX > stage.x + stage.w/2 - 110 * uiScale && mouseX < stage.x + stage.w/2 - 10 * uiScale) {
        confirmCrop();
        return;
      }
      if (mouseX > stage.x + stage.w/2 + 10 * uiScale && mouseX < stage.x + stage.w/2 + 110 * uiScale) {
        isCroppingMode = false;
        isDrawingMode = true;
        return;
      }
    }
    
    return;
  }
  
  if (isAdjustMode && currentObject) {
    if (mouseButton === LEFT) {
      if (isOnObject(mouseX, mouseY, currentObject)) {
        if (!isObjectConfirmed) {
          isObjectConfirmed = true;
        } else {
          isDraggingObject = true;
          dragOffsetX = mouseX - currentObject.x;
          dragOffsetY = mouseY - currentObject.y;
        }
      }
    }
    return;
  }
  
  if (!isDrawingMode && !isAdjustMode && !isCroppingMode) {
    if (mouseButton === RIGHT) {
      for (let i = finishedObjects.length - 1; i >= 0; i--) {
        let obj = finishedObjects[i];
        if (isOnObject(mouseX, mouseY, obj)) {
          showDeleteMenu(mouseX, mouseY, obj.id);
          return;
        }
      }
    }
    
    if (mouseButton === LEFT) {
      let now = millis();
      
      for (let i = finishedObjects.length - 1; i >= 0; i--) {
        let obj = finishedObjects[i];
        if (isOnObject(mouseX, mouseY, obj)) {
          if (now - lastClickTime < 400 && lastClickedElement === obj.id) {
            enterCardMode(obj);
            lastClickTime = 0;
            lastClickedElement = null;
            return;
          }
          lastClickTime = now;
          lastClickedElement = obj.id;
          return;
        }
      }
    }
    
    // 检测问号按钮
    if (helpButtonRect &&
        mouseX > helpButtonRect.x && mouseX < helpButtonRect.x + helpButtonRect.w &&
        mouseY > helpButtonRect.y && mouseY < helpButtonRect.y + helpButtonRect.h) {
      isHelpOpen = true;
      return;
    }
  }
}

function mouseDragged() {
  if (isDrawingMode && isInsideCanvas(mouseX, mouseY)) {
    let pos = screenToCanvas(mouseX, mouseY);
    brushDraw(pos.x, pos.y);
    return false;
  }
  
  if (isCroppingMode && isDraggingCrop) {
    let canvas = getCanvasArea();
    let bigCanvasH = canvas.h / 0.55 * 0.75;
    let bigCanvasW = bigCanvasH * CONFIG.IMAGE_RATIO;
    if (bigCanvasW > canvas.w / 0.9 * 0.95) {
      bigCanvasW = canvas.w / 0.9 * 0.95;
      bigCanvasH = bigCanvasW / CONFIG.IMAGE_RATIO;
    }
    let bigX = canvas.x + (canvas.w - bigCanvasW) / 2;
    let bigY = canvas.y + canvas.h * 0.02;
    let displayCanvas = {x: bigX, y: bigY, w: bigCanvasW, h: bigCanvasH};
    
    let dx = mouseX - cropStartPos.x;
    let dy = mouseY - cropStartPos.y;
    
    let canvasDx = map(dx, 0, displayCanvas.w, 0, 1920);
    let canvasDy = map(dy, 0, displayCanvas.h, 0, 1080);
    
    cropRect.x = constrain(cropStartPos.rectX + canvasDx, 0, 1920 - cropRect.w);
    cropRect.y = constrain(cropStartPos.rectY + canvasDy, 0, 1080 - cropRect.h);
    
    return false;
  }
  
  if (isCroppingMode && isResizingCrop) {
    let canvas = getCanvasArea();
    let bigCanvasH = canvas.h / 0.55 * 0.75;
    let bigCanvasW = bigCanvasH * CONFIG.IMAGE_RATIO;
    if (bigCanvasW > canvas.w / 0.9 * 0.95) {
      bigCanvasW = canvas.w / 0.9 * 0.95;
      bigCanvasH = bigCanvasW / CONFIG.IMAGE_RATIO;
    }
    let bigX = canvas.x + (canvas.w - bigCanvasW) / 2;
    let bigY = canvas.y + canvas.h * 0.02;
    let displayCanvas = {x: bigX, y: bigY, w: bigCanvasW, h: bigCanvasH};
    
    let pos = screenToCanvasRect(mouseX, mouseY, displayCanvas);
    
    if (resizeHandle === 'se') {
      cropRect.w = constrain(pos.x - cropRect.x, 50, 1920 - cropRect.x);
      cropRect.h = constrain(pos.y - cropRect.y, 50, 1080 - cropRect.y);
    }
    else if (resizeHandle === 'sw') {
      let newX = constrain(pos.x, 0, cropRect.x + cropRect.w - 50);
      cropRect.w = cropRect.x + cropRect.w - newX;
      cropRect.x = newX;
      cropRect.h = constrain(pos.y - cropRect.y, 50, 1080 - cropRect.y);
    }
    else if (resizeHandle === 'ne') {
      let newY = constrain(pos.y, 0, cropRect.y + cropRect.h - 50);
      cropRect.h = cropRect.y + cropRect.h - newY;
      cropRect.y = newY;
      cropRect.w = constrain(pos.x - cropRect.x, 50, 1920 - cropRect.x);
    }
    else if (resizeHandle === 'nw') {
      let newX = constrain(pos.x, 0, cropRect.x + cropRect.w - 50);
      let newY = constrain(pos.y, 0, cropRect.y + cropRect.h - 50);
      cropRect.w = cropRect.x + cropRect.w - newX;
      cropRect.h = cropRect.y + cropRect.h - newY;
      cropRect.x = newX;
      cropRect.y = newY;
    }
    
    return false;
  }
  
  if (isAdjustMode && isDraggingObject && currentObject) {
    currentObject.x = mouseX - dragOffsetX;
    currentObject.y = mouseY - dragOffsetY;
    return false;
  }
  
  if (isCardMode && isDraggingElement && selectedElement && !cardObject.card.isLocked) {
    let cardPos = screenToCardFixed(mouseX, mouseY);
    
    let newX = constrain(cardPos.x - dragOffsetX, 50, 2446);
    let newY = constrain(cardPos.y - dragOffsetY, 50, 1742);
    
    if (selectedElement.type === 'text') {
      for (let el of cardElements) {
        if (el.id === selectedElement.id) {
          el.x = newX;
          el.y = newY;
          selectedElement.x = newX;
          selectedElement.y = newY;
          break;
        }
      }
    } else if (selectedElement.type === 'image') {
      if (cardObject.card.importedImage) {
        cardObject.card.importedImage.x = newX;
        cardObject.card.importedImage.y = newY;
        selectedElement.x = newX;
        selectedElement.y = newY;
      }
    }
    
    return false;
  }
}

function mouseReleased() {
  if (isDrawingMode) {
    saveDrawingState();
  }
  
  isDraggingCrop = false;
  isResizingCrop = false;
  resizeHandle = '';
  isDraggingObject = false;
  isDraggingElement = false;
}

function mouseWheel(event) {
  if (isDrawingMode) {
    brushScroll(event);
    return false;
  }
  
  if (isCroppingMode) {
    let delta = event.delta > 0 ? 0.95 : 1.05;
    let newW = cropRect.w * delta;
    let newH = cropRect.h * delta;
    
    if (newW > 50 && newH > 50 && newW < 1920 && newH < 1080) {
      cropRect.x += (cropRect.w - newW) / 2;
      cropRect.y += (cropRect.h - newH) / 2;
      cropRect.w = newW;
      cropRect.h = newH;
    }
    return false;
  }
  
  if (isCardMode && selectedElement && !cardObject.card.isLocked) {
    let delta = event.delta > 0 ? 0.9 : 1.1;
    
    if (selectedElement.type === 'text') {
      selectedElement.scale *= delta;
      selectedElement.scale = constrain(selectedElement.scale, 0.5, 5);
      
      for (let el of cardElements) {
        if (el.id === selectedElement.id) {
          el.scale = selectedElement.scale;
          break;
        }
      }
    } else if (selectedElement.type === 'image') {
      if (cardObject.card.importedImage) {
        cardObject.card.importedImage.scale *= delta;
        cardObject.card.importedImage.scale = constrain(cardObject.card.importedImage.scale, 0.1, 5);
      }
    }
    
    return false;
  }
  
  if (isAdjustMode && currentObject) {
    let delta = event.delta > 0 ? 0.9 : 1.1;
    currentObject.scale *= delta;
    currentObject.scale = constrain(currentObject.scale, 0.1, 5.0);
    return false;
  }
}

function isInsideCanvas(sx, sy) {
  let area = getCanvasArea();
  return sx > area.x && sx < area.x + area.w &&
         sy > area.y && sy < area.y + area.h;
}

function screenToCanvas(sx, sy) {
  let area = getCanvasArea();
  return {
    x: map(sx, area.x, area.x + area.w, 0, 1920),
    y: map(sy, area.y, area.y + area.h, 0, 1080)
  };
}

function checkDrawingUIClick() {
  let toolbar = getToolbarArea();
  let stage = getStageArea();
  let uiScale = stage.h / 1080;
  
  let iconSize = min(90 * uiScale, toolbar.h * 0.45);
  let iconY = toolbar.y + toolbar.h * 0.12;
  let leftMargin = toolbar.x + 20 * uiScale;
  
  let crustX = leftMargin;
  let crumbX = leftMargin + iconSize + 20 * uiScale;
  
  if (mouseY > iconY && mouseY < iconY + iconSize) {
    if (mouseX > crustX && mouseX < crustX + iconSize) {
      brushSetType('crust');
      return;
    }
    if (mouseX > crumbX && mouseX < crumbX + iconSize) {
      brushSetType('crumb');
      return;
    }
  }
  
  let btnW = min(100 * uiScale, toolbar.w * 0.2);
  let btnH = min(50 * uiScale, toolbar.h * 0.4);
  let btnY = toolbar.y + toolbar.h * 0.5 - btnH/2;
  let rightStart = toolbar.x + toolbar.w * 0.55;
  let btnGap = 15 * uiScale;
  
  if (mouseY > btnY && mouseY < btnY + btnH) {
    if (mouseX > rightStart && mouseX < rightStart + btnW) {
      undoDrawing();
      return;
    }
    else if (mouseX > rightStart + btnW + btnGap && mouseX < rightStart + btnW * 2 + btnGap) {
      redoDrawing();
      return;
    }
    else if (mouseX > rightStart + (btnW + btnGap) * 2 && mouseX < rightStart + (btnW + btnGap) * 2 + btnW) {
      clearDrawing();
      return;
    }
    else if (mouseX > rightStart + (btnW + btnGap) * 3 && mouseX < rightStart + (btnW + btnGap) * 3 + btnW * 1.2) {
      finishDrawing();
      return;
    }
  }
}
// ============================================
// 键盘控制
// ============================================

function keyPressed() {
  if ((key === 'e' || key === 'E') && !isAdjustMode && !isCroppingMode && !isCardMode && !isHelpOpen) {
    toggleDrawingMode();
    return false;
  }
  
  if (isDrawingMode) {
    if (key === 'z' || key === 'Z') undoDrawing();
    if (key === 'x' || key === 'X') redoDrawing();
    if (key === 'c' || key === 'C') clearDrawing();
    if (key === 'Enter') finishDrawing();
    if (key === '1') brushSetType('crust');
    if (key === '2') brushSetType('crumb');
    return false;
  }
  
  if (isCroppingMode) {
    if (key === 'Enter') confirmCrop();
    if (key === 'Escape') {
      isCroppingMode = false;
      isDrawingMode = true;
    }
    return false;
  }
  
  if (isCardMode) {
    if (key === 'Escape') exitCardMode();
    if (key === 'Enter') {
      if (!cardObject.card.isLocked) {
        confirmCard();
      }
    }
    if (key === 'Delete' || key === 'Backspace') {
      if (selectedElement && !cardObject.card.isLocked) {
        deleteSelectedElement();
      }
    }
    return false;
  }
  
  if (isAdjustMode) {
    if (key === 'Enter' && isObjectConfirmed) {
      permanentConfirm();
    }
    return false;
  }
  
  if (!musicStarted) {
    startMusic();
    musicStarted = true;
  }
  
  if (key === 'w' || key === 'W') {
    targetA_Y = -height;
  }
  if (key === 's' || key === 'S') {
    targetA_Y = 0;
  }
  
  return false;
}

// ============================================
// 音乐控制
// ============================================

function startMusic() {
  currentTrack = 1;
  playTrack(1);
  console.log('Music started');
}

function playTrack(trackNum) {
  if (music1.isPlaying()) music1.stop();
  if (music2.isPlaying()) music2.stop();
  
  if (trackNum === 1) {
    music1.play();
    music1.onended(handleTrackEnded);
  } else {
    music2.play();
    music2.onended(handleTrackEnded);
  }
  
  currentTrack = trackNum;
  isPlaying = true;
  waitingForNext = false;
}

function handleTrackEnded() {
  isPlaying = false;
  waitingForNext = true;
  gapTimer = millis();
}

function updateMusic() {
  if (!waitingForNext) return;
  
  let elapsed = millis() - gapTimer;
  if (elapsed >= CONFIG.MUSIC_GAP) {
    let nextTrack = (currentTrack === 1) ? 2 : 1;
    playTrack(nextTrack);
  }
}

// ============================================
// 提示
// ============================================

function drawStartHint() {
  push();
  fill(255, 255, 255, 150);
  textAlign(CENTER, CENTER);
  textSize(16);
  text('Click or press any key to start music', width/2, height - 50);
  pop();
}
