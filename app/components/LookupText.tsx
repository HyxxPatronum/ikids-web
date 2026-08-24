'use client';

import { useMemo, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { buildLookupText } from '../../lib/lookup/text';
import type { LookupTermAnnotation } from '../../lib/lookup/text';
import { useLookup } from './Lookup';
import styles from './LookupText.module.css';

export function LookupText({ text, terms, courseId }: { text: string; terms: LookupTermAnnotation[]; courseId: string }) {
  const parts = useMemo(() => buildLookupText(text, terms), [text, terms]);
  const wordRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { lookup } = useLookup();

  const move = (event: KeyboardEvent<HTMLElement>, direction: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const current = wordRefs.current.findIndex(node => node === document.activeElement);
    const next = current < 0 ? (direction > 0 ? 0 : wordRefs.current.length - 1) : current + direction;
    wordRefs.current[Math.max(0, Math.min(wordRefs.current.length - 1, next))]?.focus();
  };

  let wordIndex = 0;
  return <span className={styles.sentence} tabIndex={0} aria-label={text.trim()} onKeyDown={event => move(event, event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1)}>
    {parts.map((part, index) => {
      if (part.type === 'text') return <span key={index}>{part.text}</span>;
      const referenceIndex = wordIndex++;
      const isPhrase = part.alternateScopes.length > 1;
      return <button
        key={index}
        ref={node => { wordRefs.current[referenceIndex] = node; }}
        className={`${styles.word} ${isPhrase ? styles.phrase : ''}`}
        type="button"
        tabIndex={-1}
        aria-label={`查询 ${part.defaultScope}${isPhrase ? `，当前单词 ${part.surfaceForm}` : ''}`}
        onClick={event => lookup({
          surfaceForm: part.surfaceForm,
          scope: part.defaultScope,
          alternateScopes: part.alternateScopes,
          courseId,
          sentence: text.trim(),
        }, event.currentTarget)}
      >{part.surfaceForm}</button>;
    })}
  </span>;
}
