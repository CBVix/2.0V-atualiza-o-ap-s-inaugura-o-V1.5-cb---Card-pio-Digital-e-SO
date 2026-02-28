import React, { useState, useEffect, useCallback } from 'react';
import { Page, Product, CartItem, OrderType, UserInfo, Tenant, Order, OrderStatus, InventoryItem, Coupon, PaymentMethod } from './types';
import { DEFAULT_CATEGORIES, DEFAULT_TENANT_SLUG } from './constants';
import Home from './pages/Home';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
import Profile from './pages/Profile';
import Alerts from './pages/Alerts';
import Favourite from './pages/Favourite';
import Dashboard from './pages/Dashboard';
import BottomNav from './components/BottomNav';
import { Utensils, Lock, X, Loader2, ChevronRight, UserPlus, LogIn } from 'lucide-react';
import { supabase } from './supabaseClient';
import { useFavorites } from './hooks/useFavorites';

// ─── Toast simples (substitui todos os alert()) ──────────────────────────────
interface ToastState { msg: string; type: 'success' | 'error' }

const SkeletonLoader = () => (
  <div className="w-full max-w-md mx-auto bg-white min-h-screen p-6 space-y-8 animate-pulse flex flex-col justify-center items-center">
    <div className="w-20 h-20 bg-gray-100 rounded-full mb-4"></div>
    <div className="h-4 w-48 bg-gray-100 rounded-lg"></div>
    <div className="h-2 w-32 bg-gray-100 rounded-lg"></div>
  </div>
);

const App: React.FC = () => {
  const [activePage, setActivePage] = useState<Page>(Page.HOME);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // ✅ CORREÇÃO: storeSlug lido UMA vez, armazenado em estado imutável
  const [storeSlug] = useState<string>(() =>
    new URLSearchParams(window.location.search).get('loja') || DEFAULT_TENANT_SLUG
  );

  const [orderType, setOrderType] = useState<OrderType>(() => {
    return (localStorage.getItem('brutus_order_type') as OrderType) || OrderType.UNSET;
  });

  // ✅ CORREÇÃO: isAdminMode NÃO é mais restaurado do localStorage diretamente.
  // É validado contra a sessão real dentro de fetchInitialData.
  const [isAdminMode, setIsAdminMode] = useState(false);

  const [userInfo, setUserInfo] = useState<UserInfo>(() => {
    const saved = localStorage.getItem('brutus_user_info');
    return saved ? JSON.parse(saved) : { name: '', whatsapp: '', address: '', reference: '', tableNumber: '' };
  });

  const [activeOrderTracking, setActiveOrderTracking] = useState<{id: string, number: string, status: string} | null>(() => {
    const saved = localStorage.getItem('brutus_active_order');
    return saved ? JSON.parse(saved) : null;
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);

  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authTarget, setAuthTarget] = useState<'admin' | 'client'>('client');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // ✅ NOVO: Toast — substitui alert() em todo o app
  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  const foodImages = [
    "https://i.postimg.cc/Y96YJf8h/1.jpg", "https://i.postimg.cc/brqk8DBf/2.jpg", "https://i.postimg.cc/nrT7LFys/3.jpg",
    "https://i.postimg.cc/dQ9G66hM/4.jpg", "https://i.postimg.cc/7YY0Wzzn/5.jpg", "https://i.postimg.cc/4xYtJTwS/6.jpg",
    "https://i.postimg.cc/MpnRW8dX/7.jpg", "https://images.unsplash.com/photo-1558030006-450675393462?q=80&w=400&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1593504049359-74330189a355?q=80&w=400&auto=format&fit=crop"
  ];

  // ─── Persistência de estado no localStorage ────────────────────────────────
  useEffect(() => {
    localStorage.setItem('brutus_order_type', orderType);
  }, [orderType]);

  useEffect(() => {
    localStorage.setItem('brutus_admin_mode', String(isAdminMode));
    if (isAdminMode) setActivePage(Page.DASHBOARD);
  }, [isAdminMode]);

  useEffect(() => {
    localStorage.setItem('brutus_user_info', JSON.stringify(userInfo));
  }, [userInfo]);

  // ─── Carregamento inicial de dados ────────────────────────────────────────
  // useCallback para evitar re-criação desnecessária da função
  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      // ✅ CORREÇÃO: restaura admin mode apenas se houver sessão ativa
      if (currentUser && localStorage.getItem('brutus_admin_mode') === 'true') {
        setIsAdminMode(true);
      }

      const { data: tenantData } = await supabase
        .from('tenants').select('*').eq('slug', storeSlug).maybeSingle();

      if (tenantData) {
        const mappedTenant: Tenant = {
          slug: tenantData.slug || storeSlug,
          name: tenantData.name || '',
          logo: tenantData.logo || '',
          themeColor: tenantData.theme_color || '#f97316',
          whatsapp: tenantData.whatsapp || '',
          address: tenantData.address || '',
          instagram: tenantData.instagram || '',
          pixKey: tenantData.pix_key || '',
          paymentLink: tenantData.payment_link || '',
          deliveryFee: Number(tenantData.delivery_fee || 0),
          deliveryTime: tenantData.delivery_time || '40-50',
          cardMachineFee: Number(tenantData.card_machine_fee || 0),
          operatingHours: tenantData.operating_hours || {},
          holidayClosures: tenantData.holiday_closures || [],
          categories: (tenantData.categories && tenantData.categories.length > 0)
            ? tenantData.categories
            : DEFAULT_CATEGORIES,
          products: []
        };

        const { data: productsData } = await supabase
          .from('products').select('*').eq('tenant_slug', storeSlug);

        mappedTenant.products = (productsData || []).map((p: any) => ({
          id: p.id, name: p.name, price: Number(p.price),
          rating: Number(p.rating || 5), reviews: p.reviews || '0',
          image: p.image, category: p.category, prepTime: p.prep_time,
          description: p.description, isVegan: p.is_vegan, isCombo: p.is_combo,
          isHighlighted: p.is_highlighted, availability: p.availability,
          inventoryId: p.inventory_id, sides: p.sides || [], stock: p.stock || 0
        }));

        setCurrentTenant(mappedTenant);
        document.documentElement.style.setProperty('--primary-color', mappedTenant.themeColor);
      }

      // Pedidos: admin vê todos, cliente vê apenas os seus
      const ordersQuery = supabase
        .from('orders').select('*')
        .eq('tenant_slug', storeSlug)
        .order('created_at', { ascending: false });

      const isAdmin = localStorage.getItem('brutus_admin_mode') === 'true';
      if (!isAdmin && currentUser) ordersQuery.eq('user_id', currentUser.id);

      const { data: ordersData } = await ordersQuery;
      if (ordersData) {
        setOrders(ordersData.map((o: any) => ({
          id: o.id, orderNumber: o.order_number,
          customerName: o.customer_name, customerWhatsapp: o.customer_whatsapp,
          items: o.items, total: Number(o.total),
          type: o.type as OrderType, status: o.status as OrderStatus,
          createdAt: new Date(o.created_at), tableNumber: o.table_number,
          address: o.address, userId: o.user_id,
          paymentMethod: o.payment_method as PaymentMethod
        })));
      }

      const { data: inventoryData } = await supabase
        .from('inventory').select('*').eq('tenant_slug', storeSlug);
      if (inventoryData) {
        setInventory(inventoryData.map((i: any) => ({
          id: i.id, name: i.name, currentQty: i.current_qty,
          minQty: i.min_qty, unit: i.unit, category: i.category,
          costPrice: i.cost_price
        })));
      }

      const { data: couponsData } = await supabase
        .from('coupons').select('*').eq('tenant_slug', storeSlug);
      if (couponsData) {
        setCoupons(couponsData.map((c: any) => ({
          id: c.id, code: c.code, discountValue: c.discount_value,
          maxUses: c.max_uses, currentUses: c.current_uses,
          isActive: c.is_active, userId: c.user_id
        })));
      }
    } catch (err: any) {
      console.error("Fetch Error:", err.message);
    } finally {
      setLoading(false);
    }
  }, [storeSlug]); // ✅ storeSlug é estável — fetchInitialData não muda

  // ─── Setup inicial + Realtime + Auth listener ─────────────────────────────
  useEffect(() => {
    fetchInitialData();

    // ✅ CORREÇÃO: listener de autenticação — detecta expiração de token,
    // logout em outra aba, e login/signup completados
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (event === 'SIGNED_OUT') {
          setIsAdminMode(false);
          setActivePage(Page.HOME);
          localStorage.removeItem('brutus_admin_mode');
        }
      }
    );

    // ✅ CORREÇÃO: storeSlug vem do estado — sem re-parse de window.location
    const tenantChannel = supabase.channel(`tenant_updates_${storeSlug}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'tenants',
        filter: `slug=eq.${storeSlug}`
      }, () => fetchInitialData())
      .subscribe();

    const productsChannel = supabase.channel(`products_updates_${storeSlug}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'products',
        filter: `tenant_slug=eq.${storeSlug}`
      }, () => fetchInitialData())
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(tenantChannel);
      supabase.removeChannel(productsChannel);
    };
  }, [fetchInitialData, storeSlug]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleSelectOrderType = (type: OrderType) => setOrderType(type);
  const handleUpdateInventory = (newInventory: InventoryItem[]) => setInventory(newInventory);

  const handleSaveInventoryItem = async (item: InventoryItem) => {
    if (!currentTenant) return;
    try {
      // ✅ CORREÇÃO: detecta item novo por prefixo OU ausência de UUID válido
      const isNew = !item.id
        || item.id.startsWith('inv-')
        || item.id.startsWith('new-');

      const dbItem = {
        name: item.name,
        current_qty: item.currentQty,
        min_qty: item.minQty,
        unit: item.unit,
        category: item.category,
        cost_price: item.costPrice,
        tenant_slug: currentTenant.slug
      };

      if (isNew) {
        // INSERT — banco gera o UUID
        const { error } = await supabase.from('inventory').insert([dbItem]);
        if (error) throw error;
      } else {
        // UPDATE — id passado no .eq(), não no payload
        const { error } = await supabase
          .from('inventory').update(dbItem).eq('id', item.id);
        if (error) throw error;
      }

      await fetchInitialData();
    } catch (err: any) {
      console.error("Erro ao salvar item de estoque:", err);
      showToast("Erro ao salvar item de estoque: " + err.message, 'error');
    }
  };

  const handleDeleteInventoryItem = async (id: string) => {
    // Item ainda não salvo no banco — remove apenas do estado local
    if (id.startsWith('inv-') || id.startsWith('new-')) {
      setInventory(prev => prev.filter(i => i.id !== id));
      return;
    }
    try {
      const { error } = await supabase.from('inventory').delete().eq('id', id);
      if (error) throw error;
      await fetchInitialData();
    } catch (err: any) {
      console.error("Erro ao excluir item de estoque:", err);
      showToast("Erro ao excluir item de estoque: " + err.message, 'error');
    }
  };

  const handlePlaceOrder = async (coupon?: Coupon, paymentMethod?: PaymentMethod) => {
    if (!currentTenant || cart.length === 0) return;

    const subtotal = cart.reduce((acc, item) => {
      const sidePrices = (item.selectedSides || []).reduce((sAcc, s) => sAcc + s.price, 0);
      return acc + (item.price + sidePrices) * item.quantity;
    }, 0);

    const deliveryFee = orderType === OrderType.DELIVERY ? currentTenant.deliveryFee : 0;
    const discountValue = coupon ? coupon.discountValue : 0;
    const totalValue = Math.max(0, subtotal + deliveryFee - discountValue);

    // ✅ CORREÇÃO: usa currentTenant.slug em vez de string hardcoded
    const orderData = {
      tenant_slug: currentTenant.slug,
      customer_name: userInfo.name,
      customer_whatsapp: userInfo.whatsapp,
      items: cart,
      total: totalValue,
      type: orderType,
      status: 'pending' as OrderStatus,
      table_number: userInfo.tableNumber,
      address: userInfo.address,
      user_id: user?.id || null,
      coupon_code: coupon?.code || null,
      discount_applied: discountValue,
      payment_method: paymentMethod || null // ✅ salva o método real
    };

    try {
      const { error } = await supabase.from('orders').insert([orderData]);
      if (error) throw error;

      // Baixa automática de estoque
      for (const item of cart) {
        const { data: product } = await supabase
          .from('products')
          .select('stock, availability, inventory_id')
          .eq('id', item.id).single();

        if (product) {
          const newStock = Math.max(0, (product.stock || 0) - item.quantity);
          let newAvailability = product.availability;

          if (product.inventory_id && newStock <= 0) {
            newAvailability = 'out_of_stock';
          } else if (!product.inventory_id) {
            newAvailability = 'available';
          }

          await supabase.from('products').update({
            stock: newStock,
            availability: newAvailability
          }).eq('id', item.id);
        }
      }

      // Gestão de clientes
      // ✅ CORREÇÃO: usa currentTenant.slug em vez de string hardcoded
      const customerPhone = userInfo.whatsapp.replace(/\D/g, '');
      const { data: existingCustomer } = await supabase
        .from('customers').select('*')
        .eq('whatsapp', customerPhone)
        .eq('tenant_slug', currentTenant.slug)
        .maybeSingle();

      if (existingCustomer) {
        await supabase.from('customers').update({
          total_orders: (existingCustomer.total_orders || 0) + 1,
          total_spent: (parseFloat(existingCustomer.total_spent) || 0) + totalValue,
          last_order_date: new Date().toISOString(),
          name: userInfo.name,
          address: userInfo.address
        }).eq('id', existingCustomer.id);
      } else {
        await supabase.from('customers').insert([{
          tenant_slug: currentTenant.slug, // ✅
          name: userInfo.name,
          whatsapp: customerPhone,
          address: userInfo.address,
          total_orders: 1,
          total_spent: totalValue,
          last_order_date: new Date().toISOString()
        }]);
      }

      if (coupon) {
        await supabase.from('coupons')
          .update({ current_uses: (coupon.currentUses || 0) + 1 })
          .eq('id', coupon.id);
      }

      // ✅ CORREÇÃO: não chama fetchInitialData() — apenas limpa o carrinho.
      // O canal Realtime do KDS já atualizará os pedidos automaticamente.
      setCart([]);
      setActivePage(Page.HOME);
      showToast("Pedido enviado com sucesso! 🔥");

    } catch (err: any) {
      console.error("Erro ao criar pedido:", err);
      showToast("Erro ao realizar pedido. Verifique sua conexão.", 'error');
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail, password: authPassword
        });
        if (error) throw error;
        if (data.user) {
          setUser(data.user);
          setShowAuthModal(false);
          if (authTarget === 'admin') {
            setIsAdminMode(true);
            setActivePage(Page.DASHBOARD);
          }
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: { data: { full_name: authName } }
        });
        if (error) throw error;
        showToast("Cadastro realizado! Verifique seu e-mail.");
        setAuthMode('login');
      }
    } catch (err: any) {
      showToast(`Erro: ${err.message}`, 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading && !currentTenant) return <SkeletonLoader />;
  if (!currentTenant) return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">
      Erro ao carregar loja.
    </div>
  );

  return (
    <div className={`w-full ${isAdminMode ? '' : 'max-w-md mx-auto'} h-screen relative flex flex-col transition-all duration-500 ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-white'}`}>

      {/* ✅ Toast — substitui todos os alert() */}
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-full text-white text-sm font-bold shadow-2xl transition-all animate-in slide-in-from-bottom-4
          ${toast.type === 'success' ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-red-500 shadow-red-500/30'}`}>
          {toast.msg}
        </div>
      )}

      {/* Modal de autenticação */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative w-full max-w-sm rounded-[40px] overflow-hidden bg-white shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-10 transform transition-all animate-in zoom-in-95">
            <button onClick={() => setShowAuthModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 transition-colors"><X size={24} /></button>
            <div className="text-center mb-8">
              <h2 className="text-[28px] font-black uppercase text-[#0F172A] tracking-tighter leading-none mb-2">
                {authTarget === 'admin' && authMode === 'login' ? 'Dashboard' : (authMode === 'login' ? 'Entrar' : 'Cadastrar')}
              </h2>
              <div className="w-12 h-1 bg-primary mx-auto rounded-full" />
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'signup' && (
                <input type="text" required value={authName} onChange={e => setAuthName(e.target.value)} placeholder="Nome Completo" className="w-full h-14 px-6 rounded-2xl border-none bg-gray-50 text-gray-900 placeholder-gray-400 font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-inner" />
              )}
              <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="E-mail" className="w-full h-14 px-6 rounded-2xl border-none bg-gray-50 text-gray-900 placeholder-gray-400 font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-inner" />
              <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Senha" className="w-full h-14 px-6 rounded-2xl border-none bg-gray-50 text-gray-900 placeholder-gray-400 font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-inner" />
              <button disabled={authLoading} className="w-full h-16 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 shadow-xl shadow-primary/20 active:scale-95 transition-all mt-6">
                {authLoading ? <Loader2 size={20} className="animate-spin" /> : (authMode === 'login' ? 'ENTRAR' : 'CADASTRAR')}
              </button>
            </form>
            <div className="mt-8 text-center">
              <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-primary transition-colors">
                {authMode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça Login'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tela de boas-vindas / seleção de modalidade */}
      {!isAdminMode && orderType === OrderType.UNSET && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden animate-in fade-in duration-700">
          <div className="absolute inset-0 grid grid-cols-3 gap-1 opacity-60">
            {foodImages.map((src, idx) => (
              <div key={idx} className="h-full w-full overflow-hidden">
                <img src={src} className="h-full w-full object-cover grayscale-[20%]" />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
          <div className="relative h-full flex flex-col items-center justify-between py-20 px-8 text-center">

            <div className="absolute top-8 left-8 right-8 flex justify-between items-center">
              <button onClick={() => { setAuthTarget('admin'); setAuthMode('login'); setShowAuthModal(true); }} className="text-white opacity-20 hover:opacity-50 transition-opacity p-2 rounded-full active:scale-90">
                <Lock size={20} />
              </button>
              <div className="flex gap-2">
                <button onClick={() => { setAuthTarget('client'); setAuthMode('signup'); setShowAuthModal(true); }} className="bg-white/5 hover:bg-white/10 px-6 py-2.5 rounded-full text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border border-white/10 active:scale-95 transition-all backdrop-blur-md">
                  <UserPlus size={14} className="opacity-80" />
                  <span>CADASTRAR</span>
                </button>
                <button onClick={() => { setAuthTarget('client'); setAuthMode('login'); setShowAuthModal(true); }} className="bg-[#1A1A1A] hover:bg-[#252525] px-6 py-2.5 rounded-full text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-white/5 shadow-2xl active:scale-95 transition-all">
                  <LogIn size={14} className="opacity-80" />
                  <span>ENTRAR</span>
                </button>
              </div>
            </div>

            <div className="mt-auto mb-10 space-y-6">
              <h1 className="font-display font-black text-4xl text-white uppercase tracking-[0.15em] drop-shadow-2xl">
                Churras<br /><span className="text-primary">Brutus</span>
              </h1>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">O melhor churrasco!</h2>
            </div>

            <div className="w-full space-y-4 max-w-[280px]">
              <button onClick={() => handleSelectOrderType(OrderType.LOCAL)} className="w-full h-14 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-full font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all hover:bg-white/20">
                <Utensils size={16} /> Estou no Local
              </button>
              <button onClick={() => handleSelectOrderType(OrderType.DELIVERY)} className="w-full h-14 bg-primary text-white rounded-full font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-xl shadow-primary/30 transition-all hover:bg-orange-600">
                Pedir Delivery <ChevronRight size={16} />
              </button>
              <button onClick={() => { setAuthTarget('client'); setAuthMode('signup'); setShowAuthModal(true); }} className="text-white/40 text-[9px] font-black uppercase tracking-[0.3em] mt-4 hover:text-white transition-colors">
                Ainda não tem conta? Clique aqui
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo principal */}
      {(orderType !== OrderType.UNSET || isAdminMode) && (
        <main className="flex-1 overflow-y-auto hide-scrollbar">
          {activePage === Page.HOME && (
            <Home
              onSelectProduct={(p) => { setSelectedProduct(p); setActivePage(Page.DETAILS); }}
              tenant={currentTenant} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode}
              coupons={coupons} user={user} orderType={orderType}
              onOpenAuth={() => { setAuthTarget('client'); setAuthMode('login'); setShowAuthModal(true); }}
              onGoToAlerts={() => setActivePage(Page.ALERTS)}
            />
          )}
          {activePage === Page.DETAILS && selectedProduct && (
            <ProductDetails
              isDarkMode={isDarkMode} product={selectedProduct}
              onBack={() => setActivePage(Page.HOME)}
              onAddToCart={(p, q, ex, obs, don, sides) => {
                setCart([...cart, { ...p, quantity: q, extras: ex, itemObservation: obs, doneness: don, selectedSides: sides }]);
                setActivePage(Page.CART);
              }}
              isFavorite={isFavorite(selectedProduct.id)}
              toggleFavorite={() => toggleFavorite(selectedProduct.id)}
            />
          )}
          {activePage === Page.CART && (
            <Cart
              isDarkMode={isDarkMode} items={cart} orderType={orderType}
              userInfo={userInfo} setUserInfo={setUserInfo}
              onUpdateQuantity={(id, d) => setCart(prev =>
                prev.map(i => i.id === id ? { ...i, quantity: Math.max(0, i.quantity + d) } : i)
                  .filter(i => i.quantity > 0)
              )}
              onBack={() => setActivePage(Page.HOME)}
              tenant={currentTenant}
              onSelectProduct={(p) => { setSelectedProduct(p); setActivePage(Page.DETAILS); }}
              onCheckout={handlePlaceOrder}
              coupons={coupons} user={user}
            />
          )}
          {activePage === Page.ALERTS && (
            <Alerts isDarkMode={isDarkMode} orderType={orderType} onBack={() => setActivePage(Page.HOME)} />
          )}
          {activePage === Page.FAVOURITE && (
            <Favourite
              isDarkMode={isDarkMode} tenant={currentTenant}
              favorites={favorites} toggleFavorite={toggleFavorite}
              onSelectProduct={(p) => { setSelectedProduct(p); setActivePage(Page.DETAILS); }}
              onBack={() => setActivePage(Page.HOME)}
            />
          )}
          {activePage === Page.PROFILE && (
            <Profile
              isDarkMode={isDarkMode} orderType={orderType} setOrderType={setOrderType}
              tenant={currentTenant} orders={orders}
              userInfo={userInfo} setUserInfo={setUserInfo} user={user}
            />
          )}
          {activePage === Page.DASHBOARD && (
            <Dashboard
              tenant={currentTenant} orders={orders} setOrders={setOrders}
              inventory={inventory} coupons={coupons}
              updateOrderStatus={async (id, s) => {
                await supabase.from('orders').update({ status: s }).eq('id', id);
              }}
              onUpdateInventory={handleUpdateInventory}
              onSaveInventoryItem={handleSaveInventoryItem}
              onDeleteInventoryItem={handleDeleteInventoryItem}
              onSaveCoupon={async (c) => { await supabase.from('coupons').upsert(c); fetchInitialData(); }}
              onDeleteCoupon={async (id) => { await supabase.from('coupons').delete().eq('id', id); fetchInitialData(); }}
              onBack={() => { setIsAdminMode(false); setOrderType(OrderType.UNSET); setActivePage(Page.HOME); }}
              onUpdateTenant={setCurrentTenant}
              startDate={startDate} setStartDate={setStartDate}
              endDate={endDate} setEndDate={setEndDate}
            />
          )}
        </main>
      )}

      {!isAdminMode && activePage !== Page.DETAILS && orderType !== OrderType.UNSET && (
        <BottomNav
          activeTab={activePage}
          onTabChange={(page) => {
            if (page === Page.PROFILE && !user && !activeOrderTracking) {
              setAuthTarget('client'); setAuthMode('login'); setShowAuthModal(true);
            } else {
              setActivePage(page);
            }
          }}
          cartCount={cart.reduce((acc, item) => acc + item.quantity, 0)}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
};

export default App;