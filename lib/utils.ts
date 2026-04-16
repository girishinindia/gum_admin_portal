import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined, format = 'MMM D, YYYY h:mm A') {
  if (!date) return '—';
  return dayjs(date).format(format);
}

export function fromNow(date: string | Date | null | undefined) {
  if (!date) return '—';
  return dayjs(date).fromNow();
}

export function initials(name: string) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function maskValue(val: string, show = 3) {
  if (!val) return '';
  return val.slice(0, show) + '•'.repeat(Math.max(0, val.length - show * 2)) + val.slice(-show);
}
