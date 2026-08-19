import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';

const isLandingPage = window.location.pathname === '/';

const rootComponent = isLandingPage
  ? import('./app/landing-page.component').then(module => module.LandingPageComponent)
  : import('./app/workspace.component').then(module => module.WorkspaceComponent);

rootComponent
  .then(component => bootstrapApplication(component, appConfig))
  .catch((error) => console.error(error));
