import { useSyncExternalStore } from "react";
import { CONTACTS_STORAGE_KEY, ContactsStore, type ContactDraft } from "@/app/contacts/contacts-store";

let store: ContactsStore | undefined;
let snapshot: { contacts: ReturnType<typeof readContacts>; deletedIds: string[]; storageAvailable: boolean; notice: string } | undefined;
const listeners = new Set<() => void>();
const contactsStore = () => store ??= new ContactsStore();
const readContacts = () => contactsStore().contacts;

function getSnapshot() {
  return snapshot ??= {
    contacts: readContacts(),
    deletedIds: contactsStore().deletedIds,
    storageAvailable: contactsStore().storageAvailable,
    notice: contactsStore().notice,
  };
}

function refresh() {
  snapshot = undefined;
  for (const listener of listeners) listener();
}

function synchronize(event: StorageEvent) {
  if (event.key !== CONTACTS_STORAGE_KEY && event.key !== null) return;
  contactsStore().reload(event.newValue);
  refresh();
}

function subscribe(listener: () => void) {
  if (!listeners.size) {
    // Re-entering the contacts page also sees changes made while no contact
    // component was mounted to receive another window's storage events.
    contactsStore().reload();
    snapshot = undefined;
    window.addEventListener("storage", synchronize);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener("storage", synchronize);
  };
}

export function useContacts() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const createContact = (draft: ContactDraft) => {
    const result = contactsStore().create(draft);
    refresh();
    return result;
  };
  const updateContact = (id: string, draft: ContactDraft) => {
    const result = contactsStore().update(id, draft);
    refresh();
    return result;
  };
  const removeContact = (id: string) => {
    const result = contactsStore().remove(id);
    refresh();
    return result;
  };
  const retry = () => {
    contactsStore().reload();
    refresh();
  };
  return { ...current, createContact, updateContact, removeContact, retry };
}
