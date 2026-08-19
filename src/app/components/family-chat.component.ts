import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  AiApplyResult,
  AiChatContextMessage,
  AiFamilyOperation,
  AiFamilyPlan,
  AiFamilyTask
} from '../models/ai-family.model';
import { AiFamilyService } from '../services/ai-family.service';
import { TreeService } from '../services/tree.service';

type FamilyChatMessage = AiChatContextMessage;

interface BrowserSpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  readonly [index: number]: { transcript: string };
}

interface BrowserSpeechRecognitionEvent {
  readonly results: ArrayLike<BrowserSpeechRecognitionResult>;
}

interface BrowserSpeechRecognitionErrorEvent {
  readonly error: string;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

@Component({
  selector: 'app-family-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './family-chat.component.html',
  styleUrls: ['./family-chat.component.scss']
})
export class FamilyChatComponent implements OnChanges, OnDestroy {
  @Input() open = false;
  @Input() isSignedIn = false;
  @Input() userId = '';
  @Input() treeId = '';
  @Input() canEdit = false;
  @Input() selectedPersonId: string | null = null;
  @Output() signInRequested = new EventEmitter<void>();
  @Output() applied = new EventEmitter<AiApplyResult>();
  @Output() openChange = new EventEmitter<boolean>();
  @ViewChild('messageList') messageList?: ElementRef<HTMLDivElement>;

  get examples(): string[] {
    const people = this.treeService.getPersonIndex().map(entry => entry.node);
    if (!people.length) return [];
    const first = people[0];
    const second = people[1] ?? first;
    const third = people[2] ?? second;
    return [
      `Change ${first.name}'s location`,
      `Add a new relative connected to ${second.name}`,
      `Update ${third.name}'s birth date`
    ];
  }

  busy = false;
  applying = false;
  historyLoading = false;
  draft = '';
  errorMessage = '';
  historyWarning = '';
  voiceMessage = '';
  voiceListening = false;
  lastFailedCommand = '';
  activeTask: AiFamilyTask | null = null;
  pendingPlan: AiFamilyPlan | null = null;
  messages: FamilyChatMessage[] = [];
  private historyLoadVersion = 0;
  private speechRecognition: BrowserSpeechRecognition | null = null;
  private voiceDraftBeforeListening = '';

  constructor(
    private readonly aiFamilyService: AiFamilyService,
    private readonly treeService: TreeService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['userId'] || changes['treeId'] || changes['isSignedIn']) {
      this.stopVoiceInput(true);
      void this.loadTreeConversation();
    }
  }

  ngOnDestroy(): void {
    this.stopVoiceInput(true);
  }

  toggle(): void {
    this.setOpen(!this.open);
    if (this.open) this.scrollToLatest();
  }

  close(): void {
    this.stopVoiceInput(false);
    this.setOpen(false);
  }

  show(): void {
    this.setOpen(true);
    this.scrollToLatest();
  }

  useExample(example: string): void {
    this.draft = example;
    void this.submit();
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    void this.submit();
  }

  toggleVoiceInput(): void {
    if (this.voiceListening) {
      this.stopVoiceInput(false);
      return;
    }
    this.startVoiceInput();
  }

  retryLastRequest(): void {
    if (!this.lastFailedCommand || this.busy || this.applying || this.historyLoading) return;
    this.draft = this.lastFailedCommand;
    this.errorMessage = '';
    void this.submit();
  }

  async submit(): Promise<void> {
    const command = this.draft.trim();
    if (!command || this.busy || this.applying || this.historyLoading) return;
    this.stopVoiceInput(false);
    this.errorMessage = '';
    this.voiceMessage = '';

    if (!this.isSignedIn) {
      this.errorMessage = 'Sign in to use the family assistant.';
      return;
    }
    if (!this.canEdit) {
      this.errorMessage = 'This tree is view-only, so the assistant cannot change it.';
      return;
    }

    if (this.activeTask && this.isTaskCancellation(command)) {
      await this.cancelActiveTask(command);
      return;
    }

    if (this.pendingPlan && this.isPlanConfirmation(command)) {
      const requestScope = this.historyScope();
      const confirmationMessage: FamilyChatMessage = {
        role: 'user',
        text: command,
        context: this.pendingPlan.intent === 'add' ? 'create' : 'general'
      };
      this.messages.push(confirmationMessage);
      this.draft = '';
      await this.persistMessage(this.treeId, confirmationMessage);
      if (requestScope === this.historyScope()) this.applyPlan();
      return;
    }

    const requestTreeId = this.treeId;
    const requestScope = this.historyScope();
    const treeSnapshot = this.treeService.getTree();
    const selectedPersonId = this.selectedPersonId;
    const userMessage: FamilyChatMessage = {
      role: 'user',
      text: command,
      context: this.activeTask?.intent === 'add' ? 'create' : 'general'
    };
    this.messages.push(userMessage);
    const conversation = this.messages.slice(0, -1);
    this.draft = '';
    this.pendingPlan = null;
    this.busy = true;
    this.scrollToLatest();

    try {
      await this.persistMessage(requestTreeId, userMessage);
      const plan = await this.aiFamilyService.createPlan(
        command,
        treeSnapshot,
        selectedPersonId,
        conversation
      );
      let assistantMessage: FamilyChatMessage;
      if (plan.needsClarification) {
        const question = plan.clarificationQuestions?.find(Boolean)
          || plan.clarificationQuestion
          || 'Which family member did you mean?';
        assistantMessage = {
          role: 'assistant',
          context: plan.intent === 'add' ? 'create' : 'general',
          text: question,
          task: this.taskFromPlan(plan, 'active', question)
        };
      } else if (!plan.operations.length) {
        assistantMessage = {
          role: 'assistant',
          context: plan.intent === 'add' ? 'create' : 'general',
          text: plan.message || 'I could not find a change to make.'
        };
      } else {
        assistantMessage = {
          role: 'assistant',
          context: plan.intent === 'add' ? 'create' : 'general',
          text: plan.message,
          task: this.taskFromPlan(plan, 'ready', '')
        };
      }
      await this.persistMessage(requestTreeId, assistantMessage);
      if (requestScope !== this.historyScope()) return;
      this.messages.push(assistantMessage);
      this.pendingPlan = plan.operations.length ? plan : null;
      this.activeTask = assistantMessage.task ?? null;
      this.lastFailedCommand = '';
    } catch (error) {
      console.error('Family assistant failed:', error);
      if (requestScope === this.historyScope()) {
        this.lastFailedCommand = command;
        this.errorMessage = this.readableError(error);
      }
    } finally {
      if (requestScope === this.historyScope()) {
        this.busy = false;
        this.scrollToLatest();
      }
    }
  }

  applyPlan(): void {
    const plan = this.pendingPlan;
    if (!plan || this.applying) return;

    this.applying = true;
    this.errorMessage = '';
    try {
      const result = this.treeService.applyAiOperations(plan.operations);
      const completedTask = this.activeTask
        ? { ...this.activeTask, status: 'completed' as const, nextQuestion: '' }
        : undefined;
      const message: FamilyChatMessage = {
        role: 'assistant',
        context: 'general',
        text: `${result.summary}. The change is saved and can be undone from the toolbar.`,
        task: completedTask
      };
      this.messages.push(message);
      void this.persistMessage(this.treeId, message);
      this.pendingPlan = null;
      this.activeTask = null;
      this.applied.emit(result);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'The proposed changes could not be applied.';
    } finally {
      this.applying = false;
      this.scrollToLatest();
    }
  }

  discardPlan(): void {
    const cancelledTask = this.activeTask
      ? { ...this.activeTask, status: 'cancelled' as const, nextQuestion: '' }
      : undefined;
    this.pendingPlan = null;
    this.activeTask = null;
    const message: FamilyChatMessage = {
      role: 'assistant',
      context: 'general',
      text: 'Okay, I did not change the tree.',
      task: cancelledTask
    };
    this.messages.push(message);
    void this.persistMessage(this.treeId, message);
    this.scrollToLatest();
  }

  operationIcon(operation: AiFamilyOperation): string {
    if (operation.type === 'add') return 'plus';
    return 'pencil';
  }

  trackMessage(index: number): number {
    return index;
  }

  trackOperation(index: number): number {
    return index;
  }

  private readableError(error: unknown): string {
    const message = error instanceof Error ? error.message : '';
    const code = typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
    const detail = `${code} ${message}`;
    if (/unauthenticated/i.test(detail)) return 'Your sign-in expired. Sign in again, then retry this request.';
    if (/permission-denied/i.test(detail)) return 'You do not have permission to change this tree.';
    if (/resource-exhausted|too many/i.test(detail)) return 'Too many requests. Wait a minute, then retry.';
    if (/deadline|timeout/i.test(detail)) return 'The Family Helper took too long. Check your connection and retry.';
    if (/unavailable|network|offline|failed to fetch/i.test(detail)) {
      return 'The Family Helper cannot connect right now. Check your internet connection and retry.';
    }
    if (/failed-precondition|not configured/i.test(detail)) {
      return 'The family assistant is not configured on the server yet.';
    }
    if (/invalid-argument/i.test(detail)) return 'That request could not be understood safely. Rephrase it with the person’s exact name.';
    return 'The Family Helper could not process that request. Nothing was changed; please retry.';
  }

  private async loadTreeConversation(): Promise<void> {
    const version = ++this.historyLoadVersion;
    const scope = this.historyScope();
    this.messages = [];
    this.pendingPlan = null;
    this.activeTask = null;
    this.draft = '';
    this.errorMessage = '';
    this.historyWarning = '';
    this.busy = false;

    if (!this.isSignedIn || !this.userId || !this.treeId) {
      this.historyLoading = false;
      return;
    }

    this.historyLoading = true;
    try {
      const messages = await this.aiFamilyService.loadConversation(this.treeId);
      if (version !== this.historyLoadVersion || scope !== this.historyScope()) return;
      this.messages = messages;
      const latestTask = [...messages].reverse().find(message => !!message.task)?.task;
      this.activeTask = latestTask && ['active', 'ready'].includes(latestTask.status)
        ? latestTask.status === 'ready'
          ? {
              ...latestTask,
              status: 'active',
              nextQuestion: 'Say “review” and I’ll safely prepare this change again.'
            }
          : latestTask
        : null;
      this.scrollToLatest();
    } catch (error) {
      console.error('Could not load AI history:', error);
      if (version === this.historyLoadVersion && scope === this.historyScope()) {
        this.errorMessage = 'Could not load this tree\'s saved AI history.';
      }
    } finally {
      if (version === this.historyLoadVersion && scope === this.historyScope()) {
        this.historyLoading = false;
      }
    }
  }

  private async persistMessage(treeId: string, message: FamilyChatMessage): Promise<void> {
    try {
      await this.aiFamilyService.saveMessage(treeId, message);
      this.historyWarning = '';
    } catch (error) {
      console.error('Could not save AI history:', error);
      this.historyWarning = 'This message could not be saved to the tree’s private chat history.';
    }
  }

  private historyScope(): string {
    return `${this.userId}:${this.treeId}`;
  }

  private setOpen(value: boolean): void {
    if (this.open === value) return;
    this.open = value;
    this.openChange.emit(value);
  }

  private taskFromPlan(
    plan: AiFamilyPlan,
    status: AiFamilyTask['status'],
    nextQuestion: string
  ): AiFamilyTask | undefined {
    if (plan.intent !== 'add' && plan.intent !== 'update') return undefined;
    const planTask = plan.task;
    return {
      intent: plan.intent,
      status,
      title: planTask?.title?.trim().slice(0, 120)
        || (plan.intent === 'add' ? 'Add a family member' : 'Update family details'),
      summary: planTask?.summary?.trim().slice(0, 500)
        || plan.message.trim().slice(0, 500)
        || (plan.intent === 'add' ? 'Collecting details for a new family member.' : 'Collecting the requested update.'),
      knownDetails: (planTask?.knownDetails ?? [])
        .filter(detail => typeof detail === 'string')
        .map(detail => detail.trim().slice(0, 180))
        .filter(Boolean)
        .slice(0, 8),
      nextQuestion: nextQuestion.trim().slice(0, 300)
    };
  }

  private async cancelActiveTask(command: string): Promise<void> {
    const requestScope = this.historyScope();
    const task = this.activeTask;
    if (!task) return;
    const userMessage: FamilyChatMessage = {
      role: 'user',
      text: command,
      context: task.intent === 'add' ? 'create' : 'general'
    };
    this.messages.push(userMessage);
    this.draft = '';
    await this.persistMessage(this.treeId, userMessage);
    if (requestScope !== this.historyScope()) return;

    const assistantMessage: FamilyChatMessage = {
      role: 'assistant',
      text: 'Okay, I cancelled this request. Nothing was changed.',
      context: 'general',
      task: { ...task, status: 'cancelled', nextQuestion: '' }
    };
    this.messages.push(assistantMessage);
    this.pendingPlan = null;
    this.activeTask = null;
    await this.persistMessage(this.treeId, assistantMessage);
    this.scrollToLatest();
  }

  private isTaskCancellation(command: string): boolean {
    const normalized = command.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .trim()
      .replace(/\s+/g, ' ');
    return new Set([
      'no',
      'no thanks',
      'cancel',
      'cancel it',
      'stop',
      'stop this',
      'discard',
      'never mind',
      'nevermind'
    ]).has(normalized);
  }

  private startVoiceInput(): void {
    this.voiceMessage = '';
    const Recognition = this.speechRecognitionConstructor();
    if (!Recognition) {
      this.voiceMessage = 'Voice input is not supported in this browser. Use Chrome or type your request.';
      return;
    }

    if (!this.speechRecognition) {
      const recognition = new Recognition();
      recognition.lang = typeof navigator !== 'undefined' && navigator.language
        ? navigator.language
        : 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.onstart = () => {
        this.voiceListening = true;
        this.voiceMessage = 'Listening… Speak naturally.';
      };
      recognition.onresult = event => this.handleVoiceResult(event);
      recognition.onerror = event => {
        this.voiceListening = false;
        this.voiceMessage = this.readableVoiceError(event.error);
      };
      recognition.onend = () => {
        this.voiceListening = false;
        if (this.voiceMessage.startsWith('Listening')) {
          this.voiceMessage = this.draft.trim()
            ? 'Voice captured. Review the words, then send.'
            : 'I did not hear anything. Tap the microphone and try again.';
        }
      };
      this.speechRecognition = recognition;
    }

    this.voiceDraftBeforeListening = this.draft.trim();
    this.voiceListening = true;
    this.voiceMessage = 'Starting microphone…';
    try {
      this.speechRecognition.start();
    } catch (error) {
      console.error('Could not start speech recognition:', error);
      this.voiceListening = false;
      this.voiceMessage = 'The microphone could not start. Close other microphone apps and try again.';
    }
  }

  private stopVoiceInput(abort: boolean): void {
    const recognition = this.speechRecognition;
    if (!recognition || !this.voiceListening) return;
    try {
      if (abort) recognition.abort();
      else recognition.stop();
    } catch (error) {
      console.warn('Could not stop speech recognition cleanly:', error);
    } finally {
      this.voiceListening = false;
    }
  }

  private handleVoiceResult(event: BrowserSpeechRecognitionEvent): void {
    const transcripts: string[] = [];
    let hasFinalResult = false;
    for (let index = 0; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = result?.[0]?.transcript?.trim();
      if (transcript) transcripts.push(transcript);
      if (result?.isFinal) hasFinalResult = true;
    }
    const spokenText = transcripts.join(' ').trim();
    if (!spokenText) return;
    this.draft = [this.voiceDraftBeforeListening, spokenText].filter(Boolean).join(' ').slice(0, 600);
    this.voiceMessage = hasFinalResult
      ? 'Voice captured. Review the words, then send.'
      : 'Listening…';
  }

  private readableVoiceError(error: string): string {
    if (['not-allowed', 'service-not-allowed'].includes(error)) {
      return 'Microphone access is blocked. Allow microphone permission in your browser settings and try again.';
    }
    if (error === 'audio-capture') return 'No microphone was found. Connect or enable a microphone and try again.';
    if (error === 'network') return 'Voice recognition needs an internet connection. Check your connection and try again.';
    if (error === 'no-speech') return 'I did not hear anything. Tap the microphone and speak again.';
    if (error === 'aborted') return '';
    return 'Voice input stopped unexpectedly. You can try again or type your request.';
  }

  private speechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
    if (typeof window === 'undefined') return null;
    const speechWindow = window as typeof window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    };
    return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
  }

  private isPlanConfirmation(command: string): boolean {
    const normalized = command.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .trim()
      .replace(/\s+/g, ' ');
    return new Set([
      'yes',
      'yes please',
      'do it',
      'please do it',
      'apply',
      'apply it',
      'apply changes',
      'confirm',
      'confirmed',
      'ok',
      'okay',
      'go ahead',
      'proceed',
      'add',
      'add it',
      'save it',
      'make the change',
      'make the changes'
    ]).has(normalized);
  }

  private scrollToLatest(): void {
    setTimeout(() => {
      const element = this.messageList?.nativeElement;
      if (element) element.scrollTop = element.scrollHeight;
    });
  }
}
