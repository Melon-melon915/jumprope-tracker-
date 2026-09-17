// ============================================
// 單車步紀錄 App 邏輯
// ============================================

const EMAIL_DOMAIN = "@jumprope.local"; // 內部用，把名字轉成 email 格式給 Firebase Auth
let currentUser = null;
let currentDuration = 30;
let chart = null;
let unsubscribeSnapshot = null;

function nameToEmail(name) {
  const clean = name.trim().toLowerCase().replace(/\s+/g, "_");
  return clean + EMAIL_DOMAIN;
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ---------- 登入 / 註冊 頁面切換 ----------
const tabLogin = document.getElementById("tab-login");
const tabSignup = document.getElementById("tab-signup");
const formLogin = document.getElementById("form-login");
const formSignup = document.getElementById("form-signup");

tabLogin.addEventListener("click", () => {
  tabLogin.classList.add("active");
  tabSignup.classList.remove("active");
  formLogin.classList.remove("hidden");
  formSignup.classList.add("hidden");
});

tabSignup.addEventListener("click", () => {
  tabSignup.classList.add("active");
  tabLogin.classList.remove("active");
  formSignup.classList.remove("hidden");
  formLogin.classList.add("hidden");
});

// ---------- 註冊 ----------
document.getElementById("btn-signup").addEventListener("click", async () => {
  const name = document.getElementById("signup-name").value.trim();
  const password = document.getElementById("signup-password").value;
  const errorEl = document.getElementById("signup-error");
  errorEl.textContent = "";

  if (!name || name.length < 2) {
    errorEl.textContent = "請輸入有效名字（至少2個字）";
    return;
  }
  if (!password || password.length < 6) {
    errorEl.textContent = "密碼至少需要6位";
    return;
  }

  try {
    const email = nameToEmail(name);
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await db.collection("users").doc(cred.user.uid).set({
      displayName: name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    if (err.code === "auth/email-already-in-use") {
      errorEl.textContent = "這個名字已經被使用，請試試其他名字或直接登入";
    } else if (err.code === "auth/invalid-email") {
      errorEl.textContent = "名字包含不支援的符號，請只用中英文字母/數字";
    } else {
      errorEl.textContent = "註冊失敗：" + err.message;
    }
  }
});

// ---------- 登入 ----------
document.getElementById("btn-login").addEventListener("click", async () => {
  const name = document.getElementById("login-name").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  errorEl.textContent = "";

  if (!name || !password) {
    errorEl.textContent = "請輸入名字和密碼";
    return;
  }

  try {
    const email = nameToEmail(name);
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
      errorEl.textContent = "名字或密碼不正確";
    } else {
      errorEl.textContent = "登入失敗：" + err.message;
    }
  }
});

// ---------- 登出 ----------
document.getElementById("btn-logout").addEventListener("click", () => {
  auth.signOut();
});

// ---------- 監聽登入狀態 ----------
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    const userDoc = await db.collection("users").doc(user.uid).get();
    const displayName = userDoc.exists ? userDoc.data().displayName : user.email.split("@")[0];
    document.getElementById("display-name").textContent = displayName;
    showScreen("app-screen");
    document.getElementById("record-date").valueAsDate = new Date();
    loadDurationData(currentDuration);
  } else {
    currentUser = null;
    showScreen("login-screen");
  }
});

// 初始判斷（避免白屏太久）
setTimeout(() => {
  if (!currentUser) {
    // onAuthStateChanged 會處理實際畫面切換；這裡只是保底
  }
}, 1500);

// ---------- 秒數分頁切換 ----------
document.querySelectorAll(".dtab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".dtab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentDuration = parseInt(btn.dataset.dur, 10);
    document.getElementById("input-title").textContent = `新增 ${currentDuration}秒 紀錄`;
    document.getElementById("chart-title").textContent = `${currentDuration}秒 進步曲線`;
    loadDurationData(currentDuration);
  });
});

// ---------- 新增紀錄 ----------
document.getElementById("btn-add-record").addEventListener("click", async () => {
  const dateVal = document.getElementById("record-date").value;
  const countVal = document.getElementById("record-count").value;
  const successEl = document.getElementById("add-success");
  successEl.textContent = "";
  successEl.style.color = "#4ade80";

  if (!dateVal) {
    successEl.style.color = "#f87171";
    successEl.textContent = "請選擇日期";
    return;
  }
  const count = parseInt(countVal, 10);
  if (isNaN(count) || count < 0) {
    successEl.style.color = "#f87171";
    successEl.textContent = "請輸入有效下數";
    return;
  }

  try {
    await db.collection("users").doc(currentUser.uid)
      .collection("records_" + currentDuration)
      .add({
        date: dateVal,
        count: count,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    successEl.textContent = "已儲存！";
    document.getElementById("record-count").value = "";
    loadDurationData(currentDuration);
  } catch (err) {
    successEl.style.color = "#f87171";
    successEl.textContent = "儲存失敗：" + err.message;
  }
});

// ---------- 讀取並顯示資料 ----------
async function loadDurationData(duration) {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }

  const colRef = db.collection("users").doc(currentUser.uid).collection("records_" + duration);

  unsubscribeSnapshot = colRef.orderBy("date", "asc").onSnapshot(snapshot => {
    const records = [];
    snapshot.forEach(doc => {
      records.push({ id: doc.id, ...doc.data() });
    });
    renderPB(records);
    renderChart(records, duration);
    renderHistory(records, duration);
  }, err => {
    console.error(err);
  });
}

function renderPB(records) {
  const pbNumberEl = document.getElementById("pb-number");
  const pbDateEl = document.getElementById("pb-date");

  if (records.length === 0) {
    pbNumberEl.textContent = "--";
    pbDateEl.textContent = "";
    return;
  }

  let best = records[0];
  records.forEach(r => {
    if (r.count > best.count) best = r;
  });

  pbNumberEl.textContent = best.count;
  pbDateEl.textContent = "達成日期：" + best.date;
}

function renderChart(records, duration) {
  const ctx = document.getElementById("progress-chart");
  const emptyHint = document.getElementById("chart-empty");

  if (records.length === 0) {
    ctx.style.display = "none";
    emptyHint.style.display = "block";
    if (chart) { chart.destroy(); chart = null; }
    return;
  }

  ctx.style.display = "block";
  emptyHint.style.display = "none";

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const labels = sorted.map(r => r.date);
  const data = sorted.map(r => r.count);

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: duration + "秒單車步 下數",
        data: data,
        borderColor: "#38bdf8",
        backgroundColor: "rgba(56, 189, 248, 0.15)",
        pointBackgroundColor: "#38bdf8",
        pointRadius: 4,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          title: { display: true, text: "日期", color: "#94a3b8" },
          ticks: { color: "#94a3b8" },
          grid: { color: "#334155" }
        },
        y: {
          title: { display: true, text: "下數", color: "#94a3b8" },
          ticks: { color: "#94a3b8" },
          grid: { color: "#334155" },
          beginAtZero: true
        }
      }
    }
  });
}

function renderHistory(records, duration) {
  const listEl = document.getElementById("history-list");
  listEl.innerHTML = "";

  if (records.length === 0) {
    listEl.innerHTML = '<p class="empty-hint">尚無紀錄</p>';
    return;
  }

  const best = Math.max(...records.map(r => r.count));
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));

  sorted.forEach(r => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <span class="h-date">${r.date}</span>
      <span class="h-count ${r.count === best ? 'is-pb' : ''}">${r.count} 下</span>
      <button class="h-delete" data-id="${r.id}">刪除</button>
    `;
    listEl.appendChild(item);
  });

  listEl.querySelectorAll(".h-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("確定要刪除這筆紀錄嗎？")) return;
      await db.collection("users").doc(currentUser.uid)
        .collection("records_" + duration)
        .doc(btn.dataset.id)
        .delete();
    });
  });
}

// ---------- 註冊 Service Worker (PWA) ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(err => console.log("SW registration failed:", err));
  });
}
