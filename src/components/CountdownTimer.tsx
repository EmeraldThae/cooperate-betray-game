import React, { useState, useEffect, useRef } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { playSound } from '../utils/audio';

interface CountdownTimerProps {
  startedAt: string | null | undefined;
  durationSeconds: number;
  onTimeout?: () => void;
  isPaused?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  startedAt,
  durationSeconds,
  onTimeout,
  isPaused = false,
  size = 'md',
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(durationSeconds);
  const timeoutTriggeredRef = useRef(false);
  const lastTickSecondRef = useRef<number | null>(null);

  useEffect(() => {
    timeoutTriggeredRef.current = false;
    lastTickSecondRef.current = null;
  }, [startedAt]);

  useEffect(() => {
    if (!startedAt || isPaused) return;

    const interval = setInterval(() => {
      const startTime = new Date(startedAt).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, durationSeconds - elapsed);

      setTimeLeft(remaining);

      // Play tick sound for last 5 seconds
      if (remaining <= 5 && remaining > 0 && lastTickSecondRef.current !== remaining) {
        lastTickSecondRef.current = remaining;
        playSound('tick');
      }

      if (remaining === 0 && !timeoutTriggeredRef.current) {
        timeoutTriggeredRef.current = true;
        playSound('timeout');
        if (onTimeout) onTimeout();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [startedAt, durationSeconds, isPaused, onTimeout]);

  const percentage = Math.max(0, Math.min(100, (timeLeft / durationSeconds) * 100));
  const isUrgent = timeLeft <= 10;
  const isCritical = timeLeft <= 5;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (size === 'sm') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-mono text-xs font-bold border transition ${
        isCritical
          ? 'bg-rose-950/80 text-rose-300 border-rose-500 animate-pulse'
          : isUrgent
          ? 'bg-amber-950/70 text-amber-300 border-amber-500'
          : 'bg-slate-800 text-slate-200 border-slate-700'
      }`}>
        <Clock className="w-3.5 h-3.5" />
        <span>{formatTime(timeLeft)}</span>
      </div>
    );
  }

  if (size === 'lg') {
    return (
      <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
        <div className="text-xs uppercase tracking-widest font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
          {isCritical ? <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" /> : <Clock className="w-4 h-4 text-indigo-400" />}
          Time Remaining
        </div>
        <div className={`font-mono text-5xl md:text-6xl font-black tracking-tight transition ${
          isCritical
            ? 'text-rose-500 animate-pulse scale-105'
            : isUrgent
            ? 'text-amber-400'
            : 'text-white'
        }`}>
          {formatTime(timeLeft)}
        </div>
        
        {/* Visual Progress Track */}
        <div className="w-full max-w-xs h-2 bg-slate-800 rounded-full mt-4 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isCritical ? 'bg-rose-500' : isUrgent ? 'bg-amber-400' : 'bg-indigo-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition ${
      isCritical
        ? 'bg-rose-950/60 border-rose-500 text-rose-300 animate-pulse'
        : isUrgent
        ? 'bg-amber-950/50 border-amber-500/80 text-amber-300'
        : 'bg-slate-800/80 border-slate-700 text-slate-200'
    }`}>
      <Clock className={`w-5 h-5 ${isCritical ? 'text-rose-400' : isUrgent ? 'text-amber-400' : 'text-indigo-400'}`} />
      <div>
        <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Decision Timer</div>
        <div className="font-mono text-xl font-black leading-none">{formatTime(timeLeft)}</div>
      </div>
    </div>
  );
};
