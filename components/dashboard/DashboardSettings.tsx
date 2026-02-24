
import React, { useState, useRef, useEffect } from 'react';
import { Store, Upload, MapPin, Wallet, Printer, Check, Copy, Loader2, AlertCircle, Download, Clock, Calendar, X, Plus, Save, ShieldCheck, Lock, Share2, Link as LinkIcon } from 'lucide-react';
import { Tenant, PrinterSettings, BusinessHours } from '../../types';
import { supabase } from '../../supabaseClient';

const DAYS_MAP: Record<string, string> = {
  '0': 'Domingo',
  '1': 'Segunda',
  '2': 'Terça',
  '3': 'Quarta',
  '4': 'Quinta',
  '5': 'Sexta',
  '6': 'Sábado'
};

const DEFAULT_HOURS: BusinessHours = { open: '18:00', close: '23:00', isOpen: true };

interface DashboardSettingsProps {
  tenant: Tenant;
  onUpdateTenant: (tenant: Tenant) => void;
}

const DashboardSettings: React.FC<DashboardSettingsProps> = ({ tenant, onUpdateTenant }) => {
  const [settingsForm, setSettingsForm] = useState<Tenant>(tenant);
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>({ printerWidth: 80, autoPrint: false, headerText: '', footerText: '' });
  const [copiedLink, setCopiedLink] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Security States
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // States for Holiday Logic
  const [newHolidayDate, setNewHolidayDate] = useState('');

  const qrcodeContainerRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const baseHours = tenant.operatingHours || {};
    const normalizedHours: Record<string, BusinessHours> = {};
    Object.keys(DAYS_MAP).forEach(key => {
        normalizedHours[key] = baseHours[key] || { ...DEFAULT_HOURS };
    });

    setSettingsForm({
        ...tenant,
        operatingHours: normalizedHours,
        deliveryTime: tenant.deliveryTime || "40-50"
    });
    
    fetchPrinterSettings();
  }, [tenant]);

  useEffect(() => {
    if (qrcodeContainerRef.current) {
      qrcodeContainerRef.current.innerHTML = '';
      const storeUrl = `${window.location.origin}${window.location.pathname}?loja=${tenant.slug}`;
      // @ts-ignore
      if (window.QRCode) {
        // @ts-ignore
        new window.QRCode(qrcodeContainerRef.current, {
          text: storeUrl,
          width: 140,
          height: 140,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: 1 
        });
      }
    }
  }, [tenant.slug]);

  const fetchPrinterSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('printer_settings')
        .select('*')
        .eq('tenant_slug', tenant.slug)
        .maybeSingle();
      
      if (error) throw error;
      if (data) {
        setPrinterSettings({
           printerWidth: data.paper_width || 80,
           autoPrint: data.auto_print || false,
           ipAddress: data.printer_name || '',
           headerText: data.header_text || '',
           footerText: data.footer_text || ''
        });
      } else {
        setPrinterSettings({ printerWidth: 80, autoPrint: false, headerText: '', footerText: '' });
      }
    } catch (err) {
      setPrinterSettings({ printerWidth: 80, autoPrint: false, headerText: '', footerText: '' });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!settingsForm.name?.trim()) newErrors.name = "Nome da loja é obrigatório";
    if (!settingsForm.address?.trim()) newErrors.address = "Endereço é obrigatório";
    const phoneRegex = /^[0-9]{10,13}$/;
    if (!settingsForm.whatsapp.replace(/\D/g, '').match(phoneRegex)) {
        newErrors.whatsapp = "Digite apenas números (DDD + Número)";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadImageToStorage = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${tenant.slug}-logo-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;
      const { error: uploadError } = await supabase.storage.from('images').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('images').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error) {
      alert('Erro no upload. Verifique as permissões de storage.');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const publicUrl = await uploadImageToStorage(file);
      if (publicUrl) setSettingsForm({ ...settingsForm, logo: publicUrl });
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
        alert("A senha deve ter no mínimo 6 caracteres.");
        return;
    }
    setIsUpdatingPassword(true);
    try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        alert("Senha atualizada com sucesso!");
        setNewPassword('');
    } catch (err: any) {
        alert("Erro ao atualizar senha: " + err.message);
    } finally {
        setIsUpdatingPassword(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!validateForm()) return;
    setIsSavingAll(true);
    try {
        await supabase.from('tenants').upsert({
           slug: tenant.slug,
           name: settingsForm.name,
           logo: settingsForm.logo,
           whatsapp: (settingsForm.whatsapp || '').replace(/\D/g, ''),
           address: settingsForm.address,
           instagram: settingsForm.instagram,
           pix_key: settingsForm.pixKey,
           payment_link: settingsForm.paymentLink,
           delivery_fee: settingsForm.deliveryFee,
           delivery_time: settingsForm.deliveryTime,
           card_machine_fee: settingsForm.cardMachineFee,
           operating_hours: settingsForm.operatingHours,
           holiday_closures: settingsForm.holidayClosures
        });

        await supabase.from('printer_settings').upsert({
           tenant_slug: tenant.slug,
           paper_width: printerSettings.printerWidth,
           auto_print: printerSettings.autoPrint,
           printer_name: printerSettings.ipAddress || null,
           header_text: printerSettings.headerText || null,
           footer_text: printerSettings.footerText || null
        }, { onConflict: 'tenant_slug' });

        onUpdateTenant(settingsForm);
        alert('Configurações salvas!');
    } catch (err: any) {
        alert("Erro ao salvar: " + err.message);
    } finally {
        setIsSavingAll(false);
    }
  };

  const handleCopyMenuLink = () => {
    const menuUrl = `${window.location.origin}${window.location.pathname}?loja=${tenant.slug}`;
    navigator.clipboard.writeText(menuUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handlePrintQRCode = () => {
    const qrImage = qrcodeContainerRef.current?.querySelector('img')?.src;
    const canvas = qrcodeContainerRef.current?.querySelector('canvas');
    const finalImage = qrImage || (canvas ? canvas.toDataURL("image/png") : null);

    if (!finalImage) {
        alert("Erro ao gerar imagem do QR Code para impressão.");
        return;
    }

    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code - ${tenant.name}</title>
          <style>
            @page { margin: 0; }
            body { 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0; 
              font-family: 'Inter', sans-serif;
              text-align: center;
              color: #000;
              padding: 20px;
            }
            .container {
              border: 4px solid #000;
              padding: 40px;
              border-radius: 40px;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            img { width: 350px; height: 350px; margin: 30px 0; }
            h1 { font-size: 32px; font-weight: 900; text-transform: uppercase; margin: 0; letter-spacing: -1px; }
            p { font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: #444; margin-top: 10px; }
            .url { font-size: 10px; color: #888; margin-top: 20px; font-family: monospace; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${tenant.name}</h1>
            <p>Acesse nosso cardápio</p>
            <img src="${finalImage}" />
            <div class="url">${window.location.origin}${window.location.pathname}?loja=${tenant.slug}</div>
          </div>
          <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 1000); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDayToggle = (day: string) => {
      setSettingsForm(prev => {
          const currentHours = prev.operatingHours?.[day] || { ...DEFAULT_HOURS };
          return {
              ...prev,
              operatingHours: { ...(prev.operatingHours || {}), [day]: { ...currentHours, isOpen: !currentHours.isOpen } }
          };
      });
  };

  const handleTimeChange = (day: string, field: 'open' | 'close', value: string) => {
      setSettingsForm(prev => {
          const currentHours = prev.operatingHours?.[day] || { ...DEFAULT_HOURS };
          return {
              ...prev,
              operatingHours: { ...(prev.operatingHours || {}), [day]: { ...currentHours, [field]: value } }
          };
      });
  };

  const addHoliday = () => {
      if (!newHolidayDate) return;
      const currentHolidays = settingsForm.holidayClosures || [];
      if (!currentHolidays.includes(newHolidayDate)) {
          setSettingsForm({ ...settingsForm, holidayClosures: [...currentHolidays, newHolidayDate].sort() });
      }
      setNewHolidayDate('');
  };

  const removeHoliday = (date: string) => {
      setSettingsForm({ ...settingsForm, holidayClosures: (settingsForm.holidayClosures || []).filter(d => d !== date) });
  };

  return (
    <div className="space-y-8 pb-10">
       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           {/* LEFT COLUMN */}
           <div className="space-y-6">
              <div className="bg-[#161618] border border-white/5 rounded-2xl p-6">
                 <h3 className="text-white font-bold mb-4 flex items-center gap-2 uppercase tracking-widest text-xs"><Store size={14} className="text-primary"/> Identidade da Loja</h3>
                 <div className="space-y-4">
                    <div className="flex items-center gap-4">
                       <div className="w-20 h-20 bg-black/50 rounded-xl border border-white/10 flex items-center justify-center overflow-hidden relative group">
                          <img src={settingsForm.logo} className={`w-full h-full object-cover transition-opacity ${isUploading ? 'opacity-30' : 'opacity-100'}`} />
                          {isUploading ? <div className="absolute inset-0 flex items-center justify-center"><Loader2 size={24} className="text-primary animate-spin" /></div> : <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"><Upload size={20} className="text-white" /><input type="file" ref={logoInputRef} onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" /></div>}
                       </div>
                       <div className="flex-1 space-y-2">
                          <input type="text" value={settingsForm.name} onChange={e => { setSettingsForm({...settingsForm, name: e.target.value}); setErrors({...errors, name: ''}); }} className={`w-full bg-[#09090B] border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 ${errors.name ? 'border-red-500/50' : 'border-white/10'}`} placeholder="Nome da Loja" />
                          <input type="text" value={settingsForm.slug} disabled className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-500 cursor-not-allowed" />
                       </div>
                    </div>
                 </div>
              </div>

              <div className="bg-[#161618] border border-white/5 rounded-2xl p-6">
                 <h3 className="text-white font-bold mb-4 flex items-center gap-2 uppercase tracking-widest text-xs"><MapPin size={14} className="text-primary"/> Endereço & Contato</h3>
                 <div className="space-y-3">
                    <input type="text" value={settingsForm.address} onChange={e => setSettingsForm({...settingsForm, address: e.target.value})} className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none" placeholder="Endereço" />
                    <div className="grid grid-cols-2 gap-3">
                       <input type="text" value={settingsForm.whatsapp} onChange={e => setSettingsForm({...settingsForm, whatsapp: e.target.value})} className="bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white" placeholder="WhatsApp" />
                       <input type="text" value={settingsForm.instagram} onChange={e => setSettingsForm({...settingsForm, instagram: e.target.value})} className="bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white" placeholder="@instagram" />
                    </div>
                 </div>
              </div>

              {/* SEÇÃO DE SEGURANÇA / TROCA DE SENHA */}
              <div className="bg-[#161618] border border-white/5 rounded-2xl p-6">
                 <h3 className="text-white font-bold mb-4 flex items-center gap-2 uppercase tracking-widest text-xs"><ShieldCheck size={14} className="text-primary"/> Segurança Admin</h3>
                 <div className="space-y-4">
                    <p className="text-[10px] text-gray-500 uppercase font-bold">Trocar Senha de Acesso</p>
                    <div className="flex gap-2">
                       <div className="relative flex-1">
                          <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                          <input 
                            type="password" 
                            value={newPassword} 
                            onChange={e => setNewPassword(e.target.value)} 
                            className="w-full bg-[#09090B] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-primary/50" 
                            placeholder="Nova senha admin" 
                          />
                       </div>
                       <button 
                         onClick={handleUpdatePassword}
                         disabled={isUpdatingPassword || !newPassword}
                         className="bg-primary/10 text-primary border border-primary/20 px-4 py-2 rounded-lg text-xs font-bold uppercase hover:bg-primary/20 transition-all disabled:opacity-30"
                       >
                          {isUpdatingPassword ? <Loader2 size={14} className="animate-spin" /> : 'Atualizar'}
                       </button>
                    </div>
                 </div>
              </div>
           </div>

           {/* RIGHT COLUMN */}
           <div className="space-y-6">
              <div className="bg-[#161618] border border-white/5 rounded-2xl p-6">
                 <h3 className="text-white font-bold mb-4 flex items-center gap-2 uppercase tracking-widest text-xs"><Wallet size={14} className="text-primary"/> Logística & Financeiro</h3>
                 <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Tempo de Entrega (Min)</label>
                          <input type="text" placeholder="Ex: 40-50" value={settingsForm.deliveryTime || ''} onChange={e => setSettingsForm({...settingsForm, deliveryTime: e.target.value})} className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white" />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Taxa Entrega (R$)</label>
                          <input type="number" value={settingsForm.deliveryFee} onChange={e => setSettingsForm({...settingsForm, deliveryFee: parseFloat(e.target.value)})} className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white" />
                       </div>
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-gray-500 uppercase">Chave Pix</label>
                       <input type="text" value={settingsForm.pixKey} onChange={e => setSettingsForm({...settingsForm, pixKey: e.target.value})} className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-gray-500 uppercase">Link de Pagamento (Cartão)</label>
                       <div className="relative">
                          <LinkIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                          <input type="text" placeholder="https://mercado-pago.com/..." value={settingsForm.paymentLink || ''} onChange={e => setSettingsForm({...settingsForm, paymentLink: e.target.value})} className="w-full bg-[#09090B] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white" />
                       </div>
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-gray-500 uppercase">Taxa Maquininha (%)</label>
                       <input type="number" value={settingsForm.cardMachineFee} onChange={e => setSettingsForm({...settingsForm, cardMachineFee: parseFloat(e.target.value)})} className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white" />
                    </div>
                 </div>
              </div>

              {/* CARD DE COMPARTILHAMENTO / QR CODE */}
              <div className="bg-[#161618] border border-white/5 rounded-3xl p-6 flex flex-col sm:flex-row gap-6 items-center shadow-2xl relative overflow-hidden">
                 <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
                 
                 <div className="flex-shrink-0 group relative">
                    <div className="p-4 bg-white rounded-3xl shadow-xl transition-transform group-hover:scale-105 duration-500" ref={qrcodeContainerRef} />
                    <button 
                      onClick={handlePrintQRCode}
                      className="absolute -top-3 -right-3 bg-primary text-white p-3 rounded-2xl shadow-2xl hover:bg-orange-600 transition-all active:scale-90 z-10"
                      title="Imprimir QR Code"
                    >
                      <Printer size={20} />
                    </button>
                 </div>

                 <div className="flex-1 w-full space-y-4 relative z-10 text-center sm:text-left">
                    <div>
                       <h4 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 mb-1">Menu Digital Ativo</h4>
                       <p className="text-sm font-bold text-white mb-4">Link do Cardápio</p>
                    </div>
                    
                    <div className="space-y-3">
                        <button 
                          onClick={handleCopyMenuLink} 
                          className="w-full h-12 bg-white/5 hover:bg-white/10 text-primary border border-primary/30 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-95"
                        >
                           {copiedLink ? <Check size={16} /> : <Copy size={16}/>} 
                           {copiedLink ? 'Link Copiado!' : 'Copiar Link'}
                        </button>
                        
                        <div className="flex gap-2">
                           <button 
                             onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Acesse nosso cardápio: ${window.location.origin}${window.location.pathname}?loja=${tenant.slug}`)}`, '_blank')}
                             className="flex-1 h-12 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                           >
                             <Share2 size={14} /> WhatsApp
                           </button>
                           <button 
                             onClick={handlePrintQRCode}
                             className="flex-1 h-12 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                           >
                             <Printer size={14} /> Imprimir QR
                           </button>
                        </div>
                    </div>
                 </div>
              </div>
           </div>
       </div>

       <div className="bg-[#161618] border border-white/5 rounded-2xl p-6">
           <h3 className="text-white font-bold mb-6 flex items-center gap-2 uppercase tracking-widest text-xs"><Clock size={14} className="text-primary"/> Horários e Funcionamento</h3>
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className="lg:col-span-2 space-y-2">
                   {Object.entries(DAYS_MAP).map(([key, label]) => {
                       const hours = settingsForm.operatingHours?.[key] || { ...DEFAULT_HOURS };
                       return (
                           <div key={key} className={`grid grid-cols-4 gap-2 items-center p-2 rounded-lg border transition-all ${hours.isOpen ? 'bg-[#09090B] border-white/5' : 'bg-red-500/5 border-red-500/10 opacity-60'}`}>
                               <span className="text-xs font-bold text-white">{label}</span>
                               <input type="time" value={hours.open} onChange={(e) => handleTimeChange(key, 'open', e.target.value)} disabled={!hours.isOpen} className="bg-[#161618] border border-white/10 rounded px-2 py-1 text-xs text-white text-center" />
                               <input type="time" value={hours.close} onChange={(e) => handleTimeChange(key, 'close', e.target.value)} disabled={!hours.isOpen} className="bg-[#161618] border border-white/10 rounded px-2 py-1 text-xs text-white text-center" />
                               <div className="flex justify-center"><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={hours.isOpen} onChange={() => handleDayToggle(key)} className="sr-only peer" /><div className="w-8 h-4 bg-gray-700 rounded-full peer peer-checked:bg-green-500"></div></label></div>
                           </div>
                       );
                   })}
               </div>
               <div className="bg-[#09090B] border border-white/5 rounded-xl p-4">
                   <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2"><Calendar size={14} className="text-gray-400" /> Fechar em Datas</h4>
                   <div className="flex gap-2 mb-4"><input type="date" value={newHolidayDate} onChange={(e) => setNewHolidayDate(e.target.value)} className="flex-1 bg-[#161618] border border-white/10 rounded-lg px-3 py-2 text-xs text-white" /><button onClick={addHoliday} className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg"><Plus size={16} /></button></div>
                   <div className="space-y-2 max-h-[200px] overflow-y-auto">{(settingsForm.holidayClosures || []).map(date => (<div key={date} className="flex justify-between items-center bg-[#161618] border border-white/5 p-2 rounded-lg"><span className="text-xs text-gray-300">{new Date(date).toLocaleDateString('pt-BR')}</span><button onClick={() => removeHoliday(date)} className="text-gray-500 hover:text-red-500"><X size={14} /></button></div>))}</div>
               </div>
           </div>
       </div>

       <button onClick={handleSaveSettings} disabled={isSavingAll} className="w-full bg-primary hover:bg-orange-600 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2">
          {isSavingAll ? <Loader2 size={18} className="animate-spin" /> : <Save size={18}/>}
          {isSavingAll ? 'Salvando...' : 'Salvar Todas Alterações'}
       </button>
    </div>
  );
};

export default DashboardSettings;
