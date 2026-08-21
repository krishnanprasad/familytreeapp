import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ShareLinkRecord, SharedTreeLoadStatus } from '../models/tree-node.model';

@Component({
  selector: 'app-invite-landing',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './invite-landing.component.html',
  styleUrls: ['./invite-landing.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InviteLandingComponent {
  @Input() share: ShareLinkRecord | null = null;
  @Input() status: SharedTreeLoadStatus = 'ready';
  @Input() signedIn = false;
  @Input() authReady = false;
  @Input() busy = false;
  @Input() error = '';
  @Output() join = new EventEmitter<void>();
  @Output() leave = new EventEmitter<void>();

  get isAvailable(): boolean {
    return this.status === 'ready' || this.status === 'signInRequired';
  }

  get inviterName(): string {
    return this.share?.inviterName || this.share?.treeOwnerName || 'A family member';
  }

  get branchName(): string {
    return this.share?.branchRootName || this.share?.treeName || 'your family tree';
  }

  get sharedSubject(): string {
    return this.share?.branchRootName ? `${this.share.branchRootName}'s branch` : this.branchName;
  }

  get canEdit(): boolean {
    return this.share?.role === 'branchEditor' || this.share?.role === 'coOwner';
  }

  get title(): string {
    if (!this.isAvailable) return this.unavailableTitle;
    return this.canEdit
      ? `${this.inviterName} invited you to complete ${this.sharedSubject}`
      : `${this.inviterName} shared ${this.sharedSubject} with you`;
  }

  get primaryLabel(): string {
    if (this.busy) return this.signedIn ? 'Joining your branch…' : 'Opening Google…';
    if (!this.authReady) return 'Checking your invitation…';
    if (!this.signedIn) return this.canEdit ? 'Continue with Google & join' : 'Continue with Google';
    return this.canEdit ? 'Join & add relatives' : 'Open family tree';
  }

  get expiryLabel(): string {
    if (!this.share?.expiresAtLabel) return 'Secure, single-use invitation';
    const expires = new Date(this.share.expiresAtLabel);
    if (Number.isNaN(expires.getTime())) return 'Secure, single-use invitation';
    return `Expires ${expires.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }

  get unavailableTitle(): string {
    if (this.status === 'expired') return 'This invitation has expired';
    if (this.status === 'claimed') return 'This invitation has already been accepted';
    if (this.status === 'cancelled') return 'This invitation was cancelled';
    return 'This invitation is not available';
  }

  get unavailableMessage(): string {
    if (this.status === 'expired' || this.status === 'claimed' || this.status === 'cancelled') {
      return 'Ask the family-tree owner to send you a new private invitation.';
    }
    return 'The link may be incomplete. Open the exact link that was shared with you.';
  }
}
