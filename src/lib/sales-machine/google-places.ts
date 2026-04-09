import type { LeadSearchInput } from "@/lib/sales-machine/types";
import { sleep } from "@/lib/sales-machine/utils";

type GoogleGeocodeResponse = {
  results?: Array<{
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
};

type GooglePlacesResponse = {
  places?: Array<{
    id: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    websiteUri?: string;
    rating?: number;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    location?: { latitude?: number; longitude?: number };
  }>;
  nextPageToken?: string;
};

export type LeadSeed = {
  id: string;
  companyName: string;
  address: string;
  websiteUri: string | null;
  rating: number | null;
  nationalPhoneNumber: string | null;
  internationalPhoneNumber: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type SearchPageProgress = {
  pageCount: number;
  leadsCollected: number;
  nextPageToken: string | null;
};

const fieldMask = [
  "places.displayName",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.formattedAddress",
  "places.id",
  "places.rating",
  "places.location",
  "nextPageToken",
].join(",");

async function geocodeLocation(location: string, apiKey: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", location);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Geocoding failed with status ${response.status}`);
  }

  const data = (await response.json()) as GoogleGeocodeResponse;
  const coordinates = data.results?.[0]?.geometry?.location;

  if (!coordinates?.lat || !coordinates?.lng) {
    return null;
  }

  return { latitude: coordinates.lat, longitude: coordinates.lng };
}

async function searchPlacesPage({
  apiKey,
  query,
  radiusMeters,
  pageToken,
  locationBias,
}: {
  apiKey: string;
  query: string;
  radiusMeters: number;
  pageToken?: string;
  locationBias: { latitude: number; longitude: number } | null;
}) {
  const body: Record<string, unknown> = {
    textQuery: query,
  };

  if (locationBias) {
    body.locationBias = {
      circle: {
        center: locationBias,
        radius: radiusMeters,
      },
    };
  }

  if (pageToken) {
    body.pageToken = pageToken;
  }

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Places search failed (${response.status}): ${text}`);
  }

  return (await response.json()) as GooglePlacesResponse;
}

export async function discoverLeadsWithGooglePlaces(
  apiKey: string,
  input: LeadSearchInput,
  options?: {
    onPageProgress?: (progress: SearchPageProgress) => Promise<void> | void;
  },
) {
  const query = `${input.niche} in ${input.location}`;
  const warnings: string[] = [];
  const seen = new Set<string>();
  const leads: LeadSeed[] = [];

  let locationBias: { latitude: number; longitude: number } | null = null;

  try {
    locationBias = await geocodeLocation(input.location, apiKey);
  } catch {
    warnings.push(
      "Geocoding failed, so the search fell back to text-only query matching for the location.",
    );
  }

  let nextPageToken: string | undefined;
  let pageCount = 0;
  let exhaustiveCapWarningAdded = false;

  do {
    if (nextPageToken) {
      await sleep(2500);
    }

    const data = await searchPlacesPage({
      apiKey,
      query,
      radiusMeters: input.radiusMeters,
      pageToken: nextPageToken,
      locationBias,
    });

    pageCount += 1;

    for (const place of data.places ?? []) {
      if (!place.id || seen.has(place.id)) {
        continue;
      }

      seen.add(place.id);
      leads.push({
        id: place.id,
        companyName: place.displayName?.text?.trim() || "Unknown company",
        address: place.formattedAddress?.trim() || "No address returned",
        websiteUri: place.websiteUri?.trim() || null,
        rating: typeof place.rating === "number" ? place.rating : null,
        nationalPhoneNumber: place.nationalPhoneNumber?.trim() || null,
        internationalPhoneNumber: place.internationalPhoneNumber?.trim() || null,
        latitude:
          typeof place.location?.latitude === "number" ? place.location.latitude : null,
        longitude:
          typeof place.location?.longitude === "number" ? place.location.longitude : null,
      });

      if (leads.length >= input.maxLeads) {
        break;
      }
    }

    const hasReachedCap = leads.length >= input.maxLeads;

    if (
      input.searchMode === "exhaustive" &&
      hasReachedCap &&
      data.nextPageToken &&
      !exhaustiveCapWarningAdded
    ) {
      warnings.push(
        "The exhaustive search hit the safety cap before Google ran out of pages. Increase the cap if you want to keep going.",
      );
      exhaustiveCapWarningAdded = true;
    }

    nextPageToken = hasReachedCap ? undefined : data.nextPageToken?.trim() || undefined;

    await options?.onPageProgress?.({
      pageCount,
      leadsCollected: leads.length,
      nextPageToken: nextPageToken ?? null,
    });
  } while (nextPageToken);

  return {
    leads,
    pageCount,
    warnings,
  };
}
