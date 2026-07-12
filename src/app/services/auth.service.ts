import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '../firebase.config';

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly app: FirebaseApp;
  private readonly auth: Auth;
  private readonly provider = new GoogleAuthProvider();
  private readonly userSubject = new BehaviorSubject<AuthUser | null>(null);

  readonly firestore: Firestore;
  readonly user$ = this.userSubject.asObservable();

  constructor(private zone: NgZone) {
    this.app = getApps()[0] ?? initializeApp(firebaseConfig);
    this.auth = getAuth(this.app);
    this.firestore = getFirestore(this.app);

    onAuthStateChanged(this.auth, user => {
      this.zone.run(() => {
        this.userSubject.next(user ? this.toAuthUser(user) : null);
      });
    });
  }

  get currentUser(): AuthUser | null {
    return this.userSubject.value;
  }

  async signInWithGoogle(): Promise<void> {
    const credential = await signInWithPopup(this.auth, this.provider);
    this.zone.run(() => {
      this.userSubject.next(this.toAuthUser(credential.user));
    });
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(this.auth);
  }

  private toAuthUser(user: User): AuthUser {
    return {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL
    };
  }
}
