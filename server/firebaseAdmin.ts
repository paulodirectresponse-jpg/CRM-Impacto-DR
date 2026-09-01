import { getApps, initializeApp, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import firebaseConfig from "../firebase-applet-config.json";

const app = !getApps().length
  ? initializeApp({
      projectId: firebaseConfig.projectId,
    })
  : getApp();

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export { app };
