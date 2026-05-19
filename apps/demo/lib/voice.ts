"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Web Speech API wrapped as a React hook. No deps. Falls back gracefully
 * when the browser doesn't expose `SpeechRecognition` (Safari pre-16,
 * Firefox). The transcript streams as the user speaks.
 */

type SR = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SRConstructor = new () => SR;

function getSRConstructor(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseVoiceResult {
  supported: boolean;
  listening: boolean;
  transcript: string;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useVoice(onFinal?: (text: string) => void): UseVoiceResult {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SR | null>(null);

  useEffect(() => {
    setSupported(getSRConstructor() !== null);
  }, []);

  const start = () => {
    const Ctor = getSRConstructor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result && result[0]) text += result[0].transcript;
      }
      setTranscript(text);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      // Use the latest transcript via a microtask so React state has settled.
      queueMicrotask(() => {
        setTranscript((current) => {
          if (current && onFinal) onFinal(current);
          return current;
        });
      });
    };
    recognitionRef.current = rec;
    setTranscript("");
    setListening(true);
    rec.start();
  };

  const stop = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const reset = () => {
    setTranscript("");
  };

  return { supported, listening, transcript, start, stop, reset };
}
