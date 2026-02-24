
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Bike, Utensils, Search, Clock, AlertTriangle, Flame, CheckCircle2, Archive, ShoppingBag, XCircle, Printer, Loader2, Volume2, VolumeX, Sparkles, Send, Check, Trash2, X, Plus } from 'lucide-react';
import { Order, OrderStatus, Tenant, OrderType, CartItem, Product } from '../../types';
import { supabase } from '../../supabaseClient';

interface DashboardOrdersProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  now: Date;
  tenant: Tenant;
}

const DashboardOrders: React.FC<DashboardOrdersProps> = ({ orders = [], setOrders, updateOrderStatus, now, tenant }) => {
  const [orderFilter, setOrderFilter] = useState<'all' | 'delivery' | 'local'>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [returnStockOnDelete, setReturnStockOnDelete] = useState(true);
  
  const [isAudioEnabled, setIsAudioEnabled] = useState(() => {
    return localStorage.getItem('soundEnabled') === 'true'; 
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [recentOrderIds, setRecentOrderIds] = useState<Set<string>>(new Set());

  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);

  // Estados para Lançamento de Venda (Balcão)
  const [showCounterSaleModal, setShowCounterSaleModal] = useState(false);
  const [csTableNumber, setCsTableNumber] = useState('');
  const [csCustomerName, setCsCustomerName] = useState('');
  const [csSelectedItems, setCsSelectedItems] = useState<CartItem[]>([]);
  const [isSavingCounterSale, setIsSavingCounterSale] = useState(false);
  const [selectingDonenessFor, setSelectingDonenessFor] = useState<Product | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState('pending');

  const groupedOrders = useMemo(() => {
    const groups: Record<string, Order[]> = {};
    
    // Filtramos apenas pedidos que não estão finalizados/cancelados
    const activeOrders = orders.filter(o => o && o.status !== 'finished' && o.status !== 'canceled');

    activeOrders.forEach(order => {
      // Agrupamos apenas pedidos LOCAIS que possuem mesa
      if (order.type === OrderType.LOCAL && order.tableNumber) {
        const key = `table-${order.tableNumber}-${(order.customerName || 'CLIENTE').trim().toUpperCase()}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(order);
      } else {
        // Delivery ou sem mesa: cada um é seu próprio grupo
        const key = `single-${order.id}`;
        groups[key] = [order];
      }
    });

    return Object.values(groups).map(group => {
      if (group.length === 1) return group[0];

      // Ordenar por data de criação para identificar o "original"
      const sorted = [...group].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const firstOrder = sorted[0];

      // Mesclar itens
      const allItems = sorted.flatMap((o, orderIdx) => 
        o.items.map((item, itemIdx) => ({
          ...item,
          isAdditional: orderIdx > 0,
          orderId: o.id, // Para saber qual pedido atualizar ao "riscar"
          originalItemIndex: itemIdx // Índice original no array de itens do pedido
        }))
      );

      const total = group.reduce((acc, o) => acc + o.total, 0);

      return {
        ...firstOrder,
        items: allItems,
        total: total,
        isGrouped: true,
        originalOrders: group
      } as Order & { isGrouped?: boolean; originalOrders?: Order[] };
    });
  }, [orders]);

  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audioRef.current.load();
    localStorage.setItem('soundEnabled', String(isAudioEnabled));
  }, [isAudioEnabled]);

  useEffect(() => {
    const channel = supabase.channel(`kds_${tenant.slug}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'orders',
        filter: `tenant_slug=eq.${tenant.slug}` 
      }, (payload) => {
        const newOrderRaw = payload.new;
        
        const mappedOrder: Order = {
          id: newOrderRaw.id,
          orderNumber: newOrderRaw.order_number,
          customerName: newOrderRaw.customer_name || 'Cliente',
          customerWhatsapp: newOrderRaw.customer_whatsapp || '',
          items: newOrderRaw.items || [],
          total: Number(newOrderRaw.total || 0),
          type: newOrderRaw.type as OrderType,
          status: newOrderRaw.status as OrderStatus,
          createdAt: new Date(newOrderRaw.created_at),
          tableNumber: newOrderRaw.table_number,
          address: newOrderRaw.address,
          observation: newOrderRaw.observation,
          userId: newOrderRaw.user_id
        };

        setOrders(prev => {
          const exists = prev.some(o => o.id === mappedOrder.id);
          if (exists) return prev;
          return [mappedOrder, ...prev];
        });

        if (isAudioEnabled && audioRef.current) {
          audioRef.current.play().catch(e => console.warn("Erro ao tocar áudio:", e));
        }

        setRecentOrderIds(prev => new Set(prev).add(mappedOrder.id));
        setTimeout(() => {
          setRecentOrderIds(prev => {
            const next = new Set(prev);
            next.delete(mappedOrder.id);
            return next;
          });
        }, 15000);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public', 
        table: 'orders',
        filter: `tenant_slug=eq.${tenant.slug}`
      }, (payload) => {
        const updated = payload.new;
        setOrders(prev => prev.map(o => o.id === updated.id ? { 
          ...o, 
          status: updated.status as OrderStatus 
        } : o));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'orders',
        filter: `tenant_slug=eq.${tenant.slug}`
      }, (payload) => {
        const deletedId = payload.old.id;
        setOrders(prev => prev.filter(o => o.id !== deletedId));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant.slug, isAudioEnabled, setOrders]);

  const handlePrintOrder = (order: Order) => {
    setPrintingOrder(order);
  };

  const handleOutForDelivery = async (order: Order) => {
    updateOrderStatus(order.id, 'out_for_delivery');
    const message = `Olá, ${order.customerName}! Seu pedido do ${tenant.name} acabou de sair para entrega e logo chegará até você. Prepare o apetite! 🛵🔥`;
    const cleanPhone = order.customerWhatsapp.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleDeleteOrder = async (order: Order) => {
    setIsDeleting(true);
    try {
      if (returnStockOnDelete) {
        for (const item of order.items) {
          const { data: product } = await supabase.from('products').select('stock').eq('id', item.id).single();
          if (product) {
            const currentStock = product.stock || 0;
            await supabase.from('products').update({ 
              stock: currentStock + item.quantity,
              availability: 'available'
            }).eq('id', item.id);
          }
        }
      }

      const { error } = await supabase.from('orders').delete().eq('id', order.id);
      if (error) throw error;
      
      setOrders(prev => prev.filter(o => o.id !== order.id));
      setSelectedOrder(null);
      setShowDeleteConfirm(false);
    } catch (err: any) {
      console.error("Erro ao excluir pedido:", err);
      alert("Erro ao excluir pedido: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleItemChecked = async (orderId: string, itemIdx: number) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const newItems = [...order.items];
    newItems[itemIdx] = { ...newItems[itemIdx], checked: !newItems[itemIdx].checked };

    try {
      const { error } = await supabase.from('orders').update({ items: newItems }).eq('id', orderId);
      if (error) throw error;
      
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, items: newItems } : o));
    } catch (err) {
      console.error("Erro ao riscar item:", err);
    }
  };

  const handleCloseAccount = async (group: Order & { isGrouped?: boolean; originalOrders?: Order[] }) => {
    const orderIds = group.isGrouped ? group.originalOrders?.map(o => o.id) : [group.id];
    if (!orderIds || orderIds.length === 0) return;

    if (!confirm(`Deseja fechar a conta da Mesa ${group.tableNumber}? Todos os pedidos serão marcados como pagos.`)) return;

    try {
      const { error } = await supabase.from('orders').update({ status: 'finished' }).in('id', orderIds);
      if (error) throw error;

      setOrders(prev => prev.map(o => orderIds.includes(o.id) ? { ...o, status: 'finished' } : o));
      setSelectedOrder(null);
    } catch (err) {
      console.error("Erro ao fechar conta:", err);
      alert("Erro ao fechar conta.");
    }
  };

  const handleSaveCounterSale = async () => {
    if (!csCustomerName || csSelectedItems.length === 0) {
      alert("Preencha o nome do cliente e selecione ao menos um item.");
      return;
    }

    setIsSavingCounterSale(true);
    try {
      const total = csSelectedItems.reduce((acc, item) => {
        const sidePrices = (item.selectedSides || []).reduce((sAcc, s) => sAcc + s.price, 0);
        return acc + (item.price + sidePrices) * item.quantity;
      }, 0);

      const orderData = {
        tenant_slug: tenant.slug,
        customer_name: csCustomerName,
        customer_whatsapp: '',
        items: csSelectedItems,
        total: total,
        type: OrderType.LOCAL,
        status: 'pending' as OrderStatus,
        table_number: csTableNumber,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase.from('orders').insert([orderData]).select().single();
      if (error) throw error;

      // Baixa no estoque
      for (const item of csSelectedItems) {
        const { data: product } = await supabase.from('products').select('stock, availability').eq('id', item.id).single();
        if (product) {
          const currentStock = product.stock || 0;
          const newStock = Math.max(0, currentStock - item.quantity);
          const newAvailability = newStock === 0 ? 'out_of_stock' : product.availability;
          await supabase.from('products').update({ stock: newStock, availability: newAvailability }).eq('id', item.id);
        }
      }

      // O Realtime Listener já vai capturar esse INSERT e adicionar ao estado automaticamente.
      // Removido o setOrders manual para evitar duplicidade.
      
      setShowCounterSaleModal(false);
      setCsTableNumber('');
      setCsCustomerName('');
      setCsSelectedItems([]);
    } catch (err: any) {
      console.error("Erro ao lançar venda:", err);
      alert("Erro ao lançar venda: " + err.message);
    } finally {
      setIsSavingCounterSale(false);
    }
  };

  const filteredOrders = groupedOrders.filter(o => {
    const matchesFilter = orderFilter === 'all' || o.type === orderFilter;
    const searchLower = orderSearch.toLowerCase();
    return matchesFilter && (
      o.customerName.toLowerCase().includes(searchLower) || 
      o.orderNumber?.toString().includes(searchLower) ||
      o.id.toString().includes(searchLower) ||
      (o.tableNumber && o.tableNumber.includes(searchLower))
    );
  });

  const getOrdersByStatus = (status: OrderStatus) => filteredOrders.filter(o => o.status === status);

  const columns = [
    { id: 'pending', title: 'Novos', color: 'border-yellow-500', orders: getOrdersByStatus('pending') },
    { id: 'preparing', title: 'Em Preparo', color: 'border-blue-500', orders: getOrdersByStatus('preparing') },
    { id: 'ready_to_send', title: 'Prontos', color: 'border-green-500', orders: getOrdersByStatus('ready_to_send') },
    { id: 'out_for_delivery', title: 'Em Trânsito', color: 'border-indigo-500', orders: getOrdersByStatus('out_for_delivery') }
  ];

  return (
    <div className="flex flex-col gap-0 bg-[#09090B] pb-[50px] min-h-screen">
       <div className="flex items-center justify-between bg-[#09090B] border-b border-white/5 p-3 px-6 shadow-xl sticky top-[-20px] z-[50]">
          <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${isAudioEnabled ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-gray-500 border border-white/5'}`}
              >
                {isAudioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                {isAudioEnabled ? 'Sons' : 'Mudo'}
              </button>
              <div className="flex items-center gap-2 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                <span className="text-[8px] font-black uppercase text-emerald-500 tracking-widest">Tempo Real</span>
              </div>
          </div>
       </div>

        <div className="flex justify-between items-center gap-3 px-6 bg-[#09090B] py-4 border-b border-white/5 relative z-[10]">
          <div className="flex items-center gap-4">
            <div className="flex gap-1 bg-[#161618] p-0.5 rounded-lg border border-white/5 shadow-inner">
              <button onClick={() => setOrderFilter('all')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${orderFilter === 'all' ? 'bg-primary text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>Todos</button>
              <button onClick={() => setOrderFilter('delivery')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${orderFilter === 'delivery' ? 'bg-primary text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}><Bike size={12}/> Delivery</button>
              <button onClick={() => setOrderFilter('local')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${orderFilter === 'local' ? 'bg-primary text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}><Utensils size={12}/> Mesa</button>
            </div>
            
            <button 
              onClick={() => setShowCounterSaleModal(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
            >
              <Plus size={14} />
              <span className="hidden md:inline">Lançar Venda (Balcão)</span>
              <span className="md:hidden">Venda</span>
            </button>
          </div>
          <div className="relative group hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={14} />
            <input type="text" placeholder="BUSCAR..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} className="bg-[#161618] border border-white/5 rounded-lg pl-9 pr-4 py-2 text-[9px] text-white focus:outline-none focus:border-primary/50 w-56 font-black tracking-widest" />
          </div>
       </div>

       {/* Mobile Tabs */}
       <div className="md:hidden flex overflow-x-auto hide-scrollbar border-b border-white/5 bg-[#09090B] px-4 sticky top-0 z-[40]">
         {columns.map(col => (
           <button
             key={col.id}
             onClick={() => setActiveMobileTab(col.id)}
             className={`flex-shrink-0 px-4 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors ${activeMobileTab === col.id ? col.color.replace('border', 'border-b-2 text-white') : 'border-transparent text-gray-500'}`}
           >
             {col.title} ({col.orders.length})
           </button>
         ))}
       </div>

       <div className="w-full pt-4 overflow-x-auto hide-scrollbar bg-[#09090B]">
         <div className="grid grid-cols-1 md:grid-cols-4 gap-2 h-fit min-w-full items-start px-4 md:px-6"> 
           {columns.map(col => (
              <div 
                key={col.id} 
                className={`flex-shrink-0 flex flex-col bg-[#09090B] md:border md:border-white/5 md:rounded-[24px] md:shadow-xl relative h-fit transition-all
                  ${activeMobileTab === col.id ? 'w-full flex' : 'hidden md:flex'}
                `}
              >
                <div className={`hidden md:flex p-3 border-b border-white/5 justify-between items-center bg-[#111113] rounded-t-[24px] ${col.color.replace('border', 'border-b-2')}`}>
                   <h3 className="font-black text-white uppercase tracking-widest text-[9px]">{col.title}</h3>
                   <span className="bg-primary/20 text-primary text-[9px] font-black px-2 py-0.5 rounded-md border border-primary/30">{col.orders.length}</span>
                </div>
                
                <div className="p-1 md:p-3 space-y-3 md:space-y-3 h-fit bg-[#09090B]">
                   <div className="grid grid-cols-2 md:grid-cols-1 gap-2 md:gap-3">
                   {col.orders.map(order => {
                      const isNew = recentOrderIds.has(order.id);
                      const waitTime = Math.floor((now.getTime() - new Date(order.createdAt).getTime()) / 60000);
                      
                      return (
                        <div key={order.id} onClick={() => setSelectedOrder(order)} className={`bg-[#161618] border rounded-xl p-3 shadow-lg transition-all group relative animate-in zoom-in-95 duration-500 h-fit cursor-pointer ${isNew ? 'border-primary ring-2 ring-primary/20 shadow-primary/40 scale-[1.02] z-[20] animate-pulse' : 'border-white/5 hover:border-white/10'}`}>
                           <div className="flex justify-between items-start mb-2 pb-2 border-b border-white/5">
                              <div className="flex-1 min-w-0">
                                 <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="font-black text-white text-base tracking-tighter leading-none">
                                      {order.type === 'local' && order.tableNumber ? `MESA ${order.tableNumber}` : `#${order.orderNumber}`}
                                    </span>
                                    <div className={`px-1.5 py-0.5 rounded-md flex items-center gap-1 border ${order.type === 'delivery' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-orange-500/10 border-orange-500/20 text-orange-400'}`}>
                                       <span className="text-[7px] font-black uppercase tracking-widest">{order.type === 'delivery' ? 'DEL' : `LOCAL`}</span>
                                    </div>
                                 </div>
                                 <p className="text-[11px] font-black text-white uppercase tracking-widest truncate">{order.customerName}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1.5">
                                 <button onClick={(e) => { e.stopPropagation(); handlePrintOrder(order); }} className="p-2 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-lg transition-all active:scale-90 border border-primary/20 group/btn"><Printer size={12} /></button>
                                 <div className={`flex items-center gap-1 text-[8px] font-black ${waitTime > 15 ? 'text-red-500' : 'text-primary'}`}><Clock size={10} /><span>{waitTime}M</span></div>
                              </div>
                           </div>
                           
                           <div className="space-y-2 mb-3 max-h-[220px] overflow-y-auto hide-scrollbar">
                              {(order.items || []).map((item, idx) => (
                                 <div key={idx} className={`flex items-start gap-2 p-1.5 rounded-lg border transition-all ${item.checked ? 'bg-emerald-500/5 border-emerald-500/20 opacity-50' : 'bg-white/[0.03] border-white/[0.05]'}`}>
                                    <div className="flex flex-col gap-1">
                                      <div className={`w-5 h-5 rounded-md text-white flex items-center justify-center font-black text-[9px] flex-shrink-0 ${item.checked ? 'bg-emerald-500' : 'bg-primary'}`}>{item.quantity}x</div>
                                      <button 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          const orderId = (item as any).orderId || order.id;
                                          const itemIdx = (item as any).originalItemIndex !== undefined ? (item as any).originalItemIndex : idx;
                                          handleToggleItemChecked(orderId, itemIdx); 
                                        }} 
                                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${item.checked ? 'bg-emerald-500 text-white' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                                      >
                                        <Check size={10} />
                                      </button>
                                    </div>
                                    <div className="flex-1 pt-0.5">
                                       <div className={`text-white text-[9px] font-bold uppercase tracking-tight leading-tight ${item.checked ? 'line-through text-gray-500' : ''}`}>
                                         {item.name}
                                         {item.isAdditional && <span className="ml-2 text-[7px] bg-blue-500 text-white px-1 rounded-sm">ADICIONAL</span>}
                                       </div>
                                       {item.doneness && (
                                         <div className="text-[8px] font-black text-white uppercase bg-white/10 px-1.5 py-0.5 rounded-sm w-fit mt-1">
                                           PONTO: {item.doneness}
                                         </div>
                                       )}
                                       {(item.selectedSides || []).length > 0 && (
                                          <div className="flex flex-wrap gap-1 mt-1">
                                             {(item.selectedSides || []).map((s, si) => (
                                                <span key={si} className="text-[7px] font-black uppercase text-primary/80 bg-primary/10 px-1 rounded-sm">+ {s.name}</span>
                                             ))}
                                          </div>
                                       )}
                                       {item.itemObservation && (
                                          <div className="mt-1 p-1 bg-yellow-400 text-black font-bold text-[8px] uppercase rounded-sm">
                                            {item.itemObservation}
                                          </div>
                                       )}
                                    </div>
                                 </div>
                              ))}
                           </div>
                           
                           <div className="pt-2 border-t border-white/5 space-y-2">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Total Comanda</span>
                                <span className="text-[11px] font-black text-primary">R$ {order.total.toFixed(2)}</span>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                 {col.id === 'pending' && (
                                   <button onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, 'preparing'); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95">Começar</button>
                                 )}
                                 {col.id === 'preparing' && (
                                   <button onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, 'ready_to_send'); }} className="w-full bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95">Pronto</button>
                                 )}
                                 {col.id === 'ready_to_send' && (
                                   <div className="flex gap-1.5">
                                      {order.type === 'delivery' ? (
                                        <button onClick={(e) => { e.stopPropagation(); handleOutForDelivery(order); }} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-[8px] font-black uppercase tracking-[0.15em] transition-all shadow-lg active:scale-95">Sair</button>
                                      ) : (
                                        <button onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, 'finished'); }} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95">Entregue</button>
                                      )}
                                   </div>
                                 )}
                                 {col.id === 'out_for_delivery' && (
                                   <button onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, 'finished'); }} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95">Concluído</button>
                                 )}
                              </div>
                           </div>
                        </div>
                      );
                   })}
                   </div>
                </div>
             </div>
           ))}
         </div>
       </div>

       {/* Modal de Detalhes do Pedido */}
       {selectedOrder && (
         <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="bg-[#161618] border border-white/10 rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              {/* Topo do Modal */}
              <div className="p-6 border-b border-white/5 bg-[#09090B]/50 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Pedido #{selectedOrder.orderNumber}</h2>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border ${selectedOrder.type === 'delivery' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-orange-500/10 border-orange-500/20 text-orange-400'}`}>
                      {selectedOrder.type === 'delivery' ? 'Delivery' : `Mesa ${selectedOrder.tableNumber || '-'}`}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <ShoppingBag size={14} className="text-primary" /> {selectedOrder.customerName}
                  </p>
                </div>
                <button onClick={() => { setSelectedOrder(null); setShowDeleteConfirm(false); }} className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>

              {/* Meio do Modal - Itens e Observações */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 hide-scrollbar">
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Itens do Pedido</h3>
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="bg-[#09090B] border border-white/5 rounded-2xl p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center font-black text-sm">{item.quantity}x</div>
                          <span className="text-white font-bold uppercase tracking-tight">{item.name}</span>
                        </div>
                        <span className="text-gray-500 font-mono text-xs">R$ {(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                      
                      {(item.selectedSides || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pl-11">
                          {(item.selectedSides || []).map((s, si) => (
                            <span key={si} className="text-[9px] font-black uppercase text-primary/80 bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">+ {s.name}</span>
                          ))}
                        </div>
                      )}

                      {item.doneness && (
                        <div className="ml-11 text-[9px] font-black text-white uppercase bg-white/10 px-2 py-0.5 rounded-md w-fit">
                          PONTO: {item.doneness}
                        </div>
                      )}

                      {item.itemObservation && (
                        <div className="mt-2 ml-11 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
                          <AlertTriangle size={12} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                          <p className="text-[10px] text-yellow-500 font-bold uppercase tracking-tight italic">"{item.itemObservation}"</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {selectedOrder.observation && (
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Observação Geral</h3>
                    <div className="p-4 bg-yellow-500/5 border-2 border-dashed border-yellow-500/30 rounded-2xl flex items-start gap-3">
                      <div className="p-2 bg-yellow-500/20 rounded-xl text-yellow-500">
                        <AlertTriangle size={18} />
                      </div>
                      <p className="text-sm text-yellow-500 font-bold italic leading-relaxed">
                        {selectedOrder.observation}
                      </p>
                    </div>
                  </div>
                )}

                {selectedOrder.address && selectedOrder.type === 'delivery' && (
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Endereço de Entrega</h3>
                    <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
                      <p className="text-xs text-blue-400 font-medium leading-relaxed">{selectedOrder.address}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Base do Modal - Total e Botões */}
              <div className="p-6 bg-[#09090B] border-t border-white/5 space-y-4">
                {showDeleteConfirm ? (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 space-y-4 animate-in zoom-in-95">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-1" />
                      <div>
                        <p className="text-xs font-black text-white uppercase tracking-widest mb-1">Confirmar Exclusão</p>
                        <p className="text-[10px] text-red-400 font-bold leading-relaxed">Esta ação é irreversível. O pedido será removido permanentemente do sistema.</p>
                      </div>
                    </div>
                    
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          checked={returnStockOnDelete} 
                          onChange={(e) => setReturnStockOnDelete(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-10 h-5 rounded-full transition-colors ${returnStockOnDelete ? 'bg-emerald-500' : 'bg-gray-700'}`} />
                        <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${returnStockOnDelete ? 'translate-x-5' : ''}`} />
                      </div>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest group-hover:text-white transition-colors">Devolver itens ao estoque?</span>
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setShowDeleteConfirm(false)}
                        className="bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                      >
                        Cancelar
                      </button>
                      <button 
                        disabled={isDeleting}
                        onClick={() => handleDeleteOrder(selectedOrder)}
                        className="bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
                      >
                        {isDeleting ? <Loader2 size={14} className="animate-spin" /> : 'Confirmar Exclusão'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-black uppercase tracking-[0.2em] text-[10px]">Valor Total</span>
                      <span className="text-3xl font-black text-white tracking-tighter">R$ {selectedOrder.total.toFixed(2)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {selectedOrder.type === 'local' && (
                        <button 
                          onClick={() => handleCloseAccount(selectedOrder as any)}
                          className="col-span-2 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-600/20 active:scale-95"
                        >
                          <CheckCircle2 size={20} /> FECHAR CONTA / PAGO
                        </button>
                      )}
                      <button 
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20 active:scale-95"
                      >
                        <Trash2 size={16} /> Excluir Pedido
                      </button>
                      <button 
                        onClick={() => handlePrintOrder(selectedOrder)}
                        className="flex items-center justify-center gap-2 bg-primary text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/20 active:scale-95"
                      >
                        <Printer size={16} /> Imprimir Comanda
                      </button>
                    </div>
                  </>
                )}
              </div>
           </div>
         </div>
       )}

       {/* Modal Lançar Venda (Balcão) */}
       {showCounterSaleModal && (
         <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="bg-[#161618] border border-white/10 rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] relative">
             <div className="p-6 border-b border-white/5 flex justify-between items-center">
               <h2 className="text-xl font-black text-white uppercase tracking-widest">Lançar Venda (Balcão)</h2>
               <button onClick={() => setShowCounterSaleModal(false)} className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-full"><X size={20} /></button>
             </div>

             <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8 hide-scrollbar">
               <div className="space-y-6">
                 <div className="space-y-4">
                   <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Dados do Cliente</h3>
                   <div className="grid grid-cols-2 gap-3">
                     <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Mesa</label>
                       <input type="text" value={csTableNumber} onChange={e => setCsTableNumber(e.target.value)} placeholder="Ex: 05" className="w-full bg-[#09090B] border border-white/5 rounded-xl px-4 py-3 text-white text-sm focus:border-primary/50 outline-none" />
                     </div>
                     <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome do Cliente</label>
                       <input type="text" value={csCustomerName} onChange={e => setCsCustomerName(e.target.value)} placeholder="Ex: João Silva" className="w-full bg-[#09090B] border border-white/5 rounded-xl px-4 py-3 text-white text-sm focus:border-primary/50 outline-none" />
                     </div>
                   </div>
                 </div>

                 <div className="space-y-4">
                   <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Itens Selecionados</h3>
                   <div className="space-y-2">
                     {csSelectedItems.length === 0 ? (
                       <div className="p-8 border-2 border-dashed border-white/5 rounded-2xl text-center">
                         <ShoppingBag size={24} className="text-gray-700 mx-auto mb-2" />
                         <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Nenhum item selecionado</p>
                       </div>
                     ) : (
                       csSelectedItems.map((item, idx) => (
                         <div key={idx} className="bg-[#09090B] border border-white/5 rounded-xl p-3 flex justify-between items-center">
                           <div className="flex items-center gap-3">
                             <div className="w-6 h-6 rounded-lg bg-primary text-white flex items-center justify-center font-black text-[10px]">{item.quantity}x</div>
                             <div className="flex flex-col">
                               <span className="text-white text-xs font-bold uppercase">{item.name}</span>
                               {item.doneness && <span className="text-[9px] font-black text-primary uppercase">Ponto: {item.doneness}</span>}
                             </div>
                           </div>
                           <button onClick={() => setCsSelectedItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-all"><Trash2 size={14} /></button>
                         </div>
                       ))
                     )}
                   </div>
                 </div>
               </div>

               <div className="space-y-4">
                 <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Cardápio</h3>
                 <div className="grid grid-cols-1 gap-2 max-h-[40vh] md:max-h-[400px] overflow-y-auto pr-2 hide-scrollbar">
                   {tenant.products.map(product => (
                     <button 
                       key={product.id}
                       onClick={() => {
                          const needsDoneness = product.category === 'tradicionais' || product.category === 'especiais';
                          
                          if (needsDoneness) {
                            setSelectingDonenessFor(product);
                          } else {
                            const existing = csSelectedItems.find(i => i.id === product.id && !i.doneness);
                            if (existing) {
                              setCsSelectedItems(prev => prev.map(i => i.id === product.id && !i.doneness ? { ...i, quantity: i.quantity + 1 } : i));
                            } else {
                              setCsSelectedItems(prev => [...prev, { ...product, quantity: 1, extras: [] } as CartItem]);
                            }
                          }
                       }}
                       className="bg-[#09090B] border border-white/5 hover:border-primary/30 rounded-xl p-3 flex items-center gap-3 transition-all group text-left"
                     >
                       <img src={product.image} className="w-10 h-10 rounded-lg object-cover grayscale group-hover:grayscale-0 transition-all" />
                       <div className="flex-1 min-w-0">
                         <p className="text-white text-[10px] font-black uppercase truncate">{product.name}</p>
                         <p className="text-primary text-[10px] font-bold">R$ {product.price.toFixed(2)}</p>
                       </div>
                       <Plus size={14} className="text-gray-600 group-hover:text-primary" />
                     </button>
                   ))}
                 </div>
               </div>
             </div>

             {/* Modal de Seleção de Ponto (Sobreposto) */}
             {selectingDonenessFor && (
                <div className="absolute inset-0 z-[210] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
                  <div className="bg-[#161618] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95">
                    <h3 className="text-lg font-black text-white uppercase tracking-widest mb-1 text-center">Ponto da Carne</h3>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest text-center mb-6">{selectingDonenessFor.name}</p>
                    
                    <div className="space-y-3">
                      {['Mal Passado', 'Ao Ponto', 'Bem Passado'].map((point) => (
                        <button
                          key={point}
                          onClick={() => {
                            setCsSelectedItems(prev => [...prev, { ...selectingDonenessFor, quantity: 1, extras: [], doneness: point } as CartItem]);
                            setSelectingDonenessFor(null);
                          }}
                          className="w-full py-4 rounded-xl bg-[#09090B] border border-white/10 hover:border-primary hover:bg-primary hover:text-white text-gray-300 font-black uppercase tracking-widest transition-all active:scale-95"
                        >
                          {point}
                        </button>
                      ))}
                    </div>
                    
                    <button 
                      onClick={() => setSelectingDonenessFor(null)}
                      className="w-full mt-6 py-3 text-xs font-bold text-gray-500 hover:text-white uppercase tracking-widest transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
             )}

             <div className="p-6 bg-[#09090B] border-t border-white/5 flex items-center justify-between">
               <div className="flex flex-col">
                 <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Total da Venda</span>
                 <span className="text-2xl font-black text-white">R$ {csSelectedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</span>
               </div>
               <div className="flex gap-3">
                 <button onClick={() => setShowCounterSaleModal(false)} className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-white/5">Cancelar</button>
                 <button 
                   disabled={isSavingCounterSale}
                   onClick={handleSaveCounterSale}
                   className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-2"
                 >
                   {isSavingCounterSale ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /> Finalizar Lançamento</>}
                 </button>
               </div>
             </div>
           </div>
         </div>
       )}

       {/* Modal de Impressão */}
       {printingOrder && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200 no-print">
              <h3 className="font-bold text-gray-800 text-lg">Visualizar Comanda</h3>
              <button onClick={() => setPrintingOrder(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Preview Area / Printable Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50 flex justify-center">
              <div 
                id="printable-receipt" 
                className="bg-white p-4 shadow-sm w-[80mm] text-black font-mono text-sm leading-tight"
                style={{ minHeight: '300px' }}
              >
                  <div className="text-center border-b-2 border-black pb-2 mb-2">
                      <div className="text-lg font-bold uppercase">{tenant.name}</div>
                      <div className="text-xl font-black my-1">PEDIDO #{printingOrder.orderNumber}</div>
                      <div className="text-[10px]">{new Date(printingOrder.createdAt).toLocaleString('pt-BR')}</div>
                  </div>
                  
                  <div className="mb-3">
                      <span className="block text-[10px] font-bold uppercase">Cliente:</span>
                      <span className="font-bold text-sm">{printingOrder.customerName}</span>
                  </div>
                  
                  <div className="mb-3">
                      <span className="block text-[10px] font-bold uppercase">Tipo:</span>
                      <span className="font-bold text-sm">{printingOrder.type === 'delivery' ? 'DELIVERY' : `MESA ${printingOrder.tableNumber || '-'}`}</span>
                  </div>

                  <div className="border-t border-black my-2"></div>

                  <div className="space-y-2">
                      {printingOrder.items.map((item, idx) => (
                          <div key={idx} className="border-b border-dashed border-gray-300 pb-1">
                              <div className="flex justify-between font-bold">
                                  <span>{item.quantity}x {item.name}</span>
                                  <span>R$ {((item.price + (item.selectedSides?.reduce((a,b) => a + b.price, 0) || 0)) * item.quantity).toFixed(2)}</span>
                              </div>
                              {item.selectedSides && item.selectedSides.length > 0 && (
                                  <div className="text-[11px] text-gray-600">
                                      + {item.selectedSides.map(s => s.name).join(', ')}
                                  </div>
                              )}
                              {item.doneness && (
                                  <div className="text-[10px] font-bold uppercase mt-0.5">
                                      PONTO: {item.doneness}
                                  </div>
                              )}
                              {item.itemObservation && (
                                  <div className="text-[11px] mt-0.5 text-gray-800">* Obs: {item.itemObservation}</div>
                              )}
                          </div>
                      ))}
                  </div>

                  <div className="border-t border-black my-2"></div>

                  <div className="text-right text-lg font-bold mt-2">
                      TOTAL: R$ {printingOrder.total.toFixed(2)}
                  </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 no-print">
              <button 
                  onClick={() => setPrintingOrder(null)}
                  className="px-4 py-2 text-gray-600 font-bold text-sm hover:bg-gray-200 rounded-lg transition-colors"
              >
                  Fechar
              </button>
              <button 
                  onClick={() => window.print()}
                  className="px-6 py-2 bg-blue-600 text-white font-bold text-sm rounded-lg shadow hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                  <Printer size={16} /> Imprimir
              </button>
            </div>
          </div>
          
          {/* Print Styles */}
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #printable-receipt, #printable-receipt * {
                visibility: visible;
              }
              #printable-receipt {
                position: fixed;
                left: 0;
                top: 0;
                width: 100%;
                margin: 0;
                padding: 10px;
                background: white;
                color: black;
                box-shadow: none;
                z-index: 9999;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default DashboardOrders;
