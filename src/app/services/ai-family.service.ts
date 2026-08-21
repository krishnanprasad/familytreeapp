import { Injectable } from '@angular/core';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Functions, getFunctions, httpsCallable } from 'firebase/functions';
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp
} from 'firebase/firestore';
import {
  AiChatContextMessage,
  AiFamilyCommandRequest,
  AiFamilyPlan,
  AiFamilyTask,
  AiTreePersonContext
} from '../models/ai-family.model';
import { TreeNode } from '../models/tree-node.model';
import { firebaseConfig } from '../firebase.config';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AiFamilyService {
  private readonly app: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
  private readonly functions: Functions = getFunctions(this.app, 'us-central1');
  private readonly planFamilyChanges = httpsCallable<AiFamilyCommandRequest, AiFamilyPlan>(
    this.functions,
    'familyTreeAssistant',
    { timeout: 45_000 }
  );

  constructor(private readonly authService: AuthService) {}

  async loadConversation(treeId: string): Promise<AiChatContextMessage[]> {
    const uid = this.authService.currentUser?.uid;
    const normalizedTreeId = this.validTreeId(treeId);
    if (!uid || !normalizedTreeId) return [];

    const messagesQuery = query(
      collection(
        this.authService.firestore,
        'users', uid,
        'aiTreeChats', normalizedTreeId,
        'messages'
      ),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const snapshot = await getDocs(messagesQuery);
    return snapshot.docs.reverse().map<AiChatContextMessage>(messageSnapshot => {
      const data = messageSnapshot.data();
      return {
        role: data['role'] === 'assistant' ? 'assistant' : 'user',
        text: typeof data['text'] === 'string' ? data['text'].slice(0, 2000) : '',
        context: data['context'] === 'create' ? 'create' : 'general',
        task: this.taskFromData(data['task'])
      };
    }).filter(message => message.text.trim());
  }

  async saveMessage(treeId: string, message: AiChatContextMessage): Promise<void> {
    const uid = this.authService.currentUser?.uid;
    const normalizedTreeId = this.validTreeId(treeId);
    const text = message.text.trim().slice(0, 2000);
    if (!uid || !normalizedTreeId || !text) return;

    const task = message.task ? this.normalizedTask(message.task) : null;
    await addDoc(collection(
      this.authService.firestore,
      'users', uid,
      'aiTreeChats', normalizedTreeId,
      'messages'
    ), {
      treeId: normalizedTreeId,
      role: message.role,
      text,
      context: message.context === 'create' ? 'create' : 'general',
      ...(task ? { task } : {}),
      createdAt: serverTimestamp()
    });
  }

  async createPlan(
    message: string,
    tree: TreeNode,
    selectedPersonId: string | null,
    conversation: AiChatContextMessage[] = []
  ): Promise<AiFamilyPlan> {
    const people: AiTreePersonContext[] = [];

    const visit = (person: TreeNode, generation: number, parentId = ''): void => {
      people.push(this.personContext(person, generation, parentId, ''));
      if (person.spouse) {
        people.push(this.personContext(person.spouse, generation, parentId, person.id));
      }
      person.children.forEach(child => visit(child, generation + 1, person.id));
    };

    visit(tree, 0);
    const activeTask = [...conversation].reverse()
      .map(entry => entry.task)
      .find(task => task && ['active', 'ready'].includes(task.status)) ?? null;
    const response = await this.planFamilyChanges({
      message: message.trim(),
      selectedPersonId: selectedPersonId ?? '',
      activeTask,
      conversation: conversation.slice(-12).map(entry => ({
        role: entry.role,
        text: entry.text.trim().slice(0, 600),
        context: entry.context ?? 'general'
      })),
      tree: {
        treeName: tree.treeName ?? 'My Family',
        rootPersonId: tree.id,
        people: people.slice(0, 500)
      }
    });
    return response.data;
  }

  private personContext(
    person: TreeNode,
    generation: number,
    parentId: string,
    spouseOfId: string
  ): AiTreePersonContext {
    return {
      id: person.id,
      name: person.name,
      gender: person.gender,
      age: person.age,
      isAlive: person.isAlive,
      location: person.location,
      birthDate: person.birthDate ?? '',
      deathDate: person.deathDate ?? '',
      parentId,
      spouseOfId,
      generation
    };
  }

  private validTreeId(treeId: string): string {
    const normalized = treeId.trim();
    return /^[a-zA-Z0-9_-]{1,160}$/.test(normalized) ? normalized : '';
  }

  private taskFromData(value: unknown): AiFamilyTask | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const task = value as Record<string, unknown>;
    const intent = task['intent'] === 'update' ? 'update' : task['intent'] === 'add' ? 'add' : null;
    const status = ['active', 'ready', 'completed', 'cancelled'].includes(String(task['status']))
      ? task['status'] as AiFamilyTask['status']
      : null;
    const title = typeof task['title'] === 'string' ? task['title'].trim().slice(0, 120) : '';
    const summary = typeof task['summary'] === 'string' ? task['summary'].trim().slice(0, 500) : '';
    if (!intent || !status || !title || !summary) return undefined;
    return {
      intent,
      status,
      title,
      summary,
      knownDetails: Array.isArray(task['knownDetails'])
        ? task['knownDetails'].filter((item): item is string => typeof item === 'string')
          .map(item => item.trim().slice(0, 180)).filter(Boolean).slice(0, 8)
        : [],
      nextQuestion: typeof task['nextQuestion'] === 'string'
        ? task['nextQuestion'].trim().slice(0, 300)
        : ''
    };
  }

  private normalizedTask(task: AiFamilyTask): AiFamilyTask | null {
    return this.taskFromData(task) ?? null;
  }
}
