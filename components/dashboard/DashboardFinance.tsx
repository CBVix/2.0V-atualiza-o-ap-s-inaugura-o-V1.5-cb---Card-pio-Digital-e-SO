import React, { useRef, useEffect, useState, useMemo } from 'react';
import { ArrowRightLeft, Save, X, Trash2, Edit2, TrendingUp, ChevronDown, Download, Calendar, FileText, FileSpreadsheet, CheckCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../supabaseClient';
import { Tenant, Order, InventoryItem } from '../../types';

interface DashboardFinanceProps {
  dreCalculations: any;
  manualTransactions: any[];
  setManualTransactions: (transactions: any) => void;
  onCloseMonth: () => void;
  tenant: Tenant;
  fixedCostsDetails: any[];
  setFixedCostsDetails: (costs: any[]) => void;
  orders: Order[];
  inventory: InventoryItem[];
  financePeriod?: 'today' | 'week' | 'month' | 'year' | 'custom';
  setFinancePeriod?: (period: any) => void;
  startDate?: string;
  setStartDate?: (date: string) => void;
  endDate?: string;
  setEndDate?: (date: string) => void;
}

const DashboardFinance: React.FC<DashboardFinanceProps> = ({
    dreCalculations,
    manualTransactions,
    setManualTransactions,
    onCloseMonth,
    tenant,
    fixedCostsDetails,
    setFixedCostsDetails,
    orders,
    inventory,
    financePeriod = 'month',
    setFinancePeriod,
    startDate,
    setStartDate,
    endDate,
    setEndDate
}) => {
  const costDistributionChartRef = useRef<HTMLCanvasElement>(null);
  const trendChartRef = useRef<HTMLCanvasElement>(null);

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);
  const [isCMVModalOpen, setIsCMVModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const [transactionForm, setTransactionForm] = useState({ type: 'out' as 'in' | 'out', value: 0, description: '', category: 'Outros' });
  const [fixedCostForm, setFixedCostForm] = useState({ label: '', value: 0 });
  const [editingCostId, setEditingCostId] = useState<string | null>(null);

  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [exportPeriod, setExportPeriod] = useState<'today' | 'last7days' | 'thismonth' | 'custom'>('thismonth');
  const [customExportStartDate, setCustomExportStartDate] = useState<string>('');
  const [customExportEndDate, setCustomExportEndDate] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  const [realCash, setRealCash] = useState({ pix: 0, card: 0, cash: 0 });
  const [cashDiff, setCashDiff] = useState({ pix: 0, card: 0, cash: 0, total: 0 });

  const fetchFinanceData = async () => {
    if (!tenant.slug) return;
    setLoadingData(true);
    try {
      const { data: transData } = await supabase
        .from('manual_transactions')
        .select('*')
        .eq('tenant_slug', tenant.slug)
        .order('date', { ascending: false });

      if (transData) setManualTransactions(transData.map(t => ({...t, date: new Date(t.date)})));

      const { data: costsData } = await supabase
        .from('fixed_costs')
        .select('*')
        .eq('tenant_slug', tenant.slug);

      if (costsData) setFixedCostsDetails(costsData);
    } catch (err) {
      console.error("Erro ao carregar dados financeiros:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, [tenant.slug]);

  useEffect(() => {
    const dPix = realCash.pix - dreCalculations.payments.pix;
    const dCard = realCash.card - dreCalculations.payments.card;
    const dCash = realCash.cash - dreCalculations.payments.cash;
    setCashDiff({
        pix: dPix,
        card: dCard,
        cash: dCash,
        total: dPix + dCard + dCash
    });
  }, [realCash, dreCalculations.payments]);

  useEffect(() => {
    // @ts-ignore
    const Chart = window.Chart;
    if (!Chart) return;
    const charts: any[] = [];

    if (costDistributionChartRef.current) {
      const ctx = costDistributionChartRef.current.getContext('2d');
      if (ctx) {
        charts.push(new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Insumos (CMV)', 'Custos Fixos', 'Taxas/Impostos', 'Lucro Líquido'],
                datasets: [{
                    data: [
                        dreCalculations.cmv,
                        dreCalculations.fixedCosts + dreCalculations.manualOut,
                        dreCalculations.taxes,
                        Math.max(0, dreCalculations.netProfit)
                    ],
                    backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#fff', boxWidth: 12, font: { size: 10 } } } }
            }
        }));
      }
    }

    if (trendChartRef.current) {
        const ctx = trendChartRef.current.getContext('2d');
        if (ctx) {
            const last7Days = Array.from({length: 7}, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                return d;
            });
            const labels = last7Days.map(d => d.toLocaleDateString('pt-BR', { weekday: 'short' }));
            const revenueData = last7Days.map(d => {
                return orders
                    .filter(o => new Date(o.createdAt).toDateString() === d.toDateString() && o.status === 'finished')
                    .reduce((acc, o) => acc + o.total, 0);
            });
            const costData = revenueData.map(rev => rev * 0.7);
            charts.push(new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Receita', data: revenueData, borderColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.1)', fill: true, tension: 0.4 },
                        { label: 'Custos Est.', data: costData, borderColor: '#ef4444', backgroundColor: 'transparent', borderDash: [5, 5], tension: 0.4 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                    scales: { x: { grid: { display: false }, ticks: { color: '#666' } }, y: { grid: { color: '#1F1F23' }, ticks: { color: '#666' } } }
                }
            }));
        }
    }
    return () => charts.forEach(c => c.destroy());
  }, [dreCalculations, orders]);

  const handleCloseMonth = async () => {
    if (!window.confirm("Confirmar fechamento do mês? Isso salvará os dados atuais no histórico.")) return;
    const snapshot = {
       tenant_slug: tenant.slug,
       month: new Date().getMonth() + 1,
       year: new Date().getFullYear(),
       revenue: dreCalculations.revenue,
       cmv: dreCalculations.cmv,
       fixed_costs: dreCalculations.fixedCosts,
       net_profit: dreCalculations.netProfit,
       margin: dreCalculations.revenue > 0 ? (dreCalculations.netProfit / dreCalculations.revenue) * 100 : 0
    };
    const { error } = await supabase.from('financial_snapshots').insert(snapshot);
    if (error) {
       alert("Erro ao fechar mês ou mês já fechado.");
    } else {
       alert("Mês fechado com sucesso!");
       onCloseMonth();
    }
  };

  const handleSaveManualTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const dbPayload = {
      tenant_slug: tenant.slug,
      type: transactionForm.type,
      value: transactionForm.value,
      description: transactionForm.description,
      category: transactionForm.category,
      date: new Date().toISOString()
    };
    const { error } = await supabase.from('manual_transactions').insert([dbPayload]);
    if (error) {
        alert("Erro ao salvar transação: " + error.message);
    } else {
        fetchFinanceData();
        setIsTransactionModalOpen(false);
        setTransactionForm({ type: 'out', value: 0, description: '', category: 'Outros' });
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const { error } = await supabase.from('manual_transactions').delete().eq('id', id);
    if (error) alert("Erro ao excluir transação.");
    else fetchFinanceData();
  };

  const handleSaveFixedCost = async (e: React.FormEvent) => {
      e.preventDefault();
      const dbPayload = {
          tenant_slug: tenant.slug,
          label: fixedCostForm.label,
          value: fixedCostForm.value
      };

      let error;
      if (editingCostId) {
          const { error: err } = await supabase.from('fixed_costs').update(dbPayload).eq('id', editingCostId);
          error = err;
      } else {
          const { error: err } = await supabase.from('fixed_costs').insert([dbPayload]);
          error = err;
      }

      if (error) {
          alert("Erro ao salvar custo fixo.");
      } else {
          fetchFinanceData();
          setIsCostModalOpen(false);
          setEditingCostId(null);
          setFixedCostForm({ label: '', value: 0 });
      }
  };

  const handleDeleteFixedCost = async (id: string) => {
      const { error } = await supabase.from('fixed_costs').delete().eq('id', id);
      if (error) alert("Erro ao excluir custo fixo.");
      else fetchFinanceData();
  };

  const generatePrintableReport = () => {
      const content = `
        <html>
          <head>
            <title>Relatório Financeiro - ${tenant.name}</title>
            <style>
              body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #111; max-width: 800px; margin: 0 auto; }
              .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
              .logo-text { font-size: 24px; font-weight: bold; text-transform: uppercase; }
              .date-info { text-align: right; font-size: 12px; color: #555; }
              .summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 15px; margin-bottom: 40px; }
              .card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; background: #f9f9f9; }
              .card h3 { font-size: 10px; text-transform: uppercase; color: #666; margin: 0 0 5px 0; }
              .card p { font-size: 18px; font-weight: bold; margin: 0; }
              h2 { font-size: 16px; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-top: 30px; margin-bottom: 15px; text-transform: uppercase; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; }
              th, td { border-bottom: 1px solid #eee; padding: 10px 5px; text-align: left; }
              th { font-weight: bold; text-transform: uppercase; color: #555; border-bottom: 2px solid #333; }
              .text-right { text-align: right; }
              .text-red { color: #dc2626; }
              .text-green { color: #16a34a; }
              .font-bold { font-weight: bold; }
              .total-row td { border-top: 2px solid #333; font-size: 14px; font-weight: bold; padding-top: 15px; }
              .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
                <div class="logo-text">${tenant.name}</div>
                <div class="date-info">
                    <p>Relatório Financeiro</p>
                    <p>Período: ${startDate ? new Date(startDate).toLocaleDateString('pt-BR') : 'Início'} até ${endDate ? new Date(endDate).toLocaleDateString('pt-BR') : 'Hoje'}</p>
                    <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
                </div>
            </div>
            <div class="summary-grid">
               <div class="card"><h3>Receita Bruta</h3><p class="text-green">R$ ${dreCalculations.revenue.toFixed(2)}</p></div>
               <div class="card"><h3>Custos Totais</h3><p class="text-red">R$ ${dreCalculations.totalExpenses.toFixed(2)}</p></div>
               <div class="card"><h3>Lucro Líquido</h3><p class="${dreCalculations.netProfit >= 0 ? 'text-green' : 'text-red'}">R$ ${dreCalculations.netProfit.toFixed(2)}</p></div>
               <div class="card"><h3>Margem</h3><p>${dreCalculations.revenue > 0 ? ((dreCalculations.netProfit / dreCalculations.revenue)*100).toFixed(1) : 0}%</p></div>
            </div>
            <h2>DRE</h2>
            <table>
               <tr><td>(+) Receita Operacional Bruta</td><td class="text-right font-bold">R$ ${dreCalculations.revenue.toFixed(2)}</td></tr>
               <tr><td>(-) CMV</td><td class="text-right text-red">R$ ${dreCalculations.cmv.toFixed(2)}</td></tr>
               <tr><td>(-) Taxas</td><td class="text-right text-red">R$ ${dreCalculations.taxes.toFixed(2)}</td></tr>
               <tr><td>(-) Custos Fixos</td><td class="text-right text-red">R$ ${dreCalculations.fixedCosts.toFixed(2)}</td></tr>
               <tr><td>(-) Outros</td><td class="text-right text-red">R$ ${dreCalculations.manualOut.toFixed(2)}</td></tr>
               <tr class="total-row"><td>(=) Lucro Líquido</td><td class="text-right ${dreCalculations.netProfit >= 0 ? 'text-green' : 'text-red'}">R$ ${dreCalculations.netProfit.toFixed(2)}</td></tr>
            </table>
            <h2>Movimentações</h2>
            <table>
              <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th class="text-right">Valor</th></tr></thead>
              <tbody>
                ${manualTransactions.length > 0 ? manualTransactions.map(t => `
                  <tr><td>${new Date(t.date).toLocaleDateString('pt-BR')}</td><td>${t.description}</td><td>${t.category}</td><td class="text-right ${t.type === 'in' ? 'text-green' : 'text-red'}">${t.type === 'in' ? '+' : '-'} R$ ${t.value.toFixed(2)}</td></tr>
                `).join('') : '<tr><td colspan="4" style="text-align:center;">Nenhuma movimentação.</td></tr>'}
              </tbody>
            </table>
            <div class="footer">Gerado automaticamente por ChurrasBrutus.</div>
          </body>
        </html>
      `;
      const printWindow = window.open('', '', 'height=800,width=1000');
      if (printWindow) {
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
      }
  };

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
      if (exportFormat === 'pdf') {
        await generatePdfReport(exportStartDate, exportEndDate);
      } else {
        await generateCsvReport(exportStartDate, exportEndDate);
      }
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert('Erro ao gerar o relatório. Tente novamente.');
    } finally {
      setIsExporting(false);
      setIsExportModalOpen(false);
    }
  };

  const generatePdfReport = async (exportStartDate?: string, exportEndDate?: string) => {
    // @ts-ignore
    const { jsPDF } = window.jspdf;

    const doc = new jsPDF('p', 'mm', 'a4');
    const autoTable = (doc as any).autoTable; // Explicitly reference autoTable on the doc instance
    const pageHeight = doc.internal.pageSize.height;

    // Debug log
    console.log('Dados para exportar (DRE):', dreCalculations);
    console.log('Dados para exportar (Transações Manuais):', manualTransactions);

    doc.setFontSize(18);
    doc.text(`${String(tenant.name || 'Restaurante')} - Relatório Financeiro`, 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${String(new Date().toLocaleString('pt-BR'))}`, 14, 28);
    const periodText = exportStartDate && exportEndDate
      ? `Período: ${new Date(exportStartDate).toLocaleDateString('pt-BR')} até ${new Date(exportEndDate).toLocaleDateString('pt-BR')}`
      : 'Todos os Dados';
    doc.text(periodText, 14, 34);

    // Summary Table
    const summaryData = [
      ['Receita Bruta', String(dreCalculations.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))],
      ['Custos Totais', String(dreCalculations.totalExpenses.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))],
      ['Lucro Líquido', String(dreCalculations.netProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))],
      ['Margem', String(`${dreCalculations.revenue > 0 ? ((dreCalculations.netProfit / dreCalculations.revenue) * 100).toFixed(1) : 0}%`)],
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

    // DRE Table
    const dreStartY = (doc as any).autoTable.previous.finalY + 10;
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Demonstrativo de Resultados (DRE)', 14, dreStartY);

    const dreData = [
      ['Receita Operacional Bruta', String(dreCalculations.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))],
      ['(-) CMV', String(dreCalculations.cmv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))],
      ['(-) Taxas', String(dreCalculations.taxes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))],
      ['(-) Custos Fixos', String(dreCalculations.fixedCosts.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))],
      ['(-) Outros (Manuais)', String(dreCalculations.manualOut.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))],
      ['Lucro Líquido', String(dreCalculations.netProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))],
    ];

    doc.autoTable({
      startY: dreStartY + 7,
      head: [['Item', 'Valor']],
      body: dreData.map(row => [String(row[0]), String(row[1])]),
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 2 },
      headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' } },
      bodyStyles: { textColor: [0,0,0] }
    });

    // Transactions Table
    const transactionsStartY = (doc as any).autoTable.previous.finalY + 10;
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Movimentações Manuais', 14, transactionsStartY);

    const filteredManualTransactions = manualTransactions.filter(t => {
      const transactionDate = new Date(t.date);
      const start = exportStartDate ? new Date(exportStartDate) : null;
      const end = exportEndDate ? new Date(exportEndDate) : null;
      return (!start || transactionDate >= start) && (!end || transactionDate <= end);
    });

    const transactionsData = filteredManualTransactions.map(t => [
      String(t.date ? new Date(t.date).toLocaleDateString('pt-BR') : 'Data N/I'),
      String(t.description || 'Sem descrição'),
      String(t.category || 'Outros'),
      String(`${t.type === 'in' ? '+' : '-'} ${t.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`)
    ]);

    doc.autoTable({
      startY: transactionsStartY + 7,
      head: [['Data', 'Descrição', 'Categoria', 'Valor']],
      body: transactionsData,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 2 },
      headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: { 3: { halign: 'right' } },
      didDrawPage: (data: any) => {
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${data.pageNumber} de ${doc.internal.getNumberOfPages()}`, data.settings.margin.left, pageHeight - 10);
      }
    });

    doc.save(`relatorio_financeiro_${tenant.slug}.pdf`);
  };

  const generateCsvReport = async (exportStartDate?: string, exportEndDate?: string) => {
    const headers = ['Data', 'Cliente', 'Mesa', 'Itens Vendidos', 'Metodo de Pagamento', 'Valor Total'];
    const filteredOrders = orders.filter(o => {
      const orderDate = new Date(o.createdAt);
      const start = exportStartDate ? new Date(exportStartDate) : null;
      const end = exportEndDate ? new Date(exportEndDate) : null;
      return o.status === 'finished' && (!start || orderDate >= start) && (!end || orderDate <= end);
    });

    const data = filteredOrders.map(o => ({
      Data: new Date(o.createdAt).toLocaleDateString('pt-BR'),
      Cliente: o.customerName,
      Mesa: o.tableNumber || 'N/A',
      'Itens Vendidos': o.items.map(item => `${item.quantity}x ${item.name}`).join(', '),
      'Metodo de Pagamento': o.type === 'delivery' ? 'Online/Entrega' : 'Local',
      'Valor Total': o.total.toFixed(2),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatorio de Vendas");
    XLSX.writeFile(wb, `relatorio_vendas_${tenant.slug}.xlsx`);
  };

  return (
    <div className="space-y-6">
       <div className="flex flex-wrap items-center justify-between gap-4 bg-[#161618] border border-white/5 p-4 rounded-2xl">
          <div className="flex items-center gap-4 flex-wrap">
             <div className="flex items-center gap-2 bg-[#09090B] p-1 rounded-lg border border-white/5">
                <button onClick={() => setFinancePeriod && setFinancePeriod('today')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${financePeriod === 'today' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>Hoje</button>
                <button onClick={() => setFinancePeriod && setFinancePeriod('week')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${financePeriod === 'week' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>Semana</button>
                <button onClick={() => setFinancePeriod && setFinancePeriod('month')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${financePeriod === 'month' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>Mês</button>
                <button onClick={() => setFinancePeriod && setFinancePeriod('custom')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${financePeriod === 'custom' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>Outro</button>
             </div>
             <div className="flex items-center gap-2 bg-[#09090B] px-3 py-2 rounded-lg border border-white/5">
                <Calendar size={14} className="text-gray-500" />
                <div className="flex items-center gap-2">
                    <input type="date" value={startDate || ''} onChange={(e) => { if(setStartDate) setStartDate(e.target.value); if(setFinancePeriod) setFinancePeriod('custom'); }} className="bg-transparent text-xs text-white font-bold outline-none border-b border-white/10 w-24" />
                    <span className="text-gray-500">-</span>
                    <input type="date" value={endDate || ''} onChange={(e) => { if(setEndDate) setEndDate(e.target.value); if(setFinancePeriod) setFinancePeriod('custom'); }} className="bg-transparent text-xs text-white font-bold outline-none border-b border-white/10 w-24" />
                </div>
             </div>
          </div>
          <button onClick={() => setIsExportModalOpen(true)} disabled={isExporting} className="flex items-center gap-2 bg-[#09090B] hover:bg-white/5 text-white border border-white/10 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed">
             {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Exportar
          </button>
       </div>

       <div className="grid grid-cols-4 gap-4">
          <div className="p-5 bg-[#161618] border border-white/5 rounded-2xl"><p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Receita Bruta</p><p className="text-xl font-bold text-white mb-2">R$ {dreCalculations.revenue.toFixed(2)}</p><div className="text-[10px] text-green-500 bg-green-500/10 inline-block px-1.5 py-0.5 rounded border border-green-500/20 font-bold">+ {dreCalculations.deltas.revenue}%</div></div>
          <div className="p-5 bg-[#161618] border border-white/5 rounded-2xl"><p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Custos Totais</p><p className="text-xl font-bold text-red-400 mb-2">R$ {dreCalculations.totalExpenses.toFixed(2)}</p><div className="text-[10px] text-red-500 bg-red-500/10 inline-block px-1.5 py-0.5 rounded border border-red-500/20 font-bold">{dreCalculations.deltas.expenses}% vs ant.</div></div>
          <div className="p-5 bg-[#161618] border border-white/5 rounded-2xl relative overflow-hidden"><div className="absolute inset-0 bg-emerald-500/5" /><p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1 relative z-10">Lucro Líquido</p><p className="text-xl font-bold text-emerald-400 mb-2 relative z-10">R$ {dreCalculations.netProfit.toFixed(2)}</p><div className="text-[10px] text-emerald-500 bg-emerald-500/10 inline-block px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold relative z-10">Margem: {dreCalculations.revenue > 0 ? ((dreCalculations.netProfit / dreCalculations.revenue)*100).toFixed(1) : 0}%</div></div>
          <div className="p-5 bg-[#161618] border border-white/5 rounded-2xl"><p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Ponto de Equilíbrio</p><p className="text-xl font-bold text-white mb-2">R$ {dreCalculations.breakEven.toFixed(2)}</p><div className="w-full bg-gray-700 h-1 rounded-full overflow-hidden mt-2"><div className="bg-primary h-full" style={{ width: `${Math.min((dreCalculations.revenue / (dreCalculations.breakEven || 1))*100, 100)}%` }} /></div></div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-2 bg-[#161618] border border-white/5 rounded-2xl p-6">
             {loadingData ? (
               <div className="h-40 flex items-center justify-center opacity-30"><Loader2 className="animate-spin text-primary" size={32}/></div>
             ) : (
               <>
                 <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4"><h3 className="font-bold text-white text-sm uppercase tracking-widest">Demonstrativo de Resultados</h3></div>
                 <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center text-white font-bold text-sm"><span>Receita Operacional Bruta</span><span>R$ {dreCalculations.revenue.toFixed(2)}</span></div>
                    <div className="pl-4 space-y-2 border-l-2 border-white/5 my-2">
                       <div className="flex justify-between items-center text-red-400 cursor-pointer hover:bg-white/5 p-1 rounded" onClick={() => setIsCMVModalOpen(true)}><span>(-) CMV (Insumos) <ChevronDown size={10}/></span><span>R$ {dreCalculations.cmv.toFixed(2)}</span></div>
                       <div className="flex justify-between items-center text-red-400 p-1"><span>(-) Taxas (Cartão/Entrega)</span><span>R$ {dreCalculations.taxes.toFixed(2)}</span></div>
                    </div>
                    <div className="flex justify-between items-center text-gray-300 font-bold pt-2 border-t border-white/5"><span>= Margem de Contribuição</span><span>R$ {(dreCalculations.revenue - dreCalculations.cmv - dreCalculations.taxes).toFixed(2)}</span></div>
                    <div className="pl-4 space-y-2 border-l-2 border-white/5 my-2">
                       <div className="flex justify-between items-center text-red-400 cursor-pointer hover:bg-white/5 p-1 rounded" onClick={() => setIsCostModalOpen(true)}><span>(-) Custos Fixos <Edit2 size={10}/></span><span>R$ {dreCalculations.fixedCosts.toFixed(2)}</span></div>
                       <div className="flex justify-between items-center text-red-400 p-1"><span>(-) Saídas Manuais / Outros</span><span>R$ {dreCalculations.manualOut.toFixed(2)}</span></div>
                    </div>
                    <div className="flex justify-between items-center text-emerald-400 font-black text-sm pt-4 border-t border-white/10"><span>= L.A.I.R (Lucro Antes IR)</span><span>R$ {dreCalculations.netProfit.toFixed(2)}</span></div>
                 </div>
               </>
             )}
             <div className="mt-8 pt-6 border-t border-white/5"><h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2"><TrendingUp size={12} /> Tendência (7 Dias)</h4><div className="h-48 w-full"><canvas ref={trendChartRef} /></div></div>
             <div className="mt-8 pt-6 border-t border-white/5">
                <div className="flex justify-between items-center mb-4"><h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Últimos Movimentos</h4></div>
                <div className="space-y-2">
                    {manualTransactions.slice(0, 5).map((t, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 rounded bg-white/5 text-[10px] group"><div className="flex items-center gap-2"><div className={`w-1.5 h-1.5 rounded-full ${t.type === 'in' ? 'bg-green-500' : 'bg-red-500'}`} /><span className="text-gray-300">{new Date(t.date).toLocaleDateString()} - {t.description}</span></div><div className="flex items-center gap-3"><span className={`font-bold ${t.type === 'in' ? 'text-green-500' : 'text-red-500'}`}>{t.type === 'in' ? '+' : '-'} R$ {t.value.toFixed(2)}</span><button onClick={() => handleDeleteTransaction(t.id)} className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12}/></button></div></div>
                    ))}
                </div>
             </div>
          </div>

          <div className="space-y-4">
             <div className="bg-[#161618] border border-white/5 rounded-2xl p-5 relative min-h-[220px]"><h3 className="text-gray-400 font-bold text-xs uppercase tracking-widest absolute top-5 left-5">Distribuição</h3><div className="h-40 mt-6 flex justify-center"><div className="w-full h-full relative"><canvas ref={costDistributionChartRef} /></div></div></div>
             <div className="bg-[#161618] border border-white/5 rounded-2xl p-5">
                <div className="flex justify-between items-center mb-4"><h3 className="text-white font-bold text-xs uppercase tracking-widest">Caixa Real</h3></div>
                <div className="space-y-3">
                    <div className="p-2 rounded bg-white/5 border border-white/5"><div className="flex justify-between text-[10px] mb-1"><span className="text-gray-400 uppercase font-bold">Pix</span><span className="text-gray-500">Est: R$ {dreCalculations.payments.pix.toFixed(2)}</span></div><div className="flex items-center gap-2"><div className="w-1 h-6 bg-green-500 rounded-full"/><input type="number" value={realCash.pix || ''} onChange={e => setRealCash({...realCash, pix: parseFloat(e.target.value) || 0})} className="bg-transparent border-none text-xs font-bold text-white w-full focus:outline-none" /></div></div>
                    <div className="p-2 rounded bg-white/5 border border-white/5"><div className="flex justify-between text-[10px] mb-1"><span className="text-gray-400 uppercase font-bold">Cartão</span><span className="text-gray-500">Est: R$ {dreCalculations.payments.card.toFixed(2)}</span></div><div className="flex items-center gap-2"><div className="w-1 h-6 bg-blue-500 rounded-full"/><input type="number" value={realCash.card || ''} onChange={e => setRealCash({...realCash, card: parseFloat(e.target.value) || 0})} className="bg-transparent border-none text-xs font-bold text-white w-full focus:outline-none" /></div></div>
                </div>
             </div>
             <div className="bg-[#161618] border border-white/5 rounded-2xl p-5">
                <h3 className="font-bold text-white text-xs uppercase tracking-widest mb-4">Ações</h3>
                <div className="space-y-2">
                   <button onClick={() => setIsTransactionModalOpen(true)} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 border border-white/5"><ArrowRightLeft size={14} /> Lançar Avulso</button>
                   <button onClick={handleCloseMonth} className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 border border-emerald-500/20"><Save size={14} /> Fechar Mês</button>
                </div>
             </div>
          </div>
       </div>

       {/* Modals implementados com persistência Supabase */}
       {isTransactionModalOpen && (
         <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] backdrop-blur-sm">
            <div className="bg-[#161618] rounded-2xl w-full max-w-md border border-white/10 p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6"><h3 className="text-white font-bold">Nova Transação</h3><button onClick={() => setIsTransactionModalOpen(false)} className="text-gray-500 hover:text-white"><X size={20}/></button></div>
                <form onSubmit={handleSaveManualTransaction} className="space-y-4">
                   <div className="flex bg-[#09090B] rounded-lg p-1 border border-white/10 mb-4"><button type="button" onClick={() => setTransactionForm({...transactionForm, type: 'in'})} className={`flex-1 py-2 text-xs font-bold uppercase rounded-md transition-all ${transactionForm.type === 'in' ? 'bg-green-500/20 text-green-500' : 'text-gray-500'}`}>Entrada (+)</button><button type="button" onClick={() => setTransactionForm({...transactionForm, type: 'out'})} className={`flex-1 py-2 text-xs font-bold uppercase rounded-md transition-all ${transactionForm.type === 'out' ? 'bg-red-500/20 text-red-500' : 'text-gray-500'}`}>Saída (-)</button></div>
                   <input required type="text" placeholder="Descrição" value={transactionForm.description} onChange={e => setTransactionForm({...transactionForm, description: e.target.value})} className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white" />
                   <input required type="number" step="0.01" placeholder="Valor" value={transactionForm.value} onChange={e => setTransactionForm({...transactionForm, value: parseFloat(e.target.value)})} className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white" />
                   <select value={transactionForm.category} onChange={e => setTransactionForm({...transactionForm, category: e.target.value})} className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"><option value="Operacional">Operacional</option><option value="Pessoal">Pro-Labore</option><option value="Marketing">Marketing</option><option value="Outros">Outros</option></select>
                   <button type="submit" className="w-full bg-primary text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest">Salvar no Banco</button>
                </form>
            </div>
         </div>
       )}

       {isCostModalOpen && (
           <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] backdrop-blur-sm">
              <div className="bg-[#161618] rounded-2xl w-full max-w-md border border-white/10 p-6 shadow-2xl">
                  <div className="flex justify-between items-center mb-6"><h3 className="text-white font-bold">Custos Fixos (Supabase)</h3><button onClick={() => setIsCostModalOpen(false)} className="text-gray-500 hover:text-white"><X size={20}/></button></div>
                  <div className="mb-6 space-y-2 max-h-48 overflow-y-auto">{fixedCostsDetails.map(cost => (<div key={cost.id} className="flex justify-between items-center p-2 rounded bg-white/5 border border-white/5"><div className="flex-1"><p className="text-xs text-gray-300 font-bold">{cost.label}</p></div><div className="flex items-center gap-3"><span className="text-xs text-white font-mono">R$ {cost.value.toFixed(2)}</span><div className="flex gap-1"><button onClick={() => { setEditingCostId(cost.id); setFixedCostForm({label: cost.label, value: cost.value}); }} className="p-1 text-gray-500"><Edit2 size={12}/></button><button onClick={() => handleDeleteFixedCost(cost.id)} className="p-1 text-gray-500"><Trash2 size={12}/></button></div></div></div>))}</div>
                  <form onSubmit={handleSaveFixedCost} className="space-y-4 pt-4 border-t border-white/10">
                     <div className="grid grid-cols-2 gap-3"><input required placeholder="Luz, Aluguel..." value={fixedCostForm.label} onChange={e => setFixedCostForm({...fixedCostForm, label: e.target.value})} className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white" /><input required type="number" step="0.01" value={fixedCostForm.value} onChange={e => setFixedCostForm({...fixedCostForm, value: parseFloat(e.target.value)})} className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white" /></div>
                     <button type="submit" className="w-full bg-white/10 text-white py-2 rounded-lg font-bold text-xs uppercase">{editingCostId ? 'Atualizar' : 'Adicionar no Banco'}</button>
                  </form>
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

export default DashboardFinance;
