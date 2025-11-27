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

async function openIDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open('nw-patrol',2);
    req.onupgradeneeded = ()=>{
      const d = req.result;
      if(!d.objectStoreNames.contains('points')){d.createObjectStore('points',{keyPath:'code'})}
      if(!d.objectStoreNames.contains('checkins')){d.createObjectStore('checkins',{keyPath:'id'})}
      if(!d.objectStoreNames.contains('photos')){d.createObjectStore('photos',{keyPath:'id'})}
      if(!d.objectStoreNames.contains('communities')){d.createObjectStore('communities',{keyPath:'code'})}
      if(!d.objectStoreNames.contains('accounts')){d.createObjectStore('accounts',{keyPath:'id'})}
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
const loginRemember = document.getElementById('loginRemember');
const togglePassword = document.getElementById('togglePassword');
const btnGoogle = document.getElementById('btnGoogle');
const firebaseConfigJson = document.getElementById('firebaseConfigJson');
const btnSaveFirebase = document.getElementById('btnSaveFirebase');
const btnEnablePersistence = document.getElementById('btnEnablePersistence');
const btnClearLocal = document.getElementById('btnClearLocal');

if(btnSaveFirebase){btnSaveFirebase.addEventListener('click',async()=>{if(!firebaseConfigJson.value.trim())return;localStorage.setItem('firebaseConfig',firebaseConfigJson.value.trim());await loadFirebase();firebaseConfigJson.value=localStorage.getItem('firebaseConfig')||''})}
if(btnEnablePersistence){btnEnablePersistence.addEventListener('click',async()=>{if(!firestore)return;const fsMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');try{await fsMod.enableIndexedDbPersistence(firestore)}catch(e){}})}
if(btnClearLocal){btnClearLocal.addEventListener('click',async()=>{indexedDB.deleteDatabase('nw-patrol');location.reload()})}

btnLogin.addEventListener('click',async()=>{if(!auth)return;const {signInWithEmailAndPassword}=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');try{await signInWithEmailAndPassword(auth,loginEmail.value,loginPassword.value)}catch(e){}});
if(btnSignup){btnSignup.addEventListener('click',async()=>{if(!auth)return;const {createUserWithEmailAndPassword}=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');try{await createUserWithEmailAndPassword(auth,loginEmail.value,loginPassword.value)}catch(e){}})}
if(btnGoogle){btnGoogle.addEventListener('click',async()=>{if(!auth)return;const {GoogleAuthProvider,signInWithPopup}=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');try{await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){}})}
btnLogout.addEventListener('click',async()=>{if(!auth)return;const {signOut}=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');await signOut(auth)});

async function refreshAuthState(){if(!auth)return;const {onAuthStateChanged}=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');onAuthStateChanged(auth,async u=>{let nameText='';if(u){const items=await getAll('accounts');const acc=items.find(x=>x.id===u.uid||x.email===u.email);nameText=acc?acc.name:(u.displayName||'')}userEmail.textContent=nameText;isAuthed=!!u;btnLogout.style.display=isAuthed?'inline-block':'none';updateNavVisibility();setActiveTab(isAuthed?'home':'login');if(isAuthed){await ensureCurrentUserAccount()}if(isAuthed&&navigator.onLine){await syncCommunitiesFromCloud();await syncAccountsFromCloud();renderCommunities();renderAccounts()}})}

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
async function renderPoints(){const items=await getAll('points');pointsList.innerHTML='';items.forEach(p=>{const el=document.createElement('div');el.className='item';el.innerHTML=`<div><strong>${p.name}</strong><br><span>${p.code}</span></div><button data-code="${p.code}" class="btn outline">刪除</button>`;el.querySelector('button').addEventListener('click',()=>{tx('points','readwrite').delete(p.code);renderPoints()});pointsList.appendChild(el)});updateHome()}

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

async function renderHistory(){const items=await getAll('checkins');historyList.innerHTML='';items.sort((a,b)=>b.createdAt-a.createdAt).forEach(c=>{const el=document.createElement('div');el.className='item';const d=new Date(c.createdAt);el.innerHTML=`<div><strong>${c.pointName||c.pointCode}</strong><br><span>${d.toLocaleString()} • ${c.note||''}</span></div><span>${c.pending?'待同步':'已同步'}</span>`;historyList.appendChild(el)});updateHome()}

async function syncNow(){if(!auth||!firestore||!navigator.onLine){syncStatus.textContent='無法同步';return}
  syncStatus.textContent='同步中';
  const fsMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
  const user = auth.currentUser; if(!user){syncStatus.textContent='請先登入';return}
  const pending = (await getAll('checkins')).filter(x=>x.pending);
  for(const c of pending){
    let photoData='';
    if(c.photoId){const phReq=tx('photos','readonly').get(c.photoId);await new Promise(r=>phReq.onsuccess=r);const rec=phReq.result;if(rec&&rec.blob){photoData=await compressImageBlob(rec.blob)}}
    const docRef = fsMod.doc(firestore,`orgs/default/checkins/${c.id}`);
    await fsMod.setDoc(docRef,{userId:user.uid,pointCode:c.pointCode,pointName:c.pointName,note:c.note,createdAt:c.createdAt,photoData});
    tx('checkins','readwrite').put({...c,pending:false});
  }
  renderHistory();
  syncStatus.textContent='同步完成'
}

btnSync.addEventListener('click',syncNow);

const tabLogin=document.querySelector('[data-tab="login"]');
const tabHome=document.querySelector('[data-tab="home"]');
const tabScan=document.querySelector('[data-tab="scan"]');
const tabPoints=document.querySelector('[data-tab="points"]');
const tabHistory=document.querySelector('[data-tab="history"]');
const tabSettings=document.querySelector('[data-tab="settings"]');
function updateNavVisibility(){if(navEl)navEl.style.display=isAuthed?'flex':'none';tabLogin.style.display=isAuthed?'none':'inline-block';tabHome.style.display=isAuthed?'inline-block':'none';tabScan.style.display=isAuthed?'inline-block':'none';tabPoints.style.display=isAuthed?'inline-block':'none';tabHistory.style.display=isAuthed?'inline-block':'none';tabSettings.style.display='inline-block'}

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

(async()=>{db=await openIDB();await loadFirebase();if(firebaseConfigJson){firebaseConfigJson.value=localStorage.getItem('firebaseConfig')||''}await refreshAuthState();updateNavVisibility();await renderPoints();await renderHistory();})();

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
const btnSaveAccount=document.getElementById('btnSaveAccount');
const btnCancelAccount=document.getElementById('btnCancelAccount');
const accountsList=document.getElementById('accountsList');
const mServiceComms=document.getElementById('mServiceComms');
const mSelectAllComms=document.getElementById('mSelectAllComms');

async function renderCommunities(){if(!communitiesList)return;const items=await getAll('communities');communitiesList.innerHTML='';items.forEach(c=>{const el=document.createElement('div');el.className='item';el.innerHTML=`<div>${c.code}</div><div>${c.name}</div><div>${c.area}</div><div><button class=\"btn\" data-act=\"edit\" data-code=\"${c.code}\">編輯</button> <button class=\"btn outline\" data-act=\"del\" data-code=\"${c.code}\">刪除</button></div>`;el.querySelector('[data-act="edit"]').addEventListener('click',()=>openCommunityModal('edit',c));el.querySelector('[data-act="del"]').addEventListener('click',()=>{if(!confirm(`確定要刪除社區 ${c.name}？`))return;tx('communities','readwrite').delete(c.code).onsuccess=()=>{deleteCommunityCloud(c.code);renderCommunities()}});communitiesList.appendChild(el)})}

function buildServiceComms(container, selectAll){if(!container)return;container.innerHTML='';getAll('communities').then(items=>{items.forEach(c=>{const id='mcomm-'+c.code;const w=document.createElement('label');w.className='check';w.innerHTML=`<input type="checkbox" value="${c.code}" id="${id}"> <span>${c.name}</span>`;container.appendChild(w)});if(selectAll){selectAll.checked=false;selectAll.onclick=()=>{const boxes=container.querySelectorAll('input[type="checkbox"]');boxes.forEach(b=>b.checked=selectAll.checked)}}})}

async function renderAccounts(){if(!accountsList)return;const items=await getAll('accounts');accountsList.innerHTML='';items.forEach(a=>{const el=document.createElement('div');el.className='item';const svc=(a.serviceCommunities||[]).join(',');el.innerHTML=`<div>${a.role||''}</div><div>${a.name||''}</div><div>${a.phone||''}</div><div>${a.email||''}</div><div>${svc}</div><div><button class=\"btn\" data-act=\"edit\" data-id=\"${a.id}\">編輯</button> <button class=\"btn outline\" data-act=\"del\" data-id=\"${a.id}\">刪除</button></div>`;el.querySelector('[data-act="edit"]').addEventListener('click',()=>openAccountModal('edit',a));el.querySelector('[data-act="del"]').addEventListener('click',()=>{if(!confirm(`確定要刪除帳號 ${a.name}？`))return;tx('accounts','readwrite').delete(a.id).onsuccess=()=>{deleteAccountCloud(a.id);renderAccounts()}});accountsList.appendChild(el)})}

async function ensureCurrentUserAccount(){const u=auth.currentUser;if(!u)return;const items=await getAll('accounts');let ex=items.find(x=>x.id===u.uid||x.email===u.email);if(ex)return;const item={id:u.uid,role:'一般',name:u.displayName||'',phone:'',email:u.email||'',serviceCommunities:[],updatedAt:Date.now()};return new Promise(r=>{tx('accounts','readwrite').put(item).onsuccess=()=>{upsertAccountCloud(item);renderAccounts();r()}})}

function openCommunityModal(mode,data){modalCommunity.classList.remove('hidden');modalCommunity.dataset.mode=mode||'create';mCommCode.disabled=mode==='edit';mCommCode.value=data?data.code:'';mCommName.value=data?data.name:'';mCommArea.value=data?data.area:'台北';if(!mCommArea.value)mCommArea.value='台北'}
function closeCommunityModal(){modalCommunity.classList.add('hidden')}
if(btnOpenCommunity){btnOpenCommunity.addEventListener('click',()=>openCommunityModal('create'))}
if(btnCancelCommunity){btnCancelCommunity.addEventListener('click',closeCommunityModal)}
if(btnSaveCommunity){btnSaveCommunity.addEventListener('click',()=>{const code=mCommCode.value.trim();const name=mCommName.value.trim();const area=mCommArea.value.trim();if(!code||!name||!area)return;const item={code,name,area,updatedAt:Date.now()};tx('communities','readwrite').put(item).onsuccess=()=>{closeCommunityModal();upsertCommunityCloud(item);renderCommunities()}})}

function openAccountModal(mode,data){modalAccount.classList.remove('hidden');modalAccount.dataset.mode=mode||'create';modalAccount.dataset.id=data?data.id:'';mAccRole.value=data?data.role:'';mAccName.value=data?data.name:'';mAccPhone.value=data?data.phone:'';mAccEmail.value=data?data.email:'';buildServiceComms(mServiceComms,mSelectAllComms);setTimeout(()=>{if(data&&data.serviceCommunities){mServiceComms.querySelectorAll('input[type="checkbox"]').forEach(b=>{b.checked=data.serviceCommunities.includes(b.value)})}},100)}
function closeAccountModal(){modalAccount.classList.add('hidden')}
if(btnOpenAccount){btnOpenAccount.addEventListener('click',()=>openAccountModal('create'))}
if(btnCancelAccount){btnCancelAccount.addEventListener('click',closeAccountModal)}
if(btnSaveAccount){btnSaveAccount.addEventListener('click',()=>{const id=modalAccount.dataset.mode==='edit'?modalAccount.dataset.id:uuid();const selected=[];mServiceComms.querySelectorAll('input[type="checkbox"]:checked').forEach(b=>selected.push(b.value));const item={id,role:mAccRole.value.trim(),name:mAccName.value.trim(),phone:mAccPhone.value.trim(),email:mAccEmail.value.trim(),serviceCommunities:selected,updatedAt:Date.now()};if(!item.role||!item.name||!item.phone||!item.email)return;tx('accounts','readwrite').put(item).onsuccess=()=>{closeAccountModal();upsertAccountCloud(item);renderAccounts()}})}

async function upsertCommunityCloud(c){if(!firestore||!auth||!navigator.onLine)return;const fsMod=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');const ref=fsMod.doc(firestore,`orgs/default/communities/${c.code}`);await fsMod.setDoc(ref,c,{merge:true})}
async function deleteCommunityCloud(code){if(!firestore||!auth||!navigator.onLine)return;const fsMod=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');const ref=fsMod.doc(firestore,`orgs/default/communities/${code}`);await fsMod.deleteDoc(ref)}
async function syncCommunitiesFromCloud(){if(!firestore||!auth||!navigator.onLine)return;const fsMod=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');const col=fsMod.collection(firestore,'orgs/default/communities');const snap=await fsMod.getDocs(col);const store=tx('communities','readwrite');snap.forEach(d=>{store.put({...d.data()})})}

async function upsertAccountCloud(a){if(!firestore||!auth||!navigator.onLine)return;const fsMod=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');const ref=fsMod.doc(firestore,`orgs/default/accounts/${a.id}`);await fsMod.setDoc(ref,a,{merge:true})}
async function deleteAccountCloud(id){if(!firestore||!auth||!navigator.onLine)return;const fsMod=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');const ref=fsMod.doc(firestore,`orgs/default/accounts/${id}`);await fsMod.deleteDoc(ref)}
async function syncAccountsFromCloud(){if(!firestore||!auth||!navigator.onLine)return;const fsMod=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');const col=fsMod.collection(firestore,'orgs/default/accounts');const snap=await fsMod.getDocs(col);const store=tx('accounts','readwrite');snap.forEach(d=>{store.put({...d.data()})})}

if(togglePassword){togglePassword.addEventListener('click',()=>{loginPassword.type=loginPassword.type==='password'?'text':'password'})}
const savedEmail=localStorage.getItem('rememberEmail')||'';if(savedEmail){loginEmail.value=savedEmail;if(loginRemember)loginRemember.checked=true}
if(loginRemember){loginRemember.addEventListener('change',()=>{if(loginRemember.checked){localStorage.setItem('rememberEmail',loginEmail.value||'')}else{localStorage.removeItem('rememberEmail')}})}
if(btnLogin){btnLogin.addEventListener('click',()=>{if(loginRemember&&loginRemember.checked){localStorage.setItem('rememberEmail',loginEmail.value||'')}})}
async function compressImageBlob(blob){return new Promise(res=>{const url=URL.createObjectURL(blob);const img=new Image();img.onload=()=>{let w=img.width,h=img.height;const m=1024;if(w>m||h>m){const s=Math.min(m/w,m/h);w=Math.round(w*s);h=Math.round(h*s)}const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,w,h);const data=c.toDataURL('image/jpeg',0.7);URL.revokeObjectURL(url);res(data)};img.src=url})}
