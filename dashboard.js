import { db } from "./firebase.js";
import { collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

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

// --- Init User from localStorage ---
function initUser() {
  const username = localStorage.getItem("username");
  const role = localStorage.getItem("userRole");

  if (!username || !role) {
    window.location.href = "index.html"; 
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

// --- Open Locations Modal ---
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
  persistRow(modalRow); 
  modal.classList.add("hidden");
  modalRow = null;
});

// --- Add Row ---
function addEditableRow(docId = null, data = {}) {
  const isNew = !docId;
  const isAdmin = currentUser.role === "admin";

  const tr = document.createElement("tr");
  tr.dataset.id = docId || "";

  tr.innerHTML = `
    <td><input type="date" value="${data.date || ""}" ${!isNew && !isAdmin ? "disabled" : ""}></td>
    <td><input type="time" value="${data.startTime || ""}" ${!isNew && !isAdmin ? "disabled" : ""}></td>
    <td><input type="number" value="${data.startMeter || ""}" ${!isNew && !isAdmin ? "disabled" : ""}></td>
    <td><input type="time" value="${data.endTime || ""}" ${!isNew && !isAdmin ? "disabled" : ""}></td>
    <td><input type="number" value="${data.endMeter || ""}" ${!isNew && !isAdmin ? "disabled" : ""}></td>
    <td><input type="text" value="${data.totalMeter || ""}" readonly></td>
    <td>
      ${(!isNew && !isAdmin) ? "" : '<button class="selectLocBtn">Select</button>'}
      <input type="text" value="${(data.locations || []).join(", ")}" readonly>
    </td>
    <td class="${!isAdmin ? "hidden" : ""}">${data.username || ""}</td>
    <td class="${!isAdmin ? "hidden" : ""}"></td>
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
  if (isNew || isAdmin) {
    sm.addEventListener("input", recalc);
    em.addEventListener("input", recalc);
  }

  // locations
  const locBtn = tr.querySelector(".selectLocBtn");
  if (locBtn) {
    locBtn.addEventListener("click", () => openLocationsModal(tr));
  }

  // save for new rows
  if (isNew) {
    [0, 1, 3].forEach(i => {
      tr.children[i].querySelector("input").addEventListener("change", () => persistRow(tr));
    });
  }

  // admin delete
  if (isAdmin) {
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
  const isAdmin = currentUser.role === "admin";
  const isNew = !tr.dataset.id;

  const cells = tr.querySelectorAll("td");
  const payload = {
    date: cells[0].querySelector("input").value,
    startTime: cells[1].querySelector("input").value,
    startMeter: Number(cells[2].querySelector("input").value),
    endTime: cells[3].querySelector("input").value,
    endMeter: Number(cells[4].querySelector("input").value),
    totalMeter: Number(cells[5].querySelector("input").value),
    locations: (cells[6].querySelector("input[type=text]").value || "")
                .split(",").map(s => s.trim()).filter(Boolean),
    username: currentUser.username,
    createdAt: serverTimestamp()
  };

  // --- check if row is fully filled ---
  const fullyFilled = payload.date && payload.startTime && payload.endTime &&
                      !isNaN(payload.startMeter) && !isNaN(payload.endMeter) &&
                      payload.locations.length > 0;

  if (isNew) {
    // create the row
    const ref = await addDoc(collection(db, "trips"), payload);
    tr.dataset.id = ref.id;

    // if user filled everything and is not admin → lock it
    if (!isAdmin && fullyFilled) lockRow(tr);

  } else if (isAdmin) {
    // admin can always update
    await updateDoc(doc(db, "trips", tr.dataset.id), payload);

  } else if (fullyFilled) {
    // normal user finalizing → update once and lock
    await updateDoc(doc(db, "trips", tr.dataset.id), payload);
    lockRow(tr);
  }
}

// --- Helper: lock row for non-admins ---
function lockRow(tr) {
  const cells = tr.querySelectorAll("td");
  Array.from(cells).forEach((td, idx) => {
    const inp = td.querySelector("input");
    if (inp && idx !== 5 && idx !== 6) { // total already readonly, locations always readonly
      inp.setAttribute("disabled", "true");
    }
  });
  const btn = tr.querySelector(".selectLocBtn");
  if (btn) btn.remove();
}



// --- Load Trips ---
async function loadTrips() {
  tbody.innerHTML = "";
  const qAll = query(collection(db, "trips"), orderBy("createdAt", "asc"));
  const snap = await getDocs(qAll);
  snap.forEach(d => addEditableRow(d.id, d.data()));
}

// --- Export (Excel) ---
btnExport.addEventListener("click", async () => {
  // fetch all trip data fresh from Firestore
  const qAll = query(collection(db, "trips"), orderBy("createdAt", "asc"));
  const snap = await getDocs(qAll);

  // build array of rows
  const rows = [];
  rows.push(["Date", "Start Time", "End Time", "Start Meter", "End Meter", "Total Meter", "Locations", "Username"]);

  snap.forEach(docSnap => {
    const d = docSnap.data();
    rows.push([
      d.date || "",
      d.startTime || "",
      d.endTime || "",
      d.startMeter || "",
      d.endMeter || "",
      d.totalMeter || "",
      (d.locations || []).join(", "),
      d.username || ""
    ]);
  });

  // convert to sheet + export
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Trip Log");

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
