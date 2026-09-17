// ============================================
// Firebase 設定檔
// 已填入 30s-Speed-tracker 專案的實際設定值
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyDaL0TTCmhBTavtArYZJOSO1AETPC0weXc",
  authDomain: "fir-speed-tracker-9ba24.firebaseapp.com",
  projectId: "fir-speed-tracker-9ba24",
  storageBucket: "fir-speed-tracker-9ba24.firebasestorage.app",
  messagingSenderId: "780944732571",
  appId: "1:780944732571:web:050739374403033aa6f13e"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
