
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Download, TrendingUp, TrendingDown, Star, Clock, Loader2, List, BarChart3, User, ShoppingBag, Calendar, FileText, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Order, Tenant } from '../../types';

interface DashboardOverviewProps {
  orders: Order[];
  financePeriod: string;
  setFinancePeriod: (period: any) => void;
  dreCalculations: any;
  chartData: any;
  tenant: Tenant;
  startDate?: string;
  setStartDate?: (date: string) => void;
  endDate?: string;
  setEndDate?: (date: string) => void;
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ 
  orders = [], financePeriod, setFinancePeriod, dreCalculations, chartData, tenant, startDate, setStartDate, endDate, setEndDate
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'detailed'>('overview');
  const salesHourChartRef = useRef<HTMLCanvasElement>(null);
  const channelChartRef = useRef<HTMLCanvasElement>(null);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [exportPeriod, setExportPeriod] = useState<'today' | 'last7days' | 'thismonth' | 'custom'>('thismonth');
  const [customExportStartDate, setCustomExportStartDate] = useState<string>('');
  const [customExportEndDate, setCustomExportEndDate] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  const productSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        summary[item.name] = (summary[item.name] || 0) + item.quantity;
      });
    });
    return Object.entries(summary).sort((a, b) => b[1] - a[1]);
  }, [orders]);

  useEffect(() => {
    // @ts-ignore
    const Chart = window.Chart;
    if (!Chart || !chartData || !chartData.salesByHour || activeTab !== 'overview') return;
    let charts: any[] = [];

    if (salesHourChartRef.current) {
      const ctx = salesHourChartRef.current.getContext('2d');
      if (ctx) {
        charts.push(new Chart(ctx, {
          type: 'line',
          data: {
            labels: chartData.hours || [],
            datasets: [{
              label: 'Vendas (R$)',
              data: chartData.salesByHour || [],
              borderColor: '#f97316',
              backgroundColor: 'rgba(249, 115, 22, 0.1)',
              fill: true,
              tension: 0.4
            }]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: '#1F1F23' } } } }
        }));
      }
    }

    if (channelChartRef.current) {
        const ctx = channelChartRef.current.getContext('2d');
        if (ctx) {
            charts.push(new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Delivery', 'Mesa'],
                    datasets: [{
                        data: [chartData.salesByChannel?.delivery || 0, chartData.salesByChannel?.local || 0],
                        backgroundColor: ['#f97316', '#3b82f6'],
                        borderRadius: 6
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            }));
        }
    }

    return () => charts.forEach(c => c.destroy());
  }, [chartData]);

  if (!dreCalculations || !chartData) {
      return (
          <div className="h-full w-full flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-primary" size={32} />
          </div>
      );
  }

  const handleConfirmExport = async () => {
    setIsExporting(true);
    let exportStartDate: string | undefined;
    let exportEndDate: string | undefined;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (exportPeriod) {
      case 'today':
        exportStartDate = today.toISOString();
        exportEndDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();
        break;
      case 'last7days':
        const last7Days = new Date(today);
        last7Days.setDate(today.getDate() - 6);
        exportStartDate = last7Days.toISOString();
        exportEndDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();
        break;
      case 'thismonth':
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
        exportStartDate = firstDayOfMonth.toISOString();
        exportEndDate = lastDayOfMonth.toISOString();
        break;
      case 'custom':
        exportStartDate = customExportStartDate ? new Date(customExportStartDate).toISOString() : undefined;
        exportEndDate = customExportEndDate ? new Date(new Date(customExportEndDate).getFullYear(), new Date(customExportEndDate).getMonth(), new Date(customExportEndDate).getDate(), 23, 59, 59, 999).toISOString() : undefined;
        break;
    }

    try {
      const ordersToExport = await fetchOrdersByDateRange(exportStartDate, exportEndDate);
      if (exportFormat === 'pdf') {
        await generatePdfReport(ordersToExport, exportStartDate, exportEndDate);
      } else {
        await generateCsvReport(ordersToExport, exportStartDate, exportEndDate);
      }
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert('Erro ao gerar o relatório. Tente novamente.');
    } finally {
      setIsExporting(false);
      setIsExportModalOpen(false);
    }
  };

  const fetchOrdersByDateRange = async (startDate?: string, endDate?: string) => {
    if (!tenant.slug) return [];
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('tenant_slug', tenant.slug)
      .gte('createdAt', startDate || '1970-01-01T00:00:00Z') // Default to a very old date if no start date
      .lte('createdAt', endDate || new Date().toISOString()) // Default to now if no end date
      .order('createdAt', { ascending: false });
    if (error) {
      console.error('Erro ao buscar todos os pedidos:', error);
      return [];
    }
    return data;
  };

  const generatePdfReport = async (ordersToExport: Order[], exportStartDate?: string, exportEndDate?: string) => {
    // @ts-ignore
    const { jsPDF } = window.jspdf;

    const doc = new jsPDF('p', 'mm', 'a4');
    const autoTable = (doc as any).autoTable; // Explicitly reference autoTable on the doc instance
    const pageHeight = doc.internal.pageSize.height;

    // Debug log
    console.log('Dados para exportar (Pedidos):', ordersToExport);

    doc.setFontSize(18);
    doc.text(`${String(tenant.name || 'Restaurante')} - Relatório de Vendas`, 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${String(new Date().toLocaleString('pt-BR'))}`, 14, 28);
    const periodText = exportStartDate && exportEndDate
      ? `Período: ${new Date(exportStartDate).toLocaleDateString('pt-BR')} até ${new Date(exportEndDate).toLocaleDateString('pt-BR')}`
      : 'Todos os Dados';
    doc.text(periodText, 14, 34);

    // Summary
    const totalRevenue = ordersToExport.reduce((acc, order) => acc + order.total, 0);
    const totalOrders = ordersToExport.length;

    const summaryData = [
      ['Total de Vendas', String(totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))],
      ['Total de Pedidos', String(totalOrders)],
    ];

    doc.autoTable({ 
      startY: 45,
      head: [['Métrica', 'Valor']],
      body: summaryData,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 2, fillColor: [240, 240, 240] },
      headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' } }
    });

    // Detailed Orders Table
    // @ts-ignore
    const ordersStartY = doc.autoTable.previous.finalY + 10;
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Pedidos Detalhados', 14, ordersStartY);

    const ordersData = ordersToExport.map(o => [
      String(o.createdAt ? new Date(o.createdAt).toLocaleDateString('pt-BR') : 'Data N/I'),
      String(o.customerName || 'Consumidor'),
      String(o.tableNumber || 'N/A'),
      String(o.items.map(item => `${item.quantity}x ${item.name}`).join(', ') || 'N/A'),
      String(o.type === 'delivery' ? 'Delivery' : 'Mesa'),
      String(o.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })),
      String(o.status || 'N/I')
    ]);

    doc.autoTable({
      startY: ordersStartY + 7,
      head: [['Data', 'Cliente', 'Mesa', 'Itens', 'Tipo', 'Total', 'Status']],
      body: ordersData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: { 5: { halign: 'right' } },
      didDrawPage: (data: any) => {
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${data.pageNumber} de ${doc.internal.getNumberOfPages()}`, data.settings.margin.left, pageHeight - 10);
      }
    });

    doc.save(`relatorio_vendas_${tenant.slug}.pdf`);
  };

  const generateCsvReport = async (ordersToExport: Order[], exportStartDate?: string, exportEndDate?: string) => {
    const headers = ['Data', 'Cliente', 'Mesa', 'Itens Vendidos', 'Metodo de Pagamento', 'Valor Total', 'Status'];
    const data = ordersToExport.map(o => ({
      Data: new Date(o.createdAt).toLocaleDateString('pt-BR'),
      Cliente: o.customerName,
      Mesa: o.tableNumber || 'N/A',
      'Itens Vendidos': o.items.map(item => `${item.quantity}x ${item.name}`).join(', '),
      'Metodo de Pagamento': o.type === 'delivery' ? 'Online/Entrega' : 'Local',
      'Valor Total': o.total.toFixed(2),
      Status: o.status
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatorio de Vendas");
    XLSX.writeFile(wb, `relatorio_vendas_${tenant.slug}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
         <div className="flex bg-[#161618] p-1 rounded-xl border border-white/5">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'overview' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-white'}`}
            >
              <BarChart3 size={14} /> Visão Geral
            </button>
            <button 
              onClick={() => setActiveTab('detailed')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'detailed' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-white'}`}
            >
              <List size={14} /> Lista de Vendas Detalhada
            </button>
         </div>

         <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <select value={financePeriod} onChange={(e: any) => setFinancePeriod(e.target.value)} className="w-full md:w-40 bg-[#161618] border border-white/5 text-white text-[10px] font-black uppercase tracking-widest rounded-lg pl-9 pr-3 py-2.5 outline-none appearance-none cursor-pointer hover:border-primary/50 transition-colors">
                  <option value="today">Hoje</option>
                  <option value="week">Últimos 7 dias</option>
                  <option value="month">Mês Atual</option>
              </select>
            </div>

         </div>
      </div>

      {activeTab === 'overview' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-6 bg-[#161618] border border-white/5 rounded-2xl">
              <p className="text-gray-400 text-xs font-bold uppercase">Faturamento</p>
              <p className="text-2xl font-bold text-white mt-1">R$ {(dreCalculations.revenue || 0).toFixed(2)}</p>
            </div>
            <div className="p-6 bg-[#161618] border border-white/5 rounded-2xl">
              <p className="text-gray-400 text-xs font-bold uppercase">Pedidos</p>
              <p className="text-2xl font-bold text-white mt-1">{(orders || []).length}</p>
            </div>
            <div className="p-6 bg-[#161618] border border-white/5 rounded-2xl">
               <p className="text-gray-400 text-xs font-bold uppercase">Lucro Líquido</p>
               <p className={`text-2xl font-bold mt-1 ${(dreCalculations.netProfit || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>R$ {(dreCalculations.netProfit || 0).toFixed(2)}</p>
            </div>
            <div className="p-6 bg-[#161618] border border-white/5 rounded-2xl">
              <p className="text-gray-400 text-xs font-bold uppercase">Ticket Médio</p>
              <p className="text-2xl font-bold text-white mt-1">R$ {((dreCalculations.revenue || 0) / ((orders || []).length || 1)).toFixed(2)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 bg-[#161618] border border-white/5 rounded-2xl h-80">
                <h3 className="text-gray-400 text-xs font-bold uppercase mb-4">Vendas por Horário</h3>
                <div className="h-64">
                    <canvas ref={salesHourChartRef} />
                </div>
            </div>
            <div className="p-6 bg-[#161618] border border-white/5 rounded-2xl h-80">
                <h3 className="text-gray-400 text-xs font-bold uppercase mb-4">Canais de Venda</h3>
                <div className="h-64">
                    <canvas ref={channelChartRef} />
                </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="bg-[#161618] border border-white/5 rounded-2xl p-6">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Star size={16} className="text-yellow-500" /> Top Produtos</h3>
                <div className="space-y-4">
                    {(chartData.topProducts || []).map((p: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-xs text-gray-300 p-2 bg-white/5 rounded-lg">
                            <span className="font-bold">{p.name}</span>
                            <span className="text-primary font-black">{p.qty} un</span>
                        </div>
                    ))}
                </div>
             </div>
             <div className="bg-[#161618] border border-white/5 rounded-2xl p-6">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Clock size={16} className="text-primary" /> Info do Período</h3>
                <p className="text-xs text-gray-400 leading-relaxed">Os dados apresentados referem-se aos pedidos finalizados dentro do período selecionado. Custos e taxas são calculados com base nas configurações da loja.</p>
             </div>
          </div>
        </>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          {/* Resumo de Unidades Vendidas */}
          <div className="bg-[#161618] border border-white/5 rounded-2xl p-6">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2 uppercase text-xs tracking-widest"><ShoppingBag size={16} className="text-primary" /> Saída da Churrasqueira (Total de Unidades)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {productSummary.map(([name, qty], i) => (
                <div key={i} className="bg-[#09090B] border border-white/5 p-3 rounded-xl flex flex-col items-center justify-center text-center">
                  <span className="text-primary text-xl font-black">{qty}</span>
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter mt-1 line-clamp-1">{name}</span>
                </div>
              ))}
              {productSummary.length === 0 && <p className="col-span-full text-center text-gray-600 py-4 text-xs italic">Nenhuma venda registrada no período.</p>}
            </div>
          </div>

          {/* Tabela Detalhada */}
          <div className="bg-[#161618] border border-white/5 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-[#09090B]/30 flex items-center gap-2">
              <List size={14} className="text-primary" />
              <h3 className="text-white font-bold uppercase text-[10px] tracking-widest">Detalhamento de Pedidos</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-gray-500 font-bold uppercase border-b border-white/5 bg-[#09090B]/20">
                  <tr>
                    <th className="p-4">Cliente</th>
                    <th className="p-4">Itens</th>
                    <th className="p-4 text-center">Total</th>
                    <th className="p-4 text-center">Data/Hora</th>
                    <th className="p-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {orders.length > 0 ? orders.map((order) => (
                    <tr key={order.id} className="text-white hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary uppercase">
                            {order.customerName.charAt(0)}
                          </div>
                          <span className="font-bold">{order.customerName}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          {order.items.map((item, idx) => (
                            <span key={idx} className="text-[10px] text-gray-400">
                              <span className="text-primary font-bold">{item.quantity}x</span> {item.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-center font-bold text-emerald-500">R$ {order.total.toFixed(2)}</td>
                      <td className="p-4 text-center text-gray-500 font-mono text-[10px]">
                        {new Date(order.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-4 text-right">
                        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${
                          order.status === 'finished' ? 'bg-emerald-500/10 text-emerald-500' :
                          order.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                          order.status === 'preparing' ? 'bg-blue-500/10 text-blue-500' :
                          'bg-gray-500/10 text-gray-500'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-gray-600 italic">Nenhum pedido encontrado para este período.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isExportModalOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] backdrop-blur-sm">
            <div className="bg-[#161618] rounded-2xl w-full max-w-md border border-white/10 p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-white font-bold">Exportar Relatório</h3>
                <button onClick={() => setIsExportModalOpen(false)} className="text-gray-500 hover:text-white"><X size={20}/></button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-400 mb-2">Formato:</p>
                  <div className="flex gap-3">
                    <button onClick={() => setExportFormat('pdf')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${exportFormat === 'pdf' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-gray-400 border border-white/10'}`}>
                      <FileText size={14} /> PDF
                    </button>
                    <button onClick={() => setExportFormat('csv')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${exportFormat === 'csv' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-gray-400 border border-white/10'}`}>
                      <FileSpreadsheet size={14} /> CSV (Excel)
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-2">Período:</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <button onClick={() => setExportPeriod('today')} className={`py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${exportPeriod === 'today' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-gray-400 border border-white/10'}`}>
                      Hoje
                    </button>
                    <button onClick={() => setExportPeriod('last7days')} className={`py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${exportPeriod === 'last7days' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-gray-400 border border-white/10'}`}>
                      Últimos 7 Dias
                    </button>
                    <button onClick={() => setExportPeriod('thismonth')} className={`py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${exportPeriod === 'thismonth' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-gray-400 border border-white/10'}`}>
                      Este Mês
                    </button>
                    <button onClick={() => setExportPeriod('custom')} className={`py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${exportPeriod === 'custom' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-gray-400 border border-white/10'}`}>
                      Personalizado
                    </button>
                  </div>
                  {exportPeriod === 'custom' && (
                    <div className="flex items-center gap-2 bg-[#09090B] px-3 py-2 rounded-lg border border-white/5">
                      <Calendar size={14} className="text-gray-500" />
                      <input type="date" value={customExportStartDate} onChange={(e) => setCustomExportStartDate(e.target.value)} className="bg-transparent text-xs text-white font-bold outline-none border-b border-white/10 w-full" />
                      <span className="text-gray-500">-</span>
                      <input type="date" value={customExportEndDate} onChange={(e) => setCustomExportEndDate(e.target.value)} className="bg-transparent text-xs text-white font-bold outline-none border-b border-white/10 w-full" />
                    </div>
                  )}
                </div>
                <button onClick={handleConfirmExport} disabled={isExporting} className="w-full bg-primary text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18}/>} 
                  {isExporting ? 'Gerando...' : 'Gerar Relatório'}
                </button>
              </div>
            </div>
          </div>
       )}
    </div>
  );
};

export default DashboardOverview;
