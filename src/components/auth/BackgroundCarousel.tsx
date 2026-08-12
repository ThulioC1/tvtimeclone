import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getTrendingTVShows,
  getTrendingMovies,
  getBackdropUrl,
  getPosterUrl,
  type TVShow,
  type TMDBMovieSimple,
} from '../../lib/tmdb';

const SLIDE_INTERVAL = 6000;
const MAX_SLIDES = 14;

const BackgroundCarousel: React.FC = () => {
  const { data: shows } = useQuery({
    queryKey: ['auth-carousel-shows'],
    queryFn: () => getTrendingTVShows(),
    staleTime: 3600000,
  });
  const { data: movies } = useQuery({
    queryKey: ['auth-carousel-movies'],
    queryFn: () => getTrendingMovies(),
    staleTime: 3600000,
  });

  const pushImage = (list: string[], backdrop: string | null, poster: string | null) => {
    const url = backdrop
      ? getBackdropUrl(backdrop, 'w1280')
      : poster
        ? getPosterUrl(poster, 'w342')
        : null;
    if (url) list.push(url);
  };

  const images = useMemo(() => {
    const list: string[] = [];
    (shows ?? []).forEach((s: TVShow) => pushImage(list, s.backdrop_path, s.poster_path));
    (movies ?? []).forEach((m: TMDBMovieSimple) => pushImage(list, m.backdrop_path, m.poster_path));
    return [...new Set(list)].slice(0, MAX_SLIDES);
  }, [shows, movies]);

  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(new Set());

  const slides = useMemo(
    () => images.filter((url) => !failed.has(url)),
    [images, failed]
  );

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, SLIDE_INTERVAL);
    return () => clearInterval(timer);
  }, [slides.length]);

  // Reset index if the active slide was removed (broken image).
  useEffect(() => {
    if (slides.length > 0 && index >= slides.length) {
      setIndex(0);
    }
  }, [slides.length, index]);

  // Preload the next slide for a smooth crossfade.
  const nextUrl = useMemo(
    () => (slides.length > 0 ? slides[(index + 1) % slides.length] : null),
    [slides, index]
  );
  useEffect(() => {
    if (!nextUrl) return;
    const img = new Image();
    img.src = nextUrl;
  }, [nextUrl]);

  if (slides.length === 0) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-brand-700 via-brand-600 to-dark-900" />
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-dark-900">
      {slides.map((url, i) => (
        <img
          key={url}
          src={url}
          alt=""
          loading={i === index ? 'eager' : 'lazy'}
          draggable={false}
          onError={() => setFailed((prev) => new Set(prev).add(url))}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[1500ms] ease-in-out select-none ${
            i === index ? 'opacity-100 ken-burns' : 'opacity-0 pointer-events-none'
          }`}
        />
      ))}
    </div>
  );
};

export default BackgroundCarousel;