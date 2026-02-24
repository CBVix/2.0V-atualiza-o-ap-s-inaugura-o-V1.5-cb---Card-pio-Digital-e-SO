
import React from 'react';
import { Page } from '../types';
import { Home, Bell, Heart, ShoppingCart, User } from 'lucide-react';

interface BottomNavProps {
  activeTab: Page;
  onTabChange: (page: Page) => void;
  cartCount: number;
  isDarkMode?: boolean;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, cartCount, isDarkMode }) => {
  const tabs = [
    { id: Page.HOME, label: 'Início', icon: Home },
    { id: Page.ALERTS, label: 'Alertas', icon: Bell },
    { id: Page.FAVOURITE, label: 'Salvos', icon: Heart },
    { id: Page.CART, label: 'Pedido', icon: ShoppingCart },
    { id: Page.PROFILE, label: 'Perfil', icon: User },
  ];

  return (
    <div className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md border-t px-2 pt-3 pb-8 flex justify-between items-center z-50 shadow-2xl transition-colors duration-500 ${isDarkMode ? 'bg-[#000000] border-white/5' : 'bg-white border-silver'}`}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="flex flex-col items-center gap-1 flex-1 relative transition-all active:scale-90"
          >
            <div className={`p-1 transition-colors duration-300 ${isActive ? 'text-primary' : 'text-gray-500'}`}>
              <Icon size={20} strokeWidth={isActive ? 3 : 2} />
              {tab.id === Page.CART && cartCount > 0 && (
                <span className="absolute top-0 right-1/2 translate-x-3 bg-primary text-white text-[8px] font-bold w-4 h-4 rounded-md flex items-center justify-center border border-current shadow-lg">
                  {cartCount}
                </span>
              )}
            </div>
            <span className={`text-[8px] font-bold uppercase tracking-widest transition-colors duration-300 ${isActive ? 'text-primary' : 'text-gray-500'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default BottomNav;
