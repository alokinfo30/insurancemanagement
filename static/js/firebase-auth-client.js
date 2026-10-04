// Client-side Firebase Auth Module
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// Retrieve config from server or global config
let config = window.FIREBASE_CONFIG;

if (!config) {
  try {
    const res = await fetch('/api/firebase-config');
    config = await res.json();
  } catch (e) {
    console.warn('Could not load /api/firebase-config', e);
  }
}

let app, auth, googleProvider;
if (config && config.apiKey) {
  app = initializeApp(config);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
}

export { auth, googleProvider };

// Unified Firebase Google Sign-In for Admin or Customer
export async function handleFirebaseGoogleLogin(expectedRole = 'CUSTOMER') {
  if (!auth) {
    alert('Firebase configuration is not initialized.');
    return;
  }
  const btn = document.getElementById('googleSignInBtn');
  const originalText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Authenticating with Firebase...';
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const token = await user.getIdToken();

    // Verify and establish session on backend
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
    } else {
      alert('Authentication failed: ' + (data.message || 'Unknown error'));
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  } catch (error) {
    console.error('Firebase Auth error:', error);
    alert('Firebase Sign-In Error: ' + error.message);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

// Attach listener to buttons if present on page
window.addEventListener('DOMContentLoaded', () => {
  const googleBtn = document.getElementById('googleSignInBtn');
  if (googleBtn) {
    const role = googleBtn.getAttribute('data-role') || 'CUSTOMER';
    googleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleFirebaseGoogleLogin(role);
    });
  }
});
