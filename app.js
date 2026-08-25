/* ECI Moonlight AR — app logic.
   Phase 2 milestone 1: MediaPipe Face Landmarker drives the headband's
   position/scale/rotation live. Occlusion (real hair over the band) is not
   done yet — see README. */

const screens={
  welcome:document.getElementById('welcome'),
  studio:document.getElementById('studio'),
  draw:document.getElementById('drawScreen'),
  capture:document.getElementById('captureScreen'),
};

const tr={
  en:{langShort:'EN',eyebrow:'MID-AUTUMN AR EXPERIENCE',heroTitle:'Design Your Moonlight Headband',heroSubtitle:'Create · Try on · Share',start:'START AR',privacy:'Camera is used only for the live preview on your device.',cameraTitle:'Camera preview',cameraFallback:'Camera preview will appear here.',cameraDenied:'Camera access is blocked. Allow camera access in your browser settings, then try again.',cameraUnavailable:'Camera is not available in this preview. Please test on an HTTPS website.',retry:'TRY AGAIN',prototype:'UI Prototype · Face tracking next',style:'STYLE',color:'COLOR',pattern:'PATTERN',draw:'DRAW',text:'TEXT',beauty:'BEAUTY',cancel:'CANCEL',done:'DONE',drawTitle:'DRAW',drawTip:'Draw on the flat headband. Your artwork stays editable and can be recolored later.',pen:'Pen',eraser:'Eraser',clear:'Clear',undo:'Undo',redo:'Redo',brush:'Brush',midAutumn:'MID-AUTUMN FESTIVAL',greetingTitle:'Happy Mid-Autumn Festival',greetingBody:'Wishing you a season of connection, creativity and bright new possibilities.',save:'SAVE CARD',share:'SHARE',designAgain:'DESIGN AGAIN',close:'Close',classic:'Classic',wide:'Wide',sport:'Sport',openEditor:'OPEN DRAW EDITOR',apply:'APPLY',placeholder:'Type text…',plain:'Plain',moon:'Moon',stars:'Stars',rabbit:'Rabbit',geo:'Geometric',saved:'Card image saved.',shareUnsupported:'Sharing files is not supported in this browser.',portraitOnly:'Please rotate your phone back to portrait mode.'},
  'zh-TW':{langShort:'繁',eyebrow:'中秋 AR 互動體驗',heroTitle:'設計你的月光織帶頭帶',heroSubtitle:'設計 · 試戴 · 分享',start:'開始 AR',privacy:'相機僅用於裝置上的即時預覽，不會自動上傳。',cameraTitle:'相機預覽',cameraFallback:'相機預覽會顯示在這裡。',cameraDenied:'相機權限目前被封鎖，請在瀏覽器設定中允許相機後再試一次。',cameraUnavailable:'目前的預覽環境無法使用相機，請部署到 HTTPS 網址後以手機測試。',retry:'再試一次',prototype:'UI 原型 · 下一階段接臉部追蹤',style:'款式',color:'顏色',pattern:'圖案',draw:'繪圖',text:'文字',beauty:'美肌',cancel:'取消',done:'完成',drawTitle:'繪圖',drawTip:'直接在攤平的頭帶上繪製；圖案會保持獨立，之後仍可更換頭帶底色。',pen:'畫筆',eraser:'橡皮擦',clear:'清除',undo:'復原',redo:'重做',brush:'筆刷',midAutumn:'中秋佳節',greetingTitle:'中秋佳節愉快',greetingBody:'願相聚、創意與嶄新的可能，都像月光一樣明亮延伸。',save:'儲存賀卡',share:'分享',designAgain:'重新設計',close:'關閉',classic:'經典',wide:'寬版',sport:'運動',openEditor:'開啟繪圖',apply:'套用',placeholder:'輸入文字…',plain:'素面',moon:'月亮',stars:'星光',rabbit:'玉兔',geo:'幾何',saved:'賀卡圖片已儲存。',shareUnsupported:'此瀏覽器不支援直接分享檔案。',portraitOnly:'請將手機轉回直式畫面。'},
  'zh-CN':{langShort:'简',eyebrow:'中秋 AR 互动体验',heroTitle:'设计你的月光织带头带',heroSubtitle:'设计 · 试戴 · 分享',start:'开始 AR',privacy:'相机仅用于设备上的即时预览，不会自动上传。',cameraTitle:'相机预览',cameraFallback:'相机预览会显示在这里。',cameraDenied:'相机权限目前被阻止，请在浏览器设置中允许相机后再试一次。',cameraUnavailable:'目前的预览环境无法使用相机，请部署到 HTTPS 网站后用手机测试。',retry:'再试一次',prototype:'UI 原型 · 下一阶段接入人脸追踪',style:'款式',color:'颜色',pattern:'图案',draw:'绘图',text:'文字',beauty:'美颜',cancel:'取消',done:'完成',drawTitle:'绘图',drawTip:'直接在展开的头带上绘制；图案会保持独立，之后仍可更换头带底色。',pen:'画笔',eraser:'橡皮擦',clear:'清除',undo:'撤销',redo:'重做',brush:'笔刷',midAutumn:'中秋佳节',greetingTitle:'中秋佳节快乐',greetingBody:'愿相聚、创意与崭新的可能，都像月光一样明亮延伸。',save:'保存贺卡',share:'分享',designAgain:'重新设计',close:'关闭',classic:'经典',wide:'宽版',sport:'运动',openEditor:'打开绘图',apply:'应用',placeholder:'输入文字…',plain:'纯色',moon:'月亮',stars:'星光',rabbit:'玉兔',geo:'几何',saved:'贺卡图片已保存。',shareUnsupported:'此浏览器不支持直接分享文件。',portraitOnly:'请将手机转回竖屏。'},
};

let lang=localStorage.getItem('eci-lang')||(navigator.language.startsWith('zh-CN')?'zh-CN':navigator.language.startsWith('zh')?'zh-TW':'en');
let stream=null,facing='user',activeTool='style',currentStyle='classic',bandColor='#204a7a',bandPattern='none',bandTextValue='ECI';
let drawingData=null; // transparent PNG overlay only — never destroyed by style/color/pattern/text changes or language switches

const camera=document.getElementById('camera'),fallback=document.getElementById('cameraFallback'),cameraMsg=document.getElementById('cameraMsg');
const band=document.getElementById('headbandPreview'),bandText=document.getElementById('headbandText'),toolSheet=document.getElementById('toolSheet');
const bandWrap=document.querySelector('.band-wrap');
const toast=document.getElementById('toast');

/* ---------- Face tracking state (Phase 2 milestone 1) ---------- */
let faceLandmarker=null, faceLandmarkerLoading=null; // in-flight init promise, so we never double-init
let trackingRafId=null, trackingActive=false, trackingMissCount=0;
let bandNaturalWidthPx=null; // .band-wrap's un-transformed rendered width, cached once
let lastFaceLandmarks=null; // raw MediaPipe landmarks from the last successful detection — used by capture

/* ---------- Beauty (skin-smoothing) filter — masked to the tracked face-oval ---------- */
const FACE_OVAL_LOOP=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
let beautyStrength=Number(localStorage.getItem('eci-beauty') ?? 6); // 0–10, default 6 — visible without the user having to discover the slider
const beautyOverlay=document.getElementById('beautyOverlay');
// NOTE: deliberately conservative — a `filter:blur()` layered on top of this
// element used to be here for "edge feathering", but `filter` blurs the
// element's ENTIRE rendered output uniformly, not just the edge, so it was
// silently stacking with `backdrop-filter` and wiping out facial features
// (confirmed on-device). Edge softness now comes from a mask-image radial
// gradient instead, which fades alpha near the boundary without adding any
// extra blur to the interior.
function beautyBlurPxFor(strength,faceWidthPx){ return (strength/10)*faceWidthPx*0.035 }
function updateBeautyOverlay(landmarks,camRect,vw,vh,mirror){
  if(!landmarks||beautyStrength<=0){ clearBeautyOverlay(); return }
  const pts=FACE_OVAL_LOOP.map(i=>mapLandmarkToBox(landmarks[i].x,landmarks[i].y,vw,vh,camRect.width,camRect.height,mirror,'cover'));
  const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const cx=(minX+maxX)/2, cy=(minY+maxY)/2, rx=(maxX-minX)/2, ry=(maxY-minY)/2;
  const blurPx=beautyBlurPxFor(beautyStrength,maxX-minX);
  const poly=`polygon(${pts.map(p=>`${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`).join(',')})`;
  const maskGrad=`radial-gradient(ellipse ${(rx*1.02).toFixed(1)}px ${(ry*1.02).toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px, #fff 60%, transparent 100%)`;
  beautyOverlay.style.clipPath=beautyOverlay.style.webkitClipPath=poly; // hard safety boundary — never bleeds past the tracked face
  beautyOverlay.style.maskImage=beautyOverlay.style.webkitMaskImage=maskGrad; // the actual soft visible edge
  beautyOverlay.style.backdropFilter=beautyOverlay.style.webkitBackdropFilter=`blur(${blurPx.toFixed(1)}px)`;
  beautyOverlay.classList.add('active');
}
function clearBeautyOverlay(){
  beautyOverlay.classList.remove('active');
  beautyOverlay.style.backdropFilter=beautyOverlay.style.webkitBackdropFilter='none';
}

function t(k){return tr[lang][k]||tr.en[k]||k}
function showScreen(name){Object.values(screens).forEach(s=>s.classList.remove('active'));screens[name].classList.add('active')}
function toastMsg(msg){toast.textContent=msg;toast.classList.add('show');clearTimeout(toast._tm);toast._tm=setTimeout(()=>toast.classList.remove('show'),1700)}
function applyI18n(){document.documentElement.lang=lang;document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));renderTool(activeTool)}

/* ---------- Camera (getUserMedia preview only — no face tracking) ---------- */
async function startCamera(){
  if(stream) stream.getTracks().forEach(x=>x.stop());
  fallback.style.display='grid'; cameraMsg.textContent=t('cameraFallback');
  if(!navigator.mediaDevices?.getUserMedia){cameraMsg.textContent=t('cameraUnavailable');return}
  try{
    // Ask for a generous, roughly-native resolution rather than forcing a tall
    // 9:16 capture — requesting a portrait shape narrower than the sensor's
    // native aspect makes some phones (notably iPhone Safari) pre-crop/zoom
    // digitally before we even get the frame. Let CSS object-fit:cover do the
    // cropping instead, from the widest frame the camera will actually give us.
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing,width:{ideal:1280},height:{ideal:960}},audio:false});
    camera.srcObject=stream; await camera.play(); fallback.style.display='none';
    camera.style.transform=facing==='user'?'scaleX(-1)':'none';
  }catch(e){cameraMsg.textContent=(e?.name==='NotAllowedError'||e?.name==='PermissionDeniedError')?t('cameraDenied'):t('cameraUnavailable')}
  if(facing==='user' && camera.readyState>=2){ await faceLandmarkerLoading?.catch(()=>{}); if(faceLandmarker) startTrackingLoop(); } // readyState>=2 ⇒ this call's getUserMedia+play actually succeeded
}

/* ---------- Face tracking: MediaPipe Face Landmarker drives the band's
   position/scale/rotation live, replacing the static top:26% CSS placement
   while tracking; falls back to that same static placement whenever no
   face is being tracked (load failure, no face detected, back camera). ---------- */
async function loadFaceLandmarker(){
  const vision=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14');
  const {FaceLandmarker,FilesetResolver}=vision;
  const filesetResolver=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
  const opts=delegate=>({
    baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',delegate},
    runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:false,outputFacialTransformationMatrixes:false,
  });
  try{ return await FaceLandmarker.createFromOptions(filesetResolver,opts('GPU')) }
  catch(e){ return await FaceLandmarker.createFromOptions(filesetResolver,opts('CPU')) } // GPU delegate can be flaky on some Android GPUs
}

// Maps a normalized MediaPipe landmark (nx,ny in [0,1], always RAW/unmirrored
// image space — CSS mirroring never affects what MediaPipe reads) into pixel
// coordinates within a target box, given the raw video's native pixel size
// and how that video is fitted into the box ('cover' for the live preview,
// which matches .camera{object-fit:cover}; 'stretch' for the capture canvas,
// which matches captureCtx.drawImage(camera,0,0,w,h)).
function mapLandmarkToBox(nx,ny,videoW,videoH,boxW,boxH,mirror,fit){
  let px,py;
  if(fit==='cover'){
    const scale=Math.max(boxW/videoW,boxH/videoH);
    px=nx*videoW*scale-(videoW*scale-boxW)/2;
    py=ny*videoH*scale-(videoH*scale-boxH)/2;
  } else { px=nx*boxW; py=ny*boxH; }
  if(mirror) px=boxW-px; // horizontal flip only — vertical is never mirrored
  return {x:px,y:py};
}
function mapRollAngle(rawRollRad,mirror){ return mirror?-rawRollRad:rawRollRad } // flipping x negates the angle's sense

function cacheBandNaturalSize(){
  const prevTransform=bandWrap.style.transform;
  bandWrap.style.transform='translateX(-50%)'; // back to the default CSS-only state
  bandNaturalWidthPx=bandWrap.getBoundingClientRect().width;
  bandWrap.style.transform=prevTransform;
}

function applyTrackedBand(landmarks){
  if(bandNaturalWidthPx==null) cacheBandNaturalSize();
  const camRect=camera.getBoundingClientRect(), vw=camera.videoWidth, vh=camera.videoHeight, mirror=(facing==='user');
  const anchor=mapLandmarkToBox(landmarks[10].x,landmarks[10].y,vw,vh,camRect.width,camRect.height,mirror,'cover');
  const t1=mapLandmarkToBox(landmarks[127].x,landmarks[127].y,vw,vh,camRect.width,camRect.height,mirror,'cover');
  const t2=mapLandmarkToBox(landmarks[356].x,landmarks[356].y,vw,vh,camRect.width,camRect.height,mirror,'cover');
  const rollRad=mapRollAngle(Math.atan2(landmarks[356].y-landmarks[127].y,landmarks[356].x-landmarks[127].x),mirror);
  const scale=(Math.hypot(t2.x-t1.x,t2.y-t1.y)*1.45)/bandNaturalWidthPx; // 1.45 = fit factor, tune on device
  lastFaceLandmarks=landmarks;
  updateBeautyOverlay(landmarks,camRect,vw,vh,mirror);
  bandWrap.style.left='0px'; bandWrap.style.top='0px';
  bandWrap.style.transform=`translate(${anchor.x}px,${anchor.y}px) translate(-50%,-50%) rotate(${rollRad}rad) scale(${scale})`;
}
function clearTrackedBand(){
  bandWrap.style.left=''; bandWrap.style.top=''; bandWrap.style.transform=''; // original CSS placement takes back over
  lastFaceLandmarks=null;
  clearBeautyOverlay();
}
function startTrackingLoop(){
  trackingActive=true; trackingMissCount=0;
  const tick=()=>{
    if(!trackingActive) return;
    if(camera.readyState>=2){
      const result=faceLandmarker.detectForVideo(camera,performance.now());
      if(result.faceLandmarks?.length){ trackingMissCount=0; applyTrackedBand(result.faceLandmarks[0]) }
      else if(++trackingMissCount>10){ clearTrackedBand() } // ~10 missed frames → fall back to static placement
    }
    trackingRafId=camera.requestVideoFrameCallback?camera.requestVideoFrameCallback(tick):requestAnimationFrame(tick);
  };
  trackingRafId=camera.requestVideoFrameCallback?camera.requestVideoFrameCallback(tick):requestAnimationFrame(tick);
}
function stopTrackingLoop(){
  trackingActive=false;
  if(trackingRafId!=null){ camera.cancelVideoFrameCallback?camera.cancelVideoFrameCallback(trackingRafId):cancelAnimationFrame(trackingRafId); trackingRafId=null }
  clearTrackedBand();
}

document.getElementById('startBtn').onclick=async()=>{
  showScreen('studio');selectTool('style');
  if(!faceLandmarkerLoading) faceLandmarkerLoading=loadFaceLandmarker().then(fl=>faceLandmarker=fl).catch(()=>{}); // never blocks camera on failure
  await startCamera();
};
document.getElementById('retryCamera').onclick=startCamera;
document.getElementById('flipCamera').onclick=async()=>{stopTrackingLoop();facing=facing==='user'?'environment':'user';await startCamera()};
document.getElementById('backHome').onclick=()=>{showScreen('welcome'); stopTrackingLoop(); if(stream){stream.getTracks().forEach(x=>x.stop());stream=null}};
document.getElementById('resetBtn').onclick=()=>{currentStyle='classic';bandColor='#204a7a';bandPattern='none';bandTextValue='ECI';drawingData=null;resetDrawEditor();updateBand();renderTool(activeTool)};

// Keeps the highlighted dock tab and the sheet's actual content in sync —
// renderTool() alone only swaps sheet content, so callers that don't also
// touch .tab.active (e.g. re-entering Studio via Start) used to leave a
// stale tab highlighted while a different tool's sheet was showing.
function selectTool(name){
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tool===name));
  renderTool(name);
}
document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>selectTool(btn.dataset.tool));

function renderTool(tool){
  activeTool=tool;
  // Preserve horizontal scroll position of the option strip across re-renders
  // (every option tap rebuilds the sheet's HTML) so picking a color/pattern/
  // style doesn't snap the strip back to the start.
  const prevStrip=toolSheet.querySelector('.strip');
  const prevScroll=prevStrip?prevStrip.scrollLeft:0;
  if(tool==='style'){
    const items=[['classic',t('classic')],['wide',t('wide')],['sport',t('sport')]];
    toolSheet.innerHTML=`<div class="strip">${items.map(([id,label])=>`<button class="card ${id===currentStyle?'active':''}" data-style="${id}">${label}</button>`).join('')}</div>`;
    toolSheet.querySelectorAll('[data-style]').forEach(b=>b.onclick=()=>{currentStyle=b.dataset.style;updateBand();renderTool('style')});
  } else if(tool==='color'){
    const colors=['#204a7a','#111827','#ece4d7','#d38a9c','#7f9568','#a44b42','#d1a23f'];
    toolSheet.innerHTML=`<div class="strip">${colors.map(c=>`<button class="card ${c===bandColor?'active':''}" data-color="${c}"><span class="swatch" style="background:${c}"></span></button>`).join('')}</div>`;
    toolSheet.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{bandColor=b.dataset.color;updateBand();document.getElementById('drawCanvas').style.backgroundColor=bandColor;renderTool('color')});
  } else if(tool==='pattern'){
    const items=[['none',t('plain')],['moon','☾ '+t('moon')],['stars','✦ '+t('stars')],['rabbit','🐇 '+t('rabbit')],['geo','◇ '+t('geo')]];
    toolSheet.innerHTML=`<div class="strip">${items.map(([id,label])=>`<button class="card ${id===bandPattern?'active':''}" data-pattern="${id}">${label}</button>`).join('')}</div>`;
    toolSheet.querySelectorAll('[data-pattern]').forEach(b=>b.onclick=()=>{bandPattern=b.dataset.pattern;updateBand();renderTool('pattern')});
  } else if(tool==='draw'){
    toolSheet.innerHTML=`<button class="draw-launch" id="openDraw">✎ ${t('openEditor')}</button>`;
    document.getElementById('openDraw').onclick=()=>{showScreen('draw');openDrawEditor()};
  } else if(tool==='text'){
    toolSheet.innerHTML=`<div class="text-editor"><input id="txt" maxlength="24" placeholder="${t('placeholder')}" value="${escapeHtml(bandTextValue)}"><button id="applyText">${t('apply')}</button></div>`;
    const input=document.getElementById('txt');
    input.oninput=()=>{bandTextValue=input.value||'ECI';bandText.textContent=bandTextValue};
    document.getElementById('applyText').onclick=()=>{bandTextValue=input.value||'ECI';bandText.textContent=bandTextValue;input.blur()};
  } else if(tool==='beauty'){
    toolSheet.innerHTML=`<label class="range-label"><span>${t('beauty')}</span><input id="beautyRange" type="range" min="0" max="10" value="${beautyStrength}"></label>`;
    document.getElementById('beautyRange').oninput=e=>{
      beautyStrength=Number(e.target.value);
      localStorage.setItem('eci-beauty',beautyStrength);
      if(lastFaceLandmarks) updateBeautyOverlay(lastFaceLandmarks,camera.getBoundingClientRect(),camera.videoWidth,camera.videoHeight,facing==='user');
      else clearBeautyOverlay();
    };
  }
  const newStrip=toolSheet.querySelector('.strip');
  if(newStrip)newStrip.scrollLeft=prevScroll;
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}

/* ---------- Pattern art: hand-drawn tileable Mid-Autumn motifs ----------
   Each pattern is an SVG tile (drives the live CSS preview on the band) with a
   matching canvas version below (drives the exported capture/greeting card),
   so the design you pick always matches what ends up in the saved photo. */
const PATTERN_TILE={moon:48,stars:40,rabbit:64,geo:32};
function patternSvg(id){
  const G='#f6dda2';
  const svgs={
    moon:`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'>
      <mask id='cut'><rect width='48' height='48' fill='#fff'/><circle cx='20' cy='21' r='7' fill='#000'/></mask>
      <circle cx='25' cy='21' r='10' fill='${G}' mask='url(#cut)'/>
      <path d='M39 33c.6 1.4.6 1.4 2 2-1.4.6-1.4.6-2 2-.6-1.4-.6-1.4-2-2 1.4-.6 1.4-.6 2-2Z' fill='${G}' opacity='.8'/>
    </svg>`,
    stars:`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'>${[[10,9,4.5,1],[30,14,3,.7],[20,30,5.5,.9],[34,33,2.5,.6]].map(([x,y,s,o])=>
      `<path d='M${x} ${y-s} C${x+s*.18} ${y-s*.18} ${x+s*.18} ${y-s*.18} ${x+s} ${y} C${x+s*.18} ${y+s*.18} ${x+s*.18} ${y+s*.18} ${x} ${y+s} C${x-s*.18} ${y+s*.18} ${x-s*.18} ${y+s*.18} ${x-s} ${y} C${x-s*.18} ${y-s*.18} ${x-s*.18} ${y-s*.18} ${x} ${y-s} Z' fill='${G}' opacity='${o}'/>`).join('')}</svg>`,
    rabbit:`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
      <g fill='${G}' opacity='.92'>
        <ellipse cx='20' cy='16' rx='3.2' ry='9' transform='rotate(-18 20 16)'/>
        <ellipse cx='27' cy='15' rx='3.2' ry='9' transform='rotate(10 27 15)'/>
        <circle cx='23' cy='29' r='7.5'/>
        <ellipse cx='35' cy='41' rx='13' ry='10'/>
        <circle cx='47' cy='38' r='3.4'/>
      </g>
    </svg>`,
    geo:`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
      <g stroke='${G}' stroke-width='1.1' opacity='.55' fill='none'>
        <path d='M16 0 L32 16 L16 32 L0 16 Z'/>
        <path d='M16 8 L24 16 L16 24 L8 16 Z'/>
      </g>
      <circle cx='16' cy='16' r='1.3' fill='${G}' opacity='.8'/>
    </svg>`,
  };
  return svgs[id];
}
function cssPattern(id){
  if(id==='none')return 'linear-gradient(90deg,rgba(255,255,255,.05),rgba(255,255,255,.16),rgba(255,255,255,.05))';
  return `url("data:image/svg+xml,${encodeURIComponent(patternSvg(id))}")`;
}
function updateBand(){
  band.style.backgroundColor=bandColor;
  band.style.height=currentStyle==='wide'?'112px':currentStyle==='sport'?'78px':'92px';
  // border-radius stays the CSS default (999px pill) for every style — see styles.css .band
  const pattern=cssPattern(bandPattern);
  const tile=PATTERN_TILE[bandPattern]?`${PATTERN_TILE[bandPattern]}px ${PATTERN_TILE[bandPattern]}px`:'auto';
  band.style.backgroundImage=drawingData?`url(${drawingData}),${pattern}`:pattern;
  band.style.backgroundSize=drawingData?`100% 100%, ${tile}`:tile;
  bandText.textContent=bandTextValue||'ECI';
}

/* ---------- Draw editor: transparent overlay, undo/redo, survives style/color/pattern/text/language changes ---------- */
const drawCanvas=document.getElementById('drawCanvas'),ctx=drawCanvas.getContext('2d');
let drawing=false,drawMode='pen',brushColor='#f6dda2',brushSize=18,history=[],redoStack=[],draftAtOpen=null;
function resetDrawEditor(){ctx.clearRect(0,0,drawCanvas.width,drawCanvas.height);history=[];redoStack=[];drawCanvas.style.backgroundColor=bandColor}
function snapshot(){return drawCanvas.toDataURL('image/png')}
function restore(data){ctx.clearRect(0,0,drawCanvas.width,drawCanvas.height);if(!data)return;const im=new Image();im.onload=()=>ctx.drawImage(im,0,0);im.src=data}
function pushHistory(){history.push(snapshot());if(history.length>30)history.shift();redoStack=[]}
function openDrawEditor(){drawCanvas.style.backgroundColor=bandColor;restore(drawingData);history=[drawingData||snapshot()];redoStack=[];draftAtOpen=drawingData}
function pt(e){const r=drawCanvas.getBoundingClientRect();return{x:(e.clientX-r.left)*drawCanvas.width/r.width,y:(e.clientY-r.top)*drawCanvas.height/r.height}}
drawCanvas.addEventListener('pointerdown',e=>{drawing=true;drawCanvas.setPointerCapture?.(e.pointerId);const p=pt(e);ctx.beginPath();ctx.moveTo(p.x,p.y);e.preventDefault()});
drawCanvas.addEventListener('pointermove',e=>{if(!drawing)return;const p=pt(e);ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=brushSize;ctx.strokeStyle=brushColor;ctx.globalCompositeOperation=drawMode==='eraser'?'destination-out':'source-over';ctx.lineTo(p.x,p.y);ctx.stroke();e.preventDefault()});
function endStroke(){if(!drawing)return;drawing=false;ctx.closePath();ctx.globalCompositeOperation='source-over';pushHistory()}
drawCanvas.addEventListener('pointerup',endStroke);drawCanvas.addEventListener('pointercancel',endStroke);
document.querySelectorAll('[data-drawmode]').forEach(b=>b.onclick=()=>{drawMode=b.dataset.drawmode;document.querySelectorAll('[data-drawmode]').forEach(x=>x.classList.toggle('active',x===b))});
document.getElementById('brushSize').oninput=e=>brushSize=Number(e.target.value);
function renderDrawColors(){const colors=['#f6dda2','#ffffff','#111827','#d97e8e','#6ba3d8','#90a969','#e88e55'];document.getElementById('drawColors').innerHTML=colors.map(c=>`<button class="draw-color ${c===brushColor?'active':''}" style="background:${c}" data-drawcolor="${c}"></button>`).join('');document.querySelectorAll('[data-drawcolor]').forEach(b=>b.onclick=()=>{brushColor=b.dataset.drawcolor;renderDrawColors()})}
renderDrawColors();
document.getElementById('clearCanvas').onclick=()=>{pushHistory();ctx.clearRect(0,0,drawCanvas.width,drawCanvas.height);pushHistory()};
document.getElementById('undoBtn').onclick=()=>{if(history.length<=1)return;redoStack.push(history.pop());restore(history[history.length-1])};
document.getElementById('redoBtn').onclick=()=>{if(!redoStack.length)return;const d=redoStack.pop();history.push(d);restore(d)};
document.getElementById('drawCancel').onclick=()=>{drawingData=draftAtOpen;showScreen('studio');updateBand()}; // restores pre-editor state
document.getElementById('drawDone').onclick=()=>{drawingData=snapshot();showScreen('studio');updateBand();renderTool('draw')};

/* ---------- Capture: camera + band + color + pattern + drawing + text, composited together ---------- */
const captureCanvas=document.getElementById('captureCanvas'),captureImage=document.getElementById('captureImage');
const CAPTURE_W=810,CAPTURE_H=1440; // 9:16 working resolution for the AR photo layer
function sparklePath2d(c){
  c.moveTo(0,-6);c.bezierCurveTo(1.1,-1.1,1.1,-1.1,6,0);c.bezierCurveTo(1.1,1.1,1.1,1.1,0,6);
  c.bezierCurveTo(-1.1,1.1,-1.1,1.1,-6,0);c.bezierCurveTo(-1.1,-1.1,-1.1,-1.1,0,-6);c.closePath();
}
function drawMoonMotif(c,cx,cy,r){
  c.save();c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.fillStyle='#f6dda2';c.fill();
  c.globalCompositeOperation='destination-out';
  c.beginPath();c.arc(cx-r*.45,cy-r*.05,r*.75,0,Math.PI*2);c.fill();
  c.restore();
  c.save();c.translate(cx+r*1.3,cy-r*1.1);c.scale(r*.06,r*.06);c.beginPath();sparklePath2d(c);
  c.fillStyle='#f6dda2';c.globalAlpha=.8;c.fill();c.restore();
}
function drawStarsMotif(c,cx,cy,s,o){
  c.save();c.translate(cx,cy);c.scale(s/6,s/6);c.beginPath();sparklePath2d(c);
  c.fillStyle='#f6dda2';c.globalAlpha=o;c.fill();c.restore();
}
function drawRabbitMotif(c,cx,cy,scale){
  c.save();c.translate(cx,cy);c.scale(scale,scale);c.fillStyle='#f6dda2';c.globalAlpha=.92;
  const ell=(x,y,rx,ry,rot)=>{c.beginPath();c.ellipse(x,y,rx,ry,rot,0,Math.PI*2);c.fill()};
  ell(-12,-20,3.2,9,-18*Math.PI/180);
  ell(-5,-21,3.2,9,10*Math.PI/180);
  c.beginPath();c.arc(-9,-7,7.5,0,Math.PI*2);c.fill();
  ell(3,7,13,10,0);
  c.beginPath();c.arc(15,3,3.4,0,Math.PI*2);c.fill();
  c.restore();
}
function drawGeoMotif(c,cx,cy,s){
  c.save();c.translate(cx,cy);c.strokeStyle='#f6dda2';c.fillStyle='#f6dda2';c.lineWidth=1.1*(s/16);
  c.globalAlpha=.55;
  c.beginPath();c.moveTo(0,-s);c.lineTo(s,0);c.lineTo(0,s);c.lineTo(-s,0);c.closePath();c.stroke();
  c.beginPath();c.moveTo(0,-s/2);c.lineTo(s/2,0);c.lineTo(0,s/2);c.lineTo(-s/2,0);c.closePath();c.stroke();
  c.globalAlpha=.8;c.beginPath();c.arc(0,0,1.3*(s/16),0,Math.PI*2);c.fill();
  c.restore();
}
function drawPatternOnCanvas(c,x,y,w,h){
  c.save();c.beginPath();roundRect(c,x,y,w,h,h/2);c.clip(); // pill shape, matches the live .band preview
  const scale=h/54; // 54px = the classic-style live-preview band height these tiles were designed against
  if(bandPattern==='moon'){
    const tile=PATTERN_TILE.moon*scale;
    for(let yy=y+tile/2;yy<y+h+tile/2;yy+=tile)for(let xx=x+tile/2;xx<x+w+tile/2;xx+=tile)drawMoonMotif(c,xx,yy,10*scale);
  } else if(bandPattern==='stars'){
    const tile=PATTERN_TILE.stars*scale;
    const spots=[[10,9,4.5,1],[30,14,3,.7],[20,30,5.5,.9],[34,33,2.5,.6]];
    for(let ty=y-tile;ty<y+h+tile;ty+=tile)for(let tx=x-tile;tx<x+w+tile;tx+=tile)
      spots.forEach(([sx,sy,ss,so])=>drawStarsMotif(c,tx+sx*scale,ty+sy*scale,ss*scale,so));
  } else if(bandPattern==='rabbit'){
    const tile=PATTERN_TILE.rabbit*scale;
    for(let yy=y+tile/2;yy<y+h+tile/2;yy+=tile)for(let xx=x+tile/2;xx<x+w+tile/2;xx+=tile)drawRabbitMotif(c,xx,yy,scale*.85);
  } else if(bandPattern==='geo'){
    const tile=PATTERN_TILE.geo*scale;
    for(let yy=y+tile/2;yy<y+h+tile/2;yy+=tile)for(let xx=x+tile/2;xx<x+w+tile/2;xx+=tile)drawGeoMotif(c,xx,yy,16*scale);
  }
  c.restore();
}
function roundRect(c,x,y,w,h,r){if(c.roundRect){c.beginPath();c.roundRect(x,y,w,h,r)}else{c.beginPath();c.rect(x,y,w,h)}}
// Knit-rib texture for the exported photo, matching the live CSS `.band::before`
// (a repeating-linear-gradient at 100deg) so the band reads as fabric there too.
function drawRibTexture(c,x,y,w,h){
  c.save();c.beginPath();roundRect(c,x,y,w,h,h/2);c.clip();
  const scale=h/54, spacing=4.5*scale, tilt=h*Math.tan(10*Math.PI/180);
  c.strokeStyle='rgba(0,0,0,.16)';c.lineWidth=Math.max(1,2*scale);
  for(let lx=x-tilt;lx<x+w+tilt;lx+=spacing){c.beginPath();c.moveTo(lx,y);c.lineTo(lx+tilt,y+h);c.stroke()}
  c.strokeStyle='rgba(255,255,255,.07)';c.lineWidth=Math.max(1,scale);
  for(let lx=x-tilt+spacing/2;lx<x+w+tilt;lx+=spacing){c.beginPath();c.moveTo(lx,y);c.lineTo(lx+tilt,y+h);c.stroke()}
  c.restore();
}
// One-time (per capture, not per-frame) equivalent of the live beauty overlay:
// draw a blurred copy of the frame, mask it to a feather-edged face-oval, and
// composite it back over the sharp base frame already drawn on `c`.
function applyBeautyToCaptureCanvas(c,w,h){
  if(beautyStrength<=0 || !lastFaceLandmarks || facing!=='user') return; // no tracked face this session ⇒ no-op, frame stays sharp
  const vw=camera.videoWidth, vh=camera.videoHeight, mirror=true;
  const pts=FACE_OVAL_LOOP.map(i=>mapLandmarkToBox(lastFaceLandmarks[i].x,lastFaceLandmarks[i].y,vw,vh,w,h,mirror,'stretch'));
  const xs=pts.map(p=>p.x), faceW=Math.max(...xs)-Math.min(...xs);
  const blurPx=beautyBlurPxFor(beautyStrength,faceW), featherPx=Math.max(6,blurPx*0.35);
  const blurred=document.createElement('canvas'); blurred.width=w; blurred.height=h;
  const bc=blurred.getContext('2d');
  bc.save(); bc.filter=`blur(${blurPx}px)`; bc.translate(w,0); bc.scale(-1,1); bc.drawImage(camera,0,0,w,h); bc.restore();
  const mask=document.createElement('canvas'); mask.width=w; mask.height=h;
  const mc=mask.getContext('2d'); mc.filter=`blur(${featherPx}px)`;
  mc.beginPath(); pts.forEach((p,i)=>i===0?mc.moveTo(p.x,p.y):mc.lineTo(p.x,p.y)); mc.closePath();
  mc.fillStyle='#fff'; mc.fill();
  bc.globalCompositeOperation='destination-in'; bc.drawImage(mask,0,0);
  c.drawImage(blurred,0,0);
}
document.getElementById('captureBtn').onclick=()=>{
  const w=CAPTURE_W,h=CAPTURE_H;captureCanvas.width=w;captureCanvas.height=h;const c=captureCanvas.getContext('2d');
  if(camera.readyState>=2){c.save();if(facing==='user'){c.translate(w,0);c.scale(-1,1)}c.drawImage(camera,0,0,w,h);c.restore()}
  else{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#31425f');g.addColorStop(1,'#101724');c.fillStyle=g;c.fillRect(0,0,w,h)}
  applyBeautyToCaptureCanvas(c,w,h);
  c.fillStyle='rgba(4,12,28,.12)';c.fillRect(0,0,w,h);

  let bx,by,bw,bh,rollRad=0;
  if(lastFaceLandmarks && facing==='user'){ // re-map the last tracked detection into the capture canvas's own (stretch-fit) space
    const vw=camera.videoWidth, vh=camera.videoHeight, mirror=true;
    const anchor=mapLandmarkToBox(lastFaceLandmarks[10].x,lastFaceLandmarks[10].y,vw,vh,w,h,mirror,'stretch');
    const t1=mapLandmarkToBox(lastFaceLandmarks[127].x,lastFaceLandmarks[127].y,vw,vh,w,h,mirror,'stretch');
    const t2=mapLandmarkToBox(lastFaceLandmarks[356].x,lastFaceLandmarks[356].y,vw,vh,w,h,mirror,'stretch');
    rollRad=mapRollAngle(Math.atan2(lastFaceLandmarks[356].y-lastFaceLandmarks[127].y,lastFaceLandmarks[356].x-lastFaceLandmarks[127].x),mirror);
    bw=Math.hypot(t2.x-t1.x,t2.y-t1.y)*1.45;
    bh=currentStyle==='wide'?h*0.133:currentStyle==='sport'?h*0.088:h*0.11;
    bx=anchor.x-bw/2; by=anchor.y-bh/2;
  } else { // fallback: no face was ever tracked this session — today's exact fixed box, unchanged
    bw=w*0.7; bx=(w-bw)/2;
    bh=currentStyle==='wide'?h*0.133:currentStyle==='sport'?h*0.088:h*0.11; by=h*0.30;
  }

  c.save(); c.translate(bx+bw/2,by+bh/2); c.rotate(rollRad); c.translate(-(bx+bw/2),-(by+bh/2));
  c.fillStyle=bandColor;c.strokeStyle='#e7b54e';c.lineWidth=5;roundRect(c,bx,by,bw,bh,bh/2);c.fill();c.stroke();drawPatternOnCanvas(c,bx,by,bw,bh);drawRibTexture(c,bx,by,bw,bh);
  const finish=()=>{
    c.fillStyle='#fff0bd';c.font=`700 ${Math.round(bh*0.42)}px Arial`;c.textAlign='center';
    c.fillText(bandTextValue||'ECI',bx+bw/2,by+bh/2+bh*0.15);
    c.restore();
    captureImage.src=captureCanvas.toDataURL('image/jpeg',.92);
    showScreen('capture');
  };
  if(drawingData){const im=new Image();im.onload=()=>{roundRect(c,bx,by,bw,bh,bh/2);c.clip();c.drawImage(im,bx,by,bw,bh);finish()};im.src=drawingData} else finish();
};
document.getElementById('designAgain').onclick=()=>showScreen('studio');

/* ---------- Mid-Autumn illustrations: colorful, cute — deliberately a
   different palette from the gold-on-navy band patterns. Post-capture
   screens only (on-screen review card + the exported greeting card), never
   the live AR Studio view. Same SVG+canvas pairing convention as the band
   patterns above, so preview and export always match. User-toggleable. ---------- */
const DECOR={gold:'#f2c14e',gold2:'#e7b54e',pink:'#f2a4c0',orange:'#f0955a',cream:'#fff3d6',red:'#e2564a'};
function sparklePathD(x,y,s){
  return `M${x} ${y-s} C${x+s*.18} ${y-s*.18} ${x+s*.18} ${y-s*.18} ${x+s} ${y} C${x+s*.18} ${y+s*.18} ${x+s*.18} ${y+s*.18} ${x} ${y+s} C${x-s*.18} ${y+s*.18} ${x-s*.18} ${y+s*.18} ${x-s} ${y} C${x-s*.18} ${y-s*.18} ${x-s*.18} ${y-s*.18} ${x} ${y-s} Z`;
}
function lanternSvg(bodyColor){
  return `<g>
    <line x1='0' y1='-16' x2='0' y2='-11' stroke='#8a5a2a' stroke-width='1.5'/>
    <rect x='-7' y='-11' width='14' height='3' rx='1.5' fill='${DECOR.gold}'/>
    <ellipse cx='0' cy='-1' rx='9' ry='10' fill='${bodyColor}'/>
    <line x1='-9' y1='-1' x2='9' y2='-1' stroke='rgba(255,255,255,.35)'/>
    <line x1='-6.5' y1='-7' x2='-6.5' y2='5' stroke='rgba(0,0,0,.15)'/>
    <line x1='6.5' y1='-7' x2='6.5' y2='5' stroke='rgba(0,0,0,.15)'/>
    <rect x='-7' y='8' width='14' height='3' rx='1.5' fill='${DECOR.gold}'/>
    <line x1='0' y1='11' x2='0' y2='16' stroke='${DECOR.gold}' stroke-width='1.5'/>
    <circle cx='0' cy='17.5' r='2' fill='${DECOR.gold}'/>
  </g>`;
}
function drawLanternMotif(c,cx,cy,scale,bodyColor){
  c.save();c.translate(cx,cy);c.scale(scale,scale);
  c.strokeStyle='#8a5a2a';c.lineWidth=1.5;c.beginPath();c.moveTo(0,-16);c.lineTo(0,-11);c.stroke();
  c.fillStyle=DECOR.gold;roundRect(c,-7,-11,14,3,1.5);c.fill();
  c.fillStyle=bodyColor;c.beginPath();c.ellipse(0,-1,9,10,0,0,Math.PI*2);c.fill();
  c.strokeStyle='rgba(255,255,255,.35)';c.lineWidth=1;c.beginPath();c.moveTo(-9,-1);c.lineTo(9,-1);c.stroke();
  c.strokeStyle='rgba(0,0,0,.15)';
  c.beginPath();c.moveTo(-6.5,-7);c.lineTo(-6.5,5);c.stroke();
  c.beginPath();c.moveTo(6.5,-7);c.lineTo(6.5,5);c.stroke();
  c.fillStyle=DECOR.gold;roundRect(c,-7,8,14,3,1.5);c.fill();
  c.strokeStyle=DECOR.gold;c.lineWidth=1.5;c.beginPath();c.moveTo(0,11);c.lineTo(0,16);c.stroke();
  c.fillStyle=DECOR.gold;c.beginPath();c.arc(0,17.5,2,0,Math.PI*2);c.fill();
  c.restore();
}
const CONFETTI_SPOTS=[[-8,-6,3,'gold'],[6,-9,2.2,'pink'],[-3,7,2.6,'orange'],[8,4,2,'gold2'],[0,-1,1.8,'cream']];
function confettiSvg(){
  return `<g>${CONFETTI_SPOTS.map(([x,y,s,k])=>`<path d='${sparklePathD(x,y,s)}' fill='${DECOR[k]}'/>`).join('')}</g>`;
}
function drawConfettiMotif(c,cx,cy,scale){
  c.save();c.translate(cx,cy);c.scale(scale,scale);
  CONFETTI_SPOTS.forEach(([x,y,s,k])=>{
    c.save();c.translate(x,y);c.scale(s/6,s/6);c.beginPath();sparklePath2d(c);c.fillStyle=DECOR[k];c.fill();c.restore();
  });
  c.restore();
}
function chibiRabbitSvg(){
  const {pink,cream,orange}=DECOR;
  return `<g>
    <ellipse cx='-6' cy='-16' rx='3.2' ry='10' fill='${pink}'/>
    <ellipse cx='-6' cy='-15' rx='1.6' ry='7' fill='${cream}'/>
    <ellipse cx='6' cy='-16' rx='3.2' ry='10' fill='${pink}'/>
    <ellipse cx='6' cy='-15' rx='1.6' ry='7' fill='${cream}'/>
    <circle cx='0' cy='-2' r='11' fill='${cream}'/>
    <ellipse cx='0' cy='14' rx='10' ry='8' fill='${pink}'/>
    <circle cx='-4' cy='-3' r='1.3' fill='#3a2a2a'/>
    <circle cx='4' cy='-3' r='1.3' fill='#3a2a2a'/>
    <ellipse cx='0' cy='1' rx='1.6' ry='1.1' fill='${orange}'/>
    <circle cx='-6' cy='1' r='1.6' fill='rgba(240,149,90,.35)'/>
    <circle cx='6' cy='1' r='1.6' fill='rgba(240,149,90,.35)'/>
  </g>`;
}
function drawChibiRabbitMotif(c,cx,cy,scale){
  const {pink,cream,orange}=DECOR;
  c.save();c.translate(cx,cy);c.scale(scale,scale);
  const ell=(x,y,rx,ry,fill)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill()};
  const dot=(x,y,r,fill)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=fill;c.fill()};
  ell(-6,-16,3.2,10,pink); ell(-6,-15,1.6,7,cream);
  ell(6,-16,3.2,10,pink); ell(6,-15,1.6,7,cream);
  dot(0,-2,11,cream);
  ell(0,14,10,8,pink);
  dot(-4,-3,1.3,'#3a2a2a'); dot(4,-3,1.3,'#3a2a2a');
  ell(0,1,1.6,1.1,orange);
  dot(-6,1,1.6,'rgba(240,149,90,.35)'); dot(6,1,1.6,'rgba(240,149,90,.35)');
  c.restore();
}
function decorStripSvg(w,h){
  const cy=h/2;
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}'>
    <g transform='translate(${w*0.14} ${cy})'>${lanternSvg(DECOR.red)}</g>
    <g transform='translate(${w*0.32} ${cy-6}) scale(1.1)'>${confettiSvg()}</g>
    <g transform='translate(${w*0.5} ${cy+2}) scale(1.3)'>${chibiRabbitSvg()}</g>
    <g transform='translate(${w*0.68} ${cy-6}) scale(1.1)'>${confettiSvg()}</g>
    <g transform='translate(${w*0.86} ${cy})'>${lanternSvg(DECOR.pink)}</g>
  </svg>`;
}
function initGreetingDecor(){
  const el=document.querySelector('.greeting-decor');
  if(el) el.style.backgroundImage=`url("data:image/svg+xml,${encodeURIComponent(decorStripSvg(400,64))}")`;
}
function drawGreetingDecor(c,W,H){
  const y=1815; // ~120px below the greeting body text — nudge down if EN text wrapping ever crowds it
  drawLanternMotif(c,W*0.14,y,1.3,DECOR.red);
  drawConfettiMotif(c,W*0.32,y-10,1.5);
  drawChibiRabbitMotif(c,W*0.5,y+4,1.7);
  drawConfettiMotif(c,W*0.68,y-10,1.5);
  drawLanternMotif(c,W*0.86,y,1.3,DECOR.pink);
}
let decorEnabled=(localStorage.getItem('eci-decor') ?? '1')==='1'; // default on
function applyDecorToggleUI(){
  document.querySelector('.greeting-decor')?.classList.toggle('off',!decorEnabled);
  const btn=document.getElementById('decorToggle');
  if(btn){ btn.setAttribute('aria-pressed',String(decorEnabled)); btn.style.opacity=decorEnabled?'1':'.5' }
}
document.getElementById('decorToggle').onclick=()=>{
  decorEnabled=!decorEnabled;
  localStorage.setItem('eci-decor',decorEnabled?'1':'0');
  applyDecorToggleUI();
};

/* ---------- Greeting card export: fixed 1080×1920, 9:16, includes logo + AR photo + Mid-Autumn greeting ---------- */
async function makeGreetingCardBlob(){
  const W=1080,H=1920,cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');
  let g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,'#102449');g.addColorStop(1,'#071229');c.fillStyle=g;c.fillRect(0,0,W,H);
  c.fillStyle='#e7b54e';c.beginPath();c.arc(900,150,150,0,Math.PI*2);c.fill();
  c.fillStyle='#fff0bd';c.font='700 30px "Segoe UI",Arial';c.textAlign='left';c.fillText('ECI',60,90);
  const img=new Image();img.src=captureImage.src;await new Promise(r=>{img.onload=r;img.onerror=r});
  c.save();roundRect(c,70,170,940,1150,42);c.clip();
  // cover-fit the AR photo into the rounded frame
  const ir=img.width/img.height, fr=940/1150;
  let sx=0,sy=0,sw=img.width,sh=img.height;
  if(ir>fr){sw=img.height*fr;sx=(img.width-sw)/2} else {sh=img.width/fr;sy=(img.height-sh)/2}
  c.drawImage(img,sx,sy,sw,sh,70,170,940,1150);
  c.restore();
  c.textAlign='left';
  c.fillStyle='#f2d596';c.font='700 26px "Segoe UI",Arial';c.fillText(t('midAutumn'),70,1380);
  c.fillStyle='#fff';c.font='54px Georgia';wrapText(c,t('greetingTitle'),70,1460,940,64);
  c.fillStyle='rgba(255,255,255,.72)';c.font='28px "Segoe UI",Arial';wrapText(c,t('greetingBody'),70,1620,940,40);
  if(decorEnabled) drawGreetingDecor(c,W,H);
  return await new Promise(res=>cv.toBlob(res,'image/jpeg',.94));
}
function wrapText(c,text,x,y,maxW,lineH){const words=text.split(' ');let line='',yy=y;for(const word of words){const test=line?line+' '+word:word;if(c.measureText(test).width>maxW&&line){c.fillText(line,x,yy);line=word;yy+=lineH}else line=test}if(line)c.fillText(line,x,yy)}
document.getElementById('downloadBtn').onclick=async()=>{const blob=await makeGreetingCardBlob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='ECI-Mid-Autumn-Card.jpg';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toastMsg(t('saved'))};
document.getElementById('shareBtn').onclick=async()=>{const blob=await makeGreetingCardBlob();const file=new File([blob],'ECI-Mid-Autumn-Card.jpg',{type:'image/jpeg'});try{if(navigator.canShare?.({files:[file]}))await navigator.share({title:'ECI Moonlight Headband',files:[file]});else if(navigator.share)await navigator.share({title:'ECI Moonlight Headband'});else toastMsg(t('shareUnsupported'))}catch(e){if(e?.name!=='AbortError')toastMsg(t('shareUnsupported'))}};

/* ---------- Language: never reloads, never resets headband design/screen ---------- */
const langSheet=document.getElementById('languageSheet');
document.querySelectorAll('[data-open-language]').forEach(b=>b.onclick=()=>{langSheet.classList.add('open');langSheet.setAttribute('aria-hidden','false')});
function closeLang(){langSheet.classList.remove('open');langSheet.setAttribute('aria-hidden','true')}
document.getElementById('closeLanguage').onclick=closeLang;
langSheet.addEventListener('click',e=>{if(e.target===langSheet)closeLang()});
document.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{lang=b.dataset.lang;localStorage.setItem('eci-lang',lang);applyI18n();closeLang()});

applyI18n();updateBand();resetDrawEditor();initGreetingDecor();applyDecorToggleUI();
