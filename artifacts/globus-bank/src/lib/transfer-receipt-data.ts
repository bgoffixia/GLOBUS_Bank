import type {
  BankTransaction,
  InternationalTransferRequest,
} from '@workspace/api-client-react';

export type ReceiptConversion = {
  sourceAmount: string;
  sourceCurrency: string;
  exchangeRate: string;
  destinationAmount: string;
  destinationCurrency: string;
};

export type ReceiptTransaction = BankTransaction & {
  conversion?: ReceiptConversion;
  sender?: { name: string; walletLast4: string };
  recipient?: {
    name: string;
    bank: string;
    country: string;
    route: string;
    account: string;
    transferType: string;
    routingCode: string | null;
    swiftBic: string | null;
    remark: string;
  };
};

/** Transfer responses carry the layout snapshot captured when the transfer was created. */
export function receiptFromRequest(
  request: InternationalTransferRequest,
): ReceiptTransaction {
  const typeLabel =
    request.transferType === 'local_routing'
      ? 'Local routing'
      : 'International wire';
  return {
    id: request.id,
    reference: request.reference,
    type: 'external_transfer',
    status: request.status,
    receiptTemplate: request.receiptTemplate,
    currency: request.sourceCurrency,
    amount: request.sourceAmount,
    fee: '0.00',
    counterparty: `${request.recipientBank} · ****${request.recipientAccountLast4} · ${request.destinationCountry}`,
    description: `${typeLabel} transfer · ${request.sourceAmount} ${request.sourceCurrency} converted to ${request.destinationAmount} ${request.destinationCurrency} at ${request.exchangeRate}`,
    mode: 'internal_ledger',
    createdAt: request.createdAt,
    conversion: {
      sourceAmount: request.sourceAmount,
      sourceCurrency: request.sourceCurrency,
      exchangeRate: request.exchangeRate,
      destinationAmount: request.destinationAmount,
      destinationCurrency: request.destinationCurrency,
    },
    sender: {
      name: request.senderName || 'Globus member',
      walletLast4: request.sourceWalletLast4,
    },
    recipient: {
      name: request.recipientAccountName,
      bank: request.recipientBank,
      country: request.destinationCountry,
      route: typeLabel,
      account: `••••••${request.recipientAccountLast4}`,
      transferType: request.transferType,
      routingCode: request.routingCode,
      swiftBic: request.swiftBic,
      remark: request.remark,
    },
  };
}
