// Utility to suggest and fetch representative images from the internet for automotive products, tools, lubricants, and filters

export function getDefaultImageForCategory(name: string, category: string, brand?: string, mannCode?: string): string {
  const n = name.toLowerCase();
  const cat = (category || '').toLowerCase();

  // Filters (Mann Filter / Oil / Air / Fuel)
  if (cat.includes('filtro') || n.includes('filtro') || mannCode) {
    if (n.includes('aire') || (mannCode && mannCode.startsWith('C '))) {
      return 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=400&q=80'; // Air filter engine
    }
    if (n.includes('combustible') || n.includes('petroleo') || (mannCode && mannCode.startsWith('WK'))) {
      return 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=400&q=80'; // Fuel filter
    }
    // Oil filter
    return 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=400&q=80';
  }

  // Lubricants / Oils
  if (cat.includes('lubricante') || n.includes('aceite') || n.includes('grasa') || n.includes('balde') || n.includes('tambor')) {
    return 'https://images.unsplash.com/photo-1629897048514-3dd741400d4d?auto=format&fit=crop&w=400&q=80'; // Oil canister / barrel
  }

  // Brakes
  if (cat.includes('freno') || n.includes('pastilla') || n.includes('disco') || n.includes('tambor freno')) {
    return 'https://images.unsplash.com/photo-1600793575654-910699b5e4d4?auto=format&fit=crop&w=400&q=80'; // Disc brake
  }

  // Tools
  if (cat.includes('neumatica') || n.includes('impacto') || n.includes('pistola')) {
    return 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=400&q=80'; // Impact wrench
  }
  if (cat.includes('medicion') || n.includes('torquimetro') || n.includes('torque')) {
    return 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80'; // Precision tool
  }
  if (cat.includes('manual') || n.includes('llave') || n.includes('dado') || n.includes('alicate')) {
    return 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=400&q=80'; // Hand tools set
  }
  if (cat.includes('electrica') || n.includes('taladro') || n.includes('esmeril')) {
    return 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=400&q=80'; // Power tool
  }
  if (cat.includes('hidraulica') || n.includes('gata') || n.includes('prensa')) {
    return 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=400&q=80'; // Hydraulic equipment
  }
  if (cat.includes('diagnostico') || n.includes('scanner') || n.includes('obd')) {
    return 'https://images.unsplash.com/photo-1580828343064-fde4fc206bc6?auto=format&fit=crop&w=400&q=80'; // Diagnostic screen
  }

  // Electrical / Batteries
  if (cat.includes('electrico') || n.includes('bateria') || n.includes('alternador') || n.includes('motor arranque')) {
    return 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=400&q=80'; // Battery / Electrical
  }

  // Tires
  if (cat.includes('neumatico') || n.includes('llanta') || n.includes('rueda')) {
    return 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?auto=format&fit=crop&w=400&q=80'; // Truck tire
  }

  // General Spare Parts / Ferretería
  return 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80';
}

export interface SuggestedImage {
  title: string;
  url: string;
}

export function getSuggestedImages(query: string, category: string): SuggestedImage[] {
  const q = (query || category || 'repuestos').toLowerCase();

  const library: SuggestedImage[] = [
    { title: 'Filtro de Aceite Automotriz', url: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=600&q=80' },
    { title: 'Filtro de Aire Camión', url: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=600&q=80' },
    { title: 'Aceite de Motor y Lubricantes', url: 'https://images.unsplash.com/photo-1629897048514-3dd741400d4d?auto=format&fit=crop&w=600&q=80' },
    { title: 'Pastillas y Discos de Freno', url: 'https://images.unsplash.com/photo-1600793575654-910699b5e4d4?auto=format&fit=crop&w=600&q=80' },
    { title: 'Llave de Impacto Neumática', url: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=600&q=80' },
    { title: 'Juego de Herramientas Manuales', url: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=600&q=80' },
    { title: 'Torquímetro y Medición', url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80' },
    { title: 'Herramientas Eléctricas DeWalt/Makita', url: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=600&q=80' },
    { title: 'Gata Hidráulica y Levante', url: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=600&q=80' },
    { title: 'Baterías y Componentes Eléctricos', url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80' },
    { title: 'Neumáticos de Camión y Maquinaria', url: 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?auto=format&fit=crop&w=600&q=80' },
    { title: 'Repuesto Mecánico General', url: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=600&q=80' }
  ];

  return library;
}
