import { dedupeServicesByCategoryAndName } from './serviceDedupe';

describe('dedupeServicesByCategoryAndName', () => {
  it('dedupes by category master + name (case/space insensitive)', () => {
    const items = [
      { id: 'a', name: 'Fan Fitting', categoryMasterId: 'cat1' },
      { id: 'b', name: ' fan fitting ', categoryMasterId: 'cat1' },
      { id: 'c', name: 'Fan Fitting', categoryMasterId: 'cat2' },
    ];

    const out = dedupeServicesByCategoryAndName(items);
    expect(out.map((x) => x.id)).toEqual(['a', 'c']);
  });

  it('keeps first occurrence order', () => {
    const items = [
      { id: '1', name: 'X', categoryMasterId: 'cat' },
      { id: '2', name: 'X', categoryMasterId: 'cat' },
      { id: '3', name: 'Y', categoryMasterId: 'cat' },
    ];

    const out = dedupeServicesByCategoryAndName(items);
    expect(out.map((x) => x.id)).toEqual(['1', '3']);
  });
});
