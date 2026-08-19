import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  GoogleAuthProvider,
  User,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { Functions, getFunctions } from 'firebase/functions';
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
  private readonly authReadySubject = new BehaviorSubject<boolean>(false);
  private authStateChecked = false;
  private redirectResultChecked = false;

  readonly firestore: Firestore;
  readonly functions: Functions;
  readonly user$ = this.userSubject.asObservable();
  readonly authReady$ = this.authReadySubject.asObservable();

  constructor(private zone: NgZone) {
    this.app = getApps()[0] ?? initializeApp(firebaseConfig);
    this.auth = getAuth(this.app);
    this.firestore = getFirestore(this.app);
    this.functions = getFunctions(this.app, 'us-central1');

    onAuthStateChanged(this.auth, user => {
      this.zone.run(() => {
        this.userSubject.next(user ? this.toAuthUser(user) : null);
        this.authStateChecked = true;
        this.markAuthReadyIfComplete();
      });
    });

    const finishRedirectCheck = (): void => {
      if (this.redirectResultChecked) return;
      this.zone.run(() => {
        this.redirectResultChecked = true;
        this.markAuthReadyIfComplete();
      });
    };
    const redirectCheckTimeout = setTimeout(finishRedirectCheck, 8000);

    void getRedirectResult(this.auth)
      .then(result => {
        if (!result?.user) return;
        this.zone.run(() => {
          this.userSubject.next(this.toAuthUser(result.user));
        });
      })
      .catch(error => console.error('Google redirect sign-in failed:', error))
      .finally(() => {
        clearTimeout(redirectCheckTimeout);
        finishRedirectCheck();
      });
  }

  get currentUser(): AuthUser | null {
    return this.userSubject.value;
  }

  get shouldUseRedirectSignIn(): boolean {
    if (typeof window === 'undefined') return false;
    const routedInvite = /^\/i\//i.test(window.location.pathname);
    const inAppBrowser = /FBAN|FBAV|Instagram|WhatsApp/i.test(window.navigator.userAgent);
    return routedInvite || inAppBrowser || window.location.hostname === firebaseConfig.authDomain;
  }

  async signInWithGooglePopup(): Promise<AuthUser> {
    const result = await signInWithPopup(this.auth, this.provider);
    const user = this.toAuthUser(result.user);
    this.zone.run(() => this.userSubject.next(user));
    return user;
  }

  async signInWithGoogleRedirect(): Promise<void> {
    await signInWithRedirect(this.auth, this.provider);
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

  private markAuthReadyIfComplete(): void {
    if (this.authStateChecked && this.redirectResultChecked) {
      this.authReadySubject.next(true);
    }
  }
}
