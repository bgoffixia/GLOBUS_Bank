import { and, eq } from "drizzle-orm";
import { randomBytes, createHash } from "node:crypto";
import {
  bankNotificationsTable,
  bankAdminSettingsTable,
  bankPushSubscriptionsTable,
  bankSupportConversationsTable,
  bankTransferInquiryLinksTable,
  bankUsersTable,
  db,
} from "@workspace/db";
import { decryptPrivateData, encryptPrivateData, hashPrivateToken } from "./private-data";
import { sendResendSmtpEmail } from "./vault-passcode-reset-smtp";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type NotificationCategory = "transfer" | "wallet" | "security";

export type StoredNotification = typeof bankNotificationsTable.$inferSelect;

export class WebpushrSubscriberAlreadyLinkedError extends Error {
  constructor() {
    super("This Webpushr subscriber is already linked to another Dutstar account.");
    this.name = "WebpushrSubscriberAlreadyLinkedError";
  }
}

function webpushrCredentials() {
  const siteKey = process.env.WEBPUSHR_SITE_KEY?.trim();
  const apiKey = process.env.WEBPUSHR_REST_API_KEY?.trim();
  const authToken = process.env.WEBPUSHR_AUTH_TOKEN?.trim();
  return siteKey && apiKey && authToken
    ? { siteKey, apiKey, authToken }
    : null;
}

function appOrigin(): string | null {
  const host =
    process.env.GLOBUS_APP_ORIGIN?.trim() ||
    process.env.REPLIT_DOMAINS?.split(",")[0]?.trim() ||
    process.env.REPLIT_DEV_DOMAIN?.trim();
  if (!host) return null;
  try {
    const url = new URL(host.includes("://") ? host : `https://${host}`);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function getPushConfig(): { configured: boolean; siteKey: string | null } {
  const credentials = webpushrCredentials();
  return {
    configured: Boolean(credentials),
    siteKey: credentials?.siteKey ?? null,
  };
}

export function isPushCategoryEnabled(
  category: string,
  preferences: {
    transferEnabled: boolean;
    walletEnabled: boolean;
    securityEnabled: boolean;
  },
): boolean {
  switch (category) {
    case "transfer":
      return preferences.transferEnabled;
    case "wallet":
      return preferences.walletEnabled;
    case "security":
      return preferences.securityEnabled;
    default:
      return false;
  }
}

export async function storeNotification(
  tx: DbTransaction,
  input: {
    userId: string;
    category: NotificationCategory;
    title: string;
    body: string;
    reference?: string | null;
  },
): Promise<StoredNotification> {
  const [notification] = await tx
    .insert(bankNotificationsTable)
    .values({
      userId: input.userId,
      category: input.category,
      title: input.title,
      body: input.body,
      reference: input.reference ?? null,
    })
    .returning();
  return notification;
}

export function notificationResponse(notification: StoredNotification) {
  return {
    id: notification.id,
    category: notification.category as NotificationCategory,
    title: notification.title,
    body: notification.body,
    reference: notification.reference,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

type TransferLanguage = "en" | "fr" | "es" | "de" | "it" | "ru" | "uk" | "pl" | "ro";

function transferLanguageForCountry(country: string): TransferLanguage {
  const key = country.trim().toLowerCase().replace(/[_-]/g, " ");
  const countryLanguages: Record<string, TransferLanguage> = {
    france: "fr", fr: "fr", belgium: "fr", be: "fr", senegal: "fr", sn: "fr",
    "ivory coast": "fr", "cote d ivoire": "fr", ci: "fr", cameroon: "fr", cm: "fr",
    "democratic republic of the congo": "fr", "dr congo": "fr", cd: "fr",
    spain: "es", es: "es", mexico: "es", mx: "es", argentina: "es", ar: "es",
    colombia: "es", co: "es", chile: "es", cl: "es", peru: "es", pe: "es",
    venezuela: "es", ve: "es", ecuador: "es", ec: "es",
    germany: "de", de: "de", austria: "de", at: "de",
    italy: "it", it: "it", russia: "ru", ru: "ru", belarus: "ru", by: "ru",
    ukraine: "uk", ua: "uk", poland: "pl", pl: "pl", romania: "ro", ro: "ro",
    moldova: "ro", md: "ro",
  };
  return countryLanguages[key] ?? "en";
}

const transferEmailCopy: Record<TransferLanguage, Record<string, string>> = {
  en: {
    subject: "Dutstar transfer update", heading: "Transfer update",
    completed: "The sender’s Dutstar account recorded this transfer.",
    pending: "The transfer is pending review in Dutstar.",
    failed: "The transfer was not posted to the sender’s Dutstar wallet.",
    recipient: "Recipient", destination: "Destination", amount: "Amount",
    reference: "Reference", status: "Status", recorded: "Recorded",
    safety: "If you do not recognize this message, ignore it. Never reply with account credentials or verification codes.",
  },
  fr: {
    subject: "Mise à jour du transfert Dutstar", heading: "Mise à jour du transfert",
    completed: "Le compte Dutstar de l’expéditeur a enregistré ce transfert.",
    pending: "Le transfert est en attente de vérification dans Dutstar.",
    failed: "Le transfert n’a pas été crédité sur le portefeuille Dutstar de l’expéditeur.",
    recipient: "Bénéficiaire", destination: "Destination", amount: "Montant",
    reference: "Référence", status: "Statut", recorded: "Enregistré",
    safety: "Si vous ne reconnaissez pas ce message, ignorez-le. Ne répondez jamais avec vos identifiants ou codes de vérification.",
  },
  es: {
    subject: "Actualización de transferencia de Dutstar", heading: "Actualización de transferencia",
    completed: "La cuenta Dutstar del remitente registró esta transferencia.",
    pending: "La transferencia está pendiente de revisión en Dutstar.",
    failed: "La transferencia no se abonó en la cartera Dutstar del remitente.",
    recipient: "Beneficiario", destination: "Destino", amount: "Importe",
    reference: "Referencia", status: "Estado", recorded: "Registrado",
    safety: "Si no reconoce este mensaje, ignórelo. Nunca responda con credenciales ni códigos de verificación.",
  },
  de: {
    subject: "Dutstar-Überweisungsaktualisierung", heading: "Überweisungsaktualisierung",
    completed: "Das Dutstar-Konto des Absenders hat diese Überweisung erfasst.",
    pending: "Die Überweisung wird bei Dutstar geprüft.",
    failed: "Die Überweisung wurde nicht dem Dutstar-Wallet des Absenders gutgeschrieben.",
    recipient: "Empfänger", destination: "Ziel", amount: "Betrag",
    reference: "Referenz", status: "Status", recorded: "Erfasst",
    safety: "Wenn Sie diese Nachricht nicht erkennen, ignorieren Sie sie. Antworten Sie niemals mit Zugangsdaten oder Bestätigungscodes.",
  },
  it: {
    subject: "Aggiornamento trasferimento Dutstar", heading: "Aggiornamento trasferimento",
    completed: "Il conto Dutstar del mittente ha registrato questo trasferimento.",
    pending: "Il trasferimento è in attesa di verifica su Dutstar.",
    failed: "Il trasferimento non è stato accreditato sul portafoglio Dutstar del mittente.",
    recipient: "Destinatario", destination: "Destinazione", amount: "Importo",
    reference: "Riferimento", status: "Stato", recorded: "Registrato",
    safety: "Se non riconosci questo messaggio, ignoralo. Non rispondere mai con credenziali o codici di verifica.",
  },
  ru: {
    subject: "Обновление перевода Dutstar", heading: "Обновление перевода",
    completed: "Счёт отправителя в Dutstar зарегистрировал этот перевод.",
    pending: "Перевод ожидает проверки в Dutstar.",
    failed: "Перевод не был зачислен на кошелёк отправителя Dutstar.",
    recipient: "Получатель", destination: "Назначение", amount: "Сумма",
    reference: "Номер", status: "Статус", recorded: "Дата записи",
    safety: "Если вы не узнаёте это сообщение, проигнорируйте его. Не отправляйте в ответ пароли или коды подтверждения.",
  },
  uk: {
    subject: "Оновлення переказу Dutstar", heading: "Оновлення переказу",
    completed: "Рахунок відправника в Dutstar зареєстрував цей переказ.",
    pending: "Переказ очікує перевірки в Dutstar.",
    failed: "Переказ не було зараховано на гаманець відправника Dutstar.",
    recipient: "Отримувач", destination: "Призначення", amount: "Сума",
    reference: "Номер", status: "Статус", recorded: "Записано",
    safety: "Якщо ви не впізнаєте це повідомлення, проігноруйте його. Не надсилайте у відповідь паролі чи коди підтвердження.",
  },
  pl: {
    subject: "Aktualizacja przelewu Dutstar", heading: "Aktualizacja przelewu",
    completed: "Konto Dutstar nadawcy zarejestrowało ten przelew.",
    pending: "Przelew oczekuje na weryfikację w Dutstar.",
    failed: "Przelew nie został zaksięgowany w portfelu Dutstar nadawcy.",
    recipient: "Odbiorca", destination: "Cel", amount: "Kwota",
    reference: "Numer referencyjny", status: "Status", recorded: "Zarejestrowano",
    safety: "Jeśli nie rozpoznajesz tej wiadomości, zignoruj ją. Nigdy nie odsyłaj danych logowania ani kodów weryfikacyjnych.",
  },
  ro: {
    subject: "Actualizare transfer Dutstar", heading: "Actualizare transfer",
    completed: "Contul Dutstar al expeditorului a înregistrat acest transfer.",
    pending: "Transferul așteaptă verificarea în Dutstar.",
    failed: "Transferul nu a fost creditat în portofelul Dutstar al expeditorului.",
    recipient: "Beneficiar", destination: "Destinație", amount: "Sumă",
    reference: "Referință", status: "Stare", recorded: "Înregistrat",
    safety: "Dacă nu recunoașteți acest mesaj, ignorați-l. Nu răspundeți niciodată cu date de autentificare sau coduri de verificare.",
  },
};

function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

export function normalizeSupportUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length > 500) return null;
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export const DEFAULT_SUPPORT_LINK_LABEL = "Contact support";

export function normalizeSupportLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const label = value.trim();
  return label.length >= 1 &&
    label.length <= 40 &&
    !/[\u0000-\u001f\u007f]/.test(label)
    ? label
    : null;
}

export function renderSupportFooter(
  supportUrl: string | null,
  requestedLabel: string | null | undefined,
  supportEmail: string | null = null,
): { text: string; html: string } {
  const label = normalizeSupportLabel(requestedLabel) ?? DEFAULT_SUPPORT_LINK_LABEL;
  const validEmail = supportEmail && /^[^\\s<>@]+@[^\\s<>@]+\\.[^\\s<>@]+$/.test(supportEmail) ? supportEmail : null;
  const text = [
    ...(supportUrl ? [`${label}: ${supportUrl}`] : []),
    ...(validEmail ? [`Email support: ${validEmail}`] : []),
  ].join("\\n");
  const links = [
    ...(supportUrl ? [`<a href="${htmlEscape(supportUrl)}" style="color:#356e75;font-size:13px;font-weight:700;text-decoration:none">${htmlEscape(label)}</a>`] : []),
    ...(validEmail ? [`<a href="mailto:${htmlEscape(validEmail)}" style="margin-left:14px;color:#356e75;font-size:13px;font-weight:700;text-decoration:none">Email support</a>`] : []),
  ];
  return { text, html: links.length ? `<footer style="padding:16px 28px 20px;border-top:1px solid #e7ecee;text-align:center">${links.join(" ")}</footer>` : "" };
}
async function createTransferInquiryUrl(userId: string, reference: string): Promise<string> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const origin = appOrigin() ?? "https://www.global-internetbanking.globus.website";
  const [existing] = await db
    .select({
      id: bankTransferInquiryLinksTable.id,
      conversationId: bankTransferInquiryLinksTable.conversationId,
      tokenEncrypted: bankTransferInquiryLinksTable.tokenEncrypted,
      expiresAt: bankTransferInquiryLinksTable.expiresAt,
      revokedAt: bankTransferInquiryLinksTable.revokedAt,
    })
    .from(bankTransferInquiryLinksTable)
    .where(and(
      eq(bankTransferInquiryLinksTable.userId, userId),
      eq(bankTransferInquiryLinksTable.transferReference, reference),
    ))
    .limit(1);

  if (existing && !existing.revokedAt && existing.expiresAt > now) {
    try {
      const token = decryptPrivateData(existing.tokenEncrypted, "transfer-inquiry-token");
      return new URL(`/transfer-inquiries/${token}`, origin).toString();
    } catch {
      // Rotate an unreadable token below rather than sending a broken link.
    }
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const tokenEncrypted = encryptPrivateData(token, "transfer-inquiry-token");
  if (existing) {
    await db.update(bankTransferInquiryLinksTable)
      .set({ tokenHash, tokenEncrypted, expiresAt, revokedAt: null })
      .where(eq(bankTransferInquiryLinksTable.id, existing.id));
  } else {
    const [conversation] = await db
      .insert(bankSupportConversationsTable)
      .values({
        userId,
        subject: `Transfer inquiry · ${reference}`,
        category: "transfer",
        transferReference: reference,
        status: "open",
        customerUnread: false,
        adminUnread: false,
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: bankSupportConversationsTable.id });
    await db.insert(bankTransferInquiryLinksTable).values({
      tokenHash,
      tokenEncrypted,
      conversationId: conversation.id,
      userId,
      transferReference: reference,
      expiresAt,
      createdAt: now,
    });
  }
  return new URL(`/transfer-inquiries/${token}`, origin).toString();
}

export async function sendTransferAlertEmail(input: {
  notificationId?: string;
  senderUserId?: string;
  recipientEmail: string;
  recipientName: string;
  bankName: string;
  destinationCountry: string;
  amount: string;
  currency: string;
  reference: string;
  status: string;
  createdAt: Date;
}): Promise<boolean> {
  let senderAddress = process.env.DUTSTAR_TRANSFER_ALERT_EMAIL_FROM?.trim() || "paymentnotification@infomail.click";
  let senderDisplayName = "Dutstar Bank Transfer Alerts";
  let globalSupportUrl: string | null = null;
  let globalSupportEmail: string | null = null;
  try {
    const [settings] = await db
      .select({
        senderAddress: bankAdminSettingsTable.transferAlertEmailFrom,
        displayName: bankAdminSettingsTable.customerEmailSenderDisplayName,
        defaultSupportUrl: bankAdminSettingsTable.defaultSupportUrl,
        supportEmail: bankAdminSettingsTable.supportEmail,
      })
      .from(bankAdminSettingsTable)
      .where(eq(bankAdminSettingsTable.id, "operations"))
      .limit(1);
    senderAddress = process.env.DUTSTAR_TRANSFER_ALERT_EMAIL_FROM?.trim() || settings?.senderAddress || senderAddress;
    senderDisplayName = settings?.displayName || senderDisplayName;
    globalSupportUrl = settings?.defaultSupportUrl ?? null;
    globalSupportEmail = settings?.supportEmail ?? null;
  } catch {
    // Use the safe, verified-domain default if the admin settings row is not readable.
  }
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(input.recipientEmail)) {
    return false;
  }
  let senderPreferences:
    | {
        email: string;
        theme: string;
        headline: string;
        backgroundColor: string;
        includeSupportLink: boolean;
        supportUrl: string | null;
        supportLabel: string;
      }
    | undefined;
  if (input.senderUserId) {
    try {
      [senderPreferences] = await db
        .select({
          email: bankUsersTable.email,
            theme: bankUsersTable.vaultEmailBannerTheme,
          headline: bankUsersTable.vaultEmailBannerHeadline,
          backgroundColor: bankUsersTable.vaultEmailBannerBackgroundColor,
          includeSupportLink: bankUsersTable.vaultEmailIncludeSupportLink,
          supportUrl: bankUsersTable.vaultEmailSupportUrl,
          supportLabel: bankUsersTable.vaultEmailSupportLabel,
        })
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, input.senderUserId))
        .limit(1);
    } catch {
      return false;
    }
  }
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(senderAddress)) return false;
  const senderHeader = `"${senderDisplayName}" <${senderAddress}>`;
  const emailThemes = {
    navy: { background: "#12385d", accent: "#d6b45e" },
    teal: { background: "#174b52", accent: "#8ad1c7" },
    gold: { background: "#40391f", accent: "#e3c66d" },
  } as const;
  const theme =
    emailThemes[senderPreferences?.theme as keyof typeof emailThemes] ?? emailThemes.navy;
  const requestedBackgroundColor = senderPreferences?.backgroundColor ?? "";
  const bannerBackgroundColor = /^#[0-9a-f]{6}$/i.test(requestedBackgroundColor)
    ? requestedBackgroundColor
    : theme.background;
  const backgroundRgb = bannerBackgroundColor
    .slice(1)
    .match(/.{2}/g)
    ?.map((component) => Number.parseInt(component, 16)) ?? [18, 56, 93];
  const backgroundLuminance =
    (0.2126 * backgroundRgb[0] +
      0.7152 * backgroundRgb[1] +
      0.0722 * backgroundRgb[2]) /
    255;
  const bannerTextColor = backgroundLuminance > 0.62 ? "#17314f" : "#ffffff";
  const headline = senderPreferences?.headline?.trim() || "A Dutstar transfer notice";
  const origin = appOrigin() ?? "https://www.global-internetbanking.globus.website";
  const configuredDefaultSupportUrl =
    normalizeSupportUrl(globalSupportUrl) ??
    normalizeSupportUrl(process.env.GLOBUS_DEFAULT_SUPPORT_URL);
  const defaultSupportUrl = new URL(configuredDefaultSupportUrl ?? "/support", origin);
  defaultSupportUrl.searchParams.set("transfer", input.reference);
  let recipientInquiryUrl: string | null = null;
  if (input.senderUserId) {
    try {
      recipientInquiryUrl = await createTransferInquiryUrl(input.senderUserId, input.reference);
    } catch {
      // Do not send a dead inquiry URL; preserve the established support fallback.
    }
  }
  const configuredSupportEmail =
    globalSupportEmail?.trim() || process.env.GLOBUS_SUPPORT_EMAIL?.trim() || null;
  const vaultSupportUrl = new URL("/private-vault/support", origin);
  vaultSupportUrl.searchParams.set("transfer", input.reference);
  const ownerSupportFooter = renderSupportFooter(
    vaultSupportUrl.toString(),
    "Open your Private Vault inbox",
    configuredSupportEmail,
  );
  const customSupportUrl = senderPreferences?.includeSupportLink
    ? normalizeSupportUrl(senderPreferences.supportUrl)
    : null;
  const supportUrl = recipientInquiryUrl ?? (customSupportUrl
    ? (() => { const custom = new URL(customSupportUrl); custom.searchParams.set("transfer", input.reference); return custom.toString(); })()
    : defaultSupportUrl.toString());
  const { text: supportText, html: supportHtml } = renderSupportFooter(
    supportUrl,
    recipientInquiryUrl ? "Inquiries" : senderPreferences?.supportLabel,
    configuredSupportEmail,
  );
  const copy = transferEmailCopy[transferLanguageForCountry(input.destinationCountry)];
  const statusText =
    input.status === "completed"
      ? copy.completed
      : input.status === "pending"
        ? copy.pending
        : input.status === "failed" || input.status === "rejected"
          ? copy.failed
          : `Dutstar record status: ${input.status}.`;
  const simulationNotice = "This is a simulated ledger notification. It does not confirm a real-world bank payment or external account credit.";
  const details = [
    `${copy.recipient}: ${input.recipientName}`,
    `${copy.destination}: ${input.bankName}, ${input.destinationCountry}`,
    `${copy.amount}: ${input.amount} ${input.currency}`,
    `${copy.reference}: ${input.reference}`,
    `${copy.status}: ${input.status}`,
    `${copy.recorded}: ${input.createdAt.toISOString()}`,
  ];
  const htmlDetails = details
    .map((line) => `<li>${htmlEscape(line)}</li>`)
    .join("");
  const idempotencyKey = `globus-transfer-${input.notificationId ?? `${input.reference}-${input.status}`}`;
  const emailMessage = {
    from: senderHeader,
    to: input.recipientEmail,
    subject: `${copy.subject} · ${input.reference}`,
    text: [
      copy.subject,
      "",
      statusText,
      "",
      ...details,
      ...(supportText ? [supportText] : []),
      simulationNotice,
      copy.safety,
    ].join("\n"),
    html: `<main style="margin:0;padding:32px 16px;background:#f1f6f7;font-family:Arial,sans-serif;color:#17314f"><section style="max-width:560px;margin:auto;background:#fff;border:1px solid #dce7ea;border-radius:18px;overflow:hidden"><header style="padding:22px 28px;background:${bannerBackgroundColor};color:${bannerTextColor}"><div style="font-size:19px;font-weight:700;letter-spacing:1px">DUTSTAR <span style="color:${theme.accent}">BANK</span></div><div style="margin-top:8px;font-size:13px;font-weight:700;color:${bannerTextColor}">${htmlEscape(headline)}</div></header><div style="padding:26px 28px"><h1 style="margin:0 0 12px;font-size:21px">${htmlEscape(copy.heading)}</h1><p style="margin:0 0 20px;line-height:1.55;color:#536a7d">${htmlEscape(statusText)}</p><ul style="padding:0 0 0 18px;line-height:1.9;color:#334b62">${htmlDetails}</ul><p style="margin:20px 0 0;font-size:11px;color:#7a8b99">${htmlEscape(simulationNotice)}</p><p style="margin:10px 0 0;font-size:11px;color:#7a8b99">${htmlEscape(copy.safety)}</p></div>${supportHtml}</section></main>`,
  };
  try {
    const ownerEmail = senderPreferences?.email?.trim() ?? null;
    const ownerEmailIsValid = Boolean(
      ownerEmail && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(ownerEmail),
    );
    const ownerMessage = ownerEmailIsValid
      ? {
          ...emailMessage,
          to: ownerEmail!,
          text: emailMessage.text.replace(supportText, ownerSupportFooter.text),
          html: emailMessage.html.replace(supportHtml, ownerSupportFooter.html),
        }
      : null;
    const sameAddress = Boolean(
      ownerEmailIsValid &&
      ownerEmail!.toLowerCase() === input.recipientEmail.toLowerCase(),
    );
    const recipientMessage = sameAddress && ownerMessage ? ownerMessage : emailMessage;
    let recipientSent = false;
    try {
      await sendResendSmtpEmail({
        apiKey: process.env.RESEND_API_KEY ?? "",
        senderAddress,
        recipientAddress: recipientMessage.to,
        senderName: senderDisplayName,
        subject: recipientMessage.subject,
        text: recipientMessage.text,
        html: recipientMessage.html,
        messageId: idempotencyKey,
      });
      recipientSent = true;
    } catch (error) {
      console.warn("Dutstar transfer email SMTP delivery failed", {
        reference: input.reference,
        error: error instanceof Error ? error.name : "UnknownError",
      });
    }
    if (!input.senderUserId || !ownerMessage) return recipientSent;
    if (sameAddress) return recipientSent;
    let ownerSent = false;
    try {
      await sendResendSmtpEmail({
        apiKey: process.env.RESEND_API_KEY ?? "",
        senderAddress,
        recipientAddress: ownerMessage.to,
        senderName: senderDisplayName,
        subject: ownerMessage.subject,
        text: ownerMessage.text,
        html: ownerMessage.html,
        messageId: `globus-transfer-owner-${input.notificationId ?? `${input.reference}-${input.status}`}`,
      });
      ownerSent = true;
    } catch (error) {
      console.warn("Dutstar transfer owner email SMTP delivery failed", {
        reference: input.reference,
        error: error instanceof Error ? error.name : "UnknownError",
      });
    }
    if (!ownerSent) {
      console.warn("Transfer owner alert email could not be delivered", {
        reference: input.reference,
      });
    }
    // The caller reports recipient delivery; an owner-copy failure must not
    // incorrectly tell the transfer recipient that their email was skipped.
    return recipientSent;
  } catch {
    return false;
  }
}

export async function sendPushToUser(
  userId: string,
  notification: Pick<
    StoredNotification,
    "title" | "body" | "reference" | "id" | "category"
  >,
): Promise<void> {
  const credentials = webpushrCredentials();
  const origin = appOrigin();
  if (!credentials || !origin) return;

  let preferences:
    | {
        transferEnabled: boolean;
        walletEnabled: boolean;
        securityEnabled: boolean;
      }
    | undefined;
  try {
    const [user] = await db
      .select({
        transferEnabled: bankUsersTable.pushTransferAlertsEnabled,
        walletEnabled: bankUsersTable.pushWalletAlertsEnabled,
        securityEnabled: bankUsersTable.pushSecurityAlertsEnabled,
      })
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, userId))
      .limit(1);
    preferences = user;
  } catch {
    return;
  }
  if (
    !preferences ||
    !isPushCategoryEnabled(notification.category, preferences)
  ) {
    return;
  }

  let subscriptions: typeof bankPushSubscriptionsTable.$inferSelect[];
  try {
    subscriptions = await db
      .select()
      .from(bankPushSubscriptionsTable)
      .where(eq(bankPushSubscriptionsTable.userId, userId));
  } catch {
    return;
  }
  await Promise.all(
    subscriptions.map(async (row) => {
      let subscriberId: string;
      try {
        subscriberId = decryptPrivateData(
          row.subscriptionEncrypted,
          "webpushr-subscriber-id",
        );
        if (!/^[A-Za-z0-9._:-]{1,160}$/.test(subscriberId)) return;
      } catch {
        return;
      }
      try {
        const response = await fetch("https://api.webpushr.com/v1/notification/send/sid", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            webpushrKey: credentials.apiKey,
            webpushrAuthToken: credentials.authToken,
          },
          body: JSON.stringify({
            title: notification.title.slice(0, 100),
            message: "You have a new account activity update. Open Dutstar to review it.",
            target_url: new URL("/notifications", origin).toString(),
            sid: subscriberId,
            icon: new URL("/globus-mark-transparent.png", origin).toString(),
            auto_hide: 1,
            expire_push: "1d",
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (response.status === 404) {
          await db
            .delete(bankPushSubscriptionsTable)
            .where(eq(bankPushSubscriptionsTable.id, row.id));
        }
      } catch {
        // Push delivery is best-effort; in-app notifications remain available.
      }
    }),
  );
}

export async function savePushSubscription(
  userId: string,
  subscriberId: string,
): Promise<string> {
  if (!/^[A-Za-z0-9._:-]{1,160}$/.test(subscriberId)) {
    throw new Error("Invalid Webpushr subscriber ID.");
  }
  const endpointHash = hashPrivateToken(subscriberId);
  const encrypted = encryptPrivateData(
    subscriberId,
    "webpushr-subscriber-id",
  );
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: bankPushSubscriptionsTable.id,
        userId: bankPushSubscriptionsTable.userId,
      })
      .from(bankPushSubscriptionsTable)
      .where(eq(bankPushSubscriptionsTable.endpointHash, endpointHash))
      .limit(1)
      .for("update");
    if (existing) {
      if (existing.userId !== userId) {
        throw new WebpushrSubscriberAlreadyLinkedError();
      }
      await tx
        .update(bankPushSubscriptionsTable)
        .set({ userId, subscriptionEncrypted: encrypted, updatedAt: new Date() })
        .where(eq(bankPushSubscriptionsTable.id, existing.id));
      return existing.id;
    }
    const [created] = await tx
      .insert(bankPushSubscriptionsTable)
      .values({
        userId,
        endpointHash,
        subscriptionEncrypted: encrypted,
      })
      .returning({ id: bankPushSubscriptionsTable.id });
    return created.id;
  });
}

export async function notifyTransferRecipient(input: {
  notificationId?: string;
  senderUserId?: string;
  encryptedEmail: string | null;
  recipientName: string;
  bankName: string;
  destinationCountry: string;
  amount: string;
  currency: string;
  reference: string;
  status: string;
  createdAt: Date;
}): Promise<boolean> {
  if (!input.encryptedEmail) return false;
  try {
    const recipientEmail = decryptPrivateData(
      input.encryptedEmail,
      "transfer-recipient-email",
    );
    return await sendTransferAlertEmail({ ...input, recipientEmail });
  } catch {
    return false;
  }
}

