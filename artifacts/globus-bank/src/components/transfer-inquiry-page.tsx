import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Clock3, MessageCircle, ShieldCheck } from "lucide-react";

type InquiryInfo = { valid: boolean; transferReference: string };

export function TransferInquiryPage({ token }: { token: string }) {
  const [info, setInfo] = useState<InquiryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/bank/transfer-inquiries/${encodeURIComponent(token)}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "This inquiry link is invalid or expired.");
        return payload as InquiryInfo;
      })
      .then((payload) => { if (active) setInfo(payload); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "This inquiry link is invalid or expired.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/bank/transfer-inquiries/${encodeURIComponent(token)}/messages`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ body: message.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Your inquiry could not be sent.");
      setSent(true);
      setMessage("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your inquiry could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f2f6f8] px-4 py-10 text-[#203851]">
      <div className="mx-auto w-full max-w-[560px] overflow-hidden rounded-2xl border border-[#dce6eb] bg-white shadow-[0_16px_50px_rgba(25,55,80,.08)]">
        <header className="bg-[#173b62] px-6 py-6 text-white">
          <p className="text-xs font-bold tracking-[.18em]">GLOBUS BANK</p>
          <h1 className="mt-3 text-2xl font-semibold">Transfer inquiries</h1>
          <p className="mt-2 text-sm leading-6 text-white/75">Send a message about the transfer directly to the sender's dedicated support inbox.</p>
        </header>
        <section className="space-y-5 p-6">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-slate-500"><Clock3 className="h-4 w-4" /> Checking your secure inquiry link…</div>
          ) : error && !info ? (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
          ) : info ? (
            <>
              <div className="rounded-xl border border-[#dce8ed] bg-[#f7fafb] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-[#367f7d]" /> Secure transfer reference</div>
                <p className="mt-2 break-all font-mono text-sm text-[#466178]">{info.transferReference}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">This link is unique to this transfer and routes your inquiry only to the sender's support conversation.</p>
              </div>
              {sent ? (
                <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 font-semibold text-emerald-800"><CheckCircle2 className="h-5 w-5" /> Inquiry sent</div>
                  <p className="mt-2 text-sm leading-6 text-emerald-800">Your message has been delivered to the sender's dedicated GLOBUS BANK support inbox. You can close this page.</p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-3">
                  <label htmlFor="transfer-inquiry-message" className="block text-sm font-semibold">Your inquiry</label>
                  <textarea id="transfer-inquiry-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={4000} rows={6} required placeholder="Write your question or inquiry about this transfer…" className="w-full resize-y rounded-xl border border-[#d8e2e8] bg-white p-3 text-sm outline-none transition focus:border-[#4b9294] focus:ring-2 focus:ring-[#4b9294]/15" />
                  <div className="flex items-center justify-between text-xs text-slate-400"><span>{message.length}/4000</span><span>Replies go to the sender's Vault inbox</span></div>
                  {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
                  <button type="submit" disabled={sending || !message.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#173b62] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#214c76] disabled:cursor-not-allowed disabled:opacity-50">
                    <MessageCircle className="h-4 w-4" /> {sending ? "Sending inquiry…" : "Send inquiry"} <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              )}
            </>
          ) : null}
          <p className="border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">Do not include passwords, PINs, one-time passcodes, full card numbers, or other confidential account credentials. This link is for transfer inquiries only.</p>
        </section>
      </div>
    </main>
  );
}
