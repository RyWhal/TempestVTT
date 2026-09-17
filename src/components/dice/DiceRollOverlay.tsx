import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useDiceSettingsStore } from '../../stores/diceSettingsStore';
import { useSessionStore } from '../../stores/sessionStore';
import type { DiceRoll } from '../../types';
import { buildRollPresentation, canViewRoll, type RollBatch, type RollPresentation } from './dicePresentation';
import type { DiceRenderer } from './diceRenderer';
import './DiceRollOverlay.css';

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    update();
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function DiceBatch({ roll, presentation, batch, isFinalBatch, onComplete, onDismiss }: {
  roll: DiceRoll;
  presentation: RollPresentation;
  batch: RollBatch;
  isFinalBatch: boolean;
  onComplete: () => void;
  onDismiss: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const dismissed = useRef(false);
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<'loading' | 'rolling' | 'settled' | 'fallback' | 'fading'>('loading');
  const [staticResults, setStaticResults] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let failed = false;
    let renderer: DiceRenderer | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const fallback = () => {
      if (cancelled) return;
      failed = true;
      clearTimeout(watchdog);
      renderer?.dispose();
      setStaticResults(true);
      setPhase('fallback');
    };
    setStaticResults(false);
    setPhase('loading');
    if (reducedMotion || batch.dice.length === 0) {
      fallback();
    } else {
      // Includes download/initialization failures; roll feedback must never get stuck.
      watchdog = setTimeout(fallback, 8000);
      void import('./diceRenderer').then(module => {
        if (cancelled || failed || !host.current) return;
        setPhase('rolling');
        renderer = module.createDiceRenderer(host.current, batch.dice, {
          onSettled: () => {
            if (cancelled || failed) return;
            clearTimeout(watchdog);
            setPhase('settled');
          },
          onError: fallback,
        });
      }).catch(fallback);
    }
    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      renderer?.dispose();
    };
  }, [batch, reducedMotion]);

  useEffect(() => {
    if (phase !== 'settled' && phase !== 'fallback' && phase !== 'fading') return;
    const timer = setTimeout(() => {
      if (phase === 'fading') {
        if (dismissed.current) onDismiss(); else onComplete();
      } else setPhase('fading');
    }, phase === 'fading' ? (reducedMotion ? 0 : 300) : isFinalBatch ? 12000 : staticResults ? 3000 : 1800);
    return () => clearTimeout(timer);
  }, [phase, onComplete, onDismiss, reducedMotion, staticResults, isFinalBatch]);

  useEffect(() => {
    // Listen only after settling, so the click that starts a roll cannot dismiss it.
    if (phase !== 'settled' && phase !== 'fallback') return;
    const dismissOnOutsideClick = (event: MouseEvent) => {
      const card = feedback.current;
      if (card?.contains(event.target as Node)) return;
      // The overlay is click-through; coordinates also recognize clicks over the result card.
      const bounds = card?.getBoundingClientRect();
      if (event.detail > 0 && bounds && event.clientX >= bounds.left && event.clientX <= bounds.right
          && event.clientY >= bounds.top && event.clientY <= bounds.bottom) return;
      dismissed.current = true;
      setPhase('fading');
    };
    document.addEventListener('click', dismissOnOutsideClick, { capture: true, passive: true });
    return () => document.removeEventListener('click', dismissOnOutsideClick, true);
  }, [phase]);

  const resultVisible = phase === 'settled' || phase === 'fallback' || phase === 'fading';
  const multipleAttempts = presentation.attemptCount > 1;
  const visibility = roll.visibility === 'gm_only' ? 'GM only' : roll.visibility === 'self' ? 'Only you' : null;
  return (
    <div className="map-dice-roll" data-phase={phase} data-kept={batch.kept}>
      <div className="map-dice-stage" ref={host} />
      <div ref={feedback} className="map-dice-feedback" role="status" aria-live="polite" aria-atomic="true">
        <div className="map-dice-result">
          <div className="map-dice-copy">
            <div className="map-dice-eyebrow">
              <span>{roll.characterName || roll.username}</span>
              {visibility && <span className="map-dice-tag">{visibility}</span>}
              {batch.parts > 1 && <span className="map-dice-tag">Batch {batch.part}/{batch.parts}</span>}
            </div>
            <div className="map-dice-expression">{roll.rollExpression}</div>
            <div className="map-dice-caption">
              {!resultVisible ? 'Rolling…' : multipleAttempts ? `${presentation.mode} · Attempt ${batch.attemptIndex + 1}` : 'Click elsewhere to dismiss'}
              {resultVisible && multipleAttempts && <span className={`map-dice-tag ${batch.kept ? 'map-dice-kept' : ''}`}>{batch.kept ? 'Kept' : 'Discarded'}</span>}
              {resultVisible && batch.dice.some(d => d.kind === 'percentile-tens') && <span>00 + 0 = 100</span>}
            </div>
          </div>
          <div className="map-dice-total">
            <span>{multipleAttempts ? 'Attempt' : 'Total'}</span>
            <strong>{resultVisible ? batch.total : '…'}</strong>
          </div>
        </div>
        {resultVisible && <div className={staticResults ? 'map-dice-values' : 'map-dice-values map-dice-values-compact'}>{batch.summary}</div>}
        {resultVisible && multipleAttempts && <div className="map-dice-final">Final result <strong>{presentation.total}</strong></div>}
      </div>
    </div>
  );
}

function ActiveRoll({ roll }: { roll: DiceRoll }) {
  const presentation = useMemo(() => buildRollPresentation(roll), [roll]);
  const [batchIndex, setBatchIndex] = useState(0);
  const finish = useChatStore(state => state.finishRollAnimation);
  const complete = useCallback(() => {
    if (batchIndex + 1 < presentation.batches.length) setBatchIndex(index => index + 1);
    else finish(roll.id);
  }, [batchIndex, presentation.batches.length, finish, roll.id]);
  const dismiss = useCallback(() => finish(roll.id), [finish, roll.id]);
  return <DiceBatch key={batchIndex} roll={roll} presentation={presentation} batch={presentation.batches[batchIndex]} isFinalBatch={batchIndex === presentation.batches.length - 1} onComplete={complete} onDismiss={dismiss} />;
}

export function DiceRollOverlay({ drawerOpen }: { drawerOpen: boolean }) {
  const roll = useChatStore(state => state.rollAnimationQueue[0]);
  const finish = useChatStore(state => state.finishRollAnimation);
  const sessionId = useSessionStore(state => state.session?.id);
  const viewer = useSessionStore(state => state.currentUser);
  const enabled = useDiceSettingsStore(state => state.showDiceAnimations);
  const clearAnimations = useChatStore(state => state.clearRollAnimations);
  const visible = enabled && roll && canViewRoll(roll, sessionId, viewer);
  useEffect(() => {
    if (!enabled && roll) clearAnimations();
    else if (roll && !visible) finish(roll.id);
  }, [roll, visible, finish, enabled, clearAnimations]);
  if (!roll || !visible) return null;
  return (
    <div className="map-dice-overlay" data-drawer={drawerOpen} data-testid="map-dice-overlay">
      <ActiveRoll key={`${sessionId}-${roll.id}-${viewer?.username}-${viewer?.isGm}`} roll={roll} />
    </div>
  );
}
