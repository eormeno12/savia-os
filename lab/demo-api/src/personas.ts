export interface Persona {
  id: string;
  name: string;
  role: string;
  company: string;
  memories: string[];
}

export const PERSONAS: Persona[] = [
  {
    id: 'lucia-torres',
    name: 'Lucía Torres',
    role: 'Founder & CEO',
    company: 'Fitco',
    memories: [
      'Me llamo Lucía Torres, soy Founder y CEO de Fitco',
      'Fitco es una startup de software para gestión de gimnasios con sede en Lima, Perú, actualmente en etapa pre-Series A con 12 personas en el equipo',
      'Uso Claude para planificar estrategia y tomar decisiones de producto, ChatGPT para redactar emails a inversores y Gemini para preparar pitch decks',
      'Mis prioridades actuales son cerrar una ronda de $2M USD y lanzar la expansión a Colombia antes de Q1 del próximo año',
      'Estoy buscando un CTO porque el equipo técnico actual no escala con el crecimiento esperado',
      'Mi mayor frustración es tener que re-explicar el contexto de Fitco y sus métricas cada vez que empiezo una nueva conversación con una IA',
    ],
  },
  {
    id: 'mateo-rios',
    name: 'Mateo Ríos',
    role: 'Head de Marketing',
    company: 'Belcorp',
    memories: [
      'Me llamo Mateo Ríos, soy Head de Marketing en Belcorp para el mercado peruano',
      'En Belcorp gestiono la estrategia de contenido y campañas digitales para tres marcas: Ésika, L\'Bel y Cyzone, cada una con audiencias distintas',
      'Uso ChatGPT para generar copy de campañas, Midjourney para crear referencias visuales y Claude para desarrollar estrategia de contenido de largo plazo',
      'Mi mayor reto es mantener la coherencia de tono y voz entre tres marcas con posicionamientos distintos',
      'Estoy preparando la campaña de navidad para los tres portafolios con un presupuesto combinado de S/. 2.8M',
      'Trabajo con tres agencias externas simultáneamente y necesito mantener mucho contexto de coordinación',
    ],
  },
  {
    id: 'valeria-sanchez',
    name: 'Valeria Sánchez',
    role: 'Ejecutiva Comercial',
    company: 'Alicorp',
    memories: [
      'Me llamo Valeria Sánchez, soy Ejecutiva Comercial en Alicorp',
      'Gestiono las cuentas clave del canal moderno: Tottus, Plaza Vea y Cencosud, con más de 20 SKUs activos por cuenta',
      'Uso IA para preparar propuestas comerciales personalizadas por retailer, analizar datos de venta y redactar follow-ups post-reunión',
      'Mi foco actual es el sell-in del cuarto trimestre y las negociaciones de espacio en góndola para la temporada de verano',
      'Trabajo principalmente con las categorías de aceites, pastas y harinas',
      'Cada retailer tiene dinámicas completamente distintas de negociación y necesito recordar el contexto histórico de cada relación comercial',
    ],
  },
  {
    id: 'diego-herrera',
    name: 'Diego Herrera',
    role: 'Recruiter',
    company: 'Interbank',
    memories: [
      'Me llamo Diego Herrera, soy Recruiter especializado en talento digital en Interbank',
      'Me encargo del talent acquisition para las áreas de tecnología, producto y data del banco, cerrando entre 4 y 5 posiciones por mes',
      'Uso IA para redactar job descriptions atractivos, hacer screening inicial de CVs y personalizar mensajes de outreach en LinkedIn',
      'Actualmente estoy buscando un Head de Datos y tres ingenieros backend senior para el equipo de Interbank App',
      'El principal reto es competir con startups y empresas tech que ofrecen trabajo 100% remoto, algo que el banco no puede igualar',
      'Uso LinkedIn Recruiter para sourcing, ChatGPT para redactar textos y Claude para preparar preguntas de evaluación de fit cultural',
    ],
  },
  {
    id: 'camila-avila',
    name: 'Camila Ávila',
    role: 'Product Manager',
    company: 'Yape',
    memories: [
      'Me llamo Camila Ávila, soy Product Manager en Yape, el wallet digital del Banco de Crédito del Perú',
      'Lidero la hoja de ruta de tres squads: pagos entre personas, transferencias interbancarias y el programa de fidelización',
      'Coordino simultáneamente con ingeniería, diseño UX, negocio y compliance, lo que genera mucho contexto que mantener entre sesiones',
      'Uso IA para redactar PRDs, estructurar user stories y analizar el feedback de usuarios en la app store',
      'Mi foco principal este trimestre es lanzar la funcionalidad de pagos internacionales antes de diciembre',
      'Yape tiene más de 14 millones de usuarios activos en Perú, así que cualquier cambio de producto tiene impacto masivo',
    ],
  },
  {
    id: 'andres-molina',
    name: 'Andrés Molina',
    role: 'Consultor Senior',
    company: 'Apoyo Consultoría',
    memories: [
      'Me llamo Andrés Molina, soy Consultor Senior en Apoyo Consultoría',
      'Me especializo en estrategia de negocio y transformación digital para empresas del top 100 del Perú',
      'Trabajo simultáneamente con 3 a 4 clientes en industrias distintas: retail, banca, manufactura y consumo masivo',
      'Uso múltiples IAs para investigación de mercado, estructurar presentaciones ejecutivas y redactar entregables para el directorio',
      'Mi metodología sigue el framework de resolución de problemas estructurado, similar al de McKinsey: issue tree, hipótesis y validación con datos',
      'El mayor dolor en mi trabajo es que cada cliente requiere cambiar completamente de contexto e industria, y las IAs nunca recuerdan nada entre sesiones',
    ],
  },
];
