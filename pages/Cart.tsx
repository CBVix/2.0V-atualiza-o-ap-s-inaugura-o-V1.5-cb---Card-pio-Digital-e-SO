
import React, { useState, useMemo } from 'react';
import { ChevronLeft, Minus, Plus, Trash2, ArrowRight, MapPin, CreditCard, MessageCircle, Copy, Check, ExternalLink, User, Ticket, CupSoda, IceCream, Utensils, QrCode, Banknote, CreditCard as CardIcon, Store, Flame, Send } from 'lucide-react';
import { CartItem, OrderType, UserInfo, Tenant, Product, Coupon } from '../types';

interface CartProps {
  items: CartItem[];
  orderType: OrderType;
  userInfo: UserInfo;
  setUserInfo: React.Dispatch<React.SetStateAction<UserInfo>>;
  onUpdateQuantity: (id: string, delta: number) => void;
  onBack: () => void;
  tenant: Tenant;
  isDarkMode?: boolean;
  onSelectProduct: (product: Product) => void;
  onCheckout: (coupon?: Coupon) => void;
  coupons: Coupon[];
  user?: any;
}

type PaymentMethod = 'pix' | 'link' | 'delivery_card' | 'at_table';

const Cart: React.FC<CartProps> = ({ items, onUpdateQuantity, onBack, tenant, userInfo, setUserInfo, orderType, isDarkMode, onSelectProduct, onCheckout, coupons, user }) => {
  const [step, setStep] = useState<'review' | 'details' | 'payment'>('review');
  const [copied, setCopied] = useState(false);
  
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    orderType === OrderType.LOCAL ? 'at_table' : 'pix'
  );
  const [cardBrand, setCardBrand] = useState('Mastercard');
  
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');

  const subtotal = items.reduce((acc, item) => {
    const sidePrices = (item.selectedSides || []).reduce((sAcc, s) => sAcc + s.price, 0);
    return acc + ((item.price + sidePrices) * item.quantity);
  }, 0);
  
  const deliveryFee = orderType === OrderType.DELIVERY ? tenant.deliveryFee : 0;
  const discount = (orderType !== OrderType.LOCAL && appliedCoupon) ? appliedCoupon.discountValue : 0;
  const total = Math.max(0, subtotal + deliveryFee - discount);

  const suggestionSections = useMemo(() => {
    const cartIds = new Set(items.map(i => i.id));
    const getItems = (category: string) => 
      tenant.products
        .filter(p => p.category === category && !cartIds.has(p.id) && p.availability !== 'out_of_stock')
        .slice(0, 4);
    const getOthers = () =>
      tenant.products
        .filter(p => !['bebidas', 'sobremesas'].includes(p.category) && !cartIds.has(p.id) && p.availability !== 'out_of_stock')
        .slice(0, 4);
    return [
      { id: 'bebidas', title: 'Bebidas Geladas', icon: <CupSoda size={14} />, items: getItems('bebidas') },
      { id: 'sobremesas', title: 'Doces & Sobremesas', icon: <IceCream size={14} />, items: getItems('sobremesas') },
      { id: 'outros', title: 'Para Acompanhar', icon: <Utensils size={14} />, items: getOthers() }
    ].filter(section => section.items.length > 0);
  }, [items, tenant.products]);

  const copyPix = () => {
    navigator.clipboard.writeText(tenant.pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyCoupon = () => {
    if (orderType === OrderType.LOCAL) return; 

    setCouponError('');
    if (!couponCode.trim()) return;

    const foundCoupon = coupons.find(c => c.code.toUpperCase() === couponCode.toUpperCase());

    if (!foundCoupon) {
      setCouponError('Cupom inválido');
      return;
    }

    if (!foundCoupon.isActive || (foundCoupon.maxUses > 0 && foundCoupon.currentUses >= foundCoupon.maxUses)) {
      setCouponError('Cupom expirado ou esgotado');
      return;
    }

    if (foundCoupon.userId) {
        if (!user || foundCoupon.userId !== user.id) {
            setCouponError('Este cupom não pertence a você');
            return;
        }
    }

    setAppliedCoupon(foundCoupon);
    setCouponCode('');
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponError('');
  };

  const handleFinish = () => {
    onCheckout(appliedCoupon || undefined);
    
    const itemsListSimple = items.map(i => {
        const sidesText = (i.selectedSides || []).length > 0 
            ? `\n    + Acomp: ${(i.selectedSides || []).map(s => s.name).join(', ')}` 
            : '';
        const basePrice = i.price + (i.selectedSides || []).reduce((acc, s) => acc + s.price, 0);
        return `${i.quantity}x ${i.name} - R$ ${(basePrice * i.quantity).toFixed(2)}${sidesText}${i.itemObservation ? ` (Obs: ${i.itemObservation})` : ''}`;
    }).join('\n\n');

    let message = '';
    if (paymentMethod === 'pix' || paymentMethod === 'link') {
      message = `🔥 NOVO PEDIDO - ${tenant.name.toUpperCase()}\n\n` +
        `Cliente: ${userInfo.name}\n` +
        `WhatsApp: ${userInfo.whatsapp}\n\n` +
        `ITENS DO PEDIDO:\n${itemsListSimple}\n\n` +
        `RESUMO:\n` +
        `Subtotal: R$ ${subtotal.toFixed(2)}\n` +
        (deliveryFee > 0 ? `Taxa de Entrega: R$ ${deliveryFee.toFixed(2)}\n` : '') +
        (appliedCoupon ? `Desconto: - R$ ${discount.toFixed(2)}\n` : '') +
        `TOTAL: R$ ${total.toFixed(2)}\n\n` +
        `ENTREGA/PAGAMENTO:\n` +
        (orderType === OrderType.DELIVERY ? `Endereço: ${userInfo.address}\n` : `Mesa: ${userInfo.tableNumber}\n`) +
        `Forma de Pagamento: ${paymentMethod === 'pix' ? 'Pix' : 'Cartão (Link)'}\n\n` +
        `Aqui está meu comprovante 👇`;
    } 
    else if (paymentMethod === 'delivery_card') {
      message = `🔥 NOVO PEDIDO - ${tenant.name.toUpperCase()}\n\n` +
        `Cliente: ${userInfo.name}\n` +
        `WhatsApp: ${userInfo.whatsapp}\n\n` +
        `ITENS:\n${itemsListSimple}\n\n` +
        `Total: R$ ${total.toFixed(2)}\n\n` +
        `💳 PAGAMENTO NA ENTREGA:\n` +
        `Endereço: ${userInfo.address}\n` +
        `Levar maquininha: "${cardBrand}"\n\n` +
        `Aguardando confirmação! 🛵`;
    }
    else {
      message = `🔥 NOVO PEDIDO - ${tenant.name.toUpperCase()}\n\n` +
        `Cliente: ${userInfo.name} - Mesa: ${userInfo.tableNumber}\n\n` +
        `ITENS:\n${itemsListSimple}\n\n` +
        `Total: R$ ${total.toFixed(2)}\n\n` +
        `🍢 Pagamento na Mesa\n` +
        `Por favor, confirme meu pedido!`;
    }
    
    window.open(`https://wa.me/${tenant.whatsapp}?text=${encodeURIComponent(message)}`);
  };

  const renderHeader = (title: string) => (
    <header className="px-6 pt-12 pb-6 flex items-center gap-4">
      <button onClick={() => step === 'review' ? onBack() : step === 'details' ? setStep('review') : setStep('details')} className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 text-white' : 'bg-white border-silver text-[#0F172A]'}`}>
        <ChevronLeft size={20} />
      </button>
      <h1 className={`font-bold text-lg transition-colors ${isDarkMode ? 'text-white' : 'text-[#0F172A]'}`}>{title}</h1>
    </header>
  );

  if (step === 'review') {
    return (
      <div className={`min-h-screen pb-48 animate-in fade-in duration-500 transition-colors ${isDarkMode ? 'bg-[#121212]' : 'bg-[#F8FAFC]'}`}>
        {renderHeader('Meu Carrinho')}
        {items.length > 0 ? (
          <div className="px-6 space-y-6">
            <div className="space-y-4">
              {items.map((item) => {
                const itemBasePrice = item.price + (item.selectedSides || []).reduce((acc, s) => acc + s.price, 0);
                return (
                  <div key={item.id + JSON.stringify(item.selectedSides) + item.itemObservation} className={`p-4 rounded-xl border transition-colors ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 shadow-black/20' : 'bg-white border-silver shadow-sm'}`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center ${isDarkMode ? 'bg-[#121212]' : 'bg-[#F1F5F9]'}`}>
                        {item.image ? (
                          <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                        ) : (
                          <Flame className="text-primary/40" size={24} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-bold text-[11px] mb-0.5 truncate uppercase tracking-tight ${isDarkMode ? 'text-gray-200' : 'text-[#0F172A]'}`}>{item.name}</h4>
                        
                        {(item.selectedSides || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1">
                            {(item.selectedSides || []).map((s, i) => (
                              <span key={i} className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-black uppercase">{s.name}</span>
                            ))}
                          </div>
                        )}

                        <p className="text-primary font-bold text-xs mb-2">R$ {itemBasePrice.toFixed(2)}</p>
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center rounded-lg p-0.5 border ${isDarkMode ? 'bg-[#121212]/5 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                            <button onClick={() => onUpdateQuantity(item.id, -1)} className={`w-6 h-6 rounded flex items-center justify-center border ${isDarkMode ? 'bg-white/5 border-white/5 text-gray-400' : 'bg-white border-gray-200 text-[#0F172A]'}`}><Minus size={12} /></button>
                            <span className={`w-8 text-center text-[10px] font-bold ${isDarkMode ? 'text-white' : 'text-[#0F172A]'}`}>{item.quantity}</span>
                            <button onClick={() => onUpdateQuantity(item.id, 1)} className={`w-6 h-6 rounded flex items-center justify-center border ${isDarkMode ? 'bg-white/5 border-white/5 text-gray-400' : 'bg-white border-gray-200 text-[#0F172A]'}`}><Plus size={12} /></button>
                          </div>
                          <button onClick={() => onUpdateQuantity(item.id, -item.quantity)} className="text-gray-500 hover:text-red-500 transition-colors ml-auto p-1">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button 
              onClick={onBack}
              className={`w-full py-4 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 font-bold transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-gray-50 border-gray-200 text-[#0F172A]'}`}
            >
              <Plus size={18} />
              <span className="text-xs uppercase tracking-widest">Adicionar mais itens</span>
            </button>

            {suggestionSections.length > 0 && (
              <div className="space-y-8 py-4">
                <div className="flex items-center gap-2"><div className="w-1 h-4 bg-primary rounded-full" /><h3 className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-[#0F172A]'}`}>Complete seu Pedido</h3></div>
                {suggestionSections.map((section) => (
                  <div key={section.id} className="space-y-4">
                    <div className="flex items-center gap-2 text-primary opacity-60">{section.icon}<span className="text-[9px] font-black uppercase tracking-[0.15em]">{section.title}</span></div>
                    <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar -mx-6 px-6">
                      {section.items.map((product) => (
                        <div key={product.id} onClick={() => onSelectProduct(product)} className={`min-w-[200px] p-2.5 rounded-2xl border flex gap-3 items-center ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-silver shadow-sm'}`}>
                          <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-black/10 flex items-center justify-center">
                            {product.image ? (
                              <img src={product.image} loading="lazy" className="w-full h-full object-cover" />
                            ) : (
                              <Flame className="text-primary/40" size={20} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className={`text-[9px] font-black truncate uppercase tracking-tight mb-1 ${isDarkMode ? 'text-white' : 'text-[#0F172A]'}`}>{product.name}</h4>
                            <div className="flex items-center justify-between"><span className="text-primary font-black text-[10px]">R$ {product.price.toFixed(2)}</span><div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Plus size={12} /></div></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : <div className="py-20 text-center px-6"><h3 className={`font-bold text-lg mb-4 ${isDarkMode ? 'text-white' : 'text-[#0F172A]'}`}>Carrinho Vazio</h3><button onClick={onBack} className="w-full bg-primary text-white py-4 rounded-xl font-bold">Escolher Itens</button></div>}
        {items.length > 0 && (
          <div className="fixed bottom-[96px] left-1/2 -translate-x-1/2 w-full max-w-md px-6">
            <button onClick={() => setStep('details')} className="w-full bg-primary text-white h-14 rounded-xl flex items-center justify-center gap-3 font-bold shadow-xl shadow-primary/20"><span>Continuar</span><ArrowRight size={18} /></button>
          </div>
        )}
      </div>
    );
  }

  if (step === 'details') {
    return (
      <div className={`min-h-screen pb-40 animate-in fade-in duration-500 transition-colors ${isDarkMode ? 'bg-[#121212]' : 'bg-[#F8FAFC]'}`}>
        {renderHeader('Dados do Cliente')}
        <div className="px-6 space-y-6">
          <div className="space-y-4">
            <div className="relative"><User className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} /><input type="text" value={userInfo.name} onChange={(e) => setUserInfo({...userInfo, name: e.target.value})} placeholder="Qual seu nome?" className={`w-full h-14 pl-12 pr-4 rounded-xl border text-sm font-bold ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 text-white' : 'bg-white border-silver text-[#0F172A] placeholder-gray-400'}`} /></div>
            <div className="relative"><MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} /><input type="tel" value={userInfo.whatsapp} onChange={(e) => setUserInfo({...userInfo, whatsapp: e.target.value})} placeholder="Seu WhatsApp (Obrigatório)" className={`w-full h-14 pl-12 pr-4 rounded-xl border text-sm font-bold ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 text-white' : 'bg-white border-silver text-[#0F172A] placeholder-gray-400'}`} /></div>
            {orderType === OrderType.DELIVERY ? <div className="relative"><MapPin className="absolute left-4 top-4 text-primary" size={20} /><textarea value={userInfo.address} onChange={(e) => setUserInfo({...userInfo, address: e.target.value})} placeholder="Rua, Número, Bairro..." className={`w-full py-4 pl-12 pr-4 rounded-xl border min-h-[100px] text-sm font-medium ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 text-white' : 'bg-white border-silver text-[#0F172A] placeholder-gray-400'}`} /></div> : <input type="text" value={userInfo.tableNumber} onChange={(e) => setUserInfo({...userInfo, tableNumber: e.target.value})} placeholder="Qual o número da mesa?" className={`w-full py-5 px-6 rounded-xl border font-bold text-center text-xl ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 text-white' : 'bg-white border-silver text-[#0F172A]'}`} />}
          </div>
          <div className="fixed bottom-[96px] left-1/2 -translate-x-1/2 w-full max-w-md px-6">
            <button disabled={!userInfo.name || !userInfo.whatsapp || (orderType === OrderType.DELIVERY ? !userInfo.address : !userInfo.tableNumber)} onClick={() => setStep('payment')} className="w-full bg-primary text-white h-14 rounded-xl flex items-center justify-center gap-3 font-bold disabled:opacity-30"><span>Ir para Pagamento</span><ArrowRight size={18} /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-40 animate-in fade-in duration-500 transition-colors ${isDarkMode ? 'bg-[#121212]' : 'bg-[#F8FAFC]'}`}>
      {renderHeader('Pagamento')}
      <div className="px-6 space-y-6">
        <div className="grid grid-cols-2 gap-3">
          {orderType === OrderType.DELIVERY ? (
            <>
              {[
                { id: 'pix', label: 'Pix Online', icon: <QrCode size={18} /> },
                { id: 'link', label: 'Link Cartão', icon: <CardIcon size={18} /> },
                { id: 'delivery_card', label: 'Cartão Entrega', icon: <CreditCard size={18} /> }
              ].map(m => (
                <button 
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                  className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all ${paymentMethod === m.id ? 'bg-primary border-primary text-white shadow-lg' : (isDarkMode ? 'bg-[#1a1a1a] border-white/5 text-gray-500' : 'bg-white border-silver text-[#64748B]')}`}
                >
                  {m.icon}
                  <span className="text-[9px] font-black uppercase tracking-widest">{m.label}</span>
                </button>
              ))}
            </>
          ) : (
            <button 
              onClick={() => setPaymentMethod('at_table')}
              className="col-span-2 flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border bg-primary border-primary text-white shadow-lg"
            >
              <Store size={24} />
              <span className="text-[11px] font-black uppercase tracking-widest">Pagar na Mesa</span>
            </button>
          )}
        </div>

        {orderType === OrderType.DELIVERY && (
          <div className={`p-6 rounded-2xl border transition-all ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 shadow-black/20' : 'bg-white border-silver shadow-sm'}`}>
            <h3 className={`text-xs font-black uppercase tracking-widest mb-4 ${isDarkMode ? 'text-white' : 'text-[#0F172A]'}`}>Informações do Pagamento</h3>
            
            {paymentMethod === 'pix' && (
              <div className="space-y-4">
                <div className={`flex items-center gap-2 p-3 rounded-lg border ${isDarkMode ? 'bg-[#121212] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                  <span className={`flex-1 text-[10px] font-mono font-bold truncate ${isDarkMode ? 'text-gray-300' : 'text-[#0F172A]'}`}>{tenant.pixKey}</span>
                  <button onClick={copyPix} className="p-2 text-primary">{copied ? <Check size={18} /> : <Copy size={18} />}</button>
                </div>
                <p className={`text-[9px] font-bold uppercase ${isDarkMode ? 'text-gray-500' : 'text-[#64748B]'}`}>Efetue o Pix e envie o comprovante no final.</p>
              </div>
            )}

            {paymentMethod === 'link' && (
              <div className="space-y-4">
                <a href={tenant.paymentLink} target="_blank" rel="noreferrer" className="w-full bg-blue-600 text-white h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-[10px] uppercase tracking-widest">
                  Pagar Agora no Link <ExternalLink size={14} />
                </a>
              </div>
            )}

            {paymentMethod === 'delivery_card' && (
              <div className="space-y-4">
                <label className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-[#64748B]'}`}>Selecione a Bandeira:</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Master', 'Visa', 'Elo', 'Hiper', 'Amex', 'Outra'].map(brand => (
                    <button 
                      key={brand}
                      onClick={() => setCardBrand(brand)}
                      className={`py-2 rounded-lg text-[9px] font-black uppercase border transition-all ${cardBrand === brand ? 'bg-primary border-primary text-white shadow-md' : (isDarkMode ? 'bg-white/5 border-white/5 text-gray-500' : 'bg-gray-100 border-gray-200 text-[#0F172A]')}`}
                    >
                      {brand}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- SEÇÃO DE CUPOM DESTACADA --- */}
        {orderType !== OrderType.LOCAL && (
          <div className={`p-6 rounded-2xl border shadow-xl ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-silver'}`}>
            <div className="mb-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Ticket size={16} className="text-primary" /> Cupom de Desconto
                </span>
                {appliedCoupon && (
                  <button onClick={removeCoupon} className="text-red-500 text-[9px] font-bold uppercase hover:underline">Remover</button>
                )}
              </div>
              
              <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="EX: BRUTUS10"
                    disabled={!!appliedCoupon}
                    className={`flex-1 h-12 px-4 rounded-xl border text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all ${isDarkMode ? 'bg-[#09090B] border-white/10 text-white placeholder-gray-700' : 'bg-gray-50 border-gray-200 text-[#0F172A]'}`}
                  />
                  <button 
                    onClick={handleApplyCoupon}
                    disabled={!couponCode || !!appliedCoupon}
                    className="bg-primary text-white px-6 rounded-xl font-bold text-[10px] uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 active:scale-95 transition-all"
                  >
                    {appliedCoupon ? <Check size={18} /> : 'Aplicar'}
                  </button>
              </div>
              {couponError && <p className="text-red-500 text-[9px] font-bold mt-1 animate-pulse">{couponError}</p>}
              {appliedCoupon && <p className="text-emerald-500 text-[9px] font-black mt-1 flex items-center gap-1 animate-in slide-in-from-top-1">🎉 Cupom '{appliedCoupon.code}' de R$ {discount.toFixed(2)} aplicado!</p>}
            </div>

            <div className="space-y-3 mb-4 pt-4 border-t border-dashed border-gray-500/20">
              <div className={`flex justify-between text-[11px] font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}><span>Subtotal</span><span className={isDarkMode ? 'text-white' : 'text-[#0F172A]'}>R$ {subtotal.toFixed(2)}</span></div>
              {deliveryFee > 0 && <div className={`flex justify-between text-[11px] font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}><span>Taxa de Entrega</span><span className={isDarkMode ? 'text-white' : 'text-[#0F172A]'}>R$ {deliveryFee.toFixed(2)}</span></div>}
              {appliedCoupon && <div className="flex justify-between text-[11px] font-bold text-emerald-500 animate-in fade-in"><span>Desconto Cupom</span><span>- R$ {discount.toFixed(2)}</span></div>}
            </div>
            <div className={`pt-4 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-100'} flex justify-between items-center`}>
              <span className={`font-black uppercase text-xs ${isDarkMode ? 'text-white' : 'text-[#0F172A]'}`}>Total</span>
              <span className="text-primary font-black text-xl">R$ {total.toFixed(2)}</span>
            </div>
          </div>
        )}

        {orderType === OrderType.LOCAL && (
          <div className={`p-6 rounded-2xl border shadow-xl ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-silver'}`}>
            <div className="space-y-3 mb-4">
              <div className={`flex justify-between text-[11px] font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}><span>Subtotal</span><span className={isDarkMode ? 'text-white' : 'text-[#0F172A]'}>R$ {subtotal.toFixed(2)}</span></div>
            </div>
            <div className={`pt-4 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-100'} flex justify-between items-center`}>
              <span className={`font-black uppercase text-xs ${isDarkMode ? 'text-white' : 'text-[#0F172A]'}`}>Total</span>
              <span className="text-primary font-black text-xl">R$ {total.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="fixed bottom-[96px] left-1/2 -translate-x-1/2 w-full max-w-md px-6">
          <button onClick={handleFinish} className="w-full bg-[#25D366] text-white h-14 rounded-xl flex items-center justify-center gap-3 font-bold shadow-xl shadow-green-500/20 active:scale-95 transition-transform">
            <MessageCircle size={20} />
            <span>Finalizar no WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Cart;
