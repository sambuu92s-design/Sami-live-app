import "./styles.css";
import {
  collection, doc, setDoc, updateDoc, addDoc, serverTimestamp,
  onSnapshot, query, where, getDoc, getDocs, writeBatch
} from "firebase/firestore";
import { db, storage, messaging } from "./firebase.js";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getToken, onMessage } from "firebase/messaging";
const VAPID_KEY = "BOvBeU26oKOKUUgVt_pIB-yuM__-9e8jfceXC7qJT_r10SBZJVZ9Ut_c_5gxnJU19Sml9-XzayEACBJL-5zCSek";
const MATERIALS = [
  "Steel Pipe – 6 m",
  "Steel Pipe – 4 m",
  "Steel Pipe – 2 m",
  "Steel Pipe – 1 m",
  "Steel Pipe – Bend",
  "Victaulic Clamp - Coupling",
  "Q Claw",
  "Dog Leg",
  "Dome Nut – Ø20 mm",
  "Rock Bolt – Ø20 mm"
];

const ATTACHMENTS = ["Bucket", "Forks", "Jib", "Man Basket", "Other"];

let state = {
  online: navigator.onLine,
  activeShiftId: null,
  activeShift: null,
  assets: []
};

const app = document.querySelector("#app");

app.innerHTML = `
<div class="app">
  <div class="topbar">
    <div class="brand">
      <h1>Underground Shift App</h1>
      <div class="muted">Offline-first live sample</div>
    </div>
    <div id="netBadge" class="badge"></div>
    <button id="enableNotifications" class="btn">🔔 Enable Notifications</button>
  </div>

  <div class="tabs">
    <button class="btn tab active" data-view="start">Start Shift</button>
    <button class="btn tab" data-view="active">Active Shift</button>
    <button class="btn tab" data-view="supervisor">Supervisor</button>
    <button class="btn tab" data-view="inventory">Inventory</button>
  </div>

  <section id="start" class="view active">
    <div class="card">
      <h2>Create Paste Pipe Shift</h2>
      <div class="grid2">
        <label>Shift
          <select id="shiftType"><option>Day Shift</option><option>Night Shift</option></select>
        </label>
        <label>Work Location
          <select id="location"><option>9586 RAW 1</option><option>9586 RAW 2</option></select>
        </label>
        <label>Leading Hand
          <input id="leader" placeholder="Enter name">
        </label>
        <label>Crew
          <select id="crewType"><option>Paste Pipe Crew</option><option>Airleg Drilling Crew</option></select>
        </label>
      </div>
    </div>

    <div class="card">
      <h2>Consumables Taken</h2>
      <div class="muted">Inventory is only deducted when the supervisor approves the start.</div>
      <div id="materials"></div>
    </div>

    <button id="submitStart" class="btn primary">Send for Start Approval</button>
    <div id="startMsg" class="statusline"></div>
  </section>

  <section id="active" class="view">
    <div class="card">
      <h2>Active Shift</h2>
      <div id="activeMeta" class="muted">No active shift.</div>
    </div>

    <div class="card">
      <div class="topbar">
        <div>
          <h2>Machinery / Assets</h2>
          <div class="muted">Multiple assets and multiple attachments per asset.</div>
        </div>
        <button id="addAsset" class="btn">+ Add Asset</button>
      </div>
      <div id="assetList"></div>
    </div>

    <div class="card">
      <h2>Production / Delays / QA</h2>
      <div class="grid2">
        <label>Metres installed
          <input id="metres" type="number" min="0" step="0.1" value="0">
        </label>
        <label>Delay minutes
          <input id="delayMinutes" type="number" min="0" value="0">
        </label>
      </div>
      <label style="margin-top:12px">Work completed
        <textarea id="workDone" rows="3"></textarea>
      </label>
      <label style="margin-top:12px">QA / reconciliation notes
        <textarea id="qaNotes" rows="3"></textarea>
      </label>
    </div>
<div class="card">
  <h2>Shift Photos</h2>
  <div class="muted">Add photos of completed work, QA, damage or site conditions.</div>

  <label style="margin-top:12px">
    Add photos
    <input id="shiftPhotos" type="file" accept="image/*" capture="environment">
  </label>

  <button id="uploadPhotos" class="btn" style="margin-top:12px">
    Upload Selected Photos
  </button>

  <div id="photoMsg" class="notice" style="margin-top:12px">
    No photos uploaded yet.
  </div>

  <div id="photoList"></div>
</div>
    

    <div class="card">
      <h2>Shift Sync</h2>
      <div id="syncMsg" class="notice"></div>
      <button id="finishShift" class="btn primary" style="margin-top:12px">Finish Underground Shift</button>
    </div>
  </section>

  <section id="supervisor" class="view">
    <div class="card">
      <h2>Supervisor Queue</h2>
      <div class="muted">Start approvals and final shift approvals appear here in real time.</div>
      <div id="approvalQueue" style="margin-top:12px"></div>
    </div>
  </section>

  <section id="inventory" class="view">
    <div class="card">
      <h2>Inventory</h2>
      <div id="inventoryList"></div>
    </div>
  </section>
</div>
`;

const $ = s => app.querySelector(s);
const $$ = s => [...app.querySelectorAll(s)];

function updateNet() {
  state.online = navigator.onLine;
  $("#netBadge").textContent = state.online ? "🟢 Online" : "🔴 Offline";
  $("#syncMsg").textContent = state.online
    ? "Online. Firestore syncs local changes automatically."
    : "Offline underground. Shift changes are stored locally and sync when internet returns.";
}
window.addEventListener("online", updateNet);
window.addEventListener("offline", updateNet);
updateNet();

$$(".tab").forEach(btn => btn.addEventListener("click", () => {
  $$(".tab").forEach(x => x.classList.toggle("active", x === btn));
  $$(".view").forEach(v => v.classList.toggle("active", v.id === btn.dataset.view));
}));

function renderMaterialInputs() {
  $("#materials").innerHTML = MATERIALS.map(name => `
    <div class="material-row">
      <div><strong>${name}</strong><div class="muted stock-label" data-stock="${name}">Loading stock...</div></div>
      <input type="number" min="0" value="0" class="take" data-name="${name}">
      <div class="after muted">Taken before start approval</div>
    </div>
  `).join("");
}
renderMaterialInputs();

async function ensureInventorySeeded() {
  const defaults = {
    "Steel Pipe – 6 m": 42, "Steel Pipe – 4 m": 18, "Steel Pipe – 2 m": 14,
    "Steel Pipe – 1 m": 10, "Steel Pipe – Bend": 8, "Victaulic Clamp - Coupling": 160,
    "Q Claw": 95, "Dog Leg": 102, "Dome Nut – Ø20 mm": 220, "Rock Bolt – Ø20 mm": 240
  };
  for (const [name, qty] of Object.entries(defaults)) {
    const ref = doc(db, "inventory", name);
    const snap = await getDoc(ref);
    if (!snap.exists()) await setDoc(ref, { name, qty, updatedAt: serverTimestamp() });
  }
}

function watchInventory() {
  onSnapshot(collection(db, "inventory"), snap => {
    const rows = [];
    snap.forEach(d => {
      const item = d.data();
      rows.push(item);
      const label = app.querySelector(`[data-stock="${CSS.escape(item.name)}"]`);
      if (label) label.textContent = `Available: ${item.qty}`;
    });
    rows.sort((a,b) => a.name.localeCompare(b.name));
    $("#inventoryList").innerHTML = rows.map(x => `<div class="summary-row"><span>${x.name}</span><strong>${x.qty}</strong></div>`).join("");
  });
}

$("#submitStart").addEventListener("click", async () => {
  const leader = $("#leader").value.trim();
  if (!leader) {
    $("#startMsg").textContent = "Enter the leading hand.";
    return;
  }
  const consumables = {};
  $$(".take").forEach(i => consumables[i.dataset.name] = Math.max(0, Number(i.value) || 0));

  const payload = {
    type: $("#crewType").value,
    shiftType: $("#shiftType").value,
    location: $("#location").value,
    leadingHand: leader,
    consumables,
    status: "AWAITING_START_APPROVAL",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, "shifts"), payload);
  state.activeShiftId = ref.id;
  $("#startMsg").textContent = `Submitted. Shift ${ref.id.slice(0,8)} is awaiting start approval.`;
});

function approvalCard(id, s) {
  const materials = Object.entries(s.consumables || {}).filter(([,q]) => q > 0)
    .map(([n,q]) => `<div class="summary-row"><span>${n}</span><strong>${q}</strong></div>`).join("");

  if (s.status === "AWAITING_START_APPROVAL") {
    return `
      <div class="card" data-shift="${id}">
        <strong>Start Approval · ${s.location}</strong>
        <div class="muted">${s.shiftType} · ${s.leadingHand}</div>
        <div class="summary" style="margin-top:10px">${materials || "<div class='muted'>No consumables entered.</div>"}</div>
        <label style="margin-top:12px">Supervisor / Superintendent
          <input class="approver" placeholder="Enter name">
        </label>
        <button class="btn primary approve-start" style="margin-top:10px">Approve & Start Shift</button>
      </div>`;
  }

  if (s.status === "AWAITING_FINAL_APPROVAL") {
    return `
      <div class="card" data-shift="${id}">
        <strong>Final Approval · ${s.location}</strong>
        <div class="summary" style="margin-top:10px">
          <div class="summary-row"><span>Leading Hand</span><strong>${s.leadingHand || ""}</strong></div>
          <div class="summary-row"><span>Metres installed</span><strong>${s.metresInstalled || 0} m</strong></div>
          <div class="summary-row"><span>Delay</span><strong>${s.delayMinutes || 0} min</strong></div>
          <div class="summary-row"><span>Assets</span><strong>${(s.assets || []).length}</strong></div>
        </div>
        <label style="margin-top:12px">Supervisor / Superintendent
          <input class="approver" placeholder="Enter name">
        </label>
        <button class="btn primary approve-final" style="margin-top:10px">Approve & Close Shift</button>
      </div>`;
  }
  return "";
}

function watchApprovals() {
  onSnapshot(collection(db, "shifts"), snap => {
    const cards = [];
    snap.forEach(d => {
      const s = d.data();
      if (s.status === "AWAITING_START_APPROVAL" || s.status === "AWAITING_FINAL_APPROVAL") {
        cards.push(approvalCard(d.id, s));
      }
      if (state.activeShiftId === d.id && s.status === "ACTIVE") {
        state.activeShift = { id:d.id, ...s };
        $("#activeMeta").textContent = `${s.shiftType} · ${s.location} · ${s.leadingHand}`;
      }
      if (state.activeShiftId === d.id && s.status === "COMPLETED") {
  state.activeShiftId = null;
  state.activeShift = null;
  state.assets = [];
  $("#activeMeta").textContent = "No active shift";
}
    });

    $("#approvalQueue").innerHTML = cards.join("") || `<div class="notice">No approvals waiting.</div>`;

    $$(".approve-start").forEach(btn => btn.addEventListener("click", async () => {
      const card = btn.closest("[data-shift]");
      const id = card.dataset.shift;
      const approver = card.querySelector(".approver").value.trim();
      if (!approver) return;

      const shiftRef = doc(db, "shifts", id);
      const shiftSnap = await getDoc(shiftRef);
      const s = shiftSnap.data();

      const batch = writeBatch(db);
      for (const [name, qty] of Object.entries(s.consumables || {})) {
        if (!qty) continue;
        const invRef = doc(db, "inventory", name);
        const invSnap = await getDoc(invRef);
        const current = invSnap.exists() ? Number(invSnap.data().qty) || 0 : 0;
        if (qty > current) {
          alert(`Not enough ${name}. Available: ${current}, requested: ${qty}`);
          return;
        }
        batch.update(invRef, { qty: current - qty, updatedAt: serverTimestamp() });
      }

      batch.update(shiftRef, {
        status: "ACTIVE",
        startApprovedBy: approver,
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await batch.commit();
      state.activeShiftId = id;
    }));

    $$(".approve-final").forEach(btn => btn.addEventListener("click", async () => {
      const card = btn.closest("[data-shift]");
      const approver = card.querySelector(".approver").value.trim();
      if (!approver) return;
      await updateDoc(doc(db, "shifts", card.dataset.shift), {
        status: "COMPLETED",
        finalApprovedBy: approver,
        completedAt: serverTimestamp(),
        locked: true,
        updatedAt: serverTimestamp()
      });
    }));
  });
}

$("#addAsset").addEventListener("click", () => {
  if (!state.activeShiftId) return alert("A shift must be approved and active first.");
  state.assets.push({ type:"", assetNumber:"", attachments:[] });
  renderAssets();
});

function renderAssets() {
  $("#assetList").innerHTML = state.assets.map((a,i) => `
    <div class="asset" data-index="${i}">
      <strong>Asset ${i+1}</strong>
      <div class="grid2" style="margin-top:10px">
        <label>Machine type
          <select class="machine-type">
            <option value="">Select</option>
            <option>IT / Integrated Tool Carrier</option>
            <option>Telehandler</option>
            <option>Loader</option>
            <option>Light Vehicle</option>
            <option>Other</option>
          </select>
        </label>
        <label>Asset number
          <input class="asset-number" placeholder="Manual asset number">
        </label>
      </div>
      <div class="checks">
        ${ATTACHMENTS.map(x => `<label class="check"><input type="checkbox" class="attachment" value="${x}">${x}</label>`).join("")}
      </div>
      <button class="btn danger remove-asset" style="margin-top:10px">Remove</button>
    </div>
  `).join("");

  $$(".asset").forEach(card => {
    const i = Number(card.dataset.index);
    card.querySelector(".machine-type").value = state.assets[i].type;
    card.querySelector(".asset-number").value = state.assets[i].assetNumber;
    card.querySelector(".machine-type").addEventListener("change", e => state.assets[i].type = e.target.value);
    card.querySelector(".asset-number").addEventListener("input", e => state.assets[i].assetNumber = e.target.value);
    card.querySelectorAll(".attachment").forEach(c => c.addEventListener("change", () => {
      state.assets[i].attachments = [...card.querySelectorAll(".attachment:checked")].map(x => x.value);
    }));
    card.querySelector(".remove-asset").addEventListener("click", () => {
      state.assets.splice(i,1); renderAssets();
    });
  });
}
$("#uploadPhotos").addEventListener("click", async () => {
  const input = $("#shiftPhotos");
  const files = [...input.files];

  if (!state.activeShiftId) {
    return alert("No active shift.");
  }

  if (!files.length) {
    return alert("Take a photo first.");
  }

  const msg = $("#photoMsg");
  msg.textContent = "Uploading photo...";

  try {
    const urls = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const photoRef = ref(
        storage,
        `shiftPhotos/${state.activeShiftId}/${Date.now()}-${i}-${file.name}`
      );

      await uploadBytes(photoRef, file);
      const url = await getDownloadURL(photoRef);
      urls.push(url);
    }

    const shiftRef = doc(db, "shifts", state.activeShiftId);
    const shiftSnap = await getDoc(shiftRef);
    const existingPhotos = shiftSnap.data()?.photoUrls || [];
    const allPhotos = [...existingPhotos, ...urls];

    await updateDoc(shiftRef, {
      photoUrls: allPhotos,
      updatedAt: serverTimestamp()
    });

    msg.textContent = `${urls.length} photo uploaded successfully.`;

    $("#photoList").innerHTML = allPhotos
      .map(url => `<img src="${url}" style="width:100%;margin-top:12px;border-radius:12px">`)
      .join("");

    input.value = "";
  } catch (err) {
    console.error(err);
    msg.textContent = `Upload failed: ${err.code || err.message}`;
  }
});
$("#finishShift").addEventListener("click", async () => {
  if (!state.activeShiftId) return alert("No active shift.");
  await updateDoc(doc(db, "shifts", state.activeShiftId), {
    metresInstalled: Math.max(0, Number($("#metres").value) || 0),
    delayMinutes: Math.max(0, Number($("#delayMinutes").value) || 0),
    workCompleted: $("#workDone").value.trim(),
    qaNotes: $("#qaNotes").value.trim(),
    assets: state.assets,
    status: "AWAITING_FINAL_APPROVAL",
    finishedAt: serverTimestamp(),
    syncedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  $("#syncMsg").textContent = navigator.onLine
    ? "Shift uploaded. Supervisor can review and sign it off now."
    : "Shift saved offline. It will automatically sync when the device reconnects.";
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}
async function enableNotifications() {
  try {
    if (!("Notification" in window)) {
      alert("Notifications are not supported on this device.");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      alert("Notification permission was not granted.");
      return;
    }

    const registration = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (!token) {
      alert("Could not create notification token.");
      return;
    }
await registration.showNotification("Shift App Local Test", {
  body: "Local notifications are working."
});
    prompt("Copy this FCM token:", token);
    alert("Notifications enabled successfully.");
  } catch (err) {
    console.error("Notification setup failed:", err);
    alert(`Notification setup failed: ${err.message}`);
  }
}
$("#enableNotifications").addEventListener("click", enableNotifications);
onMessage(messaging, (payload) => {
  console.log("Foreground FCM message:", payload);

  alert(
    `${payload.notification?.title || "Shift App"}\n\n` +
    `${payload.notification?.body || "Foreground message received."}`
  );
});
(async () => {
  try {
    await ensureInventorySeeded();
    watchInventory();
    watchApprovals();
  } catch (err) {
    console.error(err);
    $("#startMsg").textContent =
      "Firebase is not configured yet. Copy firebase-config.example.js to firebase-config.js and add your Firebase project settings.";
  }
})();
