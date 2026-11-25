import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, CheckCheck, CircleAlert, Headphones, LockKeyhole, MessageSquareText,
  Plus, RefreshCw, Search, Send, ShieldCheck, UserRound,
} from 'lucide-react';
import {
  getListAdminSupportConversationsQueryKey,
  getListAdminSupportMessagesQueryKey,
  getListBankSupportConversationsQueryKey,
  getListBankSupportMessagesQueryKey,
  useCreateBankSupportConversation,
  useListAdminSupportConversations,
  useListAdminSupportMessages,
  useListBankSupportConversations,
  useListBankSupportMessages,
  useMarkAdminSupportConversationRead,
  useMarkBankSupportConversationRead,
  useReplyAdminSupportMessage,
  useSendBankSupportMessage,
} from '@workspace/api-client-react';
import type {
  AdminSupportConversation,
  BankSupportConversation,
  BankSupportMessage,
  ListAdminSupportConversationsParams,
} from '@workspace/api-client-react';

const shell = 'rounded-[16px] border border-[#dce5e8] bg-[#fffefa] shadow-[0_4px_16px_rgba(28,53,69,.035)]';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-[9px] bg-[#173b50] px-4 py-2.5 text-[11px] font-bold text-white transition hover:bg-[#24576a] disabled:cursor-not-allowed disabled:opacity-50';
const quietButton = 'inline-flex items-center justify-center gap-2 rounded-[9px] border border-[#dbe4e5] bg-[#fffefa] px-3 py-2 text-[10px] font-semibold text-[#425d69] transition hover:bg-[#f3f7f5] disabled:opacity-50';
const fieldClass = 'w-full rounded-[9px] border border-[#d8e1e3] bg-[#fffefa] px-3 py-2.5 text-[12px] text-[#253c4c] outline-none transition placeholder:text-[#a2aeae] focus:border-[#43898a] focus:ring-2 focus:ring-[#43898a]/10';

type Conversation = BankSupportConversation | AdminSupportConversation;

function asDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function ErrorNotice({ retry, text = 'Support could not be reached.' }: { retry: () => void; text?: string }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[11px] border border-[#efd7cf] bg-[#fff7f3] px-4 py-3 text-[11px] text-[#96584d]">
    <span className="flex items-center gap-2"><CircleAlert size={15} />{text}</span>
    <button type="button" onClick={retry} className={quietButton}><RefreshCw size={13} />Retry</button>
  </div>;
}

function ThreadSkeleton() {
  return <div className="animate-pulse space-y-4 p-5" aria-label="Loading messages">
    <div className="h-14 w-3/4 rounded-[13px] bg-[#edf2ef]" />
    <div className="ml-auto h-16 w-2/3 rounded-[13px] bg-[#e7f0ed]" />
    <div className="h-12 w-1/2 rounded-[13px] bg-[#edf2ef]" />
  </div>;
}

function ConversationList({
  conversations, selectedId, onSelect, loading, error, retry, admin = false, emptyTitle, emptyText,
}: {
  conversations: Conversation[];
  selectedId: string;
  onSelect: (id: string) => void;
  loading: boolean;
  error: boolean;
  retry: () => void;
  admin?: boolean;
  emptyTitle: string;
  emptyText: string;
}) {
  return <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
    {loading ? <div className="animate-pulse space-y-2 p-3">{[0, 1, 2, 3].map(row => <div key={row} className="h-[78px] rounded-[11px] bg-[#edf2ef]" />)}</div>
      : error ? <div className="p-3"><ErrorNotice retry={retry} text="Your conversation list is unavailable." /></div>
        : conversations.length ? <div className="divide-y divide-[#edf0ed]">
          {conversations.map(item => {
            const unread = admin ? (item as AdminSupportConversation).adminUnread : (item as BankSupportConversation).customerUnread;
            const active = selectedId === item.id;
            return <button key={item.id} type="button" onClick={() => onSelect(item.id)} aria-current={active ? 'true' : undefined}
              className={`block w-full min-w-0 px-4 py-4 text-left transition ${active ? 'bg-[#edf5f1]' : 'hover:bg-[#f7f9f6]'}`}>
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0 flex-1">
                  {admin && <span className="mb-1 block truncate text-[9px] font-bold uppercase tracking-[.08em] text-[#638082]">{(item as AdminSupportConversation).customerName}</span>}
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[12px] font-bold text-[#2c4652]">{item.subject}</span>
                    {unread && <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-[#4d958a]" />}
                  </span>
                </span>
                <span className="shrink-0 text-[9px] text-[#81918f]">{asDate(item.lastMessageAt)}</span>
              </span>
              <span className="mt-1.5 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[10px] text-[#788b89]">{item.lastMessagePreview || 'No message preview'}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.06em] ${item.status === 'open' ? 'bg-[#e7f2eb] text-[#47775e]' : 'bg-[#eef1ef] text-[#75827e]'}`}>{item.status}</span>
              </span>
            </button>;
          })}
        </div>
        : <div className="px-5 py-12 text-center">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-[14px] bg-[#edf5f0] text-[#568583]"><MessageSquareText size={18} /></div>
          <p className="mt-3 text-[12px] font-bold text-[#3b545d]">{emptyTitle}</p>
          <p className="mx-auto mt-1 max-w-[220px] text-[10px] leading-4 text-[#819195]">{emptyText}</p>
        </div>}
  </div>;
}

function MessageThread({
  messages, loading, error, retry, selected, admin = false,
}: {
  messages: BankSupportMessage[];
  loading: boolean;
  error: boolean;
  retry: () => void;
  selected?: Conversation;
  admin?: boolean;
}) {
  if (!selected) return <div className="grid min-h-[300px] flex-1 place-items-center p-6 text-center">
    <div><div className="mx-auto grid h-12 w-12 place-items-center rounded-[16px] bg-[#edf5f0] text-[#54817e]"><Headphones size={20} /></div><p className="mt-3 text-[12px] font-bold text-[#36515b]">Choose a conversation</p><p className="mt-1 text-[10px] text-[#82928f]">Messages stay within this protected workspace.</p></div>
  </div>;
  if (loading) return <ThreadSkeleton />;
  if (error) return <div className="p-4"><ErrorNotice retry={retry} text="Messages are temporarily unavailable." /></div>;
  if (!messages.length) return <div className="grid flex-1 place-items-center p-6 text-center text-[11px] text-[#84928f]">No messages yet. Send a reply to continue.</div>;
  return <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4 sm:p-5">
    {messages.map(message => {
      const fromCustomer = message.senderRole === 'customer';
      const own = admin ? !fromCustomer : fromCustomer;
      return <article key={message.id} className={`max-w-[88%] rounded-[13px] px-3.5 py-3 sm:max-w-[78%] ${own ? 'ml-auto rounded-br-[4px] bg-[#e8f1ed] text-[#29484a]' : 'mr-auto rounded-bl-[4px] border border-[#e6ebe7] bg-[#fffefa] text-[#344c55]'}`}>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span className="text-[9px] font-bold text-[#4b7774]">{message.senderName || (fromCustomer ? 'You' : 'Globus Support')}</span>
          <time className="text-[8px] text-[#899895]">{asDate(message.createdAt)}</time>
        </div>
        <p className="whitespace-pre-wrap break-words text-[11px] leading-[1.65]">{message.body}</p>
      </article>;
    })}
  </div>;
}

function ReplyBox({ onSend, sending, disabled, label = 'Write a reply', placeholder = 'Type a message…' }: {
  onSend: (body: string) => Promise<void>;
  sending: boolean;
  disabled: boolean;
  label?: string;
  placeholder?: string;
}) {
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) { setError('Enter a message before sending.'); return; }
    if (trimmed.length > 4000) { setError('Keep your message under 4,000 characters.'); return; }
    setError('');
    try {
      await onSend(trimmed);
      setBody('');
    } catch {
      setError('Message not sent. Check your connection and retry.');
    }
  }
  return <form onSubmit={submit} className="shrink-0 border-t border-[#e8eeeb] bg-[#fffefa] p-3 sm:p-4">
    <label className="sr-only" htmlFor="support-reply">{label}</label>
    <div className="flex items-end gap-2">
      <textarea id="support-reply" value={body} onChange={event => { setBody(event.target.value); setError(''); }} rows={2} maxLength={4000}
        placeholder={placeholder} disabled={disabled || sending} className={`${fieldClass} min-h-[72px] resize-y`} />
      <button type="submit" disabled={disabled || sending || !body.trim()} className={`${primaryButton} h-[42px] shrink-0 px-3`} aria-label="Send reply">
        <Send size={14} /> <span className="hidden sm:inline">{sending ? 'Sending…' : 'Send'}</span>
      </button>
    </div>
    <div className="mt-1.5 flex items-start justify-between gap-3">
      <p role={error ? 'alert' : undefined} className={`min-h-4 text-[9px] ${error ? 'text-[#a45247]' : 'text-[#899895]'}`}>{error || 'Never share passwords, verification codes, or full card details.'}</p>
      <span className="shrink-0 text-[9px] text-[#9aa5a2]">{body.length}/4,000</span>
    </div>
  </form>;
}

export function CustomerSupportPage() {
  const queryClient = useQueryClient();
  const conversations = useListBankSupportConversations({ query: { queryKey: getListBankSupportConversationsQueryKey(), refetchOnMount: 'always', refetchOnWindowFocus: true } });
  const items = conversations.data?.conversations ?? [];
  const [selectedId, setSelectedId] = useState('');
  const [mobileThread, setMobileThread] = useState(false);
  const [compose, setCompose] = useState(false);
  const [subject, setSubject] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [category, setCategory] = useState<'general' | 'private_vault' | 'transfer'>('general');
  const [transferReference, setTransferReference] = useState('');
  const [formError, setFormError] = useState('');
  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get('transfer');
    if (reference) {
      setCategory('transfer');
      setTransferReference(reference);
      setSubject('Support with transfer recipient');
      setCompose(true);
    }
  }, []);
  const created = useCreateBankSupportConversation();
  const send = useSendBankSupportMessage();
  const markRead = useMarkBankSupportConversationRead();
  const selected = items.find(item => item.id === selectedId);
  const messages = useListBankSupportMessages(selectedId || '', {
    query: { queryKey: getListBankSupportMessagesQueryKey(selectedId || ''), enabled: Boolean(selectedId), refetchInterval: 5000, refetchOnWindowFocus: true },
  });
  const markedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!selectedId && items.length) setSelectedId(items[0].id);
    if (selectedId && !items.some(item => item.id === selectedId) && items.length) setSelectedId(items[0].id);
  }, [items, selectedId]);

  useEffect(() => {
    if (!selected?.customerUnread || markedRef.current.has(selected.id)) return;
    markedRef.current.add(selected.id);
    markRead.mutateAsync({ conversationId: selected.id }).then(() => {
      void queryClient.invalidateQueries({ queryKey: getListBankSupportConversationsQueryKey() });
    }).catch(() => markedRef.current.delete(selected.id));
  }, [selected, markRead.mutateAsync, queryClient]);

  async function sendReply(body: string) {
    if (!selectedId) return;
    await send.mutateAsync({ conversationId: selectedId, data: { body } });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListBankSupportMessagesQueryKey(selectedId) }),
      queryClient.invalidateQueries({ queryKey: getListBankSupportConversationsQueryKey() }),
    ]);
  }

  async function createConversation(event: FormEvent) {
    event.preventDefault();
    const cleanSubject = subject.trim();
    const cleanMessage = firstMessage.trim();
    if (cleanSubject.length < 3) { setFormError('Add a subject of at least 3 characters.'); return; }
    if (cleanSubject.length > 120) { setFormError('Keep the subject under 120 characters.'); return; }
    if (cleanMessage.length < 5) { setFormError('Add a little more detail to your message.'); return; }
    if (cleanMessage.length > 4000) { setFormError('Keep your message under 4,000 characters.'); return; }
    if (category === 'transfer' && !transferReference.trim()) { setFormError('Enter the transfer reference from your alert.'); return; }
    setFormError('');
    try {
      const result = await created.mutateAsync({ data: {
        subject: cleanSubject,
        message: cleanMessage,
        category,
        ...(category === 'transfer' ? { transferReference: transferReference.trim() } : {}),
      } });
      await queryClient.invalidateQueries({ queryKey: getListBankSupportConversationsQueryKey() });
      setSubject('');
      setFirstMessage('');
      setCategory('general');
      setTransferReference('');
      setCompose(false);
      setSelectedId(result.conversation.id);
      setMobileThread(true);
    } catch {
      setFormError('We could not open your conversation. Check your connection and retry.');
    }
  }

  const active = items.find(item => item.id === selectedId);
  return <section data-testid="customer-support-page" className="mx-auto flex min-h-[min(760px,calc(100dvh-112px))] max-w-[1240px] flex-col gap-4">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.18em] text-[#4d8581]"><LockKeyhole size={12} /> Secure account support</p>
        <h1 className="mt-1 text-[25px] font-extrabold tracking-[-.055em] text-[#203b4c] sm:text-[30px]">Support inbox</h1>
        <p className="mt-1 max-w-xl text-[11px] leading-5 text-[#71858b]">Talk with Globus about your account. Replies stay tied to your signed-in profile.</p>
      </div>
      <button type="button" onClick={() => { setCompose(true); setFormError(''); }} className={primaryButton}><Plus size={15} />New conversation</button>
    </header>
    <div className={`${shell} flex min-h-0 flex-1 overflow-hidden`}>
      <aside className={`flex min-h-[420px] w-full min-w-0 flex-col border-[#e8eeeb] md:w-[310px] md:shrink-0 md:border-r lg:w-[360px] ${mobileThread ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex items-center justify-between border-b border-[#e8eeeb] px-4 py-3">
          <div><p className="text-[11px] font-bold text-[#304b55]">Your conversations</p><p className="mt-0.5 text-[9px] text-[#84928f]">{items.length} total · unread marked</p></div>
          <button type="button" onClick={() => void conversations.refetch()} aria-label="Refresh conversations" className="rounded-lg p-2 text-[#66817f] hover:bg-[#eef4f0]"><RefreshCw size={14} /></button>
        </div>
        <ConversationList conversations={items} selectedId={selectedId} onSelect={id => { setSelectedId(id); setMobileThread(true); }}
          loading={conversations.isLoading} error={conversations.isError} retry={() => void conversations.refetch()}
          emptyTitle="No conversations yet" emptyText="Open a private conversation with our support team." />
      </aside>
      <div className={`flex min-h-[420px] min-w-0 flex-1 flex-col ${mobileThread ? 'flex' : 'hidden md:flex'}`}>
        <div className="flex min-h-[60px] shrink-0 items-center gap-3 border-b border-[#e8eeeb] px-3 py-3 sm:px-5">
          <button type="button" onClick={() => setMobileThread(false)} aria-label="Back to conversations" className="rounded-lg p-2 text-[#557475] hover:bg-[#edf3ef] md:hidden"><ArrowLeft size={16} /></button>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-[#edf5f0] text-[#54817e]"><Headphones size={16} /></div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-bold text-[#2c4652]">{active?.subject || 'Select a conversation'}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[9px] text-[#83918f]"><span className={`h-1.5 w-1.5 rounded-full ${active?.status === 'open' ? 'bg-[#62a08c]' : 'bg-[#a2aaa6]'}`} />{active ? active.status === 'open' ? 'Open · replies usually arrive here' : 'Closed conversation' : 'Private support thread'}</p>
          </div>
          {active && <span className="hidden items-center gap-1 rounded-full border border-[#e1e9e4] bg-[#f8faf7] px-2 py-1 text-[8px] font-semibold text-[#67817b] sm:inline-flex"><ShieldCheck size={11} />Account protected</span>}
        </div>
        <MessageThread messages={messages.data?.messages ?? []} loading={Boolean(selectedId) && messages.isLoading} error={Boolean(selectedId) && messages.isError} retry={() => void messages.refetch()} selected={active} />
        {active?.status === 'open' && <ReplyBox onSend={sendReply} sending={send.isPending} disabled={!selectedId} />}
        {active?.status === 'closed' && <div className="border-t border-[#e8eeeb] px-4 py-4 text-center text-[10px] text-[#7d8d8b]">This conversation is closed. Start a new conversation if you need more help.</div>}
      </div>
    </div>

    {compose && <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-[#142a35]/45 p-3 backdrop-blur-[2px]" onMouseDown={event => { if (event.target === event.currentTarget && !created.isPending) setCompose(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="new-support-title" className="my-auto max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-[18px] border border-[#dce5e5] bg-[#fffefa] shadow-2xl">
        <header className="border-b border-[#e7eeeb] px-5 py-4"><p className="text-[9px] font-bold uppercase tracking-[.15em] text-[#4d8581]">Private message</p><h2 id="new-support-title" className="mt-1 text-[17px] font-bold text-[#263f4b]">Start a conversation</h2><p className="mt-1 text-[10px] text-[#7c8e92]">Do not include passwords, verification codes, or full financial credentials.</p></header>
        <form onSubmit={createConversation} className="space-y-4 p-5">
          <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.1em] text-[#71848b]">Support area</span><select value={category} onChange={event => setCategory(event.target.value as typeof category)} className={fieldClass}><option value="general">General account support</option><option value="private_vault">Private Vault support</option><option value="transfer">Transfer recipient support</option></select></label>
          {category === 'transfer' && <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.1em] text-[#71848b]">Transfer reference</span><input value={transferReference} maxLength={100} onChange={event => setTransferReference(event.target.value)} className={fieldClass} placeholder="Enter the transfer reference from your alert" /></label>}
          <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.1em] text-[#71848b]">Subject</span><input value={subject} maxLength={120} onChange={event => { setSubject(event.target.value); setFormError(''); }} className={fieldClass} placeholder="What can we help with?" /></label>
          <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.1em] text-[#71848b]">Message</span><textarea value={firstMessage} maxLength={4000} onChange={event => { setFirstMessage(event.target.value); setFormError(''); }} rows={5} className={`${fieldClass} resize-y`} placeholder="Share the account-support details we need to help." /></label>
          {formError && <p role="alert" className="text-[10px] text-[#a45247]">{formError}</p>}
          <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={created.isPending} onClick={() => setCompose(false)} className={quietButton}>Cancel</button><button type="submit" disabled={created.isPending} className={primaryButton}><Send size={13} />{created.isPending ? 'Opening…' : 'Open conversation'}</button></div>
        </form>
      </section>
    </div>}
  </section>;
}

export function AdminSupportInbox() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'all' | 'open' | 'closed'>('open');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'general' | 'private_vault' | 'transfer'>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [mobileThread, setMobileThread] = useState(false);
  const markedRef = useRef(new Set<string>());
  const params = useMemo<ListAdminSupportConversationsParams>(() => ({
    ...(status === 'all' ? {} : { status }),
    ...(categoryFilter === 'all' ? {} : { category: categoryFilter }),
    ...(search.trim() ? { search: search.trim() } : {}),
  }), [status, categoryFilter, search]);
  const conversations = useListAdminSupportConversations(params, { query: { queryKey: getListAdminSupportConversationsQueryKey(params), refetchInterval: 15000, refetchOnWindowFocus: true } });
  const items = conversations.data?.conversations ?? [];
  const selected = items.find(item => item.id === selectedId);
  const messages = useListAdminSupportMessages(selectedId || '', { query: { queryKey: getListAdminSupportMessagesQueryKey(selectedId || ''), enabled: Boolean(selectedId), refetchInterval: 5000, refetchOnWindowFocus: true } });
  const reply = useReplyAdminSupportMessage();
  const markRead = useMarkAdminSupportConversationRead();

  useEffect(() => {
    if (!selectedId && items.length) setSelectedId(items[0].id);
    if (selectedId && !items.some(item => item.id === selectedId) && items.length) setSelectedId(items[0].id);
  }, [items, selectedId]);
  useEffect(() => {
    if (!selected?.adminUnread || markedRef.current.has(selected.id)) return;
    markedRef.current.add(selected.id);
    markRead.mutateAsync({ conversationId: selected.id }).then(() => {
      void queryClient.invalidateQueries({ queryKey: getListAdminSupportConversationsQueryKey() });
    }).catch(() => markedRef.current.delete(selected.id));
  }, [selected, markRead.mutateAsync, queryClient]);

  async function sendReply(body: string) {
    if (!selectedId) return;
    await reply.mutateAsync({ conversationId: selectedId, data: { body } });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListAdminSupportMessagesQueryKey(selectedId) }),
      queryClient.invalidateQueries({ queryKey: getListAdminSupportConversationsQueryKey() }),
    ]);
  }
  const retryAll = () => void conversations.refetch();

  return <section data-testid="admin-support-inbox" className="mx-auto flex min-h-[min(760px,calc(100dvh-100px))] max-w-[1400px] flex-col gap-4">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.18em] text-[#4d8581]"><ShieldCheck size={12} /> Allowlisted operations</p>
        <h1 className="mt-1 text-[25px] font-extrabold tracking-[-.055em] text-[#203b4c] sm:text-[30px]">Support inbox</h1>
        <p className="mt-1 max-w-xl text-[11px] leading-5 text-[#71858b]">Review account-support conversations and reply from the protected operations workspace.</p>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dce7df] bg-[#f0f6f0] px-2.5 py-1.5 text-[9px] font-semibold text-[#557364]"><LockKeyhole size={11} />Customer data protected</span>
    </header>
    <div className={`${shell} flex min-h-0 flex-1 overflow-hidden`}>
      <aside className={`flex min-h-[420px] w-full min-w-0 flex-col border-[#e8eeeb] md:w-[330px] md:shrink-0 md:border-r lg:w-[370px] ${mobileThread ? 'hidden md:flex' : 'flex'}`}>
        <div className="space-y-3 border-b border-[#e8eeeb] p-3.5">
          <div className="flex items-center justify-between gap-2"><div><p className="text-[11px] font-bold text-[#304b55]">Customer conversations</p><p className="mt-0.5 text-[9px] text-[#84928f]">{items.length} shown · refreshes automatically</p></div><button type="button" onClick={retryAll} aria-label="Refresh inbox" className="rounded-lg p-2 text-[#66817f] hover:bg-[#eef4f0]"><RefreshCw size={14} /></button></div>
          <label className="relative block"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#879894]" /><span className="sr-only">Search support conversations</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search customers or subjects" className={`${fieldClass} h-9 pl-9 text-[10px]`} /></label>
          <div className="flex gap-1 rounded-[9px] bg-[#f0f4f0] p-1" role="group" aria-label="Filter conversation status">
            {(['open', 'closed', 'all'] as const).map(value => <button key={value} type="button" onClick={() => { setStatus(value); setSelectedId(''); }} aria-pressed={status === value} className={`flex-1 rounded-[7px] px-2 py-1.5 text-[9px] font-bold capitalize transition ${status === value ? 'bg-[#fffefa] text-[#315f5c] shadow-sm' : 'text-[#83918d] hover:text-[#426a65]'}`}>{value}</button>)}
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-[9px] bg-[#f0f4f0] p-1 sm:grid-cols-4" role="group" aria-label="Filter support category">
            {([{ value: 'all', label: 'All inboxes' }, { value: 'general', label: 'General' }, { value: 'private_vault', label: 'Private Vault' }, { value: 'transfer', label: 'Transfers' }] as const).map(item => <button key={item.value} type="button" onClick={() => { setCategoryFilter(item.value); setSelectedId(''); }} aria-pressed={categoryFilter === item.value} className={`rounded-[7px] px-2 py-1.5 text-[9px] font-bold transition ${categoryFilter === item.value ? 'bg-[#fffefa] text-[#315f5c] shadow-sm' : 'text-[#83918d] hover:text-[#426a65]'}`}>{item.label}</button>)}
          </div>
        </div>
        <ConversationList conversations={items} selectedId={selectedId} onSelect={id => { setSelectedId(id); setMobileThread(true); }}
          loading={conversations.isLoading} error={conversations.isError} retry={retryAll} admin
          emptyTitle={search ? 'No matches found' : 'Inbox is clear'} emptyText={search ? 'Try a different name or subject.' : 'New customer conversations will appear here.'} />
      </aside>
      <div className={`flex min-h-[420px] min-w-0 flex-1 flex-col ${mobileThread ? 'flex' : 'hidden md:flex'}`}>
        <div className="flex min-h-[66px] shrink-0 items-center gap-3 border-b border-[#e8eeeb] px-3 py-3 sm:px-5">
          <button type="button" onClick={() => setMobileThread(false)} aria-label="Back to inbox" className="rounded-lg p-2 text-[#557475] hover:bg-[#edf3ef] md:hidden"><ArrowLeft size={16} /></button>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-[#edf5f0] text-[#54817e]"><UserRound size={16} /></div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-bold text-[#2c4652]">{selected?.customerName || 'Select a conversation'}</p>
            {selected && <p className="truncate text-[9px] text-[#83918f]">{selected.customerEmail} <span className="px-1">·</span>{selected.subject}</p>}
          </div>
          {selected && <span className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-[.06em] ${selected.status === 'open' ? 'bg-[#e7f2eb] text-[#47775e]' : 'bg-[#eef1ef] text-[#75827e]'}`}>{selected.status}</span>}
        </div>
        <MessageThread messages={messages.data?.messages ?? []} loading={Boolean(selectedId) && messages.isLoading} error={Boolean(selectedId) && messages.isError} retry={() => void messages.refetch()} selected={selected} admin />
        {selected?.status === 'open' && <ReplyBox onSend={sendReply} sending={reply.isPending} disabled={!selectedId} label="Write a customer reply" placeholder="Reply to this customer…" />}
        {selected?.status === 'closed' && <div className="border-t border-[#e8eeeb] px-4 py-4 text-center text-[10px] text-[#7d8d8b]"><CheckCheck size={13} className="mr-1 inline" />This conversation is closed and cannot receive replies.</div>}
      </div>
    </div>
    <p className="flex items-center gap-1.5 text-[9px] text-[#82918d]"><ShieldCheck size={12} />Access is limited by administrator allowlisting. Conversation ownership remains enforced by Globus.</p>
  </section>;
}
