import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCTnyJtJeJWSMeSSrTfVIUiYThTzkPPqgk',
  authDomain: 'math-laureate.firebaseapp.com',
  projectId: 'math-laureate',
  storageBucket: 'math-laureate.firebasestorage.app',
  messagingSenderId: '573299257405',
  appId: '1:573299257405:web:d4efd5ecf23073e3d6fa54',
  measurementId: 'G-MR6S1S1FC8',
}

const app = initializeApp(firebaseConfig)

if (typeof window !== 'undefined') {
  getAnalytics(app)
}

export const auth = getAuth(app)
export const db = getFirestore(app)
