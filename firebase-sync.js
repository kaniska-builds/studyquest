
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
  setDoc
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

const STATE_KEY = "studyquest-v1";
const DURATION_KEY = "studyquestDuration";
const QUESTIONS_KEY = "studyquest-own-questions-v1";

let currentUser = null;
let syncing = false;
let cloudReady = false;
let lastLocalData = "";

function localBundle() {
  return {
    state: localStorage.getItem(STATE_KEY),
    duration: localStorage.getItem(DURATION_KEY),
    questions: localStorage.getItem(QUESTIONS_KEY)
  };
}

function bundleString(bundle) {
  return JSON.stringify(bundle);
}

function applyBundle(bundle) {
  if (bundle.state === null || bundle.state === undefined) {
    localStorage.removeItem(STATE_KEY);
  } else {
    localStorage.setItem(STATE_KEY, bundle.state);
  }

  if (bundle.duration === null || bundle.duration === undefined) {
    localStorage.removeItem(DURATION_KEY);
  } else {
    localStorage.setItem(DURATION_KEY, bundle.duration);
  }

  if (bundle.questions === null || bundle.questions === undefined) {
    localStorage.removeItem(QUESTIONS_KEY);
  } else {
    localStorage.setItem(QUESTIONS_KEY, bundle.questions);
  }
}

function makePanel() {
  const panel = document.createElement("section");
  panel.id = "studyquest-cloud-account";
  panel.style.cssText = [
    "max-width:520px",
    "margin:18px auto",
    "padding:16px",
    "border-radius:16px",
    "background:#171923",
    "color:#fff",
    "font:14px Arial,sans-serif",
    "box-sizing:border-box",
    "border:1px solid #444"
  ].join(";");

  panel.innerHTML = `
    <h3 style="margin:0 0 10px">☁️ StudyQuest Cloud Save</h3>
    <p id="sq-cloud-status" style="margin:8px 0;color:#cbd5e1">
      Sign in to back up your progress.
    </p>
    <div id="sq-auth-fields">
      <input id="sq-email" type="email" autocomplete="email"
        placeholder="Email address"
        style="box-sizing:border-box;width:100%;padding:12px;margin:5px 0;border-radius:8px;border:1px solid #666">
      <input id="sq-password" type="password" autocomplete="current-password"
        placeholder="Password (at least 6 characters)"
        style="box-sizing:border-box;width:100%;padding:12px;margin:5px 0;border-radius:8px;border:1px solid #666">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <button id="sq-signin" type="button">Sign in</button>
        <button id="sq-register" type="button">Create account</button>
      </div>
    </div>
    <div id="sq-signed-in" hidden>
      <p id="sq-account-email"></p>
      <button id="sq-sync-now" type="button">Sync now</button>
      <button id="sq-signout" type="button">Sign out</button>
    </div>
    <div id="sq-conflict" hidden style="margin-top:12px;padding:12px;border:1px solid #777;border-radius:10px">
      <p>Cloud data and this device's data are different. Which should be kept?</p>
      <button id="sq-use-cloud" type="button">Use cloud data</button>
      <button id="sq-use-device" type="button">Keep this device's data</button>
    </div>
    <p style="font-size:12px;color:#aab3c5;margin-bottom:0">
      Keep your password private. Cloud backup works after you sign in.
    </p>
  `;

  const style = document.createElement("style");
  style.textContent = `
    #studyquest-cloud-account button {
      padding:10px 12px;border:0;border-radius:8px;
      margin:3px 4px 3px 0;cursor:pointer;font-weight:600
    }
    #studyquest-cloud-account button:disabled { opacity:.5 }
  `;
  document.head.appendChild(style);

  document.body.appendChild(panel);
  return panel;
}

const panel = makePanel();
const $ = id => document.getElementById(id);
const status = message => {
  $("sq-cloud-status").textContent = message;
};

function setBusy(busy) {
  ["sq-signin", "sq-register", "sq-sync-now", "sq-use-cloud", "sq-use-device"]
    .forEach(id => {
      const element = $(id);
      if (element) element.disabled = busy;
    });
}

async function uploadLocal() {
  if (!currentUser || !cloudReady || syncing) return;

  const bundle = localBundle();
  const serialized = bundleString(bundle);
  if (serialized === lastLocalData) return;

  syncing = true;
  try {
    await setDoc(
      doc(db, "users", currentUser.uid),
      {
        studyQuestSync: bundle,
        studyQuestSyncUpdatedAt: new Date().toISOString()
      },
      { merge: true }
    );
    lastLocalData = serialized;
    status("✅ Progress saved to your cloud account.");
  } catch (error) {
    status("Cloud save failed: " + error.message);
  } finally {
    syncing = false;
  }
}

async function downloadCloud() {
  if (!currentUser) return;

  syncing = true;
  cloudReady = false;
  setBusy(true);

  try {
    const reference = doc(db, "users", currentUser.uid);
    const snapshot = await getDoc(reference);
    const cloudBundle = snapshot.exists()
      ? snapshot.data().studyQuestSync
      : null;
    const deviceBundle = localBundle();

    if (!cloudBundle) {
      await setDoc(
        reference,
        {
          studyQuestSync: deviceBundle,
          studyQuestSyncUpdatedAt: new Date().toISOString()
        },
        { merge: true }
      );
      lastLocalData = bundleString(deviceBundle);
      status("✅ First backup created from this device.");
      cloudReady = true;
      return;
    }

    if (bundleString(cloudBundle) === bundleString(deviceBundle)) {
      lastLocalData = bundleString(deviceBundle);
      status("✅ Cloud and device data are up to date.");
      cloudReady = true;
      return;
    }

    $("sq-conflict").hidden = false;
    status("Choose which saved progress you want to keep.");

    $("sq-use-cloud").onclick = () => {
      applyBundle(cloudBundle);
      lastLocalData = bundleString(localBundle());
      $("sq-conflict").hidden = true;
      cloudReady = true;
      status("Cloud data loaded. Refreshing StudyQuest…");
      location.reload();
    };

    $("sq-use-device").onclick = async () => {
      $("sq-conflict").hidden = true;
      cloudReady = true;
      lastLocalData = "";
      await uploadLocal();
    };
  } catch (error) {
    status("Could not load cloud data: " + error.message);
  } finally {
    syncing = false;
    setBusy(false);
  }
}

async function authenticate(createAccount) {
  const email = $("sq-email").value.trim();
  const password = $("sq-password").value;

  if (!email || !password) {
    status("Enter your email address and password.");
    return;
  }

  setBusy(true);
  try {
    if (createAccount) {
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
$("sq-signout").onclick = () => signOut(auth);
$("sq-sync-now").onclick = async () => {
  if (!currentUser) return;
  const snapshot = await getDoc(doc(db, "users", currentUser.uid));
  const cloudBundle = snapshot.exists()
    ? snapshot.data().studyQuestSync
    : null;

  if (cloudBundle && bundleString(cloudBundle) !== bundleString(localBundle())) {
    cloudReady = false;
    $("sq-conflict").hidden = false;
    status("Choose cloud data or this device's data.");
    $("sq-use-cloud").onclick = () => {
      applyBundle(cloudBundle);
      lastLocalData = bundleString(localBundle());
      $("sq-conflict").hidden = true;
      cloudReady = true;
      status("Cloud data loaded. Refreshing StudyQuest…");
      location.reload();
    };
    $("sq-use-device").onclick = async () => {
      $("sq-conflict").hidden = true;
      cloudReady = true;
      lastLocalData = "";
      await uploadLocal();
    };
  } else {
    lastLocalData = "";
    await uploadLocal();
  }
};

onAuthStateChanged(auth, async user => {
  currentUser = user;
  $("sq-auth-fields").hidden = !!user;
  $("sq-signed-in").hidden = !user;

  if (!user) {
    cloudReady = false;
    status("Sign in to back up your progress.");
    return;
  }

  $("sq-account-email").textContent = "Signed in as " + user.email;
  status("Checking your cloud backup…");
  await downloadCloud();
});

setInterval(() => {
  if (!currentUser || !cloudReady || syncing) return;

  if (bundleString(localBundle()) !== lastLocalData) {
    uploadLocal();
  }
}, 5000);
      
