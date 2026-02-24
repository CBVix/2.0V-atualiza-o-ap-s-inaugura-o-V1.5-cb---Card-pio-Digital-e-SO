
import React from 'react';
import { ChevronLeft, Clock, Heart } from 'lucide-react';
import { Product, Tenant } from '../types';

interface FavouriteProps {
  tenant: Tenant;
  onSelectProduct: (product: Product) => void;
  onBack: () => void;
  isDarkMode?: boolean;
  favorites?: string[];
  toggleFavorite?: (id: string) => void;
}

const Favourite: React.FC<FavouriteProps> = ({ tenant, onSelectProduct, onBack, isDarkMode, favorites = [], toggleFavorite }) => {
  const favouriteProducts = tenant.products.filter(p => favorites.includes(p.id));

  return (
    <div className={`min-h-screen pb-32 animate-in fade-in duration-500 transition-colors ${isDarkMode ? 'bg-[#121212] text-white' : 'bg-[#fcfcfc]'}`}>
      <header className="px-6 pt-12 pb-8 flex items-center gap-4">
        <button onClick={onBack} className={`w-10 h-10 rounded-full border flex items-center justify-center shadow-sm transition-all ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 text-white' : 'bg-white border-gray-100 text-gray-700'}`}>
          <ChevronLeft size={20} />
        </button>
        <h1 className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-[#0F172A]'}`}>Favoritos</h1>
      </header>

      <section className="px-6 space-y-4">
        {favouriteProducts.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {favouriteProducts.map((product) => (
              <div 
                key={product.id}
                className={`p-3 rounded-xl flex items-center gap-4 border transition-all ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-gray-50 shadow-sm'}`}
              >
                <div onClick={() => onSelectProduct(product)} className={`w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 transition-colors cursor-pointer ${isDarkMode ? 'bg-[#121212]' : 'bg-gray-50'}`}>
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h4 onClick={() => onSelectProduct(product)} className={`font-bold text-xs uppercase tracking-tight cursor-pointer ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{product.name}</h4>
                    {toggleFavorite && (
                      <button onClick={() => toggleFavorite(product.id)} className="text-red-500">
                        <Heart size={16} fill="currentColor" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-gray-500 text-[9px] font-bold uppercase tracking-widest">
                    <div className="flex items-center gap-1 text-primary"><Clock size={10} /> {product.prepTime}</div>
                    <div className="text-primary font-bold">R$ {product.price.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <Heart size={48} className="text-gray-300 mx-auto mb-4" />
            <p className={`font-bold text-xs uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-[#64748B]'}`}>Sua lista está vazia</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default Favourite;
