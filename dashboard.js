import { auth, db } from "./firebase.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

// DOM refs
const tbody = document.querySelector("#tripTable tbody");
const btnAddRow = document.getElementById("btnAddRow");
const btnExport = document.getElementById("btnExport");
const btnSignOut = document.getElementById("btnSignOut");
const btnAdminPage = document.getElementById("btnAdminPage");
const whoami = document.getElementById("whoami");

const modal = document.getElementById("locationsModal");
const locBox = document.getElementById("locationsOptions");
const btnApply = document.getElementById("btnLocApply");
const btnCancel = document.getElementById("btnLocCancel");

let currentUser = null;
let locationsCache = [];
let modalRow = null;

// --- Load Locations ---
async function loadLocations(){
  const snap = await getDocs(query(collection(db,"locations"), orderBy("name")));
  locationsCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
}

// --- Open Modal ---
function openLocationsModal(row){
  modalRow = row;
  locBox.innerHTML="";
  const existing = row.children[6].querySelector("input[type=text]").value.split(",").map(s=>s.trim());
  locationsCache.forEach(loc=>{
    const checked = existing.includes(loc.name) ? "checked" : "";
    locBox.innerHTML += `
      <label style="display:block;margin:4px 0">
        <input type="checkbox" value="${loc.name}" ${checked}> ${loc.name}
      </label>
    `;
  });
  modal.classList.remove("hidden");
}
btnCancel.addEventListener("click", ()=>{ modal.classList.add("hidden"); modalRow=null; });
btnApply.addEventListener("click", ()=>{
  if(!modalRow) return;
  const selected = Array.from(locBox.querySelectorAll("input:checked")).map(i=>i.value);
  modalRow.children[6].querySelector("input[type=text]").value = selected.join(", ");
  persistRow(modalRow); // save immediately
  modal.classList.add("hidden");
  modalRow=null;
});

// --- Add Row ---
function addEditableRow(docId=null, data={}){
  const tr = document.createElement("tr");
  tr.dataset.id = docId || "";

  tr.innerHTML = `
    <td><input type="date" class="cell" value="${data.date||""}"></td>
    <td><input type="time" class="cell" value="${data.startTime||""}"></td>
    <td><input type="number" class="cell" value="${data.startMeter||""}"></td>
    <td><input type="time" class="cell" value="${data.endTime||""}"></td>
    <td><input type="number" class="cell" value="${data.endMeter||""}"></td>
    <td><input type="text" class="cell" value="${data.totalMeter||""}" readonly></td>
    <td>
      <button class="btn ghost selectLocBtn">Select</button>
      <input type="text" class="cell" value="${(data.locations||[]).join(", ")}" readonly>
    </td>
    <td class="whoCell ${currentUser.role!=="admin"?"hidden":""}">${data.username||""}</td>
    <td class="actCell ${currentUser.role!=="admin"?"hidden":""}"></td>
  `;

  // auto calc total
  const sm = tr.children[2].querySelector("input");
  const em = tr.children[4].querySelector("input");
  const total = tr.children[5].querySelector("input");
  function recalc(){
    const s = parseFloat(sm.value);
    const e = parseFloat(em.value);
    total.value = (!isNaN(s) && !isNaN(e)) ? e - s : "";
    persistRow(tr);
  }
  sm.addEventListener("input", recalc);
  em.addEventListener("input", recalc);

  // locations modal
  tr.querySelector(".selectLocBtn").addEventListener("click", ()=>openLocationsModal(tr));

  // save immediately on change
  [0,1,3].forEach(i=>{
    tr.children[i].querySelector("input").addEventListener("change", ()=>persistRow(tr));
  });

  // admin delete
  if(currentUser.role==="admin"){
    const delBtn = document.createElement("button");
    delBtn.className="btn danger";
    delBtn.textContent="Delete";
    delBtn.addEventListener("click", async ()=>{
      if(tr.dataset.id){
        await deleteDoc(doc(db,"trips",tr.dataset.id));
      }
      tr.remove();
    });
    tr.querySelector(".actCell").appendChild(delBtn);
  }

  tbody.appendChild(tr); // newest rows at bottom
}

async function persistRow(tr){
  const cells = tr.querySelectorAll("td");
  const payload = {
    date: cells[0].querySelector("input").value,
    startTime: cells[1].querySelector("input").value,
    startMeter: Number(cells[2].querySelector("input").value),
    endTime: cells[3].querySelector("input").value,
    endMeter: Number(cells[4].querySelector("input").value),
    totalMeter: Number(cells[5].querySelector("input").value),
    locations: (cells[6].querySelector("input[type=text]").value||"").split(",").map(s=>s.trim()).filter(Boolean),
    username: currentUser.username,
    userId: currentUser.uid,
    createdAt: serverTimestamp()
  };

  if(tr.dataset.id){
    // ✅ only admin can edit/update existing rows
    if(currentUser.role === "admin"){
      await updateDoc(doc(db,"trips",tr.dataset.id), payload);
    }
  } else {
    // ✅ all users can create new rows
    const ref = await addDoc(collection(db,"trips"), payload);
    tr.dataset.id = ref.id;
  }
}


// --- Load Trips ---
async function loadTrips(){
  tbody.innerHTML="";
  
  // ✅ All users (admin & normal) see ALL trips
  const qAll = query(collection(db,"trips"), orderBy("createdAt","asc"));

  const snap = await getDocs(qAll);
  snap.forEach(d=> addEditableRow(d.id, d.data()));
}


// --- Export ---
btnExport.addEventListener("click", ()=>{
  const choiceBox = document.createElement("div");
  choiceBox.style.position="fixed";
  choiceBox.style.top="40%";
  choiceBox.style.left="50%";
  choiceBox.style.transform="translate(-50%,-50%)";
  choiceBox.style.background="#fff";
  choiceBox.style.padding="20px";
  choiceBox.style.border="1px solid #ccc";
  choiceBox.style.borderRadius="10px";
  choiceBox.style.zIndex="9999";
  choiceBox.innerHTML=`
    <h3>Select Export Format</h3>
    <button id="expExcel" class="btn">Excel</button>
    <button id="expPDF" class="btn">PDF</button>
  `;
  document.body.appendChild(choiceBox);
  document.getElementById("expExcel").onclick=()=>{exportExcel(); choiceBox.remove();};
  document.getElementById("expPDF").onclick=()=>{exportPDF(); choiceBox.remove();};
});
function exportExcel(){
  const wb = XLSX.utils.table_to_book(document.getElementById("tripTable"), {sheet:"Trip Log"});
  XLSX.writeFile(wb,"Trip_Log.xlsx");
}
function exportPDF(){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("Trip Meter Log", 14, 15);
  doc.autoTable({html:"#tripTable", startY:20});
  doc.save("Trip_Log.pdf");
}

// --- Sign out ---
btnSignOut.addEventListener("click", ()=> signOut(auth));

// --- Auth state ---
onAuthStateChanged(auth, async (user)=>{
  if(!user){ window.location.href="index.html"; return; }
  const role = localStorage.getItem("userRole");
  const uname = localStorage.getItem("username");
  currentUser = {uid:user.uid, role, username:uname};

  whoami.textContent = `Logged in as: ${uname} (${role})`;
  if(role==="admin"){
    btnAdminPage.style.display="inline-block";
    document.getElementById("thUser").classList.remove("hidden");
    document.getElementById("thActions").classList.remove("hidden");
  }
  await loadLocations();
  loadTrips();
});

// --- Admin Page button ---
btnAdminPage.addEventListener("click", ()=>window.location.href="admin.html");

// --- Add Row button ---
btnAddRow.addEventListener("click", ()=> addEditableRow());
