export type CategoryKey = 'python' | 'emulateurs' | 'applications';

export interface CatalogItem {
  id: string;
  filename: string;
  title: string;
  author?: string;
  subcategory?: string;
  category: CategoryKey;
  categoryLabel: string;
  badge: string;
  description: string;
  sizeKb: number;
  isColor?: boolean; // Permet d'identifier facilement les jeux en couleur (Game Boy Color)
  price?: number;
  isSuperApp?: boolean;
}

export interface StoredOrder {
  id: string;
  ticketId: string;
  categoryTitle: string;
  prenom: string;
  nom: string;
  items: string[];
  demandeLibre?: string;
  totalPrice: string;
  date: string;
  status: 'En attente' | 'Prêt' | 'Terminé';
}

