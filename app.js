const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
const navEl = document.querySelector('nav.tabs');
function setActiveTab(name){tabs.forEach(x=>x.classList.toggle('active',x.dataset.tab===name));panels.forEach(p=>p.classList.toggle('active',p.id==='tab-'+name))}
let isAuthed=false;
tabs.forEach(t=>t.addEventListener('click',()=>{const name=t.dataset.tab;if(!isAuthed&&name!=='login')return;setActiveTab(name)}));
const networkStatus = document.getElementById('networkStatus');
function updateNetwork(){if(networkStatus)networkStatus.textContent=navigator.onLine?'線上':'離線'}
updateNetwork();
window.addEventListener('online',updateNetwork);
window.addEventListener('offline',updateNetwork);
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js')}
window.addEventListener('online',async()=>{try{if(firestore){const fsMod=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');try{await fsMod.enableNetwork(firestore)}catch(e){}}if(auth&&isAuthed){await syncCommunitiesFromCloud();await syncAccountsFromCloud();await syncTasksFromCloud();renderCommunities();renderAccounts();renderTasks()}}catch(e){}})
window.addEventListener('offline',async()=>{try{if(firestore){const fsMod=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');try{await fsMod.disableNetwork(firestore)}catch(e){}}}catch(e){}})

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyA61bz1QAB5wX2cBvhVJ80Pc95swX_XQy8",
  authDomain: "nw-patrol-2026.firebaseapp.com",
  projectId: "nw-patrol-2026",
  storageBucket: "nw-patrol-2026.appspot.com",
  messagingSenderId: "89933701136",
  appId: "1:89933701136:web:bfd74540b4575fc2a4ea95",
  measurementId: "G-2TTZ9018CJ"
};

let firebaseApp=null, auth=null, firestore=null;
let db=null;

async function loadFirebase(){
  const appMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js');
  const authMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
  const fsMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
  let cfgStr = localStorage.getItem('firebaseConfig');
  if(!cfgStr){cfgStr = JSON.stringify(DEFAULT_FIREBASE_CONFIG); localStorage.setItem('firebaseConfig', cfgStr);} 
  const cfg = JSON.parse(cfgStr);
  firebaseApp = appMod.initializeApp(cfg);
  auth = authMod.getAuth(firebaseApp);
  try{await authMod.setPersistence(auth, authMod.browserLocalPersistence)}catch(e){}
  firestore = fsMod.initializeFirestore(firebaseApp,{experimentalForceLongPolling:true,useFetchStreams:false});
  
}
async function hashPassword(p){if(!p)return '';const enc=new TextEncoder();const buf=await crypto.subtle.digest('SHA-256',enc.encode(p));const arr=Array.from(new Uint8Array(buf));return arr.map(b=>b.toString(16).padStart(2,'0')).join('')}

async function openIDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open('nw-patrol',3);
    req.onupgradeneeded = ()=>{
      const d = req.result;
      if(!d.objectStoreNames.contains('points')){d.createObjectStore('points',{keyPath:'code'})}
      if(!d.objectStoreNames.contains('checkins')){d.createObjectStore('checkins',{keyPath:'id'})}
      if(!d.objectStoreNames.contains('photos')){d.createObjectStore('photos',{keyPath:'id'})}
      if(!d.objectStoreNames.contains('communities')){d.createObjectStore('communities',{keyPath:'code'})}
      if(!d.objectStoreNames.contains('accounts')){d.createObjectStore('accounts',{keyPath:'id'})}
      if(!d.objectStoreNames.contains('tasks')){d.createObjectStore('tasks',{keyPath:'code'})}
    };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}

function tx(store,mode){return db.transaction(store,mode).objectStore(store)}
function uuid(){return 'id-'+Math.random().toString(36).slice(2)+Date.now()}
async function fsRetry(op){let i=0;let last=null;while(i<3){try{return await op()}catch(e){last=e;i++;await new Promise(r=>setTimeout(r,500))}}return null}
function getProjectId(){try{return (firebaseApp&&firebaseApp.options&&firebaseApp.options.projectId)||DEFAULT_FIREBASE_CONFIG.projectId}catch(e){return DEFAULT_FIREBASE_CONFIG.projectId}}
function toFsValue(v){if(v===undefined||v===null)return null;const t=typeof v;if(t==='string')return {stringValue:v};if(t==='boolean')return {booleanValue:v};if(t==='number'){if(Number.isInteger(v))return {integerValue:String(v)};return {doubleValue:v}};if(Array.isArray(v)){const values=v.map(x=>toFsValue(x)).filter(x=>!!x);return {arrayValue:{values}}}if(t==='object'){const fields={};Object.keys(v).forEach(k=>{const fv=toFsValue(v[k]);if(fv)fields[k]=fv});return {mapValue:{fields}}}return {stringValue:String(v)}}
function toFsFields(obj){const fields={};Object.keys(obj||{}).forEach(k=>{const v=toFsValue(obj[k]);if(v)fields[k]=v});return fields}
async function fsRestUpsert(path,obj){const pid=getProjectId();const url=`https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/${path}`;const user=auth&&auth.currentUser;const token=user?await user.getIdToken():'';const body={fields:toFsFields(obj)};const res=await fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json',...(token?{'Authorization':`Bearer ${token}`}:{})},body:JSON.stringify(body)});return res.ok}
async function fsRestDelete(path){const pid=getProjectId();const url=`https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/${path}`;const user=auth&&auth.currentUser;const token=user?await user.getIdToken():'';const res=await fetch(url,{method:'DELETE',headers:{...(token?{'Authorization':`Bearer ${token}`}:{})}});return res.ok}

const userEmail = document.getElementById('userEmail');
const btnLogout = document.getElementById('btnLogout');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const btnLogin = document.getElementById('btnLogin');
const btnSignup = document.getElementById('btnSignup');
const loginRemember = document.getElementById('loginRemember');
const togglePassword = document.getElementById('togglePassword');
const btnGoogle = document.getElementById('btnGoogle');
const firebaseConfigJson = document.getElementById('firebaseConfigJson');
const btnSaveFirebase = document.getElementById('btnSaveFirebase');
const btnEnablePersistence = document.getElementById('btnEnablePersistence');
const btnClearLocal = document.getElementById('btnClearLocal');
const loginStatus = document.getElementById('loginStatus');

if(btnSaveFirebase){btnSaveFirebase.addEventListener('click',async()=>{if(!firebaseConfigJson.value.trim())return;localStorage.setItem('firebaseConfig',firebaseConfigJson.value.trim());await loadFirebase();firebaseConfigJson.value=localStorage.getItem('firebaseConfig')||''})}
if(btnEnablePersistence){btnEnablePersistence.addEventListener('click',async()=>{if(!firestore)return;const fsMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');try{await fsMod.enableIndexedDbPersistence(firestore)}catch(e){}})}
if(btnClearLocal){btnClearLocal.addEventListener('click',async()=>{indexedDB.deleteDatabase('nw-patrol');location.reload()})}

if(btnLogin){btnLogin.addEventListener('click',async()=>{if(!auth){await loadFirebase()}if(!auth){if(loginStatus)loginStatus.textContent='Firebase 未初始化';return}const {signInWithEmailAndPassword}=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');if(loginStatus)loginStatus.textContent='登入中';try{await signInWithEmailAndPassword(auth,loginEmail.value,loginPassword.value);if(loginStatus)loginStatus.textContent=''}catch(e){let networkFail=false;const c=e&&e.code||'';if(c==='auth/network-request-failed'||c==='auth/internal-error')networkFail=true;if(!networkFail){if(loginStatus){let msg='登入失敗';if(c==='auth/invalid-email')msg='Email 格式錯誤';else if(c==='auth/user-not-found')msg='帳號不存在';else if(c==='auth/wrong-password')msg='密碼錯誤';else if(c==='auth/too-many-requests')msg='嘗試過多，請稍後再試';else if(c==='auth/operation-not-allowed')msg='此登入方式未啟用';loginStatus.textContent=msg}return}
    const accounts= await getAll('accounts');const acc=accounts.find(x=>x.email===loginEmail.value.trim());if(!acc||!acc.localPasswordHash){if(loginStatus)loginStatus.textContent='離線登入失敗：找不到帳號或未設定密碼';return}
    const hp=await hashPassword(loginPassword.value.trim());if(hp!==acc.localPasswordHash){if(loginStatus)loginStatus.textContent='離線登入失敗：密碼錯誤';return}
    isAuthed=true;setActiveTab('home');updateNavVisibility();if(loginStatus)loginStatus.textContent='離線模式';
  }})}
if(btnSignup){btnSignup.addEventListener('click',async()=>{if(!auth)return;const {createUserWithEmailAndPassword}=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');if(loginStatus)loginStatus.textContent='註冊中';try{await createUserWithEmailAndPassword(auth,loginEmail.value,loginPassword.value);if(loginStatus)loginStatus.textContent=''}catch(e){if(loginStatus){let msg='註冊失敗';const c=e&&e.code||'';if(c==='auth/email-already-in-use')msg='Email 已被使用';else if(c==='auth/weak-password')msg='密碼強度不足';else if(c==='auth/operation-not-allowed')msg='此註冊方式未啟用';else if(c==='auth/network-request-failed')msg='網路連線失敗';loginStatus.textContent=msg}}})}
if(btnGoogle){btnGoogle.addEventListener('click',async()=>{if(!auth)return;const {GoogleAuthProvider,signInWithPopup}=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');if(loginStatus)loginStatus.textContent='Google 登入中';try{await signInWithPopup(auth,new GoogleAuthProvider());if(loginStatus)loginStatus.textContent=''}catch(e){if(loginStatus){let msg='Google 登入失敗';const c=e&&e.code||'';if(c==='auth/popup-blocked')msg='瀏覽器封鎖彈出視窗';else if(c==='auth/popup-closed-by-user')msg='已關閉登入視窗';else if(c==='auth/network-request-failed')msg='網路連線失敗';loginStatus.textContent=msg}}})}
if(btnLogout){btnLogout.addEventListener('click',async()=>{if(!auth)return;const {signOut}=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');await signOut(auth)})}

async function refreshAuthState(){if(!auth)return;const {onAuthStateChanged}=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');onAuthStateChanged(auth,async u=>{let nameText='';if(u){const items=await getAll('accounts');const acc=items.find(x=>x.id===u.uid||x.email===u.email);nameText=acc?acc.name:(u.displayName||'')}userEmail.textContent=nameText;isAuthed=!!u;btnLogout.style.display=isAuthed?'inline-block':'none';updateNavVisibility();setActiveTab(isAuthed?'home':'login');if(isAuthed){await ensureCurrentUserAccount()}if(isAuthed&&navigator.onLine){await syncCommunitiesFromCloud();await syncAccountsFromCloud();await syncTasksFromCloud();renderCommunities();renderAccounts();renderTasks()}})}

const pointName = document.getElementById('pointName');
const pointCode = document.getElementById('pointCode');
const btnAddPoint = document.getElementById('btnAddPoint');
const pointsList = document.getElementById('pointsList');

if(btnAddPoint){btnAddPoint.addEventListener('click',async()=>{
  if(!pointName||!pointCode||!pointName.value||!pointCode.value)return;
  const store = tx('points','readwrite');
  store.put({code:pointCode.value,name:pointName.value,updatedAt:Date.now()});
  renderPoints();
  pointName.value='';pointCode.value='';
})}

async function getAll(store){return new Promise(res=>{const r=tx(store,'readonly').getAll();r.onsuccess=()=>res(r.result)})}
async function renderPoints(){const items=await getAll('points');if(!pointsList){updateHome();return}pointsList.innerHTML='';items.forEach(p=>{const el=document.createElement('div');el.className='item';el.innerHTML=`<div><strong>${p.name}</strong><br><span>${p.code}</span></div><button data-code="${p.code}" class="btn outline">刪除</button>`;el.querySelector('button').addEventListener('click',()=>{tx('points','readwrite').delete(p.code);renderPoints()});pointsList.appendChild(el)});updateHome()}

let camera = document.getElementById('camera');

const btnStartScan = document.getElementById('btnStartScan');
const btnStopScan = document.getElementById('btnStopScan');
const btnStartNFC = document.getElementById('btnStartNFC');
const manualCode = document.getElementById('manualCode');
const btnUseCode = document.getElementById('btnUseCode');
const currentPointName = document.getElementById('currentPointName');
const taskNote = document.getElementById('taskNote');
const photoInput = document.getElementById('photoInput');
const btnCheckin = document.getElementById('btnCheckin');
const scanStatus = document.getElementById('scanStatus');
const btnMainQR = document.getElementById('btnMainQR');
const btnMainNFC = document.getElementById('btnMainNFC');
const modalScanQR=document.getElementById('modalScanQR');
const qrCamera=document.getElementById('qrCamera');
const scanCodeDisplay=document.getElementById('scanCodeDisplay');
const scanTimeDisplay=document.getElementById('scanTimeDisplay');
const btnScanConfirm=document.getElementById('btnScanConfirm');
const btnScanCancel=document.getElementById('btnScanCancel');
const modalPostActions=document.getElementById('modalPostActions');
const postNote=document.getElementById('postNote');
const postPhoto=document.getElementById('postPhoto');
const btnPostConfirm=document.getElementById('btnPostConfirm');
const btnPostCancel=document.getElementById('btnPostCancel');

let mediaStream=null, scanTimer=null, currentPoint=null;
let latestScanCode='';let latestScanTime=0;let latestRequirePhoto=false;let latestRequireReport=false;let latestPointName='';

async function startScan(){
  if(!('BarcodeDetector' in window))return;
  if(!camera){const v=document.createElement('video');v.id='camera';v.playsInline=true;v.style.display='none';document.body.appendChild(v);camera=v}
  mediaStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
  camera.srcObject=mediaStream;
  await camera.play();
  const detector = new window.BarcodeDetector({formats:['qr_code']});
  scanTimer = setInterval(async()=>{
    try{
      const codes = await detector.detect(camera);
      if(codes.length){const code=codes[0].rawValue;useCode(code)}
    }catch(e){}
  },500);
}
function stopScan(){if(mediaStream){mediaStream.getTracks().forEach(t=>t.stop());camera.srcObject=null}if(scanTimer){clearInterval(scanTimer);scanTimer=null}}

async function startNFC(){
  if(!('NDEFReader' in window))return;
  const reader = new NDEFReader();
  try{
    await reader.scan();
    reader.onreading = e => {
      const r = e.message.records[0];
      let text='';
      if(r.recordType==='text'){const dec=new TextDecoder(r.encoding||'utf-8');text=dec.decode(r.data)}
      useCode(text||manualCode.value||'');
    };
  }catch(err){}
}

async function useCode(code){if(!code)return;const p=(await getAll('points')).find(x=>x.code===code);currentPoint=p||{code,name:'未知點位'};if(currentPointName){currentPointName.value=currentPoint.name}if(scanStatus){scanStatus.textContent=`已識別代碼 ${code}`}}

if(btnStartScan){btnStartScan.addEventListener('click',startScan)}
if(btnStopScan){btnStopScan.addEventListener('click',stopScan)}
if(btnStartNFC){btnStartNFC.addEventListener('click',startNFC)}
if(btnUseCode){btnUseCode.addEventListener('click',()=>useCode(manualCode.value))}
if(btnMainQR){btnMainQR.addEventListener('click',openQRModal)}
if(btnMainNFC){btnMainNFC.addEventListener('click',startNFC)}
if(btnScanCancel){btnScanCancel.addEventListener('click',closeQRModal)}
if(btnScanConfirm){btnScanConfirm.addEventListener('click',afterScanConfirm)}
if(btnPostCancel){btnPostCancel.addEventListener('click',closePostModal)}
if(btnPostConfirm){btnPostConfirm.addEventListener('click',confirmPost)}

if(btnCheckin){btnCheckin.addEventListener('click',async()=>{
  const id=uuid();
  const item={id,pointCode:currentPoint?currentPoint.code:manualCode.value,pointName:currentPoint?currentPoint.name:'',note:taskNote.value||'',createdAt:Date.now(),pending:true,photoId:null};
  tx('checkins','readwrite').put(item);
  if(photoInput&&photoInput.files&&photoInput.files[0]){const phId=uuid();const fr=new FileReader();fr.onload=()=>{tx('photos','readwrite').put({id:phId,checkinId:id,blob:new Blob([fr.result])});tx('checkins','readwrite').put({...item,photoId:phId});renderHistory()};fr.readAsArrayBuffer(photoInput.files[0])}else{renderHistory()}
  currentPoint=null;if(currentPointName){currentPointName.value=''}if(taskNote){taskNote.value=''}if(photoInput){photoInput.value=''}if(scanStatus){scanStatus.textContent='已建立本機打卡'}
})}

const historyList = document.getElementById('historyList');
const btnSync = document.getElementById('btnSync');
const syncStatus = document.getElementById('syncStatus');

async function renderHistory(){const items=await getAll('checkins');if(!historyList){updateHome();return}historyList.innerHTML='';items.sort((a,b)=>b.createdAt-a.createdAt).forEach(c=>{const el=document.createElement('div');el.className='item';const d=new Date(c.createdAt);el.innerHTML=`<div><strong>${c.pointName||c.pointCode}</strong><br><span>${d.toLocaleString()} • ${c.note||''}</span></div><span>${c.pending?'待同步':'已同步'}</span>`;historyList.appendChild(el)});updateHome()}

async function syncNow(){if(!auth||!firestore||!navigator.onLine){if(syncStatus)syncStatus.textContent='無法同步';return}
  if(syncStatus)syncStatus.textContent='同步中';
  const fsMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
  const user = auth.currentUser; if(!user){syncStatus.textContent='請先登入';return}
  const pending = (await getAll('checkins')).filter(x=>x.pending);
  for(const c of pending){
    let photoData='';
    if(c.photoId){const phReq=tx('photos','readonly').get(c.photoId);await new Promise(r=>phReq.onsuccess=r);const rec=phReq.result;if(rec&&rec.blob){photoData=await compressImageBlob(rec.blob)}}
    const docRef = fsMod.doc(firestore,`orgs/default/checkins/${c.id}`);
    const ok=await fsRetry(()=>fsMod.setDoc(docRef,{userId:user.uid,pointCode:c.pointCode,pointName:c.pointName,note:c.note,createdAt:c.createdAt,photoData}));
    if(ok===null){await fsRestUpsert(`orgs/default/checkins/${c.id}`,{userId:user.uid,pointCode:c.pointCode,pointName:c.pointName,note:c.note,createdAt:c.createdAt,photoData})}
    tx('checkins','readwrite').put({...c,pending:false});
  }
  renderHistory();
  if(syncStatus)syncStatus.textContent='同步完成'
}

if(btnSync){btnSync.addEventListener('click',syncNow)}

const tabLogin=document.querySelector('[data-tab="login"]');
const tabHome=document.querySelector('[data-tab="home"]');
const tabScan=document.querySelector('[data-tab="scan"]');
const tabPoints=document.querySelector('[data-tab="points"]');
const tabHistory=document.querySelector('[data-tab="history"]');
const tabSettings=document.querySelector('[data-tab="settings"]');
function updateNavVisibility(){
  if(navEl)navEl.style.display=isAuthed?'flex':'none';
  if(tabLogin)tabLogin.style.display=isAuthed?'none':'inline-block';
  if(tabHome)tabHome.style.display=isAuthed?'inline-block':'none';
  if(tabScan)tabScan.style.display=isAuthed?'inline-block':'none';
  if(tabPoints)tabPoints.style.display=isAuthed?'inline-block':'none';
  if(tabHistory)tabHistory.style.display=isAuthed?'inline-block':'none';
  if(tabSettings)tabSettings.style.display='inline-block';
}

const goScan=document.getElementById('goScan');
const goPoints=document.getElementById('goPoints');
const goHistory=document.getElementById('goHistory');
const btnQuickSync=document.getElementById('btnQuickSync');
if(goScan)goScan.addEventListener('click',()=>setActiveTab('scan'));
if(goPoints)goPoints.addEventListener('click',()=>setActiveTab('points'));
if(goHistory)goHistory.addEventListener('click',()=>setActiveTab('history'));
if(btnQuickSync)btnQuickSync.addEventListener('click',syncNow);

const homePointsCount=document.getElementById('homePointsCount');
const homeCheckinsCount=document.getElementById('homeCheckinsCount');
const homePendingCount=document.getElementById('homePendingCount');
async function updateHome(){const pts=await getAll('points');const ch=await getAll('checkins');const pend=ch.filter(x=>x.pending).length;if(homePointsCount)homePointsCount.textContent=String(pts.length);if(homeCheckinsCount)homeCheckinsCount.textContent=String(ch.length);if(homePendingCount)homePendingCount.textContent=String(pend)}

const btnOpenCommunity=document.getElementById('btnOpenCommunity');
const modalCommunity=document.getElementById('modalCommunity');
const mCommCode=document.getElementById('mCommCode');
const mCommName=document.getElementById('mCommName');
const mCommArea=document.getElementById('mCommArea');
const btnSaveCommunity=document.getElementById('btnSaveCommunity');
const btnCancelCommunity=document.getElementById('btnCancelCommunity');
const communitiesList=document.getElementById('communitiesList');
const btnOpenAccount=document.getElementById('btnOpenAccount');
const modalAccount=document.getElementById('modalAccount');
const mAccRole=document.getElementById('mAccRole');
const mAccName=document.getElementById('mAccName');
const mAccPhone=document.getElementById('mAccPhone');
const mAccEmail=document.getElementById('mAccEmail');
const mAccPassword=document.getElementById('mAccPassword');
const btnSaveAccount=document.getElementById('btnSaveAccount');
const btnCancelAccount=document.getElementById('btnCancelAccount');
const accountsList=document.getElementById('accountsList');
const mServiceComms=document.getElementById('mServiceComms');
const mSelectAllComms=document.getElementById('mSelectAllComms');
const btnOpenTask=document.getElementById('btnOpenTask');
const modalTask=document.getElementById('modalTask');
const mTaskCommunity=document.getElementById('mTaskCommunity');
const mTaskCode=document.getElementById('mTaskCode');
const mTaskName=document.getElementById('mTaskName');
const mTaskTimeStart=document.getElementById('mTaskTimeStart');
const mTaskTimeEnd=document.getElementById('mTaskTimeEnd');
const mTaskAllWeek=document.getElementById('mTaskAllWeek');
const mTaskDays=document.getElementById('mTaskDays');
const mTaskPointCount=document.getElementById('mTaskPointCount');
const btnOpenTaskPoints=document.getElementById('btnOpenTaskPoints');
const btnSaveTask=document.getElementById('btnSaveTask');
const btnCancelTask=document.getElementById('btnCancelTask');
const tasksList=document.getElementById('tasksList');
const modalTaskPoints=document.getElementById('modalTaskPoints');
const taskPointsContainer=document.getElementById('taskPointsContainer');
const btnSaveTaskPoints=document.getElementById('btnSaveTaskPoints');
const btnCancelTaskPoints=document.getElementById('btnCancelTaskPoints');
let editingTaskPoints=[];

(async()=>{await loadFirebase();try{db=await openIDB()}catch(e){console.warn('IndexedDB 無法使用',e)}if(firebaseConfigJson){firebaseConfigJson.value=localStorage.getItem('firebaseConfig')||''}await refreshAuthState();updateNavVisibility();if(db){await renderPoints();await renderHistory();await renderTasks()}})();


async function renderCommunities(){if(!communitiesList)return;const items=await getAll('communities');communitiesList.innerHTML='';items.forEach(c=>{const el=document.createElement('div');el.className='item';el.innerHTML=`<div>${c.code}</div><div>${c.name}</div><div>${c.area}</div><div><button class=\"btn\" data-act=\"edit\" data-code=\"${c.code}\">編輯</button> <button class=\"btn outline\" data-act=\"del\" data-code=\"${c.code}\">刪除</button></div>`;el.querySelector('[data-act="edit"]').addEventListener('click',()=>openCommunityModal('edit',c));el.querySelector('[data-act="del"]').addEventListener('click',()=>{if(!confirm(`確定要刪除社區 ${c.name}？`))return;tx('communities','readwrite').delete(c.code).onsuccess=()=>{deleteCommunityCloud(c.code);renderCommunities()}});communitiesList.appendChild(el)})}

function buildServiceComms(container, selectAll){if(!container)return;container.innerHTML='';getAll('communities').then(items=>{items.forEach(c=>{const id='mcomm-'+c.code;const w=document.createElement('label');w.className='check';w.innerHTML=`<input type="checkbox" value="${c.code}" id="${id}"> <span>${c.name}</span>`;container.appendChild(w)});if(selectAll){selectAll.checked=false;selectAll.onclick=()=>{const boxes=container.querySelectorAll('input[type="checkbox"]');boxes.forEach(b=>b.checked=selectAll.checked)}}})}

async function renderAccounts(){if(!accountsList)return;const items=await getAll('accounts');accountsList.innerHTML='';items.forEach(a=>{const el=document.createElement('div');el.className='item';const svc=(a.serviceCommunities||[]).join(',');el.innerHTML=`<div>${a.role||''}</div><div>${a.name||''}</div><div>${a.phone||''}</div><div>${a.email||''}</div><div>${svc}</div><div><button class=\"btn\" data-act=\"edit\" data-id=\"${a.id}\">編輯</button> <button class=\"btn outline\" data-act=\"del\" data-id=\"${a.id}\">刪除</button></div>`;el.querySelector('[data-act="edit"]').addEventListener('click',()=>openAccountModal('edit',a));el.querySelector('[data-act="del"]').addEventListener('click',()=>{if(!confirm(`確定要刪除帳號 ${a.name}？`))return;tx('accounts','readwrite').delete(a.id).onsuccess=()=>{deleteAccountCloud(a.id);renderAccounts()}});accountsList.appendChild(el)})}

async function ensureCurrentUserAccount(){const u=auth.currentUser;if(!u)return;const items=await getAll('accounts');let ex=items.find(x=>x.id===u.uid||x.email===u.email);if(ex)return;const item={id:u.uid,role:'一般',name:u.displayName||'',phone:'',email:u.email||'',serviceCommunities:[],updatedAt:Date.now()};return new Promise(r=>{tx('accounts','readwrite').put(item).onsuccess=()=>{upsertAccountCloud(item);renderAccounts();r()}})}

function openCommunityModal(mode,data){modalCommunity.classList.remove('hidden');modalCommunity.dataset.mode=mode||'create';mCommCode.disabled=mode==='edit';mCommCode.value=data?data.code:'';mCommName.value=data?data.name:'';mCommArea.value=data?data.area:'台北';if(!mCommArea.value)mCommArea.value='台北'}
function closeCommunityModal(){modalCommunity.classList.add('hidden')}
if(btnOpenCommunity){btnOpenCommunity.addEventListener('click',()=>openCommunityModal('create'))}
if(btnCancelCommunity){btnCancelCommunity.addEventListener('click',closeCommunityModal)}
if(btnSaveCommunity){btnSaveCommunity.addEventListener('click',()=>{const code=mCommCode.value.trim();const name=mCommName.value.trim();const area=mCommArea.value.trim();if(!code||!name||!area)return;const item={code,name,area,updatedAt:Date.now()};tx('communities','readwrite').put(item).onsuccess=()=>{closeCommunityModal();upsertCommunityCloud(item);renderCommunities()}})}

function openAccountModal(mode,data){modalAccount.classList.remove('hidden');modalAccount.dataset.mode=mode||'create';modalAccount.dataset.id=data?data.id:'';mAccRole.value=data?data.role:'';mAccName.value=data?data.name:'';mAccPhone.value=data?data.phone:'';mAccEmail.value=data?data.email:'';if(mAccPassword)mAccPassword.value='';buildServiceComms(mServiceComms,mSelectAllComms);setTimeout(()=>{if(data&&data.serviceCommunities){mServiceComms.querySelectorAll('input[type="checkbox"]').forEach(b=>{b.checked=data.serviceCommunities.includes(b.value)})}},100)}
function closeAccountModal(){modalAccount.classList.add('hidden')}
if(btnOpenAccount){btnOpenAccount.addEventListener('click',()=>openAccountModal('create'))}
if(btnCancelAccount){btnCancelAccount.addEventListener('click',closeAccountModal)}
if(btnSaveAccount){btnSaveAccount.addEventListener('click',async()=>{const id=modalAccount.dataset.mode==='edit'?modalAccount.dataset.id:uuid();const selected=[];mServiceComms.querySelectorAll('input[type="checkbox"]:checked').forEach(b=>selected.push(b.value));const all=await getAll('accounts');const existing=all.find(x=>x.id===id);
  const item={id,role:mAccRole.value.trim(),name:mAccName.value.trim(),phone:mAccPhone.value.trim(),email:mAccEmail.value.trim(),serviceCommunities:selected,updatedAt:Date.now(),localPasswordHash:existing?existing.localPasswordHash:''};if(!item.role||!item.name||!item.phone||!item.email)return;try{if(auth&&auth.currentUser&&modalAccount.dataset.mode==='edit'&&id===auth.currentUser.uid&&mAccPassword&&mAccPassword.value.trim()){const {updatePassword}=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');await updatePassword(auth.currentUser,mAccPassword.value.trim())}}catch(e){}if(mAccPassword&&mAccPassword.value.trim()){item.localPasswordHash=await hashPassword(mAccPassword.value.trim())}tx('accounts','readwrite').put(item).onsuccess=()=>{closeAccountModal();upsertAccountCloud(item);renderAccounts()}})}

async function upsertCommunityCloud(c){if(!firestore||!auth||!navigator.onLine)return;const fsMod=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');const ref=fsMod.doc(firestore,`orgs/default/communities/${c.code}`);const ok=await fsRetry(()=>fsMod.setDoc(ref,c,{merge:true}));if(ok===null){await fsRestUpsert(`orgs/default/communities/${c.code}`,c)}}
async function deleteCommunityCloud(code){if(!firestore||!auth||!navigator.onLine)return;const fsMod=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');const ref=fsMod.doc(firestore,`orgs/default/communities/${code}`);const ok=await fsRetry(()=>fsMod.deleteDoc(ref));if(ok===null){await fsRestDelete(`orgs/default/communities/${code}`)}}
async function syncCommunitiesFromCloud(){if(!firestore||!auth||!navigator.onLine)return;const fsMod=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');const col=fsMod.collection(firestore,'orgs/default/communities');const snap=await fsRetry(()=>fsMod.getDocs(col));if(!snap||typeof snap.forEach!=='function')return;const store=tx('communities','readwrite');snap.forEach(d=>{store.put({...d.data()})});const locals=await getAll('communities');for(const c of locals){await upsertCommunityCloud(c)}}

async function upsertAccountCloud(a){if(!firestore||!auth||!navigator.onLine)return;const fsMod=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');const ref=fsMod.doc(firestore,`orgs/default/accounts/${a.id}`);const ok=await fsRetry(()=>fsMod.setDoc(ref,a,{merge:true}));if(ok===null){await fsRestUpsert(`orgs/default/accounts/${a.id}`,a)}}
async function deleteAccountCloud(id){if(!firestore||!auth||!navigator.onLine)return;const fsMod=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');const ref=fsMod.doc(firestore,`orgs/default/accounts/${id}`);const ok=await fsRetry(()=>fsMod.deleteDoc(ref));if(ok===null){await fsRestDelete(`orgs/default/accounts/${id}`)}}
async function syncAccountsFromCloud(){if(!firestore||!auth||!navigator.onLine)return;const fsMod=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');const col=fsMod.collection(firestore,'orgs/default/accounts');const snap=await fsRetry(()=>fsMod.getDocs(col));if(!snap||typeof snap.forEach!=='function')return;const store=tx('accounts','readwrite');snap.forEach(d=>{store.put({...d.data()})});const locals=await getAll('accounts');for(const a of locals){await upsertAccountCloud(a)}}

function openTaskModal(mode,data){modalTask.classList.remove('hidden');modalTask.dataset.mode=mode||'create';modalTask.dataset.code=data?data.code:'';mTaskName.value=data?data.name||'':'';mTaskTimeStart.value=data?data.timeStart||'':'';mTaskTimeEnd.value=data?data.timeEnd||'':'';mTaskAllWeek.checked=!!(data&&data.allWeek);buildTaskDays(data&&data.days||[]);mTaskPointCount.value=data?String(data.pointCount||1):'';btnOpenTaskPoints.textContent=`巡邏點(${mTaskPointCount.value?mTaskPointCount.value:0})`;mTaskCode.disabled=mode==='edit';buildTaskCommunities().then(()=>{if(data){mTaskCommunity.value=data.communityCode;mTaskCode.value=data.code;editingTaskPoints=data.pointsDetailed||[]}else{const first=mTaskCommunity.querySelector('option');if(first){mTaskCommunity.value=first.value;mTaskCode.value=''}editingTaskPoints=[]}if(!data){updateTaskCode()}})}
function closeTaskModal(){modalTask.classList.add('hidden')}
async function buildTaskCommunities(){mTaskCommunity.innerHTML='';const items=await getAll('communities');items.forEach(c=>{const o=document.createElement('option');o.value=c.code;o.textContent=c.name;mTaskCommunity.appendChild(o)});mTaskCommunity.onchange=()=>{if(modalTask.dataset.mode!=='edit'){updateTaskCode()}}}
async function updateTaskCode(){const code=mTaskCommunity.value;if(!code){mTaskCode.value='';return}const next=await nextTaskCode(code);mTaskCode.value=next}
async function nextTaskCode(commCode){const items=await getAll('tasks');const list=items.filter(x=>x.communityCode===commCode);let max=0;list.forEach(t=>{const m=t.code.split('-').pop();const n=parseInt(m,10);if(!isNaN(n)&&n>max)max=n});const num=String(max+1).padStart(2,'0');return `${commCode}-${num}`}
async function renderTasks(){if(!tasksList)return;const items=await getAll('tasks');tasksList.innerHTML='';items.forEach(t=>{const freq=t.allWeek?'整週':(Array.isArray(t.days)?t.days.map(d=>['週一','週二','週三','週四','週五','週六','週日'][d-1]).join(','):'');const timeStr=t.time?t.time:((t.timeStart&&t.timeEnd)?`${t.timeStart}~${t.timeEnd}`:'');const el=document.createElement('div');el.className='item';const ptsCount=(Array.isArray(t.pointsDetailed)&&t.pointsDetailed.length>0)?t.pointsDetailed.length:(t.pointCount||0);el.innerHTML=`<div>${t.communityCode}</div><div>${t.communityName||''}</div><div>${t.code}</div><div>${t.name||''}</div><div>${timeStr}</div><div>${freq}</div><div><button class=\"btn\" data-act=\"points\" data-code=\"${t.code}\">巡邏點(${ptsCount})</button></div><div><button class=\"btn\" data-act=\"edit\" data-code=\"${t.code}\">編輯</button> <button class=\"btn outline\" data-act=\"del\" data-code=\"${t.code}\">刪除</button></div>`;el.querySelector('[data-act=\"points\"]').addEventListener('click',()=>{openPointsModal(t)});el.querySelector('[data-act=\"edit\"]').addEventListener('click',()=>openTaskModal('edit',t));el.querySelector('[data-act=\"del\"]').addEventListener('click',()=>{if(!confirm(`確定要刪除任務 ${t.name||t.code}？`))return;tx('tasks','readwrite').delete(t.code).onsuccess=()=>{deleteTaskCloud(t.code);renderTasks()}});tasksList.appendChild(el)})}
if(btnOpenTask){btnOpenTask.addEventListener('click',()=>openTaskModal('create'))}
if(btnCancelTask){btnCancelTask.addEventListener('click',closeTaskModal)}
if(btnSaveTask){btnSaveTask.addEventListener('click',()=>{const mode=modalTask.dataset.mode||'create';const commCode=mTaskCommunity.value;const commName=mTaskCommunity.options[mTaskCommunity.selectedIndex]?.textContent||'';const code=mode==='edit'?(modalTask.dataset.code||mTaskCode.value):mTaskCode.value;const name=mTaskName.value.trim();const pc=parseInt(mTaskPointCount.value,10);const timeStart=mTaskTimeStart.value||'';const timeEnd=mTaskTimeEnd.value||'';const allWeek=mTaskAllWeek.checked;const days=[];mTaskDays.querySelectorAll('input[type="checkbox"]:checked').forEach(b=>days.push(parseInt(b.value,10)));if(allWeek&&days.length!==7){days.length=0;for(let i=1;i<=7;i++)days.push(i)}if(!commCode||!code||!pc||pc<1)return;if(!timeStart||!timeEnd)return;const item={code,communityCode:commCode,communityName:commName,name,pointCount:pc,timeStart,timeEnd,allWeek,days,pointsDetailed:editingTaskPoints,updatedAt:Date.now()};tx('tasks','readwrite').put(item).onsuccess=()=>{closeTaskModal();upsertTaskCloud(item);renderTasks()}})}

function buildTaskDays(selected){mTaskDays.innerHTML='';const names=['週一','週二','週三','週四','週五','週六','週日'];for(let i=1;i<=7;i++){const w=document.createElement('label');w.className='check';w.innerHTML=`<input type="checkbox" value="${i}"> <span>${names[i-1]}</span>`;const box=w.querySelector('input');box.checked=Array.isArray(selected)?selected.includes(i):false;mTaskDays.appendChild(w)}mTaskAllWeek.onchange=()=>{const boxes=mTaskDays.querySelectorAll('input[type="checkbox"]');boxes.forEach(b=>b.checked=mTaskAllWeek.checked)}
}

function openPointsModal(task){modalTaskPoints.classList.remove('hidden');modalTaskPoints.dataset.code=task.code||'';taskPointsContainer.innerHTML='';const count=task.pointCount||0;for(let i=0;i<count;i++){const def=`${task.code}-${String(i+1).padStart(3,'0')}`;const data=(task.pointsDetailed||[])[i]||{};const el=document.createElement('div');el.className='point-block';el.innerHTML=`<input class="qr" placeholder="QR/NFC code" value="${data.qrCode||def}"><input class="pcode" placeholder="巡邏點代號" value="${data.pointCode||def}"><input class="pname" placeholder="巡邏點名稱" value="${data.pointName||''}"><input class="focus" placeholder="巡邏點重點" value="${data.focus||''}"><label class="check"><input class="report" type="checkbox" ${data.requireReport?'checked':''}> <span>回報</span></label><label class="check"><input class="photo" type="checkbox" ${data.requirePhoto?'checked':''}> <span>拍照</span></label><div class="row"><button class="btn op">${data.pointName?'編輯':'儲存'}</button></div>`;const opBtn=el.querySelector('.op');const inputs=el.querySelectorAll('input');const setDisabled=(d)=>{inputs.forEach(x=>{if(x.classList.contains('report')||x.classList.contains('photo')){x.disabled=false}else{x.disabled=d}})};setDisabled(!data||!!data.pointName);opBtn.addEventListener('click',()=>{if(opBtn.textContent==='編輯'){setDisabled(false);opBtn.textContent='儲存'}else{const v={qrCode:el.querySelector('.qr').value.trim(),pointCode:el.querySelector('.pcode').value.trim(),pointName:el.querySelector('.pname').value.trim(),focus:el.querySelector('.focus').value.trim(),requireReport:el.querySelector('.report').checked,requirePhoto:el.querySelector('.photo').checked};editingTaskPoints[i]=v;setDisabled(true);opBtn.textContent='編輯'}});taskPointsContainer.appendChild(el)}}

function closePointsModal(){modalTaskPoints.classList.add('hidden')}
if(btnOpenTaskPoints){btnOpenTaskPoints.addEventListener('click',()=>{const t={code:mTaskCode.value||'',pointCount:parseInt(mTaskPointCount.value||'0',10)||0,pointsDetailed:editingTaskPoints};openPointsModal(t)})}
if(mTaskPointCount){mTaskPointCount.addEventListener('input',()=>{btnOpenTaskPoints.textContent=`巡邏點(${mTaskPointCount.value?mTaskPointCount.value:0})`})}
if(btnCancelTaskPoints){btnCancelTaskPoints.addEventListener('click',closePointsModal)}
if(btnSaveTaskPoints){btnSaveTaskPoints.addEventListener('click',()=>{const blocks=taskPointsContainer.querySelectorAll('.point-block');const code=modalTaskPoints.dataset.code||'';const built=Array.from(blocks).map((el,idx)=>({qrCode:el.querySelector('.qr').value.trim()||`${code||mTaskCode.value}-${String(idx+1).padStart(3,'0')}`,pointCode:el.querySelector('.pcode').value.trim()||`${code||mTaskCode.value}-${String(idx+1).padStart(3,'0')}`,pointName:el.querySelector('.pname').value.trim(),focus:el.querySelector('.focus').value.trim(),requireReport:el.querySelector('.report').checked,requirePhoto:el.querySelector('.photo').checked}));if(!modalTask.classList.contains('hidden')){editingTaskPoints=built}else{const r=tx('tasks','readonly').get(code);r.onsuccess=()=>{const ex=r.result;if(ex){const item={...ex,pointsDetailed:built,pointCount:built.length,updatedAt:Date.now()};tx('tasks','readwrite').put(item).onsuccess=()=>{upsertTaskCloud(item);renderTasks()}}}}closePointsModal()})}

async function upsertTaskCloud(t){if(!firestore||!auth||!navigator.onLine)return;const fsMod=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');const ref=fsMod.doc(firestore,`orgs/default/tasks/${t.code}`);const ok=await fsRetry(()=>fsMod.setDoc(ref,t,{merge:true}));if(ok===null){await fsRestUpsert(`orgs/default/tasks/${t.code}`,t)}}
async function deleteTaskCloud(code){if(!firestore||!auth||!navigator.onLine)return;const fsMod=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');const ref=fsMod.doc(firestore,`orgs/default/tasks/${code}`);const ok=await fsRetry(()=>fsMod.deleteDoc(ref));if(ok===null){await fsRestDelete(`orgs/default/tasks/${code}`)}}
async function syncTasksFromCloud(){if(!firestore||!auth||!navigator.onLine)return;const fsMod=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');const col=fsMod.collection(firestore,'orgs/default/tasks');const snap=await fsRetry(()=>fsMod.getDocs(col));if(!snap||typeof snap.forEach!=='function')return;const store=tx('tasks','readwrite');snap.forEach(d=>{store.put({...d.data()})});const locals=await getAll('tasks');for(const t of locals){await upsertTaskCloud(t)}}

if(togglePassword){togglePassword.addEventListener('click',()=>{loginPassword.type=loginPassword.type==='password'?'text':'password'})}
const savedEmail=localStorage.getItem('rememberEmail')||'';if(savedEmail){loginEmail.value=savedEmail;if(loginRemember)loginRemember.checked=true}
if(loginRemember){loginRemember.addEventListener('change',()=>{if(loginRemember.checked){localStorage.setItem('rememberEmail',loginEmail.value||'')}else{localStorage.removeItem('rememberEmail')}})}
if(btnLogin){btnLogin.addEventListener('click',()=>{if(loginRemember&&loginRemember.checked){localStorage.setItem('rememberEmail',loginEmail.value||'')}})}
async function compressImageBlob(blob){
  return new Promise(res=>{
    const url=URL.createObjectURL(blob);
    const img=new Image();
    img.onload=()=>{
      let w=img.width,h=img.height;
      const m=1024;
      if(w>m||h>m){
        const s=Math.min(m/w,m/h);
        w=Math.round(w*s);
        h=Math.round(h*s);
      }
      const c=document.createElement('canvas');
      c.width=w;
      c.height=h;
      const ctx=c.getContext('2d');
      ctx.drawImage(img,0,0,w,h);
      const data=c.toDataURL('image/jpeg',0.7);
      URL.revokeObjectURL(url);
      res(data);
    };
    img.src=url;
  });
}
function openQRModal(){if(!modalScanQR)return;modalScanQR.classList.remove('hidden');latestScanCode='';latestScanTime=0;if(scanCodeDisplay)scanCodeDisplay.value='';if(scanTimeDisplay)scanTimeDisplay.value='';startModalScan()}
function closeQRModal(){if(!modalScanQR)return;modalScanQR.classList.add('hidden');stopModalScan()}
async function startModalScan(){if(!qrCamera)return;try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});qrCamera.srcObject=s;await qrCamera.play()}catch(e){if(scanTimeDisplay)scanTimeDisplay.value='相機無法啟動';return}const det=('BarcodeDetector' in window)?new window.BarcodeDetector({formats:['qr_code']}):null;if(!det)return;scanTimer=setInterval(async()=>{try{const r=await det.detect(qrCamera);if(r.length){latestScanCode=r[0].rawValue;latestScanTime=Date.now();if(scanCodeDisplay)scanCodeDisplay.value=latestScanCode;if(scanTimeDisplay)scanTimeDisplay.value=new Date(latestScanTime).toLocaleString();stopModalScan()}}catch(e){}},500)}
function stopModalScan(){if(qrCamera&&qrCamera.srcObject){qrCamera.srcObject.getTracks().forEach(t=>t.stop());qrCamera.srcObject=null}if(scanTimer){clearInterval(scanTimer);scanTimer=null}}
async function afterScanConfirm(){if(!latestScanCode)return;const tasks=await getAll('tasks');let found=null;for(const t of tasks){if(Array.isArray(t.pointsDetailed)){for(const p of t.pointsDetailed){if(p.qrCode===latestScanCode||p.pointCode===latestScanCode){found=p;break}}}if(found)break}latestRequirePhoto=!!(found&&found.requirePhoto);latestRequireReport=!!(found&&found.requireReport);latestPointName=found?found.pointName:'';closeQRModal();openPostModal(latestRequireReport,latestRequirePhoto)}
function openPostModal(showNote,showPhoto){if(!modalPostActions)return;modalPostActions.classList.remove('hidden');if(postNote)postNote.style.display=showNote?'block':'none';if(postPhoto)postPhoto.style.display=showPhoto?'block':'none'}
function closePostModal(){if(!modalPostActions)return;modalPostActions.classList.add('hidden')}
async function confirmPost(){const id=uuid();const noteVal=postNote&&postNote.style.display!=='none'?(postNote.value||''):'';const item={id,pointCode:latestScanCode,pointName:latestPointName||'',note:noteVal,createdAt:Date.now(),pending:true,photoId:null};tx('checkins','readwrite').put(item);if(postPhoto&&postPhoto.style.display!=='none'&&postPhoto.files&&postPhoto.files[0]){const phId=uuid();const fr=new FileReader();fr.onload=()=>{tx('photos','readwrite').put({id:phId,checkinId:id,blob:new Blob([fr.result])});tx('checkins','readwrite').put({...item,photoId:phId});renderHistory()};fr.readAsArrayBuffer(postPhoto.files[0])}else{renderHistory()}closePostModal()}
