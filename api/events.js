// Vercel Serverless Function - Eventbrite API Proxy
// 環境変数 EVENTBRITE_API_KEY を Vercel Dashboard で設定してください

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { lat, lng, radius = '8km' } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  const apiKey = process.env.EVENTBRITE_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    // Eventbrite API で近くのイベントを検索
    const url = new URL('https://www.eventbriteapi.com/v3/events/search/');
    url.searchParams.append('location.latitude', lat);
    url.searchParams.append('location.longitude', lng);
    url.searchParams.append('location.within', radius);
    url.searchParams.append('sort_by', 'date');
    url.searchParams.append('expand', 'venue,organizer');
    url.searchParams.append('page_size', '30');

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Eventbrite API error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: 'Eventbrite API error',
        details: errorText 
      });
    }

    const data = await response.json();

    // レスポンスを整形
    const events = (data.events || []).map(event => ({
      id: event.id,
      name: event.name?.text || 'イベント名なし',
      description: event.description?.text || '',
      start: event.start?.local || null,
      end: event.end?.local || null,
      url: event.url,
      event_url: event.url,
      venue: event.venue ? {
        name: event.venue.name,
        address: event.venue.address?.localized_address_display || '',
        lat: event.venue.latitude,
        lng: event.venue.longitude
      } : null,
      organizer: event.organizer?.name || '',
      logo: event.logo?.url || null,
      is_free: event.is_free
    }));

    return res.status(200).json({
      events,
      total: data.pagination?.object_count || events.length,
      page: data.pagination?.page_number || 1
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
