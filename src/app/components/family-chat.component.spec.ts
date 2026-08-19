import { SimpleChange } from '@angular/core';
import { FamilyChatComponent } from './family-chat.component';
import { AiFamilyService } from '../services/ai-family.service';
import { TreeService } from '../services/tree.service';
import { TreeNode } from '../models/tree-node.model';
import { AiFamilyPlan } from '../models/ai-family.model';

describe('FamilyChatComponent tree-scoped history', () => {
  let aiFamilyService: jasmine.SpyObj<AiFamilyService>;
  let treeService: jasmine.SpyObj<TreeService>;
  let component: FamilyChatComponent;
  let originalSpeechRecognition: unknown;
  let originalWebkitSpeechRecognition: unknown;

  beforeEach(() => {
    const speechWindow = window as typeof window & Record<string, unknown>;
    originalSpeechRecognition = speechWindow['SpeechRecognition'];
    originalWebkitSpeechRecognition = speechWindow['webkitSpeechRecognition'];
    aiFamilyService = jasmine.createSpyObj<AiFamilyService>(
      'AiFamilyService',
      ['loadConversation', 'saveMessage', 'createPlan']
    );
    treeService = jasmine.createSpyObj<TreeService>(
      'TreeService',
      ['getPersonIndex', 'getTree', 'applyAiOperations']
    );
    treeService.getPersonIndex.and.returnValue([]);
    treeService.getTree.and.returnValue({
      id: 'root',
      name: 'Root',
      children: []
    } as unknown as TreeNode);
    aiFamilyService.saveMessage.and.resolveTo();
    component = new FamilyChatComponent(aiFamilyService, treeService);
    component.isSignedIn = true;
    component.userId = 'user-1';
    component.canEdit = true;
  });

  afterEach(() => {
    const speechWindow = window as typeof window & Record<string, unknown>;
    speechWindow['SpeechRecognition'] = originalSpeechRecognition;
    speechWindow['webkitSpeechRecognition'] = originalWebkitSpeechRecognition;
    component.ngOnDestroy();
  });

  it('loads only the active tree history when switching trees', async () => {
    aiFamilyService.loadConversation.and.callFake(async treeId => treeId === 'tree-a'
      ? [{ role: 'user', text: 'Tree A prompt', context: 'general' }]
      : [{ role: 'user', text: 'Tree B prompt', context: 'general' }]);

    await switchTree('tree-a');
    expect(component.messages.map(message => message.text)).toEqual(['Tree A prompt']);

    await switchTree('tree-b');
    expect(component.messages.map(message => message.text)).toEqual(['Tree B prompt']);
    expect(component.messages.some(message => message.text === 'Tree A prompt')).toBeFalse();
  });

  it('saves prompts and sends context using only the active tree', async () => {
    aiFamilyService.loadConversation.and.resolveTo([
      { role: 'assistant', text: 'Tree B saved context', context: 'general' }
    ]);
    aiFamilyService.createPlan.and.resolveTo({
      message: 'No change needed.',
      intent: 'none',
      needsClarification: false,
      clarificationQuestion: '',
      clarificationQuestions: [],
      operations: []
    });

    await switchTree('tree-b');
    component.draft = 'A new Tree B prompt';
    await component.submit();

    expect(aiFamilyService.createPlan).toHaveBeenCalled();
    const conversation = aiFamilyService.createPlan.calls.mostRecent().args[3] ?? [];
    expect(conversation.map(message => message.text)).toEqual(['Tree B saved context']);
    expect(aiFamilyService.saveMessage.calls.allArgs().map(args => args[0])).toEqual(['tree-b', 'tree-b']);
  });

  it('applies a pending plan when the user confirms in chat', async () => {
    aiFamilyService.loadConversation.and.resolveTo([]);
    treeService.applyAiOperations.and.returnValue({
      changedCount: 1,
      affectedIds: ['sriram-id'],
      summary: 'Added Sriram'
    });
    await switchTree('tree-b');
    component.pendingPlan = {
      message: 'Ready to add Sriram as Uma\'s son.',
      intent: 'add',
      needsClarification: false,
      clarificationQuestion: '',
      clarificationQuestions: [],
      operations: [{ type: 'add' }]
    } as unknown as AiFamilyPlan;
    component.draft = 'Add';

    await component.submit();

    expect(aiFamilyService.createPlan).not.toHaveBeenCalled();
    expect(treeService.applyAiOperations).toHaveBeenCalled();
    expect(component.pendingPlan).toBeNull();
    expect(aiFamilyService.saveMessage.calls.allArgs().map(args => args[1].text)).toEqual([
      'Add',
      'Added Sriram. The change is saved and can be undone from the toolbar.'
    ]);
  });

  it('shows only one clarification question and keeps a persistent task summary', async () => {
    aiFamilyService.loadConversation.and.resolveTo([]);
    aiFamilyService.createPlan.and.resolveTo({
      message: 'I am collecting the relationship details.',
      intent: 'add',
      needsClarification: true,
      clarificationQuestion: 'Which Uma do you mean?',
      clarificationQuestions: [
        'Which Uma do you mean?',
        'Is Sriram her biological son?'
      ],
      operations: [],
      task: {
        intent: 'add',
        title: 'Add Sriram',
        summary: 'Add Sriram as Uma’s son.',
        knownDetails: ['Name: Sriram'],
        nextQuestion: 'Which Uma do you mean?'
      }
    });

    await switchTree('tree-b');
    component.draft = 'Add Sriram as Uma’s son';
    await component.submit();

    expect(component.messages.at(-1)?.text).toBe('Which Uma do you mean?');
    expect(component.messages.at(-1)?.text).not.toContain('Is Sriram her biological son?');
    expect(component.activeTask?.title).toBe('Add Sriram');
    expect(component.activeTask?.knownDetails).toEqual(['Name: Sriram']);
    expect(component.pendingPlan).toBeNull();
    expect(aiFamilyService.saveMessage.calls.mostRecent().args[1].task?.status).toBe('active');
  });

  it('restores an unfinished task only from the active tree history', async () => {
    aiFamilyService.loadConversation.and.callFake(async treeId => treeId === 'tree-a' ? [{
      role: 'assistant',
      text: 'Who should Sriram be connected to?',
      context: 'create',
      task: {
        intent: 'add',
        status: 'active',
        title: 'Add Sriram',
        summary: 'Adding Sriram to this tree.',
        knownDetails: ['Name: Sriram'],
        nextQuestion: 'Who should Sriram be connected to?'
      }
    }] : []);

    await switchTree('tree-a');
    expect(component.activeTask?.title).toBe('Add Sriram');

    await switchTree('tree-b');
    expect(component.activeTask).toBeNull();
  });

  it('cancels an active task without calling the AI or changing the tree', async () => {
    aiFamilyService.loadConversation.and.resolveTo([]);
    await switchTree('tree-b');
    component.activeTask = {
      intent: 'add',
      status: 'active',
      title: 'Add Sriram',
      summary: 'Adding Sriram.',
      knownDetails: ['Name: Sriram'],
      nextQuestion: 'Who is the parent?'
    };
    component.draft = 'Cancel';

    await component.submit();

    expect(aiFamilyService.createPlan).not.toHaveBeenCalled();
    expect(treeService.applyAiOperations).not.toHaveBeenCalled();
    expect(component.activeTask).toBeNull();
    expect(component.messages.at(-1)?.text).toContain('Nothing was changed');
    expect(aiFamilyService.saveMessage.calls.mostRecent().args[1].task?.status).toBe('cancelled');
  });

  it('provides a retryable message when the helper is offline', async () => {
    aiFamilyService.loadConversation.and.resolveTo([]);
    aiFamilyService.createPlan.and.rejectWith({ code: 'functions/unavailable' });
    spyOn(console, 'error');
    await switchTree('tree-b');
    component.draft = 'Update Uma’s location';

    await component.submit();

    expect(component.errorMessage).toContain('internet connection');
    expect(component.lastFailedCommand).toBe('Update Uma’s location');
  });

  it('captures speech into the draft without sending automatically', () => {
    class FakeRecognition {
      static instance: FakeRecognition;
      lang = '';
      continuous = false;
      interimResults = false;
      onstart: (() => void) | null = null;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;

      constructor() {
        FakeRecognition.instance = this;
      }

      start(): void { this.onstart?.(); }
      stop(): void { this.onend?.(); }
      abort(): void { this.onend?.(); }
    }
    const speechWindow = window as typeof window & Record<string, unknown>;
    speechWindow['SpeechRecognition'] = FakeRecognition;

    component.toggleVoiceInput();
    FakeRecognition.instance.onresult?.({
      results: {
        0: { 0: { transcript: 'Add Sriram as Uma son' }, length: 1, isFinal: true },
        length: 1
      }
    });

    expect(component.voiceListening).toBeTrue();
    expect(component.draft).toBe('Add Sriram as Uma son');
    expect(aiFamilyService.createPlan).not.toHaveBeenCalled();
    expect(component.voiceMessage).toContain('Review');
  });

  it('explains microphone permission failures', () => {
    class DeniedRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onstart: (() => void) | null = null;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start(): void { this.onerror?.({ error: 'not-allowed' }); }
      stop(): void {}
      abort(): void {}
    }
    const speechWindow = window as typeof window & Record<string, unknown>;
    speechWindow['SpeechRecognition'] = DeniedRecognition;

    component.toggleVoiceInput();

    expect(component.voiceListening).toBeFalse();
    expect(component.voiceMessage).toContain('microphone permission');
  });

  async function switchTree(treeId: string): Promise<void> {
    const previousTreeId = component.treeId;
    component.treeId = treeId;
    component.ngOnChanges({
      treeId: new SimpleChange(previousTreeId, treeId, !previousTreeId)
    });
    await new Promise(resolve => setTimeout(resolve, 0));
  }
});
