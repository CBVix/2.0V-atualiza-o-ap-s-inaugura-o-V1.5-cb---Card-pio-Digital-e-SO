
import React, { useEffect, useState } from 'react';
import { X, Star, MessageSquare, Loader2, Calendar } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  user_id: string;
}

interface ReviewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  tenantName: string;
}

const ReviewsModal: React.FC<ReviewsModalProps> = ({ isOpen, onClose, tenantSlug, tenantName }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [average, setAverage] = useState(0);

  useEffect(() => {
    if (isOpen) {
      fetchReviews();
    }
  }, [isOpen]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('tenant_slug', tenantSlug)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setReviews(data);
        const avg = data.length > 0 
          ? data.reduce((acc, curr) => acc + curr.rating, 0) / data.length 
          : 0;
        setAverage(avg);
      }
    } catch (err) {
      console.error('Erro ao buscar reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">Reviews</h2>
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{tenantName}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-gray-900 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 hide-scrollbar">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-gray-400">
              <Loader2 size={32} className="animate-spin text-primary" />
              <p className="text-[10px] font-bold uppercase tracking-widest">Carregando depoimentos...</p>
            </div>
          ) : reviews.length > 0 ? (
            <>
              {/* Resumo */}
              <div className="bg-gray-50 rounded-2xl p-6 text-center border border-gray-100">
                <div className="text-4xl font-black text-gray-900 mb-1">{average.toFixed(1)}</div>
                <div className="flex justify-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star 
                      key={s} 
                      size={16} 
                      className={s <= Math.round(average) ? "text-yellow-500 fill-yellow-500" : "text-gray-200"} 
                    />
                  ))}
                </div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Média baseada em {reviews.length} avaliações
                </p>
              </div>

              {/* Lista */}
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="p-4 rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-gray-900 uppercase">Cliente Brutus</span>
                        <div className="flex gap-0.5 mt-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star 
                              key={s} 
                              size={10} 
                              className={s <= review.rating ? "text-yellow-500 fill-yellow-500" : "text-gray-200"} 
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400 uppercase">
                        <Calendar size={10} />
                        {new Date(review.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    
                    {review.comment ? (
                      <p className="text-xs text-gray-600 leading-relaxed font-medium bg-gray-50 p-3 rounded-xl border border-gray-100/50">
                        "{review.comment}"
                      </p>
                    ) : (
                      <p className="text-[9px] text-gray-400 italic font-bold uppercase tracking-tight">O cliente não deixou comentário.</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-20 text-center flex flex-col items-center gap-4 animate-in fade-in duration-700">
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center text-primary">
                <MessageSquare size={32} />
              </div>
              <div>
                <p className="text-sm font-black text-gray-900 uppercase mb-1">Sem avaliações ainda</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter leading-relaxed max-w-[200px] mx-auto">
                  Seja o primeiro a avaliar o Churras Brutus! Faça seu pedido e deixe seu feedback no perfil.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50/50">
          <button 
            onClick={onClose}
            className="w-full h-12 bg-gray-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewsModal;
