/**
 * firebase.js
 * Inicialização do Firebase e exportação da instância do Firestore
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Configuração do projeto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCqip_8Eu8WA1i3tNO-S-ojZa-cMcd_Al0",
  authDomain: "ldo-59b04.firebaseapp.com",
  projectId: "ldo-59b04",
  storageBucket: "ldo-59b04.firebasestorage.app",
  messagingSenderId: "442524164533",
  appId: "1:442524164533:web:bd974afffd8ef21e4e39fc"
};

// Inicializa o app Firebase
const app = initializeApp(firebaseConfig);

// Exporta instância do Firestore para uso nos demais módulos
export const db = getFirestore(app);
