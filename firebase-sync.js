
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA9iZO7RenlzQjtG0LboBFdOo9zj0R-PYA",
  authDomain: "study-quest-20f97.firebaseapp.com",
  projectId: "study-quest-20f97",
  storageBucket: "study-quest-20f97.firebasestorage.app",
  messagingSenderId: "816674746718",
  appId: "1:816674746718:web:ed82b0464d85e1070b5fcf"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const KEYS = {
  state: "studyquest-v1",
  duration: "studyquestDuration",
  questions: "studyquest-own-questions-v1"
};

let currentUser = null;
let cloudReady = false;
let busy = false;
let applyingCloud = false;
let lastLocal = "";
let unsubscribeCloud = null;
let pendingCloud = null;

const $ = id => document.getElementById(id);

function bundle() {
  return {
    state: localStorage.getItem(KEYS.state),
    duration: localStorage.getItem(KEYS.duration),
    questions: localStorage.getItem(KEYS.questions)
  };
}

function signature(data) {
  return JSON.stringify(data);
}

function status(message) {
  $("sq-cloud-status").textContent = message;
}

function setBusy(value) {
  busy = value;
  ["sq-signin", "sq-register", "sq-sync-now", "sq-signout",
   "sq-use-cloud", "sq-use-device"].forEach(id => {
    const el = $(id);
    if (el) el.disabled = value;
  });
}

function applyBundle(data) {
  Object.entries(KEYS).forEach(([name, key]) => {
    if (data[name] == null) localStorage.removeItem(key);
    else localStorage.setItem(key, data[name]);
  });
}

function makePanel() {
  const panel = document.createElement("section");
  panel.id = "studyquest-cloud-account";
  panel.style.cssText =
    "max-width:520px;margin:18px auto;padding:16px;border-radius:16px;" +
    "background:#171923;color:#fff;font:14px Arial,sans-serif;" +
    "box-sizing:border-box;border:1px solid #444";

  panel.innerHTML = `
    <h3>☁️ StudyQuest Cloud Save</h3>
    <p id="sq-cloud-status">Sign in to back up your progress.</p>
    <div id="sq-auth-fields">
      <input id="sq-email" type="email" autocomplete="email"
        placeholder="Email address"
        style="box-sizing:border-box;width:100%;padding:12px;margin:5px 0">
      <input id="sq-password" type="password" autocomplete="current-password"
        placeholder="Password (at least 6 characters)"
        style="box-sizing:border-box;width:100%;padding:12px;margin:5px 0">
      <button id="sq-signin" type="button">Sign in</button>
      <button id="sq-register" type="button">Create account</button>
    </div>
    <div id="sq-signed-in" hidden>
      <p id="sq-account-email"></p>
      <button id="sq-sync-now" type="button">Check / sync now</button>
      <button id="sq-signout" type="button">Sign out</button>
    </div>
    <div id="sq-conflict" hidden style="margin-top:12px;padding:12px;border:1px solid #777;border-radius:10px">
      <p id="sq-conflict-message">Saved data differs. Which version should be kept?</p>
      <button id="sq-use-cloud" type="button">Use cloud data</button>
      <button id="sq-use-device" type="button">Keep this device's data</button>
    </div>
    <p style="font-size:12px;color:#aab3c5">
      Choose carefully when data differs. Your password stays private.
    </p>`;

  const style = document.createElement("style");
  style.textContent =
    "#studyquest-cloud-account button{padding:10px 12px;border:0;" +
    "border-radius:8px;margin:4px;cursor:pointer;font-weight:600}" +
    "#studyquest-cloud-account button:disabled{opacity:.5}";
  document.head.appendChild(style);
  document.body.appendChild(panel);
}

makePanel();

function showConflict(data, message) {
  pendingCloud = data;
  $("sq-conflict").hidden = false;
  $("sq-conflict-message").textContent = message;
  status("Choose which saved progress to keep.");
}

async function writeCloud(data) {
  if (!currentUser) throw new Error("Please sign in again.");

  await setDoc(doc(db, "users", currentUser.uid), {
    studyQuestSync: data,
    studyQuestSyncUpdatedAt: new Date().toISOString()
  }, { merge: true });

  lastLocal = signature(data);
}

async function syncNow() {
  if (!currentUser || busy) return;

  setBusy(true);
  cloudReady = false;

  try {
    const ref = doc(db, "users", currentUser.uid);
    const snap = await getDoc(ref);
    const cloud = snap.exists() ? snap.data().studyQuestSync : null;
    const device = bundle();

    if (!cloud) {
      await writeCloud(device);
      cloudReady = true;
      status("✅ First cloud backup created from this device.");
      listenForCloud();
      return;
    }

    if (signature(cloud) === signature(device)) {
      lastLocal = signature(device);
      cloudReady = true;
      status("✅ Cloud and device data match.");
      listenForCloud();
      return;
    }

    showConflict(
      cloud,
      "Cloud and device data are different. Choose which version to keep."
    );
  } catch (error) {
    status("Sync failed: " + error.message);
  } finally {
    setBusy(false);
  }
}

function listenForCloud() {
  if (unsubscribeCloud) unsubscribeCloud();
  if (!currentUser) return;

  unsubscribeCloud = onSnapshot(
    doc(db, "users", currentUser.uid),
    snapshot => {
      if (!snapshot.exists() || !cloudReady || applyingCloud || busy) return;

      const cloud = snapshot.data().studyQuestSync;
      if (!cloud) return;

      const cloudSig = signature(cloud);
      const deviceSig = signature(bundle());

      if (cloudSig === deviceSig) {
        lastLocal = deviceSig;
        return;
      }

      if (deviceSig !== lastLocal) {
        showConflict(
          cloud,
          "Both cloud and this device have changes. Choose which to keep."
        );
        cloudReady = false;
        return;
      }

      applyingCloud = true;
      applyBundle(cloud);
      lastLocal = signature(bundle());
      applyingCloud = false;
      status("☁️ New cloud progress loaded. Refreshing the page…");
      setTimeout(() => location.reload(), 500);
    },
    error => status("Cloud listener error: " + error.message)
  );
}

async function authenticate(create) {
  const email = $("sq-email").value.trim();
  const password = $("sq-password").value;

  if (!email || !password) {
    status("Enter your email and password.");
    return;
  }

  if (password.length < 6) {
    status("Password must be at least 6 characters.");
    return;
  }

  setBusy(true);
  try {
    if (create) {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (error) {
    status(error.message);
  } finally {
    setBusy(false);
  }
}

$("sq-signin").onclick = () => authenticate(false);
$("sq-register").onclick = () => authenticate(true);

$("sq-signout").onclick = async () => {
  if (unsubscribeCloud) unsubscribeCloud();
  unsubscribeCloud = null;
  cloudReady = false;
  await signOut(auth);
};

$("sq-sync-now").onclick = syncNow;

$("sq-use-cloud").onclick = () => {
  if (!pendingCloud) return;

  applyingCloud = true;
  applyBundle(pendingCloud);
  lastLocal = signature(bundle());
  pendingCloud = null;
  $("sq-conflict").hidden = true;
  applyingCloud = false;
  cloudReady = true;
  status("Cloud data loaded. Refreshing StudyQuest…");
  setTimeout(() => location.reload(), 500);
};

$("sq-use-device").onclick = async () => {
  if (!currentUser || busy) return;

  setBusy(true);
  try {
    await writeCloud(bundle());
    pendingCloud = null;
    $("sq-conflict").hidden = true;
    cloudReady = true;
    status("✅ This device's data was saved to the cloud.");
    listenForCloud();
  } catch (error) {
    status("Cloud save failed: " + error.message);
  } finally {
    setBusy(false);
  }
};

onAuthStateChanged(auth, async user => {
  currentUser = user;

  $("sq-auth-fields").hidden = !!user;
  $("sq-signed-in").hidden = !user;

  if (unsubscribeCloud) unsubscribeCloud();
  unsubscribeCloud = null;
  cloudReady = false;
  pendingCloud = null;
  $("sq-conflict").hidden = true;

  if (!user) {
    status("Sign in to back up your progress.");
    return;
  }

  $("sq-account-email").textContent = "Signed in as " + user.email;
  status("Checking cloud backup…");
  await syncNow();
});

setInterval(async () => {
  if (!currentUser || !cloudReady || busy || applyingCloud) return;

  const current = bundle();
  const currentSig = signature(current);

  if (currentSig !== lastLocal) {
    try {
      await writeCloud(current);
      status("✅ Progress saved to your cloud account.");
    } catch (error) {
      status("Cloud save failed: " + error.message);
    }
  }
}, 5000);
          
