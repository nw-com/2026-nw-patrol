const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
tabs.forEach(t=>t.addEventListener('click',()=>{tabs.forEach(x=>x.classList.remove('active'));t.classList.add('active');panels.forEach(p=>p.classList.remove('active'));document.getElementById('tab-'+t.dataset.tab).classList.add('active')}));
const networkStatus = document.getElementById('networkStatus');
function updateNetwork(){networkStatus.textContent=navigator.onLine?'線上':'離線'}
updateNetwork();
window.addEventListener('online',updateNetwork);
window.addEventListener('offline',updateNetwork);
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js')}

let firebaseApp=null, auth=null, firestore=null, storage=null;
let db=null;

async function loadFirebase(){
  const appMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js');
  const authMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
  const fsMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
  const stMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js');
  const cfgStr = localStorage.getItem('firebaseConfig');
  if(!cfgStr) return;
  const cfg = JSON.parse(cfgStr);
  firebaseApp = appMod.initializeApp(cfg);
  auth = authMod.getAuth(firebaseApp);
  firestore = fsMod.getFirestore(firebaseApp);
  storage = stMod.getStorage(firebaseApp);
  try{await fsMod.enableIndexedDbPersistence(firestore)}catch(e){}
}

async function openIDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open('nw-patrol',1);
    req.onupgradeneeded = ()=>{
      const d = req.result;
      if(!d.objectStoreNames.contains('points')){d.createObjectStore('points',{keyPath:'code'})}
      if(!d.objectStoreNames.contains('checkins')){d.createObjectStore('checkins',{keyPath:'id'})}
      if(!d.objectStoreNames.contains('photos')){d.createObjectStore('photos',{keyPath:'id'})}
    };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}

function tx(store,mode){return db.transaction(store,mode).objectStore(store)}
function uuid(){return 'id-'+Math.random().toString(36).slice(2)+Date.now()}

const userEmail = document.getElementById('userEmail');
const btnLogout = document.getElementById('btnLogout');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const btnLogin = document.getElementById('btnLogin');
const btnSignup = document.getElementById('btnSignup');
const btnGoogle = document.getElementById('btnGoogle');
const firebaseConfigJson = document.getElementById('firebaseConfigJson');
const btnSaveFirebase = document.getElementById('btnSaveFirebase');
const btnEnablePersistence = document.getElementById('btnEnablePersistence');
const btnClearLocal = document.getElementById('btnClearLocal');

btnSaveFirebase.addEventListener('click',async()=>{if(!firebaseConfigJson.value.trim())return;localStorage.setItem('firebaseConfig',firebaseConfigJson.value.trim());await loadFirebase()});
btnEnablePersistence.addEventListener('click',async()=>{if(!firestore)return;const fsMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');try{await fsMod.enableIndexedDbPersistence(firestore)}catch(e){}});
btnClearLocal.addEventListener('click',async()=>{indexedDB.deleteDatabase('nw-patrol');location.reload()});

btnLogin.addEventListener('click',async()=>{if(!auth)return;const {signInWithEmailAndPassword}=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');try{await signInWithEmailAndPassword(auth,loginEmail.value,loginPassword.value)}catch(e){}});
btnSignup.addEventListener('click',async()=>{if(!auth)return;const {createUserWithEmailAndPassword}=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');try{await createUserWithEmailAndPassword(auth,loginEmail.value,loginPassword.value)}catch(e){}});
btnGoogle.addEventListener('click',async()=>{if(!auth)return;const {GoogleAuthProvider,signInWithPopup}=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');try{await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){}});
btnLogout.addEventListener('click',async()=>{if(!auth)return;const {signOut}=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');await signOut(auth)});

async function refreshAuthState(){if(!auth)return;const {onAuthStateChanged}=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');onAuthStateChanged(auth,u=>{userEmail.textContent=u?u.email:''})}

const pointName = document.getElementById('pointName');
const pointCode = document.getElementById('pointCode');
const btnAddPoint = document.getElementById('btnAddPoint');
const pointsList = document.getElementById('pointsList');

btnAddPoint.addEventListener('click',async()=>{
  if(!pointName.value||!pointCode.value)return;
  const store = tx('points','readwrite');
  store.put({code:pointCode.value,name:pointName.value,updatedAt:Date.now()});
  renderPoints();
  pointName.value='';pointCode.value='';
});

async function getAll(store){return new Promise(res=>{const r=tx(store,'readonly').getAll();r.onsuccess=()=>res(r.result)})}
async function renderPoints(){const items=await getAll('points');pointsList.innerHTML='';items.forEach(p=>{const el=document.createElement('div');el.className='item';el.innerHTML=`<div><strong>${p.name}</strong><br><span>${p.code}</span></div><button data-code="${p.code}" class="btn outline">刪除</button>`;el.querySelector('button').addEventListener('click',()=>{tx('points','readwrite').delete(p.code);renderPoints()});pointsList.appendChild(el)})}

const camera = document.getElementById('camera');
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

let mediaStream=null, scanTimer=null, currentPoint=null;

async function startScan(){
  if(!('BarcodeDetector' in window))return;
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

async function useCode(code){if(!code)return;const p=(await getAll('points')).find(x=>x.code===code);currentPoint=p||{code,name:'未知點位'};currentPointName.value=currentPoint.name;scanStatus.textContent=`已識別代碼 ${code}`}

btnStartScan.addEventListener('click',startScan);
btnStopScan.addEventListener('click',stopScan);
btnStartNFC.addEventListener('click',startNFC);
btnUseCode.addEventListener('click',()=>useCode(manualCode.value));

btnCheckin.addEventListener('click',async()=>{
  const id=uuid();
  const item={id,pointCode:currentPoint?currentPoint.code:manualCode.value,pointName:currentPoint?currentPoint.name:'',note:taskNote.value||'',createdAt:Date.now(),pending:true,photoId:null};
  tx('checkins','readwrite').put(item);
  if(photoInput.files&&photoInput.files[0]){const phId=uuid();const fr=new FileReader();fr.onload=()=>{tx('photos','readwrite').put({id:phId,checkinId:id,blob:new Blob([fr.result])});tx('checkins','readwrite').put({...item,photoId:phId});renderHistory()};fr.readAsArrayBuffer(photoInput.files[0])}else{renderHistory()}
  currentPoint=null;currentPointName.value='';taskNote.value='';photoInput.value='';scanStatus.textContent='已建立本機打卡'
});

const historyList = document.getElementById('historyList');
const btnSync = document.getElementById('btnSync');
const syncStatus = document.getElementById('syncStatus');

async function renderHistory(){const items=await getAll('checkins');historyList.innerHTML='';items.sort((a,b)=>b.createdAt-a.createdAt).forEach(c=>{const el=document.createElement('div');el.className='item';const d=new Date(c.createdAt);el.innerHTML=`<div><strong>${c.pointName||c.pointCode}</strong><br><span>${d.toLocaleString()} • ${c.note||''}</span></div><span>${c.pending?'待同步':'已同步'}</span>`;historyList.appendChild(el)})}

async function syncNow(){if(!auth||!firestore||!storage||!navigator.onLine){syncStatus.textContent='無法同步';return}
  syncStatus.textContent='同步中';
  const fsMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
  const stMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js');
  const user = auth.currentUser; if(!user){syncStatus.textContent='請先登入';return}
  const pending = (await getAll('checkins')).filter(x=>x.pending);
  for(const c of pending){
    let photoURL='';
    if(c.photoId){const phReq=tx('photos','readonly').get(c.photoId);await new Promise(r=>phReq.onsuccess=r);const rec=phReq.result;if(rec&&rec.blob){const ref=stMod.ref(storage,`checkins/${user.uid}/${c.id}.jpg`);await stMod.uploadBytes(ref,rec.blob);photoURL=await stMod.getDownloadURL(ref)}}
    const docRef = fsMod.doc(firestore,`orgs/default/checkins/${c.id}`);
    await fsMod.setDoc(docRef,{userId:user.uid,pointCode:c.pointCode,pointName:c.pointName,note:c.note,createdAt:c.createdAt,photoURL});
    tx('checkins','readwrite').put({...c,pending:false});
  }
  renderHistory();
  syncStatus.textContent='同步完成'
}

btnSync.addEventListener('click',syncNow);

(async()=>{db=await openIDB();await loadFirebase();await refreshAuthState();await renderPoints();await renderHistory()})();
