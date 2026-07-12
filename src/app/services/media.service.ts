import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly maxPhotoSize = 5 * 1024 * 1024;

  constructor(private authService: AuthService) {}

  async uploadPersonPhoto(personId: string, file: File): Promise<string> {
    if (!file.type.startsWith('image/')) {
      throw new Error('Please choose an image file.');
    }
    if (file.size > this.maxPhotoSize) {
      throw new Error('Photos must be 5 MB or smaller.');
    }

    const user = this.authService.currentUser;
    if (!user) return this.readAsDataUrl(file);

    const { getDownloadURL, getStorage, ref, uploadBytes } = await import('firebase/storage');
    const extension = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
    const storageRef = ref(
      getStorage(),
      `users/${user.uid}/trees/default/people/${personId}/profile-${Date.now()}.${extension}`
    );
    await uploadBytes(storageRef, file, { contentType: file.type });
    return getDownloadURL(storageRef);
  }

  private readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not read that photo.'));
      reader.readAsDataURL(file);
    });
  }
}
