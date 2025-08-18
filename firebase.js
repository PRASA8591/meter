import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAX2CyUrlrVuB35HDNOntpBJ0-AkeUFzzM",
  authDomain: "meter-691db.firebaseapp.com",
  projectId: "meter-691db",
  storageBucket: "meter-691db.firebasestorage.app",
  messagingSenderId: "879229307920",
  appId: "1:879229307920:web:c26141a942c54451d28e95"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
export { db };
