
import React, { useState } from 'react';
import { Coupon, Tenant } from '../../types';
import { Plus, Share2, Trash2, Ticket, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';

interface DashboardPromosProps {
  coupons: Coupon[];
  onSaveCoupon: (coupon: Coupon) => void;
  onDeleteCoupon: (id: string) => void;
  tenant: Tenant;
  couponStats: Record<string, { revenue: number, count: number }>;
}

const DashboardPromos: React.FC<DashboardPromosProps> = ({ coupons, onSaveCoupon, onDeleteCoupon, tenant, couponStats }) => {
  const [promoFilter, setPromoFilter] = useState<'active' | 'expired'>('active');
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [couponForm, setCouponForm] = useState<Partial<Coupon>>({ code: '', discountValue: 0, maxUses: 0, currentUses: 0, isActive: true });

  const filteredCoupons = coupons.filter(c => 
      promoFilter === 'active' ? (c.isActive && (c.currentUses || 0) < c.maxUses) : (!c.isActive || (c.currentUses || 0) >= c.maxUses)
  );

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const dbPayload = {
      tenant_slug: tenant.slug,
      code: couponForm.code?.toUpperCase(),
      discount_value: couponForm.discountValue,
      max_uses: couponForm.maxUses,
      current_uses: couponForm.currentUses || 0,
      is_active: couponForm.isActive,
      customer_email: couponForm.customerEmail || null,
      user_id: couponForm.userId || null
    };

    try {
      if (couponForm.id) {
          const { error } = await supabase.from('coupons').update(dbPayload).eq('id', couponForm.id);
          if (error) throw error;
      } else {
          const { error } = await supabase.from('coupons').insert([dbPayload]);
          if (error) throw error;
          
          if (dbPayload.is_active && !dbPayload.customer_email) {
              await supabase.from('notifications').insert({
                  title: 'Novo Cupom Disponível! 🎟️',
                  message: `Use o código ${dbPayload.code} e ganhe R$ ${dbPayload.discount_value?.toFixed(2)} de desconto em seu pedido!`,
                  type: 'promo',
                  is_read: false,
                  tenant_slug: tenant.slug
              });
          }
      }
      
      setIsCouponModalOpen(false);
      setCouponForm({ code: '', discountValue: 0, maxUses: 0, currentUses: 0, isActive: true });
    } catch (err: any) {
      alert("Erro ao salvar cupom: " + err.message);
    }
  };

  const handleDeleteCoupon = (id: string) => {
    onDeleteCoupon(id);
  };

  const handleShareCoupon = (coupon: Coupon) => {
    const message = `Olá! Vi que você gosta de churrasco de verdade. 🔥\n\nUse o cupom *${coupon.code}* e ganhe *R$ ${coupon.discountValue.toFixed(2)} OFF* no seu pedido hoje!\n\nAcesse nosso cardápio: ${window.location.origin}?loja=${tenant.slug}\n\n*Corra que os cupons são limitados!* 🏃‍♂️💨`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
          <div className="flex gap-2 p-1 bg-[#161618] border border-white/5 rounded-lg">
              <button onClick={() => setPromoFilter('active')} className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${promoFilter === 'active' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>Ativos</button>
              <button onClick={() => setPromoFilter('expired')} className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${promoFilter === 'expired' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>Expirados</button>
          </div>
          <button onClick={() => setIsCouponModalOpen(true)} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-orange-600 transition-colors shadow-lg shadow-primary/20">
             <Plus size={14} /> Novo Cupom
          </button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCoupons.map(coupon => {
             const stat = couponStats[coupon.code] || { revenue: 0, count: 0 };
             const avgTicket = stat.count > 0 ? stat.revenue / stat.count : 0;
             const currentUses = coupon.currentUses || 0;
             
             return (
                <div key={coupon.id} className={`bg-[#161618] border rounded-2xl p-5 relative group overflow-hidden transition-all ${promoFilter === 'expired' ? 'opacity-60 border-white/5' : 'border-white/10 hover:border-primary/30'}`}>
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                       <Ticket size={80} className="transform rotate-12" />
                    </div>
                    
                    <div className="relative z-10">
                       <div className="flex justify-between items-start mb-4">
                          <div className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                             <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-0.5">Código</p>
                             <p className="text-sm font-black text-primary tracking-wider">{coupon.code}</p>
                          </div>
                          <div className="flex gap-2">
                              <button onClick={() => handleShareCoupon(coupon)} className="p-2 hover:bg-green-500/20 text-green-500 rounded-lg transition-colors" title="Compartilhar WhatsApp">
                                  <Share2 size={16} />
                              </button>
                              <button onClick={() => handleDeleteCoupon(coupon.id)} className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors" title="Excluir">
                                  <Trash2 size={16} />
                              </button>
                          </div>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-4 mb-4">
                           <div>
                              <p className="text-[10px] text-gray-500 font-bold uppercase">Desconto</p>
                              <p className="text-xl font-bold text-white">R$ {coupon.discountValue.toFixed(2)}</p>
                           </div>
                           <div>
                              <p className="text-[10px] text-gray-500 font-bold uppercase">Receita Gerada</p>
                              <p className="text-xl font-bold text-green-500">R$ {stat.revenue.toFixed(0)}</p>
                           </div>
                       </div>

                       <div className="space-y-1.5 mb-4">
                          <div className="flex justify-between text-[9px] font-bold uppercase text-gray-400">
                              <span>Usos: {currentUses} / {coupon.maxUses}</span>
                              <span>{Math.round((currentUses / (coupon.maxUses || 1)) * 100)}%</span>
                          </div>
                          <div className="w-full bg-black/30 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-gradient-to-r from-primary to-orange-400 h-full" style={{ width: `${(currentUses / (coupon.maxUses || 1)) * 100}%` }} />
                          </div>
                       </div>

                       {coupon.customerEmail && (
                         <div className="mb-4 px-3 py-2 bg-primary/5 border border-primary/10 rounded-lg">
                           <p className="text-[8px] font-black uppercase text-primary tracking-widest">Exclusivo para:</p>
                           <p className="text-[10px] text-gray-300 truncate">{coupon.customerEmail}</p>
                         </div>
                       )}

                       <div className="pt-3 border-t border-white/5 flex justify-between items-center text-[10px]">
                           <span className="text-gray-500 font-bold uppercase">Ticket Médio</span>
                           <span className="text-white font-mono">R$ {avgTicket.toFixed(2)}</span>
                       </div>
                    </div>
                </div>
             );
          })}
       </div>

       {isCouponModalOpen && (
         <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] backdrop-blur-sm">
            <div className="bg-[#161618] rounded-2xl w-full max-w-md border border-white/10 p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-white font-bold">Novo Cupom</h3>
                   <button onClick={() => setIsCouponModalOpen(false)} className="text-gray-500 hover:text-white"><X size={20}/></button>
                </div>
                <form onSubmit={handleSaveCoupon} className="space-y-4">
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Código do Cupom</label>
                      <input required type="text" placeholder="EX: PROMO10" value={couponForm.code} onChange={e => setCouponForm({...couponForm, code: e.target.value.toUpperCase()})} className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-primary/50 outline-none uppercase" />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Valor do Desconto (R$)</label>
                      <input required type="number" step="0.50" value={couponForm.discountValue} onChange={e => setCouponForm({...couponForm, discountValue: parseFloat(e.target.value)})} className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-primary/50 outline-none" />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Limite de Usos</label>
                      <input required type="number" value={couponForm.maxUses} onChange={e => setCouponForm({...couponForm, maxUses: parseInt(e.target.value)})} className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-primary/50 outline-none" />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Segmentação por E-mail (Opcional)</label>
                      <input type="email" placeholder="cliente@email.com" value={couponForm.customerEmail || ''} onChange={e => setCouponForm({...couponForm, customerEmail: e.target.value})} className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-primary/50 outline-none" />
                   </div>
                   <div className="flex items-center gap-3 mt-2">
                      <input type="checkbox" checked={couponForm.isActive} onChange={e => setCouponForm({...couponForm, isActive: e.target.checked})} className="w-4 h-4 accent-primary" />
                      <span className="text-xs text-white font-bold">Ativo Imediatamente</span>
                   </div>
                   <button type="submit" className="w-full bg-primary hover:bg-orange-600 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all mt-4">Criar Cupom</button>
                </form>
            </div>
         </div>
      )}
    </div>
  );
};

export default DashboardPromos;
