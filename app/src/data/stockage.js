// Accès au stockage de l'appareil (localStorage). Toute lecture ou écriture
// peut échouer (navigation privée, mémoire pleine) : l'app continue.
// Clés utilisées (contrat à préserver, voir docs/ETAT-DE-REFERENCE.md) :
// pv_categorie, pv_config, pv_detail, pv_historique, pv_pin, pv_produits_v2,
// pv_retraits, pv_url.
import { toast } from '../ui/toast.js';

export const stockage = {
  lire(cle, defaut) {
    try { const v = localStorage.getItem(cle); return v === null ? defaut : v; } catch { return defaut; }
  },
  ecrire(cle, valeur) {
    try { localStorage.setItem(cle, valeur); } catch { toast('Mémoire de l\'appareil pleine : donnée non enregistrée'); }
  },
  json(cle, defaut) {
    try { const v = localStorage.getItem(cle); return v ? JSON.parse(v) : defaut; } catch { return defaut; }
  },
};
