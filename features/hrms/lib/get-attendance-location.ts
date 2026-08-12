export type AttendanceLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

function mapGeoError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Location permission denied. Allow location access to check in or out.";
    case err.POSITION_UNAVAILABLE:
      return "Location unavailable. Try again near a window or with GPS on.";
    case err.TIMEOUT:
      return "Location timed out. Try again.";
    default:
      return "Could not read your location. Try again.";
  }
}

/** Browser GPS for attendance punch. Requires HTTPS or localhost. */
export function getAttendanceLocation(): Promise<AttendanceLocation> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Location is only available in the browser"));
  }
  if (!window.isSecureContext) {
    return Promise.reject(
      new Error("Use HTTPS or localhost to share location for check-in")
    );
  }
  if (!navigator.geolocation) {
    return Promise.reject(
      new Error("This device or browser does not support location")
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const raw = pos.coords.accuracy;
        const accuracy =
          typeof raw === "number" &&
          Number.isFinite(raw) &&
          raw >= 0 &&
          raw <= 50_000
            ? raw
            : undefined;
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          ...(accuracy !== undefined ? { accuracy } : {}),
        });
      },
      (err) => reject(new Error(mapGeoError(err))),
      {
        enableHighAccuracy: true,
        timeout: 20_000,
        maximumAge: 0,
      }
    );
  });
}

export function openStreetMapUrl(lat: number, lng: number): string {
  const zoom = 16;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
