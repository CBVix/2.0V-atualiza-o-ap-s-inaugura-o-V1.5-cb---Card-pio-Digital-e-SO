
import { useState, useEffect } from 'react';

export const useFavorites = () => {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('churrasco_favorites');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar favoritos", e);
      }
    }
  }, []);

  const toggleFavorite = (productId: string) => {
    setFavorites(prev => {
      const newFavs = prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId];
      localStorage.setItem('churrasco_favorites', JSON.stringify(newFavs));
      return newFavs;
    });
  };

  const isFavorite = (productId: string) => favorites.includes(productId);

  return { favorites, toggleFavorite, isFavorite };
};
