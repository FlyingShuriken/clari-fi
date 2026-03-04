import { HeuristicExpenseParserProvider } from '../src/infrastructure/providers/expense-parser.provider';

describe('HeuristicExpenseParserProvider', () => {
  const provider = new HeuristicExpenseParserProvider();

  it('parses a voice transcript into structured expense', async () => {
    const result = await provider.parseVoiceTranscript(
      'Spent RM 10 at pasar to buy watermelon 2 kg, paid with TNG for Jimmy',
    );

    expect(result.totalAmount).toBe(10);
    expect(result.paymentMethod).toBe('TNG');
    expect(result.note?.toLowerCase()).toContain('jimmy');
    expect(result.lineItems[0]?.descriptionRaw.toLowerCase()).toContain('watermelon');
    expect(result.lineItems[0]?.quantity).toBe(2);
    expect(result.lineItems[0]?.unitRaw).toBe('kg');
    expect(result.lineItems[0]?.unitPrice).toBe(5);
    expect(result.confidenceMap.totalAmount).toBeGreaterThan(0.8);
  });

  it('parses receipt text into line items and total', async () => {
    const receipt = await provider.parseReceipt(
      'PASAR\nFish RM 5.00\nVegetable RM 3.50\nTOTAL RM 8.50',
    );

    expect(receipt.lineItems).toHaveLength(2);
    expect(receipt.totalAmount).toBe(8.5);
    expect(receipt.currency).toBe('MYR');
  });
});
