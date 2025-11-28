const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
const navEl = document.querySelector('nav.tabs');
function setActiveTab(name){tabs.forEach(x=>x.classList.toggle('active',x.dataset.tab===name));panels.forEach(p=>p.classList.toggle('active',p.id==='tab-'+name))}
let isAuthed=false;
tabs.forEach(t=>t.addEventListener('click',()=>{const name=t.dataset.tab;if((!isAuthed||!navigator.onLine)&&name!=='login')return;setActiveTab(name)}));
const networkStatus = document.getElementById('networkStatus');
function updateNetwork(){if(networkStatus)networkStatus.textContent=navigator.onLine?'線上':'離線'}
updateNetwork();
window.addEventListener('online',updateNetwork);
window.addEventListener('offline',updateNetwork);
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js')}
window.addEventListener('online',async()=>{try{if(auth&&isAuthed){renderCommunities();renderAccounts();renderTasks()}}catch(e){}})
window.addEventListener('offline',()=>{})

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyA61bz1QAB5wX2cBvhVJ80Pc95swX_XQy8",
  authDomain: "nw-patrol-2026.firebaseapp.com",
  projectId: "nw-patrol-2026",
  storageBucket: "nw-patrol-2026.appspot.com",
  messagingSenderId: "89933701136",
  appId: "1:89933701136:web:bfd74540b4575fc2a4ea95",
  measurementId: "G-2TTZ9018CJ"
};

let firebaseApp=null, auth=null;

async function loadFirebase(){
  const appMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js');
  const authMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
  let cfgStr = localStorage.getItem('firebaseConfig');
  if(!cfgStr){cfgStr = JSON.stringify(DEFAULT_FIREBASE_CONFIG); localStorage.setItem('firebaseConfig', cfgStr);} 
  const cfg = JSON.parse(cfgStr);
  firebaseApp = appMod.initializeApp(cfg);
  auth = authMod.getAuth(firebaseApp);
  try{await authMod.setPersistence(auth, authMod.browserLocalPersistence)}catch(e){}
  
}
let authModCache=null;async function getAuthMod(){if(authModCache)return authModCache;authModCache=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');return authModCache}
// 已不使用離線密碼雜湊

// IndexedDB 已完全移除
function uuid(){return 'id-'+Math.random().toString(36).slice(2)+Date.now()}
async function fsRetry(op){let i=0;let last=null;while(i<3){try{return await op()}catch(e){last=e;i++;await new Promise(r=>setTimeout(r,500))}}return null}
function getProjectId(){try{return (firebaseApp&&firebaseApp.options&&firebaseApp.options.projectId)||DEFAULT_FIREBASE_CONFIG.projectId}catch(e){return DEFAULT_FIREBASE_CONFIG.projectId}}
function toFsValue(v){if(v===undefined||v===null)return null;const t=typeof v;if(t==='string')return {stringValue:v};if(t==='boolean')return {booleanValue:v};if(t==='number'){if(Number.isInteger(v))return {integerValue:String(v)};return {doubleValue:v}};if(Array.isArray(v)){const values=v.map(x=>toFsValue(x)).filter(x=>!!x);return {arrayValue:{values}}}if(t==='object'){const fields={};Object.keys(v).forEach(k=>{const fv=toFsValue(v[k]);if(fv)fields[k]=fv});return {mapValue:{fields}}}return {stringValue:String(v)}}
function toFsFields(obj){const fields={};Object.keys(obj||{}).forEach(k=>{const v=toFsValue(obj[k]);if(v)fields[k]=v});return fields}
function fromFsValue(v){if(!v)return null;const k=Object.keys(v)[0];const val=v[k];switch(k){case 'stringValue':return val||'';case 'booleanValue':return !!val;case 'integerValue':return parseInt(val,10);case 'doubleValue':return Number(val);case 'arrayValue':{const arr=(val&&val.values)||[];return arr.map(x=>fromFsValue(x));}case 'mapValue':{const out={};const fields=(val&&val.fields)||{};Object.keys(fields).forEach(f=>{out[f]=fromFsValue(fields[f])});return out;}case 'timestampValue':return val;case 'nullValue':return null;default:return val}}
function fromFsDoc(doc){const f=(doc&&doc.fields)||{};const out={};Object.keys(f).forEach(k=>{out[k]=fromFsValue(f[k])});return out}
async function fsRestUpsert(path,obj){return await fsRetry(async()=>{const pid=getProjectId();const url=`https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/${path}`;const user=auth&&auth.currentUser;const token=user?await user.getIdToken():'';const body={fields:toFsFields(obj)};const res=await fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json',...(token?{'Authorization':`Bearer ${token}`}:{})},body:JSON.stringify(body)});if(!res.ok)throw new Error(`upsert ${res.status}`);return true})}
async function fsRestDelete(path){return await fsRetry(async()=>{const pid=getProjectId();const url=`https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/${path}`;const user=auth&&auth.currentUser;const token=user?await user.getIdToken():'';const res=await fetch(url,{method:'DELETE',headers:{...(token?{'Authorization':`Bearer ${token}`}:{})}});if(!res.ok)throw new Error(`delete ${res.status}`);return true})}
async function fsRestList(path){return await fsRetry(async()=>{const pid=getProjectId();const url=`https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/${path}`;const user=auth&&auth.currentUser;const token=user?await user.getIdToken():'';const res=await fetch(url,{headers:{...(token?{'Authorization':`Bearer ${token}`}:{})}});if(!res.ok)throw new Error(`list ${res.status}`);const json=await res.json();const docs=json.documents||[];return docs.map(fromFsDoc)})}
async function fsRestGetDoc(path){return await fsRetry(async()=>{const pid=getProjectId();const url=`https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/${path}`;const user=auth&&auth.currentUser;const token=user?await user.getIdToken():'';const res=await fetch(url,{headers:{...(token?{'Authorization':`Bearer ${token}`}:{})}});if(!res.ok)throw new Error(`get ${res.status}`);const json=await res.json();return fromFsDoc(json)})}
async function fsRestQueryCheckinsByUser(uid){return await fsRetry(async()=>{const pid=getProjectId();const parent=`projects/${pid}/databases/(default)/documents/orgs/default`;const url=`https://firestore.googleapis.com/v1/${parent}:runQuery`;const user=auth&&auth.currentUser;const token=user?await user.getIdToken():'';const body={structuredQuery:{from:[{collectionId:'checkins'}],where:{fieldFilter:{field:{fieldPath:'userId'},op:'EQUAL',value:{stringValue:uid}}},orderBy:[{field:{fieldPath:'createdAt'},direction:'DESCENDING'}]}};const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{'Authorization':`Bearer ${token}`}:{})},body:JSON.stringify(body)});if(!res.ok)throw new Error(`query ${res.status}`);const arr=await res.json();return arr.map(x=>fromFsDoc(x.document||{fields:{}})).filter(x=>x&&x.id)})}

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
if(btnEnablePersistence){btnEnablePersistence.addEventListener('click',async()=>{})}
if(btnClearLocal){btnClearLocal.addEventListener('click',async()=>{})}

if(btnLogin){btnLogin.addEventListener('click',async()=>{if(!auth){await loadFirebase()}if(!auth){if(loginStatus)loginStatus.textContent='Firebase 未初始化';return}const {signInWithEmailAndPassword}=await getAuthMod();if(loginStatus)loginStatus.textContent='登入中';try{await signInWithEmailAndPassword(auth,loginEmail.value,loginPassword.value);isAuthed=true;updateNavVisibility();setActiveTab('home');if(loginStatus)loginStatus.textContent=''}catch(e){if(loginStatus){let msg='登入失敗';const c=e&&e.code||'';if(c==='auth/invalid-email')msg='Email 格式錯誤';else if(c==='auth/user-not-found')msg='帳號不存在';else if(c==='auth/wrong-password')msg='密碼錯誤';else if(c==='auth/too-many-requests')msg='嘗試過多，請稍後再試';else if(c==='auth/network-request-failed')msg='網路連線失敗';else if(c==='auth/internal-error')msg='內部錯誤，請重試';else if(c==='auth/operation-not-allowed')msg='此登入方式未啟用';loginStatus.textContent=msg}}})}
if(btnSignup){btnSignup.addEventListener('click',async()=>{if(!auth)return;const {createUserWithEmailAndPassword}=await getAuthMod();if(loginStatus)loginStatus.textContent='註冊中';try{await createUserWithEmailAndPassword(auth,loginEmail.value,loginPassword.value);if(loginStatus)loginStatus.textContent=''}catch(e){if(loginStatus){let msg='註冊失敗';const c=e&&e.code||'';if(c==='auth/email-already-in-use')msg='Email 已被使用';else if(c==='auth/weak-password')msg='密碼強度不足';else if(c==='auth/operation-not-allowed')msg='此註冊方式未啟用';else if(c==='auth/network-request-failed')msg='網路連線失敗';loginStatus.textContent=msg}}})}
if(btnGoogle){btnGoogle.addEventListener('click',async()=>{if(!auth)return;const {GoogleAuthProvider,signInWithPopup}=await getAuthMod();if(loginStatus)loginStatus.textContent='Google 登入中';try{await signInWithPopup(auth,new GoogleAuthProvider());isAuthed=true;updateNavVisibility();setActiveTab('home');if(loginStatus)loginStatus.textContent=''}catch(e){if(loginStatus){let msg='Google 登入失敗';const c=e&&e.code||'';if(c==='auth/popup-blocked')msg='瀏覽器封鎖彈出視窗';else if(c==='auth/popup-closed-by-user')msg='已關閉登入視窗';else if(c==='auth/network-request-failed')msg='網路連線失敗';loginStatus.textContent=msg}}})}
if(btnLogout){btnLogout.addEventListener('click',async()=>{if(!auth)return;const {signOut}=await getAuthMod();await signOut(auth)})}

async function refreshAuthState(){if(!auth)return;const {onAuthStateChanged}=await getAuthMod();onAuthStateChanged(auth,u=>{isAuthed=!!u;btnLogout.style.display=isAuthed?'inline-block':'none';updateNavVisibility();setActiveTab(isAuthed&&navigator.onLine?'home':'login');if(u){userEmail.textContent=u.displayName||u.email||'';getAll('accounts').then(items=>{const acc=items.find(x=>x.id===u.uid||x.email===u.email);if(acc){userEmail.textContent=acc.name}})}if(isAuthed&&navigator.onLine){Promise.allSettled([ensureCurrentUserAccount(),(async()=>{renderCommunities()})(),(async()=>{renderAccounts()})(),(async()=>{renderTasks()})(),(async()=>{renderHistoryToolbar()})(),(async()=>{renderHomeBreakdown()})()])}})}

const pointName = document.getElementById('pointName');
const pointCode = document.getElementById('pointCode');
const btnAddPoint = document.getElementById('btnAddPoint');
const pointsList = document.getElementById('pointsList');

if(btnAddPoint){btnAddPoint.addEventListener('click',async()=>{return})}

async function getAll(store){if(!auth||!navigator.onLine)return [];let path='';if(store==='communities')path='orgs/default/communities';else if(store==='accounts')path='orgs/default/accounts';else if(store==='tasks')path='orgs/default/tasks';else if(store==='checkins')path='';else if(store==='points')path='';if(store==='checkins'){const u=auth.currentUser;return u?await fsRestQueryCheckinsByUser(u.uid):[]}if(!path){return []}return await fsRestList(path)}
async function renderPoints(){const items=await getAll('points');if(!pointsList){updateHome();return}pointsList.innerHTML='';items.forEach(p=>{const el=document.createElement('div');el.className='item';el.innerHTML=`<div><strong>${p.name}</strong><br><span>${p.code}</span></div>`;pointsList.appendChild(el)});updateHome()}

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

async function useCode(code){if(!code)return;latestScanCode=code;latestScanTime=Date.now();await afterScanConfirm()}

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
  const user=auth&&auth.currentUser; if(!user||!navigator.onLine){return}
  const base={id,pointCode:currentPoint?currentPoint.code:manualCode.value,pointName:currentPoint?currentPoint.name:'',note:taskNote.value||'',createdAt:Date.now(),userId:user.uid};
  let photoData='';
  if(photoInput&&photoInput.files&&photoInput.files[0]){
    const fr=new FileReader();
    fr.onload=async()=>{const blob=new Blob([fr.result]);photoData=await compressImageBlob(blob);await upsertCheckinCloud({...base,photoData});renderHistory()};
    fr.readAsArrayBuffer(photoInput.files[0])
  }else{
    await upsertCheckinCloud(base);renderHistory()
  }
  currentPoint=null;if(currentPointName){currentPointName.value=''}if(taskNote){taskNote.value=''}if(photoInput){photoInput.value=''}if(scanStatus){scanStatus.textContent='已送出打卡'}
})}

const historyList = document.getElementById('historyList');
const btnSync = document.getElementById('btnSync');
const syncStatus = document.getElementById('syncStatus');
const histTaskBtns=document.getElementById('histTaskBtns');
const histDate=document.getElementById('histDate');
let selectedTaskCode='';
function todayStr(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
if(histDate){histDate.value=todayStr();histDate.addEventListener('change',()=>{renderHistory()})}

async function renderHistory(){const items=await getAll('checkins');if(!historyList){updateHome();return}const ds=histDate?histDate.value:todayStr();const start=new Date(`${ds}T00:00:00`).getTime();const end=new Date(`${ds}T23:59:59`).getTime();const arr=Array.isArray(items)?items:[];let list=arr.filter(x=>x.createdAt>=start&&x.createdAt<=end);if(selectedTaskCode){const tasks=await getAll('tasks');const tarr=Array.isArray(tasks)?tasks:[];const t=tarr.find(x=>x.code===selectedTaskCode);if(t&&Array.isArray(t.pointsDetailed)&&t.pointsDetailed.length){const codes=t.pointsDetailed.map(p=>p.pointCode);list=list.filter(x=>codes.includes(x.pointCode))}else{list=[]}}historyList.innerHTML='';list.forEach(c=>{const el=document.createElement('div');el.className='item';const d=new Date(c.createdAt);el.innerHTML=`<div><strong>${c.pointName||c.pointCode}</strong><br><span>${d.toLocaleString()} • ${c.note||''}</span></div><span>已同步</span>`;historyList.appendChild(el)});updateHome()}

async function syncNow(){if(!auth||!navigator.onLine){if(syncStatus)syncStatus.textContent='無法同步';return}
  if(syncStatus)syncStatus.textContent='同步中';
  renderHistory();
  if(syncStatus)syncStatus.textContent='同步完成'
}

if(btnSync){btnSync.addEventListener('click',syncNow)}

async function renderHistoryToolbar(){if(!histTaskBtns)return;const u=auth&&auth.currentUser;if(!u)return;const acc=await fsRestGetDoc(`orgs/default/accounts/${u.uid}`);const svc=(acc&&acc.serviceCommunities)||[];const tasks=await getAll('tasks');const arr=Array.isArray(tasks)?tasks:[];const list=arr.filter(t=>svc.includes(t.communityCode));histTaskBtns.innerHTML='';list.forEach(t=>{const b=document.createElement('button');b.className='btn';b.dataset.code=t.code;b.textContent=t.name?`${t.communityCode}-${t.name}`:`${t.communityCode}-${t.code}`;b.addEventListener('click',()=>{selectedTaskCode=t.code;renderHistory();histTaskBtns.querySelectorAll('button').forEach(x=>x.classList.toggle('outline',x.dataset.code!==selectedTaskCode))});histTaskBtns.appendChild(b)});histTaskBtns.querySelectorAll('button').forEach(x=>x.classList.add('outline'))}

const tabLogin=document.querySelector('[data-tab="login"]');
const tabHome=document.querySelector('[data-tab="home"]');
const tabScan=document.querySelector('[data-tab="scan"]');
const tabPoints=document.querySelector('[data-tab="points"]');
const tabHistory=document.querySelector('[data-tab="history"]');
const tabSettings=document.querySelector('[data-tab="settings"]');
function updateNavVisibility(){
  const ready=isAuthed&&navigator.onLine;
  if(navEl)navEl.style.display=ready?'flex':'none';
  if(tabLogin)tabLogin.style.display=ready?'none':'inline-block';
  if(tabHome)tabHome.style.display=ready?'inline-block':'none';
  if(tabScan)tabScan.style.display=ready?'inline-block':'none';
  if(tabPoints)tabPoints.style.display=ready?'inline-block':'none';
  if(tabHistory)tabHistory.style.display=ready?'inline-block':'none';
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

const homeSvcCount=document.getElementById('homeSvcCount');
const homeTasksCount=document.getElementById('homeTasksCount');
const homeTodayPointsTotal=document.getElementById('homeTodayPointsTotal');
const homeTodayPointsDone=document.getElementById('homeTodayPointsDone');
const homeTodayPointsPending=document.getElementById('homeTodayPointsPending');
const homeCommMetricsList=document.getElementById('homeCommMetricsList');
const homeTaskMetricsList=document.getElementById('homeTaskMetricsList');
async function updateHome(){const u=auth&&auth.currentUser;if(!u||!navigator.onLine){if(homeSvcCount)homeSvcCount.textContent='0';if(homeTasksCount)homeTasksCount.textContent='0';if(homeTodayPointsTotal)homeTodayPointsTotal.textContent='0';if(homeTodayPointsDone)homeTodayPointsDone.textContent='0';if(homeTodayPointsPending)homeTodayPointsPending.textContent='0';return}const ds=todayStr?todayStr():new Date().toISOString().slice(0,10);const m=await getDailyMetrics(u.uid,ds);if(homeSvcCount)homeSvcCount.textContent=String(m.svcCount||0);if(homeTasksCount)homeTasksCount.textContent=String(m.taskCount||0);if(homeTodayPointsTotal)homeTodayPointsTotal.textContent=String(m.pointsTotal||0);if(homeTodayPointsDone)homeTodayPointsDone.textContent=String(m.pointsDone||0);if(homeTodayPointsPending)homeTodayPointsPending.textContent=String(m.pointsPending||0)}
async function renderHomeBreakdown(){const u=auth&&auth.currentUser;if(!u||!navigator.onLine){if(homeCommMetricsList)homeCommMetricsList.innerHTML='';if(homeTaskMetricsList)homeTaskMetricsList.innerHTML='';return}const ds=todayStr?todayStr():new Date().toISOString().slice(0,10);let comm=await fsRestQueryCommMetrics(u.uid,ds);let task=await fsRestQueryTaskMetrics(u.uid,ds);if((!Array.isArray(comm)||comm.length===0)||(!Array.isArray(task)||task.length===0)){const b=await computeDailyBreakdown(u.uid);await upsertDailyBreakdown(u.uid,b.date,b);comm=b.byCommunity;task=b.byTask}if(homeCommMetricsList){homeCommMetricsList.innerHTML='';comm.forEach(x=>{const el=document.createElement('div');el.className='item';el.innerHTML=`<div>${x.communityCode}</div><div>${x.pointsTotal||0} / ${x.pointsDone||0} / ${x.pointsPending||0}</div>`;homeCommMetricsList.appendChild(el)})}if(homeTaskMetricsList){homeTaskMetricsList.innerHTML='';task.forEach(x=>{const el=document.createElement('div');el.className='item';const name=x.name?x.name:x.taskCode;el.innerHTML=`<div>${x.communityCode}-${name}</div><div>${x.pointsTotal||0} / ${x.pointsDone||0} / ${x.pointsPending||0}</div>`;homeTaskMetricsList.appendChild(el)})}}

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

(async()=>{await loadFirebase();if(firebaseConfigJson){firebaseConfigJson.value=localStorage.getItem('firebaseConfig')||''}await refreshAuthState();updateNavVisibility();renderPoints();renderHistoryToolbar();renderHistory();renderTasks();renderHomeBreakdown()})();


async function renderCommunities(){if(!communitiesList)return;const items=await getAll('communities');communitiesList.innerHTML='';items.forEach(c=>{const el=document.createElement('div');el.className='item';el.innerHTML=`<div>${c.code}</div><div>${c.name}</div><div>${c.area}</div><div><button class=\"btn\" data-act=\"edit\" data-code=\"${c.code}\">編輯</button> <button class=\"btn outline\" data-act=\"del\" data-code=\"${c.code}\">刪除</button></div>`;el.querySelector('[data-act="edit"]').addEventListener('click',()=>openCommunityModal('edit',c));el.querySelector('[data-act="del"]').addEventListener('click',async()=>{if(!confirm(`確定要刪除社區 ${c.name}？`))return;await deleteCommunityCloud(c.code);renderCommunities()});communitiesList.appendChild(el)})}

function buildServiceComms(container, selectAll){if(!container)return;container.innerHTML='';getAll('communities').then(items=>{items.forEach(c=>{const id='mcomm-'+c.code;const w=document.createElement('label');w.className='check';w.innerHTML=`<input type="checkbox" value="${c.code}" id="${id}"> <span>${c.name}</span>`;container.appendChild(w)});if(selectAll){selectAll.checked=false;selectAll.onclick=()=>{const boxes=container.querySelectorAll('input[type="checkbox"]');boxes.forEach(b=>b.checked=selectAll.checked)}}})}

async function renderAccounts(){if(!accountsList)return;const items=await getAll('accounts');accountsList.innerHTML='';items.forEach(a=>{const el=document.createElement('div');el.className='item';const svc=(a.serviceCommunities||[]).join(',');el.innerHTML=`<div>${a.role||''}</div><div>${a.name||''}</div><div>${a.phone||''}</div><div>${a.email||''}</div><div>${svc}</div><div><button class=\"btn\" data-act=\"edit\" data-id=\"${a.id}\">編輯</button> <button class=\"btn outline\" data-act=\"del\" data-id=\"${a.id}\">刪除</button></div>`;el.querySelector('[data-act="edit"]').addEventListener('click',()=>openAccountModal('edit',a));el.querySelector('[data-act="del"]').addEventListener('click',async()=>{if(!confirm(`確定要刪除帳號 ${a.name}？`))return;await deleteAccountCloud(a.id);renderAccounts()});accountsList.appendChild(el)})}

async function ensureCurrentUserAccount(){const u=auth.currentUser;if(!u)return;const ex=await fsRestGetDoc(`orgs/default/accounts/${u.uid}`);if(ex)return;const item={id:u.uid,role:'一般',name:u.displayName||'',phone:'',email:u.email||'',serviceCommunities:[],updatedAt:Date.now()};await upsertAccountCloud(item);renderAccounts()}

function openCommunityModal(mode,data){modalCommunity.classList.remove('hidden');modalCommunity.dataset.mode=mode||'create';mCommCode.disabled=mode==='edit';mCommCode.value=data?data.code:'';mCommName.value=data?data.name:'';mCommArea.value=data?data.area:'台北';if(!mCommArea.value)mCommArea.value='台北'}
function closeCommunityModal(){modalCommunity.classList.add('hidden')}
if(btnOpenCommunity){btnOpenCommunity.addEventListener('click',()=>openCommunityModal('create'))}
if(btnCancelCommunity){btnCancelCommunity.addEventListener('click',closeCommunityModal)}
if(btnSaveCommunity){btnSaveCommunity.addEventListener('click',async()=>{const code=mCommCode.value.trim();const name=mCommName.value.trim();const area=mCommArea.value.trim();if(!code||!name||!area)return;const item={code,name,area,updatedAt:Date.now()};closeCommunityModal();await upsertCommunityCloud(item);renderCommunities()})}

function openAccountModal(mode,data){modalAccount.classList.remove('hidden');modalAccount.dataset.mode=mode||'create';modalAccount.dataset.id=data?data.id:'';mAccRole.value=data?data.role:'';mAccName.value=data?data.name:'';mAccPhone.value=data?data.phone:'';mAccEmail.value=data?data.email:'';if(mAccPassword)mAccPassword.value='';buildServiceComms(mServiceComms,mSelectAllComms);setTimeout(()=>{if(data&&data.serviceCommunities){mServiceComms.querySelectorAll('input[type="checkbox"]').forEach(b=>{b.checked=data.serviceCommunities.includes(b.value)})}},100)}
function closeAccountModal(){modalAccount.classList.add('hidden')}
if(btnOpenAccount){btnOpenAccount.addEventListener('click',()=>openAccountModal('create'))}
if(btnCancelAccount){btnCancelAccount.addEventListener('click',closeAccountModal)}
if(btnSaveAccount){btnSaveAccount.addEventListener('click',async()=>{const id=modalAccount.dataset.mode==='edit'?modalAccount.dataset.id:uuid();const selected=[];mServiceComms.querySelectorAll('input[type="checkbox"]:checked').forEach(b=>selected.push(b.value));const item={id,role:mAccRole.value.trim(),name:mAccName.value.trim(),phone:mAccPhone.value.trim(),email:mAccEmail.value.trim(),serviceCommunities:selected,updatedAt:Date.now()};if(!item.role||!item.name||!item.phone||!item.email)return;try{if(auth&&auth.currentUser&&modalAccount.dataset.mode==='edit'&&id===auth.currentUser.uid&&mAccPassword&&mAccPassword.value.trim()){const {updatePassword}=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');await updatePassword(auth.currentUser,mAccPassword.value.trim())}}catch(e){}closeAccountModal();await upsertAccountCloud(item);renderAccounts()})}

async function upsertCommunityCloud(c){if(!auth||!navigator.onLine)return;await fsRestUpsert(`orgs/default/communities/${c.code}`,c)}
async function deleteCommunityCloud(code){if(!auth||!navigator.onLine)return;await fsRestDelete(`orgs/default/communities/${code}`)}
async function syncCommunitiesFromCloud(){return}

async function upsertAccountCloud(a){if(!auth||!navigator.onLine)return;await fsRestUpsert(`orgs/default/accounts/${a.id}`,a)}
async function deleteAccountCloud(id){if(!auth||!navigator.onLine)return;await fsRestDelete(`orgs/default/accounts/${id}`)}
async function syncAccountsFromCloud(){return}

async function openTaskModal(mode,data){modalTask.classList.remove('hidden');modalTask.dataset.mode=mode||'create';modalTask.dataset.code=data?data.code:'';mTaskName.value=data?data.name||'':'';mTaskTimeStart.value=data?data.timeStart||'':'';mTaskTimeEnd.value=data?data.timeEnd||'':'';mTaskAllWeek.checked=!!(data&&data.allWeek);buildTaskDays(data&&data.days||[]);mTaskPointCount.value=data?String(data.pointCount||1):'1';btnOpenTaskPoints.textContent=`巡邏點(${mTaskPointCount.value?mTaskPointCount.value:0})`;mTaskCode.disabled=mode==='edit';if(btnSaveTask)btnSaveTask.disabled=true;await buildTaskCommunities();if(data){mTaskCommunity.value=data.communityCode;mTaskCode.value=data.code;editingTaskPoints=data.pointsDetailed||[]}else{const first=mTaskCommunity.querySelector('option');if(first){mTaskCommunity.value=first.value;mTaskCode.value=''}editingTaskPoints=[]}if(!data){await updateTaskCode()}if(btnSaveTask)btnSaveTask.disabled=false}
function closeTaskModal(){modalTask.classList.add('hidden')}
async function buildTaskCommunities(){mTaskCommunity.innerHTML='';const items=await getAll('communities');items.forEach(c=>{const o=document.createElement('option');o.value=c.code;o.textContent=c.name;mTaskCommunity.appendChild(o)});mTaskCommunity.onchange=()=>{if(modalTask.dataset.mode!=='edit'){updateTaskCode()}}}
async function updateTaskCode(){const code=mTaskCommunity.value;if(!code){mTaskCode.value='';return}const next=await nextTaskCode(code);mTaskCode.value=next}
async function nextTaskCode(commCode){const items=await getAll('tasks');const list=items.filter(x=>x.communityCode===commCode);let max=0;list.forEach(t=>{const m=t.code.split('-').pop();const n=parseInt(m,10);if(!isNaN(n)&&n>max)max=n});const num=String(max+1).padStart(2,'0');return `${commCode}-${num}`}
async function renderTasks(){if(!tasksList)return;const items=await getAll('tasks');tasksList.innerHTML='';items.forEach(t=>{const freq=t.allWeek?'整週':(Array.isArray(t.days)?t.days.map(d=>['週一','週二','週三','週四','週五','週六','週日'][d-1]).join(','):'');const timeStr=t.time?t.time:((t.timeStart&&t.timeEnd)?`${t.timeStart}~${t.timeEnd}`:'');const el=document.createElement('div');el.className='item';const ptsCount=(Array.isArray(t.pointsDetailed)&&t.pointsDetailed.length>0)?t.pointsDetailed.length:(t.pointCount||0);el.innerHTML=`<div>${t.communityCode}</div><div>${t.communityName||''}</div><div>${t.code}</div><div>${t.name||''}</div><div>${timeStr}</div><div>${freq}</div><div><button class=\"btn\" data-act=\"points\" data-code=\"${t.code}\">巡邏點(${ptsCount})</button></div><div><button class=\"btn\" data-act=\"edit\" data-code=\"${t.code}\">編輯</button> <button class=\"btn outline\" data-act=\"del\" data-code=\"${t.code}\">刪除</button></div>`;el.querySelector('[data-act=\"points\"]').addEventListener('click',()=>{openPointsModal(t)});el.querySelector('[data-act=\"edit\"]').addEventListener('click',()=>openTaskModal('edit',t));el.querySelector('[data-act=\"del\"]').addEventListener('click',()=>{if(!confirm(`確定要刪除任務 ${t.name||t.code}？`))return;tx('tasks','readwrite').delete(t.code).onsuccess=()=>{deleteTaskCloud(t.code);renderTasks()}});tasksList.appendChild(el)})}
if(btnOpenTask){btnOpenTask.addEventListener('click',()=>openTaskModal('create'))}
if(btnCancelTask){btnCancelTask.addEventListener('click',closeTaskModal)}
if(btnSaveTask){btnSaveTask.addEventListener('click',async()=>{const mode=modalTask.dataset.mode||'create';const commCode=mTaskCommunity.value;const commName=mTaskCommunity.options[mTaskCommunity.selectedIndex]?.textContent||'';const code=mode==='edit'?(modalTask.dataset.code||mTaskCode.value):mTaskCode.value;const name=mTaskName.value.trim();let pc=parseInt(mTaskPointCount.value,10);if(!pc||pc<1)pc=1;const timeStart=mTaskTimeStart.value||'';const timeEnd=mTaskTimeEnd.value||'';const allWeek=mTaskAllWeek.checked;const days=[];mTaskDays.querySelectorAll('input[type="checkbox"]:checked').forEach(b=>days.push(parseInt(b.value,10)));if(allWeek&&days.length!==7){days.length=0;for(let i=1;i<=7;i++)days.push(i)}if(!commCode||!code)return;const item={code,communityCode:commCode,communityName:commName,name,pointCount:pc,timeStart,timeEnd,allWeek,days,pointsDetailed:editingTaskPoints,updatedAt:Date.now()};closeTaskModal();await upsertTaskCloud(item);renderTasks()})}

function buildTaskDays(selected){mTaskDays.innerHTML='';const names=['週一','週二','週三','週四','週五','週六','週日'];for(let i=1;i<=7;i++){const w=document.createElement('label');w.className='check';w.innerHTML=`<input type="checkbox" value="${i}"> <span>${names[i-1]}</span>`;const box=w.querySelector('input');box.checked=Array.isArray(selected)?selected.includes(i):false;mTaskDays.appendChild(w)}mTaskAllWeek.onchange=()=>{const boxes=mTaskDays.querySelectorAll('input[type="checkbox"]');boxes.forEach(b=>b.checked=mTaskAllWeek.checked)}
}

function openPointsModal(task){modalTaskPoints.classList.remove('hidden');modalTaskPoints.dataset.code=task.code||'';taskPointsContainer.innerHTML='';const count=task.pointCount||0;for(let i=0;i<count;i++){const def=`${task.code}-${String(i+1).padStart(3,'0')}`;const data=(task.pointsDetailed||[])[i]||{};const el=document.createElement('div');el.className='point-block';el.innerHTML=`<input class="qr" placeholder="QR/NFC code" value="${data.qrCode||def}"><input class="pcode" placeholder="巡邏點代號" value="${data.pointCode||def}"><input class="pname" placeholder="巡邏點名稱" value="${data.pointName||''}"><input class="focus" placeholder="巡邏點重點" value="${data.focus||''}"><label class="check"><input class="report" type="checkbox" ${data.requireReport?'checked':''}> <span>回報</span></label><label class="check"><input class="photo" type="checkbox" ${data.requirePhoto?'checked':''}> <span>拍照</span></label><div class="row"><button class="btn op">${data.pointName?'編輯':'儲存'}</button></div>`;const opBtn=el.querySelector('.op');const inputs=el.querySelectorAll('input');const setDisabled=(d)=>{inputs.forEach(x=>{if(x.classList.contains('report')||x.classList.contains('photo')){x.disabled=false}else{x.disabled=d}})};setDisabled(!data||!!data.pointName);opBtn.addEventListener('click',()=>{if(opBtn.textContent==='編輯'){setDisabled(false);opBtn.textContent='儲存'}else{const v={qrCode:el.querySelector('.qr').value.trim(),pointCode:el.querySelector('.pcode').value.trim(),pointName:el.querySelector('.pname').value.trim(),focus:el.querySelector('.focus').value.trim(),requireReport:el.querySelector('.report').checked,requirePhoto:el.querySelector('.photo').checked};editingTaskPoints[i]=v;setDisabled(true);opBtn.textContent='編輯'}});taskPointsContainer.appendChild(el)}}

function closePointsModal(){modalTaskPoints.classList.add('hidden')}
if(btnOpenTaskPoints){btnOpenTaskPoints.addEventListener('click',()=>{const t={code:mTaskCode.value||'',pointCount:parseInt(mTaskPointCount.value||'0',10)||0,pointsDetailed:editingTaskPoints};openPointsModal(t)})}
if(mTaskPointCount){mTaskPointCount.addEventListener('input',()=>{btnOpenTaskPoints.textContent=`巡邏點(${mTaskPointCount.value?mTaskPointCount.value:0})`})}
if(btnCancelTaskPoints){btnCancelTaskPoints.addEventListener('click',closePointsModal)}
if(btnSaveTaskPoints){btnSaveTaskPoints.addEventListener('click',async()=>{const blocks=taskPointsContainer.querySelectorAll('.point-block');const code=modalTaskPoints.dataset.code||'';const built=Array.from(blocks).map((el,idx)=>({qrCode:el.querySelector('.qr').value.trim()||`${code||mTaskCode.value}-${String(idx+1).padStart(3,'0')}`,pointCode:el.querySelector('.pcode').value.trim()||`${code||mTaskCode.value}-${String(idx+1).padStart(3,'0')}`,pointName:el.querySelector('.pname').value.trim(),focus:el.querySelector('.focus').value.trim(),requireReport:el.querySelector('.report').checked,requirePhoto:el.querySelector('.photo').checked}));if(!modalTask.classList.contains('hidden')){editingTaskPoints=built}else{await upsertTaskCloud({code,pointsDetailed:built,pointCount:built.length,updatedAt:Date.now()});renderTasks()}closePointsModal()})}

async function upsertTaskCloud(t){if(!auth||!navigator.onLine)return;await fsRestUpsert(`orgs/default/tasks/${t.code}`,t)}
async function deleteTaskCloud(code){if(!auth||!navigator.onLine)return;await fsRestDelete(`orgs/default/tasks/${code}`)}
async function syncTasksFromCloud(){return}

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
async function startModalScan(){if(!qrCamera)return;try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});qrCamera.srcObject=s;await qrCamera.play()}catch(e){if(scanTimeDisplay)scanTimeDisplay.value='相機無法啟動';return}const det=('BarcodeDetector' in window)?new window.BarcodeDetector({formats:['qr_code']}):null;if(!det)return;scanTimer=setInterval(async()=>{try{const r=await det.detect(qrCamera);if(r.length){latestScanCode=r[0].rawValue;latestScanTime=Date.now();if(scanCodeDisplay)scanCodeDisplay.value=latestScanCode;if(scanTimeDisplay)scanTimeDisplay.value=new Date(latestScanTime).toLocaleString();stopModalScan();await afterScanConfirm()}}catch(e){}},500)}
function stopModalScan(){if(qrCamera&&qrCamera.srcObject){qrCamera.srcObject.getTracks().forEach(t=>t.stop());qrCamera.srcObject=null}if(scanTimer){clearInterval(scanTimer);scanTimer=null}}
async function afterScanConfirm(){if(!latestScanCode)return;const tasks=await getAll('tasks');const tarr=Array.isArray(tasks)?tasks:[];let found=null;for(const t of tarr){if(Array.isArray(t.pointsDetailed)){for(const p of t.pointsDetailed){if(p.qrCode===latestScanCode||p.pointCode===latestScanCode){found=p;break}}}if(found)break}latestRequirePhoto=!!(found&&found.requirePhoto);latestRequireReport=!!(found&&found.requireReport);latestPointName=found?found.pointName:'';const canonicalCode=(found&&found.pointCode)?found.pointCode:latestScanCode;if(latestRequirePhoto||latestRequireReport){closeQRModal();openPostModal(latestRequireReport,latestRequirePhoto)}else{const id=uuid();const user=auth&&auth.currentUser; if(!user||!navigator.onLine){return}await upsertCheckinCloud({id,pointCode:canonicalCode,pointName:latestPointName||'',note:'',createdAt:Date.now(),userId:user.uid});renderHistory();const m=await computeDailyMetrics(user.uid);await upsertDailyMetrics(user.uid,m);updateHome();if(scanStatus){scanStatus.textContent='已送出打卡'}closeQRModal()}}
async function computeDailyMetrics(uid){const acc=await fsRestGetDoc(`orgs/default/accounts/${uid}`)||{};const svc=Array.isArray(acc.serviceCommunities)?acc.serviceCommunities:[];const tasks=await getAll('tasks');const tarr=Array.isArray(tasks)?tasks:[];const tasksInSvc=tarr.filter(t=>svc.includes(t.communityCode));let expected=[];tasksInSvc.forEach(t=>{if(Array.isArray(t.pointsDetailed)&&t.pointsDetailed.length){expected.push(...t.pointsDetailed.map(p=>p.pointCode))}else{const pc=t.pointCount||0;for(let i=1;i<=pc;i++){expected.push(`${t.code}-${String(i).padStart(3,'0')}`)}}});const ds=todayStr?todayStr():new Date().toISOString().slice(0,10);const start=new Date(`${ds}T00:00:00`).getTime();const end=new Date(`${ds}T23:59:59`).getTime();const ch=await getAll('checkins');const carr=Array.isArray(ch)?ch:[];const todays=carr.filter(x=>x.createdAt>=start&&x.createdAt<=end);const expSet=new Set(expected);const doneSet=new Set();todays.forEach(c=>{if(expSet.has(c.pointCode))doneSet.add(c.pointCode)});return {svcCount:svc.length,taskCount:tasksInSvc.length,pointsTotal:expected.length,pointsDone:doneSet.size,pointsPending:Math.max(expected.length-doneSet.size,0),date:ds}}
async function upsertDailyMetrics(uid,metrics){const key=`${uid}_${metrics.date}`;await fsRestUpsert(`orgs/default/dailyMetrics/${key}`,metrics)}
async function getDailyMetrics(uid,ds){const key=`${uid}_${ds}`;try{const doc=await fsRestGetDoc(`orgs/default/dailyMetrics/${key}`);if(doc&&typeof doc.svcCount==='number')return doc}catch(e){}const m=await computeDailyMetrics(uid);await upsertDailyMetrics(uid,m);return m}
function openPostModal(showNote,showPhoto){if(!modalPostActions)return;modalPostActions.classList.remove('hidden');if(postNote)postNote.style.display=showNote?'block':'none';if(postPhoto)postPhoto.style.display=showPhoto?'block':'none'}
function closePostModal(){if(!modalPostActions)return;modalPostActions.classList.add('hidden')}
async function confirmPost(){const id=uuid();const user=auth&&auth.currentUser; if(!user||!navigator.onLine){closePostModal();return}const tasks=await getAll('tasks');const tarr=Array.isArray(tasks)?tasks:[];let found=null;for(const t of tarr){if(Array.isArray(t.pointsDetailed)){for(const p of t.pointsDetailed){if(p.qrCode===latestScanCode||p.pointCode===latestScanCode){found=p;break}}}if(found)break}const canonicalCode=(found&&found.pointCode)?found.pointCode:latestScanCode;const noteVal=postNote&&postNote.style.display!=='none'?(postNote.value||''):'';let photoData='';if(postPhoto&&postPhoto.style.display!=='none'&&postPhoto.files&&postPhoto.files[0]){const fr=new FileReader();fr.onload=async()=>{const blob=new Blob([fr.result]);photoData=await compressImageBlob(blob);await upsertCheckinCloud({id,pointCode:canonicalCode,pointName:latestPointName||'',note:noteVal,createdAt:Date.now(),userId:user.uid,photoData});renderHistory();const m=await computeDailyMetrics(user.uid);await upsertDailyMetrics(user.uid,m);updateHome();closePostModal()};fr.readAsArrayBuffer(postPhoto.files[0])}else{await upsertCheckinCloud({id,pointCode:canonicalCode,pointName:latestPointName||'',note:noteVal,createdAt:Date.now(),userId:user.uid});renderHistory();const m=await computeDailyMetrics(user.uid);await upsertDailyMetrics(user.uid,m);updateHome();closePostModal()}}
async function upsertCheckinCloud(c){if(!auth||!navigator.onLine)return;await fsRestUpsert(`orgs/default/checkins/${c.id}`,c)}
function tx(store,mode){
  return {
    delete(key){const ev={onsuccess:null};if(store==='tasks'){deleteTaskCloud(key).then(()=>{if(ev.onsuccess)ev.onsuccess()})}else{setTimeout(()=>{if(ev.onsuccess)ev.onsuccess()},0)}return ev},
    put(item){const ev={onsuccess:null};if(store==='tasks'){upsertTaskCloud(item).then(()=>{if(ev.onsuccess)ev.onsuccess()})}else{setTimeout(()=>{if(ev.onsuccess)ev.onsuccess()},0)}return ev},
    get(key){const ev={onsuccess:null,result:null};setTimeout(()=>{if(ev.onsuccess)ev.onsuccess()},0);return ev}
  }
}
async function computeDailyBreakdown(uid){const acc=await fsRestGetDoc(`orgs/default/accounts/${uid}`)||{};const svc=Array.isArray(acc.serviceCommunities)?acc.serviceCommunities:[];const tasks=await getAll('tasks');const tarr=Array.isArray(tasks)?tasks:[];const tasksInSvc=tarr.filter(t=>svc.includes(t.communityCode));let expectedByTask={};tasksInSvc.forEach(t=>{let codes=[];if(Array.isArray(t.pointsDetailed)&&t.pointsDetailed.length){codes=t.pointsDetailed.map(p=>p.pointCode)}else{const pc=t.pointCount||0;for(let i=1;i<=pc;i++){codes.push(`${t.code}-${String(i).padStart(3,'0')}`)}}expectedByTask[t.code]={codes,communityCode:t.communityCode,name:t.name||''}});const ds=todayStr?todayStr():new Date().toISOString().slice(0,10);const start=new Date(`${ds}T00:00:00`).getTime();const end=new Date(`${ds}T23:59:59`).getTime();const ch=await getAll('checkins');const carr=Array.isArray(ch)?ch:[];const todays=carr.filter(x=>x.createdAt>=start&&x.createdAt<=end);const doneCodes=new Set(todays.map(x=>x.pointCode));const byTask=[];Object.keys(expectedByTask).forEach(code=>{const info=expectedByTask[code];const total=info.codes.length;let done=0;info.codes.forEach(c=>{if(doneCodes.has(c))done++});byTask.push({uid,taskCode:code,communityCode:info.communityCode,name:info.name,pointsTotal:total,pointsDone:done,pointsPending:Math.max(total-done,0),date:ds})});const byCommunityMap={};byTask.forEach(x=>{const k=x.communityCode;if(!byCommunityMap[k])byCommunityMap[k]={uid,communityCode:k,pointsTotal:0,pointsDone:0,pointsPending:0,date:ds};byCommunityMap[k].pointsTotal+=x.pointsTotal;byCommunityMap[k].pointsDone+=x.pointsDone;byCommunityMap[k].pointsPending+=x.pointsPending});const byCommunity=Object.values(byCommunityMap);return {byCommunity,byTask,date:ds}}
async function upsertDailyBreakdown(uid,ds,data){for(const cm of data.byCommunity){const id=`${uid}_${ds}_${cm.communityCode}`;await fsRestUpsert(`orgs/default/dailyCommunityMetrics/${id}`,cm)}for(const tm of data.byTask){const id=`${uid}_${ds}_${tm.taskCode}`;await fsRestUpsert(`orgs/default/dailyTaskMetrics/${id}`,tm)}}
async function fsRestQueryCommMetrics(uid,ds){return await fsRetry(async()=>{const pid=getProjectId();const parent=`projects/${pid}/databases/(default)/documents/orgs/default`;const url=`https://firestore.googleapis.com/v1/${parent}:runQuery`;const user=auth&&auth.currentUser;const token=user?await user.getIdToken():'';const body={structuredQuery:{from:[{collectionId:'dailyCommunityMetrics'}],where:{compositeFilter:{op:'AND',filters:[{fieldFilter:{field:{fieldPath:'uid'},op:'EQUAL',value:{stringValue:uid}}},{fieldFilter:{field:{fieldPath:'date'},op:'EQUAL',value:{stringValue:ds}}}]}},orderBy:[{field:{fieldPath:'communityCode'},direction:'ASCENDING'}]}};const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{'Authorization':`Bearer ${token}`}:{})},body:JSON.stringify(body)});if(!res.ok)throw new Error(`query ${res.status}`);const arr=await res.json();return arr.map(x=>fromFsDoc(x.document||{fields:{}})).filter(x=>x&&x.communityCode)})}
async function fsRestQueryTaskMetrics(uid,ds){return await fsRetry(async()=>{const pid=getProjectId();const parent=`projects/${pid}/databases/(default)/documents/orgs/default`;const url=`https://firestore.googleapis.com/v1/${parent}:runQuery`;const user=auth&&auth.currentUser;const token=user?await user.getIdToken():'';const body={structuredQuery:{from:[{collectionId:'dailyTaskMetrics'}],where:{compositeFilter:{op:'AND',filters:[{fieldFilter:{field:{fieldPath:'uid'},op:'EQUAL',value:{stringValue:uid}}},{fieldFilter:{field:{fieldPath:'date'},op:'EQUAL',value:{stringValue:ds}}}]}},orderBy:[{field:{fieldPath:'taskCode'},direction:'ASCENDING'}]}};const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{'Authorization':`Bearer ${token}`}:{})},body:JSON.stringify(body)});if(!res.ok)throw new Error(`query ${res.status}`);const arr=await res.json();return arr.map(x=>fromFsDoc(x.document||{fields:{}})).filter(x=>x&&x.taskCode)})}
