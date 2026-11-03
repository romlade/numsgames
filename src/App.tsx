import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Send,
  Ticket,
  Copy,
  CheckCheck,
  Gamepad2,
  LayoutGrid,
  KeyRound,
  Lock,
  Unlock,
  Trash2,
  X,
  Search,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Cloud,
  FileText,
  Mail,
  Bell,
  ExternalLink
} from 'lucide-react';

import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { CATALOG_ITEMS, CATEGORIES_CONFIG } from './data/catalog';
import { CategoryKey, StoredOrder } from './types';

export const NOTIFICATION_EMAIL = 'roman.lagardefrance@gmail.com';
export const DEFAULT_WEB3FORMS_KEY = '78e7dd71-b3a8-4310-a3f0-805e10ce1320';

export function getSavedWeb3Key(): string {
  try {
    return localStorage.getItem('numsgames_web3forms_key') || DEFAULT_WEB3FORMS_KEY;
  } catch {
    return DEFAULT_WEB3FORMS_KEY;
  }
}

export function saveWeb3Key(key: string): void {
  try {
    localStorage.setItem('numsgames_web3forms_key', key.trim());
  } catch (e) {
    console.error(e);
  }
}

export function createGmailComposeUrl(order: StoredOrder): string {
  const subject = encodeURIComponent(`[NumsGames] Commande #${order.ticketId} - ${order.prenom} ${order.nom}`);
  const body = encodeURIComponent(
    `NOUVELLE COMMANDE NUMSGAMES\n` +
    `----------------------------------------\n` +
    `Numéro de Ticket : #${order.ticketId}\n` +
    `Élève : ${order.prenom} ${order.nom}\n` +
    `Catégorie : ${order.categoryTitle}\n` +
    `Jeux / Programmes : ${order.items.join(', ')}\n` +
    `Montant estimé : ${order.totalPrice}\n` +
    `Précision : ${order.demandeLibre || 'Aucune'}\n` +
    `Date : ${order.date}\n` +
    `Statut : ${order.status}\n` +
    `----------------------------------------\n` +
    `Accéder aux commandes : https://romlade.github.io/numsgames/`
  );
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(NOTIFICATION_EMAIL)}&su=${subject}&body=${body}`;
}

export function createMailtoUrl(order: StoredOrder): string {
  const subject = encodeURIComponent(`[NumsGames] Commande #${order.ticketId} - ${order.prenom} ${order.nom}`);
  const body = encodeURIComponent(
    `Ticket #${order.ticketId} - Élève : ${order.prenom} ${order.nom}\nCatégorie : ${order.categoryTitle}\nArticles : ${order.items.join(', ')}\nPrix : ${order.totalPrice}`
  );
  return `mailto:${NOTIFICATION_EMAIL}?subject=${subject}&body=${body}`;
}

// Envoi automatique d'un e-mail récapitulatif dès réception d'une commande
export async function sendOrderEmailNotification(
  order: StoredOrder,
  customKey?: string
): Promise<{ success: boolean; is522?: boolean; provider?: 'shipmyform' | 'web3forms' | 'formsubmit'; message?: string }> {
  const web3Key = (customKey && customKey.trim()) ? customKey.trim() : getSavedWeb3Key();

  // 1. Envoi prioritaire via Web3Forms si l'utilisateur a renseigné sa propre clé
  if (web3Key && web3Key.trim()) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          access_key: web3Key.trim(),
          subject: `[NumsGames] Nouvelle commande #${order.ticketId} - ${order.prenom} ${order.nom}`,
          from_name: 'NumsGames',
          email: NOTIFICATION_EMAIL,
          'Numéro de Ticket': `#${order.ticketId}`,
          'Élève': `${order.prenom} ${order.nom}`,
          'Catégorie': order.categoryTitle,
          'Programmes': order.items.join(', '),
          'Montant estimé': order.totalPrice,
          'Précision': order.demandeLibre || 'Aucune',
          'Date': order.date,
          'Statut': order.status,
          message: `Ticket #${order.ticketId}\nÉlève : ${order.prenom} ${order.nom}\nCatégorie : ${order.categoryTitle}\nProgrammes : ${order.items.join(', ')}\nMontant : ${order.totalPrice}\nDate : ${order.date}`,
        }),
      });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        return { success: true, provider: 'web3forms' };
      }
    } catch (err: unknown) {
      console.warn('Erreur Web3Forms:', err);
    }
  }

  // 2. Envoi automatique immédiat via ShipMyForm (zéro configuration, sans clé, sans panne 522)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const shipPayload = {
      _subject: `[NumsGames] Commande #${order.ticketId} - ${order.prenom} ${order.nom}`,
      _name: 'NumsGames',
      name: 'NumsGames',
      from_name: 'NumsGames',
      Ticket: `#${order.ticketId}`,
      Eleve: `${order.prenom} ${order.nom}`,
      Categorie: order.categoryTitle,
      Programmes: order.items.join(', '),
      Montant: order.totalPrice,
      Precision: order.demandeLibre || 'Aucune',
      Date: order.date,
      Statut: order.status,
      Message: `Nouvelle commande NumsGames :\nTicket: #${order.ticketId}\nÉlève: ${order.prenom} ${order.nom}\nCatégorie: ${order.categoryTitle}\nArticles: ${order.items.join(', ')}\nPrix: ${order.totalPrice}\nDate: ${order.date}`,
    };

    const res = await fetch(`https://shipmyform.com/to/${NOTIFICATION_EMAIL}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(shipPayload),
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return { success: true, provider: 'shipmyform' };
    }
  } catch (err: unknown) {
    console.warn('Erreur ShipMyForm:', err);
  }

  // 3. Secours via FormSubmit (protégé par timeout 4s contre l'erreur 522)
  try {
    const payload = {
      _subject: `[NumsGames] Nouvelle commande #${order.ticketId} - ${order.prenom} ${order.nom}`,
      _template: 'table',
      _captcha: 'false',
      'Numéro de Ticket': `#${order.ticketId}`,
      'Élève': `${order.prenom} ${order.nom}`,
      'Catégorie': order.categoryTitle,
      'Programmes / Jeux': order.items.join(', '),
      'Montant estimé': order.totalPrice,
      'Précision / Demande': order.demandeLibre || 'Aucune',
      'Date': order.date,
      'Statut': order.status,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`https://formsubmit.co/ajax/${NOTIFICATION_EMAIL}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return { success: true, provider: 'formsubmit' };
    }
  } catch (err: unknown) {
    console.warn('Erreur FormSubmit:', err);
  }

  return {
    success: false,
    message: 'Les serveurs relais d\'e-mail n\'ont pas répondu. Utilisez le bouton direct Gmail.',
  };
}

// --- NOTIFICATIONS INSTANTANÉES TELEGRAM BOT ---
export function getSavedTelegramToken(): string {
  try {
    return (
      localStorage.getItem('numsgames_telegram_token') ||
      (import.meta.env.VITE_TELEGRAM_BOT_TOKEN as string) ||
      ''
    );
  } catch {
    return '';
  }
}

export function saveTelegramToken(token: string): void {
  try {
    localStorage.setItem('numsgames_telegram_token', token.trim());
  } catch (e) {
    console.error(e);
  }
}

export function getSavedTelegramChatId(): string {
  try {
    return (
      localStorage.getItem('numsgames_telegram_chat_id') ||
      (import.meta.env.VITE_TELEGRAM_CHAT_ID as string) ||
      ''
    );
  } catch {
    return '';
  }
}

export function saveTelegramChatId(chatId: string): void {
  try {
    localStorage.setItem('numsgames_telegram_chat_id', chatId.trim());
  } catch (e) {
    console.error(e);
  }
}

function escapeTelegramHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function sendTelegramOrderNotification(
  order: StoredOrder,
  customChatId?: string,
  customToken?: string
): Promise<{ success: boolean; message?: string }> {
  const token = (customToken && customToken.trim()) ? customToken.trim() : getSavedTelegramToken();
  const chatId = (customChatId && customChatId.trim()) ? customChatId.trim() : (getSavedTelegramChatId() || '8305493071');

  if (!token || !chatId) {
    return { success: false, message: 'Configuration Telegram manquante (Token ou Chat ID).' };
  }

  try {
    const text =
      `🎮 <b>NOUVELLE COMMANDE NUMSGAMES !</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🎫 <b>Ticket :</b> <code>#${escapeTelegramHtml(order.ticketId)}</code>\n` +
      `👤 <b>Élève :</b> <b>${escapeTelegramHtml(order.prenom)} ${escapeTelegramHtml(order.nom)}</b>\n` +
      `📁 <b>Catégorie :</b> ${escapeTelegramHtml(order.categoryTitle)}\n` +
      `🕹 <b>Programmes :</b> ${escapeTelegramHtml(order.items.join(', '))}\n` +
      `💰 <b>Montant :</b> <b>${escapeTelegramHtml(order.totalPrice)}</b>\n` +
      (order.demandeLibre ? `📝 <b>Précision :</b> <i>${escapeTelegramHtml(order.demandeLibre)}</i>\n` : '') +
      `🕒 <b>Date :</b> ${escapeTelegramHtml(order.date)}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🔗 <a href="https://romlade.github.io/numsgames/">Consulter NumsGames</a>`;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return { success: true };
    }
    return { success: false, message: data.description || 'Erreur Telegram' };
  } catch (err: unknown) {
    console.warn('Erreur transmission Telegram:', err);
    return { success: false, message: String(err) };
  }
}

// Bip sonore discret prévenant Roman quand une commande arrive en direct
function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // Do (C5)
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // Mi (E5)
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // Sol (G5)
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Audio context indisponible
  }
}

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
  const [mobileStep, setMobileStep] = useState<'select' | 'details'>('select');
  const [mobileShowLcd, setMobileShowLcd] = useState(false);

  // --- ESPACE ADMINISTRATEUR (CODE SECRET 1324) ---
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [adminFilter, setAdminFilter] = useState<'tous' | 'En attente' | 'Prêt' | 'Terminé'>('tous');
  const [adminSearch, setAdminSearch] = useState('');
  const [copiedAll, setCopiedAll] = useState(false);

  // Commandes persistées dans Firebase Firestore (avec secours localStorage)
  const [orders, setOrders] = useState<StoredOrder[]>(() => {
    try {
      const saved = localStorage.getItem('numsgames_orders');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [manualTicketText, setManualTicketText] = useState('');
  const [showManualImport, setShowManualImport] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState('');
  const [emailStatusMsg, setEmailStatusMsg] = useState('');
  const [isSendingEmailTest, setIsSendingEmailTest] = useState(false);
  const [showEmailSetup, setShowEmailSetup] = useState(false);
  const [web3KeyInput, setWeb3KeyInput] = useState(() => getSavedWeb3Key());
  const [web3KeySavedMsg, setWeb3KeySavedMsg] = useState('');
  const [showTelegramSetup, setShowTelegramSetup] = useState(false);
  const [telegramTokenInput, setTelegramTokenInput] = useState(() => getSavedTelegramToken());
  const [telegramChatId, setTelegramChatId] = useState(() => getSavedTelegramChatId());
  const [showTelegramTokenMask, setShowTelegramTokenMask] = useState(false);
  const [telegramStatusMsg, setTelegramStatusMsg] = useState('');
  const [isCheckingTelegram, setIsCheckingTelegram] = useState(false);
  const [lastTestOrder, setLastTestOrder] = useState<StoredOrder | null>(null);
  const isFirstFirestoreLoadRef = useRef(true);
  const cloudTelegramTokenRef = useRef<string>(getSavedTelegramToken());
  const cloudTelegramChatIdRef = useRef<string>(getSavedTelegramChatId() || '8305493071');

  // Synchronisation continue des paramètres de notifications (Telegram) depuis Firestore
  useEffect(() => {
    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'notifications'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.telegramToken && typeof data.telegramToken === 'string') {
            cloudTelegramTokenRef.current = data.telegramToken;
            setTelegramTokenInput(data.telegramToken);
            saveTelegramToken(data.telegramToken);
          }
          if (data.telegramChatId && typeof data.telegramChatId === 'string') {
            cloudTelegramChatIdRef.current = data.telegramChatId;
            setTelegramChatId(data.telegramChatId);
            saveTelegramChatId(data.telegramChatId);
          }
        } else {
          // Si Firestore n'a pas encore le document, on pousse la configuration présente dans ce navigateur
          const localTok = getSavedTelegramToken();
          const localChat = getSavedTelegramChatId() || '8305493071';
          if (localTok) {
            setDoc(doc(db, 'settings', 'notifications'), {
              telegramToken: localTok,
              telegramChatId: localChat,
              updatedAt: new Date().toISOString(),
            }).catch((err) => console.warn('Sync initial settings error:', err));
          }
        }
      },
      (err) => {
        console.warn('Erreur lecture Firestore settings notifications:', err);
      }
    );
    return () => unsubSettings();
  }, []);

  // Synchronisation en temps réel via Firestore onSnapshot
  useEffect(() => {
    const ordersCol = collection(db, 'orders');
    const unsubscribe = onSnapshot(
      ordersCol,
      (snapshot) => {
        setIsCloudConnected(true);
        const fetchedOrders: StoredOrder[] = [];
        snapshot.forEach((docSnap) => {
          fetchedOrders.push(docSnap.data() as StoredOrder);
        });
        // Trier par date / id décroissant (les plus récentes en premier)
        fetchedOrders.sort((a, b) => b.id.localeCompare(a.id));

        // Alerte sonore si une nouvelle commande arrive en direct sur l'ordinateur
        if (!isFirstFirestoreLoadRef.current) {
          const hasNewOrder = snapshot.docChanges().some((change) => change.type === 'added');
          if (hasNewOrder) {
            playNotificationChime();
          }
        }
        isFirstFirestoreLoadRef.current = false;

        setOrders(fetchedOrders);
        try {
          localStorage.setItem('numsgames_orders', JSON.stringify(fetchedOrders));
        } catch (e) {
          console.error(e);
        }
      },
      (error) => {
        console.warn('Erreur Firestore onSnapshot:', error);
        setIsCloudConnected(false);
        try {
          handleFirestoreError(error, OperationType.GET, 'orders');
        } catch {
          // Secours local conservé
        }
      }
    );

    return () => unsubscribe();
  }, []);

  const handleTestEmailNotification = async (overrideKey?: string) => {
    setIsSendingEmailTest(true);
    setEmailStatusMsg(`Envoi de l'e-mail de test vers ${NOTIFICATION_EMAIL}...`);
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const testOrder: StoredOrder = {
      id: `ord_test_${Date.now()}`,
      ticketId: `TEST-${Math.floor(1000 + Math.random() * 9000)}`,
      categoryTitle: 'Alerte E-mail NumsGames',
      prenom: 'Roman',
      nom: 'Test',
      items: ['Test Notification NumsGames'],
      demandeLibre: 'Test automatique d\'alerte email pour Roman',
      totalPrice: '0 € (Test)',
      date: dateStr,
      status: 'En attente',
    };
    setLastTestOrder(testOrder);

    const res = await sendOrderEmailNotification(testOrder, overrideKey);
    setIsSendingEmailTest(false);
    if (res.success) {
      setEmailStatusMsg(`✅ E-mail envoyé automatiquement à ${NOTIFICATION_EMAIL} ! Vérifiez votre boîte de réception ou vos spams.`);
    } else {
      setShowEmailSetup(true);
      setEmailStatusMsg(`⚠️ ${res.message || 'Validation requise'}. Cliquez sur le bouton Gmail direct.`);
    }
  };

  const handleSaveWeb3Key = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = web3KeyInput.trim();
    saveWeb3Key(cleaned);
    setWeb3KeySavedMsg(cleaned ? '✅ Clé Web3Forms enregistrée ! Test d\'envoi en cours...' : 'Clé réinitialisée.');
    setTimeout(() => setWeb3KeySavedMsg(''), 4000);
    if (cleaned) {
      handleTestEmailNotification(cleaned);
    }
  };

  const handleDetectTelegram = async () => {
    const token = telegramTokenInput.trim() || getSavedTelegramToken();
    if (!token) {
      setTelegramStatusMsg("⚠️ Veuillez d'abord renseigner le Token de votre bot Telegram ci-dessous.");
      return;
    }
    setIsCheckingTelegram(true);
    setTelegramStatusMsg("Recherche de messages sur votre bot Telegram...");
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
        const lastUpdate = data.result[data.result.length - 1];
        const foundChatId = String(lastUpdate.message?.chat?.id || lastUpdate.my_chat_member?.chat?.id || '');
        const foundName = lastUpdate.message?.chat?.first_name || lastUpdate.message?.chat?.username || 'Roman';
        if (foundChatId) {
          saveTelegramToken(token);
          saveTelegramChatId(foundChatId);
          setTelegramChatId(foundChatId);
          setTelegramStatusMsg(`✅ Compte de ${foundName} connecté (Chat ID: ${foundChatId}) ! Message test en cours d'envoi...`);
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: foundChatId,
              text: `🎉 *Félicitations Roman !*\n\nVotre compte Telegram est maintenant relié à NumsGames.\nVous recevrez une notification instantanée ici pour chaque nouvelle commande !`,
              parse_mode: 'Markdown',
            }),
          });
          setIsCheckingTelegram(false);
          return;
        }
      }
      setTelegramStatusMsg("⚠️ Aucun message reçu pour l'instant. Ouvrez Telegram, envoyez /start à votre bot, puis réessayez !");
    } catch (err) {
      setTelegramStatusMsg(`Erreur : ${String(err)}`);
    }
    setIsCheckingTelegram(false);
  };

  const handleSaveTelegramConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedToken = telegramTokenInput.trim();
    const cleanedChatId = telegramChatId.trim() || '8305493071';
    saveTelegramToken(cleanedToken);
    saveTelegramChatId(cleanedChatId);
    cloudTelegramTokenRef.current = cleanedToken;
    cloudTelegramChatIdRef.current = cleanedChatId;

    try {
      await setDoc(doc(db, 'settings', 'notifications'), {
        telegramToken: cleanedToken,
        telegramChatId: cleanedChatId,
        updatedAt: new Date().toISOString(),
      });
      setTelegramStatusMsg(cleanedToken ? `✅ Configuration Telegram enregistrée (Cloud Firestore + Local) !` : 'Configuration réinitialisée.');
    } catch (err) {
      console.warn('Erreur sauvegarde settings notifications Firestore:', err);
      setTelegramStatusMsg(cleanedToken ? `✅ Configuration enregistrée localement (Cloud: ${String(err)})` : 'Configuration réinitialisée.');
    }

    setTimeout(() => setTelegramStatusMsg(''), 4000);
    if (cleanedToken && cleanedChatId) {
      handleTestTelegramNotification(cleanedChatId, cleanedToken);
    }
  };

  const handleTestTelegramNotification = async (overrideChatId?: string, overrideToken?: string) => {
    const targetToken = overrideToken || telegramTokenInput.trim() || getSavedTelegramToken();
    const targetChat = overrideChatId || telegramChatId.trim() || getSavedTelegramChatId();
    if (!targetToken || !targetChat) {
      setTelegramStatusMsg("⚠️ Token ou Chat ID manquant. Renseignez-les ci-dessous et cliquez sur Enregistrer.");
      return;
    }
    setTelegramStatusMsg("Envoi d'un message test sur Telegram...");
    const testOrder: StoredOrder = {
      id: `ord_test_${Date.now()}`,
      ticketId: `TEST-${Math.floor(1000 + Math.random() * 9000)}`,
      categoryTitle: 'Alerte Telegram NumsGames',
      prenom: 'Roman',
      nom: 'Test',
      items: ['Test Notification Telegram'],
      demandeLibre: 'Test automatique d\'alerte Telegram pour Roman',
      totalPrice: '0 € (Test)',
      date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      status: 'En attente',
    };
    const res = await sendTelegramOrderNotification(testOrder, targetChat, targetToken);
    if (res.success) {
      setTelegramStatusMsg("✅ Message envoyé avec succès sur votre Telegram ! Vérifiez votre application.");
    } else {
      setTelegramStatusMsg(`⚠️ ${res.message || 'Erreur lors de l\'envoi'}.`);
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pinInput.length >= 4) return;
    const nextPin = pinInput + digit;
    setPinInput(nextPin);
    setPinError(false);

    if (nextPin.length === 4) {
      if (nextPin === '1324') {
        setIsAdminUnlocked(true);
        setPinError(false);
      } else {
        setPinError(true);
        setTimeout(() => {
          setPinInput('');
          setPinError(false);
        }, 800);
      }
    }
  };

  const handlePinBackspace = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setPinError(false);
  };

  // Gestion de la saisie clavier pour le code PIN
  useEffect(() => {
    if (!isAdminOpen || isAdminUnlocked) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handlePinDigit(e.key);
      } else if (e.key === 'Backspace') {
        handlePinBackspace();
      } else if (e.key === 'Escape') {
        setIsAdminOpen(false);
        setPinInput('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdminOpen, isAdminUnlocked, pinInput]);

  const updateOrderStatus = async (orderId: string, status: 'En attente' | 'Prêt' | 'Terminé') => {
    const updated = orders.map((o) => (o.id === orderId ? { ...o, status } : o));
    setOrders(updated);
    try {
      localStorage.setItem('numsgames_orders', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    try {
      await updateDoc(doc(db, 'orders', orderId), { status });
    } catch (e) {
      console.error('Erreur mise à jour Firestore:', e);
    }
  };

  const deleteOrder = async (orderId: string) => {
    const updated = orders.filter((o) => o.id !== orderId);
    setOrders(updated);
    try {
      localStorage.setItem('numsgames_orders', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    try {
      await deleteDoc(doc(db, 'orders', orderId));
    } catch (e) {
      console.error('Erreur suppression Firestore:', e);
    }
  };

  const clearAllOrders = async () => {
    if (window.confirm('Voulez-vous vraiment effacer toutes les commandes enregistrées sur le Cloud et en local ?')) {
      const toDelete = [...orders];
      setOrders([]);
      try {
        localStorage.removeItem('numsgames_orders');
      } catch (e) {
        console.error(e);
      }
      try {
        for (const o of toDelete) {
          await deleteDoc(doc(db, 'orders', o.id));
        }
      } catch (e) {
        console.error('Erreur suppression globale Firestore:', e);
      }
    }
  };

  const addTestOrder = async () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const testOrder: StoredOrder = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ticketId: `NG-${Math.floor(1000 + Math.random() * 9000)}`,
      categoryTitle: 'Émulateurs',
      prenom: 'Alexandre',
      nom: 'Dupont',
      items: ['Pokémon Version Cristal (Couleur)'],
      demandeLibre: 'NumWorks blanche N0110',
      totalPrice: '4 € (1 jeu couleur 4 €)',
      date: dateStr,
      status: 'En attente',
    };
    try {
      await setDoc(doc(db, 'orders', testOrder.id), testOrder);
    } catch (e) {
      console.warn('Firestore fallback local:', e);
      const updated = [testOrder, ...orders];
      setOrders(updated);
      try {
        localStorage.setItem('numsgames_orders', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleManualImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTicketText.trim()) return;

    // Détection de format texte ou JSON
    let orderToImport: StoredOrder | null = null;
    const raw = manualTicketText.trim();
    if (raw.startsWith('{') && raw.endsWith('}')) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.ticketId && parsed.prenom) {
          orderToImport = {
            id: parsed.id || `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            ticketId: parsed.ticketId,
            categoryTitle: parsed.categoryTitle || 'NumWorks',
            prenom: parsed.prenom,
            nom: parsed.nom || '',
            items: Array.isArray(parsed.items) ? parsed.items : [String(parsed.items)],
            demandeLibre: parsed.demandeLibre || '',
            totalPrice: parsed.totalPrice || '2 €',
            date: parsed.date || new Date().toLocaleDateString('fr-FR'),
            status: parsed.status || 'En attente',
          };
        }
      } catch {
        // Poursuivre le parsing manuel
      }
    }

    if (!orderToImport) {
      const ticketMatch = raw.match(/#?(NG-\d+)/i) || raw.match(/TICKET\s+#?([A-Z0-9-]+)/i);
      const ticketId = ticketMatch ? ticketMatch[1].toUpperCase() : `NG-${Math.floor(1000 + Math.random() * 9000)}`;
      const nomMatch = raw.match(/(?:Nom|ELEVE)\s*:\s*([^\n\r]+)/i);
      const fullName = nomMatch ? nomMatch[1].trim() : 'Élève';
      const parts = fullName.split(' ');
      const prenom = parts[0] || 'Élève';
      const nom = parts.slice(1).join(' ') || '';
      const catMatch = raw.match(/Cat[ée]gorie\s*:\s*([^\n\r]+)/i);
      const categoryTitle = catMatch ? catMatch[1].trim() : 'NumWorks';
      const jeuxMatch = raw.match(/(?:Jeux|PROGRAMMES)\s*:\s*([^\n\r]+)/i);
      const items = jeuxMatch ? jeuxMatch[1].split(',').map((s) => s.trim()) : ['Sélection importée'];
      const prixMatch = raw.match(/Prix\s*:\s*([^\n\r]+)/i);
      const totalPrice = prixMatch ? prixMatch[1].trim() : '2 €';

      const now = new Date();
      const dateStr = now.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });

      orderToImport = {
        id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ticketId,
        categoryTitle,
        prenom,
        nom,
        items,
        totalPrice,
        date: dateStr,
        status: 'En attente',
      };
    }

    try {
      await setDoc(doc(db, 'orders', orderToImport.id), orderToImport);
    } catch {
      setOrders((prev) => [orderToImport!, ...prev]);
    }
    setImportSuccessMsg(`Commande #${orderToImport.ticketId} importée avec succès !`);
    setManualTicketText('');
    setTimeout(() => {
      setImportSuccessMsg('');
      setShowManualImport(false);
    }, 1500);
  };

  const copyAllOrdersText = () => {
    if (orders.length === 0) return;
    const summary = orders
      .map(
        (o) =>
          `[#${o.ticketId}] ${o.prenom} ${o.nom} (${o.date})\n` +
          `Statut : ${o.status.toUpperCase()} | Montant : ${o.totalPrice}\n` +
          `Catégorie : ${o.categoryTitle}\n` +
          `Programmes : ${o.items.join(', ')}\n` +
          (o.demandeLibre ? `Précision : ${o.demandeLibre}\n` : '') +
          `----------------------------------------`
      )
      .join('\n');
    navigator.clipboard.writeText(summary);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

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
    setMobileStep('select');
    setMobileShowLcd(false);
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

    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    const newStoredOrder: StoredOrder = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ticketId: newReceipt.ticketId,
      categoryTitle: newReceipt.categoryTitle,
      prenom: newReceipt.prenom,
      nom: newReceipt.nom,
      items: newReceipt.items,
      demandeLibre: newReceipt.demandeLibre,
      totalPrice: priceText,
      date: dateStr,
      status: 'En attente',
    };

    // 1. Sauvegarde locale immédiate
    setOrders((prev) => {
      const updated = [newStoredOrder, ...prev.filter((o) => o.id !== newStoredOrder.id)];
      try {
        localStorage.setItem('numsgames_orders', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      return updated;
    });

    // 2. Synchronisation instantanée sur le Cloud Firestore (pour que la commande apparaisse sur l'ordi de Roman)
    try {
      setDoc(doc(db, 'orders', newStoredOrder.id), newStoredOrder).catch((err) => {
        console.warn('Erreur transmission Firestore:', err);
      });
    } catch (err) {
      console.warn('Erreur Firestore:', err);
    }

    // 3. Envoi automatique d'un e-mail d'alerte instantané à Roman
    sendOrderEmailNotification(newStoredOrder).catch((err) => {
      console.warn('Erreur transmission notification email:', err);
    });

    // 4. Envoi automatique instantané sur Telegram (@NumsGames_bot)
    (async () => {
      let targetToken = cloudTelegramTokenRef.current || getSavedTelegramToken();
      let targetChat = cloudTelegramChatIdRef.current || getSavedTelegramChatId() || '8305493071';

      if (!targetToken) {
        try {
          const cfgSnap = await getDoc(doc(db, 'settings', 'notifications'));
          if (cfgSnap.exists()) {
            const cfg = cfgSnap.data();
            if (cfg.telegramToken) targetToken = cfg.telegramToken;
            if (cfg.telegramChatId) targetChat = cfg.telegramChatId;
          }
        } catch (e) {
          console.warn('Erreur récupération express token Telegram:', e);
        }
      }

      if (targetToken && targetChat) {
        const tgRes = await sendTelegramOrderNotification(newStoredOrder, targetChat, targetToken);
        if (!tgRes.success) {
          console.warn('Erreur notification Telegram:', tgRes.message);
        }
      } else {
        console.warn('Telegram non configuré ou token manquant pour la commande');
      }
    })().catch((err) => {
      console.warn('Erreur transmission notification Telegram:', err);
    });

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

  const filteredOrders = orders.filter((o) => {
    if (adminFilter !== 'tous' && o.status !== adminFilter) return false;
    if (adminSearch.trim()) {
      const q = adminSearch.toLowerCase().trim();
      const matchName = `${o.prenom} ${o.nom}`.toLowerCase().includes(q);
      const matchTicket = o.ticketId.toLowerCase().includes(q);
      const matchItems = o.items.some((i) => i.toLowerCase().includes(q));
      return matchName || matchTicket || matchItems;
    }
    return true;
  });

  const totalRevenue = orders.reduce((acc, o) => {
    const match = o.totalPrice?.match(/(\d+)\s*€/);
    return acc + (match ? parseInt(match[1], 10) : 0);
  }, 0);

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-white text-neutral-950 flex flex-col font-sans select-none overflow-x-hidden md:h-screen md:overflow-hidden">
      
      {/* HEADER MINIMAL NOIR SUR BLANC */}
      <header className="h-14 border-b-2 border-neutral-900 px-4 sm:px-6 flex items-center justify-between shrink-0 bg-white z-20">
        <button
          type="button"
          onClick={() => goTo('home')}
          className="text-xl font-black tracking-tight text-neutral-950 hover:text-amber-600 transition-colors flex items-center gap-1 cursor-pointer py-1"
        >
          NumsGames<span className="text-amber-500">.</span>
        </button>

        {currentPage !== 'home' && (
          <button
            type="button"
            onClick={() => goTo('home')}
            className="text-xs font-semibold text-neutral-600 hover:text-black transition-colors flex items-center gap-1.5 cursor-pointer bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 px-3 py-1.5 rounded-lg min-h-[38px] active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Changer de catégorie</span>
          </button>
        )}
      </header>

      {/* ZONE CENTRALE (OPTIMISÉE MOBILE ET DESKTOP) */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-5 flex flex-col justify-start md:justify-center items-center bg-[#fafafa] pb-28 md:pb-5">
        <div className="w-full max-w-5xl mx-auto h-full flex flex-col justify-start md:justify-center">

          {/* ========================================================= */}
          {/* PAGE 1 : ACCUEIL - 3 CARTES ERGONOMIQUES (TACTILE MOBILE)  */}
          {/* ========================================================= */}
          {currentPage === 'home' && (
            <div className="flex flex-col items-center justify-center my-auto py-3 text-center w-full">
              
              {/* Grand Titre NumsGames adaptatif */}
              <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter text-black leading-none mb-6 sm:mb-8 select-none relative inline-flex items-center justify-center">
                <span>Nums<span className="text-amber-500">Games</span></span>
                {/* Zone invisible au clic (située juste après le titre) */}
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminOpen(true);
                    setPinInput('');
                    setPinError(false);
                  }}
                  className="w-10 h-10 opacity-0 cursor-default"
                  aria-label="Zone secrète administrateur"
                  tabIndex={-1}
                />
              </h1>

              {/* LES TROIS PROPOSITIONS EN CARTES TACTILES */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 w-full max-w-4xl mb-4 sm:mb-6">
                
                {/* Carte 1 : Scripts Python */}
                <button
                  type="button"
                  onClick={() => goTo('python')}
                  className="group rounded-3xl bg-white border-2 border-black border-b-[6px] sm:border-b-[7px] p-5 sm:p-7 text-left transition-all active:border-b-2 active:translate-y-1 hover:-translate-y-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.06)] cursor-pointer flex flex-col justify-between min-h-[210px] md:aspect-square active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center justify-center p-2.5 rounded-2xl bg-amber-100 text-amber-700 border-2 border-black shadow-[1px_1px_0px_#000] group-hover:scale-110 transition-transform">
                      <PythonIcon className="w-5 h-5" />
                    </span>
                    <span className="text-[11px] font-mono font-black text-black bg-amber-300 border border-black px-2.5 py-0.5 rounded-md shadow-[1px_1px_0px_#000]">
                      3 pour 2 €
                    </span>
                  </div>

                  <div className="my-auto py-1">
                    <h2 className="text-xl sm:text-2xl font-black text-black group-hover:text-amber-600 transition-colors mb-1">
                      Scripts Python
                    </h2>
                    <p className="text-xs text-neutral-600 font-medium leading-snug">
                      19 jeux et programmes en code Python natif. Choisis un paquet de 3 scripts pour 2 € (ex: 2048, Snake, Pong, Tetris, Échecs, Sudoku, Tanks...).
                    </p>
                  </div>

                  <div className="text-[11px] font-mono font-bold text-black pt-3 border-t-2 border-neutral-100 flex items-center justify-between min-h-[36px]">
                    <span>Composer mon paquet (2 €)</span>
                    <ArrowRight className="w-4 h-4 text-black group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* Carte 2 : Émulateurs */}
                <button
                  type="button"
                  onClick={() => goTo('emulateurs')}
                  className="group rounded-3xl bg-white border-2 border-black border-b-[6px] sm:border-b-[7px] p-5 sm:p-7 text-left transition-all active:border-b-2 active:translate-y-1 hover:-translate-y-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.06)] cursor-pointer flex flex-col justify-between min-h-[210px] md:aspect-square active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center justify-center p-2.5 rounded-2xl bg-sky-100 text-sky-800 border-2 border-black shadow-[1px_1px_0px_#000] group-hover:scale-110 transition-transform">
                      <Gamepad2 className="w-5 h-5" />
                    </span>
                    <span className="text-[11px] font-mono font-black text-black bg-sky-200 border border-black px-2.5 py-0.5 rounded-md shadow-[1px_1px_0px_#000]">
                      3 € ou 4 € (1 jeu)
                    </span>
                  </div>

                  <div className="my-auto py-1">
                    <h2 className="text-xl sm:text-2xl font-black text-black group-hover:text-sky-700 transition-colors mb-1">
                      Émulateurs
                    </h2>
                    <p className="text-xs text-neutral-600 font-medium leading-snug">
                      10 jeux rétro Game Boy (1 seul jeu au choix par calculatrice). 3 € pour un jeu noir & blanc (Pokémon Rouge/Bleu/Jaune, Mario, Zelda) ou 4 € en couleur (Pokémon Cristal, Or, Argent).
                    </p>
                  </div>

                  <div className="text-[11px] font-mono font-bold text-sky-900 pt-3 border-t-2 border-neutral-100 flex items-center justify-between min-h-[36px]">
                    <span>Choisir mon jeu (3 € ou 4 €)</span>
                    <ArrowRight className="w-4 h-4 text-black group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* Carte 3 : Appli */}
                <button
                  type="button"
                  onClick={() => goTo('applications')}
                  className="group rounded-3xl bg-white border-2 border-black border-b-[6px] sm:border-b-[7px] p-5 sm:p-7 text-left transition-all active:border-b-2 active:translate-y-1 hover:-translate-y-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.06)] cursor-pointer flex flex-col justify-between min-h-[210px] md:aspect-square active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center justify-center p-2.5 rounded-2xl bg-emerald-100 text-emerald-800 border-2 border-black shadow-[1px_1px_0px_#000] group-hover:scale-110 transition-transform">
                      <LayoutGrid className="w-5 h-5" />
                    </span>
                    <span className="text-[11px] font-mono font-black text-black bg-emerald-200 border border-black px-2.5 py-0.5 rounded-md shadow-[1px_1px_0px_#000]">
                      4 € ou 5 € (1 seule)
                    </span>
                  </div>

                  <div className="my-auto py-1">
                    <h2 className="text-xl sm:text-2xl font-black text-black group-hover:text-emerald-700 transition-colors mb-1">
                      Appli
                    </h2>
                    <p className="text-xs text-neutral-600 font-medium leading-snug">
                      27 jeux portés en .nwa (1 seule application installable). 4 € pour une application individuelle (Celeste, Hollow Knight, Undertale, FNAF, Doom...) ou 5 € pour la Super App NumPlay (29 jeux en 1).
                    </p>
                  </div>

                  <div className="text-[11px] font-mono font-bold text-emerald-900 pt-3 border-t-2 border-neutral-100 flex items-center justify-between min-h-[36px]">
                    <span>Choisir mon application (4 € ou 5 €)</span>
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
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => goTo('home')}
                    className="p-2 rounded-xl bg-white text-black hover:bg-neutral-100 border-2 border-black shadow-[1px_1px_0px_#000] transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center active:scale-95"
                    title="Retour aux catégories"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="p-1.5 rounded-lg bg-amber-100 border-2 border-black text-neutral-950 inline-flex items-center justify-center shadow-[1px_1px_0px_#000]">
                        {currentPage === 'python' && <PythonIcon className="w-4 h-4 text-amber-700" />}
                        {currentPage === 'emulateurs' && <Gamepad2 className="w-4 h-4 text-sky-700" />}
                        {currentPage === 'applications' && <LayoutGrid className="w-4 h-4 text-emerald-700" />}
                      </span>
                      <h2 className="text-base sm:text-xl font-black text-black">
                        {currentCategoryConfig.title}
                      </h2>
                      {currentPage === 'python' && (
                        <span className="text-[10px] sm:text-[11px] font-mono font-black text-black bg-amber-300 border border-black px-2 py-0.5 rounded-full shadow-[1px_1px_0px_#000]">
                          3 pour 2 €
                        </span>
                      )}
                      {currentPage === 'emulateurs' && (
                        <span className="text-[10px] sm:text-[11px] font-mono font-black text-black bg-sky-200 border border-black px-2 py-0.5 rounded-full shadow-[1px_1px_0px_#000]">
                          3 € (N&B) · 4 € (Couleur)
                        </span>
                      )}
                      {currentPage === 'applications' && (
                        <span className="text-[10px] sm:text-[11px] font-mono font-black text-black bg-emerald-200 border border-black px-2 py-0.5 rounded-full shadow-[1px_1px_0px_#000]">
                          4 € ou 5 €
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subcategory filter for Python: All, Jeux & Arcade, Réflexion */}
                {currentPage === 'python' && (
                  <div className="flex items-center gap-1 bg-white border-2 border-black p-1 rounded-xl text-xs shadow-[1px_1px_0px_#000] overflow-x-auto max-w-full no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setPythonSubFilter('all')}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-bold whitespace-nowrap min-h-[34px] ${
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
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-bold whitespace-nowrap min-h-[34px] ${
                        pythonSubFilter === 'Jeux & Arcade'
                          ? 'bg-black text-white'
                          : 'text-neutral-700 hover:text-black hover:bg-neutral-100'
                      }`}
                    >
                      🎮 Jeux (13)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPythonSubFilter('Réflexion & Échecs')}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-bold whitespace-nowrap min-h-[34px] ${
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
                  <div className="flex items-center gap-1 bg-white border-2 border-black p-1 rounded-xl text-xs shadow-[1px_1px_0px_#000] overflow-x-auto max-w-full no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setEmuSubFilter('all')}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-bold whitespace-nowrap min-h-[34px] ${
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
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-black flex items-center gap-1.5 whitespace-nowrap min-h-[34px] ${
                        emuSubFilter === 'color'
                          ? 'bg-amber-300 text-black border border-black shadow-[1px_1px_0px_#000]'
                          : 'text-neutral-800 hover:text-black hover:bg-amber-50'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span>🎨 Couleur · 4 € (3)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmuSubFilter('classic')}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-bold whitespace-nowrap min-h-[34px] ${
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
                  <div className="flex items-center gap-1 bg-white border-2 border-black p-1 rounded-xl text-xs shadow-[1px_1px_0px_#000] overflow-x-auto max-w-full no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setAppSubFilter('all')}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-bold whitespace-nowrap min-h-[34px] ${
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
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-black flex items-center gap-1.5 whitespace-nowrap min-h-[34px] ${
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
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-bold whitespace-nowrap min-h-[34px] ${
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

              {/* Indicateur mobile 2 étapes (visible uniquement sur mobile < md) */}
              <div className="flex md:hidden items-center justify-between bg-white border-2 border-black rounded-2xl p-1.5 mb-2.5 shadow-[2px_2px_0px_#000]">
                <button
                  type="button"
                  onClick={() => setMobileStep('select')}
                  className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px] ${
                    mobileStep === 'select'
                      ? 'bg-black text-white shadow-[1px_1px_0px_rgba(0,0,0,0.2)]'
                      : 'text-neutral-600 hover:text-black'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-amber-400 text-black text-[10px] font-black inline-flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span>1. Sélection des jeux</span>
                </button>

                <div className="px-1 text-neutral-400 font-bold">→</div>

                <button
                  type="button"
                  onClick={() => setMobileStep('details')}
                  className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px] ${
                    mobileStep === 'details'
                      ? 'bg-black text-white shadow-[1px_1px_0px_rgba(0,0,0,0.2)]'
                      : 'text-neutral-600 hover:text-black'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-amber-400 text-black text-[10px] font-black inline-flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>2. Coordonnées</span>
                </button>
              </div>

              {/* Contenu de la page : Choix des éléments + Formulaire + LCD */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 flex-1 min-h-0 overflow-y-auto sm:overflow-visible">
                
                {/* Colonne gauche (Étape 1 sur mobile / Colonne 1 sur Desktop) */}
                <div className={`md:col-span-6 flex flex-col justify-between ${mobileStep === 'select' ? 'flex' : 'hidden md:flex'}`}>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
                        {currentPage === 'emulateurs' ? (
                          <span>Choisis 1 seul jeu :</span>
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
                            ({currentSelectedIds.length}/1{emuPrice > 0 ? ` · ${emuPrice} €` : ''})
                          </span>
                        )}
                        {currentPage === 'applications' && (
                          <span className="text-emerald-800 font-mono text-[11px] font-bold">
                            ({currentSelectedIds.length}/1{appPrice > 0 ? ` · ${appPrice} €` : ''})
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
                          className="text-[11px] text-neutral-500 hover:text-black font-semibold cursor-pointer underline min-h-[32px] flex items-center"
                        >
                          Tout décocher
                        </button>
                      )}
                    </div>

                    {/* Liste des jeux/scripts optimisée pour le toucher */}
                    <div className="space-y-2 max-h-[380px] md:max-h-[340px] overflow-y-auto pr-1">
                      {currentCategoryItems.map((item) => {
                        const isPicked = currentSelectedIds.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              toggleItemForCurrent(currentCategoryConfig.key, item.id)
                            }
                            className={`w-full p-3 rounded-xl border-2 text-left transition-all flex items-start gap-3 text-xs cursor-pointer min-h-[50px] active:scale-[0.99] ${
                              isPicked
                                ? 'bg-amber-50 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-white border-neutral-300 text-neutral-800 hover:border-black'
                            }`}
                          >
                            {/* Checkbox notation [ ] / [✓] ou Radio (●) */}
                            <span
                              className={`w-6 h-6 flex items-center justify-center font-mono font-black shrink-0 text-xs mt-0.5 transition-colors border-2 ${
                                currentPage === 'emulateurs' || currentPage === 'applications'
                                  ? 'rounded-full'
                                  : 'rounded-lg'
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
                              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                <span className="font-mono font-black text-black text-xs sm:text-sm">
                                  {item.title}
                                </span>

                                {/* Badge très voyant pour les jeux en couleur (4 €) */}
                                {item.isColor && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black font-mono tracking-wider bg-amber-300 text-black border-2 border-black shadow-[1px_1px_0px_#000]">
                                    <span>🎨 COULEUR · 4 €</span>
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
                              <div className="text-[11px] text-neutral-600 leading-snug mt-1 line-clamp-2">
                                {item.description}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Écran LCD authentique NumWorks : compact avec accordéon sur mobile, grand sur desktop */}
                  <div className="mt-3 p-3 rounded-xl bg-white border-3 border-black font-mono text-xs text-black shadow-[inset_0_2px_6px_rgba(0,0,0,0.1)]">
                    <div className="text-black font-black text-[11px] flex items-center justify-between border-b border-neutral-200 pb-1 mb-1">
                      <span className="truncate">&gt; {currentCategoryConfig.title.toUpperCase()}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {currentPage === 'python' && (
                          <span className="text-amber-700 font-black">
                            {pythonCount > 0 ? `TOTAL : ${pythonPrice} €` : '2 € LE PAQUET DE 3'}
                          </span>
                        )}
                        {currentPage === 'emulateurs' && (
                          <span className="text-sky-800 font-black">
                            {emuCount > 0
                              ? `PRIX : ${emuPrice} €`
                              : '3 € N&B / 4 € COULEUR'}
                          </span>
                        )}
                        {currentPage === 'applications' && (
                          <span className="text-emerald-800 font-black">
                            {appCount > 0 ? `PRIX : ${appPrice} €` : '4 € / 5 €'}
                          </span>
                        )}
                        {/* Toggle pour afficher ou cacher le détail de l'écran LCD sur mobile */}
                        <button
                          type="button"
                          onClick={() => setMobileShowLcd(!mobileShowLcd)}
                          className="md:hidden text-[10px] text-neutral-700 hover:text-black font-bold underline px-1 cursor-pointer"
                        >
                          {mobileShowLcd ? 'Masquer' : 'Aperçu LCD'}
                        </button>
                      </div>
                    </div>

                    <div className={`${mobileShowLcd ? 'block' : 'hidden md:block'} space-y-0.5 pt-0.5`}>
                      <div className="text-neutral-900 font-bold text-[11px] truncate">
                        &gt; {prenom || nom ? `${prenom} ${nom}`.trim() : 'Nom Prénom...'}
                      </div>
                      <div className="text-neutral-700 text-[11px] truncate">
                        &gt; {currentSelectedTitles.length > 0
                          ? currentSelectedTitles.join(', ')
                          : currentPage === 'python'
                          ? 'Aucun script coché'
                          : currentPage === 'emulateurs'
                          ? 'Aucun émulateur sélectionné'
                          : 'Aucune application sélectionnée'}
                      </div>
                      {currentPage === 'python' && pythonCount > 0 && pythonRemainingToFullPack > 0 && (
                        <div className="text-amber-800 text-[10px] pt-1 font-semibold">
                          &gt; Astuce : tu peux encore choisir {pythonRemainingToFullPack} script{pythonRemainingToFullPack > 1 ? 's' : ''} sans surcoût !
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Colonne droite (Étape 2 sur mobile / Colonne 2 sur Desktop) : Formulaire */}
                <form
                  onSubmit={handleSubmit}
                  className={`md:col-span-6 bg-white border-2 border-black rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-[3px_3px_0px_#000] ${mobileStep === 'details' ? 'flex' : 'hidden md:flex'}`}
                >
                  <div className="space-y-3">
                    
                    {/* Bouton retour vers l'étape 1 (visible uniquement sur mobile) */}
                    <div className="md:hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setMobileStep('select');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="w-full min-h-[44px] py-2 px-3 bg-neutral-100 hover:bg-neutral-200 text-black border-2 border-black rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-[1px_1px_0px_#000] active:scale-95"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>← Modifier ma sélection ({currentSelectedTitles.length} article{currentSelectedTitles.length > 1 ? 's' : ''})</span>
                      </button>
                    </div>

                    {/* Récapitulatif clair de la commande sur mobile */}
                    <div className="md:hidden p-3 bg-amber-50 border-2 border-black rounded-2xl text-xs shadow-[2px_2px_0px_#000]">
                      <div className="flex items-center justify-between font-black text-black mb-1">
                        <span className="uppercase tracking-tight text-[11px]">Articles choisis :</span>
                        <span className="font-mono bg-amber-300 border border-black px-2 py-0.5 rounded text-[11px] font-black">
                          {currentPage === 'python'
                            ? pythonCount > 0 ? `${pythonPrice} €` : '2 €'
                            : currentPage === 'emulateurs'
                            ? emuCount > 0 ? `${emuPrice} €` : '3 € / 4 €'
                            : appCount > 0 ? `${appPrice} €` : '4 € / 5 €'}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-neutral-800 line-clamp-2">
                        {currentSelectedTitles.length > 0 ? currentSelectedTitles.join(', ') : 'Aucun jeu sélectionné'}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs font-black text-black uppercase tracking-wider pb-1.5 border-b border-neutral-200">
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
                          {appCount > 0 ? `${appPrice} € (1 appli)` : '4 € / 5 €'}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block space-y-1">
                        <span className="text-xs font-black text-black">Prénom *</span>
                        <input
                          type="text"
                          required
                          value={prenom}
                          onChange={(e) => setPrenom(e.target.value)}
                          placeholder="Ton prénom"
                          className="w-full bg-neutral-50 border-2 border-neutral-300 focus:border-black text-black rounded-xl p-3 text-base sm:text-xs focus:outline-none min-h-[46px]"
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-xs font-black text-black">Nom *</span>
                        <input
                          type="text"
                          required
                          value={nom}
                          onChange={(e) => setNom(e.target.value)}
                          placeholder="Ton nom"
                          className="w-full bg-neutral-50 border-2 border-neutral-300 focus:border-black text-black rounded-xl p-3 text-base sm:text-xs focus:outline-none min-h-[46px]"
                        />
                      </label>
                    </div>

                    <label className="block space-y-1">
                      <span className="text-xs font-black text-black">
                        Remarque ou précision (optionnel)
                      </span>
                      <textarea
                        rows={2}
                        value={demandeLibre}
                        onChange={(e) => setDemandeLibre(e.target.value)}
                        placeholder="Ex: Version de la calculatrice, modèle blanc ou noir..."
                        className="w-full bg-neutral-50 border-2 border-neutral-300 focus:border-black text-black rounded-xl p-3 text-base sm:text-xs focus:outline-none resize-none"
                      />
                    </label>

                    {/* Rappel prix & règlement tactile */}
                    <div className="text-xs text-neutral-700 bg-neutral-50 p-3 rounded-xl border border-neutral-200 flex items-center justify-between">
                      <span className="font-black text-black">Règlement en main propre :</span>
                      <span className="text-black font-mono font-bold text-xs sm:text-sm">
                        {currentPage === 'python' && (pythonCount > 0 ? `${pythonPrice} €` : '2 € le paquet de 3')}
                        {currentPage === 'emulateurs' && (emuCount > 0 ? `${emuPrice} € (${selectedEmu?.isColor ? '1 couleur 4 €' : '1 noir & blanc 3 €'})` : '3 € N&B · 4 € Couleur')}
                        {currentPage === 'applications' && (appCount > 0 ? `${appPrice} € (1 application)` : '4 € indiv. / 5 € super app')}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-neutral-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-3">
                    <span className="text-xs font-mono font-bold text-neutral-700 text-center sm:text-left">
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
                      className="w-full sm:w-auto min-h-[50px] px-6 py-3 bg-black hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl transition-all shadow-[2px_2px_0px_rgba(0,0,0,0.3)] flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                      <Send className="w-4 h-4 text-amber-400" />
                      <span>Envoyer ma commande</span>
                    </button>
                  </div>
                </form>

              </div>

              {/* BARRE D'ACTION MOBILE FIXÉE EN BAS (Uniquement sur mobile et Étape 1) */}
              {mobileStep === 'select' && (
                <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t-2 border-black p-3.5 md:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.12)]">
                  <div className="max-w-md mx-auto flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-tight">
                        {currentPage === 'python' ? 'Paquet en cours' : 'Sélection'}
                      </span>
                      <span className="text-sm font-mono font-black text-black">
                        {currentPage === 'python'
                          ? `${pythonCount} script${pythonCount > 1 ? 's' : ''} · ${pythonCount > 0 ? `${pythonPrice} €` : '2 € / 3'}`
                          : currentPage === 'emulateurs'
                          ? emuCount > 0 ? `${emuPrice} € (${selectedEmu?.isColor ? 'Couleur' : 'N&B'})` : '3 € ou 4 €'
                          : appCount > 0 ? `${appPrice} € (${selectedApp?.isSuperApp ? 'Super App' : '1 App'})` : '4 € ou 5 €'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setMobileStep('details');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="min-h-[48px] px-5 py-2.5 bg-black hover:bg-neutral-800 active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-[2px_2px_0px_rgba(0,0,0,0.3)] flex items-center gap-2 cursor-pointer"
                    >
                      <span>Coordonnées</span>
                      <ArrowRight className="w-4 h-4 text-amber-400" />
                    </button>
                  </div>
                </div>
              )}

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

                <h2 className="text-2xl font-black text-black mb-3">
                  Ticket #{receipt.ticketId}
                </h2>

                <div className="bg-neutral-50 p-4 rounded-xl border-2 border-black text-left font-mono text-xs text-black space-y-1.5 mb-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]">
                  <div>&gt; CATEGORIE : {receipt.categoryTitle}</div>
                  <div>&gt; ELEVE : {receipt.prenom} {receipt.nom}</div>
                  <div>&gt; PROGRAMMES : {receipt.items.join(', ')}</div>
                  {receipt.totalPrice && (
                    <div className="text-black font-black bg-amber-200 inline-block px-1 rounded">&gt; PRIX : {receipt.totalPrice}</div>
                  )}
                  <div className="text-emerald-700 pt-1 font-bold">
                    &gt; STATUT : Prêt pour le dépôt au lycée
                  </div>
                </div>

                <div className="text-xs text-neutral-800 bg-amber-50 border-2 border-black p-3 rounded-xl mb-5 text-left shadow-[2px_2px_0px_#000]">
                  <strong>Consigne avant de me donner ta calculatrice :</strong> Écris ton nom ({receipt.prenom} {receipt.nom}) et le code <strong>#{receipt.ticketId}</strong> sur un morceau de scotch au dos de ta calculatrice. Tu paies {receipt.totalPrice || 'en main propre'} au moment où tu me la donnes.
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={copyReceipt}
                    className="w-full sm:w-auto min-h-[46px] px-4 py-3 bg-neutral-100 hover:bg-neutral-200 text-black border-2 border-black rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-[2px_2px_0px_#000] active:scale-95"
                  >
                    {copied ? <CheckCheck className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copié dans le presse-papier !' : 'Copier le texte du ticket'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrenom('');
                      setNom('');
                      setDemandeLibre('');
                      goTo('home');
                    }}
                    className="w-full sm:w-auto min-h-[46px] px-5 py-3 bg-black hover:bg-neutral-800 text-white font-black rounded-xl text-xs transition-colors cursor-pointer shadow-[2px_2px_0px_rgba(0,0,0,0.2)] active:scale-95 flex items-center justify-center"
                  >
                    Retour à l'accueil
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      </main>

      {/* ZONE INVISIBLE SECRÈTE (Coin inférieur droit de l'écran d'accueil) */}
      {currentPage === 'home' && (
        <button
          type="button"
          onClick={() => {
            setIsAdminOpen(true);
            setPinInput('');
            setPinError(false);
          }}
          className="fixed bottom-0 right-0 w-16 h-16 opacity-0 z-40 cursor-default"
          aria-label="Zone secrète administrateur (coin bas-droit)"
          tabIndex={-1}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL / ESPACE ADMINISTRATEUR PROTÉGÉ PAR LE CODE 1324    */}
      {/* ========================================================= */}
      {isAdminOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          
          {/* VUE 1 : SAISIE DU CODE PIN (1324) */}
          {!isAdminUnlocked ? (
            <div className="w-full max-w-sm bg-white border-3 border-black rounded-3xl p-6 shadow-[6px_6px_0px_#000] relative">
              <button
                type="button"
                onClick={() => {
                  setIsAdminOpen(false);
                  setPinInput('');
                  setPinError(false);
                }}
                className="absolute top-4 right-4 p-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-2 border-black shadow-[1px_1px_0px_#000] transition-colors cursor-pointer"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-amber-100 border-2 border-black text-amber-700 flex items-center justify-center mx-auto mb-3 shadow-[2px_2px_0px_#000]">
                <KeyRound className="w-6 h-6" />
              </div>

              <h2 className="text-xl font-black text-black mb-1">
                Espace Réservé
              </h2>
              <p className="text-xs text-neutral-600 mb-5">
                Entre le code PIN à 4 chiffres pour afficher les commandes
              </p>

              {/* Indicateurs visuels des 4 chiffres */}
              <div className={`flex justify-center items-center gap-3 mb-6 transition-transform ${pinError ? 'animate-bounce' : ''}`}>
                {[0, 1, 2, 3].map((index) => {
                  const isFilled = pinInput.length > index;
                  return (
                    <div
                      key={index}
                      className={`w-4 h-4 rounded-full border-2 transition-all ${
                        pinError
                          ? 'bg-rose-500 border-rose-600 scale-110'
                          : isFilled
                          ? 'bg-black border-black scale-110'
                          : 'bg-neutral-100 border-neutral-400'
                      }`}
                    />
                  );
                })}
              </div>

              {pinError && (
                <div className="text-xs font-bold text-rose-600 mb-3 bg-rose-50 border border-rose-300 py-1 px-3 rounded-lg inline-block">
                  Code erroné, réessaie !
                </div>
              )}

              {/* Pavé numérique tactile et interactif */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto mb-4">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handlePinDigit(num)}
                    className="p-3.5 rounded-2xl bg-white hover:bg-neutral-100 active:bg-neutral-200 border-2 border-black text-lg font-mono font-black text-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setPinInput('');
                    setPinError(false);
                  }}
                  className="p-3.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 border-2 border-black text-xs font-mono font-black text-neutral-700 shadow-[2px_2px_0px_#000] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center justify-center"
                  title="Effacer tout"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => handlePinDigit('0')}
                  className="p-3.5 rounded-2xl bg-white hover:bg-neutral-100 active:bg-neutral-200 border-2 border-black text-lg font-mono font-black text-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handlePinBackspace}
                  className="p-3.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 border-2 border-black text-sm font-mono font-black text-neutral-800 shadow-[2px_2px_0px_#000] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center justify-center"
                  title="Effacer le dernier chiffre"
                >
                  ⌫
                </button>
              </div>

              <div className="text-[11px] text-neutral-500 font-mono">
                Tu peux aussi taper le code au clavier
              </div>
            </div>
          ) : (
            /* VUE 2 : LISTE COMPLÈTE DES COMMANDES ACTUELLES */
            <div className="w-full max-w-4xl bg-white border-3 border-black rounded-3xl shadow-[8px_8px_0px_#000] flex flex-col h-[90vh] max-h-[820px] overflow-hidden">
              
              {/* Entête du panneau admin */}
              <div className="p-4 sm:p-5 border-b-2 border-black bg-neutral-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-100 border-2 border-black rounded-xl text-emerald-800 shadow-[1px_1px_0px_#000]">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-black text-black">
                        Commandes Actuelles
                      </h2>
                      <span className="text-[10px] font-mono font-black bg-emerald-200 border border-black px-2 py-0.5 rounded-full shadow-[1px_1px_0px_#000]">
                        ADMIN VÉRIFIÉ
                      </span>
                      {isCloudConnected ? (
                        <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-[1px_1px_0px_#000]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          <span>Sync Téléphone & PC Active</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono font-bold bg-neutral-200 text-neutral-700 border border-neutral-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span>Secours Local</span>
                        </span>
                      )}
                      <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-[1px_1px_0px_#000]">
                        <Mail className="w-3 h-3 text-amber-700" />
                        <span>Alerte mail : {NOTIFICATION_EMAIL}</span>
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600 font-medium">
                      {orders.length} commande{orders.length > 1 ? 's' : ''} enregistrée{orders.length > 1 ? 's' : ''} au total · Synchronisées en direct
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowEmailSetup(!showEmailSetup)}
                    className={`px-3 py-1.5 rounded-xl border-2 border-black text-xs font-black flex items-center gap-1.5 shadow-[1px_1px_0px_#000] transition-colors cursor-pointer ${
                      showEmailSetup ? 'bg-amber-400 text-black' : 'bg-amber-100 hover:bg-amber-200 text-black'
                    }`}
                    title="Où est le lien d'activation FormSubmit et comment activer les e-mails"
                  >
                    <Mail className="w-3.5 h-3.5 text-amber-800" />
                    <span>{showEmailSetup ? 'Masquer aide e-mail' : 'Aide e-mail'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowTelegramSetup(!showTelegramSetup);
                      setShowEmailSetup(false);
                      if (!showTelegramSetup && !telegramChatId) {
                        handleDetectTelegram();
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl border-2 border-black text-xs font-black flex items-center gap-1.5 shadow-[1px_1px_0px_#000] transition-colors cursor-pointer ${
                      showTelegramSetup ? 'bg-sky-400 text-black' : 'bg-sky-100 hover:bg-sky-200 text-black'
                    }`}
                    title="Connecter et tester vos alertes Telegram sur @NumsGames_bot"
                  >
                    <Send className="w-3.5 h-3.5 text-sky-800" />
                    <span>{showTelegramSetup ? 'Masquer Telegram' : 'Alerte Telegram (@NumsGames_bot)'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSendingEmailTest}
                    onClick={() => handleTestEmailNotification()}
                    className="px-3 py-1.5 rounded-xl bg-amber-200 hover:bg-amber-300 text-black border-2 border-black text-xs font-black flex items-center gap-1.5 shadow-[1px_1px_0px_#000] transition-colors cursor-pointer"
                    title={`Envoyer un e-mail de test à ${NOTIFICATION_EMAIL}`}
                  >
                    <Mail className="w-3.5 h-3.5 text-amber-800" />
                    <span>{isSendingEmailTest ? 'Envoi...' : 'Tester alerte mail'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowManualImport(!showManualImport)}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black text-xs font-black flex items-center gap-1.5 shadow-[1px_1px_0px_#000] transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-neutral-700" />
                    <span>{showManualImport ? 'Masquer import' : 'Importer ticket'}</span>
                  </button>

                  {orders.length > 0 && (
                    <button
                      type="button"
                      onClick={copyAllOrdersText}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black text-xs font-black flex items-center gap-1.5 shadow-[1px_1px_0px_#000] transition-colors cursor-pointer"
                    >
                      {copiedAll ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedAll ? 'Copié !' : 'Copier tout'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsAdminUnlocked(false);
                      setIsAdminOpen(false);
                      setPinInput('');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-black flex items-center gap-1.5 shadow-[1px_1px_0px_rgba(0,0,0,0.3)] transition-colors cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Verrouiller & Quitter</span>
                  </button>
                </div>
              </div>

              {/* Guide et formulaire d'activation de l'adresse e-mail */}
              {showEmailSetup && (
                <div className="p-4 bg-amber-50 border-b-2 border-black text-black">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Mail className="w-5 h-5 text-amber-700" />
                      <h3 className="text-sm font-black text-black">
                        Configuration des alertes e-mail vers {NOTIFICATION_EMAIL}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowEmailSetup(false)}
                      className="text-neutral-500 hover:text-black cursor-pointer p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Explication de l'Erreur 522 Cloudflare */}
                  <div className="mb-4 p-3 bg-rose-50 border-2 border-rose-300 rounded-xl text-xs text-rose-950 flex flex-col gap-1.5 shadow-[1px_1px_0px_#000]">
                    <div className="flex items-center gap-1.5 font-black text-rose-900 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-700" />
                      <span>Explication de l'erreur « Connection timed out Error code 522 » :</span>
                    </div>
                    <p className="leading-relaxed">
                      L'erreur <strong>522</strong> est renvoyée par Cloudflare lorsque les serveurs de <strong>FormSubmit.co</strong> sont temporairement <strong>en panne ou surchargés</strong> (leur serveur ne répond pas dans les temps). Ce n'est <strong>PAS</strong> un bug de votre site NumsGames.
                    </p>
                    <p className="leading-relaxed font-bold">
                      💡 Pour ne plus jamais subir ces pannes, utilisez <strong>Web3Forms</strong> ci-dessous (100% gratuit, configuré en 15 secondes, aucune coupure) ou consultez vos commandes en direct sur votre écran !
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    {/* OPTION 1 : Web3Forms (Recommandé, fiable et sans 522) */}
                    <div className="p-3.5 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-mono font-black text-emerald-800 bg-emerald-200 px-2 py-0.5 rounded-md border border-black">
                            RECOMMANDÉ · 100% FIABLE
                          </span>
                          <span className="text-[10px] font-mono text-neutral-500">Sans panne 522</span>
                        </div>
                        <h4 className="text-xs font-black text-black mb-1">
                          Activer Web3Forms (Gratuit en 15 secondes)
                        </h4>
                        <ol className="text-[11px] text-neutral-700 space-y-1 list-decimal list-inside mb-3 leading-relaxed">
                          <li>
                            Ouvrez{' '}
                            <a
                              href="https://web3forms.com/#start"
                              target="_blank"
                              rel="noreferrer"
                              className="font-bold underline text-blue-700 hover:text-blue-900 inline-flex items-center gap-0.5"
                            >
                              web3forms.com <ExternalLink className="w-3 h-3 inline" />
                            </a>
                          </li>
                          <li>
                            Entrez votre adresse <code>{NOTIFICATION_EMAIL}</code> et validez.
                          </li>
                          <li>
                            Copiez la clé d'accès (Access Key) reçue par e-mail et collez-la ici :
                          </li>
                        </ol>
                      </div>

                      <form onSubmit={handleSaveWeb3Key} className="flex flex-col gap-2">
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={web3KeyInput}
                            onChange={(e) => setWeb3KeyInput(e.target.value)}
                            placeholder="Ex: a1b2c3d4-e5f6-7890-..."
                            className="flex-1 px-2.5 py-1.5 bg-neutral-50 border-2 border-black rounded-lg text-xs font-mono focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="px-3 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-black border-2 border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_#000] cursor-pointer shrink-0"
                          >
                            Enregistrer
                          </button>
                        </div>
                        {web3KeySavedMsg && (
                          <div className="text-[11px] font-mono font-bold text-emerald-700">
                            {web3KeySavedMsg}
                          </div>
                        )}
                      </form>
                    </div>

                    {/* OPTION 2 : Accès direct Gmail & Test instantané */}
                    <div className="p-3.5 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-mono font-black text-sky-800 bg-sky-200 px-2 py-0.5 rounded-md border border-black">
                            ZÉRO CONFIGURATION
                          </span>
                          <span className="text-[10px] font-mono text-neutral-500">100% Garanti</span>
                        </div>
                        <h4 className="text-xs font-black text-black mb-1">
                          Consulter & envoyer en 1 clic via Gmail
                        </h4>
                        <p className="text-[11px] text-neutral-600 mb-2 leading-relaxed">
                          Chaque commande dans la liste ci-dessous dispose d'un bouton <strong>« Gmail »</strong> pour ouvrir le message tout prêt vers votre adresse <code>{NOTIFICATION_EMAIL}</code>.
                        </p>
                      </div>

                      <div className="space-y-2 mt-2">
                        <button
                          type="button"
                          disabled={isSendingEmailTest}
                          onClick={() => handleTestEmailNotification()}
                          className="w-full px-3 py-2 bg-amber-300 hover:bg-amber-400 text-black border-2 border-black rounded-lg font-black text-xs flex items-center justify-center gap-1.5 shadow-[1px_1px_0px_#000] cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-900" />
                          <span>{isSendingEmailTest ? 'Envoi...' : 'Envoyer un test automatique'}</span>
                        </button>

                        {lastTestOrder && (
                          <a
                            href={createGmailComposeUrl(lastTestOrder)}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-black border-2 border-black rounded-lg font-black text-xs flex items-center justify-center gap-1.5 shadow-[1px_1px_0px_#000] cursor-pointer"
                          >
                            <Mail className="w-3.5 h-3.5 text-red-600" />
                            <span>Ouvrir le test directement dans Gmail</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Option FormSubmit de secours */}
                  <details className="mt-2 text-xs text-neutral-600">
                    <summary className="font-bold cursor-pointer text-neutral-700 hover:text-black">
                      › Option FormSubmit (si vous souhaitez réactiver quand FormSubmit aura réparé son serveur)
                    </summary>
                    <div className="mt-2 p-3 bg-neutral-100 border border-neutral-300 rounded-lg space-y-2">
                      <p>
                        Si le serveur FormSubmit est revenu en ligne, vous pouvez forcer l'e-mail d'activation ici :
                      </p>
                      <form
                        action={`https://formsubmit.co/${NOTIFICATION_EMAIL}`}
                        method="POST"
                        target="_blank"
                        className="inline-block"
                      >
                        <input type="hidden" name="_subject" value="NumsGames - Activation commandes" />
                        <input type="hidden" name="Message" value="Activation manuelle Roman" />
                        <button
                          type="submit"
                          className="px-3 py-1.5 bg-neutral-200 hover:bg-neutral-300 text-black border border-black rounded text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Tenter l'envoi FormSubmit (peut afficher 522 si toujours en panne)</span>
                        </button>
                      </form>
                    </div>
                  </details>
                </div>
              )}

              {/* Panneau de configuration Telegram Bot (@NumsGames_bot) */}
              {showTelegramSetup && (
                <div className="p-4 bg-sky-50 border-b-2 border-black text-black">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Send className="w-5 h-5 text-sky-700" />
                      <h3 className="text-sm font-black text-black">
                        Alerte Telegram instantanée sur votre smartphone (@NumsGames_bot)
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTelegramSetup(false)}
                      className="text-neutral-500 hover:text-black cursor-pointer p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    {/* Étape 1 : Ouvrir le bot sur Telegram */}
                    <div className="p-3.5 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-mono font-black text-sky-900 bg-sky-200 px-2 py-0.5 rounded-md border border-black">
                            ÉTAPE 1
                          </span>
                          <span className="text-[10px] font-mono text-neutral-500">Gratuit & Illimité</span>
                        </div>
                        <h4 className="text-xs font-black text-black mb-1">
                          1. Démarrer le bot sur votre Telegram
                        </h4>
                        <p className="text-[11px] text-neutral-700 mb-3 leading-relaxed">
                          Ouvrez le bot <strong>@NumsGames_bot</strong> sur votre application Telegram et appuyez sur <strong>« Démarrer »</strong> (ou envoyez <code>/start</code>).
                        </p>
                      </div>

                      <a
                        href="https://t.me/NumsGames_bot"
                        target="_blank"
                        rel="noreferrer"
                        className="w-full px-3 py-2 bg-sky-400 hover:bg-sky-500 text-black border-2 border-black rounded-lg font-black text-xs flex items-center justify-center gap-1.5 shadow-[1px_1px_0px_#000] cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Ouvrir @NumsGames_bot dans Telegram</span>
                      </a>
                    </div>

                    {/* Étape 2 : Détection automatique ou saisie Chat ID */}
                    <div className="p-3.5 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-mono font-black text-emerald-900 bg-emerald-200 px-2 py-0.5 rounded-md border border-black">
                            ÉTAPE 2
                          </span>
                          <span className="text-[10px] font-mono text-neutral-500">
                            {telegramChatId ? `Connecté : ${telegramChatId}` : 'En attente'}
                          </span>
                        </div>
                        <h4 className="text-xs font-black text-black mb-1">
                          2. Configuration sécurisée (privée)
                        </h4>
                        <p className="text-[11px] text-neutral-700 mb-2 leading-relaxed">
                          Vos identifiants sont synchronisés en toute sécurité dans votre base Cloud Firestore (sans être exposés sur GitHub), permettant l'envoi automatique de l'alerte Telegram pour chaque commande passée par les élèves.
                        </p>
                      </div>

                      <form onSubmit={handleSaveTelegramConfig} className="space-y-2">
                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <label className="text-[10px] font-mono font-bold text-neutral-600 uppercase">
                              Token du Bot Telegram :
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowTelegramTokenMask(!showTelegramTokenMask)}
                              className="text-[10px] text-sky-800 hover:text-black font-semibold underline cursor-pointer"
                            >
                              {showTelegramTokenMask ? 'Masquer' : 'Afficher'}
                            </button>
                          </div>
                          <input
                            type={showTelegramTokenMask ? 'text' : 'password'}
                            value={telegramTokenInput}
                            onChange={(e) => setTelegramTokenInput(e.target.value)}
                            placeholder="Ex: 123456789:ABCdefGHIjklMNO..."
                            className="w-full px-2.5 py-1.5 bg-neutral-50 border-2 border-black rounded-lg text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono font-bold text-neutral-600 uppercase block mb-0.5">
                            Votre Chat ID Telegram :
                          </label>
                          <input
                            type="text"
                            value={telegramChatId}
                            onChange={(e) => setTelegramChatId(e.target.value)}
                            placeholder="Ex: 8305493071"
                            className="w-full px-2.5 py-1.5 bg-neutral-50 border-2 border-black rounded-lg text-xs font-mono"
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="submit"
                            className="flex-1 px-3 py-1.5 bg-black hover:bg-neutral-800 text-white font-black text-xs rounded-lg cursor-pointer shadow-[1px_1px_0px_rgba(0,0,0,0.3)]"
                          >
                            Sauvegarder
                          </button>
                          <button
                            type="button"
                            disabled={isCheckingTelegram}
                            onClick={handleDetectTelegram}
                            className="px-3 py-1.5 bg-sky-200 hover:bg-sky-300 text-black border-2 border-black font-black text-xs rounded-lg cursor-pointer"
                            title="Récupérer automatiquement votre Chat ID après avoir cliqué sur Démarrer"
                          >
                            {isCheckingTelegram ? 'Détection...' : 'Détecter Chat ID'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>

                  {telegramChatId && (
                    <div className="pt-2 border-t border-sky-200 flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold text-sky-900">
                        Chat ID actif : <strong>{telegramChatId}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleTestTelegramNotification()}
                        className="px-3 py-1.5 bg-emerald-300 hover:bg-emerald-400 text-black border-2 border-black font-black text-xs rounded-lg shadow-[1px_1px_0px_#000] cursor-pointer"
                      >
                        Tester l'envoi d'un message Telegram
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Bannière de confirmation Telegram */}
              {telegramStatusMsg && (
                <div className="p-3 bg-sky-50 border-b-2 border-black text-xs font-mono font-bold text-black flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <Send className="w-4 h-4 text-sky-700 shrink-0" />
                    <span>{telegramStatusMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTelegramStatusMsg('')}
                    className="text-neutral-500 hover:text-black cursor-pointer p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Bannière de confirmation de l'alerte e-mail */}
              {emailStatusMsg && (
                <div className="p-3 bg-amber-50 border-b-2 border-black text-xs font-mono font-bold text-black flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <Mail className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>{emailStatusMsg}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {lastTestOrder && (
                      <a
                        href={createGmailComposeUrl(lastTestOrder)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 bg-white hover:bg-neutral-100 text-black border border-black rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-[1px_1px_0px_#000] cursor-pointer"
                      >
                        <Mail className="w-3 h-3 text-red-600" />
                        <span>Ouvrir dans Gmail</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setEmailStatusMsg('')}
                      className="text-neutral-500 hover:text-black cursor-pointer p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Tiroir d'importation manuelle d'un ticket */}
              {showManualImport && (
                <div className="p-3 bg-amber-50 border-b-2 border-black">
                  <form onSubmit={handleManualImport} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono font-bold text-black flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-700" />
                        <span>Coller un texte de ticket ou un QR code copié :</span>
                      </label>
                      {importSuccessMsg && (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-400">
                          {importSuccessMsg}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={manualTicketText}
                        onChange={(e) => setManualTicketText(e.target.value)}
                        placeholder="Ex: TICKET #NG-1234 | Dupont Marc | Pokémon Cristal | 4 €..."
                        className="flex-1 px-3 py-1.5 bg-white border-2 border-black rounded-xl text-xs font-mono focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-black hover:bg-neutral-800 text-white text-xs font-black rounded-xl shadow-[1px_1px_0px_rgba(0,0,0,0.3)] cursor-pointer"
                      >
                        Enregistrer
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Barre de statistiques rapides */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 sm:p-4 bg-white border-b-2 border-neutral-200 shrink-0">
                <div className="p-2.5 rounded-xl bg-neutral-50 border-2 border-neutral-300">
                  <div className="text-[10px] font-mono font-bold text-neutral-500 uppercase">Total Commandes</div>
                  <div className="text-lg font-black text-black">{orders.length}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 border-2 border-amber-300">
                  <div className="text-[10px] font-mono font-bold text-amber-800 uppercase">Montant Total Estimé</div>
                  <div className="text-lg font-black text-amber-900">{totalRevenue} €</div>
                </div>
                <div className="p-2.5 rounded-xl bg-sky-50 border-2 border-sky-300">
                  <div className="text-[10px] font-mono font-bold text-sky-800 uppercase">En Attente</div>
                  <div className="text-lg font-black text-sky-900">
                    {orders.filter((o) => o.status === 'En attente').length}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 border-2 border-emerald-300">
                  <div className="text-[10px] font-mono font-bold text-emerald-800 uppercase">Terminées / Réglées</div>
                  <div className="text-lg font-black text-emerald-900">
                    {orders.filter((o) => o.status === 'Terminé').length}
                  </div>
                </div>
              </div>

              {/* Barre de recherche et filtres de statut */}
              <div className="p-3 sm:p-4 border-b-2 border-neutral-200 bg-neutral-50/50 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={adminSearch}
                    onChange={(e) => setAdminSearch(e.target.value)}
                    placeholder="Rechercher par nom d'élève, ticket #..."
                    className="w-full pl-9 pr-3 py-1.5 bg-white border-2 border-neutral-300 focus:border-black rounded-xl text-xs font-medium text-black focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1 bg-white border-2 border-black p-1 rounded-xl text-xs shadow-[1px_1px_0px_#000]">
                  {(['tous', 'En attente', 'Prêt', 'Terminé'] as const).map((filter) => {
                    const count =
                      filter === 'tous'
                        ? orders.length
                        : orders.filter((o) => o.status === filter).length;
                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setAdminFilter(filter)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          adminFilter === filter
                            ? 'bg-black text-white'
                            : 'text-neutral-700 hover:text-black hover:bg-neutral-100'
                        }`}
                      >
                        {filter === 'tous' ? 'Toutes' : filter} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Liste défilante des commandes */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {filteredOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-neutral-100 border-2 border-black flex items-center justify-center mb-3 text-neutral-500 shadow-[2px_2px_0px_#000]">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-black text-black mb-1">
                      {orders.length === 0
                        ? 'Aucune commande enregistrée pour le moment'
                        : 'Aucune commande ne correspond à ce filtre'}
                    </h3>
                    <p className="text-xs text-neutral-500 max-w-sm mb-4">
                      {orders.length === 0
                        ? 'Dès qu\'un élève valide son formulaire, sa commande apparaîtra ici avec son nom, ses jeux et le prix.'
                        : 'Modifie tes critères de recherche ou réinitialise les filtres.'}
                    </p>
                    {orders.length === 0 && (
                      <button
                        type="button"
                        onClick={addTestOrder}
                        className="px-4 py-2 rounded-xl bg-amber-300 hover:bg-amber-400 text-black border-2 border-black font-black text-xs flex items-center gap-1.5 shadow-[2px_2px_0px_#000] cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Ajouter une commande test</span>
                      </button>
                    )}
                  </div>
                ) : (
                  filteredOrders.map((order) => {
                    return (
                      <div
                        key={order.id}
                        className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col gap-2.5"
                      >
                        {/* Ligne 1 : Ticket, Date, Prix et Statut */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-black bg-neutral-100 border border-neutral-400 px-2 py-0.5 rounded-md">
                              #{order.ticketId}
                            </span>
                            <span className="text-[11px] font-mono text-neutral-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {order.date}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-black bg-amber-300 text-black border border-black px-2.5 py-0.5 rounded-full shadow-[1px_1px_0px_#000]">
                              {order.totalPrice}
                            </span>
                            <a
                              href={createGmailComposeUrl(order)}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-black border border-neutral-300 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Ouvrir le récapitulatif dans Gmail"
                            >
                              <Mail className="w-3 h-3 text-red-600" />
                              <span>Gmail</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => deleteOrder(order.id)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-300 transition-colors cursor-pointer"
                              title="Supprimer cette commande"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Ligne 2 : Nom de l'élève & Catégorie */}
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <div className="text-base font-black text-black">
                            {order.prenom} {order.nom}
                          </div>
                          <span className="text-[11px] font-mono font-bold text-neutral-600 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded-md">
                            {order.categoryTitle}
                          </span>
                        </div>

                        {/* Ligne 3 : Programmes choisis */}
                        <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
                          <div className="text-[10px] font-mono font-bold text-neutral-500 uppercase mb-1">
                            Sélection demandée :
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {order.items.map((item, idx) => (
                              <span
                                key={idx}
                                className="text-xs font-mono font-semibold bg-white border border-neutral-300 px-2 py-0.5 rounded-md text-black"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Remarque éventuelle */}
                        {order.demandeLibre && (
                          <div className="text-xs text-neutral-700 bg-amber-50/70 border border-amber-200 p-2 rounded-lg italic">
                            <span className="font-bold not-italic font-mono text-[10px] text-amber-900 block">Précision :</span>
                            {order.demandeLibre}
                          </div>
                        )}

                        {/* Ligne 4 : Sélecteur de statut rapide */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className="text-[11px] font-bold text-neutral-600">
                            Statut actuel :
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => updateOrderStatus(order.id, 'En attente')}
                              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-[11px] font-black border transition-all cursor-pointer active:scale-95 ${
                                order.status === 'En attente'
                                  ? 'bg-amber-300 text-black border-black shadow-[1px_1px_0px_#000]'
                                  : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:border-neutral-400'
                              }`}
                            >
                              ⏳ En attente
                            </button>
                            <button
                              type="button"
                              onClick={() => updateOrderStatus(order.id, 'Prêt')}
                              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-[11px] font-black border transition-all cursor-pointer active:scale-95 ${
                                order.status === 'Prêt'
                                  ? 'bg-sky-300 text-black border-black shadow-[1px_1px_0px_#000]'
                                  : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:border-neutral-400'
                              }`}
                            >
                              📦 Prêt
                            </button>
                            <button
                              type="button"
                              onClick={() => updateOrderStatus(order.id, 'Terminé')}
                              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-[11px] font-black border transition-all cursor-pointer active:scale-95 ${
                                order.status === 'Terminé'
                                  ? 'bg-emerald-300 text-black border-black shadow-[1px_1px_0px_#000]'
                                  : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:border-neutral-400'
                              }`}
                            >
                              ✅ Terminé
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pied du panneau admin */}
              <div className="p-3 sm:p-4 border-t-2 border-black bg-neutral-50 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={addTestOrder}
                  className="text-xs font-mono font-bold text-neutral-700 hover:text-black flex items-center gap-1 cursor-pointer underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter une commande test</span>
                </button>

                {orders.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllOrders}
                    className="text-xs font-mono font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Tout effacer</span>
                  </button>
                )}
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}
