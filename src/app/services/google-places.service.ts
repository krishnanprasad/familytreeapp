import { Injectable, NgZone } from '@angular/core';
import { googleMapsConfig } from '../google-maps.config';

type GoogleMapsScriptWindow = Window & {
  google?: {
    maps?: {
      event?: {
        removeListener(listener: GoogleMapsListener): void;
      };
      importLibrary?: (libraryName: 'places') => Promise<GooglePlacesLibrary>;
      places?: {
        Autocomplete: new (
          input: HTMLInputElement,
          options?: GooglePlacesAutocompleteOptions
        ) => GooglePlacesAutocomplete;
      };
    };
  };
};

interface GooglePlacesLibrary {
  Autocomplete?: new (
    input: HTMLInputElement,
    options?: GooglePlacesAutocompleteOptions
  ) => GooglePlacesAutocomplete;
}

interface GoogleMapsListener {
  remove?: () => void;
}

interface GooglePlacesAutocompleteOptions {
  fields?: string[];
}

interface GooglePlaceResult {
  formatted_address?: string;
  name?: string;
}

interface GooglePlacesAutocomplete {
  addListener(eventName: 'place_changed', handler: () => void): GoogleMapsListener;
  getPlace(): GooglePlaceResult;
}

@Injectable({
  providedIn: 'root'
})
export class GooglePlacesService {
  private loadPromise: Promise<GooglePlacesLibrary> | null = null;
  private readonly windowRef = window as GoogleMapsScriptWindow;

  constructor(private zone: NgZone) {}

  async attachAutocomplete(
    input: HTMLInputElement,
    onPlaceSelected: (location: string) => void
  ): Promise<() => void> {
    const placesLibrary = await this.loadPlacesLibrary();
    const Autocomplete = placesLibrary.Autocomplete ?? this.windowRef.google?.maps?.places?.Autocomplete;

    if (!Autocomplete) {
      throw new Error('Google Places Autocomplete is unavailable. Check that Places API is enabled and allowed by this API key.');
    }

    const autocomplete = new Autocomplete(input, {
      fields: ['formatted_address', 'name']
    });

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const location = place.formatted_address || place.name || input.value;

      this.zone.run(() => {
        onPlaceSelected(location);
      });
    });

    return () => this.removeListener(listener);
  }

  private async loadPlacesLibrary(): Promise<GooglePlacesLibrary> {
    if (this.windowRef.google?.maps?.importLibrary) {
      return this.windowRef.google.maps.importLibrary('places');
    }

    if (this.windowRef.google?.maps?.places?.Autocomplete) {
      return { Autocomplete: this.windowRef.google.maps.places.Autocomplete };
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = new Promise((resolve, reject) => {
      const callbackName = '__familyTreeGoogleMapsReady';
      const globalCallbacks = this.windowRef as unknown as Record<string, () => void>;
      const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-maps]');

      globalCallbacks[callbackName] = () => {
        delete globalCallbacks[callbackName];
        const importLibrary = this.windowRef.google?.maps?.importLibrary;

        if (!importLibrary) {
          reject(new Error('Google Maps loaded without importLibrary support.'));
          return;
        }

        importLibrary('places')
          .then(resolve)
          .catch(error => {
            reject(new Error(`Google Places failed to load. Check Maps JavaScript API, Places API, and API key restrictions. ${String(error)}`));
          });
      };

      if (existingScript) {
        if (this.windowRef.google?.maps?.importLibrary) {
          globalCallbacks[callbackName]();
        } else {
          existingScript.addEventListener('load', globalCallbacks[callbackName], { once: true });
        }
        existingScript.addEventListener('error', () => reject(new Error('Google Maps failed to load.')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsConfig.apiKey)}&v=weekly&loading=async&callback=${callbackName}`;
      script.async = true;
      script.defer = true;
      script.dataset['googleMaps'] = 'true';
      script.addEventListener('error', () => reject(new Error('Google Maps failed to load.')), { once: true });

      document.head.appendChild(script);
    });

    return this.loadPromise;
  }

  private removeListener(listener: GoogleMapsListener): void {
    if (listener.remove) {
      listener.remove();
      return;
    }

    this.windowRef.google?.maps?.event?.removeListener(listener);
  }
}
