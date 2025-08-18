import { db } from "./firebase.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

document.getElementById("loginForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  const q = query(collection(db,"users"), where("username","==",username), where("password","==",password));
  const snap = await getDocs(q);

  if(!snap.empty){
    const user = snap.docs[0].data();
    localStorage.setItem("username", user.username);
    localStorage.setItem("userRole", user.role);
    window.location.href="dashboard.html";
  } else {
    alert("Invalid username or password");
  }
});
