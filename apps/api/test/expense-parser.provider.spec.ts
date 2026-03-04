import { HeuristicExpenseParserProvider } from '../src/infrastructure/providers/expense-parser.provider';

describe('HeuristicExpenseParserProvider', () => {
  const provider = new HeuristicExpenseParserProvider();

  it('parses a voice transcript into structured expense', async () => {
    const result = await provider.parseVoiceTranscript(
      'Spent RM 5 at pasar to buy fish, paid with TNG',
    );

    expect(result.totalAmount).toBe(5);
    expect(result.paymentMethod).toBe('TNG');
    expect(result.lineItems[0]?.descriptionRaw.toLowerCase()).toContain('fish');
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
