
import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, Boxes, Settings, ShoppingBag, Package, Wallet, Users, Ticket, LogOut } from 'lucide-react';
import { Tenant, Order, OrderStatus, InventoryItem, DREHistoryItem, Coupon, WasteRecord } from '../types';
import { supabase } from '../supabaseClient';
import { useDashboardLogic } from '../hooks/useDashboardLogic';

// Subcomponents
import DashboardOverview from '../components/dashboard/DashboardOverview';
import DashboardOrders from '../components/dashboard/DashboardOrders';
import DashboardMenu from '../components/dashboard/DashboardMenu';
import DashboardInventory from '../components/dashboard/DashboardInventory';
import DashboardCustomers from '../components/dashboard/DashboardCustomers';
import DashboardPromos from '../components/dashboard/DashboardPromos';
import DashboardFinance from '../components/dashboard/DashboardFinance';
import DashboardSettings from '../components/dashboard/DashboardSettings';

interface DashboardProps {
  tenant: Tenant;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  inventory: InventoryItem[];
  coupons: Coupon[];
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  onUpdateInventory: (inventory: InventoryItem[]) => void;
  onSaveInventoryItem: (item: InventoryItem) => Promise<void>;
  onDeleteInventoryItem: (id: string) => Promise<void>;
  onSaveCoupon: (coupon: Coupon) => void;
  onDeleteCoupon: (id: string) => void;
  onBack: () => void;
  onUpdateTenant: (tenant: Tenant) => void;
  startDate?: string;
  setStartDate?: (date: string) => void;
  endDate?: string;
  setEndDate?: (date: string) => void;
}

const navItems = [
  { id: 'relatorios', label: 'Relatórios', icon: <BarChart3 size={16} /> },
  { id: 'pedidos', label: 'Pedidos (KDS)', icon: <ShoppingBag size={16} /> },
  { id: 'cardapio', label: 'Cardápio', icon: <Boxes size={16} /> },
  { id: 'estoque', label: 'Estoque', icon: <Package size={16} /> },
  { id: 'clientes', label: 'Clientes', icon: <Users size={16} /> },
  { id: 'promocoes', label: 'Promoções', icon: <Ticket size={16} /> },
  { id: 'dre', label: 'Financeiro', icon: <Wallet size={16} /> },
  { id: 'ajustes', label: 'Ajustes', icon: <Settings size={16} /> },
];

type Section = 'relatorios' | 'cardapio' | 'pedidos' | 'estoque' | 'dre' | 'ajustes' | 'clientes' | 'promocoes';

const Dashboard: React.FC<DashboardProps> = ({
  tenant, orders, setOrders, inventory, coupons, updateOrderStatus, onUpdateInventory, onSaveInventoryItem, onDeleteInventoryItem, onSaveCoupon, onDeleteCoupon, onBack, onUpdateTenant, startDate: propStartDate, setStartDate: setPropStartDate, endDate: propEndDate, setEndDate: setPropEndDate
}) => {
  const [activeSection, setActiveSection] = useState<Section>('relatorios');
  const [financePeriod, setFinancePeriod] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('today');
  const [startDate, setStartDate] = useState<string>(propStartDate || '');
  const [endDate, setEndDate] = useState<string>(propEndDate || '');
  const [now, setNow] = useState(new Date());
  const [manualTransactions, setManualTransactions] = useState<any[]>([]);
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [dreHistory, setDreHistory] = useState<DREHistoryItem[]>([]);
  const [fixedCostsDetails, setFixedCostsDetails] = useState<any[]>([]);
  const [financeGoal, setFinanceGoal] = useState({ type: 'breakeven', targetValue: 0 });

  useEffect(() => {
    const savedWaste = localStorage.getItem('churrasco_waste');
    const savedGoal = localStorage.getItem('churrasco_finance_goal');
    if (savedWaste) setWasteRecords(JSON.parse(savedWaste));
    if (savedGoal) setFinanceGoal(JSON.parse(savedGoal));
    updateDatesFromPeriod('today');
  }, []);

  useEffect(() => {
    localStorage.setItem('churrasco_waste', JSON.stringify(wasteRecords));
    localStorage.setItem('churrasco_finance_goal', JSON.stringify(financeGoal));
  }, [wasteRecords, financeGoal]);

  useEffect(() => {
    const timer = setInterval(() => {
      const currentNow = new Date();
      setNow(currentNow);
      // Reset automático na virada do dia se o período for 'today'
      if (financePeriod === 'today') {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const todayStr = `${currentNow.getFullYear()}-${pad(currentNow.getMonth() + 1)}-${pad(currentNow.getDate())}`;
        if (todayStr !== startDate) {
          updateDatesFromPeriod('today');
        }
      }
    }, 60000); // Check every minute
    return () => clearInterval(timer);
  }, [financePeriod, startDate]);

  const updateDatesFromPeriod = (period: 'today' | 'week' | 'month' | 'year' | 'custom') => {
    const today = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    
    const newEndDate = formatDate(today);
    setEndDate(newEndDate);
    if (setPropEndDate) setPropEndDate(newEndDate);

    let start = new Date();
    
    if (period === 'today') {
      // start is already today
    } else if (period === 'week') {
      start.setDate(today.getDate() - 7);
    } else if (period === 'month') {
      start.setDate(today.getDate() - 30);
    } else if (period === 'year') {
      start = new Date(today.getFullYear(), 0, 1);
    } else {
      return; 
    }
    setStartDate(formatDate(start));
  };

  const handlePeriodChange = (period: 'today' | 'week' | 'month' | 'year' | 'custom') => {
      setFinancePeriod(period);
      updateDatesFromPeriod(period);
  };

  const handleSetStartDate = (date: string) => {
    setStartDate(date);
    if (setPropStartDate) setPropStartDate(date);
  };

  const handleSetEndDate = (date: string) => {
    setEndDate(date);
    if (setPropEndDate) setPropEndDate(date);
  };

  const fetchFinancialHistory = async () => {
    try {
       const { data } = await supabase.from('financial_snapshots').select('*').eq('tenant_slug', tenant.slug).order('year', { ascending: false }).order('month', { ascending: false }).limit(12);
       if (data && data.length > 0) {
         setDreHistory(data.map((item: any) => {
           const date = new Date(item.year, item.month - 1);
           const periodName = date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
           return {
             period: periodName.charAt(0).toUpperCase() + periodName.slice(1),
             revenue: item.revenue, cmv: item.cmv, fixedCosts: item.fixed_costs, netProfit: item.net_profit, margin: item.margin
           };
         }));
       }
    } catch (err) { console.error(err); }
  };

  const fetchOrdersForRange = async (start: string, end: string) => {
    if (!tenant.slug) return;
    try {
      const [sYear, sMonth, sDay] = start.split('-').map(Number);
      const [eYear, eMonth, eDay] = end.split('-').map(Number);
      
      const startDateISO = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0).toISOString();
      const endDateISO = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999).toISOString();

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('tenant_slug', tenant.slug)
        .gte('created_at', startDateISO)
        .lte('created_at', endDateISO)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const mappedOrders: Order[] = data.map((o: any) => ({
          id: o.id,
          orderNumber: o.order_number,
          customerName: o.customer_name,
          customerWhatsapp: o.customer_whatsapp,
          items: o.items,
          total: Number(o.total),
          type: o.type as OrderType,
          status: o.status as OrderStatus,
          createdAt: new Date(o.created_at),
          tableNumber: o.table_number,
          address: o.address,
          userId: o.user_id
        }));
        
        setOrders(prev => {
          const combined = [...mappedOrders, ...prev];
          const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
          return unique.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        });
      }
    } catch (err) {
      console.error("Erro ao buscar pedidos do período:", err);
    }
  };

  useEffect(() => {
    if (startDate && endDate && activeSection === 'relatorios') {
      fetchOrdersForRange(startDate, endDate);
    }
  }, [startDate, endDate, tenant.slug, activeSection]);

  useEffect(() => {
    if (activeSection === 'dre') fetchFinancialHistory();
  }, [activeSection, tenant.slug]);

  const { customers, customerKPIs, chartData, dreCalculations, filteredOrders } = useDashboardLogic(
    orders, inventory, tenant, financePeriod, startDate, endDate, manualTransactions, fixedCostsDetails, financeGoal, dreHistory
  );

  const pendingOrdersCount = useMemo(() => orders.filter(o => o.status === 'pending').length, [orders]);

  const handleExportCSV = () => {
    const headers = ['ID', 'Cliente', 'Tipo', 'Total', 'Data', 'Status'];
    const rows = filteredOrders.map(o => [o.id, o.customerName, o.type === 'delivery' ? 'Delivery' : 'Mesa', o.total.toFixed(2), new Date(o.createdAt).toLocaleDateString(), o.status].join(','));
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\n" + rows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_vendas_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const couponStats = useMemo(() => {
      const stats: Record<string, { revenue: number, count: number }> = {};
      filteredOrders.forEach(order => {
          if (order.couponCode) {
              if (!stats[order.couponCode]) stats[order.couponCode] = { revenue: 0, count: 0 };
              stats[order.couponCode].revenue += order.total;
              stats[order.couponCode].count += 1;
          }
      });
      return stats;
  }, [filteredOrders]);

  return (
    <div className="flex h-screen w-screen bg-[#09090B] overflow-hidden font-sans text-gray-400 selection:bg-primary/30">
      {/* Sidebar - Visual reduzido (80%) */}
      <aside className="w-52 bg-[#09090B] border-r border-[#1F1F23] flex flex-col flex-shrink-0 z-[50] transition-all">
        <div className="flex items-center justify-center bg-[#09090B] px-3 py-6">
          <img src="https://i.postimg.cc/Wbfzdjgy/LOGO-CHURRAS-BRUTUS.png" alt="Brutus Admin" className="h-20 w-auto object-contain transition-transform hover:scale-105" />
        </div>
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto hide-scrollbar">
          {navItems.map(item => (
            <button 
              key={item.id} 
              onClick={() => setActiveSection(item.id as Section)} 
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[10px] font-bold transition-all duration-200 group ${activeSection === item.id ? 'bg-primary text-white shadow-lg shadow-primary/10 translate-x-1' : 'text-gray-400 hover:bg-[#1F1F23] hover:text-white'}`}
            >
              <div className={`transition-colors ${activeSection === item.id ? 'text-white' : 'text-gray-500 group-hover:text-white'}`}>{item.icon}</div>
              <span className="uppercase tracking-widest">{item.label}</span>
              {item.id === 'pedidos' && pendingOrdersCount > 0 && (<span className="ml-auto bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-md animate-pulse font-black">{pendingOrdersCount}</span>)}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-[#1F1F23]">
          <button onClick={onBack} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[#1F1F23] text-[9px] font-black text-gray-500 hover:text-white hover:bg-[#1F1F23] transition-colors uppercase tracking-[0.2em]"><LogOut size={14} /> Sair</button>
        </div>
      </aside>

      {/* Main Content area - Compacto */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-[60px] border-b border-[#1F1F23] flex items-center justify-between px-6 flex-shrink-0 bg-[#09090B]/90 backdrop-blur-xl sticky top-0 z-[45]">
           <h1 className="text-base font-black tracking-tight text-white uppercase">{activeSection === 'relatorios' ? 'Visão Geral' : activeSection === 'pedidos' ? 'Gestão de Cozinha (KDS)' : activeSection === 'dre' ? 'Gestão Financeira' : activeSection}</h1>
           <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#161618] border border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Sistema Online</span>
              </div>
           </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-5 scroll-smooth hide-scrollbar">
            {activeSection === 'relatorios' && (<DashboardOverview orders={filteredOrders} financePeriod={financePeriod} setFinancePeriod={handlePeriodChange} dreCalculations={dreCalculations} chartData={chartData} tenant={tenant} startDate={startDate} setStartDate={handleSetStartDate} endDate={endDate} setEndDate={handleSetEndDate} />)}
            {activeSection === 'pedidos' && <DashboardOrders orders={orders} setOrders={setOrders} updateOrderStatus={updateOrderStatus} now={now} tenant={tenant} />}
            {activeSection === 'cardapio' && <DashboardMenu tenant={tenant} inventory={inventory} onUpdateTenant={onUpdateTenant} />}
            {activeSection === 'estoque' && <DashboardInventory inventory={inventory} onUpdateInventory={onUpdateInventory} onSaveInventoryItem={onSaveInventoryItem} onDeleteInventoryItem={onDeleteInventoryItem} />}
            {activeSection === 'clientes' && <DashboardCustomers customers={customers} customerKPIs={customerKPIs} tenant={tenant} coupons={coupons} onSaveCoupon={onSaveCoupon} orders={orders} financePeriod={financePeriod} setFinancePeriod={handlePeriodChange} startDate={startDate} endDate={endDate} />}
            {activeSection === 'promocoes' && <DashboardPromos coupons={coupons} onSaveCoupon={onSaveCoupon} onDeleteCoupon={onDeleteCoupon} tenant={tenant} couponStats={couponStats} />}
            {activeSection === 'dre' && (<DashboardFinance dreCalculations={dreCalculations} manualTransactions={manualTransactions} setManualTransactions={setManualTransactions} onCloseMonth={() => fetchFinancialHistory()} tenant={tenant} fixedCostsDetails={fixedCostsDetails} setFixedCostsDetails={setFixedCostsDetails} orders={orders} inventory={inventory} financePeriod={financePeriod} setFinancePeriod={handlePeriodChange} startDate={startDate} setStartDate={handleSetStartDate} endDate={endDate} setEndDate={handleSetEndDate} />)}
            {activeSection === 'ajustes' && <DashboardSettings tenant={tenant} onUpdateTenant={onUpdateTenant} />}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
