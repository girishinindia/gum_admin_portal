"use client";
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Exercise Translations page is now integrated into the Exercises page.
// This page redirects to /exercises.
export default function CreateExercisePage() {
  const router = useRouter();
  useEffect(() => { router.replace('/exercises'); }, [router]);
  return (
    <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
      <p>Redirecting to Exercises...</p>
    </div>
  );
}
