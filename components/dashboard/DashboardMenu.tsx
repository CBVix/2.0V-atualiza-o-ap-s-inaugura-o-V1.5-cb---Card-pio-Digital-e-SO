
import React, { useState, useMemo } from 'react';
import { Tenant, Product, InventoryItem, ProductSide } from '../../types';
import { LayoutGrid, List, Plus, Copy, Edit2, Trash2, Star, Ban, Package, X, FileText, DollarSign, Settings, Image, Save, EyeOff, Ticket, AlertCircle, Utensils } from 'lucide-react';
import { supabase } from '../../supabaseClient';

interface DashboardMenuProps {
  tenant: Tenant;
  inventory: InventoryItem[];
  onUpdateTenant: (tenant: Tenant) => void;
}

type ProductViewMode = 'grid' | 'list';
type ModalTab = 'general' | 'pricing' | 'sides' | 'settings' | 'media';
type ProductStatusFilter = 'all' | 'out_of_stock' | 'highlighted';

const DashboardMenu: React.FC<DashboardMenuProps> = ({ tenant, inventory, onUpdateTenant }) => {
  const [productViewMode, setProductViewMode] = useState<ProductViewMode>('grid');
  const [productModalTab, setProductModalTab] = useState<ModalTab>('general');
  const [productStatusFilter, setProductStatusFilter] = useState<ProductStatusFilter>('all');
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<Partial<Product>>({ name: '', price: 0, category: 'tradicionais', description: '', prepTime: '15 Min', image: '', sides: [] });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Side form state
  const [newSide, setNewSide] = useState<ProductSide>({ name: '', price: 0 });

  const filteredProducts = useMemo(() => {
    return tenant.products.filter(p => {
      const matchesCategory = productCategoryFilter === 'all' || p.category === productCategoryFilter;
      const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
                           p.description.toLowerCase().includes(productSearch.toLowerCase());
      
      let matchesStatus = true;
      if (productStatusFilter === 'out_of_stock') matchesStatus = p.availability === 'out_of_stock';
      if (productStatusFilter === 'highlighted') matchesStatus = p.isHighlighted === true;

      return matchesCategory && matchesSearch && matchesStatus;
    });
  }, [tenant.products, productCategoryFilter, productSearch, productStatusFilter]);

  const validateProductForm = () => {
    const newErrors: Record<string, string> = {};
    if (!productForm.name?.trim()) newErrors.name = "Nome do produto é obrigatório";
    if ((productForm.price || 0) <= 0) newErrors.price = "Preço deve ser maior que zero";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveProduct = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (!validateProductForm()) return;

    const dbPayload = {
      tenant_slug: tenant.slug,
      name: productForm.name,
      price: productForm.price,
      category: productForm.category,
      description: productForm.description,
      prep_time: productForm.prepTime,
      image: productForm.image,
      is_highlighted: productForm.isHighlighted || false,
      availability: productForm.availability || 'available',
      inventory_id: productForm.inventoryId || null,
      sides: productForm.sides || [] // Salvando acompanhamentos
    };

    try {
      if (editingProductId) { 
          const { error } = await supabase.from('products').update(dbPayload).eq('id', editingProductId);
          if (error) throw error;
      } else { 
          const { error } = await supabase.from('products').insert([dbPayload]);
          if (error) throw error;
      } 
      
      setIsProductModalOpen(false); 
      setEditingProductId(null);
      setProductModalTab('general');
      setProductForm({ name: '', price: 0, category: 'tradicionais', description: '', prepTime: '15 Min', image: '', sides: [] }); 
      setErrors({});
    } catch (err: any) {
      alert("Erro ao salvar produto: " + err.message);
    }
  };
  
  const handleAddSide = () => {
    if (!newSide.name || newSide.price < 0) return;
    setProductForm(prev => ({
        ...prev,
        sides: [...(prev.sides || []), newSide]
    }));
    setNewSide({ name: '', price: 0 });
  };

  const handleRemoveSide = (index: number) => {
    setProductForm(prev => ({
        ...prev,
        sides: (prev.sides || []).filter((_, i) => i !== index)
    }));
  };

  const handleDuplicateProduct = async (product: Product) => {
    if (window.confirm(`Deseja duplicar "${product.name}"?`)) {
      const dbPayload = {
        tenant_slug: tenant.slug,
        name: `${product.name} (Cópia)`,
        price: product.price,
        category: product.category,
        description: product.description,
        prep_time: product.prepTime,
        image: product.image,
        is_highlighted: product.isHighlighted,
        availability: 'available',
        inventory_id: product.inventoryId,
        sides: product.sides || []
      };
      await supabase.from('products').insert([dbPayload]);
    }
  };
  
  const toggleProductAvailability = async (id: string) => { 
    const p = tenant.products.find(x => x.id === id);
    if (!p) return;
    const newStatus = p.availability === 'out_of_stock' ? 'available' : 'out_of_stock';
    await supabase.from('products').update({ availability: newStatus }).eq('id', id);
  };

  const toggleProductHighlight = async (id: string) => { 
    const p = tenant.products.find(x => x.id === id);
    if (!p) return;
    await supabase.from('products').update({ is_highlighted: !p.isHighlighted }).eq('id', id);
  };

  const handleDeleteProduct = async (id: string) => { 
    if (window.confirm("Deseja realmente excluir este produto?")) {
        await supabase.from('products').delete().eq('id', id);
    }
  };

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center flex-wrap gap-4">
         <div className="flex gap-2 flex-1 min-w-[300px]">
            <select value={productCategoryFilter} onChange={e => setProductCategoryFilter(e.target.value)} className="bg-[#161618] border border-white/5 rounded-lg px-4 py-2 text-xs text-white">
              <option value="all">Todas as Categorias</option>
              {tenant.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="text" placeholder="Buscar produto..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="flex-1 bg-[#161618] border border-white/5 rounded-lg px-4 py-2 text-xs text-white min-w-[150px]" />
         </div>
         <div className="flex gap-2">
            <div className="bg-[#161618] border border-white/5 rounded-lg p-1 flex">
               <button onClick={() => setProductStatusFilter('all')} className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${productStatusFilter === 'all' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>Todos</button>
               <button onClick={() => setProductStatusFilter('out_of_stock')} className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${productStatusFilter === 'out_of_stock' ? 'bg-red-500/20 text-red-500' : 'text-gray-500 hover:text-white'}`}>Em Falta</button>
               <button onClick={() => setProductStatusFilter('highlighted')} className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${productStatusFilter === 'highlighted' ? 'bg-yellow-500/20 text-yellow-500' : 'text-gray-500 hover:text-white'}`}>Destaques</button>
            </div>
            <div className="bg-[#161618] border border-white/5 rounded-lg p-1 flex">
               <button onClick={() => setProductViewMode('grid')} className={`p-1.5 rounded transition-all ${productViewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}><LayoutGrid size={16} /></button>
               <button onClick={() => setProductViewMode('list')} className={`p-1.5 rounded transition-all ${productViewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}><List size={16} /></button>
            </div>
            <button onClick={() => { setIsProductModalOpen(true); setProductModalTab('general'); setProductForm({ name: '', price: 0, category: 'tradicionais', description: '', prepTime: '15 Min', image: '', sides: [] }); }} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-orange-600 transition-colors shadow-lg shadow-primary/20"><Plus size={14} /> Novo Produto</button>
         </div>
       </div>
       {productViewMode === 'grid' ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredProducts.map(product => (
                <div key={product.id} className={`bg-[#161618] border rounded-2xl p-4 group relative transition-all ${product.availability === 'out_of_stock' ? 'border-red-500/30 opacity-70' : 'border-white/5 hover:border-white/10'}`}>
                   <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                     <button onClick={() => handleDuplicateProduct(product)} className="p-2 bg-gray-700 rounded-lg text-white hover:bg-gray-600" title="Duplicar"><Copy size={12} /></button>
                     <button onClick={() => { setEditingProductId(product.id); setProductForm(product); setIsProductModalOpen(true); }} className="p-2 bg-blue-500 rounded-lg text-white hover:bg-blue-400" title="Editar"><Edit2 size={12} /></button>
                     <button onClick={() => handleDeleteProduct(product.id)} className="p-2 bg-red-500 rounded-lg text-white hover:bg-red-400" title="Excluir"><Trash2 size={12} /></button>
                   </div>
                   <div className="relative mb-4">
                      <img src={product.image} className="w-full h-32 object-cover rounded-xl" />
                      {product.availability === 'out_of_stock' && (<div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center"><span className="text-[10px] font-black uppercase tracking-widest text-red-500 border border-red-500 px-2 py-1 rounded bg-black/50">Esgotado</span></div>)}
                      {product.isHighlighted && product.availability !== 'out_of_stock' && (<div className="absolute top-2 left-2 bg-yellow-500 text-white p-1 rounded-lg shadow-lg"><Star size={10} fill="currentColor" /></div>)}
                   </div>
                   <h4 className="font-bold text-white text-sm truncate">{product.name}</h4>
                   <p className="text-xs text-gray-500 mb-2 capitalize">{tenant.categories.find(c => c.id === product.category)?.name || product.category}</p>
                   <div className="flex justify-between items-center">
                     <span className="text-primary font-bold">R$ {product.price.toFixed(2)}</span>
                     <div className="flex gap-2">
                        <button onClick={() => toggleProductHighlight(product.id)} className={`p-1 rounded transition-colors ${product.isHighlighted ? 'text-yellow-500 bg-yellow-500/10' : 'text-gray-600 hover:text-gray-400'}`} title="Destaque"><Star size={14} /></button>
                        <button onClick={() => toggleProductAvailability(product.id)} className={`p-1 rounded transition-colors ${product.availability === 'available' ? 'text-green-500 bg-green-500/10' : 'text-red-500 bg-red-500/10'}`} title="Disponibilidade"><Ban size={14} /></button>
                     </div>
                   </div>
                </div>
              ))}
           </div>
       ) : (
           <div className="bg-[#161618] border border-white/5 rounded-2xl overflow-hidden">
               <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 text-gray-400 font-bold uppercase">
                        <tr><th className="p-4 w-16">Img</th><th className="p-4">Produto</th><th className="p-4">Categoria</th><th className="p-4">Preço</th><th className="p-4 text-center">Status</th><th className="p-4 text-right">Ações</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredProducts.map(product => (
                            <tr key={product.id} className="text-white hover:bg-white/5 transition-colors group">
                                <td className="p-4"><div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5"><img src={product.image} className="w-full h-full object-cover" /></div></td>
                                <td className="p-4"><p className="font-bold">{product.name}</p>{product.inventoryId && <span className="text-[9px] text-gray-500 flex items-center gap-1"><Package size={8}/> Estoque vinculado</span>}</td>
                                <td className="p-4 text-gray-400 capitalize">{tenant.categories.find(c => c.id === product.category)?.name || product.category}</td>
                                <td className="p-4 font-bold text-primary">R$ {product.price.toFixed(2)}</td>
                                <td className="p-4 text-center"><div className="flex items-center justify-center gap-2">{product.availability === 'out_of_stock' ? (<span className="px-2 py-1 rounded bg-red-500/10 text-red-500 text-[9px] font-bold uppercase border border-red-500/20">Esgotado</span>) : (<span className="px-2 py-1 rounded bg-green-500/10 text-green-500 text-[9px] font-bold uppercase border border-green-500/20">Ativo</span>)}{product.isHighlighted && <span className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-500 text-[9px] font-bold uppercase border border-yellow-500/20">Destaque</span>}</div></td>
                                <td className="p-4"><div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity"><button onClick={() => handleDuplicateProduct(product)} className="p-2 bg-gray-700/50 hover:bg-gray-700 rounded text-white" title="Duplicar"><Copy size={12}/></button><button onClick={() => { setEditingProductId(product.id); setProductForm(product); setIsProductModalOpen(true); }} className="p-2 bg-blue-500/50 hover:bg-blue-500 rounded text-white" title="Editar"><Edit2 size={12}/></button><button onClick={() => handleDeleteProduct(product.id)} className="p-2 bg-red-500/50 hover:bg-red-500 rounded text-white" title="Excluir"><Trash2 size={12}/></button></div></td>
                            </tr>
                        ))}
                    </tbody>
               </table>
           </div>
       )}
       {isProductModalOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] backdrop-blur-sm">
             <div className="bg-[#161618] rounded-2xl w-full max-w-2xl border border-white/10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#161618]"><h3 className="text-white font-bold text-lg">{editingProductId ? 'Editar Produto' : 'Novo Produto'}</h3><button onClick={() => setIsProductModalOpen(false)} className="text-gray-500 hover:text-white"><X size={20}/></button></div>
                <div className="flex border-b border-white/10 bg-[#09090B]/50">
                    {[{ id: 'general', label: 'Geral', icon: <FileText size={14} /> }, 
                      { id: 'pricing', label: 'Preço', icon: <DollarSign size={14} /> }, 
                      { id: 'sides', label: 'Acompanhamentos', icon: <Utensils size={14} /> },
                      { id: 'settings', label: 'Configs', icon: <Settings size={14} /> }, 
                      { id: 'media', label: 'Mídia', icon: <Image size={14} /> }
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setProductModalTab(tab.id as ModalTab)} className={`flex-1 py-4 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${productModalTab === tab.id ? 'border-primary text-white bg-white/5' : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>{tab.icon} {tab.label}</button>
                    ))}
                </div>
                <div className="p-8 overflow-y-auto flex-1 bg-[#161618]">
                    <form onSubmit={handleSaveProduct} className="space-y-6">
                        {productModalTab === 'general' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Nome do Produto</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ex: Espeto de Picanha" 
                                        value={productForm.name} 
                                        onChange={e => { setProductForm({...productForm, name: e.target.value}); setErrors({...errors, name: ''}); }} 
                                        className={`w-full bg-[#09090B] border rounded-xl p-4 text-sm text-white focus:outline-none focus:border-primary/50 ${errors.name ? 'border-red-500/50' : 'border-white/10'}`} 
                                    />
                                    {errors.name && <span className="text-red-500 text-[9px] flex items-center gap-1 ml-1"><AlertCircle size={8}/> {errors.name}</span>}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Categoria</label>
                                    <select value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value})} className="w-full bg-[#09090B] border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-primary/50 appearance-none">
                                        {tenant.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Descrição</label>
                                    <textarea placeholder="Ingredientes, modo de preparo, detalhes..." value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})} className="w-full bg-[#09090B] border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-primary/50 h-32 resize-none" />
                                </div>
                            </div>
                        )}
                        {productModalTab === 'pricing' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Preço de Venda (R$)</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">R$</span>
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                placeholder="0.00" 
                                                value={productForm.price} 
                                                onChange={e => { setProductForm({...productForm, price: parseFloat(e.target.value)}); setErrors({...errors, price: ''}); }} 
                                                className={`w-full bg-[#09090B] border rounded-xl p-4 pl-10 text-xl font-bold text-white focus:outline-none focus:border-primary/50 ${errors.price ? 'border-red-500/50' : 'border-white/10'}`} 
                                            />
                                        </div>
                                        {errors.price && <span className="text-red-500 text-[9px] flex items-center gap-1 ml-1"><AlertCircle size={8}/> {errors.price}</span>}
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Tempo de Preparo</label>
                                        <input type="text" placeholder="Ex: 15 Min" value={productForm.prepTime} onChange={e => setProductForm({...productForm, prepTime: e.target.value})} className="w-full bg-[#09090B] border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-primary/50" />
                                    </div>
                                </div>
                                <div className="p-5 rounded-xl border border-white/5 bg-[#09090B]/50"><h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2"><Package size={14} /> Vínculo com Estoque</h4><div className="space-y-3"><select value={productForm.inventoryId || ''} onChange={e => setProductForm({...productForm, inventoryId: e.target.value})} className="w-full bg-[#161618] border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-primary/50"><option value="">Não vincular (Sem baixa automática)</option>{inventory.map(item => (<option key={item.id} value={item.id}>{item.name} ({item.currentQty} {item.unit}) - Custo: R$ {item.costPrice.toFixed(2)}</option>))}</select>{productForm.inventoryId && (<div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center"><div className="text-gray-500 text-xs">Custo Estimado: <span className="text-white font-bold">R$ {inventory.find(i => i.id === productForm.inventoryId)?.costPrice.toFixed(2) || '0.00'}</span></div><div className="text-right"><div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Margem Bruta</div>{(() => { const cost = inventory.find(i => i.id === productForm.inventoryId)?.costPrice || 0; const margin = (productForm.price || 0) - cost; const marginPercent = productForm.price ? (margin / productForm.price) * 100 : 0; return (<div className={`text-lg font-bold ${margin > 0 ? 'text-green-500' : 'text-red-500'}`}>{marginPercent.toFixed(1)}% <span className="text-xs opacity-70">(R$ {margin.toFixed(2)})</span></div>); })()}</div></div>)}</div></div>
                            </div>
                        )}
                        {productModalTab === 'sides' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                                <div className="bg-[#09090B] p-5 rounded-2xl border border-white/5 space-y-4">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                        <Plus size={14}/> Adicionar Novo Acompanhamento
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-gray-500 uppercase ml-1">Nome</label>
                                            <input type="text" placeholder="Ex: Farofa" value={newSide.name} onChange={e => setNewSide({...newSide, name: e.target.value})} className="w-full bg-[#161618] border border-white/10 rounded-lg px-3 py-2 text-xs text-white" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-gray-500 uppercase ml-1">Preço Extra (R$)</label>
                                            <input type="number" step="0.50" placeholder="0.00" value={newSide.price} onChange={e => setNewSide({...newSide, price: parseFloat(e.target.value) || 0})} className="w-full bg-[#161618] border border-white/10 rounded-lg px-3 py-2 text-xs text-white" />
                                        </div>
                                    </div>
                                    <button type="button" onClick={handleAddSide} className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all">
                                        Incluir na Lista
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Itens Cadastrados</h4>
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                        {(productForm.sides || []).length > 0 ? (productForm.sides || []).map((side, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-[#09090B] border border-white/5 group hover:border-white/10 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                        <Utensils size={14}/>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-white uppercase">{side.name}</p>
                                                        <p className="text-[10px] text-primary font-bold">R$ {side.price.toFixed(2)}</p>
                                                    </div>
                                                </div>
                                                <button type="button" onClick={() => handleRemoveSide(idx)} className="p-2 text-gray-600 hover:text-red-500 transition-colors">
                                                    <Trash2 size={14}/>
                                                </button>
                                            </div>
                                        )) : (
                                            <div className="py-8 text-center border-2 border-dashed border-white/5 rounded-2xl opacity-40">
                                                <p className="text-[10px] font-bold uppercase text-gray-500">Nenhum acompanhamento</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        {productModalTab === 'settings' && (<div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300"><label className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-[#09090B] cursor-pointer hover:border-white/10 transition-colors"><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${productForm.isHighlighted ? 'bg-yellow-500/20 text-yellow-500' : 'bg-gray-800 text-gray-500'}`}><Star size={20} fill={productForm.isHighlighted ? "currentColor" : "none"} /></div><div><div className="font-bold text-sm text-white">Produto em Destaque</div><div className="text-[10px] text-gray-500">Aparece no topo do cardápio com uma estrela.</div></div></div><input type="checkbox" checked={productForm.isHighlighted || false} onChange={e => setProductForm({...productForm, isHighlighted: e.target.checked})} className="w-5 h-5 accent-primary" /></label><label className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-[#09090B] cursor-pointer hover:border-white/10 transition-colors"><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${productForm.availability === 'out_of_stock' ? 'bg-red-500/20 text-red-500' : 'bg-gray-800 text-gray-500'}`}><EyeOff size={20} /></div><div><div className="font-bold text-sm text-white">Indisponível (Ocultar)</div><div className="text-[10px] text-gray-500">O produto não aparecerá para os clientes.</div></div></div><input type="checkbox" checked={productForm.availability === 'out_of_stock'} onChange={e => setProductForm({...productForm, availability: e.target.checked ? 'out_of_stock' : 'available'})} className="w-5 h-5 accent-red-500" /></label></div>)}
                        {productModalTab === 'media' && (<div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300"><div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">URL da Imagem</label><input type="text" placeholder="https://..." value={productForm.image} onChange={e => setProductForm({...productForm, image: e.target.value})} className="w-full bg-[#09090B] border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-primary/50" /></div><div className="h-64 rounded-xl border-2 border-dashed border-white/10 bg-[#09090B] flex flex-col items-center justify-center relative overflow-hidden group">{productForm.image ? (<><img src={productForm.image} className="w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity" /><div className="absolute inset-0 flex items-center justify-center"><p className="text-xs font-bold text-white bg-black/50 px-3 py-1 rounded-full">Preview da Imagem</p></div></>) : (<div className="text-center p-6"><Image size={32} className="mx-auto text-gray-600 mb-2" /><p className="text-xs font-bold text-gray-500">Nenhuma imagem definida</p></div>)}</div></div>)}
                        <div className="pt-6 border-t border-white/10 flex gap-3 sticky bottom-0 bg-[#161618] z-20"><button type="button" onClick={() => setIsProductModalOpen(false)} className="flex-1 bg-gray-700/50 hover:bg-gray-700 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors">Cancelar</button><button type="submit" className="flex-1 bg-primary hover:bg-orange-600 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2"><Save size={16} /> Salvar Produto</button></div>
                    </form>
                </div>
             </div>
          </div>
       )}
    </div>
  );
};

export default DashboardMenu;
