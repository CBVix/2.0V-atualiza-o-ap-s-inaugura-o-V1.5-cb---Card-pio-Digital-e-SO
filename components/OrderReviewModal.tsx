
import React, { useState } from 'react';
import { Star, X, MessageSquare, Send, Loader2 } from 'lucide-react';
import { Order } from '../types';
import { supabase } from '../supabaseClient';

interface OrderReviewModalProps {
  order: Order;
  tenantSlug: string;
  isDarkMode: boolean;
  onClose: () => void;
}

const OrderReviewModal: React.FC<OrderReviewModalProps> = ({ order, tenantSlug, isDarkMode, onClose }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hoverRating, setHoverRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('reviews').insert({
        order_id: order.id,
        rating,
        comment,
        tenant_slug: tenantSlug,
        user_id: order.userId
      });

      if (error) throw error;
      
      // Fechar modal após sucesso
      onClose();
    } catch (err) {
      console.error('Erro ao enviar avaliação:', err);
      alert('Não foi possível enviar sua avaliação agora. Tente novamente mais tarde.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className={`w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-500 ${isDarkMode ? 'bg-[#1a1a1a] border-t border-white/10' : 'bg-white'}`}>
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className={`text-xl font-black uppercase tracking-tight mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Avalie seu Pedido</h2>
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Pedido #{order.id}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center py-4">
              <p className={`text-[11px] font-bold uppercase tracking-widest mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>O que você achou da experiência?</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="transition-transform active:scale-90"
                  >
                    <Star
                      size={36}
                      className={`transition-colors duration-200 ${
                        (hoverRating || rating) >= star 
                        ? 'text-yellow-500 fill-yellow-500' 
                        : isDarkMode ? 'text-white/10' : 'text-gray-200'
                      }`}
                      strokeWidth={1.5}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                <MessageSquare size={12} /> Comentário (Opcional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Conte-nos o que achou da comida e do serviço..."
                className={`w-full h-24 p-4 rounded-2xl border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none ${
                  isDarkMode 
                  ? 'bg-[#121212] border-white/10 text-white placeholder-gray-700' 
                  : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={rating === 0 || isSubmitting}
              className="w-full h-14 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all"
            >
              {isSubmitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <Send size={18} />
                  <span>Enviar Avaliação</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default OrderReviewModal;
