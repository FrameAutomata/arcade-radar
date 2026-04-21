const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MapboxFeature {
  properties?: {
    coordinates?: {
      latitude?: number;
      longitude?: number;
    };
    full_address?: string;
    name?: string;
    place_formatted?: string;
  };
  geometry?: {
    coordinates?: [number, number];
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const { query } = await request.json().catch(() => ({ query: '' }));
  const normalizedQuery =
    typeof query === 'string' ? query.trim() : '';

  if (!normalizedQuery) {
    return jsonResponse({ error: 'A location query is required.' }, 400);
  }

  const accessToken = Deno.env.get('MAPBOX_ACCESS_TOKEN');

  if (!accessToken) {
    return jsonResponse(
      { error: 'MAPBOX_ACCESS_TOKEN is not configured.' },
      500
    );
  }

  const mapboxUrl = new URL('https://api.mapbox.com/search/geocode/v6/forward');
  mapboxUrl.searchParams.set('q', normalizedQuery);
  mapboxUrl.searchParams.set('access_token', accessToken);
  mapboxUrl.searchParams.set('country', 'US');
  mapboxUrl.searchParams.set('limit', '1');
  mapboxUrl.searchParams.set(
    'types',
    'address,postcode,place,locality,neighborhood,region'
  );

  const mapboxResponse = await fetch(mapboxUrl);

  if (!mapboxResponse.ok) {
    const errorText = await mapboxResponse.text();

    return jsonResponse(
      {
        error: 'Geocoding provider request failed.',
        details: errorText,
      },
      502
    );
  }

  const mapboxData = await mapboxResponse.json();
  const feature = mapboxData?.features?.[0] as MapboxFeature | undefined;

  if (!feature) {
    return jsonResponse({ error: 'No matching location found.' }, 404);
  }

  const latitude =
    feature.properties?.coordinates?.latitude ??
    feature.geometry?.coordinates?.[1];
  const longitude =
    feature.properties?.coordinates?.longitude ??
    feature.geometry?.coordinates?.[0];

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return jsonResponse({ error: 'Provider returned invalid coordinates.' }, 502);
  }

  const label = [
    feature.properties?.full_address,
    feature.properties?.name,
    feature.properties?.place_formatted,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' • ');

  return jsonResponse({
    label: label || normalizedQuery,
    latitude,
    longitude,
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  });
}
