import { db } from "./firebase.js";
import { collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

// DOM refs
const tbody = document.querySelector("#tripTable tbody");
const btnAddRow = document.getElementById("btnAddRow");
const btnExport = document.getElementById("btnExport");
const btnSignOut = document.getElementById("btnSignOut");
const btnAdminPage = document.getElementById("btnAdminPage");
const whoami = document.getElementById("whoami");

// Modal refs
const modal = document.getElementById("locationsModal");
const locBox = document.getElementById("locationsOptions");
const btnApply = document.getElementById("btnLocApply");
const btnCancel = document.getElementById("btnLocCancel");

let currentUser = null;
let locationsCache = [];
let modalRow = null;

// --- Load user info from localStorage ---
function initUser() {
  const username = localStorage.getItem("username");
  const role = localStorage.getItem("userRole");

  if (!username || !role) {
    window.location.href = "index.html"; // not logged in
    return;
  }

  currentUser = { username, role };

  whoami.textContent = `Logged in as: ${username} (${role})`;

  if (role === "admin") {
    btnAdminPage.classList.remove("hidden");
    document.getElementById("thUser").classList.remove("hidden");
    document.getElementById("thActions").classList.remove("hidden");
  }
}

// --- Load Locations ---
async function loadLocations() {
  const snap = await getDocs(collection(db, "locations"));
  locationsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// --- Open Modal ---
function openLocationsModal(row) {
  modalRow = row;
  locBox.innerHTML = "";
  const existing = row.children[6].querySelector("input[type=text]").value.split(",").map(s => s.trim());
  locationsCache.forEach(loc => {
    const checked = existing.includes(loc.name) ? "checked" : "";
    locBox.innerHTML += `
      <label style="display:block;margin:4px 0">
        <input type="checkbox" value="${loc.name}" ${checked}> ${loc.name}
      </label>
    `;
  });
  modal.classList.remove("hidden");
}
btnCancel.addEventListener("click", () => { modal.classList.add("hidden"); modalRow = null; });
btnApply.addEventListener("click", () => {
  if (!modalRow) return;
  const selected = Array.from(locBox.querySelectorAll("input:checked")).map(i => i.value);
  modalRow.children[6].querySelector("input[type=text]").value = selected.join(", ");
  persistRow(modalRow); // save immediately
  modal.classList.add("hidden");
  modalRow = null;
});

// --- Add Row ---
function addEditableRow(docId = null, data = {}) {
  const tr = document.createElement("tr");
  tr.dataset.id = docId || "";

  tr.innerHTML = `
    <td><input type="date" value="${data.date || ""}"></td>
    <td><input type="time" value="${data.startTime || ""}"></td>
    <td><input type="number" value="${data.startMeter || ""}"></td>
    <td><input type="time" value="${data.endTime || ""}"></td>
    <td><input type="number" value="${data.endMeter || ""}"></td>
    <td><input type="text" value="${data.totalMeter || ""}" readonly></td>
    <td>
      <button class="selectLocBtn">Select</button>
      <input type="text" value="${(data.locations || []).join(", ")}" readonly>
    </td>
    <td class="${currentUser.role !== "admin" ? "hidden" : ""}">${data.username || ""}</td>
    <td class="${currentUser.role !== "admin" ? "hidden" : ""}"></td>
  `;

  // auto calc total
  const sm = tr.children[2].querySelector("input");
  const em = tr.children[4].querySelector("input");
  const total = tr.children[5].querySelector("input");
  function recalc() {
    const s = parseFloat(sm.value);
    const e = parseFloat(em.value);
    total.value = (!isNaN(s) && !isNaN(e)) ? e - s : "";
    persistRow(tr);
  }
  sm.addEventListener("input", recalc);
  em.addEventListener("input", recalc);

  // locations modal
  tr.querySelector(".selectLocBtn").addEventListener("click", () => openLocationsModal(tr));

  // save immediately on change
  [0, 1, 3].forEach(i => {
    tr.children[i].querySelector("input").addEventListener("change", () => persistRow(tr));
  });

  // admin delete
  if (currentUser.role === "admin") {
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.onclick = async () => {
      if (tr.dataset.id) {
        await deleteDoc(doc(db, "trips", tr.dataset.id));
      }
      tr.remove();
    };
    tr.children[8].appendChild(delBtn);
  }

  tbody.appendChild(tr);
}

// --- Save Row ---
async function persistRow(tr) {
  const cells = tr.querySelectorAll("td");
  const payload = {
    date: cells[0].querySelector("input").value,
    startTime: cells[1].querySelector("input").value,
    startMeter: Number(cells[2].querySelector("input").value),
    endTime: cells[3].querySelector("input").value,
    endMeter: Number(cells[4].querySelector("input").value),
    totalMeter: Number(cells[5].querySelector("input").value),
    locations: (cells[6].querySelector("input[type=text]").value || "").split(",").map(s => s.trim()).filter(Boolean),
    username: currentUser.username,
    createdAt: serverTimestamp()
  };

  if (tr.dataset.id) {
    if (currentUser.role === "admin") {
      await updateDoc(doc(db, "trips", tr.dataset.id), payload);
    }
  } else {
    const ref = await addDoc(collection(db, "trips"), payload);
    tr.dataset.id = ref.id;
  }
}

// --- Load Trips ---
async function loadTrips() {
  tbody.innerHTML = "";
  const qAll = query(collection(db, "trips"), orderBy("createdAt", "asc"));
  const snap = await getDocs(qAll);
  snap.forEach(d => addEditableRow(d.id, d.data()));
}

// --- Export ---
btnExport.addEventListener("click", () => {
  const wb = XLSX.utils.table_to_book(document.getElementById("tripTable"), { sheet: "Trip Log" });
  XLSX.writeFile(wb, "Trip_Log.xlsx");
});

// --- Sign out ---
btnSignOut.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "index.html";
});

// --- Admin Page ---
btnAdminPage.addEventListener("click", () => window.location.href = "admin.html");

// --- Init ---
initUser();
loadLocations().then(loadTrips);
btnAddRow.addEventListener("click", () => addEditableRow());
