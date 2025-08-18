import { auth, db, unameToEmail } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

const loginBtn = document.getElementById("btnLogin");
if(loginBtn){
  loginBtn.addEventListener("click", async ()=>{
    const u = document.getElementById("loginUsername").value.trim();
    const p = document.getElementById("loginPassword").value;
    try{
      const email = unameToEmail(u);
      await signInWithEmailAndPassword(auth, email, p);
      window.location.href = "dashboard.html";
    }catch(e){
      document.getElementById("loginMsg").textContent = e.message;
    }
  });
}

onAuthStateChanged(auth, async (user)=>{
  if(user){
    const snap = await getDoc(doc(db,"users",user.uid));
    if(!snap.exists()){ return; }
    localStorage.setItem("userRole", snap.data().role);
    localStorage.setItem("username", snap.data().username);
  }
});
