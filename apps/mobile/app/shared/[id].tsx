import React, { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function SharedMeetingPointScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (id) {
      // Redirect to main page with share parameter
      router.replace(`/?share=${id}`);
    } else {
      // If no ID, just go to home
      router.replace('/');
    }
  }, [id, router]);

  // This component just redirects, so return null
  return null;
} 