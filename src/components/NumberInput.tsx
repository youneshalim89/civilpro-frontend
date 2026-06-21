'use client';
import { useState, useEffect, useRef } from 'react';

interface NumberInputProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  autoFocus?: boolean;
}

// Champ numérique avec séparateur de milliers à l'affichage, et cellule vide
// (au lieu de "0") pour faciliter la saisie.
function formatGrouped(n: number): string {
  if (!n && n !== 0) return '';
  const [intPart, decPart] = Math.abs(n).toFixed(decPlaces(n)).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const sign = n < 0 ? '-' : '';
  return decPart ? `${sign}${grouped},${decPart}` : `${sign}${grouped}`;
}

function decPlaces(n: number): number {
  const s = String(n);
  const i = s.indexOf('.');
  return i === -1 ? 0 : Math.min(3, s.length - i - 1);
}

function parseInput(s: string): number {
  const cleaned = s.replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export default function NumberInput({ value, onChange, className, placeholder, min, max, disabled, autoFocus }: NumberInputProps) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused) setRaw(value ? formatGrouped(value) : '');
  }, [value, focused]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      value={focused ? raw : (value ? formatGrouped(value) : '')}
      onFocus={(e) => {
        setFocused(true);
        setRaw(value ? String(value).replace('.', ',') : '');
        e.target.select();
      }}
      onBlur={() => {
        setFocused(false);
        let n = parseInput(raw);
        if (min !== undefined) n = Math.max(min, n);
        if (max !== undefined) n = Math.min(max, n);
        if (n !== value) onChange(n);
      }}
      onChange={(e) => {
        const v = e.target.value;
        if (v !== '' && !/^-?[\d\s]*[,.]?\d*$/.test(v)) return;
        setRaw(v);
        onChange(parseInput(v));
      }}
    />
  );
}
