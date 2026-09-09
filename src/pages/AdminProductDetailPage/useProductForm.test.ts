import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useProductForm, validateForm, createEmptyVariant } from './useProductForm';

/*
 * The form state, on its own. Most of this was reachable only by driving the
 * whole page, which meant the fiddliest part of it - error keys being renumbered
 * when a variant is removed - was exercised incidentally rather than stated.
 */
describe('useProductForm', () => {
  function withVariants(count: number) {
    const { result } = renderHook(() => useProductForm(() => {}));
    act(() => {
      for (let i = 0; i < count; i++) result.current.handleAddVariant();
    });
    return result;
  }

  it('renumbers errors when a variant is removed', () => {
    // Errors are keyed by position, so deleting the first of three left the
    // second one wearing the third one's error.
    const result = withVariants(3);
    // Separate acts: validate() reads the form from its own render, so an edit
    // batched with it would be validated against the state before the edit.
    act(() => result.current.handleVariantChange(2, 'catalog_id', 'THIRD'));
    act(() => {
      result.current.validate();
    });
    // Variants 0 and 1 are empty and flagged; 2 is filled in and is not.
    expect(result.current.formErrors['variant_0_catalog_id']).toBeDefined();
    expect(result.current.formErrors['variant_1_catalog_id']).toBeDefined();
    expect(result.current.formErrors['variant_2_catalog_id']).toBeUndefined();

    act(() => result.current.handleRemoveVariant(0));

    // Everything shifts down one: the old 1 is now 0 and keeps its error, and
    // the old 2 is now 1 and still has none.
    expect(result.current.form.variants).toHaveLength(2);
    expect(result.current.formErrors['variant_0_catalog_id']).toBeDefined();
    expect(result.current.formErrors['variant_1_catalog_id']).toBeUndefined();
    expect(result.current.formErrors['variant_2_catalog_id']).toBeUndefined();
  });

  it('drops the removed variant’s own errors rather than shifting them', () => {
    const result = withVariants(2);
    act(() => result.current.validate());
    expect(result.current.formErrors['variant_0_price']).toBeDefined();

    act(() => result.current.handleRemoveVariant(1));

    expect(result.current.formErrors['variant_1_price']).toBeUndefined();
    expect(result.current.formErrors['variant_0_price']).toBeDefined();
  });

  it('clears a field’s error as it is corrected, not at the next submit', () => {
    const { result } = renderHook(() => useProductForm(() => {}));
    act(() => result.current.validate());
    expect(result.current.formErrors.name).toBeDefined();

    act(() => result.current.handleFieldChange('name', 'A product'));

    expect(result.current.formErrors.name).toBeUndefined();
  });

  it('tells the page an edit happened, so a stale save error can go', () => {
    // A save error describes a request that whatever is being typed has already
    // superseded; leaving it up makes the form look broken while it is fixed.
    const onEdited = vi.fn();
    const { result } = renderHook(() => useProductForm(onEdited));

    act(() => result.current.handleFieldChange('name', 'x'));
    expect(onEdited).toHaveBeenCalled();
  });

  it('toggles a tag on and back off', () => {
    const { result } = renderHook(() => useProductForm(() => {}));

    act(() => result.current.handleToggleTag('t1'));
    expect(result.current.form.tag_ids).toEqual(['t1']);

    act(() => result.current.handleToggleTag('t1'));
    expect(result.current.form.tag_ids).toEqual([]);
  });
});

describe('validateForm', () => {
  it('requires an opening count on a new variant only', () => {
    // Write-once: an existing variant's stock is not editable on this form at
    // all, and the server rejects it, so demanding it here would block a save
    // that is otherwise perfectly valid.
    const base = { cat_id: 'C', name: 'N', description: 'D', tag_ids: [] };
    const variant = {
      ...createEmptyVariant(),
      catalog_id: 'V',
      size_value: '5',
      size_unit: 'mL',
      price: '1',
      stock: '',
    };

    const asNew = validateForm({ ...base, variants: [variant] });
    expect(asNew['variant_0_stock']).toBeDefined();

    const asExisting = validateForm({ ...base, variants: [{ ...variant, id: 'v1' }] });
    expect(asExisting['variant_0_stock']).toBeUndefined();
  });

  it('rejects a size of zero, which would be a variant of nothing', () => {
    const errors = validateForm({
      cat_id: 'C',
      name: 'N',
      description: 'D',
      tag_ids: [],
      variants: [{ ...createEmptyVariant(), catalog_id: 'V', size_value: '0', size_unit: 'mL', price: '1', stock: '1' }],
    });

    expect(errors['variant_0_size_value']).toMatch(/greater than 0/i);
  });
});
