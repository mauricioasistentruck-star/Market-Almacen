export interface WeighablePreset {
  id: string;
  name: string;
  icon: string;
  defaultPrice: number;
  unitLabel: string; // 'Kg' | 'Metro' | 'Gramos' | 'Docena' etc.
  subUnitLabel?: string; // 'Gramos' | 'cm' etc.
  unitType?: 'weight' | 'length' | 'quantity';
  keywords: string[];
}

export interface CompanyServiceOption {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  active: boolean;
  price?: number;
}

export interface RubroDefinition {
  key: string;
  name: string;
  icon: string;
  description: string;
  categories: string[];
  units: string[];
  weighablePresets: WeighablePreset[];
  serviceOptions: CompanyServiceOption[];
  saleButtonLabel: string;
  saleButtonTooltip: string;
}

export const RUBROS_CATALOG: Record<string, RubroDefinition> = {
  almacen: {
    key: 'almacen',
    name: 'Almacén, Minimarket y Botillería',
    icon: '🛒',
    description: 'Venta de abarrotes, bebidas, licores, lácteos, cecinas, panadería y pesaje de alimentos frescos.',
    saleButtonLabel: 'Venta por Peso / Granel',
    saleButtonTooltip: 'Venta de Cecinas, Quesos, Pan, Frutas y Verduras por Kilo o Monto',
    categories: [
      'Abarrotes',
      'Bebidas y Licores',
      'Lácteos y Fiambrería',
      'Carnes y Congelados',
      'Panadería y Pastelería',
      'Frutas y Verduras',
      'Limpieza y Aseo',
      'Snacks y Golosinas',
      'Cuidado Personal',
      'Insumos y Desechables',
      'Otros'
    ],
    units: [
      'Unidades',
      'Kg',
      'Gramos',
      'Litros',
      'Pack',
      'Caja',
      'Bolsa',
      'Botella',
      'Lata'
    ],
    weighablePresets: [
      { id: 'cecinas', name: 'Cecinas y Fiambrería', icon: '🥩', defaultPrice: 8990, unitLabel: 'Kg', subUnitLabel: 'Gramos', unitType: 'weight', keywords: ['cecina', 'jamon', 'jamón', 'salchicha', 'mortadela', 'salame', 'arrollado', 'paté', 'pate', 'vienesas', 'tocino', 'fiambreria'] },
      { id: 'quesos', name: 'Quesos y Lácteos', icon: '🧀', defaultPrice: 7990, unitLabel: 'Kg', subUnitLabel: 'Gramos', unitType: 'weight', keywords: ['queso', 'gauda', 'chanco', 'mozzarella', 'mantecoso', 'ricotta', 'parmesano', 'lacteo', 'lácteo'] },
      { id: 'pan', name: 'Panadería y Pan', icon: '🥖', defaultPrice: 1990, unitLabel: 'Kg', subUnitLabel: 'Gramos', unitType: 'weight', keywords: ['pan', 'marraqueta', 'hallulla', 'baguette', 'coliza', 'dobladita', 'panaderia', 'panadería'] },
      { id: 'verduras', name: 'Verduras y Ensaladas', icon: '🥬', defaultPrice: 1500, unitLabel: 'Kg', subUnitLabel: 'Gramos', unitType: 'weight', keywords: ['verdura', 'lechuga', 'espinaca', 'acelga', 'zapallo', 'zanahoria', 'apio', 'pepino', 'cilantro', 'perejil', 'cebolla'] },
      { id: 'papas', name: 'Papas y Tubérculos', icon: '🥔', defaultPrice: 1200, unitLabel: 'Kg', subUnitLabel: 'Gramos', unitType: 'weight', keywords: ['papa', 'papas', 'camote', 'tubérculo', 'tuberculo'] },
      { id: 'frutas', name: 'Frutas Frescas', icon: '🍎', defaultPrice: 1990, unitLabel: 'Kg', subUnitLabel: 'Gramos', unitType: 'weight', keywords: ['fruta', 'manzana', 'platano', 'plátano', 'naranja', 'pera', 'uva', 'limon', 'limón', 'sandia', 'sandía', 'melon', 'melón'] },
      { id: 'carnes', name: 'Carnes y Pollo', icon: '🍗', defaultPrice: 6990, unitLabel: 'Kg', subUnitLabel: 'Gramos', unitType: 'weight', keywords: ['carne', 'pollo', 'vacuno', 'cerdo', 'trutro', 'pechuga', 'posta', 'lomo', 'costillar', 'asado'] },
      { id: 'frutos_secos', name: 'Frutos Secos y Semillas', icon: '🥜', defaultPrice: 9990, unitLabel: 'Kg', subUnitLabel: 'Gramos', unitType: 'weight', keywords: ['nuez', 'nueces', 'almendra', 'mani', 'maní', 'pistacho', 'castaña', 'semilla', 'chia', 'chía', 'linaza'] },
      { id: 'legumbres', name: 'Legumbres y Granos', icon: '🫘', defaultPrice: 2490, unitLabel: 'Kg', subUnitLabel: 'Gramos', unitType: 'weight', keywords: ['poroto', 'lenteja', 'garbanzo', 'arveja', 'haba', 'legumbre', 'grano'] }
    ],
    serviceOptions: [
      { id: 'delivery', name: 'Despacho a Domicilio', description: 'Reparto directo a domicilio dentro de la comuna', icon: '🛵', active: true },
      { id: 'lote_ofertas', name: 'Venta por Lote en Liquidación', description: 'Ofertas por vencimiento de productos específicos', icon: '🏷️', active: true },
      { id: 'venta_mayorista', name: 'Precios Mayoristas por Embalaje', description: 'Descuento por caja cerrada o fardo', icon: '📦', active: false }
    ]
  },

  ferreteria: {
    key: 'ferreteria',
    name: 'Ferretería y Materiales de Construcción',
    icon: '🔨',
    description: 'Venta de herramientas, tornillería, fijaciones, pinturas, cañerías, cemento, arena y fraccionado de materiales.',
    saleButtonLabel: 'Venta Fraccionada / Granel / Metro',
    saleButtonTooltip: 'Venta de Clavos por Kilo, Tornillos a Granel, Arena, Cemento, Perfiles y Alambre',
    categories: [
      'Fijaciones y Tornillería',
      'Herramientas Manuales',
      'Herramientas Eléctricas',
      'Pinturas, Solventes y Adhesivos',
      'Electricidad e Iluminación',
      'Gasfitería y Plomería',
      'Materiales de Construcción y Áridos',
      'Cerrajería y Seguridad',
      'Mallas, Alambres y Perfiles',
      'Jardinería y Riego',
      'Seguridad Industrial (EPP)',
      'Otros'
    ],
    units: [
      'Unidades',
      'Kg',
      'Gramos',
      'Metros',
      'Metro Lineal',
      'Saco',
      'Tira',
      'Litros',
      'Galón',
      'Tineta',
      'Caja',
      'Rollo',
      'Ciento'
    ],
    weighablePresets: [
      { id: 'clavos', name: 'Clavos Corrientes y de Techo', icon: '🔩', defaultPrice: 2200, unitLabel: 'Kg', subUnitLabel: 'Gramos', unitType: 'weight', keywords: ['clavo', 'clavos', 'tachuela', 'punta', 'paraguas', 'techo', 'cemento'] },
      { id: 'tornillos_granel', name: 'Tornillos y Golillas a Granel', icon: '🔧', defaultPrice: 4500, unitLabel: 'Kg', subUnitLabel: 'Gramos', unitType: 'weight', keywords: ['tornillo', 'tornillos', 'tuerca', 'tuercas', 'golilla', 'perno', 'pernos', 'arandela'] },
      { id: 'aridos_arena', name: 'Arena, Ripio y Gravilla', icon: '🧱', defaultPrice: 1500, unitLabel: 'Saco', subUnitLabel: 'Kg', unitType: 'weight', keywords: ['arena', 'ripio', 'gravilla', 'arido', 'árido', 'estuco', 'maicillo'] },
      { id: 'cemento_mortero', name: 'Cemento, Cal y Morteros', icon: '🏗️', defaultPrice: 4990, unitLabel: 'Saco', subUnitLabel: 'Kg', unitType: 'weight', keywords: ['cemento', 'mortero', 'cal', 'yeso', 'adhesivo', 'bekron', 'bemen'] },
      { id: 'alambre_mallas', name: 'Alambre Negro y Galvanizado', icon: '⛓️', defaultPrice: 3200, unitLabel: 'Kg', subUnitLabel: 'Gramos', unitType: 'weight', keywords: ['alambre', 'galvanizado', 'púas', 'puas', 'malla', 'alambres', 'amarrar'] },
      { id: 'tuberias_perfiles', name: 'Tuberías PVC y Cañerías', icon: '📏', defaultPrice: 1800, unitLabel: 'Metro', subUnitLabel: 'cm', unitType: 'length', keywords: ['tuberia', 'tubería', 'pvc', 'cobre', 'perfil', 'tubo', 'fierro', 'angulo', 'ángulo'] },
      { id: 'cables_electricos', name: 'Cables y Cordones Eléctricos', icon: '⚡', defaultPrice: 950, unitLabel: 'Metro', subUnitLabel: 'cm', unitType: 'length', keywords: ['cable', 'cables', 'alambre eléctrico', 'cordon', 'cordón', 'thhn', 'paralelo'] },
      { id: 'cadenas_piolas', name: 'Cadenas, Piolas y Cordelería', icon: '🪢', defaultPrice: 2100, unitLabel: 'Metro', subUnitLabel: 'cm', unitType: 'length', keywords: ['cadena', 'piola', 'soga', 'cuerda', 'cordel', 'driza'] }
    ],
    serviceOptions: [
      { id: 'corte_dimensionado', name: 'Corte y Dimensionado a Medida', description: 'Corte de madera, fierros, perfiles y cañerías en el local', icon: '✂️', active: true },
      { id: 'despacho_obra', name: 'Despacho de Materiales a Obra / Flete', description: 'Transporte de sacos de cemento, fierros y bultos pesados', icon: '🚚', active: true },
      { id: 'arriendo_herramientas', name: 'Arriendo de Herramientas Menores', description: 'Préstamo o arriendo por jornada de taladro, demoledor o betonera', icon: '🛠️', active: false },
      { id: 'cotizaciones', name: 'Generación de Cotizaciones Formales', description: 'Emisión de presupuestos para contratistas y maestros', icon: '📋', active: true }
    ]
  },

  confeccion: {
    key: 'confeccion',
    name: 'Confección de Artículos, Textil y Costura',
    icon: '🧵',
    description: 'Venta de telas por metro, hilos, botones, confección de prendas, uniformes, ropa a medida y arreglos de costura.',
    saleButtonLabel: 'Venta por Metro / Fraccionado',
    saleButtonTooltip: 'Venta de Telas por Metro, Hilos, Cintas, Botones por Docena o Kilo de Relleno',
    categories: [
      'Telas y Tejidos por Metro',
      'Hilos, Lanas y Cintería',
      'Botones, Broches y Cierres/Cremalleras',
      'Prendas y Confecciones Terminadas',
      'Uniformes Escolares y Corporativos',
      'Ropa a Medida y Personalizada',
      'Servicios de Arreglos y Bastas',
      'Rellenos, Guata y Espumas',
      'Patronaje, Moldes y Accesorios',
      'Embalaje y Bolsas Textiles',
      'Otros'
    ],
    units: [
      'Metros',
      'Centímetros',
      'Unidades',
      'Rollo',
      'Cono',
      'Madeja',
      'Docena',
      'Ciento',
      'Kg',
      'Gramos',
      'Par',
      'Set'
    ],
    weighablePresets: [
      { id: 'telas_metro', name: 'Telas y Géneros por Metro', icon: '🧣', defaultPrice: 4990, unitLabel: 'Metro', subUnitLabel: 'cm', unitType: 'length', keywords: ['tela', 'genero', 'género', 'lino', 'algodon', 'algodón', 'popelina', 'polar', 'bistrech', 'mezclilla', 'seda', 'raso'] },
      { id: 'hilos_lanas', name: 'Hilos, Lanas y Madejas', icon: '🧶', defaultPrice: 1200, unitLabel: 'Cono', subUnitLabel: 'Metros', unitType: 'length', keywords: ['hilo', 'hilos', 'lana', 'lanas', 'cono', 'madeja', 'carrete', 'hilaza'] },
      { id: 'cintas_elasticos', name: 'Cintas, Vivos y Elásticos', icon: '🎗️', defaultPrice: 500, unitLabel: 'Metro', subUnitLabel: 'cm', unitType: 'length', keywords: ['cinta', 'elastico', 'elástico', 'sesgo', 'vivo', 'encaje', 'blonda', 'velcro'] },
      { id: 'botones_broches', name: 'Botones y Broches por Docena / Peso', icon: '🔘', defaultPrice: 1800, unitLabel: 'Docena', subUnitLabel: 'Unidades', unitType: 'quantity', keywords: ['boton', 'botones', 'broche', 'broches', 'remache', 'ojetillo', 'cierre', 'cremallera'] },
      { id: 'rellenos_vellon', name: 'Vellón y Rellenos de Cojín', icon: '☁️', defaultPrice: 6500, unitLabel: 'Kg', subUnitLabel: 'Gramos', unitType: 'weight', keywords: ['relleno', 'vellon', 'vellón', 'guata', 'espuma', 'algodón sintético', 'cojin', 'cojín'] },
      { id: 'entretelas', name: 'Entretelas y Termoadhesivos', icon: '📄', defaultPrice: 2200, unitLabel: 'Metro', subUnitLabel: 'cm', unitType: 'length', keywords: ['entretela', 'termoadhesivo', 'fiselina', 'fusionable'] }
    ],
    serviceOptions: [
      { id: 'servicio_bastas', name: 'Servicio de Bastas y Dobladillos', description: 'Ajuste de largo de pantalones, faldas y vestidos', icon: '👖', active: true },
      { id: 'servicio_arreglos', name: 'Arreglos y Cambio de Cierres', description: 'Reparación de prendas, cambio de cremalleras y ajustes de cintura', icon: '✂️', active: true },
      { id: 'confeccion_a_medida', name: 'Confección de Prendas a Medida', description: 'Elaboración de trajes, vestidos y prendas exclusivas sobre diseño', icon: '👗', active: true },
      { id: 'bordado_estampado', name: 'Bordados y Estampados Corporativos', description: 'Personalización con logotipo de empresas y colegios', icon: '✨', active: true }
    ]
  },

  libreria: {
    key: 'libreria',
    name: 'Librería, Oficina, Impresión 3D y Personalizados',
    icon: '📚',
    description: 'Útiles de oficina, papelería, impresión 3D, stickers, calendarios, tazas personalizadas y copiado.',
    saleButtonLabel: '3D, Stickers, Pliegos y Tazas',
    saleButtonTooltip: 'Venta de Impresiones 3D por Gramo, Stickers, Calendarios, Tazas Sublimadas y Pliegos',
    categories: [
      'Artículos con Impresión 3D',
      'Tazas y Tazones Personalizados',
      'Stickers y Vinilos Adhesivos',
      'Calendarios y Agendas Personalizadas',
      'Cuadernos y Papelería de Oficina',
      'Artículos de Escritura y Lápices',
      'Resmas y Papeles Especiales',
      'Manualidades, Cartulinas y Cartones',
      'Filamentos 3D e Insumos de Sublimación',
      'Servicios de Imprenta y Fotocopiado',
      'Otros'
    ],
    units: [
      'Unidades',
      'Pliego',
      'Pack',
      'Docena',
      'Gramos',
      'Kg',
      'Metros',
      'Resma',
      'Caja',
      'Set'
    ],
    weighablePresets: [
      { id: 'impresion_3d_gramos', name: 'Impresión 3D por Gramo (PLA/PETG/Resina)', icon: '🧊', defaultPrice: 150, unitLabel: 'Gramos', subUnitLabel: 'g', unitType: 'weight', keywords: ['3d', 'filamento', 'pla', 'petg', 'resina', 'impresion 3d', 'impresión 3d', 'figura 3d', 'pieza 3d'] },
      { id: 'stickers_pliego', name: 'Stickers y Vinilos por Pliego / Metro', icon: '🏷️', defaultPrice: 2500, unitLabel: 'Pliego', subUnitLabel: 'Unidades', unitType: 'quantity', keywords: ['sticker', 'stickers', 'adhesivo', 'vinilo', 'troquelado', 'calcomania', 'calcomanía'] },
      { id: 'calendarios_personalizados', name: 'Calendarios y Almanaques Personalizados', icon: '📅', defaultPrice: 3500, unitLabel: 'Unidades', subUnitLabel: 'Unidades', unitType: 'quantity', keywords: ['calendario', 'calendarios', 'almanaque', 'agenda', 'planificador'] },
      { id: 'tazas_personalizadas', name: 'Tazas y Tazones Sublimados', icon: '☕', defaultPrice: 4500, unitLabel: 'Unidades', subUnitLabel: 'Unidades', unitType: 'quantity', keywords: ['taza', 'tazas', 'tazon', 'tazón', 'mug', 'sublimada', 'personalizada'] },
      { id: 'cartulinas_pliego', name: 'Cartulinas y Papeles por Pliego', icon: '📜', defaultPrice: 400, unitLabel: 'Pliego', subUnitLabel: 'Unidades', unitType: 'quantity', keywords: ['cartulina', 'pliego', 'kraft', 'crepe', 'papel lustre', 'carton'] },
      { id: 'fotocopias_impresiones', name: 'Fotocopias e Impresiones Digitales', icon: '🖨️', defaultPrice: 100, unitLabel: 'Página', subUnitLabel: 'Hojas', unitType: 'quantity', keywords: ['fotocopia', 'impresion', 'impresión', 'blanco y negro', 'color', 'scanner'] }
    ],
    serviceOptions: [
      { id: 'servicio_impresion_3d', name: 'Servicio de Modelado e Impresión 3D', description: 'Fabricación de piezas técnicas, maquetas o figuras en filamento/resina', icon: '🧊', active: true },
      { id: 'servicio_sublimacion_tazas', name: 'Sublimación de Tazas y Mugs a Pedido', description: 'Diseño e impresión personalizada en tazones cerámicos, mágicos y térmicos', icon: '☕', active: true },
      { id: 'servicio_corte_stickers', name: 'Impresión y Troquelado de Stickers', description: 'Stickers en vinilo adhesivo resistente al agua por pliego o unitarios', icon: '🏷️', active: true },
      { id: 'servicio_calendarios', name: 'Diseño e Impresión de Calendarios', description: 'Calendarios de pared, escritorio o imantados para refrigerador', icon: '📅', active: true },
      { id: 'fotocopiado', name: 'Servicio de Fotocopias e Impresión', description: 'Impresión digital láser color y blanco y negro', icon: '🖨️', active: true },
      { id: 'termolaminado', name: 'Termolaminado y Plastificado', description: 'Plastificación de credenciales, certificados y documentos', icon: '📑', active: true },
      { id: 'anillado', name: 'Anillado y Encuadernación Espiral', description: 'Encuadernación de guías, tesis y apuntes', icon: '📒', active: true }
    ]
  },

  impresion_3d: {
    key: 'impresion_3d',
    name: 'Impresión 3D, Sublimación y Merchandising',
    icon: '🧊',
    description: 'Taller de impresión 3D en filamento/resina, tazas personalizadas, stickers troquelados, poleras y calendarios.',
    saleButtonLabel: 'Venta 3D, Tazas y Stickers',
    saleButtonTooltip: 'Venta de Piezas 3D por Gramo, Tazas Sublimadas, Stickers Adhesivos y Calendarios',
    categories: [
      'Piezas y Figuras con Impresión 3D',
      'Tazas, Mugs y Termos Sublimados',
      'Stickers, Calcomanías y Vinilos',
      'Calendarios y Papelería Corporativa',
      'Poleras, Gorros y Textil Estampado',
      'Llaveros, Cuadros y Regalos Personalizados',
      'Filamentos PLA/PETG y Resinas 3D',
      'Insumos y Papel de Sublimación',
      'Servicios de Diseño y Modelado 3D',
      'Otros'
    ],
    units: [
      'Unidades',
      'Gramos',
      'Pliego',
      'Docena',
      'Pack',
      'Kg',
      'Metros',
      'Set'
    ],
    weighablePresets: [
      { id: 'filamento_pieza_3d', name: 'Piezas Impresas en 3D (por Gramo)', icon: '🧊', defaultPrice: 180, unitLabel: 'Gramos', subUnitLabel: 'g', unitType: 'weight', keywords: ['3d', 'pieza 3d', 'figura 3d', 'filamento', 'pla', 'petg', 'resina', 'prototipo'] },
      { id: 'tazas_mugs', name: 'Tazas y Mugs Sublimados', icon: '☕', defaultPrice: 4990, unitLabel: 'Unidades', subUnitLabel: 'Unidades', unitType: 'quantity', keywords: ['taza', 'tazas', 'tazon', 'tazón', 'mug', 'vaso', 'termo', 'sublimada', 'personalizada'] },
      { id: 'stickers_laminados', name: 'Stickers Troquelados por Pliego', icon: '🏷️', defaultPrice: 2800, unitLabel: 'Pliego', subUnitLabel: 'Unidades', unitType: 'quantity', keywords: ['sticker', 'stickers', 'adhesivo', 'vinilo', 'troquelado', 'calcomania', 'calcomanía'] },
      { id: 'calendarios_anuales', name: 'Calendarios de Pared y Escritorio', icon: '📅', defaultPrice: 3990, unitLabel: 'Unidades', subUnitLabel: 'Unidades', unitType: 'quantity', keywords: ['calendario', 'calendarios', 'almanaque', 'planificador'] },
      { id: 'llaveros_3d', name: 'Llaveros y Recuerdos Personalizados', icon: '🔑', defaultPrice: 1500, unitLabel: 'Unidades', subUnitLabel: 'Unidades', unitType: 'quantity', keywords: ['llavero', 'llaveros', 'recuerdo', 'souvenir', 'impreso'] }
    ],
    serviceOptions: [
      { id: 'servicio_modelado_3d', name: 'Diseño CAD y Modelado 3D a Medida', description: 'Creación de planos 3D y archivos STL para prototipos y piezas', icon: '💻', active: true },
      { id: 'servicio_impresion_resina', name: 'Impresión 3D en Resina de Alta Resolución', description: 'Figuras miniatura, joyería y piezas de alta precisión', icon: '✨', active: true },
      { id: 'servicio_sublimacion_express', name: 'Sublimación Express de Tazas en el Día', description: 'Entrega rápida de tazones para aniversarios y regalos', icon: '☕', active: true },
      { id: 'servicio_stickers_por_mayor', name: 'Pliegos de Stickers Corporativos por Mayor', description: 'Impresión masiva para empaques de pymes con corte digital', icon: '🏷️', active: true }
    ]
  },

  farmacia: {
    key: 'farmacia',
    name: 'Farmacia, Botica y Perfumería',
    icon: '💊',
    description: 'Venta de medicamentos, productos de botiquín, suplementos, dermocosmética e higiene personal.',
    saleButtonLabel: 'Venta Fraccionada / Dosis',
    saleButtonTooltip: 'Venta de Fórmulas, Antisépticos por Litro o Pastillas por Blister',
    categories: [
      'Medicamentos Éticos (Bajo Receta)',
      'Medicamentos Venta Directa (OTC)',
      'Primeros Auxilios y Botiquín',
      'Cuidado Personal e Higiene',
      'Dermocosmética y Belleza',
      'Vitaminas y Suplementos',
      'Infantil y Maternidad',
      'Alimentos Médicos y Dietéticos',
      'Accesorios Médicos y Termómetros',
      'Otros'
    ],
    units: [
      'Unidades',
      'Caja',
      'Blister',
      'Frasco',
      'Tubo',
      'Frasco Gotero',
      'ml',
      'Litros',
      'Sobre',
      'Pack'
    ],
    weighablePresets: [
      { id: 'alcohol_liquidos', name: 'Alcohol y Antisépticos a Granel', icon: '🧴', defaultPrice: 2990, unitLabel: 'Litros', subUnitLabel: 'ml', unitType: 'length', keywords: ['alcohol', 'antiseptico', 'antiséptico', 'povidona', 'agua oxigenada'] },
      { id: 'algodon_gasas', name: 'Algodón y Gasas por Kilo/Pack', icon: '🩹', defaultPrice: 3500, unitLabel: 'Kg', subUnitLabel: 'Gramos', unitType: 'weight', keywords: ['algodon', 'algodón', 'gasa', 'venda', 'aposito', 'apósito'] }
    ],
    serviceOptions: [
      { id: 'toma_presion', name: 'Servicio de Toma de Presión Arterial', description: 'Medición rápida de tensión arterial en local', icon: '🩺', active: true },
      { id: 'inyecciones', name: 'Aplicación de Inyecciones', description: 'Servicio de enfermería con receta médica', icon: '💉', active: false },
      { id: 'control_glucosa', name: 'Control Rápido de Glucosa', description: 'Test de glicemia capilar', icon: '🩸', active: true }
    ]
  },

  panaderia: {
    key: 'panaderia',
    name: 'Panadería, Pastelería y Cafetería',
    icon: '🥖',
    description: 'Venta de pan fresco del día, tortas, pasteles, masas dulces, empanadas y cafetería.',
    saleButtonLabel: 'Venta de Pan por Kilo',
    saleButtonTooltip: 'Pesaje de Pan Marraqueta, Hallulla, Galletas y Masas Dulces',
    categories: [
      'Pan Fresco Tradicional',
      'Panes Especiales e Integrales',
      'Pastelería Fina y Tortas',
      'Bollería y Masas Dulces',
      'Empanadas y Bocadillos Salados',
      'Sandwiches y Cafetería',
      'Bebidas Frías y Lácteos',
      'Insumos de Repostería',
      'Otros'
    ],
    units: [
      'Kg',
      'Gramos',
      'Unidades',
      'Docena',
      'Porción',
      'Pack',
      'Caja'
    ],
    weighablePresets: [
      { id: 'pan_marraqueta_hallulla', name: 'Pan Marraqueta y Hallulla', icon: '🥖', defaultPrice: 2190, unitLabel: 'Kg', subUnitLabel: 'Gramos', unitType: 'weight', keywords: ['marraqueta', 'hallulla', 'pan corriente', 'pan frances'] },
      { id: 'pan_especial', name: 'Panes Especiales (Coliza, Dobladita)', icon: '🥐', defaultPrice: 2890, unitLabel: 'Kg', subUnitLabel: 'Gramos', unitType: 'weight', keywords: ['dobladita', 'coliza', 'baguette', 'pan amasado', 'ciabatta', 'integral'] },
      { id: 'galletas_granel', name: 'Galletas y Masas Secas por Kilo', icon: '🍪', defaultPrice: 4500, unitLabel: 'Kg', subUnitLabel: 'Gramos', unitType: 'weight', keywords: ['galleta', 'galletas', 'mantequilla', 'champañita', 'masa seca'] }
    ],
    serviceOptions: [
      { id: 'tortas_pedido', name: 'Tortas Personalizadas a Pedido', description: 'Confección de tortas de cumpleaños, novios y eventos', icon: '🎂', active: true },
      { id: 'coctel_eventos', name: 'Servicio de Cóctel para Eventos', description: 'Bocadillos dulces y salados por volumen para fiestas', icon: '🥂', active: true }
    ]
  },

  mascotas: {
    key: 'mascotas',
    name: 'Veterinaria y Tienda de Mascotas (Pet Shop)',
    icon: '🐾',
    description: 'Venta de alimento para mascotas a granel y sellado, accesorios, farmacia veterinaria e higiene animal.',
    saleButtonLabel: 'Venta de Alimento por Kilo',
    saleButtonTooltip: 'Venta de Alimento para Perro, Gato y Semillas a Granel',
    categories: [
      'Alimento Perros Sellado',
      'Alimento Gatos Sellado',
      'Alimento a Granel por Kilo',
      'Snacks y Premios',
      'Farmacia y Antiparasitarios',
      'Higiene, Shampoos y Arenas',
      'Collares, Correas y Arneses',
      'Juguetes y Camas',
      'Accesorios Aves y Roedores',
      'Otros'
    ],
    units: [
      'Kg',
      'Gramos',
      'Unidades',
      'Saco',
      'Pack',
      'Frasco',
      'ml'
    ],
    weighablePresets: [
      { id: 'alimento_perro_kilo', name: 'Alimento de Perro por Kilo', icon: '🐕', defaultPrice: 2800, unitLabel: 'Kg', subUnitLabel: 'Gramos', unitType: 'weight', keywords: ['alimento perro', 'croquetas perro', 'dog chow', 'pedigree', 'master dog', 'granel perro'] },
      { id: 'alimento_gato_kilo', name: 'Alimento de Gato por Kilo', icon: '🐈', defaultPrice: 3800, unitLabel: 'Kg', subUnitLabel: 'Gramos', unitType: 'weight', keywords: ['alimento gato', 'croquetas gato', 'cat chow', 'whiskas', 'gati', 'granel gato'] },
      { id: 'arena_sanitaria_kilo', name: 'Arena Sanitaria a Granel', icon: '🪨', defaultPrice: 990, unitLabel: 'Kg', subUnitLabel: 'Gramos', unitType: 'weight', keywords: ['arena', 'bentonita', 'arena sanitaria', 'arena gato'] },
      { id: 'semillas_aves', name: 'Alpiste y Semillas para Aves', icon: '🦜', defaultPrice: 2200, unitLabel: 'Kg', subUnitLabel: 'Gramos', unitType: 'weight', keywords: ['alpiste', 'mijo', 'maravilla', 'semilla', 'ave', 'canario'] }
    ],
    serviceOptions: [
      { id: 'peluqueria_canina', name: 'Peluquería Canina y Baño', description: 'Corte de pelo, baño sanitario y corte de uñas', icon: '✂️', active: true },
      { id: 'consulta_veterinaria', name: 'Consulta Veterinaria y Vacunación', description: 'Atención clínica y calendario de vacunas', icon: '🩺', active: true },
      { id: 'despacho_sacos', name: 'Despacho Gratuito de Sacos', description: 'Envío de sacos grandes de alimento a domicilio', icon: '🚚', active: true }
    ]
  },

  personalizado: {
    key: 'personalizado',
    name: 'Giro Personalizado / Otro Negocio',
    icon: '🏢',
    description: 'Configure a medida las categorías, unidades y servicios para cualquier tipo de negocio comercial.',
    saleButtonLabel: 'Venta Fraccionada / Granel',
    saleButtonTooltip: 'Venta de Productos por Peso, Medida o Fracción',
    categories: [
      'Categoría General 1',
      'Categoría General 2',
      'Categoría General 3',
      'Insumos',
      'Servicios',
      'Otros'
    ],
    units: [
      'Unidades',
      'Kg',
      'Metros',
      'Litros',
      'Pack',
      'Caja'
    ],
    weighablePresets: [
      { id: 'articulos_peso', name: 'Artículos por Peso', icon: '⚖️', defaultPrice: 1000, unitLabel: 'Kg', subUnitLabel: 'Gramos', unitType: 'weight', keywords: ['peso', 'kilo', 'gramos'] },
      { id: 'articulos_medida', name: 'Artículos por Medida', icon: '📏', defaultPrice: 1000, unitLabel: 'Metro', subUnitLabel: 'cm', unitType: 'length', keywords: ['metro', 'medida', 'largo'] }
    ],
    serviceOptions: [
      { id: 'servicio_personalizado_1', name: 'Servicio a Domicilio', description: 'Entrega en domicilio del cliente', icon: '🛵', active: true }
    ]
  }
};

export function getRubroPreset(key?: string): RubroDefinition {
  if (!key || !RUBROS_CATALOG[key]) {
    return RUBROS_CATALOG.almacen;
  }
  return RUBROS_CATALOG[key];
}

export function getAllRubros(): RubroDefinition[] {
  return Object.values(RUBROS_CATALOG);
}
