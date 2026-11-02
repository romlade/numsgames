import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, Send, Ticket, Copy, CheckCheck, Gamepad2, LayoutGrid } from 'lucide-react';
import { CATALOG_ITEMS, CATEGORIES_CONFIG } from './data/catalog';
import { CategoryKey } from './types';

// Petit icône Python officiel et net
function PythonIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.006 2.752h5.81v.825H3.89s-3.89-.442-3.89 5.82c0 6.26 3.402 6.04 3.402 6.04h2.032v-2.85s-.11-3.402 3.345-3.402h5.753s3.238.052 3.238-3.13V2.656S18.31 0 11.914 0zm-3.21 1.764a1.058 1.058 0 1 1 0 2.116 1.058 1.058 0 0 1 0-2.116z" />
      <path d="M12.086 24c6.094 0 5.714-2.656 5.714-2.656l-.006-2.752h-5.81v-.825h8.126s3.89.442 3.89-5.82c0-6.26-3.402-6.04-3.402-6.04h-2.032v2.85s.11 3.402-3.345 3.402H9.47s-3.238-.052-3.238 3.13v6.052S5.69 24 12.086 24zm3.21-1.764a1.058 1.058 0 1 1 0-2.116 1.058 1.058 0 0 1 0-2.116z" />
    </svg>
  );
}

type Page = 'home' | CategoryKey | 'ticket';

interface OrderReceipt {
  ticketId: string;
  categoryTitle: string;
  prenom: string;
  nom: string;
  items: string[];
  demandeLibre: string;
  totalPrice?: string;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedItems, setSelectedItems] = useState<Record<CategoryKey, string[]>>({
    python: [],
    emulateurs: [],
    applications: [],
  });
  const [pythonSubFilter, setPythonSubFilter] = useState<'all' | 'Jeux & Arcade' | 'Réflexion & Échecs'>('all');
  const [emuSubFilter, setEmuSubFilter] = useState<'all' | 'color' | 'classic'>('all');
  const [appSubFilter, setAppSubFilter] = useState<'all' | 'super' | 'individual'>('all');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [demandeLibre, setDemandeLibre] = useState('');
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [copied, setCopied] = useState(false);

  // Synchronisation du hash de navigation
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '') as Page;
      if (['home', 'python', 'emulateurs', 'applications', 'ticket'].includes(hash)) {
        setCurrentPage(hash);
      } else if (!hash) {
        setCurrentPage('home');
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const goTo = (p: Page) => {
    setCurrentPage(p);
    window.location.hash = p === 'home' ? '' : p;
  };

  const toggleItemForCurrent = (cat: CategoryKey, itemId: string) => {
    setSelectedItems((prev) => {
      const list = prev[cat] || [];
      if (cat === 'emulateurs' || cat === 'applications') {
        // Un seul jeu ou une seule application autorisé(e) : si déjà sélectionné on retire, sinon on remplace par le nouveau
        const updated = list.includes(itemId) ? [] : [itemId];
        return { ...prev, [cat]: updated };
      }
      const updated = list.includes(itemId)
        ? list.filter((id) => id !== itemId)
        : [...list, itemId];
      return { ...prev, [cat]: updated };
    });
  };

  const currentCategoryConfig =
    currentPage !== 'home' && currentPage !== 'ticket'
      ? CATEGORIES_CONFIG[currentPage]
      : null;

  const currentCategoryItems =
    currentPage !== 'home' && currentPage !== 'ticket'
      ? CATALOG_ITEMS.filter((i) => {
          if (i.category !== currentPage) return false;
          if (currentPage === 'python' && pythonSubFilter !== 'all') {
            return i.subcategory?.includes(pythonSubFilter);
          }
          if (currentPage === 'emulateurs') {
            if (emuSubFilter === 'color') return i.isColor === true;
            if (emuSubFilter === 'classic') return i.isColor === false;
          }
          if (currentPage === 'applications') {
            if (appSubFilter === 'super') return i.isSuperApp === true;
            if (appSubFilter === 'individual') return !i.isSuperApp;
          }
          return true;
        })
      : [];

  const currentSelectedIds =
    currentPage !== 'home' && currentPage !== 'ticket'
      ? selectedItems[currentPage] || []
      : [];

  const currentSelectedObjects = CATALOG_ITEMS.filter(
    (i) => i.category === currentPage && currentSelectedIds.includes(i.id)
  );

  const currentSelectedTitles = currentSelectedObjects.map((i) => i.filename || i.title);

  // Tarification pour Python : paquet de 3 à 2 euros
  const pythonCount = (selectedItems.python || []).length;
  const pythonPacks = Math.ceil(pythonCount / 3);
  const pythonPrice = pythonCount > 0 ? pythonPacks * 2 : 0;
  const pythonRemainingToFullPack = pythonCount > 0 ? (3 - (pythonCount % 3)) % 3 : 0;

  // Tarification pour Émulateurs : 1 seul émulateur (4 € en couleur, 3 € en noir et blanc)
  const emuSelectedObjects = CATALOG_ITEMS.filter(
    (i) => i.category === 'emulateurs' && (selectedItems.emulateurs || []).includes(i.id)
  );
  const emuCount = emuSelectedObjects.length;
  const selectedEmu = emuSelectedObjects[0];
  const emuPrice = selectedEmu ? (selectedEmu.isColor ? 4 : 3) : 0;

  // Tarification pour Applications : 1 seule application possible (4 € individuelle, 5 € pour NumPlay Super App)
  const appSelectedObjects = CATALOG_ITEMS.filter(
    (i) => i.category === 'applications' && (selectedItems.applications || []).includes(i.id)
  );
  const appCount = appSelectedObjects.length;
  const selectedApp = appSelectedObjects[0];
  const appPrice = selectedApp ? (selectedApp.isSuperApp ? 5 : 4) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prenom.trim() || !nom.trim() || !currentCategoryConfig) return;

    const allTitles = [...currentSelectedTitles];
    if (demandeLibre.trim()) {
      allTitles.push(demandeLibre.trim());
    }

    const priceText =
      currentPage === 'python'
        ? pythonCount > 0
          ? `${pythonPrice} € (${pythonPacks} paquet${pythonPacks > 1 ? 's' : ''} de 3)`
          : '2 € le paquet de 3'
        : currentPage === 'emulateurs'
        ? emuCount > 0
          ? `${emuPrice} € (${selectedEmu?.isColor ? '1 jeu couleur 4 €' : '1 jeu noir et blanc 3 €'})`
          : '3 € (N&B) · 4 € (Couleur)'
        : appCount > 0
        ? `${appPrice} € (${selectedApp?.isSuperApp ? 'Super App 5 €' : '1 application 4 €'})`
        : '1 seule app : 4 € ou 5 €';

    const newReceipt: OrderReceipt = {
      ticketId: `NG-${Math.floor(1000 + Math.random() * 9000)}`,
      categoryTitle: currentCategoryConfig.title,
      prenom: prenom.trim(),
      nom: nom.trim(),
      items: allTitles.length > 0 ? allTitles : ['Sélection standard'],
      demandeLibre: demandeLibre.trim(),
      totalPrice: priceText,
    };

    setReceipt(newReceipt);
    goTo('ticket');
  };

  const copyReceipt = () => {
    if (!receipt) return;
    const text = `TICKET NUMSGAMES #${receipt.ticketId}\nCatégorie : ${receipt.categoryTitle}\nNom : ${receipt.prenom} ${receipt.nom}\nJeux : ${receipt.items.join(', ')}\nPrix : ${receipt.totalPrice || '2 €'}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-white text-neutral-950 flex flex-col font-sans select-none">
      
      {/* HEADER MINIMAL NOIR SUR BLANC */}
      <header className="h-14 border-b-2 border-neutral-900 px-4 sm:px-6 flex items-center justify-between shrink-0 bg-white z-20">
        <button
          type="button"
          onClick={() => goTo('home')}
          className="text-xl font-black tracking-tight text-neutral-950 hover:text-amber-600 transition-colors flex items-center gap-1 cursor-pointer"
        >
          NumsGames<span className="text-amber-500">.</span>
        </button>

        {currentPage !== 'home' && (
          <button
            type="button"
            onClick={() => goTo('home')}
            className="text-xs font-semibold text-neutral-600 hover:text-black transition-colors flex items-center gap-1.5 cursor-pointer bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 px-3 py-1.5 rounded-lg"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Changer de catégorie</span>
          </button>
        )}
      </header>

      {/* ZONE CENTRALE (PAS DE DÉFILEMENT GLOBAL, NOIR SUR BLANC) */}
      <main className="flex-1 overflow-y-auto sm:overflow-hidden p-3 sm:p-5 flex flex-col justify-center items-center bg-[#fafafa]">
        <div className="w-full max-w-5xl mx-auto h-full flex flex-col justify-center">

          {/* ========================================================= */}
          {/* PAGE 1 : ACCUEIL - 3 CARRÉS ALIGNÉS EN THÈME CLAIR        */}
          {/* ========================================================= */}
          {currentPage === 'home' && (
            <div className="flex flex-col items-center justify-center my-auto py-2 text-center">
              
              {/* Grand Titre NumsGames en grand */}
              <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter text-black leading-none mb-8">
                Nums<span className="text-amber-500">Games</span>
              </h1>

              {/* LES TROIS PROPOSITIONS EN FORME DE CARRÉ ALIGNÉ (TACTILE NUMWORKS NOIR SUR BLANC) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-4xl mb-6">
                
                {/* Carré 1 : Scripts Python (icône Python, sans nom d'auteur) */}
                <button
                  type="button"
                  onClick={() => goTo('python')}
                  className="group aspect-square p-6 sm:p-7 rounded-3xl bg-white border-2 border-black border-b-[7px] hover:border-black active:border-b-2 active:translate-y-1 text-left transition-all hover:-translate-y-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.06)] cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center justify-center p-2.5 rounded-2xl bg-amber-100 text-amber-700 border-2 border-black shadow-[1px_1px_0px_#000] group-hover:scale-110 transition-transform">
                      <PythonIcon className="w-5 h-5" />
                    </span>
                    <span className="text-[11px] font-mono font-black text-black bg-amber-300 border border-black px-2 py-0.5 rounded-md shadow-[1px_1px_0px_#000]">
                      3 pour 2 €
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-black group-hover:text-amber-600 transition-colors mb-1.5">
                      Scripts Python
                    </h2>
                    <p className="text-xs text-neutral-600 font-medium leading-snug">
                      19 scripts disponibles (2048, Snake, Pong, Tanks, Flappy, Tetris, Sudoku, Échecs...).
                    </p>
                  </div>

                  <div className="text-[11px] font-mono font-bold text-black pt-2 border-t-2 border-neutral-100 flex items-center justify-between">
                    <span>Ouvrir la liste (19 jeux)</span>
                    <ArrowRight className="w-4 h-4 text-black group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* Carré 2 : Émulateurs */}
                <button
                  type="button"
                  onClick={() => goTo('emulateurs')}
                  className="group aspect-square p-6 sm:p-7 rounded-3xl bg-white border-2 border-black border-b-[7px] hover:border-black active:border-b-2 active:translate-y-1 text-left transition-all hover:-translate-y-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.06)] cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center justify-center p-2.5 rounded-2xl bg-sky-100 text-sky-800 border-2 border-black shadow-[1px_1px_0px_#000] group-hover:scale-110 transition-transform">
                      <Gamepad2 className="w-5 h-5" />
                    </span>
                    <span className="text-[11px] font-mono font-black text-black bg-sky-200 border border-black px-2 py-0.5 rounded-md shadow-[1px_1px_0px_#000]">
                      1 jeu : 3 € ou 4 €
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-black group-hover:text-sky-700 transition-colors mb-1.5">
                      Émulateurs
                    </h2>
                    <p className="text-xs text-neutral-600 font-medium leading-snug">
                      10 jeux disponibles (1 seul émulateur au choix : 4 € en couleur · 3 € en noir et blanc). Pokémon Cristal, Or, Argent en couleur, Mario, Zelda...
                    </p>
                  </div>

                  <div className="text-[11px] font-mono font-bold text-sky-900 pt-2 border-t-2 border-neutral-100 flex items-center justify-between">
                    <span>Choisir mon jeu (3 € N&B · 4 € Couleur)</span>
                    <ArrowRight className="w-4 h-4 text-black group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* Carré 3 : Appli */}
                <button
                  type="button"
                  onClick={() => goTo('applications')}
                  className="group aspect-square p-6 sm:p-7 rounded-3xl bg-white border-2 border-black border-b-[7px] hover:border-black active:border-b-2 active:translate-y-1 text-left transition-all hover:-translate-y-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.06)] cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center justify-center p-2.5 rounded-2xl bg-emerald-100 text-emerald-800 border-2 border-black shadow-[1px_1px_0px_#000] group-hover:scale-110 transition-transform">
                      <LayoutGrid className="w-5 h-5" />
                    </span>
                    <span className="text-[11px] font-mono font-black text-black bg-emerald-200 border border-black px-2 py-0.5 rounded-md shadow-[1px_1px_0px_#000]">
                      1 app : 4 € ou 5 €
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-black group-hover:text-emerald-700 transition-colors mb-1.5">
                      Appli
                    </h2>
                    <p className="text-xs text-neutral-600 font-medium leading-snug">
                      27 apps disponibles (1 seule app installable : 4 € individuelle · 5 € Super App). Celeste, Hollow Knight, Undertale...
                    </p>
                  </div>

                  <div className="text-[11px] font-mono font-bold text-emerald-900 pt-2 border-t-2 border-neutral-100 flex items-center justify-between">
                    <span>Choisir mon application (1 seule)</span>
                    <ArrowRight className="w-4 h-4 text-black group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* PAGES DÉDIÉES : SCRIPTS PYTHON, ÉMULATEURS, OU APPLI      */}
          {/* ========================================================= */}
          {currentCategoryConfig && (
            <div className="flex flex-col h-full max-h-full py-1">
              
              {/* Entête de la page dédiée avec bouton retour */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2 border-b-2 border-neutral-200 shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => goTo('home')}
                    className="p-1.5 rounded-xl bg-white text-black hover:bg-neutral-100 border-2 border-black shadow-[1px_1px_0px_#000] transition-colors cursor-pointer"
                    title="Retour aux 3 carrés"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-amber-100 border-2 border-black text-neutral-950 inline-flex items-center justify-center shadow-[1px_1px_0px_#000]">
                        {currentPage === 'python' && <PythonIcon className="w-4 h-4 text-amber-700" />}
                        {currentPage === 'emulateurs' && <Gamepad2 className="w-4 h-4 text-sky-700" />}
                        {currentPage === 'applications' && <LayoutGrid className="w-4 h-4 text-emerald-700" />}
                      </span>
                      <h2 className="text-lg sm:text-xl font-black text-black">
                        {currentCategoryConfig.title}
                      </h2>
                      {currentPage === 'python' && (
                        <span className="ml-1 text-[11px] font-mono font-black text-black bg-amber-300 border border-black px-2.5 py-0.5 rounded-full shadow-[1px_1px_0px_#000]">
                          Paquet de 3 à 2 €
                        </span>
                      )}
                      {currentPage === 'emulateurs' && (
                        <span className="ml-1 text-[11px] font-mono font-black text-black bg-sky-200 border border-black px-2.5 py-0.5 rounded-full shadow-[1px_1px_0px_#000]">
                          1 seul jeu : 3 € (N&B) · 4 € (Couleur)
                        </span>
                      )}
                      {currentPage === 'applications' && (
                        <span className="ml-1 text-[11px] font-mono font-black text-black bg-emerald-200 border border-black px-2.5 py-0.5 rounded-full shadow-[1px_1px_0px_#000]">
                          1 seule appli : 4 € ou 5 €
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subcategory filter for Python: All, Jeux & Arcade, Réflexion */}
                {currentPage === 'python' && (
                  <div className="flex items-center gap-1 bg-white border-2 border-black p-1 rounded-xl text-xs shadow-[1px_1px_0px_#000]">
                    <button
                      type="button"
                      onClick={() => setPythonSubFilter('all')}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-bold ${
                        pythonSubFilter === 'all'
                          ? 'bg-black text-white'
                          : 'text-neutral-700 hover:text-black hover:bg-neutral-100'
                      }`}
                    >
                      Tous (19)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPythonSubFilter('Jeux & Arcade')}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-bold ${
                        pythonSubFilter === 'Jeux & Arcade'
                          ? 'bg-black text-white'
                          : 'text-neutral-700 hover:text-black hover:bg-neutral-100'
                      }`}
                    >
                      🎮 Jeux & Arcade (13)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPythonSubFilter('Réflexion & Échecs')}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-bold ${
                        pythonSubFilter === 'Réflexion & Échecs'
                          ? 'bg-black text-white'
                          : 'text-neutral-700 hover:text-black hover:bg-neutral-100'
                      }`}
                    >
                      🧩 Réflexion (6)
                    </button>
                  </div>
                )}

                {/* Subcategory filter for Émulateurs: All, Jeux en Couleur, Noir & Blanc */}
                {currentPage === 'emulateurs' && (
                  <div className="flex items-center gap-1 bg-white border-2 border-black p-1 rounded-xl text-xs shadow-[1px_1px_0px_#000]">
                    <button
                      type="button"
                      onClick={() => setEmuSubFilter('all')}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-bold ${
                        emuSubFilter === 'all'
                          ? 'bg-black text-white'
                          : 'text-neutral-700 hover:text-black hover:bg-neutral-100'
                      }`}
                    >
                      Tous (10)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmuSubFilter('color')}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-black flex items-center gap-1.5 ${
                        emuSubFilter === 'color'
                          ? 'bg-amber-300 text-black border border-black shadow-[1px_1px_0px_#000]'
                          : 'text-neutral-800 hover:text-black hover:bg-amber-50'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span>🎨 En Couleur · 4 € (3)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmuSubFilter('classic')}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-bold ${
                        emuSubFilter === 'classic'
                          ? 'bg-black text-white'
                          : 'text-neutral-700 hover:text-black hover:bg-neutral-100'
                      }`}
                    >
                      Noir & Blanc · 3 € (7)
                    </button>
                  </div>
                )}

                {/* Subcategory filter for Applications: Toutes, Super App (5€), Individuelle (4€) */}
                {currentPage === 'applications' && (
                  <div className="flex items-center gap-1 bg-white border-2 border-black p-1 rounded-xl text-xs shadow-[1px_1px_0px_#000]">
                    <button
                      type="button"
                      onClick={() => setAppSubFilter('all')}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-bold ${
                        appSubFilter === 'all'
                          ? 'bg-black text-white'
                          : 'text-neutral-700 hover:text-black hover:bg-neutral-100'
                      }`}
                    >
                      Toutes (27)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAppSubFilter('super')}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-black flex items-center gap-1.5 ${
                        appSubFilter === 'super'
                          ? 'bg-amber-300 text-black border border-black shadow-[1px_1px_0px_#000]'
                          : 'text-neutral-800 hover:text-black hover:bg-amber-50'
                      }`}
                    >
                      <span>⭐ Super App 5 € (1)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAppSubFilter('individual')}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-bold ${
                        appSubFilter === 'individual'
                          ? 'bg-black text-white'
                          : 'text-neutral-700 hover:text-black hover:bg-neutral-100'
                      }`}
                    >
                      Individuelles 4 € (26)
                    </button>
                  </div>
                )}
              </div>

              {/* Contenu de la page : Choix des éléments + Formulaire + LCD */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 flex-1 min-h-0 overflow-y-auto sm:overflow-visible">
                
                {/* Colonne gauche : Puces à cocher de la catégorie (SANS NOM D'AUTEUR) */}
                <div className="md:col-span-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
                        {currentPage === 'emulateurs' ? (
                          <span>Choisis 1 seul jeu (3 € N&B · 4 € Couleur) :</span>
                        ) : currentPage === 'applications' ? (
                          <span>Choisis 1 seule application :</span>
                        ) : (
                          <span>Coche tes jeux :</span>
                        )}
                        {currentPage === 'python' && (
                          <span className="text-amber-700 font-mono text-[11px] font-bold">
                            ({currentSelectedIds.length} coché{currentSelectedIds.length > 1 ? 's' : ''})
                          </span>
                        )}
                        {currentPage === 'emulateurs' && (
                          <span className="text-sky-800 font-mono text-[11px] font-bold">
                            ({currentSelectedIds.length}/1 sélectionné{emuPrice > 0 ? ` · ${emuPrice} €` : ''})
                          </span>
                        )}
                        {currentPage === 'applications' && (
                          <span className="text-emerald-800 font-mono text-[11px] font-bold">
                            ({currentSelectedIds.length}/1 sélectionnée{appPrice > 0 ? ` · ${appPrice} €` : ''})
                          </span>
                        )}
                      </span>

                      {currentSelectedIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedItems((prev) => ({
                              ...prev,
                              [currentCategoryConfig.key]: [],
                            }))
                          }
                          className="text-[11px] text-neutral-500 hover:text-black font-semibold cursor-pointer underline"
                        >
                          Décocher
                        </button>
                      )}
                    </div>

                    {/* Liste des jeux/scripts */}
                    <div className="space-y-1.5 max-h-[300px] sm:max-h-[340px] overflow-y-auto pr-1">
                      {currentCategoryItems.map((item) => {
                        const isPicked = currentSelectedIds.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              toggleItemForCurrent(currentCategoryConfig.key, item.id)
                            }
                            className={`w-full p-2.5 rounded-xl border-2 text-left transition-all flex items-start gap-2.5 text-xs cursor-pointer ${
                              isPicked
                                ? 'bg-amber-50 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-white border-neutral-300 text-neutral-800 hover:border-black'
                            }`}
                          >
                            {/* Checkbox notation [ ] / [✓] ou Radio (●) pour émulateur et appli */}
                            <span
                              className={`w-5 h-5 flex items-center justify-center font-mono font-bold shrink-0 text-xs mt-0.5 transition-colors border-2 ${
                                currentPage === 'emulateurs' || currentPage === 'applications'
                                  ? 'rounded-full'
                                  : 'rounded-md'
                              } ${
                                isPicked
                                  ? 'bg-black text-white border-black'
                                  : 'bg-neutral-50 text-neutral-400 border-neutral-300'
                              }`}
                            >
                              {isPicked
                                ? currentPage === 'emulateurs' || currentPage === 'applications'
                                  ? '●'
                                  : '✓'
                                : ''}
                            </span>

                            <div className="truncate flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-black text-black text-xs">
                                  {item.title}
                                </span>

                                {/* Badge très voyant pour les jeux en couleur (4 €) */}
                                {item.isColor && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black font-mono tracking-wider bg-amber-300 text-black border-2 border-black shadow-[1px_1px_0px_#000]">
                                    <span>🎨 JEU EN COULEUR · 4 €</span>
                                  </span>
                                )}

                                {currentPage === 'emulateurs' && !item.isColor && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-neutral-700 bg-neutral-100 border border-neutral-300">
                                    Noir & Blanc · 3 €
                                  </span>
                                )}

                                {/* Badge Super App pour NumPlay */}
                                {item.isSuperApp && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black font-mono tracking-wider bg-amber-300 text-black border-2 border-black shadow-[1px_1px_0px_#000]">
                                    <span>⭐ SUPER APP · 5 €</span>
                                  </span>
                                )}

                                {currentPage === 'applications' && !item.isSuperApp && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-neutral-700 bg-neutral-100 border border-neutral-300">
                                    4 €
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-neutral-600 leading-snug mt-0.5 line-clamp-1">
                                {item.description}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Écran LCD authentique NumWorks (fond clair, bordure noire, texte DM Mono) */}
                  <div className="mt-2.5 p-3 rounded-xl bg-white border-3 border-black font-mono text-xs text-black shadow-[inset_0_2px_6px_rgba(0,0,0,0.1)]">
                    <div className="text-black font-black text-[11px] flex justify-between border-b border-neutral-200 pb-1 mb-1">
                      <span>&gt; {currentCategoryConfig.title.toUpperCase()}</span>
                      {currentPage === 'python' && (
                        <span className="text-amber-700 font-black">
                          {pythonCount > 0 ? `TOTAL : ${pythonPrice} € (${pythonPacks} paquet${pythonPacks > 1 ? 's' : ''})` : '2 € LE PAQUET DE 3'}
                        </span>
                      )}
                      {currentPage === 'emulateurs' && (
                        <span className="text-sky-800 font-black">
                          {emuCount > 0
                            ? `PRIX : ${emuPrice} € (${selectedEmu?.isColor ? 'COULEUR' : 'NOIR & BLANC'})`
                            : '1 SEUL EMULATEUR (3 € N&B / 4 € COULEUR)'}
                        </span>
                      )}
                      {currentPage === 'applications' && (
                        <span className="text-emerald-800 font-black">
                          {appCount > 0 ? `PRIX : ${appPrice} € (1 SEULE APPLI)` : '1 SEULE APPLI POSSIBLE (4 € / 5 €)'}
                        </span>
                      )}
                    </div>
                    <div className="text-neutral-900 font-bold text-[11px] truncate">
                      &gt; {prenom || nom ? `${prenom} ${nom}`.trim() : 'Nom Prénom...'}
                    </div>
                    <div className="text-neutral-700 text-[11px] truncate">
                      &gt; {currentSelectedTitles.length > 0 ? currentSelectedTitles.join(', ') : 'Aucun script coché'}
                    </div>
                    {currentPage === 'python' && pythonCount > 0 && pythonRemainingToFullPack > 0 && (
                      <div className="text-amber-800 text-[10px] pt-1 font-semibold">
                        &gt; Astuce : tu peux encore choisir {pythonRemainingToFullPack} script{pythonRemainingToFullPack > 1 ? 's' : ''} sans surcoût dans ton paquet !
                      </div>
                    )}
                  </div>
                </div>

                {/* Colonne droite : Formulaire de commande Noir sur Blanc */}
                <form
                  onSubmit={handleSubmit}
                  className="md:col-span-6 bg-white border-2 border-black rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-[3px_3px_0px_#000]"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-black text-black uppercase tracking-wider pb-1 border-b border-neutral-200">
                      <span>Coordonnées de commande</span>
                      {currentPage === 'python' && (
                        <span className="text-black bg-amber-300 border border-black px-2 py-0.5 rounded font-mono font-black text-xs shadow-[1px_1px_0px_#000]">
                          {pythonCount > 0 ? `${pythonPrice} €` : '2 € / 3 scripts'}
                        </span>
                      )}
                      {currentPage === 'emulateurs' && (
                        <span className="text-black bg-sky-200 border border-black px-2 py-0.5 rounded font-mono font-black text-xs shadow-[1px_1px_0px_#000]">
                          {emuCount > 0 ? `${emuPrice} € (${selectedEmu?.isColor ? 'Couleur' : 'Noir & Blanc'})` : '3 € N&B · 4 € Couleur'}
                        </span>
                      )}
                      {currentPage === 'applications' && (
                        <span className="text-black bg-emerald-200 border border-black px-2 py-0.5 rounded font-mono font-black text-xs shadow-[1px_1px_0px_#000]">
                          {appCount > 0 ? `${appPrice} € (1 appli)` : '1 app max (4 € / 5 €)'}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <label className="block space-y-1">
                        <span className="text-[11px] font-black text-black">Prénom *</span>
                        <input
                          type="text"
                          required
                          value={prenom}
                          onChange={(e) => setPrenom(e.target.value)}
                          placeholder="Ton prénom"
                          className="w-full bg-neutral-50 border-2 border-neutral-300 focus:border-black text-black rounded-lg p-2 text-xs focus:outline-none"
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-[11px] font-black text-black">Nom *</span>
                        <input
                          type="text"
                          required
                          value={nom}
                          onChange={(e) => setNom(e.target.value)}
                          placeholder="Ton nom"
                          className="w-full bg-neutral-50 border-2 border-neutral-300 focus:border-black text-black rounded-lg p-2 text-xs focus:outline-none"
                        />
                      </label>
                    </div>

                    <label className="block space-y-1">
                      <span className="text-[11px] font-black text-black">
                        Remarque ou précision (optionnel)
                      </span>
                      <textarea
                        rows={2}
                        value={demandeLibre}
                        onChange={(e) => setDemandeLibre(e.target.value)}
                        placeholder="Ex: Une précision sur ta console ou version ?"
                        className="w-full bg-neutral-50 border-2 border-neutral-300 focus:border-black text-black rounded-lg p-2 text-xs focus:outline-none resize-none"
                      />
                    </label>

                    {/* Rappel prix & règlement */}
                    <div className="text-[11px] text-neutral-700 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200 flex items-center justify-between">
                      <span className="font-black text-black">Règlement en main propre :</span>
                      <span className="text-black font-mono font-bold">
                        {currentPage === 'python' && (pythonCount > 0 ? `${pythonPrice} €` : '2 € le paquet de 3')}
                        {currentPage === 'emulateurs' && (emuCount > 0 ? `${emuPrice} € (${selectedEmu?.isColor ? '1 émulateur couleur 4 €' : '1 émulateur noir & blanc 3 €'})` : '1 émulateur (3 € N&B · 4 € Couleur)')}
                        {currentPage === 'applications' && (appCount > 0 ? `${appPrice} € (1 application)` : '1 seule application (4 € indiv. / 5 € super app)')}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-neutral-200 flex items-center justify-between gap-3 mt-2">
                    <span className="text-xs font-mono font-bold text-neutral-700">
                      {currentPage === 'emulateurs' ? (
                        <span>
                          {currentSelectedIds.length}/1 émulateur
                          {emuCount > 0 && <span className="text-black font-black ml-1">({emuPrice} €)</span>}
                        </span>
                      ) : currentPage === 'python' ? (
                        <span>
                          {currentSelectedIds.length} script{currentSelectedIds.length > 1 ? 's' : ''}
                          {pythonCount > 0 && (
                            <span className="text-black font-black ml-1">({pythonPrice} €)</span>
                          )}
                        </span>
                      ) : (
                        <span>
                          {currentSelectedIds.length}/1 application
                          {appCount > 0 && (
                            <span className="text-black font-black ml-1">({appPrice} €)</span>
                          )}
                        </span>
                      )}
                    </span>

                    <button
                      type="submit"
                      disabled={!prenom.trim() || !nom.trim()}
                      className="px-6 py-2.5 bg-black hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-[2px_2px_0px_rgba(0,0,0,0.3)] flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Envoyer ma commande</span>
                    </button>
                  </div>
                </form>

              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* PAGE : TICKET DE CONFIRMATION (THÈME CLAIR NOIR SUR BLANC) */}
          {/* ========================================================= */}
          {currentPage === 'ticket' && receipt && (
            <div className="flex flex-col items-center justify-center my-auto text-center py-4">
              <div className="w-full max-w-lg bg-white border-3 border-black rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_#000] relative">
                
                <div className="w-12 h-12 rounded-full bg-amber-400 border-2 border-black text-black flex items-center justify-center mx-auto mb-3 font-black shadow-[2px_2px_0px_#000]">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>

                <div className="text-black font-mono text-xs font-black uppercase tracking-wider mb-1">
                  Commande validée avec succès !
                </div>
                <h2 className="text-2xl font-black text-black mb-4">
                  Ticket #{receipt.ticketId}
                </h2>

                <div className="bg-neutral-50 p-4 rounded-xl border-2 border-black text-left font-mono text-xs text-black space-y-1.5 mb-5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]">
                  <div>&gt; CATEGORIE : {receipt.categoryTitle}</div>
                  <div>&gt; ELEVE : {receipt.prenom} {receipt.nom}</div>
                  <div>&gt; PROGRAMMES : {receipt.items.join(', ')}</div>
                  {receipt.totalPrice && (
                    <div className="text-black font-black bg-amber-200 inline-block px-1 rounded">&gt; PRIX : {receipt.totalPrice}</div>
                  )}
                  <div className="text-emerald-700 pt-1 font-bold">
                    &gt; STATUT : Prêt pour le dépôt demain au lycée
                  </div>
                </div>

                <div className="text-xs text-neutral-800 bg-amber-50 border-2 border-black p-3 rounded-xl mb-6 text-left shadow-[2px_2px_0px_#000]">
                  <strong>Consigne avant de me donner ta calculatrice :</strong> Écris ton nom ({receipt.prenom} {receipt.nom}) et le code <strong>#{receipt.ticketId}</strong> sur un morceau de scotch ou étiquette au dos de ta calculatrice. Tu paies {receipt.totalPrice || 'en main propre'} au moment où tu me la donnes.
                </div>

                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={copyReceipt}
                    className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-black border-2 border-black rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer shadow-[2px_2px_0px_#000]"
                  >
                    {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copié !' : 'Copier le ticket'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrenom('');
                      setNom('');
                      setDemandeLibre('');
                      goTo('home');
                    }}
                    className="px-5 py-2.5 bg-black hover:bg-neutral-800 text-white font-black rounded-xl text-xs transition-colors cursor-pointer shadow-[2px_2px_0px_rgba(0,0,0,0.2)]"
                  >
                    Retour aux 3 propositions
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      </main>

    </div>
  );
}
