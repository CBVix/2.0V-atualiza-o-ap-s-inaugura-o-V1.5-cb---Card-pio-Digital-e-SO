
import React, { useState } from 'react';
import { ChevronLeft, Star, Clock, Minus, Plus, ShoppingCart, CheckCircle2, Heart, Utensils } from 'lucide-react';
import { Product, ProductSide } from '../types';

interface ProductDetailsProps {
  product: Product;
  onBack: () => void;
  onAddToCart: (product: Product, quantity: number, extras: string[], observation: string, doneness?: string, selectedSides?: ProductSide[]) => void;
  isDarkMode?: boolean;
  toggleFavorite?: () => void;
  isFavorite?: boolean;
}

const ProductDetails: React.FC<ProductDetailsProps> = ({ product, onBack, onAddToCart, isDarkMode, toggleFavorite, isFavorite }) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedSides, setSelectedSides] = useState<ProductSide[]>([]);
  const [observation, setObservation] = useState('');
  const [doneness, setDoneness] = useState('Ao Ponto');

  const isMeat = product.category === 'tradicionais' || product.category === 'especiais';

  const toggleSide = (side: ProductSide) => {
    setSelectedSides(prev => 
      prev.some(s => s.name === side.name) 
        ? prev.filter(s => s.name !== side.name) 
        : [...prev, side]
    );
  };

  const productTotal = (product.price + selectedSides.reduce((acc, s) => acc + s.price, 0)) * quantity;

  return (
    <div className={`min-h-screen pb-40 animate-in fade-in duration-500 transition-colors duration-500 ${isDarkMode ? 'bg-[#121212] text-white' : 'bg-[#F8FAFC]'}`}>
      <div className="relative h-[40vh] w-full px-4 pt-10">
        <div className={`w-full h-full rounded-2xl overflow-hidden shadow-2xl relative border-4 transition-colors ${isDarkMode ? 'border-[#1a1a1a]' : 'border-white'}`}>
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          <button 
            onClick={onBack}
            className={`absolute top-6 left-6 w-10 h-10 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all ${isDarkMode ? 'bg-black/60 text-white backdrop-blur-md' : 'bg-white/90 text-[#0F172A] backdrop-blur-md'}`}
          >
            <ChevronLeft size={20} />
          </button>
          {toggleFavorite && (
            <button 
              onClick={toggleFavorite}
              className={`absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all ${isDarkMode ? 'bg-black/60 text-white backdrop-blur-md' : 'bg-white/90 text-[#0F172A] backdrop-blur-md'}`}
            >
              <Heart size={20} fill={isFavorite ? "#EF4444" : "none"} className={isFavorite ? "text-[#EF4444]" : "text-current"} />
            </button>
          )}
        </div>
      </div>

      <div className="px-6 mt-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className={`text-xl font-bold mb-1 transition-colors ${isDarkMode ? 'text-white' : 'text-[#0F172A]'}`}>{product.name}</h1>
            <div className="flex items-center gap-4 text-gray-500 text-[10px] font-bold uppercase tracking-widest">
              <div className="flex items-center gap-1">
                <Star size={12} className="text-primary fill-primary" />
                <span className={isDarkMode ? 'text-gray-300' : 'text-[#0F172A]'}>{product.rating}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock size={12} className="text-primary" />
                <span>{product.prepTime}</span>
              </div>
            </div>
          </div>
          <span className="text-lg font-bold text-primary">R$ {product.price.toFixed(2)}</span>
        </div>

        <p className={`text-sm leading-relaxed mb-8 transition-colors ${isDarkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>
          {product.description}
        </p>

        {isMeat && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className={`font-bold text-sm ${isDarkMode ? 'text-gray-200' : 'text-[#0F172A]'}`}>Ponto da Carne</h3>
              <span className="text-[9px] font-black uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full">Obrigatório</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['Mal Passado', 'Ao Ponto', 'Bem Passado'].map((option) => (
                <button
                  key={option}
                  onClick={() => setDoneness(option)}
                  className={`py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                    doneness === option
                      ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                      : (isDarkMode ? 'bg-[#1a1a1a] border-white/5 text-gray-500' : 'bg-white border-silver text-gray-400')
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-8">
           <h3 className={`font-bold text-sm ${isDarkMode ? 'text-gray-200' : 'text-[#0F172A]'}`}>Quantidade</h3>
           <div className={`flex items-center rounded-xl p-1 shadow-sm border transition-colors ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-silver'}`}>
              <button 
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-500 hover:text-primary transition-colors"
              >
                <Minus size={16} />
              </button>
              <span className={`w-10 text-center font-bold ${isDarkMode ? 'text-white' : 'text-[#0F172A]'}`}>{quantity}</span>
              <button 
                onClick={() => setQuantity(q => q + 1)}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-500 hover:text-primary transition-colors"
              >
                <Plus size={16} />
              </button>
           </div>
        </div>

        {(product.sides && product.sides.length > 0) && (
          <div className="space-y-6 mb-10">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className={`font-bold text-sm ${isDarkMode ? 'text-gray-200' : 'text-[#0F172A]'}`}>Acompanhamentos</h3>
                <span className="text-[9px] font-black uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full">Opcional</span>
              </div>
              <div className="space-y-3">
                {product.sides.map((side, idx) => {
                  const isSelected = selectedSides.some(s => s.name === side.name);
                  return (
                    <div 
                      key={idx}
                      onClick={() => toggleSide(side)}
                      className={`flex justify-between items-center p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected 
                          ? (isDarkMode ? 'border-primary bg-primary/5' : 'border-primary bg-orange-50 shadow-md scale-[1.02]')
                          : (isDarkMode ? 'border-white/5 bg-[#1a1a1a]' : 'border-silver bg-white hover:border-gray-300')
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                          isSelected ? 'bg-primary border-primary' : 'border-gray-500'
                        }`}>
                          {isSelected && <CheckCircle2 size={12} className="text-white" />}
                        </div>
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-gray-300' : 'text-[#334155]'}`}>{side.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-primary">{side.price > 0 ? `+R$ ${side.price.toFixed(2)}` : 'Grátis'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div>
          <h3 className={`font-bold text-sm mb-4 ${isDarkMode ? 'text-gray-200' : 'text-[#0F172A]'}`}>Observações</h3>
          <textarea 
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Ex: sem cebola, ponto da carne, etc..."
            className={`w-full p-4 rounded-xl border shadow-sm min-h-[100px] focus:outline-none transition-all text-xs font-medium mb-10 ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 text-white placeholder-gray-700' : 'bg-white border-silver text-onyx'}`}
          />
        </div>
      </div>

      <div className={`fixed bottom-0 left-0 right-0 p-6 z-50 transition-colors ${isDarkMode ? 'bg-[#1a1a1a]/95 border-t border-white/5 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]' : 'bg-white/95 border-t border-silver shadow-[0_-10px_30px_rgba(0,0,0,0.05)]'}`}>
        <button 
          onClick={() => onAddToCart(product, quantity, [], observation, isMeat ? doneness : undefined, selectedSides)}
          className="w-full bg-primary h-14 rounded-xl flex items-center justify-between px-6 text-white font-bold text-sm shadow-xl shadow-primary/20 active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-3">
            <ShoppingCart size={18} />
            <span>Adicionar</span>
          </div>
          <span className="bg-white/20 px-3 py-1 rounded-lg text-xs">R$ {productTotal.toFixed(2)}</span>
        </button>
      </div>
    </div>
  );
};

export default ProductDetails;
