import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

// Firebase's web config is public client data, not a secret — access is
// controlled by Firebase Security Rules, not by hiding this object. Scoped
// to the beta project (shiftandsaveapp) only; see HANDOFF.md.
const firebaseConfig = {
  apiKey: 'AIzaSyC8xuIfrNdoPXGRY9K8QaruDabh0d7l7gI',
  authDomain: 'shiftandsaveapp.firebaseapp.com',
  projectId: 'shiftandsaveapp',
  storageBucket: 'shiftandsaveapp.firebasestorage.app',
  messagingSenderId: '761386319734',
  appId: '1:761386319734:web:b4e801ceaf089c41cb0457',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
