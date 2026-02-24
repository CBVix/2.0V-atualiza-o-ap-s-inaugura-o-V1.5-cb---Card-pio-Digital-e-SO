
import React, { useEffect, useState, useMemo } from 'react';
// Added Flame icon to imports
import { ChevronLeft, Tag, ShoppingBag, Clock, Info, Bell, Ticket, Copy, Bike, PackageCheck, Flame, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { AppNotification, OrderType, Order } from '../types';

interface AlertsProps {
  onBack: () => void;
  isDarkMode?: boolean;
  orderType?: OrderType;
}

const Alerts: React.FC<AlertsProps> = ({ onBack, isDarkMode, orderType }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    
    const channel = supabase.channel('realtime_alerts_client')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coupons' }, () => fetchData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderType]);

  const mapNotification = (data: any): AppNotification => ({
    id: data.id,
    title: data.title,
    message: data.message,
    type: data.type,
    isRead: data.is_read,
    createdAt: data.created_at
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. Buscar Pedidos Ativos para Acompanhamento
      if (user) {
        const { data: ordersData } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', user.id)
          .neq('status', 'finished')
          .neq('status', 'canceled')
          .order('created_at', { ascending: false });
        
        if (ordersData) {
          setActiveOrders(ordersData.map((o: any) => ({
            id: o.id,
            orderNumber: o.order_number,
            customerName: o.customer_name,
            customerWhatsapp: o.customer_whatsapp,
            items: o.items,
            total: Number(o.total),
            type: o.type,
            status: o.status,
            createdAt: new Date(o.created_at)
          })));
        }
      }

      // 2. Buscar Notificações
      let notifQuery = supabase
        .from('notifications')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (user) {
        notifQuery = notifQuery.or(`user_id.eq.${user.id},user_id.is.null`);
      } else {
        notifQuery = notifQuery.is('user_id', null);
      }

      const { data: notifData } = await notifQuery;
      const fetchedNotifications = (notifData || []).map(mapNotification);

      // 3. Lógica de Cupons
      let activeCouponsAsAlerts: any[] = [];
      const isActuallyLocal = orderType === OrderType.LOCAL;
      
      if (!isActuallyLocal) {
          const couponsQuery = supabase
            .from('coupons')
            .select('*')
            .eq('is_active', true)
            .is('user_id', null)
            .is('customer_email', null)
            .is('customer_phone', null);

          const { data: couponRes } = await couponsQuery;
          if (couponRes) {
              activeCouponsAsAlerts = couponRes
                .filter((c: any) => c.current_uses < c.max_uses)
                .map((c: any) => ({
                    id: `coupon-${c.id}`,
                    title: `🎟️ CUPOM: ${c.code}`,
                    message: `Ganhe R$ ${c.discount_value.toFixed(2)} de desconto!`,
                    type: 'promo' as const,
                    isRead: false,
                    createdAt: new Date().toISOString()
                }));
          }
      }

      setNotifications([...activeCouponsAsAlerts, ...fetchedNotifications]);

    } catch (error) {
      console.error('Erro crítico no fetchData dos Alertas:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'pending': return 'Pedido Recebido';
      case 'preparing': return 'Na Brasa';
      case 'ready_to_send': return 'Pronto para Sair';
      case 'out_for_delivery': return 'Pedido a Caminho';
      default: return 'Processando';
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'out_for_delivery': return <Bike className="text-primary animate-bounce" />;
      case 'preparing': return <Flame className="text-orange-500 animate-pulse" />;
      case 'ready_to_send': return <PackageCheck className="text-emerald-500" />;
      default: return <Clock className="text-blue-500" />;
    }
  };

  const getStatusProgress = (status: string) => {
    switch(status) {
      case 'pending': return 25;
      case 'preparing': return 50;
      case 'ready_to_send': return 75;
      case 'out_for_delivery': return 100;
      default: return 10;
    }
  };

  return (
    <div className={`min-h-screen pb-32 animate-in fade-in duration-500 transition-colors ${isDarkMode ? 'bg-[#1a1a1a] text-white' : 'bg-white text-gray-900'}`}>
      <header className="px-6 pt-12 pb-8 flex items-center gap-4">
        <button onClick={onBack} className={`w-10 h-10 rounded-full border flex items-center justify-center shadow-sm transition-all ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 text-white' : 'bg-white border-gray-100 text-gray-700'}`}>
          <ChevronLeft size={20} />
        </button>
        <h1 className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-[#0F172A]'}`}>Acompanhar Pedido</h1>
      </header>

      <section className="px-6 space-y-6">
        {/* Seção de Status de Pedido em Tempo Real */}
        {activeOrders.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Status do Pedido</h3>
            {activeOrders.map(order => (
              <div key={order.id} className={`p-6 rounded-[32px] border-2 border-primary shadow-xl shadow-primary/10 relative overflow-hidden ${isDarkMode ? 'bg-primary/5' : 'bg-orange-50'}`}>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                   {getStatusIcon(order.status)}
                </div>
                <div className="relative z-10">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-primary font-black text-xl">#{order.orderNumber}</span>
                    <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-white shadow-sm border border-primary/20 ${order.status === 'out_for_delivery' ? 'text-indigo-600 border-indigo-200' : 'text-primary'}`}>
                      {getStatusLabel(order.status)}
                    </div>
                  </div>
                  
                  {order.status === 'out_for_delivery' && (
                    <div className="mb-6 bg-white/50 backdrop-blur-md p-4 rounded-2xl border border-primary/20 flex items-center gap-4 animate-in zoom-in-95 duration-500">
                      <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30">
                        <Bike size={24} />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase text-gray-900 leading-tight">O entregador saiu!</p>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">Prepare a mesa, falta pouco 🔥</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden border border-gray-100 shadow-inner">
                      <div 
                        className="h-full bg-primary transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(249,115,22,0.5)]" 
                        style={{ width: `${getStatusProgress(order.status)}%` }} 
                      />
                    </div>
                    <div className="flex justify-between px-1">
                       <span className={`text-[7px] font-black uppercase ${getStatusProgress(order.status) >= 25 ? 'text-primary' : 'text-gray-400'}`}>Aceito</span>
                       <span className={`text-[7px] font-black uppercase ${getStatusProgress(order.status) >= 50 ? 'text-primary' : 'text-gray-400'}`}>Preparo</span>
                       <span className={`text-[7px] font-black uppercase ${getStatusProgress(order.status) >= 75 ? 'text-primary' : 'text-gray-400'}`}>Pronto</span>
                       <span className={`text-[7px] font-black uppercase ${getStatusProgress(order.status) >= 100 ? 'text-primary' : 'text-gray-400'}`}>Entrega</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Promoções e Avisos</h3>
          {loading ? (
             <div className="text-center py-10 opacity-50 text-xs uppercase font-bold tracking-widest text-gray-400">Carregando informações...</div>
          ) : notifications.length > 0 ? (
            notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={`p-4 rounded-xl border flex gap-4 transition-all ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 shadow-black/20' : 'bg-white border-gray-100 shadow-sm'}`}
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
                  {notif.type === 'promo' ? <Ticket className="text-primary" /> : <Bell className="text-gray-500" />}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-[11px] uppercase tracking-tight">{notif.title}</h4>
                  <p className="text-[11px] font-medium leading-relaxed opacity-60">{notif.message}</p>
                </div>
              </div>
            ))
          ) : !activeOrders.length && (
            <div className="text-center py-20 flex flex-col items-center opacity-40">
              <Bell size={40} className="mb-4 text-gray-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest">Nada por aqui hoje</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Alerts;
