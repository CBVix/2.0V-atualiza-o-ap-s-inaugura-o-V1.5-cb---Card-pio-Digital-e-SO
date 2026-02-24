
import React, { useMemo, useState, useEffect } from 'react';
import { 
  Search, 
  Flame, 
  Sparkles, 
  Zap, 
  UtensilsCrossed, 
  CupSoda, 
  IceCream,
  MapPin, 
  Instagram,
  MessageCircle,
  Sun,
  Moon,
  Tag,
  Clock,
  Star,
  LayoutGrid,
  ChevronRight,
  Bike,
  Truck,
  X,
  PackageCheck,
  ShoppingBag
} from 'lucide-react';
import { Product, Tenant, Coupon, OrderType, Order } from '../types';
import ReviewsModal from '../components/ReviewsModal';
import { supabase } from '../supabaseClient';

interface HomeProps {
  onSelectProduct: (product: Product) => void;
  tenant: Tenant;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  coupons: Coupon[];
  user?: any;
  orderType?: OrderType;
  onOpenAuth: () => void;
  onGoToAlerts?: () => void;
}

const Home: React.FC<HomeProps> = ({ onSelectProduct, tenant, isDarkMode, setIsDarkMode, coupons, user, orderType, onOpenAuth, onGoToAlerts }) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchActiveOrder();
      
      const channel = supabase.channel(`home_orders_${user.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `user_id=eq.${user.id}` 
        }, () => fetchActiveOrder())
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [user]);

  const fetchActiveOrder = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .not('status', 'in', '("finished","canceled")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setActiveOrder({
        id: data.id,
        orderNumber: data.order_number,
        customerName: data.customer_name,
        customerWhatsapp: data.customer_whatsapp,
        items: data.items,
        total: Number(data.total),
        type: data.type,
        status: data.status,
        createdAt: new Date(data.created_at)
      });
    } else {
      setActiveOrder(null);
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'pending': return 'Pedido Recebido';
      case 'preparing': return 'Preparo Iniciado';
      case 'ready_to_send': return 'Pronto para Envio';
      case 'out_for_delivery': return 'Saiu para Entrega';
      default: return 'Processando';
    }
  };

  const deliveryPrediction = useMemo(() => {
    if (!activeOrder || !tenant.deliveryTime) return null;
    const [min, max] = tenant.deliveryTime.split('-').map(Number);
    const orderDate = new Date(activeOrder.createdAt);
    
    const minDate = new Date(orderDate.getTime() + min * 60000);
    const maxDate = new Date(orderDate.getTime() + max * 60000);

    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(minDate.getHours())}:${pad(minDate.getMinutes())} - ${pad(maxDate.getHours())}:${pad(maxDate.getMinutes())}`;
  }, [activeOrder, tenant.deliveryTime]);

  const statusProgress = useMemo(() => {
    if (!activeOrder) return 0;
    switch(activeOrder.status) {
      case 'pending': return 25;
      case 'preparing': return 50;
      case 'ready_to_send': return 75;
      case 'out_for_delivery': return 100;
      default: return 10;
    }
  }, [activeOrder]);

  const filteredProducts = useMemo(() => {
    return tenant.products.filter(p => {
      const matchesCategory = selectedCategoryId === 'all' || p.category === selectedCategoryId;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           p.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch && p.availability !== 'out_of_stock';
    });
  }, [tenant.products, selectedCategoryId, searchQuery]);

  const shopStatus = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    if (tenant.holidayClosures?.includes(todayStr)) return { isOpen: false, label: 'Fechado (Feriado)' };
    if (tenant.operatingHours) {
        const dayOfWeek = now.getDay().toString();
        const config = tenant.operatingHours[dayOfWeek];
        if (!config || !config.isOpen) return { isOpen: false, label: 'Fechado Hoje' };
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const [openH, openM] = config.open.split(':').map(Number);
        const [closeH, closeM] = config.close.split(':').map(Number);
        const openTime = openH * 60 + openM;
        const closeTime = closeH * 60 + closeM;
        if (closeTime < openTime) { if (currentTime >= openTime || currentTime <= closeTime) return { isOpen: true, label: 'Aberto' }; } 
        else { if (currentTime >= openTime && currentTime <= closeTime) return { isOpen: true, label: 'Aberto' }; }
        return { isOpen: false, label: 'Fechado Agora' };
    }
    return { isOpen: true, label: 'Aberto' };
  }, [tenant]);

  return (
    <div className={`min-h-screen pb-32 animate-in fade-in duration-500 transition-all ${isDarkMode ? 'bg-transparent text-white' : 'text-black'}`}>
      
      <ReviewsModal isOpen={showReviewsModal} onClose={() => setShowReviewsModal(false)} tenantSlug={tenant.slug} tenantName={tenant.name} />

      {/* MODAL DE RESUMO DO PEDIDO ATIVO */}
      {isStatusModalOpen && activeOrder && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
           <div className={`w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 ${isDarkMode ? 'bg-[#1a1a1a] border border-white/10' : 'bg-white'}`}>
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                 <h2 className={`text-xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Resumo do Pedido</h2>
                 <button onClick={() => setIsStatusModalOpen(false)} className="p-2 bg-gray-100 dark:bg-white/5 rounded-full"><X size={20} className="text-gray-400" /></button>
              </div>
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto hide-scrollbar">
                 <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
                       {activeOrder.status === 'out_for_delivery' ? <Bike size={40} className="animate-bounce" /> : <Flame size={40} className="animate-pulse" />}
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-primary">{getStatusLabel(activeOrder.status)}</h3>
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mt-1">Previsão: {deliveryPrediction || 'Calculando...'}</p>
                 </div>

                 <div className="space-y-2">
                    <div className="w-full h-3 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden border border-gray-100 dark:border-white/5">
                       <div className="h-full bg-primary transition-all duration-1000 ease-out" style={{ width: `${statusProgress}%` }} />
                    </div>
                    <div className="flex justify-between px-1">
                       <span className={`text-[8px] font-black uppercase ${statusProgress >= 25 ? 'text-primary' : 'text-gray-400'}`}>Recebido</span>
                       <span className={`text-[8px] font-black uppercase ${statusProgress >= 50 ? 'text-primary' : 'text-gray-400'}`}>Preparo</span>
                       <span className={`text-[8px] font-black uppercase ${statusProgress >= 75 ? 'text-primary' : 'text-gray-400'}`}>Pronto</span>
                       <span className={`text-[8px] font-black uppercase ${statusProgress >= 100 ? 'text-primary' : 'text-gray-400'}`}>Entrega</span>
                    </div>
                 </div>

                 <div className="pt-6 border-t border-gray-100 dark:border-white/5">
                    <h4 className={`text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4`}>Itens do Pedido</h4>
                    <div className="space-y-3">
                       {activeOrder.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                             <span className={`font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{item.quantity}x {item.name}</span>
                             <span className="font-black text-primary">R$ {(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                       ))}
                    </div>
                    <div className="mt-6 pt-4 border-t border-dashed border-gray-200 dark:border-white/5 flex justify-between items-center">
                       <span className={`text-[10px] font-black uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total</span>
                       <span className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>R$ {activeOrder.total.toFixed(2)}</span>
                    </div>
                 </div>
              </div>
              <div className="p-6 bg-gray-50 dark:bg-black/20">
                 <button onClick={() => setIsStatusModalOpen(false)} className="w-full bg-gray-900 dark:bg-primary text-white h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg">Fechar</button>
              </div>
           </div>
        </div>
      )}

      {/* CARD DE IDENTIDADE */}
      <section className="mb-6">
        <div className={`backdrop-blur-3xl p-6 border-b shadow-xl relative transition-all duration-500 
          ${isDarkMode ? 'bg-[#1a1a1a]/95 border-white/5 shadow-black/60' : 'bg-white border-silver/50 shadow-gray-200/40'} 
          ${activeOrder ? 'rounded-t-[30px] rounded-b-[30px] mt-4 mx-6 border' : 'rounded-b-[30px]'}`}
        >
          <div className="flex items-start gap-4 mb-6">
             <div className="flex-shrink-0">
                <div className={`w-16 h-16 rounded-2xl overflow-hidden shadow-lg border transition-all duration-500 ${isDarkMode ? 'border-white/10 bg-[#121212]' : 'border-silver bg-white'}`}>
                   <img src={tenant.logo} alt={tenant.name} className="w-full h-full object-cover" />
                </div>
             </div>
             <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                   <div className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 border transition-all duration-500 ${shopStatus.isOpen ? (isDarkMode ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-green-50 border-green-100 text-green-600') : (isDarkMode ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-100 text-red-600')}`}>
                      <div className={`w-1 h-1 rounded-full ${shopStatus.isOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                      <span className="text-[8px] font-bold uppercase tracking-widest">{shopStatus.label}</span>
                   </div>
                   <button onClick={() => setIsDarkMode(!isDarkMode)} className={`relative w-[52px] h-[28px] rounded-lg transition-all duration-500 flex items-center px-1 shadow-inner border border-white/5 overflow-hidden ${isDarkMode ? 'bg-primary' : 'bg-[#E2E8F0]'}`}>
                     <div className={`z-10 w-5 h-5 bg-white rounded-md shadow-lg flex items-center justify-center transition-all duration-500 ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`}>
                       {isDarkMode ? <Moon size={11} className="text-primary" /> : <Sun size={11} className="text-[#94A3B8]" />}
                     </div>
                   </button>
                </div>
                <h2 className={`font-display font-bold text-xl uppercase tracking-tight leading-tight mb-2 truncate ${isDarkMode ? 'text-white' : 'text-black'}`}>
                   {tenant.name}
                </h2>
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenant.address)}`} target="_blank" rel="noreferrer" className={`text-[10px] font-semibold flex items-start gap-1.5 transition-colors group ${isDarkMode ? 'text-gray-500' : 'text-[#64748B]'}`}>
                   <MapPin size={12} className="text-primary flex-shrink-0 mt-0.5" /> 
                   <span className="leading-snug underline decoration-primary/20 underline-offset-2">{tenant.address}</span>
                </a>
             </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
             <a href={`https://instagram.com/${tenant.instagram}`} target="_blank" rel="noreferrer" className={`flex flex-col items-center justify-center gap-1 border py-2.5 rounded-xl text-[7px] font-bold uppercase tracking-widest transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-white' : 'bg-white border-silver text-[#334155]'}`}>
                <div className="w-10 h-10 flex items-center justify-center"><Instagram size={14} className="text-[#E4405F]" /></div>
                <span>Instagram</span>
             </a>
             <a href={`https://wa.me/${tenant.whatsapp}`} target="_blank" rel="noreferrer" className={`flex flex-col items-center justify-center gap-1 border py-2.5 rounded-xl text-[7px] font-bold uppercase tracking-widest transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-white' : 'bg-white border-silver text-[#334155]'}`}>
                <div className="w-10 h-10 flex items-center justify-center"><MessageCircle size={14} className="text-[#25D366]" /></div>
                <span>WhatsApp</span>
             </a>
             <button onClick={() => setShowReviewsModal(true)} className={`flex flex-col items-center justify-center gap-1 border py-2.5 rounded-xl text-[7px] font-bold uppercase tracking-widest transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-white' : 'bg-white border-silver text-[#334155]'}`}>
                <div className="w-10 h-10 flex items-center justify-center"><Star size={14} className="text-yellow-500 fill-yellow-500" /></div>
                <span>Reviews</span>
             </button>
          </div>
        </div>
      </section>

      {/* CARD DE ACOMPANHAMENTO DE PEDIDO ATIVO (LARANJA SÓLIDO) */}
      {activeOrder && (
        <div className="px-6 mb-8">
           <button 
             onClick={() => setIsStatusModalOpen(true)}
             className="w-full bg-[#FF5722] rounded-2xl p-6 shadow-2xl shadow-orange-500/30 text-white relative overflow-hidden group active:scale-[0.98] transition-all animate-in slide-in-from-top duration-700 text-left"
           >
              <div className="relative z-10 flex items-center justify-between">
                 <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                       {activeOrder.status === 'out_for_delivery' ? <Bike size={18} /> : <Clock size={18} />}
                       <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-90">Pedido #{activeOrder.orderNumber}</p>
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-tight leading-none mb-1">{getStatusLabel(activeOrder.status)}</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Previsão: {deliveryPrediction || 'Calculando...'}</p>
                 </div>
                 <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                    <ChevronRight size={20} />
                 </div>
              </div>
              
              <div className="mt-4 w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                 <div className="h-full bg-white transition-all duration-1000 ease-out" style={{ width: `${statusProgress}%` }} />
              </div>
           </button>
        </div>
      )}

      {/* BUSCA */}
      <section className="px-6 mb-6">
        <div className="relative group">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isDarkMode ? 'text-gray-600 group-focus-within:text-primary' : 'text-[#94A3B8] group-focus-within:text-primary'}`} size={18} />
          <input type="text" placeholder="O que vamos comer hoje?..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full py-4 pl-11 pr-4 rounded-2xl text-xs border shadow-sm focus:outline-none transition-all ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 text-white' : 'bg-white border-silver text-black'}`} />
        </div>
      </section>

      {/* CATEGORIAS */}
      <section className="mb-10 px-6">
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setSelectedCategoryId('all')} className={`flex items-center gap-3 h-14 px-3 rounded-2xl border transition-all active:scale-95 ${selectedCategoryId === 'all' ? 'bg-primary border-primary text-white' : (isDarkMode ? 'bg-[#1a1a1a] border-white/5 text-gray-400' : 'bg-white border-silver text-black')}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${selectedCategoryId === 'all' ? 'bg-white/20' : (isDarkMode ? 'bg-white/5' : 'bg-gray-100')}`}><LayoutGrid size={18} /></div>
            <span className="text-[9px] font-black uppercase tracking-widest truncate">Todos</span>
          </button>
          {tenant.categories.map((cat) => (
            <button key={cat.id} onClick={() => setSelectedCategoryId(cat.id)} className={`flex items-center gap-3 h-14 px-3 rounded-2xl border transition-all active:scale-95 ${selectedCategoryId === cat.id ? 'bg-primary border-primary text-white' : (isDarkMode ? 'bg-[#1a1a1a] border-white/5 text-gray-400' : 'bg-white border-silver text-black')}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${selectedCategoryId === cat.id ? 'bg-white/20' : (isDarkMode ? 'bg-white/5' : 'bg-gray-100')}`}>{cat.id === 'tradicionais' ? <Flame size={18}/> : cat.id === 'especiais' ? <Sparkles size={18}/> : cat.id === 'combos' ? <Zap size={18}/> : cat.id === 'pao' ? <UtensilsCrossed size={18}/> : cat.id === 'bebidas' ? <CupSoda size={18}/> : <IceCream size={18}/>}</div>
              <span className="text-[9px] font-black uppercase tracking-widest truncate">{cat.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* LISTA DE PRODUTOS */}
      <section className="px-6 space-y-4">
          {filteredProducts.map((product) => (
            <div key={product.id} onClick={() => onSelectProduct(product)} className={`p-3 rounded-2xl flex items-center gap-4 border shadow-sm active:scale-[0.98] transition-all group ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-silver'}`}>
              <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100"><img src={product.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /></div>
              <div className="flex-1 min-w-0">
                <h4 className={`font-black text-xs uppercase tracking-tight truncate mb-1 ${isDarkMode ? 'text-white' : 'text-black'}`}>{product.name}</h4>
                <p className={`text-[10px] mb-3 line-clamp-2 leading-relaxed opacity-60 ${isDarkMode ? 'text-gray-400' : 'text-[#334155]'}`}>{product.description}</p>
                <div className="flex items-center justify-between"><div className="flex items-center gap-1 text-primary text-[9px] font-black uppercase"><Clock size={12} /> {product.prepTime}</div><div className="text-primary font-black text-sm">R$ {product.price.toFixed(2)}</div></div>
              </div>
            </div>
          ))}
      </section>
    </div>
  );
};

export default Home;
