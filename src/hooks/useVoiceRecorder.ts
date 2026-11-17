import { useCallback, useEffect, useRef, useState } from 'react';
import type { LanguageCode } from '../types/civic';

interface UseVoiceRecorderOptions {
  language: LanguageCode;
  purpose: 'report' | 'chat';
  onTranscript: (text: string) => void;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read recorded audio data.'));
    reader.readAsDataURL(blob);
  });
}

export function useVoiceRecorder({
  language,
  purpose,
  onTranscript,
}: UseVoiceRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      cleanupStream();
    };
  }, [cleanupStream]);

  const startRecording = useCallback(async () => {
    setError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';

      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        cleanupStream();
        setIsRecording(false);

        const mimeType = (recorder.mimeType || 'audio/webm').split(';')[0];
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (audioBlob.size < 256) {
          setError('Recording was too short. Please speak clearly for at least 1 second.');
          return;
        }

        setIsTranscribing(true);
        try {
          const audioBase64 = await blobToBase64(audioBlob);
          const response = await fetch('/api/gemini/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64,
              mimeType,
              language,
              purpose,
            }),
          });

          const payload = (await response.json()) as {
            transcript?: string;
            error?: string;
          };

          if (!response.ok) {
            throw new Error(payload.error || 'Audio transcription failed.');
          }

          const transcript = (payload.transcript || '').trim();
          if (!transcript) {
            setError('No clear speech detected in recording. Please try again.');
            return;
          }

          onTranscript(transcript);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : 'Unable to transcribe audio recording.'
          );
        } finally {
          setIsTranscribing(false);
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      cleanupStream();
      setIsRecording(false);
      setError(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Microphone access denied. Enable microphone permission to dictate.'
          : 'Could not start microphone recording.'
      );
    }
  }, [cleanupStream, language, onTranscript, purpose]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else if (!isTranscribing) {
      void startRecording();
    }
  }, [isRecording, isTranscribing, startRecording, stopRecording]);

  return {
    isRecording,
    isTranscribing,
    error,
    clearError: () => setError(null),
    toggleRecording,
    stopRecording,
  };
}
