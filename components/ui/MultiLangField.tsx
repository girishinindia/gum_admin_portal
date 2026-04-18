'use client';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Declare the global MultiLangInput object loaded from              */
/*  /public/js/multi-lang-input.js via <Script>                       */
/* ------------------------------------------------------------------ */
declare global {
  interface Window {
    MultiLangInput?: {
      init: (id: string, langCode: string) => any;
      setLanguage: (id: string, langCode: string) => void;
      stopRecording: () => void;
      resetAll: () => void;
      isSpeechSupported: () => boolean;
      LANGUAGES: Record<string, { name: string; native: string; speechCode: string; transliterate: boolean }>;
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Map ISO 639-1 codes → MultiLangInput language keys                */
/* ------------------------------------------------------------------ */
export const ISO_TO_MLI: Record<string, string> = {
  hi: 'hi', gu: 'gu', mr: 'mr', ta: 'ta', te: 'te',
  kn: 'kn', ml: 'ml', bn: 'bn', pa: 'pa', or: 'or',
  sa: 'sa', en: 'en',
};

/* ------------------------------------------------------------------ */
/*  Helper: initialise MLI fields that exist in the DOM               */
/*  Call from a useEffect in the page whenever dialog / tab changes.  */
/* ------------------------------------------------------------------ */
export function initMLIFields(fieldIds: string[], isoCode: string) {
  const lang = ISO_TO_MLI[(isoCode || '').toLowerCase()] || 'en';
  if (!window.MultiLangInput) return;
  fieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) window.MultiLangInput!.init(id, lang);
  });
}

export function setMLILanguage(fieldIds: string[], isoCode: string) {
  const lang = ISO_TO_MLI[(isoCode || '').toLowerCase()] || 'en';
  if (!window.MultiLangInput) return;
  fieldIds.forEach(id => {
    window.MultiLangInput!.setLanguage(id, lang);
  });
}

/* ------------------------------------------------------------------ */
/*  Component props                                                    */
/* ------------------------------------------------------------------ */
interface MultiLangFieldProps {
  /** Render as <textarea> instead of <input> */
  multiline?: boolean;
  /** Label above the field */
  label?: string;
  /** Helper text below the field */
  hint?: string;
  /** Error message */
  error?: string;
  /** Unique id (required — used by initMLIFields) */
  id: string;
  /** className for the input/textarea element */
  className?: string;
  /** All other native input/textarea attributes (from register, etc.) */
  [key: string]: any;
}

/* ------------------------------------------------------------------ */
/*  MultiLangField – renders a styled input/textarea.                  */
/*  The parent page calls initMLIFields() to attach transliteration    */
/*  + speech after the DOM is ready (dialog open / tab switch).        */
/* ------------------------------------------------------------------ */
export const MultiLangField = forwardRef<HTMLInputElement | HTMLTextAreaElement, MultiLangFieldProps>(
  ({ multiline = false, label, hint, error, id, className, ...rest }, ref) => {

    const inputCls = cn(
      'w-full px-3 text-sm rounded-lg border bg-white transition-colors',
      'border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none',
      'placeholder:text-slate-400 disabled:bg-slate-50 disabled:cursor-not-allowed',
      multiline ? 'py-2 min-h-[80px]' : 'h-10',
      error && 'border-red-300 focus:border-red-500 focus:ring-red-500/20',
      className,
    );

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">
            {label}
          </label>
        )}
        {multiline ? (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            id={id}
            className={inputCls}
            autoComplete="off"
            {...rest}
          />
        ) : (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            id={id}
            className={inputCls}
            autoComplete="off"
            {...rest}
          />
        )}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
    );
  }
);

MultiLangField.displayName = 'MultiLangField';
