import { db } from "./firebase.js";
import { collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

// Users
const userForm = document.getElementById("userForm");
const userList = document.getElementById("userList");

async function loadUsers(){
  userList.innerHTML="";
  const snap = await getDocs(collection(db,"users"));
  snap.forEach(d=>{
    const u = d.data();
    const li = document.createElement("li");
    li.textContent = `${u.username} (${u.role}) `;
    if(u.role!=="admin"){ // prevent deleting main admin
      const btn = document.createElement("button");
      btn.textContent="Delete";
      btn.onclick=()=>deleteDoc(doc(db,"users",d.id)).then(loadUsers);
      li.appendChild(btn);
    }
    userList.appendChild(li);
  });
}
userForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const uname = document.getElementById("newUsername").value.trim();
  const pwd = document.getElementById("newPassword").value.trim();
  const role = document.getElementById("newRole").value;
  await addDoc(collection(db,"users"), {username:uname, password:pwd, role});
  alert("User created");
  userForm.reset();
  loadUsers();
});

// Locations
const locForm = document.getElementById("locForm");
const locList = document.getElementById("locList");

async function loadLocs(){
  locList.innerHTML="";
  const snap = await getDocs(collection(db,"locations"));
  snap.forEach(d=>{
    const loc = d.data();
    const li = document.createElement("li");
    li.textContent = loc.name + " ";
    const btn = document.createElement("button");
    btn.textContent="Delete";
    btn.onclick=()=>deleteDoc(doc(db,"locations",d.id)).then(loadLocs);
    li.appendChild(btn);
    locList.appendChild(li);
  });
}
locForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const name = document.getElementById("locName").value.trim();
  await addDoc(collection(db,"locations"), {name});
  alert("Location added");
  locForm.reset();
  loadLocs();
});

// Init
loadUsers();
loadLocs();
