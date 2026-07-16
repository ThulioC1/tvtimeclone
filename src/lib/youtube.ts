const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3/search';

export const getYouTubeTrailer = async (query: string): Promise<string | null> => {
  if (!API_KEY || !query.trim()) return null;
  try {
    const url =
      `${BASE_URL}?part=snippet&type=video&maxResults=1&videoEmbeddable=true` +
      `&q=${encodeURIComponent(`${query} trailer`)}&key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const videoId: string | undefined = data?.items?.[0]?.id?.videoId;
    return videoId ?? null;
  } catch {
    return null;
  }
};
