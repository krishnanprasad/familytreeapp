import { Injectable, NgZone } from '@angular/core';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { googleMapsConfig } from '../google-maps.config';

let googleMapsLoaderConfigured = false;

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
  AutocompleteSuggestion?: {
    fetchAutocompleteSuggestions(
      request: GoogleAutocompleteRequest
    ): Promise<{ suggestions: GoogleAutocompleteSuggestion[] }>;
  };
  AutocompleteSessionToken?: new () => unknown;
  AutocompleteService?: new () => GoogleAutocompleteService;
}

interface GoogleAutocompleteRequest {
  input: string;
  language?: string;
  region?: string;
  sessionToken?: unknown;
}

interface GoogleAutocompleteSuggestion {
  placePrediction?: {
    text?: { toString(): string };
  };
}

interface GoogleAutocompleteService {
  getPlacePredictions(request: {
    input: string;
    language?: string;
    region?: string;
  }): Promise<{ predictions: Array<{ description: string }> }>;
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
  private placesLibraryPromise?: Promise<GooglePlacesLibrary>;
  private autocompleteSessionToken: unknown;
  private readonly windowRef = window as GoogleMapsScriptWindow;

  constructor(private zone: NgZone) {
    if (!googleMapsLoaderConfigured) {
      setOptions({
        key: googleMapsConfig.apiKey,
        v: 'weekly',
        language: 'en',
        region: 'IN',
        libraries: ['places'],
        authReferrerPolicy: 'origin'
      });
      googleMapsLoaderConfigured = true;
    }
  }

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

  async getPlaceSuggestions(input: string): Promise<string[]> {
    const query = input.trim();
    if (query.length < 2) return [];
    return Promise.race([
      this.getGooglePlaceSuggestions(query),
      new Promise<string[]>((_, reject) => {
        window.setTimeout(() => reject(new Error('Google Places search timed out.')), 8000);
      })
    ]);
  }

  resetAutocompleteSession(): void {
    this.autocompleteSessionToken = undefined;
  }

  private async getGooglePlaceSuggestions(query: string): Promise<string[]> {

    const placesLibrary = await this.loadPlacesLibrary();
    const AutocompleteSuggestion = placesLibrary.AutocompleteSuggestion;
    if (AutocompleteSuggestion) {
      try {
        if (!this.autocompleteSessionToken && placesLibrary.AutocompleteSessionToken) {
          this.autocompleteSessionToken = new placesLibrary.AutocompleteSessionToken();
        }

        const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          language: 'en',
          region: 'in',
          sessionToken: this.autocompleteSessionToken
        });
        const suggestions = response.suggestions
          .map(suggestion => suggestion.placePrediction?.text?.toString().trim() ?? '')
          .filter(Boolean);
        if (suggestions.length) return Array.from(new Set(suggestions)).slice(0, 5);
      } catch (error) {
        console.warn('Google Places (New) suggestions failed; trying Google Places legacy autocomplete.', error);
      }
    }

    if (!placesLibrary.AutocompleteService) {
      throw new Error('Google Places autocomplete is unavailable. Enable Places API (New) or Places API.');
    }
    const legacyResponse = await new placesLibrary.AutocompleteService().getPlacePredictions({
      input: query,
      language: 'en',
      region: 'in'
    });
    return Array.from(new Set(legacyResponse.predictions.map(prediction => prediction.description.trim()).filter(Boolean))).slice(0, 5);
  }

  private async loadPlacesLibrary(): Promise<GooglePlacesLibrary> {
    if (!this.placesLibraryPromise) {
      this.placesLibraryPromise = importLibrary('places')
        .then(library => library as unknown as GooglePlacesLibrary)
        .catch(error => {
          this.placesLibraryPromise = undefined;
          throw new Error(`Google Places failed to load. Check the Maps JavaScript API, Places API (New), billing, and API key referrer restrictions. ${String(error)}`);
        });
    }
    return this.placesLibraryPromise;
  }

  private removeListener(listener: GoogleMapsListener): void {
    if (listener.remove) {
      listener.remove();
      return;
    }

    this.windowRef.google?.maps?.event?.removeListener(listener);
  }
}
