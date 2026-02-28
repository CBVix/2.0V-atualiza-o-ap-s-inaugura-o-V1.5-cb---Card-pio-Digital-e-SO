import { useMemo } from 'react';
import { Order, InventoryItem, Tenant, CustomerMetrics, DREHistoryItem, PaymentMethod } from '../types';

interface EnhancedCustomerMetric extends CustomerMetrics {
  favoriteDish: string;
  abcClass: 'A' | 'B' | 'C';
  preferredTime: string;
  averageTicket: number;
  tenantSlug?: string;
}

export const useDashboardLogic = (
  orders: Order[] = [],
  inventory: InventoryItem[] = [],
  tenant: Tenant | null,
  financePeriod: 'today' | 'week' | 'month' | 'year' | 'custom',
  startDate: string,
  endDate: string,
  manualTransactions: any[] = [],
  fixedCostsDetails: any[] = [],
  financeGoal: any,
  dreHistory: DREHistoryItem[] = []
) => {

  // 0. Filtra pedidos pelo período selecionado
  const filteredOrders = useMemo(() => {
    if (!startDate || !endDate) return orders;
    
    const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
    const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
    
    const start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
    const end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);
    
    return (orders || []).filter(o => {
      const orderDate = new Date(o.createdAt);
      return orderDate >= start && orderDate <= end;
    });
  }, [orders, startDate, endDate]);

  // 1. CRM — métricas por cliente
  const customers = useMemo(() => {
    const custMap: Record<string, EnhancedCustomerMetric & { itemCounts: Record<string, number> }> = {};
    const nowTime = new Date().getTime();

    (filteredOrders || []).forEach(order => {
      if (!order) return;
      const rawPhone = order.customerWhatsapp ? order.customerWhatsapp.replace(/\D/g, '') : '';
      const customerKey = rawPhone || `NAME_${(order.customerName || 'SEM_NOME').trim().toUpperCase()}`;

      if (!custMap[customerKey]) {
        custMap[customerKey] = {
          whatsapp: rawPhone || '0000000000',
          name: order.customerName || 'Cliente',
          totalOrders: 0,
          totalSpent: 0,
          lastOrderDate: order.createdAt || new Date(),
          status: 'novo',
          daysSince: 0,
          favoriteDish: '',
          abcClass: 'C',
          preferredTime: 'Jantar',
          averageTicket: 0,
          itemCounts: {},
          tenantSlug: tenant?.slug || '',
          userId: order.userId
        };
      }
      
      const c = custMap[customerKey];
      c.totalOrders += 1;
      c.totalSpent += (order.total || 0);
      if (order.createdAt && new Date(order.createdAt) > new Date(c.lastOrderDate)) {
        c.lastOrderDate = order.createdAt;
      }

      (order.items || []).forEach(item => {
        if (item?.name) {
          c.itemCounts[item.name] = (c.itemCounts[item.name] || 0) + (item.quantity || 0);
        }
      });
    });

    const customerArray = Object.values(custMap).map(c => {
      const daysSince = Math.floor((nowTime - new Date(c.lastOrderDate).getTime()) / (1000 * 3600 * 24));
      let status: CustomerMetrics['status'] = 'regular';
      if (c.totalOrders === 1) status = 'novo';
      else if (c.totalOrders >= 5) status = 'vip';
      if (daysSince >= 15) status = 'sumido';

      let favDish = 'N/A';
      let maxCount = 0;
      Object.entries(c.itemCounts).forEach(([name, count]) => {
        if (count > maxCount) { maxCount = count; favDish = name; }
      });

      return { ...c, status, daysSince, favoriteDish: favDish, averageTicket: c.totalOrders > 0 ? c.totalSpent / c.totalOrders : 0 };
    });

    customerArray.sort((a, b) => b.totalSpent - a.totalSpent);
    return customerArray;
  }, [filteredOrders, tenant]);

  const customerKPIs = useMemo(() => {
    const totalCustomers = customers.length;
    const newThisMonth = customers.filter(c => c.status === 'novo').length;
    const retentionRate = totalCustomers > 0 ? ((customers.filter(c => c.totalOrders > 1).length / totalCustomers) * 100) : 0;
    const whales = customers.filter(c => c.totalSpent > 200).length;
    return { newThisMonth, retentionRate, whales };
  }, [customers]);

  // 2. Dados para gráficos
  const chartData = useMemo(() => {
    const finishedOrders = (filteredOrders || []).filter(o => o.status === 'finished');
    const salesByHour = new Array(24).fill(0);
    const categoryCounts: Record<string, number> = {};
    const salesByChannel = { delivery: 0, local: 0 };
    const topProducts: Record<string, number> = {};

    finishedOrders.forEach(order => {
      const hr = new Date(order.createdAt).getHours();
      salesByHour[hr] += (order.total || 0);
      if (order.type === 'delivery') salesByChannel.delivery += (order.total || 0);
      else salesByChannel.local += (order.total || 0);

      (order.items || []).forEach(item => {
        if (item.category) categoryCounts[item.category] = (categoryCounts[item.category] || 0) + (item.quantity || 0);
        if (item.name) topProducts[item.name] = (topProducts[item.name] || 0) + (item.quantity || 0);
      });
    });

    return {
      salesByHour,
      hours: Array.from({length: 24}, (_, i) => `${i}h`),
      salesByChannel,
      topProducts: Object.entries(topProducts).map(([name, qty]) => ({ name, qty })).sort((a,b) => b.qty - a.qty).slice(0, 5),
      categoryPercentages: Object.entries(categoryCounts).map(([label, count]) => ({ label, count }))
    };
  }, [filteredOrders]);

  // 3. Cálculos financeiros (DRE)
  const dreCalculations = useMemo(() => {
    const finishedOrders = (filteredOrders || []).filter(o => o.status === 'finished');
    const revenue = finishedOrders.reduce((acc, o) => acc + (o.total || 0), 0);
    
    let cmv = 0;
    finishedOrders.forEach(o => o.items.forEach(i => {
      const inv = (inventory || []).find(x => x.id === i.inventoryId);
      cmv += inv ? inv.costPrice * i.quantity : (i.price * 0.35 * i.quantity);
    }));

    const taxes = revenue * ((tenant?.cardMachineFee || 0) / 100);
    const fixedCosts = (fixedCostsDetails || []).reduce((acc, c) => acc + (c.value || 0), 0);
    const manualOut = (manualTransactions || []).reduce((acc, t) => acc + (t.value || 0), 0);
    
    const totalExpenses = cmv + taxes + fixedCosts + manualOut;
    const netProfit = revenue - totalExpenses;
    const breakEven = fixedCosts > 0 ? fixedCosts / 0.45 : 0;

    // ✅ CORREÇÃO: pagamentos calculados a partir dos dados reais dos pedidos
    // em vez de split hardcoded 50/40/10
    const paymentTotals = finishedOrders.reduce(
      (acc, o) => {
        const method = (o.paymentMethod as PaymentMethod) || 'other';
        // mapeia 'card' para o bucket card, resto para seu tipo
        if (method === 'pix') acc.pix += o.total;
        else if (method === 'card') acc.card += o.total;
        else if (method === 'cash') acc.cash += o.total;
        else acc.other += o.total;
        return acc;
      },
      { pix: 0, card: 0, cash: 0, other: 0 }
    );

    // Se nenhum pedido tem paymentMethod salvo ainda (dados antigos),
    // mostra zero em vez de inventar percentuais
    const hasPaymentData = finishedOrders.some(o => o.paymentMethod);
    const payments = hasPaymentData
      ? { pix: paymentTotals.pix, card: paymentTotals.card, cash: paymentTotals.cash }
      : { pix: 0, card: 0, cash: 0 }; // sem dados reais, não estima

    return {
      revenue,
      cmv,
      taxes,
      fixedCosts,
      manualOut,
      totalExpenses,
      netProfit,
      breakEven,
      payments,
      hasPaymentData, // ✅ flag para o componente exibir aviso se necessário
      deltas: { revenue: 0, expenses: 0, profit: 0 }
    };
  }, [filteredOrders, inventory, tenant, fixedCostsDetails, manualTransactions]);

  return { customers, customerKPIs, chartData, dreCalculations, filteredOrders };
};