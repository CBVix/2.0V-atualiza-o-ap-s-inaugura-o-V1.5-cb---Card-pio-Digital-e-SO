
import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, 
  LogOut, 
  Bell, 
  CreditCard, 
  ShieldCheck, 
  ChevronLeft, 
  Copy, 
  Check, 
  Mail,
  MessageCircle,
  History,
  Calendar,
  ShoppingBag,
  User as UserIcon,
  Phone,
  MapPin,
  Save,
  Ticket,
  Clock,
  ArrowRight,
  Lock,
  Loader2,
  AlertCircle,
  Star,
  Send,
  X
} from 'lucide-react';
import { OrderType, Tenant, Order, UserInfo, Coupon } from '../types';
import { supabase } from '../supabaseClient';

interface ProfileProps {
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
  tenant: Tenant;
  isDarkMode?: boolean;
  orders: Order[];
  userInfo: UserInfo;
  setUserInfo: React.Dispatch<React.SetStateAction<UserInfo>>;
  user?: any;
}

type ProfileView = 'main' | 'payment' | 'notifications' | 'security' | 'help' | 'settings' | 'history' | 'coupons';

const Profile: React.FC<ProfileProps> = ({ tenant, isDarkMode, setOrderType, orders, userInfo, setUserInfo, user }) => {
  const [view, setView] = useState<ProfileView>('main');
  const [copied, setCopied] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [myCoupons, setMyCoupons] = useState<Coupon[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [reviewedOrderIds, setReviewedOrderIds] = useState<string[]>([]);
  
  // Inline Rating States
  const [ratingOrderId, setRatingOrderId] = useState<string | null>(null);
  const [inlineRating, setInlineRating] = useState(0);
  const [inlineHoverRating, setInlineHoverRating] = useState(0);
  const [inlineComment, setInlineComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Password Change State
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Edit Form State
  const [formName, setFormName] = useState(userInfo.name || '');
  const [formPhone, setFormPhone] = useState(userInfo.whatsapp || '');
  const [formAddress, setFormAddress] = useState(userInfo.address || '');

  // Filtrar pedidos apenas do usuário logado
  const userOrders = orders.filter(o => o.userId === user?.id);

  useEffect(() => {
    if (view === 'coupons' && user) {
        fetchMyCoupons();
    }
    if (view === 'history' && user) {
        fetchReviewedOrders();
    }
  }, [view, user]);

  const fetchReviewedOrders = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('order_id')
        .eq('user_id', user.id);
      
      if (!error && data) {
        setReviewedOrderIds(data.map(r => r.order_id));
      }
    } catch (err) {
      console.error("Erro ao carregar avaliações feitas:", err);
    }
  };

  const fetchMyCoupons = async () => {
    setLoadingCoupons(true);
    try {
        const { data, error } = await supabase
            .from('coupons')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true);
        
        if (data) {
            setMyCoupons(data.map((c: any) => ({
                id: c.id,
                code: c.code,
                discountValue: c.discount_value,
                maxUses: c.max_uses,
                currentUses: c.current_uses,
                isActive: c.is_active,
                userId: c.user_id
            })));
        }
    } catch (err) {
        console.error("Erro ao carregar meus cupons:", err);
    } finally {
        setLoadingCoupons(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
      return;
    }

    setPasswordLoading(true);
    setPasswordMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordMessage({ type: 'success', text: 'Senha atualizada com sucesso!' });
      setNewPassword('');
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: err.message || 'Erro ao atualizar senha.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const copyPix = () => {
    navigator.clipboard.writeText(tenant.pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setOrderType(OrderType.UNSET);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Atualiza estado local
    setUserInfo(prev => ({
        ...prev,
        name: formName,
        whatsapp: formPhone,
        address: formAddress
    }));

    // Sincroniza com a tabela 'customers' no Supabase
    if (user) {
        try {
            const cleanWhatsapp = formPhone.replace(/\D/g, '');
            const { error } = await supabase
                .from('customers')
                .update({
                    name: formName,
                    whatsapp: cleanWhatsapp,
                    address: formAddress
                })
                .eq('user_id', user.id)
                .eq('tenant_slug', tenant.slug);

            if (error) throw error;
        } catch (err) {
            console.error("Erro ao sincronizar dados do cliente:", err);
        }
    }

    setView('main');
  };

  const copyCouponCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert(`Código ${code} copiado!`);
  };

  const handleInlineSubmitReview = async (orderId: string) => {
    if (inlineRating === 0) return;

    setIsSubmittingReview(true);
    try {
      const { error } = await supabase.from('reviews').insert({
        order_id: orderId,
        rating: inlineRating,
        comment: inlineComment,
        tenant_slug: tenant.slug,
        user_id: user.id
      });

      if (error) throw error;
      
      setReviewedOrderIds(prev => [...prev, orderId]);
      setRatingOrderId(null);
      setInlineRating(0);
      setInlineComment('');
    } catch (err) {
      console.error('Erro ao enviar avaliação:', err);
      alert('Erro ao enviar avaliação. Tente novamente.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const renderHeader = (title: string) => (
    <header className="px-6 pt-12 pb-8 flex items-center gap-4">
      <button 
        onClick={() => setView('main')} 
        className={`w-10 h-10 rounded-full border flex items-center justify-center shadow-sm transition-all ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 text-white' : 'bg-white border-gray-100 text-gray-700'}`}
      >
        <ChevronLeft size={20} />
      </button>
      <h1 className={`font-bold text-lg transition-colors ${isDarkMode ? 'text-white' : 'text-[#0F172A]'}`}>{title}</h1>
    </header>
  );

  const userInitial = userInfo.name ? userInfo.name.charAt(0).toUpperCase() : null;

  if (view === 'coupons') {
    return (
        <div className={`min-h-screen pb-32 animate-in slide-in-from-right duration-300 transition-colors ${isDarkMode ? 'bg-[#121212] text-white' : 'bg-[#fcfcfc]'}`}>
            {renderHeader('Meus Cupons')}
            <div className="px-6 space-y-4">
                {loadingCoupons ? (
                    <div className="text-center py-20 opacity-50 text-[10px] font-bold uppercase tracking-widest text-primary animate-pulse">Carregando seus presentes...</div>
                ) : myCoupons.length > 0 ? (
                    myCoupons.map((coupon) => (
                        <div key={coupon.id} className={`p-5 rounded-2xl border relative overflow-hidden transition-all ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 shadow-black/20' : 'bg-white border-silver shadow-sm'}`}>
                             <div className="absolute top-0 right-0 p-3 opacity-[0.05]">
                                <Ticket size={64} className="transform rotate-12" />
                             </div>
                             <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`px-3 py-1 rounded-lg border font-black text-sm tracking-widest ${isDarkMode ? 'bg-white/5 border-white/10 text-primary' : 'bg-orange-50 border-orange-100 text-primary'}`}>
                                        {coupon.code}
                                    </div>
                                    <button onClick={() => copyCouponCode(coupon.code)} className="text-primary p-1 hover:scale-110 transition-transform">
                                        <Copy size={16} />
                                    </button>
                                </div>
                                <div className="space-y-1">
                                    <p className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>R$ {coupon.discountValue.toFixed(2)} OFF</p>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Presente Exclusivo para Você 🎁</p>
                                </div>
                                <div className="mt-4 pt-4 border-t border-dashed border-silver/30 flex justify-between items-center text-[9px] font-bold uppercase">
                                    <span className="text-emerald-500 flex items-center gap-1"><Check size={10}/> Disponível</span>
                                    <span className="text-gray-400">Uso Único</span>
                                </div>
                             </div>
                        </div>
                    ))
                ) : (
                    <div className="py-20 text-center flex flex-col items-center opacity-40">
                        <Ticket size={48} className="text-gray-500 mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 max-w-[200px]">Nenhum cupom exclusivo no momento. Continue pedindo para ganhar!</p>
                    </div>
                )}
            </div>
        </div>
    );
  }

  if (view === 'history') {
    return (
      <div className={`min-h-screen pb-32 animate-in slide-in-from-right duration-300 transition-colors ${isDarkMode ? 'bg-[#121212] text-white' : 'bg-[#fcfcfc]'}`}>
        {renderHeader('Histórico de Pedidos')}
        <div className="px-6 space-y-4">
          {userOrders.length > 0 ? (
            userOrders.map((order) => (
              <div key={order.id} className={`p-5 rounded-2xl border transition-all ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 shadow-black/20' : 'bg-white border-silver shadow-sm'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-primary font-black text-sm">#{order.orderNumber}</span>
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-500 uppercase mt-1">
                      <Calendar size={12} /> {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${order.status === 'finished' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'}`}>
                    {order.status === 'finished' ? 'Concluído' : 'Em Preparo'}
                  </span>
                </div>
                
                <div className="space-y-1 mb-4">
                  {order.items.map((item, i) => (
                    <div key={i} className={`text-[10px] font-medium leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-[#334155]'}`}>
                      {item.quantity}x {item.name}
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-dashed border-silver/30 flex justify-between items-center">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>Total</span>
                  <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-[#0F172A]'}`}>R$ {order.total.toFixed(2)}</span>
                </div>

                {order.status === 'finished' && !reviewedOrderIds.includes(order.id) && (
                   <div className="mt-4 pt-4 border-t border-white/5">
                      {ratingOrderId === order.id ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                           <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Sua Avaliação</span>
                              <button onClick={() => setRatingOrderId(null)} className="text-gray-500"><X size={14}/></button>
                           </div>
                           <div className="flex justify-center gap-3 py-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button 
                                  key={star} 
                                  onMouseEnter={() => setInlineHoverRating(star)}
                                  onMouseLeave={() => setInlineHoverRating(0)}
                                  onClick={() => setInlineRating(star)}
                                  className="transition-transform active:scale-90"
                                >
                                  <Star 
                                    size={28} 
                                    className={`transition-colors duration-200 ${(inlineHoverRating || inlineRating) >= star ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} 
                                    strokeWidth={1.5}
                                  />
                                </button>
                              ))}
                           </div>
                           <textarea 
                             value={inlineComment}
                             onChange={(e) => setInlineComment(e.target.value)}
                             placeholder="O que achou do pedido? (Opcional)"
                             className={`w-full h-20 p-3 rounded-xl border text-[10px] font-medium resize-none outline-none focus:ring-2 focus:ring-primary/20 ${isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-gray-50 border-gray-100'}`}
                           />
                           <button 
                             disabled={inlineRating === 0 || isSubmittingReview}
                             onClick={() => handleInlineSubmitReview(order.id)}
                             className="w-full h-10 bg-primary text-white rounded-xl font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                           >
                             {isSubmittingReview ? <Loader2 size={12} className="animate-spin" /> : <><Send size={12} /> Enviar</>}
                           </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setRatingOrderId(order.id)}
                          className="w-full h-10 bg-primary/10 text-primary rounded-xl font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 border border-primary/20 hover:bg-primary/20 transition-all active:scale-95"
                        >
                          <Star size={12} fill="currentColor" /> Avaliar este Pedido
                        </button>
                      )}
                   </div>
                )}
                
                {reviewedOrderIds.includes(order.id) && (
                  <div className="mt-4 w-full h-10 bg-gray-500/10 text-gray-500 rounded-xl font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 border border-gray-500/10 opacity-60">
                    <Check size={12} /> Avaliação Enviada
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="py-20 text-center flex flex-col items-center opacity-40">
              <ShoppingBag size={48} className="text-gray-500 mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Você ainda não fez pedidos</p>
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tight max-w-[180px]">Faça seu primeiro pedido e ele aparecerá aqui!</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'payment') {
    return (
      <div className={`min-h-screen pb-32 animate-in slide-in-from-right duration-300 transition-colors ${isDarkMode ? 'bg-[#121212] text-white' : 'bg-[#fcfcfc]'}`}>
        {renderHeader('Pagamento')}
        <div className="px-6 space-y-4">
          <div className={`p-5 rounded-xl border transition-all ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 shadow-black/20' : 'bg-white border-gray-100 shadow-sm'}`}>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-4">Chave Pix da Empresa</h3>
            <div className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${isDarkMode ? 'bg-[#121212] border-white/5' : 'bg-[#F1F5F9] border-silver'}`}>
              <span className={`flex-1 text-[11px] font-mono font-bold truncate ${isDarkMode ? 'text-gray-300' : 'text-[#0F172A]'}`}>{tenant.pixKey}</span>
              <button onClick={copyPix} className="p-2 text-primary active:scale-90 transition-transform">
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'notifications') {
    return (
      <div className={`min-h-screen pb-32 animate-in slide-in-from-right duration-300 transition-colors ${isDarkMode ? 'bg-[#121212] text-white' : 'bg-[#fcfcfc]'}`}>
        {renderHeader('Notificações')}
        <div className="px-6">
          <div className={`p-5 rounded-xl border flex items-center justify-between transition-all ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-gray-100 shadow-sm'}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                <Bell size={20} />
              </div>
              <div>
                <h4 className={`text-xs font-bold uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-[#0F172A]'}`}>Alertas de Pedidos</h4>
                <p className="text-[9px] text-gray-500 font-bold uppercase">Receba status do seu pedido</p>
              </div>
            </div>
            <button 
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={`relative w-12 h-6 rounded-full transition-all duration-300 flex items-center px-1 ${notificationsEnabled ? 'bg-primary' : 'bg-gray-300'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${notificationsEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'security') {
    return (
      <div className={`min-h-screen pb-32 animate-in slide-in-from-right duration-300 transition-colors ${isDarkMode ? 'bg-[#121212] text-white' : 'bg-[#fcfcfc]'}`}>
        {renderHeader('Segurança')}
        <div className="px-6 space-y-6">
          <div className={`p-6 rounded-2xl border transition-all ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 shadow-black/20' : 'bg-white border-gray-100 shadow-sm'}`}>
            <div className="flex items-center gap-3 mb-6">
              <ShieldCheck className="text-primary" size={24} />
              <h4 className={`text-sm font-bold uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-[#0F172A]'}`}>Trocar Senha</h4>
            </div>
            
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Nova Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="password" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    placeholder="Mínimo 6 caracteres"
                    className={`w-full h-12 pl-11 pr-4 rounded-xl border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all ${isDarkMode ? 'bg-[#1a1a1a] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'}`} 
                  />
                </div>
              </div>

              {passwordMessage && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-[10px] font-bold uppercase border animate-in fade-in ${passwordMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                  {passwordMessage.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
                  {passwordMessage.text}
                </div>
              )}

              <button 
                type="submit" 
                disabled={passwordLoading || !newPassword}
                className="w-full h-12 bg-primary text-white rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50 transition-all"
              >
                {passwordLoading ? <Loader2 size={16} className="animate-spin" /> : 'Atualizar Senha'}
              </button>
            </form>
          </div>

          <div className="p-5 opacity-60">
            <p className="text-[10px] font-medium leading-relaxed italic">
              Seus dados são criptografados e armazenados com segurança pelo Supabase Auth.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'help') {
    return (
      <div className={`min-h-screen pb-32 animate-in slide-in-from-right duration-300 transition-colors ${isDarkMode ? 'bg-[#121212] text-white' : 'bg-[#fcfcfc]'}`}>
        {renderHeader('Ajuda e Suporte')}
        <div className="px-6 space-y-4">
          <button className={`w-full p-5 rounded-xl border flex items-center gap-4 transition-all ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-gray-100 shadow-sm'}`}>
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center text-green-500">
              <MessageCircle size={20} />
            </div>
            <div className="text-left">
              <h4 className={`text-xs font-bold uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-[#0F172A]'}`}>Falar no WhatsApp</h4>
              <p className="text-[9px] text-gray-500 font-bold uppercase">Suporte direto com a loja</p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (view === 'settings') {
    return (
      <div className={`min-h-screen pb-32 animate-in slide-in-from-right duration-300 transition-colors ${isDarkMode ? 'bg-[#121212] text-white' : 'bg-[#fcfcfc]'}`}>
        {renderHeader('Editar Perfil')}
        <div className="px-6">
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-1.5">
               <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Seu Nome</label>
               <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    value={formName} 
                    onChange={e => setFormName(e.target.value)} 
                    placeholder="Como prefere ser chamado?"
                    className={`w-full h-12 pl-11 pr-4 rounded-xl border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all ${isDarkMode ? 'bg-[#1a1a1a] border-white/10 text-white placeholder-gray-600' : 'bg-white border-gray-200 text-gray-900'}`} 
                  />
               </div>
            </div>

            <div className="space-y-1.5">
               <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">WhatsApp</label>
               <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="tel" 
                    value={formPhone} 
                    onChange={e => setFormPhone(e.target.value)} 
                    placeholder="Seu número de contato"
                    className={`w-full h-12 pl-11 pr-4 rounded-xl border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all ${isDarkMode ? 'bg-[#1a1a1a] border-white/10 text-white placeholder-gray-600' : 'bg-white border-gray-200 text-gray-900'}`} 
                  />
               </div>
            </div>

            <div className="space-y-1.5">
               <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Endereço Padrão</label>
               <div className="relative">
                  <MapPin className="absolute left-4 top-4 text-gray-400" size={18} />
                  <textarea 
                    value={formAddress} 
                    onChange={e => setFormAddress(e.target.value)} 
                    placeholder="Rua, Número, Bairro..."
                    className={`w-full py-4 pl-11 pr-4 rounded-xl border text-sm font-bold min-h-[100px] focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all ${isDarkMode ? 'bg-[#1a1a1a] border-white/10 text-white placeholder-gray-600' : 'bg-white border-gray-200 text-gray-900'}`} 
                  />
               </div>
            </div>

            <button type="submit" className="w-full bg-primary text-white h-12 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all mt-4">
               <Save size={16} /> Salvar Dados
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-32 animate-in fade-in duration-500 transition-colors ${isDarkMode ? 'bg-[#121212] text-white' : 'bg-[#fcfcfc]'}`}>
      <header className="px-6 pt-16 pb-12 flex flex-col items-center">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center border-4 shadow-xl mb-4 transition-all duration-500 overflow-hidden relative
          ${isDarkMode ? 'border-[#1a1a1a] bg-gradient-to-br from-[#1a1a1a] to-black shadow-black/40' : 'border-white bg-gradient-to-br from-gray-50 to-gray-200 shadow-gray-200/50'}`}>
          
          <div className="absolute inset-0 bg-gradient-to-br from-primary to-orange-600 opacity-90" />
          
          {userInitial ? (
            <span className="relative z-10 font-display font-black text-4xl text-white tracking-tighter drop-shadow-md">
              {userInitial}
            </span>
          ) : (
            <UserIcon size={40} className="relative z-10 text-white/90" />
          )}
        </div>
        
        <h1 className={`font-bold text-xl mb-1 ${isDarkMode ? 'text-white' : 'text-[#0F172A]'}`}>{userInfo.name || 'Visitante'}</h1>
        <p className="text-primary text-[10px] font-bold uppercase tracking-[0.2em]">Membro Brutus</p>
      </header>

      <section className="px-6 space-y-4">
        <div className={`rounded-2xl border shadow-sm overflow-hidden transition-all ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 shadow-black/20' : 'bg-white border-silver shadow-gray-200/50'}`}>
          
          <button onClick={() => setView('coupons')} className={`w-full px-6 py-5 flex items-center justify-between border-b last:border-0 transition-colors ${isDarkMode ? 'border-white/5 hover:bg-white/5 active:bg-white/5' : 'border-gray-50 hover:bg-gray-50 active:bg-gray-50'}`}>
            <div className="flex items-center gap-4">
              <div className="text-primary/70"><Ticket size={20} /></div>
              <span className={`font-bold text-xs uppercase tracking-tight ${isDarkMode ? 'text-gray-300' : 'text-[#0F172A]'}`}>Meus Cupons (Presentes)</span>
            </div>
            <ChevronRight size={18} className="text-gray-600 opacity-40" />
          </button>

          <button onClick={() => setView('settings')} className={`w-full px-6 py-5 flex items-center justify-between border-b last:border-0 transition-colors ${isDarkMode ? 'border-white/5 hover:bg-white/5 active:bg-white/5' : 'border-gray-50 hover:bg-gray-50 active:bg-gray-50'}`}>
            <div className="flex items-center gap-4">
              <div className="text-primary/70"><UserIcon size={20} /></div>
              <span className={`font-bold text-xs uppercase tracking-tight ${isDarkMode ? 'text-gray-300' : 'text-[#0F172A]'}`}>Meus Dados</span>
            </div>
            <ChevronRight size={18} className="text-gray-600 opacity-40" />
          </button>

          <button onClick={() => setView('history')} className={`w-full px-6 py-5 flex items-center justify-between border-b last:border-0 transition-colors ${isDarkMode ? 'border-white/5 hover:bg-white/5 active:bg-white/5' : 'border-gray-50 hover:bg-gray-50 active:bg-gray-50'}`}>
            <div className="flex items-center gap-4">
              <div className="text-primary/70"><History size={20} /></div>
              <span className={`font-bold text-xs uppercase tracking-tight ${isDarkMode ? 'text-gray-300' : 'text-[#0F172A]'}`}>Histórico de Pedidos</span>
            </div>
            <ChevronRight size={18} className="text-gray-600 opacity-40" />
          </button>

          <button onClick={() => setView('payment')} className={`w-full px-6 py-5 flex items-center justify-between border-b last:border-0 transition-colors ${isDarkMode ? 'border-white/5 hover:bg-white/5 active:bg-white/5' : 'border-gray-50 hover:bg-gray-50 active:bg-gray-50'}`}>
            <div className="flex items-center gap-4">
              <div className="text-primary/70"><CreditCard size={20} /></div>
              <span className={`font-bold text-xs uppercase tracking-tight ${isDarkMode ? 'text-gray-300' : 'text-[#0F172A]'}`}>Métodos de Pagamento</span>
            </div>
            <ChevronRight size={18} className="text-gray-600 opacity-40" />
          </button>
          
          <button onClick={() => setView('notifications')} className={`w-full px-6 py-5 flex items-center justify-between border-b last:border-0 transition-colors ${isDarkMode ? 'border-white/5 hover:bg-white/5 active:bg-white/5' : 'border-gray-50 hover:bg-gray-50 active:bg-gray-50'}`}>
            <div className="flex items-center gap-4">
              <div className="text-primary/70"><Bell size={20} /></div>
              <span className={`font-bold text-xs uppercase tracking-tight ${isDarkMode ? 'text-gray-300' : 'text-[#0F172A]'}`}>Notificações</span>
            </div>
            <ChevronRight size={18} className="text-gray-600 opacity-40" />
          </button>

          <button onClick={() => setView('security')} className={`w-full px-6 py-5 flex items-center justify-between border-b last:border-0 transition-colors ${isDarkMode ? 'border-white/5 hover:bg-white/5 active:bg-white/5' : 'border-gray-50 hover:bg-gray-50 active:bg-gray-50'}`}>
            <div className="flex items-center gap-4">
              <div className="text-primary/70"><ShieldCheck size={20} /></div>
              <span className={`font-bold text-xs uppercase tracking-tight ${isDarkMode ? 'text-gray-300' : 'text-[#0F172A]'}`}>Segurança</span>
            </div>
            <ChevronRight size={18} className="text-gray-600 opacity-40" />
          </button>
        </div>

        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-red-500/10 text-red-500 rounded-xl font-bold text-xs uppercase tracking-widest mt-8 active:scale-95 transition-all"
        >
          <LogOut size={18} /> <span>Encerrar Sessão</span>
        </button>
      </section>
    </div>
  );
};

export default Profile;
