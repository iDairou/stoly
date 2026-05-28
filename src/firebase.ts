import { initializeApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';
import { firebaseConfig } from './firebase-config';

const configured = Object.values(firebaseConfig).every(
  (v) => v && !String(v).startsWith('WKLEJ'),
);

let db: Database | null = null;

if (configured) {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
}

export { db };
export const firebaseEnabled = configured;
