
import React, { useState, useMemo } from 'react';
import { InventoryItem, InventoryCategory } from '../../types';
import { Coins, AlertTriangle, Wallet, ChevronDown, Search, ClipboardList, Plus, Package, Minus, AlertOctagon, Edit2, Trash2, CheckCircle2, X, Loader2 } from 'lucide-react';

interface DashboardInventoryProps {
  inventory: InventoryItem[];
  onUpdateInventory: (inventory: InventoryItem[]) => void;
  onSaveInventoryItem: (item: InventoryItem) => Promise<void>;
  onDeleteInventoryItem: (id: string) => Promise<void>;
}

const DashboardInventory: React.FC<DashboardInventoryProps> = ({ inventory, onUpdateInventory, onSaveInventoryItem, onDeleteInventoryItem }) => {
  const [inventorySearch, setInventorySearch] = useState('');
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState<'all' | InventoryCategory>('all');
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<'all' | 'low_stock'>('all');
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [editingInventoryId, setEditingInventoryId] = useState<string | null>(null);
  const [inventoryForm, setInventoryForm] = useState<Partial<InventoryItem>>({ name: '', currentQty: 0, minQty: 0, unit: 'un', category: 'proteinas', costPrice: 0 });

  const filteredInventory = useMemo(() => {
    return inventory.filter(i => {
      const matchesCategory = inventoryCategoryFilter === 'all' || i.category === inventoryCategoryFilter;
      const matchesSearch = i.name.toLowerCase().includes(inventorySearch.toLowerCase());
      const matchesStatus = inventoryStatusFilter === 'all' || (inventoryStatusFilter === 'low_stock' && i.currentQty <= i.minQty);
      return matchesCategory && matchesSearch && matchesStatus;
    });
  }, [inventory, inventoryCategoryFilter, inventorySearch, inventoryStatusFilter]);

  const groupedInventoryItems = useMemo<Record<string, InventoryItem[]>>(() => {
      const groups: Record<string, InventoryItem[]> = {};
      filteredInventory.forEach(item => {
          if (!groups[item.category]) groups[item.category] = [];
          groups[item.category].push(item);
      });
      return groups;
  }, [filteredInventory]);

  const stockValuation = useMemo(() => {
    const totalValue = inventory.reduce((acc, i) => acc + (i.currentQty * i.costPrice), 0);
    const lowStockItems = inventory.filter(i => i.currentQty <= i.minQty);
    const replenishmentCost = lowStockItems.reduce((acc, i) => acc + ((i.minQty - i.currentQty) * i.costPrice), 0);
    return { totalValue, lowStockCount: lowStockItems.length, replenishmentCost };
  }, [inventory]);

  const handleGenerateShoppingList = () => {
    const items = inventory.filter(i => i.currentQty <= i.minQty);
    if (items.length === 0) return alert('Estoque está saudável! Nada para comprar.');
    const date = new Date().toLocaleDateString('pt-BR');
    let text = `📋 *LISTA DE COMPRAS - ${date}*\n\n`;
    text += items.map(i => {
      const diff = Math.ceil(i.minQty - i.currentQty);
      return `[ ] ${i.name}\n    Faltam: ${diff} ${i.unit} (Mín: ${i.minQty})`;
    }).join('\n\n');
    text += `\n\nCusto Est. Reposição: R$ ${stockValuation.replenishmentCost.toFixed(2)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  const adjustInventory = (id: string, delta: number) => { const updated = inventory.map(item => item.id === id ? { ...item, currentQty: Math.max(0, item.currentQty + delta) } : item); onUpdateInventory(updated); };
  
  const handleSaveInventory = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    
    const cleanFormValues = {
        ...inventoryForm,
        currentQty: Number(inventoryForm.currentQty) || 0,
        minQty: Number(inventoryForm.minQty) || 0,
        costPrice: Number(inventoryForm.costPrice) || 0
    };

    const itemToSave: InventoryItem = editingInventoryId 
        ? { ...inventory.find(i => i.id === editingInventoryId), ...cleanFormValues } as InventoryItem
        : { ...cleanFormValues, id: `inv-${Date.now()}` } as InventoryItem;

    try {
        await onSaveInventoryItem(itemToSave);
        setIsInventoryModalOpen(false); 
        setEditingInventoryId(null); 
        setInventoryForm({ name: '', currentQty: 0, minQty: 0, unit: 'un', category: 'proteinas', costPrice: 0 }); 
    } catch (err) {
        console.error(err);
    }
  };

  const handleDeleteInventory = async (id: string) => { 
    if (confirm('Tem certeza que deseja excluir este item?')) {
        await onDeleteInventoryItem(id); 
    }
  };

  const handleSaveAll = async () => {
    setIsSavingAll(true);
    try {
        for (const item of inventory) {
            await onSaveInventoryItem(item);
        }
        alert('Todo o estoque foi salvo com sucesso!');
    } catch (err) {
        alert('Erro ao salvar estoque completo.');
    } finally {
        setIsSavingAll(false);
    }
  };

  const renderStatus = (item: InventoryItem) => {
    if (item.currentQty <= item.minQty) {
        return { color: 'text-red-500', bg: 'bg-red-500/10', icon: <AlertOctagon size={14} />, label: 'Crítico' };
    } else if (item.currentQty <= item.minQty * 1.2) {
        return { color: 'text-yellow-500', bg: 'bg-yellow-500/10', icon: <AlertTriangle size={14} />, label: 'Atenção' };
    }
    return { color: 'text-green-500', bg: 'bg-green-500/10', icon: <CheckCircle2 size={14} />, label: 'Estável' };
  };

  return (
    <div className="space-y-6">
       
       <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#161618] border border-white/5 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Valor em Estoque</p>
                 <p className="text-2xl font-bold text-white">R$ {stockValuation.totalValue.toFixed(2)}</p>
              </div>
              <div className="mt-4 flex items-center gap-2 text-[10px] text-gray-400">
                  <Coins size={12} /> Dinheiro parado
              </div>
          </div>
          <div className={`bg-[#161618] border rounded-2xl p-5 flex flex-col justify-between ${stockValuation.lowStockCount > 0 ? 'border-red-500/20' : 'border-white/5'}`}>
              <div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Itens em Alerta</p>
                 <p className={`text-2xl font-bold ${stockValuation.lowStockCount > 0 ? 'text-red-500' : 'text-green-500'}`}>{stockValuation.lowStockCount}</p>
              </div>
              <div className="mt-4 flex items-center gap-2 text-[10px] text-gray-400">
                  <AlertTriangle size={12} className={stockValuation.lowStockCount > 0 ? 'text-red-500' : 'text-green-500'} /> Abaixo do mínimo
              </div>
          </div>
          <div className="bg-[#161618] border border-white/5 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Custo de Reposição</p>
                 <p className="text-2xl font-bold text-white">R$ {stockValuation.replenishmentCost.toFixed(2)}</p>
              </div>
              <div className="mt-4 flex items-center gap-2 text-[10px] text-gray-400">
                  <Wallet size={12} /> Para atingir o mínimo
              </div>
          </div>
       </div>

       <div className="flex justify-between items-center gap-4 flex-wrap">
         <div className="flex gap-2 flex-1">
            <div className="relative">
                <select value={inventoryCategoryFilter} onChange={(e: any) => setInventoryCategoryFilter(e.target.value)} className="bg-[#161618] border border-white/5 rounded-lg pl-3 pr-8 py-2 text-xs text-white appearance-none cursor-pointer hover:bg-white/5 transition-colors font-bold uppercase tracking-wide">
                  <option value="all">Todas Categorias</option>
                  {['proteinas', 'bebidas', 'suprimentos', 'outros'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>

            <button 
              onClick={() => setInventoryStatusFilter(inventoryStatusFilter === 'all' ? 'low_stock' : 'all')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors border ${inventoryStatusFilter === 'low_stock' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-[#161618] text-gray-400 border-white/5 hover:bg-white/5'}`}
            >
                <AlertOctagon size={14} />
                <span>Em Falta</span>
            </button>

            <div className="relative flex-1 max-w-xs">
               <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
               <input type="text" placeholder="Buscar item..." value={inventorySearch} onChange={e => setInventorySearch(e.target.value)} className="w-full bg-[#161618] border border-white/5 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-primary/50" />
            </div>
         </div>
         
         <div className="flex gap-2">
            <button 
                onClick={handleSaveAll} 
                disabled={isSavingAll}
                className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all active:scale-95 ${isSavingAll ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {isSavingAll ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {isSavingAll ? 'Salvando...' : 'Salvar Alterações'}
            </button>
            <button onClick={handleGenerateShoppingList} className="bg-[#25D366] hover:bg-[#20bd5a] text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-green-900/20 transition-all active:scale-95">
                <ClipboardList size={14} /> Gerar Lista de Compras
            </button>
            <button onClick={() => setIsInventoryModalOpen(true)} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-orange-600 transition-colors shadow-lg shadow-primary/20">
                <Plus size={14} /> Novo Item
            </button>
         </div>
       </div>

       <div className="space-y-4">
          {Object.keys(groupedInventoryItems).length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center opacity-40">
                  <Package size={48} className="text-gray-500 mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Nenhum item encontrado</p>
              </div>
          ) : Object.entries(groupedInventoryItems).map(([category, items]: [string, InventoryItem[]]) => (
              <div key={category} className="bg-[#161618] border border-white/5 rounded-2xl overflow-hidden mb-4">
                  <div className="bg-white/5 px-4 py-3 flex items-center gap-2 border-b border-white/5">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <h4 className="font-bold text-white text-xs uppercase tracking-widest">{category}</h4>
                      <span className="text-[10px] text-gray-500 font-bold bg-black/20 px-2 py-0.5 rounded ml-auto">{items.length} itens</span>
                  </div>
                  <table className="w-full text-left text-xs">
                      <thead className="text-gray-500 font-bold uppercase border-b border-white/5 bg-[#09090B]/30">
                         <tr>
                           <th className="p-4 w-[40%]">Item</th>
                           <th className="p-4 text-center">Nível de Estoque</th>
                           <th className="p-4 text-right">Custo Unit.</th>
                           <th className="p-4 text-center">Status</th>
                           <th className="p-4 text-right">Ações</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {items.map(item => {
                          const status = renderStatus(item);
                          const percent = Math.min((item.currentQty / (item.minQty * 2)) * 100, 100);
                          
                          return (
                              <tr key={item.id} className="text-white hover:bg-white/5 transition-colors group">
                                <td className="p-4">
                                    <p className="font-bold text-sm">{item.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Mín: {item.minQty} {item.unit}</span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-col items-center gap-2 w-full max-w-[140px] mx-auto">
                                        <div className="flex items-center justify-between w-full bg-[#09090B] rounded-lg p-1 border border-white/5">
                                            <button onClick={() => adjustInventory(item.id, -1)} className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"><Minus size={12} /></button>
                                            <span className="font-bold font-mono">{item.currentQty} <span className="text-[9px] text-gray-500">{item.unit}</span></span>
                                            <button onClick={() => adjustInventory(item.id, 1)} className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"><Plus size={12} /></button>
                                        </div>
                                        {/* Barra de Progresso Visual */}
                                        <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                            <div 
                                              className={`h-full transition-all duration-500 ${item.currentQty <= item.minQty ? 'bg-red-500' : item.currentQty <= item.minQty * 1.2 ? 'bg-yellow-500' : 'bg-green-500'}`} 
                                              style={{ width: `${percent}%` }} 
                                            />
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 text-right font-mono text-gray-300">R$ {item.costPrice.toFixed(2)}</td>
                                <td className="p-4 text-center">
                                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${status.color} ${status.bg} border-opacity-20 text-[9px] font-bold uppercase`}>
                                        {status.icon} {status.label}
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setEditingInventoryId(item.id); setInventoryForm(item); setIsInventoryModalOpen(true); }} className="p-2 hover:bg-blue-500 rounded text-gray-400 hover:text-white transition-colors"><Edit2 size={14} /></button>
                                        <button onClick={() => handleDeleteInventory(item.id)} className="p-2 hover:bg-red-500 rounded text-gray-400 hover:text-white transition-colors"><Trash2 size={14} /></button>
                                    </div>
                                </td>
                              </tr>
                          );
                        })}
                      </tbody>
                  </table>
              </div>
          ))}
       </div>

       {isInventoryModalOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] backdrop-blur-sm">
             <div className="bg-[#161618] rounded-2xl w-full max-w-md border border-white/10 p-6 shadow-2xl">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-white font-bold">{editingInventoryId ? 'Editar Item' : 'Novo Item'}</h3>
                    <button onClick={() => setIsInventoryModalOpen(false)} className="text-gray-500 hover:text-white"><X size={20}/></button>
                 </div>
                 <form onSubmit={handleSaveInventory} className="space-y-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-bold text-gray-500 uppercase">Nome do Item</label>
                       <input required type="text" value={inventoryForm.name} onChange={e => setInventoryForm({...inventoryForm, name: e.target.value})} className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-primary/50 outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Quantidade Atual</label>
                          <input required type="number" step="0.01" value={inventoryForm.currentQty} onChange={e => setInventoryForm({...inventoryForm, currentQty: parseFloat(e.target.value)})} className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-primary/50 outline-none" />
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Qtd Mínima</label>
                          <input required type="number" step="0.01" value={inventoryForm.minQty} onChange={e => setInventoryForm({...inventoryForm, minQty: parseFloat(e.target.value)})} className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-primary/50 outline-none" />
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Unidade</label>
                          <select value={inventoryForm.unit} onChange={e => setInventoryForm({...inventoryForm, unit: e.target.value})} className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-primary/50 outline-none">
                             <option value="un">Unidade (un)</option>
                             <option value="kg">Quilo (kg)</option>
                             <option value="l">Litro (l)</option>
                             <option value="pct">Pacote (pct)</option>
                          </select>
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Categoria</label>
                          <select value={inventoryForm.category} onChange={e => setInventoryForm({...inventoryForm, category: e.target.value as InventoryCategory})} className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-primary/50 outline-none">
                             <option value="proteinas">Proteínas</option>
                             <option value="bebidas">Bebidas</option>
                             <option value="suprimentos">Suprimentos</option>
                             <option value="outros">Outros</option>
                          </select>
                       </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Custo Unitário (R$)</label>
                        <input required type="number" step="0.01" value={inventoryForm.costPrice} onChange={e => setInventoryForm({...inventoryForm, costPrice: parseFloat(e.target.value)})} className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-primary/50 outline-none" />
                    </div>
                    <button type="submit" className="w-full bg-primary hover:bg-orange-600 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all mt-4">Salvar</button>
                 </form>
             </div>
          </div>
      )}
    </div>
  );
};

export default DashboardInventory;
