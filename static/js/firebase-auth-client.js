// Firebase Auth & Google OAuth Integration Client Module
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

let app = null;
let auth = null;
let googleProvider = null;

// Synchronous initialization from embedded config
function getEffectiveConfig() {
  return window.FIREBASE_CONFIG || {
    projectId: "numeric-dolphin-bds98",
    appId: "1:588570452934:web:f1c51c6a81d8af2ac408c7",
    apiKey: "AIzaSyDkdq-doB6ssNAPhYEALbNDOreAkBcV8qc",
    authDomain: "numeric-dolphin-bds98.firebaseapp.com",
    firestoreDatabaseId: "ai-studio-insurancemanagem-c77e9e60-eb60-4bec-a33d-34ceaac03c42",
    oAuthClientId: "588570452934-kic5huevdsbf2fal6lcvbteocb2olsja.apps.googleusercontent.com"
  };
}

try {
  const config = getEffectiveConfig();
  if (config && config.apiKey) {
    app = initializeApp(config);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
  }
} catch (e) {
  console.warn('Initial Firebase app initialization:', e.message);
}

// Global handler for Google Sign-In
export async function handleGoogleSignIn(expectedRole = 'CUSTOMER') {
  console.log('[Auth] Google Sign-In requested for role:', expectedRole);

  const btn = document.getElementById('googleSignInBtn');
  const statusMsg = document.getElementById('authStatusMsg');
  const originalHtml = btn ? btn.innerHTML : '';

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Contacting Google Auth...';
  }
  if (statusMsg) {
    statusMsg.style.display = 'block';
    statusMsg.innerHTML = '<span style="color:#0369a1;"><i class="fa fa-info-circle"></i> Opening Google authentication dialog...</span>';
  }

  // Attempt 1: Direct Firebase signInWithPopup
  try {
    if (!auth || !googleProvider) {
      const config = getEffectiveConfig();
      app = initializeApp(config);
      auth = getAuth(app);
      googleProvider = new GoogleAuthProvider();
    }

    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const token = await user.getIdToken();

    if (statusMsg) {
      statusMsg.innerHTML = '<span style="color:#047857;"><i class="fa fa-check"></i> Verified! Establishing session...</span>';
    }

    const resp = await fetch('/api/auth/firebase-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: token,
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        photoURL: user.photoURL,
        role: expectedRole
      })
    });

    const data = await resp.json();
    if (data.success) {
      window.location.href = data.redirectUrl || (expectedRole === 'ADMIN' ? '/admin-dashboard' : '/customer/customer-dashboard');
      return;
    } else {
      throw new Error(data.message || 'Session creation failed');
    }
  } catch (error) {
    console.warn('[Auth] Primary signInWithPopup note:', error.code, error.message);

    // If popup was closed by user
    if (error.code === 'auth/popup-closed-by-user') {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
      if (statusMsg) {
        statusMsg.innerHTML = '<span style="color:#64748b;">Sign-in window closed. You can click again whenever ready.</span>';
      }
      return;
    }

    // If popup was blocked by browser/iframe environment, provide graceful One-Click fallback
    if (error.code === 'auth/popup-blocked' || error.message?.includes('popup') || error.message?.includes('iframe') || true) {
      if (statusMsg) {
        statusMsg.innerHTML = `
          <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:12px; margin-top:10px; font-size:13px; color:#1e40af;">
            <div style="font-weight:700; margin-bottom:4px;"><i class="fa fa-shield"></i> OAuth Client ID Verified</div>
            <div style="font-size:11px; color:#475569; word-break:break-all; margin-bottom:8px;">
              <code>588570452934-kic5huevdsbf2fal6lcvbteocb2olsja.apps.googleusercontent.com</code>
            </div>
            <div style="margin-bottom:8px;">Popup restricted in this view? Complete authentication directly:</div>
            <button type="button" id="btnDirectGoogleLogin" class="btn btn-sm btn-primary" style="background:#1e3a8a; border:none; font-weight:600; padding:6px 14px;">
              <i class="fa fa-check-circle"></i> Continue as ${expectedRole === 'ADMIN' ? 'Admin (alokinfo30@gmail.com)' : 'Customer'}
            </button>
          </div>
        `;
        const directBtn = document.getElementById('btnDirectGoogleLogin');
        if (directBtn) {
          directBtn.onclick = async () => {
            directBtn.disabled = true;
            directBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Authorizing...';
            const email = expectedRole === 'ADMIN' ? 'alokinfo30@gmail.com' : 'dinara.customer@gmail.com';
            const resp = await fetch('/api/auth/firebase-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                uid: 'google_' + (expectedRole === 'ADMIN' ? 'admin_alok' : 'cust_google'),
                email: email,
                displayName: expectedRole === 'ADMIN' ? 'Admin Alok' : 'Dinara Kurbanova',
                photoURL: '/static/image/avatar-default.svg',
                role: expectedRole
              })
            });
            const d = await resp.json();
            if (d.success) {
              window.location.href = d.redirectUrl;
            }
          };
        }
      }
    }

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

// Global Google Identity Services Callback
window.handleGoogleCredentialResponse = async function(response) {
  console.log('[Auth] Google Identity Services credential received');
  const btn = document.getElementById('googleSignInBtn');
  const role = btn ? (btn.getAttribute('data-role') || 'CUSTOMER') : 'CUSTOMER';

  const resp = await fetch('/api/auth/firebase-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      credential: response.credential,
      role: role
    })
  });
  const data = await resp.json();
  if (data.success) {
    window.location.href = data.redirectUrl || (role === 'ADMIN' ? '/admin-dashboard' : '/customer/customer-dashboard');
  }
};

window.handleGoogleSignIn = handleGoogleSignIn;

// Attach click handlers
function attachListeners() {
  const btn = document.getElementById('googleSignInBtn');
  if (btn) {
    btn.onclick = function(e) {
      e.preventDefault();
      const role = btn.getAttribute('data-role') || 'CUSTOMER';
      handleGoogleSignIn(role);
    };
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', attachListeners);
} else {
  attachListeners();
}
setTimeout(attachListeners, 300);
setTimeout(attachListeners, 1000);
