import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LifeEventType,
  TreeNode
} from '../models/tree-node.model';

type RelativeLink = {
  label: string;
  person: TreeNode;
};

type StoryRequest = {
  personId: string;
  title: string;
  text: string;
  date: string;
};

type EventRequest = {
  personId: string;
  type: LifeEventType;
  title: string;
  date: string;
  place: string;
  description: string;
};

@Component({
  selector: 'app-person-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <ng-container *ngIf="person as activePerson">
      <div
        class="profile-backdrop"
        aria-hidden="true"
        (click)="requestClose()">
      </div>

      <aside
        #drawer
        class="profile-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-profile-title"
        tabindex="-1">
        <header class="profile-hero">
          <button
            type="button"
            class="close-button"
            aria-label="Close profile"
            title="Close profile"
            (click)="requestClose()">
            <span aria-hidden="true">&times;</span>
          </button>

          <div class="identity-row">
            <div class="avatar-wrap">
              <div class="avatar" [class.avatar--deceased]="!activePerson.isAlive">
                <img
                  *ngIf="activePerson.photoUrl && !photoLoadFailed; else initialsAvatar"
                  [src]="activePerson.photoUrl"
                  [alt]="'Portrait of ' + activePerson.name"
                  (error)="photoLoadFailed = true" />
                <ng-template #initialsAvatar>
                  <span aria-hidden="true">{{ initials(activePerson.name) }}</span>
                </ng-template>
              </div>

              <label class="photo-upload" title="Choose a new profile photo">
                <input
                  type="file"
                  accept="image/*"
                  aria-label="Choose a new profile photo"
                  (change)="onPhotoSelected($event)" />
                <span>{{ activePerson.photoUrl ? 'Change photo' : 'Add photo' }}</span>
              </label>
            </div>

            <div class="identity-copy">
              <div class="status-line">
                <span class="relationship-pill">{{ relationshipLabel(activePerson) }}</span>
                <span class="status-pill" [class.status-pill--memorial]="!activePerson.isAlive">
                  <span class="status-dot" aria-hidden="true"></span>
                  {{ activePerson.isAlive ? 'Living' : 'In memory' }}
                </span>
              </div>
              <h1 id="person-profile-title">{{ activePerson.name }}</h1>
              <p *ngIf="activePerson.alternateNames?.length" class="alternate-names">
                Also known as {{ activePerson.alternateNames?.join(', ') }}
              </p>
              <p class="life-summary">{{ lifeSummary(activePerson) }}</p>
            </div>
          </div>

          <p *ngIf="photoMessage" class="photo-message" role="status">{{ photoMessage }}</p>

          <div class="quick-actions" aria-label="Profile actions">
            <button type="button" class="action-button action-button--primary" (click)="edit.emit(activePerson)">
              Edit profile
            </button>
            <button type="button" class="action-button" (click)="addChild.emit(activePerson)">
              <span aria-hidden="true">+</span> Add child
            </button>
            <button type="button" class="action-button" (click)="addSpouse.emit(activePerson)">
              <span aria-hidden="true">+</span> Add partner
            </button>
          </div>
        </header>

        <main class="profile-content">
          <section *ngIf="hints.length" class="hint-panel" aria-labelledby="profile-hints-title">
            <div class="section-heading section-heading--compact">
              <div>
                <p class="eyebrow">Suggestions</p>
                <h2 id="profile-hints-title">Complete this story</h2>
              </div>
              <span class="count-badge">{{ hints.length }}</span>
            </div>

            <ul class="hint-list">
              <li *ngFor="let hint of hints">
                <span class="hint-spark" aria-hidden="true">✦</span>
                <span>{{ hint }}</span>
                <button
                  type="button"
                  class="dismiss-button"
                  [attr.aria-label]="'Dismiss suggestion: ' + hint"
                  title="Dismiss suggestion"
                  (click)="dismissHint.emit(hint)">
                  &times;
                </button>
              </li>
            </ul>
          </section>

          <section class="content-section" aria-labelledby="vital-information-title">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Profile</p>
                <h2 id="vital-information-title">Vital information</h2>
              </div>
            </div>

            <dl class="vital-grid">
              <div class="vital-item">
                <dt>Born</dt>
                <dd>{{ activePerson.birthDate ? formatDate(activePerson.birthDate) : 'Not recorded' }}</dd>
              </div>
              <div class="vital-item">
                <dt>Birth place</dt>
                <dd>{{ activePerson.birthPlace || 'Not recorded' }}</dd>
              </div>
              <div class="vital-item" *ngIf="!activePerson.isAlive || activePerson.deathDate">
                <dt>Died</dt>
                <dd>{{ activePerson.deathDate ? formatDate(activePerson.deathDate) : 'Not recorded' }}</dd>
              </div>
              <div class="vital-item">
                <dt>Age</dt>
                <dd>{{ activePerson.age }} {{ activePerson.age === 1 ? 'year' : 'years' }}</dd>
              </div>
              <div class="vital-item">
                <dt>Gender</dt>
                <dd>{{ humanize(activePerson.gender) }}</dd>
              </div>
              <div class="vital-item">
                <dt>Location</dt>
                <dd>{{ activePerson.location || 'Not recorded' }}</dd>
              </div>
              <div class="vital-item vital-item--wide" *ngIf="activePerson.email">
                <dt>Email</dt>
                <dd><a [href]="'mailto:' + activePerson.email">{{ activePerson.email }}</a></dd>
              </div>
            </dl>

            <div class="relationship-card">
              <div>
                <span class="detail-label">Relationship type</span>
                <strong>{{ relationshipLabel(activePerson) }}</strong>
              </div>
              <p *ngIf="activePerson.relationshipStartDate || activePerson.relationshipEndDate">
                <span *ngIf="activePerson.relationshipStartDate">
                  From {{ formatDate(activePerson.relationshipStartDate) }}
                </span>
                <span *ngIf="activePerson.relationshipEndDate">
                  {{ activePerson.relationshipStartDate ? ' · ' : '' }}Until {{ formatDate(activePerson.relationshipEndDate) }}
                </span>
              </p>
            </div>
          </section>

          <section class="content-section" aria-labelledby="about-person-title">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Details</p>
                <h2 id="about-person-title">About {{ firstName(activePerson.name) }}</h2>
              </div>
            </div>

            <div class="notes-card" [class.notes-card--empty]="!activePerson.notes">
              <span class="detail-label">Notes</span>
              <p>{{ activePerson.notes || 'No notes have been added yet.' }}</p>
            </div>

            <div class="tag-block">
              <span class="detail-label">Tags</span>
              <div *ngIf="activePerson.tags?.length; else noTags" class="tag-list" aria-label="Tags">
                <span *ngFor="let tag of activePerson.tags">{{ tag }}</span>
              </div>
              <ng-template #noTags>
                <p class="empty-inline">No tags yet.</p>
              </ng-template>
            </div>
          </section>

          <section class="content-section" aria-labelledby="relatives-title">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Connections</p>
                <h2 id="relatives-title">Immediate family</h2>
              </div>
              <span class="count-badge">{{ relatives.length }}</span>
            </div>

            <div *ngIf="relatives.length; else noRelatives" class="relative-list">
              <button
                *ngFor="let relative of relatives"
                type="button"
                class="relative-row"
                [attr.aria-label]="'Open ' + relative.person.name + ', ' + relative.label"
                (click)="focusPerson.emit(relative.person.id)">
                <span class="relative-avatar" aria-hidden="true">{{ initials(relative.person.name) }}</span>
                <span class="relative-copy">
                  <strong>{{ relative.person.name }}</strong>
                  <small>{{ relative.label }}</small>
                </span>
                <span class="relative-arrow" aria-hidden="true">›</span>
              </button>
            </div>
            <ng-template #noRelatives>
              <div class="empty-state">
                <p>No immediate relatives are linked yet.</p>
                <button type="button" class="text-button" (click)="addChild.emit(activePerson)">Add the first connection</button>
              </div>
            </ng-template>
          </section>

          <section class="content-section" aria-labelledby="stories-title">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Memories</p>
                <h2 id="stories-title">Stories</h2>
              </div>
              <button
                type="button"
                class="section-action"
                [attr.aria-expanded]="showStoryForm"
                aria-controls="new-story-form"
                (click)="toggleStoryForm()">
                {{ showStoryForm ? 'Cancel' : '+ Add story' }}
              </button>
            </div>

            <form
              *ngIf="showStoryForm"
              #storyForm="ngForm"
              id="new-story-form"
              class="inline-form"
              (ngSubmit)="submitStory()">
              <div class="form-row">
                <label class="form-field form-field--grow">
                  <span>Story title</span>
                  <input
                    type="text"
                    name="storyTitle"
                    [(ngModel)]="storyDraft.title"
                    placeholder="A favorite memory"
                    required />
                </label>
                <label class="form-field form-field--date">
                  <span>Date <small>(optional)</small></span>
                  <input type="date" name="storyDate" [(ngModel)]="storyDraft.date" />
                </label>
              </div>
              <label class="form-field">
                <span>Story</span>
                <textarea
                  name="storyText"
                  [(ngModel)]="storyDraft.text"
                  rows="3"
                  placeholder="Write down the details while they are fresh…"
                  required></textarea>
              </label>
              <div class="form-actions">
                <button type="button" class="button-secondary" (click)="cancelStoryForm()">Cancel</button>
                <button type="submit" class="button-primary" [disabled]="storyForm.invalid">Save story</button>
              </div>
            </form>

            <div *ngIf="activePerson.stories?.length; else noStories" class="story-list">
              <article *ngFor="let story of activePerson.stories" class="story-card">
                <div class="card-heading">
                  <h3>{{ story.title }}</h3>
                  <time *ngIf="story.date" [attr.datetime]="story.date">{{ formatDate(story.date) }}</time>
                </div>
                <p>{{ story.text }}</p>
              </article>
            </div>
            <ng-template #noStories>
              <div class="empty-state empty-state--dashed">
                <p>Preserve a memory, tradition, or anecdote about {{ firstName(activePerson.name) }}.</p>
              </div>
            </ng-template>
          </section>

          <section class="content-section" aria-labelledby="events-title">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Timeline</p>
                <h2 id="events-title">Life events</h2>
              </div>
              <button
                type="button"
                class="section-action"
                [attr.aria-expanded]="showEventForm"
                aria-controls="new-event-form"
                (click)="toggleEventForm()">
                {{ showEventForm ? 'Cancel' : '+ Add event' }}
              </button>
            </div>

            <form
              *ngIf="showEventForm"
              #eventForm="ngForm"
              id="new-event-form"
              class="inline-form"
              (ngSubmit)="submitEvent()">
              <div class="form-row">
                <label class="form-field form-field--grow">
                  <span>Event type</span>
                  <select name="eventType" [(ngModel)]="eventDraft.type" required>
                    <option *ngFor="let option of eventTypes" [ngValue]="option.value">{{ option.label }}</option>
                  </select>
                </label>
                <label class="form-field form-field--date">
                  <span>Date</span>
                  <input type="date" name="eventDate" [(ngModel)]="eventDraft.date" required />
                </label>
              </div>
              <label class="form-field">
                <span>Title</span>
                <input
                  type="text"
                  name="eventTitle"
                  [(ngModel)]="eventDraft.title"
                  placeholder="Graduated from university"
                  required />
              </label>
              <label class="form-field">
                <span>Place <small>(optional)</small></span>
                <input
                  type="text"
                  name="eventPlace"
                  [(ngModel)]="eventDraft.place"
                  placeholder="City or place" />
              </label>
              <label class="form-field">
                <span>Description <small>(optional)</small></span>
                <textarea
                  name="eventDescription"
                  [(ngModel)]="eventDraft.description"
                  rows="2"
                  placeholder="Add a little context…"></textarea>
              </label>
              <div class="form-actions">
                <button type="button" class="button-secondary" (click)="cancelEventForm()">Cancel</button>
                <button type="submit" class="button-primary" [disabled]="eventForm.invalid">Save event</button>
              </div>
            </form>

            <ol *ngIf="activePerson.events?.length; else noEvents" class="timeline-list">
              <li *ngFor="let event of activePerson.events">
                <span class="timeline-marker" aria-hidden="true"></span>
                <div class="timeline-card">
                  <div class="card-heading">
                    <div>
                      <span class="event-type">{{ eventTypeLabel(event.type) }}</span>
                      <h3>{{ event.title }}</h3>
                    </div>
                    <time [attr.datetime]="event.date">{{ formatDate(event.date) }}</time>
                  </div>
                  <p *ngIf="event.place" class="event-place">{{ event.place }}</p>
                  <p *ngIf="event.description">{{ event.description }}</p>
                </div>
              </li>
            </ol>
            <ng-template #noEvents>
              <div class="empty-state empty-state--dashed">
                <p>Add milestones to build {{ firstName(activePerson.name) }}’s timeline.</p>
              </div>
            </ng-template>
          </section>
        </main>
      </aside>
    </ng-container>
  `,
  styles: [`
    :host {
      --ink: #17211b;
      --muted: #647168;
      --line: #e2e8e3;
      --surface: #ffffff;
      --surface-soft: #f6f8f5;
      --leaf: #276749;
      --leaf-dark: #1f513b;
      --leaf-soft: #e8f3eb;
      --warm: #a3602d;
      --warm-soft: #fbf1e7;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    button,
    input,
    select,
    textarea {
      font: inherit;
    }

    button {
      cursor: pointer;
    }

    .profile-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1090;
      background: rgb(19 29 23 / 0.38);
      backdrop-filter: blur(2px);
      animation: profile-fade-in 180ms ease-out;
    }

    .profile-drawer {
      position: fixed;
      inset: 0 0 0 auto;
      z-index: 1100;
      width: min(470px, 100vw);
      height: 100vh;
      height: 100dvh;
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      background: var(--surface);
      box-shadow: -20px 0 55px rgb(12 25 17 / 0.18);
      outline: none;
      animation: profile-slide-in 220ms cubic-bezier(0.22, 0.75, 0.3, 1);
    }

    .profile-hero {
      position: relative;
      padding: 30px 28px 24px;
      overflow: hidden;
      background:
        radial-gradient(circle at 96% 0%, rgb(180 218 190 / 0.48), transparent 38%),
        linear-gradient(145deg, #f8fbf7 0%, #eff6ef 100%);
      border-bottom: 1px solid #dce7dd;
    }

    .profile-hero::after {
      content: '';
      position: absolute;
      width: 150px;
      height: 150px;
      right: -87px;
      bottom: -100px;
      border: 1px solid rgb(39 103 73 / 0.14);
      border-radius: 50%;
      box-shadow: 0 0 0 22px rgb(39 103 73 / 0.04), 0 0 0 44px rgb(39 103 73 / 0.03);
      pointer-events: none;
    }

    .close-button {
      position: absolute;
      top: 16px;
      right: 16px;
      z-index: 2;
      display: grid;
      width: 36px;
      height: 36px;
      place-items: center;
      padding: 0;
      color: #33463a;
      font-size: 26px;
      font-weight: 300;
      line-height: 1;
      background: rgb(255 255 255 / 0.76);
      border: 1px solid rgb(54 83 65 / 0.15);
      border-radius: 999px;
      box-shadow: 0 3px 12px rgb(22 50 31 / 0.08);
      transition: background 150ms ease, transform 150ms ease;
    }

    .close-button:hover {
      background: #ffffff;
      transform: rotate(4deg);
    }

    .identity-row {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 20px;
      padding-right: 24px;
    }

    .avatar-wrap {
      flex: 0 0 auto;
      width: 104px;
      text-align: center;
    }

    .avatar {
      display: grid;
      width: 96px;
      height: 96px;
      margin-inline: auto;
      place-items: center;
      overflow: hidden;
      color: #ffffff;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 32px;
      font-weight: 600;
      letter-spacing: 0.04em;
      background: linear-gradient(145deg, #3d7a5c, #214d38);
      border: 4px solid rgb(255 255 255 / 0.94);
      border-radius: 30px;
      box-shadow: 0 10px 25px rgb(35 79 53 / 0.2);
    }

    .avatar--deceased {
      background: linear-gradient(145deg, #77847b, #445047);
      filter: saturate(0.65);
    }

    .avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .photo-upload {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 27px;
      margin-top: -7px;
      padding: 5px 10px;
      color: var(--leaf-dark);
      font-size: 11px;
      font-weight: 750;
      line-height: 1;
      background: #ffffff;
      border: 1px solid #cddbcf;
      border-radius: 999px;
      box-shadow: 0 3px 10px rgb(27 65 42 / 0.1);
      cursor: pointer;
    }

    .photo-upload:hover {
      background: #f9fcf9;
      border-color: #aac2af;
    }

    .photo-upload input {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
      white-space: nowrap;
    }

    .photo-upload:focus-within {
      outline: 3px solid rgb(39 103 73 / 0.22);
      outline-offset: 2px;
    }

    .identity-copy {
      min-width: 0;
      padding-top: 4px;
    }

    .identity-copy h1 {
      margin: 8px 0 3px;
      overflow-wrap: anywhere;
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(27px, 6vw, 34px);
      font-weight: 650;
      line-height: 1.06;
      letter-spacing: -0.025em;
    }

    .status-line {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }

    .relationship-pill,
    .status-pill,
    .count-badge,
    .event-type {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      border-radius: 999px;
    }

    .relationship-pill {
      padding: 4px 8px;
      color: var(--leaf-dark);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      background: rgb(255 255 255 / 0.7);
      border: 1px solid rgb(39 103 73 / 0.18);
    }

    .status-pill {
      gap: 5px;
      padding: 4px 7px;
      color: #2f6346;
      font-size: 10px;
      font-weight: 750;
      background: #e8f4ea;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      background: #39a363;
      border-radius: 50%;
      box-shadow: 0 0 0 3px rgb(57 163 99 / 0.12);
    }

    .status-pill--memorial {
      color: #5f675f;
      background: #ecefed;
    }

    .status-pill--memorial .status-dot {
      background: #899188;
      box-shadow: none;
    }

    .alternate-names,
    .life-summary,
    .photo-message {
      margin: 0;
      color: #607067;
      font-size: 12px;
      line-height: 1.45;
    }

    .alternate-names {
      margin-bottom: 2px;
      font-style: italic;
    }

    .photo-message {
      margin: 10px 0 -4px;
      padding-left: 124px;
      color: var(--leaf-dark);
      overflow-wrap: anywhere;
    }

    .quick-actions {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: 1.25fr 1fr 1fr;
      gap: 8px;
      margin-top: 23px;
    }

    .action-button,
    .section-action,
    .button-primary,
    .button-secondary,
    .text-button {
      font-weight: 750;
      border-radius: 10px;
      transition: border-color 150ms ease, background 150ms ease, color 150ms ease, transform 150ms ease;
    }

    .action-button {
      min-height: 39px;
      padding: 9px 10px;
      color: #31513e;
      font-size: 12px;
      background: rgb(255 255 255 / 0.76);
      border: 1px solid #cbd9cd;
    }

    .action-button:hover {
      background: #ffffff;
      border-color: #9eb8a4;
      transform: translateY(-1px);
    }

    .action-button--primary {
      color: #ffffff;
      background: var(--leaf);
      border-color: var(--leaf);
      box-shadow: 0 5px 12px rgb(39 103 73 / 0.15);
    }

    .action-button--primary:hover {
      background: var(--leaf-dark);
      border-color: var(--leaf-dark);
    }

    .profile-content {
      padding: 9px 28px 40px;
    }

    .content-section,
    .hint-panel {
      padding: 24px 0;
      border-bottom: 1px solid var(--line);
    }

    .content-section:last-child {
      border-bottom: 0;
    }

    .hint-panel {
      margin: 16px 0 0;
      padding: 17px;
      background: linear-gradient(150deg, #fbf5e9, #fffaf1);
      border: 1px solid #eddfc7;
      border-radius: 16px;
    }

    .section-heading {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 15px;
    }

    .section-heading--compact {
      margin-bottom: 10px;
    }

    .section-heading h2 {
      margin: 1px 0 0;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 20px;
      font-weight: 650;
      line-height: 1.2;
      letter-spacing: -0.01em;
    }

    .eyebrow,
    .detail-label {
      margin: 0;
      color: #758278;
      font-size: 10px;
      font-weight: 850;
      letter-spacing: 0.11em;
      text-transform: uppercase;
    }

    .count-badge {
      min-width: 26px;
      min-height: 24px;
      justify-content: center;
      padding: 3px 8px;
      color: #536157;
      font-size: 11px;
      font-weight: 800;
      background: var(--surface-soft);
      border: 1px solid var(--line);
    }

    .hint-list {
      display: grid;
      gap: 7px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .hint-list li {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: start;
      gap: 9px;
      padding: 9px 10px;
      color: #5d4a31;
      font-size: 12px;
      line-height: 1.45;
      background: rgb(255 255 255 / 0.58);
      border-radius: 10px;
    }

    .hint-spark {
      color: #bd7b31;
      font-size: 12px;
    }

    .dismiss-button {
      width: 22px;
      height: 22px;
      margin: -3px -3px 0 0;
      padding: 0;
      color: #8b7962;
      font-size: 18px;
      line-height: 1;
      background: transparent;
      border: 0;
      border-radius: 6px;
    }

    .dismiss-button:hover {
      color: #6d4b25;
      background: #f4e8d3;
    }

    .vital-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1px;
      margin: 0;
      overflow: hidden;
      background: var(--line);
      border: 1px solid var(--line);
      border-radius: 14px;
    }

    .vital-item {
      min-width: 0;
      padding: 13px 14px;
      background: #ffffff;
    }

    .vital-item--wide {
      grid-column: 1 / -1;
    }

    .vital-item dt {
      margin-bottom: 4px;
      color: #7a857d;
      font-size: 10px;
      font-weight: 750;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .vital-item dd {
      margin: 0;
      overflow: hidden;
      color: #27332b;
      font-size: 13px;
      font-weight: 650;
      line-height: 1.35;
      text-overflow: ellipsis;
      overflow-wrap: anywhere;
    }

    .vital-item a {
      color: var(--leaf);
      text-decoration: none;
    }

    .vital-item a:hover {
      text-decoration: underline;
    }

    .relationship-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      margin-top: 10px;
      padding: 12px 14px;
      background: var(--leaf-soft);
      border: 1px solid #d3e5d7;
      border-radius: 12px;
    }

    .relationship-card > div {
      display: grid;
      gap: 3px;
    }

    .relationship-card strong {
      color: #27533b;
      font-size: 13px;
    }

    .relationship-card p {
      margin: 0;
      color: #5d7163;
      font-size: 10px;
      line-height: 1.4;
      text-align: right;
    }

    .notes-card {
      padding: 15px;
      background: #fbfcfb;
      border: 1px solid var(--line);
      border-radius: 13px;
    }

    .notes-card--empty {
      border-style: dashed;
    }

    .notes-card p {
      margin: 7px 0 0;
      color: #404d44;
      font-size: 13px;
      line-height: 1.65;
      white-space: pre-wrap;
    }

    .notes-card--empty p,
    .empty-inline {
      color: #879088;
      font-style: italic;
    }

    .tag-block {
      margin-top: 15px;
    }

    .tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .tag-list span {
      padding: 5px 9px;
      color: #536159;
      font-size: 11px;
      font-weight: 700;
      background: #f2f5f2;
      border: 1px solid #e0e6e1;
      border-radius: 999px;
    }

    .empty-inline {
      margin: 7px 0 0;
      font-size: 12px;
    }

    .relative-list {
      display: grid;
      gap: 7px;
    }

    .relative-row {
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr) auto;
      align-items: center;
      gap: 11px;
      width: 100%;
      padding: 9px 11px;
      color: var(--ink);
      text-align: left;
      background: #ffffff;
      border: 1px solid var(--line);
      border-radius: 12px;
    }

    .relative-row:hover {
      background: #f8faf8;
      border-color: #bdcdbf;
    }

    .relative-avatar {
      display: grid;
      width: 38px;
      height: 38px;
      place-items: center;
      color: #315a42;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 12px;
      font-weight: 700;
      background: var(--leaf-soft);
      border-radius: 11px;
    }

    .relative-copy {
      display: grid;
      min-width: 0;
      gap: 2px;
    }

    .relative-copy strong {
      overflow: hidden;
      font-size: 13px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .relative-copy small {
      color: var(--muted);
      font-size: 11px;
    }

    .relative-arrow {
      color: #8a968d;
      font-size: 22px;
      line-height: 1;
      transition: transform 150ms ease;
    }

    .relative-row:hover .relative-arrow {
      color: var(--leaf);
      transform: translateX(2px);
    }

    .section-action {
      flex: 0 0 auto;
      padding: 7px 9px;
      color: var(--leaf);
      font-size: 11px;
      background: var(--leaf-soft);
      border: 1px solid #cfe2d3;
    }

    .section-action:hover {
      color: #ffffff;
      background: var(--leaf);
      border-color: var(--leaf);
    }

    .inline-form {
      display: grid;
      gap: 11px;
      margin-bottom: 15px;
      padding: 14px;
      background: #f8faf8;
      border: 1px solid #dce5dd;
      border-radius: 14px;
      box-shadow: inset 0 1px #ffffff;
    }

    .form-row {
      display: flex;
      gap: 9px;
    }

    .form-field {
      display: grid;
      min-width: 0;
      gap: 5px;
      color: #526057;
      font-size: 11px;
      font-weight: 750;
    }

    .form-field--grow {
      flex: 1 1 auto;
    }

    .form-field--date {
      flex: 0 0 142px;
    }

    .form-field small {
      color: #8a948d;
      font-size: 9px;
      font-weight: 500;
    }

    .form-field input,
    .form-field select,
    .form-field textarea {
      width: 100%;
      min-height: 38px;
      padding: 9px 10px;
      color: #263229;
      font-size: 12px;
      line-height: 1.35;
      background: #ffffff;
      border: 1px solid #ccd6ce;
      border-radius: 9px;
      outline: none;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }

    .form-field textarea {
      min-height: auto;
      resize: vertical;
    }

    .form-field input:focus,
    .form-field select:focus,
    .form-field textarea:focus {
      border-color: #6f9e7e;
      box-shadow: 0 0 0 3px rgb(39 103 73 / 0.12);
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 7px;
    }

    .button-primary,
    .button-secondary {
      min-height: 34px;
      padding: 7px 12px;
      font-size: 11px;
    }

    .button-primary {
      color: #ffffff;
      background: var(--leaf);
      border: 1px solid var(--leaf);
    }

    .button-primary:hover:not(:disabled) {
      background: var(--leaf-dark);
    }

    .button-primary:disabled {
      cursor: not-allowed;
      opacity: 0.48;
    }

    .button-secondary {
      color: #556158;
      background: #ffffff;
      border: 1px solid #d3dbd5;
    }

    .button-secondary:hover {
      background: #f2f5f2;
    }

    .story-list {
      display: grid;
      gap: 9px;
    }

    .story-card,
    .timeline-card {
      padding: 14px;
      background: #ffffff;
      border: 1px solid var(--line);
      border-radius: 13px;
    }

    .story-card {
      border-left: 3px solid #d8b580;
    }

    .card-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .card-heading h3 {
      margin: 0;
      color: #27332b;
      font-size: 13px;
      font-weight: 800;
      line-height: 1.35;
    }

    .card-heading time {
      flex: 0 0 auto;
      color: #78837b;
      font-size: 10px;
      line-height: 1.45;
      text-align: right;
    }

    .story-card > p,
    .timeline-card > p {
      margin: 8px 0 0;
      color: #566159;
      font-size: 12px;
      line-height: 1.58;
      white-space: pre-wrap;
    }

    .timeline-list {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .timeline-list li {
      position: relative;
      padding: 0 0 11px 20px;
    }

    .timeline-list li::before {
      content: '';
      position: absolute;
      top: 12px;
      bottom: -12px;
      left: 5px;
      width: 1px;
      background: #d8e3da;
    }

    .timeline-list li:last-child {
      padding-bottom: 0;
    }

    .timeline-list li:last-child::before {
      display: none;
    }

    .timeline-marker {
      position: absolute;
      top: 10px;
      left: 0;
      width: 11px;
      height: 11px;
      background: #ffffff;
      border: 3px solid #5d9270;
      border-radius: 50%;
      box-shadow: 0 0 0 3px #eaf2ec;
    }

    .timeline-card {
      background: #fbfcfb;
    }

    .event-type {
      margin-bottom: 4px;
      padding: 3px 6px;
      color: #39704f;
      font-size: 8px;
      font-weight: 850;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: var(--leaf-soft);
    }

    .timeline-card .event-place {
      color: #3f6850;
      font-weight: 700;
    }

    .empty-state {
      padding: 15px;
      color: #7b867e;
      font-size: 12px;
      line-height: 1.5;
      text-align: center;
      background: #fafbfa;
      border: 1px solid var(--line);
      border-radius: 12px;
    }

    .empty-state--dashed {
      border-style: dashed;
    }

    .empty-state p {
      margin: 0;
    }

    .text-button {
      margin-top: 7px;
      padding: 2px;
      color: var(--leaf);
      font-size: 11px;
      background: transparent;
      border: 0;
    }

    .text-button:hover {
      text-decoration: underline;
    }

    button:focus-visible,
    a:focus-visible,
    input:focus-visible,
    select:focus-visible,
    textarea:focus-visible {
      outline: 3px solid rgb(40 112 76 / 0.24);
      outline-offset: 2px;
    }

    @keyframes profile-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes profile-slide-in {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }

    @media (max-width: 560px) {
      .profile-drawer {
        width: 100vw;
      }

      .profile-hero {
        padding: 24px 20px 20px;
      }

      .identity-row {
        gap: 15px;
        padding-right: 24px;
      }

      .avatar-wrap {
        width: 86px;
      }

      .avatar {
        width: 82px;
        height: 82px;
        border-radius: 25px;
        font-size: 27px;
      }

      .identity-copy h1 {
        font-size: 27px;
      }

      .photo-message {
        padding-left: 101px;
      }

      .quick-actions {
        grid-template-columns: 1fr 1fr;
      }

      .action-button--primary {
        grid-column: 1 / -1;
      }

      .profile-content {
        padding: 7px 20px 30px;
      }

      .form-row {
        display: grid;
      }

      .form-field--date {
        width: 100%;
      }
    }

    @media (max-width: 380px) {
      .identity-row {
        align-items: flex-start;
      }

      .status-line {
        padding-right: 12px;
      }

      .vital-grid {
        grid-template-columns: 1fr;
      }

      .vital-item--wide {
        grid-column: auto;
      }

      .relationship-card {
        align-items: flex-start;
        flex-direction: column;
      }

      .relationship-card p {
        text-align: left;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .profile-backdrop,
      .profile-drawer {
        animation: none;
      }

      *,
      *::before,
      *::after {
        scroll-behavior: auto !important;
        transition-duration: 0.01ms !important;
      }
    }
  `]
})
export class PersonProfileComponent implements OnChanges {
  @Input() person: TreeNode | null = null;
  @Input() relatives: RelativeLink[] = [];
  @Input() hints: string[] = [];

  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly edit = new EventEmitter<TreeNode>();
  @Output() readonly addChild = new EventEmitter<TreeNode>();
  @Output() readonly addSpouse = new EventEmitter<TreeNode>();
  @Output() readonly addStory = new EventEmitter<StoryRequest>();
  @Output() readonly addEvent = new EventEmitter<EventRequest>();
  @Output() readonly photoSelected = new EventEmitter<{ personId: string; file: File }>();
  @Output() readonly dismissHint = new EventEmitter<string>();
  @Output() readonly focusPerson = new EventEmitter<string>();

  @ViewChild('drawer') private drawer?: ElementRef<HTMLElement>;

  readonly eventTypes: ReadonlyArray<{ value: LifeEventType; label: string }> = [
    { value: 'birth', label: 'Birth' },
    { value: 'marriage', label: 'Marriage / partnership' },
    { value: 'death', label: 'Death' },
    { value: 'migration', label: 'Migration' },
    { value: 'residence', label: 'Residence' },
    { value: 'education', label: 'Education' },
    { value: 'career', label: 'Career' },
    { value: 'custom', label: 'Other milestone' }
  ];

  showStoryForm = false;
  showEventForm = false;
  photoLoadFailed = false;
  photoMessage = '';

  storyDraft = this.newStoryDraft();
  eventDraft = this.newEventDraft();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['person']) {
      this.photoLoadFailed = false;
      this.photoMessage = '';
      this.resetForms();

      if (this.person) {
        setTimeout(() => this.drawer?.nativeElement.focus());
      }
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.person) {
      this.requestClose();
    }
  }

  requestClose(): void {
    this.resetForms();
    this.close.emit();
  }

  toggleStoryForm(): void {
    this.showStoryForm = !this.showStoryForm;
    if (this.showStoryForm) {
      this.showEventForm = false;
      this.eventDraft = this.newEventDraft();
    } else {
      this.storyDraft = this.newStoryDraft();
    }
  }

  cancelStoryForm(): void {
    this.showStoryForm = false;
    this.storyDraft = this.newStoryDraft();
  }

  submitStory(): void {
    const title = this.storyDraft.title.trim();
    const text = this.storyDraft.text.trim();

    if (!this.person || !title || !text) {
      return;
    }

    this.addStory.emit({
      personId: this.person.id,
      title,
      text,
      date: this.storyDraft.date
    });
    this.cancelStoryForm();
  }

  toggleEventForm(): void {
    this.showEventForm = !this.showEventForm;
    if (this.showEventForm) {
      this.showStoryForm = false;
      this.storyDraft = this.newStoryDraft();
    } else {
      this.eventDraft = this.newEventDraft();
    }
  }

  cancelEventForm(): void {
    this.showEventForm = false;
    this.eventDraft = this.newEventDraft();
  }

  submitEvent(): void {
    const title = this.eventDraft.title.trim();

    if (!this.person || !title || !this.eventDraft.date) {
      return;
    }

    this.addEvent.emit({
      personId: this.person.id,
      type: this.eventDraft.type,
      title,
      date: this.eventDraft.date,
      place: this.eventDraft.place.trim(),
      description: this.eventDraft.description.trim()
    });
    this.cancelEventForm();
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);

    if (!file || !this.person) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.photoMessage = 'Please choose an image file.';
      input.value = '';
      return;
    }

    this.photoMessage = `${file.name} selected`;
    this.photoSelected.emit({ personId: this.person.id, file });
    input.value = '';
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return '?';
    }

    const selected = parts.length === 1 ? [parts[0]] : [parts[0], parts[parts.length - 1]];
    return selected.map(part => part.charAt(0)).join('').toLocaleUpperCase();
  }

  firstName(name: string): string {
    return name.trim().split(/\s+/)[0] || name;
  }

  lifeSummary(person: TreeNode): string {
    const birthYear = this.yearFromDate(person.birthDate);
    const deathYear = this.yearFromDate(person.deathDate);

    if (birthYear || deathYear) {
      return `${birthYear || '?'}–${person.isAlive ? 'present' : deathYear || '?'}`;
    }

    return person.location || `${person.age} ${person.age === 1 ? 'year' : 'years'} old`;
  }

  relationshipLabel(person: TreeNode): string {
    const relationship = person.type === 'spouse'
      ? person.partnerRelationshipType
      : person.parentRelationshipType;

    if (relationship) {
      return this.humanizeRelationship(relationship);
    }

    return person.type === 'spouse' ? 'Spouse / partner' : 'Family member';
  }

  eventTypeLabel(type: LifeEventType): string {
    return this.eventTypes.find(option => option.value === type)?.label || this.humanize(type);
  }

  humanize(value: string): string {
    const words = value.replace(/_/g, ' ');
    return words.charAt(0).toLocaleUpperCase() + words.slice(1);
  }

  formatDate(value: string): string {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const parsed = dateOnly
      ? new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])))
      : new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      ...(dateOnly ? { timeZone: 'UTC' } : {})
    }).format(parsed);
  }

  private humanizeRelationship(value: string): string {
    const labels: Record<string, string> = {
      biological_parent: 'Biological parent',
      adoptive_parent: 'Adoptive parent',
      step_parent: 'Step-parent',
      guardian: 'Guardian',
      unknown_parent: 'Parent',
      spouse: 'Spouse',
      partner: 'Partner',
      former_spouse: 'Former spouse'
    };

    return labels[value] || this.humanize(value);
  }

  private yearFromDate(value?: string): string {
    return value?.match(/^\d{4}/)?.[0] || '';
  }

  private resetForms(): void {
    this.showStoryForm = false;
    this.showEventForm = false;
    this.storyDraft = this.newStoryDraft();
    this.eventDraft = this.newEventDraft();
  }

  private newStoryDraft(): { title: string; text: string; date: string } {
    return { title: '', text: '', date: '' };
  }

  private newEventDraft(): {
    type: LifeEventType;
    title: string;
    date: string;
    place: string;
    description: string;
  } {
    return {
      type: 'custom',
      title: '',
      date: '',
      place: '',
      description: ''
    };
  }
}
