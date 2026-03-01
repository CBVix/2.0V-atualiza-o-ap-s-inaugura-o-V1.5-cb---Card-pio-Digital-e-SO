import { Tenant, InventoryItem, Category } from './types';

// ✅ CORREÇÃO: Slug extraído como constante — use em todo o projeto
// em vez de escrever 'churras-brutus' manualmente em qualquer lugar
export const DEFAULT_TENANT_SLUG = 'churras-brutus';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'tradicionais', name: 'Espetos Tradicionais', icon: 'Flame' },
  { id: 'especiais', name: 'Espetos Especiais', icon: 'Sparkles' },
  { id: 'combos', name: 'Combos Brutus', icon: 'Zap' },
  { id: 'pao', name: 'Churrasco no Pão', icon: 'UtensilsCrossed' },
  { id: 'bebidas', name: 'Bebidas', icon: 'CupSoda' },
  { id: 'sobremesas', name: 'Sobremesas', icon: 'IceCream' },
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  { id: 'inv-1', name: 'Carne Bovina (Picanha)', currentQty: 15, minQty: 5, unit: 'kg', category: 'proteinas', costPrice: 48.90 },
  { id: 'inv-2', name: 'Pão de Alho', currentQty: 50, minQty: 15, unit: 'un', category: 'outros', costPrice: 2.10 },
  { id: 'inv-3', name: 'Cerveja Lata', currentQty: 24, minQty: 12, unit: 'un', category: 'bebidas', costPrice: 3.20 },
  { id: 'inv-4', name: 'Carvão Vegetal', currentQty: 3, minQty: 5, unit: 'saco', category: 'suprimentos', costPrice: 18.00 },
  { id: 'inv-5', name: 'H2O', currentQty: 24, minQty: 10, unit: 'un', category: 'bebidas', costPrice: 4.50 },
];

export const TENANTS_DB: Record<string, Tenant> = {
  [DEFAULT_TENANT_SLUG]: {
    name: 'Churras Brutus',
    slug: DEFAULT_TENANT_SLUG,
    logo: 'https://images.unsplash.com/photo-1583394838336-acd977730f90?q=80&w=100&auto=format&fit=crop',
    whatsapp: '5511999999999',
    pixKey: 'pix@churrasbrutus.com.br',
    paymentLink: 'https://pagamento.exemplo.com/churrasbrutus',
    deliveryFee: 7.00,
    themeColor: '#FF6B00',
    address: 'Av. Paulista, 1000 - São Paulo',
    instagram: 'churrasbrutus.br',
    cardMachineFee: 2.39,
    categories: DEFAULT_CATEGORIES,
    products: [
      {
        id: '1',
        name: 'Picanha Premium',
        price: 24.90,
        rating: 4.9,
        reviews: '2.4k',
        image: 'https://images.unsplash.com/photo-1633040319166-f8f80f3d052d?q=80&w=800&auto=format&fit=crop',
        category: 'especiais',
        prepTime: '15 Min',
        description: 'Nossa picanha premium, cortada em cubos generosos e grelhada na brasa com sal grosso.',
        availability: 'available',
        inventoryId: 'inv-1',
        moods: ['fome'],
      },
      {
        id: '2',
        name: 'Combo Brutus Galera',
        price: 89.90,
        rating: 4.8,
        reviews: '850',
        image: 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?q=80&w=800&auto=format&fit=crop',
        category: 'combos',
        prepTime: '25 Min',
        description: 'Um combo perfeito para compartilhar: 2 de picanha, 2 de queijo coalho e 1 de coração.',
        isCombo: true,
        availability: 'available',
        inventoryId: 'inv-1',
        moods: ['dividir', 'fome'],
      },
      {
        id: '4',
        name: 'Churrasco no Pão',
        price: 18.00,
        rating: 4.9,
        reviews: '3.2k',
        image: 'https://images.unsplash.com/photo-1619860860774-1e2e17343432?q=80&w=800&auto=format&fit=crop',
        category: 'pao',
        prepTime: '12 Min',
        description: 'Pão crocante recheado com carne de churrasco fatiada e nossa pasta artesanal.',
        availability: 'available',
        inventoryId: 'inv-2',
        moods: ['rapido'],
      },
      {
        id: 'h2o-1',
        name: 'H2O',
        price: 10.00,
        rating: 5.0,
        reviews: '0',
        image: 'https://images.unsplash.com/photo-1548964856-ac520a4a9910?q=80&w=400&auto=format&fit=crop',
        category: 'bebidas',
        prepTime: '2 Min',
        description: 'Água mineral levemente gaseificada com sabor limão.',
        availability: 'available',
        inventoryId: 'inv-5',
        moods: ['refrescante'],
      }
    ]
  }
};