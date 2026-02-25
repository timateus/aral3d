import { useState, useEffect } from 'react';

export interface UserLocation {
  lat: number;
  lon: number;
}

export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (err) => {
        setError(err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  return { location, error };
}
