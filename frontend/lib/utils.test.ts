import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('merges basic string classes', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
  });

  it('handles conditional classes (objects)', () => {
    expect(cn('class1', { 'class2': true, 'class3': false })).toBe('class1 class2');
  });

  it('resolves Tailwind CSS conflicts (twMerge)', () => {
    // py-2 vs py-4 -> py-4 should win
    expect(cn('py-2 px-4', 'py-4')).toBe('px-4 py-4');
  });

  it('handles arrays and nested structures', () => {
    expect(cn(['class1', 'class2'], ['class3', ['class4']])).toBe('class1 class2 class3 class4');
  });

  it('ignores falsy values', () => {
    expect(cn('class1', null, undefined, false, 0, '')).toBe('class1');
  });

  it('complex combinations', () => {
    const isHovered = true;
    const isDisabled = false;

    expect(cn(
      'base-class p-2',
      isHovered && 'hover:bg-blue-500',
      isDisabled ? 'opacity-50' : 'opacity-100',
      { 'text-white': isHovered, 'text-gray-500': !isHovered },
      ['nested-class', 'm-4'] // m-4 will not conflict with p-2
    )).toBe('base-class p-2 hover:bg-blue-500 opacity-100 text-white nested-class m-4');
  });
});
