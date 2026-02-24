
import React, { useState, useEffect, useMemo } from 'react';
import { UserPlus, TrendingUp, Trophy, Star, History, Search, ArrowUpDown, Smartphone, Clock, Ticket, X, Mail, MapPin, Save, Loader2 } from 'lucide-react';
import { Tenant, Coupon, Customer } from '../types';
import { supabase } from '../supabaseClient';

interface DashboardCustomersProps {
  customers: any[]; // Mantido para compatibilidade de métricas calculadas na Dashboard
  customerKPIs: any;
  tenant: Tenant;
  coupons: Coupon[];
  onSaveCoupon: (coupon: Coupon) => void;
}

const DashboardCustomers: React.FC<DashboardCustomersProps> = ({ customerKPIs, tenant, coupons, onSaveCoupon }) => {
  const [clientFilter, setClientFilter] = useState<'all' | 'vip' | 'sumido'>('all');
  const [clientSearch, setClientSearch] = useState('');
  const [clientSort, setClientSort] = useState<'spend' | 'orders' | 'recent'>('spend');
  
  // Estado para Clientes do Banco de Dados
  const [dbCustomers, setDbCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [form, setForm] = useState({ name: '', whatsapp: '', email: '', address: '', reference: '' });

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('tenant_slug', tenant.slug)
        .order('total_spent', { ascending: false });
      
      if (error) throw error;
      
      if (data) {
        setDbCustomers(data.map((c: any) => ({
          id: c.id,
          name: c.name,
          whatsapp: c.whatsapp,
          email: c.email,
          address: c.address,
          totalOrders: c.total_orders,
          totalSpent: parseFloat(c.total_spent || '0'),
          lastOrderDate: c.last_order_date,
          tenantSlug: c.tenant_slug
        })));
      }
    } catch (err) {
      console.error("Erro ao buscar clientes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenant.slug) {
        fetchCustomers();
        
        // Subscrição real-time dinâmica
        const channel = supabase.channel('customers_db')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `tenant_slug=eq.${tenant.slug}` }, () => fetchCustomers())
          .subscribe();

        return () => { supabase.removeChannel(channel); };
    }
  }, [tenant.slug]);

  const filteredCustomers = useMemo(() => {
    let res = dbCustomers.filter(c => {
      const name = c.name || '';
      const whatsapp = c.whatsapp || '';
      const email = c.email || '';
      
      const matchesSearch = name.toLowerCase().includes(clientSearch.toLowerCase()) || 
                            whatsapp.includes(clientSearch) ||
                            email.toLowerCase().includes(clientSearch.toLowerCase());
                            
      const daysSince = c.lastOrderDate ? Math.floor((Date.now() - new Date(c.lastOrderDate).getTime()) / (1000 * 3600 * 24)) : 999;
      const matchesFilter = clientFilter === 'all' || 
                            (clientFilter === 'vip' && c.totalOrders >= 5) ||
                            (clientFilter === 'sumido' && daysSince >= 15);

      return matchesSearch && matchesFilter;
    });

    res.sort((a, b) => {
        if (clientSort === 'spend') return b.totalSpent - a.totalSpent;
        if (clientSort === 'orders') return b.totalOrders - a.totalOrders;
        if (clientSort === 'recent') return new Date(b.lastOrderDate || 0).getTime() - new Date(a.lastOrderDate || 0).getTime();
        return 0;
    });

    return res;
  }, [dbCustomers, clientFilter, clientSearch, clientSort]);

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('customers').insert([{
        tenant_slug: tenant.slug,
        name: form.name,
        whatsapp: form.whatsapp.replace(/\D/g, ''),
        email: form.email || null,
        address: form.address || null,
        reference: form.reference || null,
        user_id: null,
        total_orders: 0,
        total_spent: 0
      }]);

      if (error) throw error;
      
      setIsModalOpen(false);
      setForm({ name: '', whatsapp: '', email: '', address: '', reference: '' });
      fetchCustomers();
    } catch (err: any) {
      alert("Erro ao cadastrar cliente: " + (err.message || "Tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateAndSendCoupon = (customer: any) => {
    const isVIP = customer.totalOrders >= 5;
    const prefix = isVIP ? 'VIP' : 'PROMO';
    const cleanName = (customer.name || 'CLIENTE').split(' ')[0].toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const code = `${prefix}-${cleanName}-${Math.floor(Math.random() * 99)}`;
    const discount = isVIP ? 15.00 : 10.00;

    const newCoupon: Coupon = {
      id: `cp-${Date.now()}`,
      code: code,
      discountValue: discount,
      maxUses: 1,
      currentUses: 0,
      isActive: true,
      customerEmail: customer.email,
      customerPhone: customer.whatsapp
    };
    
    onSaveCoupon(newCoupon);

    let message = `Olá ${customer.name}, presente para você do ${tenant.name}! 🍢\n\nUse o cupom *${code}* e ganhe R$ ${discount.toFixed(2)} OFF em seu próximo pedido! 🔥`;
    window.open(`https://wa.me/55${customer.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="space-y-6">
       <div className="grid grid-cols-3 gap-4">
          <div className="p-5 bg-[#161618] border border-white/5 rounded-2xl flex flex-col justify-between">
             <div className="flex justify-between items-start">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Novos no Mês</p>
                <div className="p-1.5 bg-green-500/10 rounded-lg text-green-500"><UserPlus size={14} /></div>
             </div>
             <p className="text-2xl font-bold text-white mt-2">{customerKPIs.newThisMonth}</p>
          </div>
          <div className="p-5 bg-[#161618] border border-white/5 rounded-2xl flex flex-col justify-between">
             <div className="flex justify-between items-start">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Taxa de Retenção</p>
                <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-500"><TrendingUp size={14} /></div>
             </div>
             <p className="text-2xl font-bold text-white mt-2">{customerKPIs.retentionRate.toFixed(1)}%</p>
          </div>
          <div className="p-5 bg-[#161618] border border-white/5 rounded-2xl flex flex-col justify-between">
             <div className="flex justify-between items-start">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Baleias (Classe A)</p>
                <div className="p-1.5 bg-yellow-500/10 rounded-lg text-yellow-500"><Trophy size={14} /></div>
             </div>
             <p className="text-2xl font-bold text-white mt-2">{customerKPIs.whales}</p>
          </div>
       </div>

       <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-2">
             <button onClick={() => setClientFilter('all')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${clientFilter === 'all' ? 'bg-primary text-white' : 'bg-[#161618] border border-white/5 text-gray-400'}`}>Todos</button>
             <button onClick={() => setClientFilter('vip')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${clientFilter === 'vip' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' : 'bg-[#161618] border border-white/5 text-gray-400'}`}><Star size={12} /> VIPs</button>
             <button onClick={() => setClientFilter('sumido')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${clientFilter === 'sumido' ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30' : 'bg-[#161618] border border-white/5 text-gray-400'}`}><History size={12} /> Sumidos</button>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
             <div className="relative flex-1 md:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type="text" placeholder="Buscar cliente..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="w-full bg-[#161618] border border-white/5 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-primary/50" />
             </div>
             <button onClick={() => setIsModalOpen(true)} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-orange-600 transition-all shadow-lg shadow-primary/20"><UserPlus size={14} /> Novo Cliente</button>
          </div>
       </div>

       <div className="bg-[#161618] border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-xs">
             <thead className="text-gray-500 font-bold uppercase border-b border-white/5 bg-[#09090B]/30">
                <tr>
                   <th className="p-4">Cliente</th>
                   <th className="p-4 text-center">Pedidos</th>
                   <th className="p-4 text-center">Total Gasto</th>
                   <th className="p-4 text-center">Último Pedido</th>
                   <th className="p-4 text-right">Ações</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr><td colSpan={5} className="p-10 text-center text-gray-500 uppercase font-bold tracking-widest text-[10px]">Carregando Clientes do Banco...</td></tr>
                ) : filteredCustomers.length > 0 ? filteredCustomers.map((customer) => (
                   <tr key={customer.id} className="text-white hover:bg-white/5 transition-colors group">
                      <td className="p-4">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-xs font-bold border border-white/10 uppercase">{(customer.name || 'C').charAt(0)}</div>
                            <div>
                               <div className="font-bold text-sm">{customer.name}</div>
                               <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1"><Smartphone size={10} /> {customer.whatsapp}</div>
                               {customer.email && <div className="text-[9px] text-gray-600 flex items-center gap-1"><Mail size={9} /> {customer.email}</div>}
                            </div>
                         </div>
                      </td>
                      <td className="p-4 text-center font-bold">{customer.totalOrders}</td>
                      <td className="p-4 text-center font-bold text-emerald-500">R$ {customer.totalSpent.toFixed(2)}</td>
                      <td className="p-4 text-center text-gray-400 font-mono">{customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString() : 'N/A'}</td>
                      <td className="p-4 text-right">
                         <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => handleGenerateAndSendCoupon(customer)} className="p-2 hover:bg-green-500/20 text-green-500 rounded transition-colors" title="Enviar Cupom Personalizado"><Ticket size={14}/></button>
                         </div>
                      </td>
                   </tr>
                )) : (
                  <tr><td colSpan={5} className="p-10 text-center text-gray-600 italic">Nenhum cliente cadastrado no banco para esta loja.</td></tr>
                )}
             </tbody>
          </table>
       </div>

       {/* Modal Novo Cliente */}
       {isModalOpen && (
          <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
             <div className="bg-[#161618] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#09090B]/50">
                    <h3 className="text-white font-bold text-sm uppercase tracking-widest">Cadastrar Novo Cliente</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white"><X size={20}/></button>
                </div>
                <form onSubmit={handleSaveCustomer} className="p-6 space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Nome Completo</label>
                        <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full h-12 bg-[#09090B] border border-white/10 rounded-xl px-4 text-sm text-white focus:border-primary/50 outline-none" placeholder="Ex: João Silva" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-500 ml-1">WhatsApp</label>
                        <input required type="tel" value={form.whatsapp} onChange={e => setForm({...form, whatsapp: e.target.value.replace(/\D/g, '')})} className="w-full h-12 bg-[#09090B] border border-white/10 rounded-xl px-4 text-sm text-white focus:border-primary/50 outline-none" placeholder="DDD + Número (ex: 11999999999)" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-500 ml-1">E-mail (Para Cupons Exclusivos)</label>
                        <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full h-12 bg-[#09090B] border border-white/10 rounded-xl px-4 text-sm text-white focus:border-primary/50 outline-none" placeholder="cliente@email.com" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Endereço Padrão</label>
                        <input type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full h-12 bg-[#09090B] border border-white/10 rounded-xl px-4 text-sm text-white focus:border-primary/50 outline-none" placeholder="Rua, Bairro..." />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Referência (Opcional)</label>
                        <input type="text" value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} className="w-full h-12 bg-[#09090B] border border-white/10 rounded-xl px-4 text-sm text-white focus:border-primary/50 outline-none" placeholder="Perto de..." />
                    </div>
                    <button disabled={saving} className="w-full h-14 bg-primary hover:bg-orange-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg transition-all flex items-center justify-center gap-2 mt-4">
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <><Save size={16}/> Salvar no Supabase</>}
                    </button>
                    <p className="text-[9px] text-gray-600 text-center mt-2 uppercase font-bold tracking-tight">Os dados serão sincronizados com todos os dispositivos.</p>
                </form>
             </div>
          </div>
       )}
    </div>
  );
};

export default DashboardCustomers;
